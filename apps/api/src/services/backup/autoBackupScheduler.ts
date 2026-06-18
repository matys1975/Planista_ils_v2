import path from 'path';
import fs from 'fs';
import { prisma } from '../../lib/prisma';
import { getBackupDir, buildPgDumpCommand } from './commandBuilder';
import { runCommand } from './commandRunner';

/**
 * Automatyczny scheduler backupów bazy danych.
 *
 * Strategia:
 * - Co 15 minut sprawdza czy minęła 00:15 i czy backup z danego dnia jeszcze nie istnieje.
 * - Przed tworzeniem backupu weryfikuje, czy w bazie nastąpiły jakiekolwiek zmiany
 *   (porównanie sumy wierszy + najnowszego updatedAt z poprzednim stanem).
 * - Automatyczne backupy mają prefix "auto_backup_" i retencję 14 dni.
 * - Ręczne backupy (prefix "backup_planu_") NIE są usuwane.
 */

const AUTO_BACKUP_PREFIX = 'auto_backup_';
const RETENTION_DAYS = 14;
const STATE_FILE = '.last_backup_state.json';
const CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minut
const BACKUP_HOUR = 0;   // 00:xx
const BACKUP_MINUTE = 15; // 00:15

interface BackupState {
  totalRows: number;
  latestUpdate: string | null;
  lastBackupDate: string; // YYYY-MM-DD
}

interface SchedulerLogger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
}

/**
 * Zbiera "fingerprint" stanu bazy danych — sumę wierszy z kluczowych tabel
 * oraz najnowszy timestamp updatedAt.
 */
async function getDatabaseFingerprint(): Promise<{ totalRows: number; latestUpdate: string | null }> {
  // Zliczamy wiersze z głównych tabel danych
  const countResult = await prisma.$queryRaw<[{ total: bigint }]>`
    SELECT (
      (SELECT count(*) FROM "ScheduleEntry") +
      (SELECT count(*) FROM "Course") +
      (SELECT count(*) FROM "Teacher") +
      (SELECT count(*) FROM "Room") +
      (SELECT count(*) FROM "Group") +
      (SELECT count(*) FROM "CourseAllocation") +
      (SELECT count(*) FROM "Semester") +
      (SELECT count(*) FROM "User") +
      (SELECT count(*) FROM "Major") +
      (SELECT count(*) FROM "Institute") +
      (SELECT count(*) FROM "Faculty")
    ) AS total
  `;

  // Najnowszy updatedAt z tabel które mają to pole
  const updateResult = await prisma.$queryRaw<[{ latest: Date | null }]>`
    SELECT MAX(x) AS latest FROM (
      SELECT MAX("updatedAt") AS x FROM "Faculty"
      UNION ALL
      SELECT MAX("updatedAt") FROM "Institute"
      UNION ALL
      SELECT MAX("updatedAt") FROM "User"
      UNION ALL
      SELECT MAX("updatedAt") FROM "Major"
    ) sub
  `;

  return {
    totalRows: Number(countResult[0].total),
    latestUpdate: updateResult[0].latest ? updateResult[0].latest.toISOString() : null,
  };
}

/**
 * Odczytuje zapisany stan ostatniego backupu.
 */
function readLastState(backupDir: string): BackupState | null {
  const statePath = path.join(backupDir, STATE_FILE);
  if (!fs.existsSync(statePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Zapisuje stan po udanym backupie.
 */
function saveState(backupDir: string, state: BackupState): void {
  const statePath = path.join(backupDir, STATE_FILE);
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Tworzy auto-backup bazy danych (analogicznie do streamBackup, ale z innym nazewnictwem).
 */
async function createAutoBackup(logger: SchedulerLogger): Promise<string> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const filename = `${AUTO_BACKUP_PREFIX}${today}.sql`;
  const backupDir = getBackupDir();

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const filePath = path.join(backupDir, filename);
  const pgDumpCmd = buildPgDumpCommand();

  logger.info(`Auto-backup: uruchamiam pg_dump...`);

  const result = await runCommand(pgDumpCmd, {
    stdoutFile: filePath,
    collectStdout: false,
    maxBuffer: 50 * 1024 * 1024,
  });

  if (result.stdoutBytes === 0) {
    // Usuń pusty plik
    fs.unlinkSync(filePath);
    throw new Error('Auto-backup: pg_dump zwrócił pusty wynik');
  }

  logger.info(`Auto-backup zapisany: ${filename} (${(result.stdoutBytes / 1024).toFixed(1)} KB)`);
  return filename;
}

/**
 * Usuwa auto-backupy starsze niż RETENTION_DAYS dni.
 */
function cleanupOldBackups(logger: SchedulerLogger): void {
  const backupDir = getBackupDir();
  if (!fs.existsSync(backupDir)) return;

  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const files = fs.readdirSync(backupDir).filter(f => f.startsWith(AUTO_BACKUP_PREFIX) && f.endsWith('.sql'));

  for (const file of files) {
    const stats = fs.statSync(path.join(backupDir, file));
    if (stats.mtimeMs < cutoff) {
      fs.unlinkSync(path.join(backupDir, file));
      logger.info(`Auto-backup: usunięto stary backup: ${file}`);
    }
  }
}

/**
 * Główna logika uruchamiana co CHECK_INTERVAL_MS.
 * Sprawdza czy pora na backup i czy coś się zmieniło.
 */
async function tick(logger: SchedulerLogger): Promise<void> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const backupDir = getBackupDir();

  // Sprawdź czy jest odpowiednia pora (po BACKUP_HOUR:BACKUP_MINUTE)
  if (now.getHours() < BACKUP_HOUR || (now.getHours() === BACKUP_HOUR && now.getMinutes() < BACKUP_MINUTE)) {
    return; // Za wcześnie
  }

  // Sprawdź czy backup z dzisiaj już istnieje (plik na dysku)
  const todayFilename = `${AUTO_BACKUP_PREFIX}${today}.sql`;
  if (fs.existsSync(path.join(backupDir, todayFilename))) {
    return; // Już zrobiony
  }

  // Sprawdź czy coś się zmieniło w bazie
  try {
    const fingerprint = await getDatabaseFingerprint();
    const lastState = readLastState(backupDir);

    if (lastState &&
        lastState.totalRows === fingerprint.totalRows &&
        lastState.latestUpdate === fingerprint.latestUpdate) {
      // Nic się nie zmieniło — zapisz datę żeby nie sprawdzać ponownie
      logger.info(`Auto-backup: brak zmian w bazie od ostatniego backupu, pomijam (${today})`);
      saveState(backupDir, { ...fingerprint, lastBackupDate: today });
      // Tworzymy pusty znacznik żeby nie sprawdzać ponownie tego dnia
      // (nie tworzymy pliku .sql, bo nie ma zmian)
      return;
    }

    // Są zmiany — tworzymy backup
    logger.info(`Auto-backup: wykryto zmiany w bazie, tworzę backup (${today})`);
    await createAutoBackup(logger);

    // Zapisz nowy stan
    saveState(backupDir, { ...fingerprint, lastBackupDate: today });

    // Oczyść stare backupy
    cleanupOldBackups(logger);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Auto-backup: błąd — ${msg}`);
  }
}

/**
 * Uruchamia scheduler automatycznych backupów.
 * Wywołaj raz przy starcie serwera.
 */
export function startAutoBackupScheduler(logger: SchedulerLogger): void {
  logger.info(`Auto-backup scheduler uruchomiony (interwał: ${CHECK_INTERVAL_MS / 60000} min, godzina backupu: ${String(BACKUP_HOUR).padStart(2, '0')}:${String(BACKUP_MINUTE).padStart(2, '0')}, retencja: ${RETENTION_DAYS} dni)`);

  // Upewnij się że katalog backupów istnieje
  const backupDir = getBackupDir();
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // Pierwsza próba po 1 minucie od startu (żeby nie blokować uruchamiania serwera)
  setTimeout(() => {
    tick(logger).catch(err => logger.error(`Auto-backup tick error: ${err}`));
  }, 60_000);

  // Kolejne próby co CHECK_INTERVAL_MS
  setInterval(() => {
    tick(logger).catch(err => logger.error(`Auto-backup tick error: ${err}`));
  }, CHECK_INTERVAL_MS);
}
