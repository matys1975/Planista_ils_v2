import path from 'path';
import fs from 'fs';
import { buildPgDumpCommand, formatCommandForLog, getBackupDir } from './commandBuilder';
import { runCommand } from './commandRunner';

export interface BackupFileInfo {
    name: string;
    size: number;
    createdAt: string;
}

export interface BackupLogger {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
}

/**
 * Tworzy streamowany backup pg_dump, zapisuje do pliku i zwraca zawartość jako Buffer.
 */
export async function streamBackup(logger: BackupLogger): Promise<{ filename: string; buffer: Buffer }> {
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
    const filename = `backup_planu_${formattedDate}.sql`;

    const pgDumpCmd = buildPgDumpCommand();
    logger.info(`Wykonuję backup: ${formatCommandForLog(pgDumpCmd)}`);

    const backupDir = getBackupDir();
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }
    const filePath = path.join(backupDir, filename);

    const result = await runCommand(pgDumpCmd, { stdoutFile: filePath, maxBuffer: 50 * 1024 * 1024 });
    const buffer = result.stdout;
    logger.info(`Backup bazy danych zapisany: ${filePath} (${buffer.length} bajtów)`);
    return { filename, buffer };
}

/**
 * Zwraca listę plików backupów.
 */
export function listBackups(): BackupFileInfo[] {
    const backupDir = getBackupDir();
    if (!fs.existsSync(backupDir)) {
        return [];
    }

    return fs
        .readdirSync(backupDir)
        .filter((f) => f.endsWith('.sql'))
        .map((f) => {
            const stats = fs.statSync(path.join(backupDir, f));
            return {
                name: f,
                size: stats.size,
                createdAt: stats.mtime.toISOString(),
            };
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Pobiera zawartość backupu jako string.
 */
export function downloadBackup(filename: string): string {
    const safeName = path.basename(filename);
    const filePath = path.join(getBackupDir(), safeName);
    if (!fs.existsSync(filePath)) {
        throw new Error('Backup not found');
    }
    return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Tworzy backup bezpieczeństwa przed restore.
 */
export async function createSafetyBackup(logger: BackupLogger): Promise<string | null> {
    const pgDumpCmd = buildPgDumpCommand();
    try {
        const result = await runCommand(pgDumpCmd, { maxBuffer: 50 * 1024 * 1024 });
        if (result.stdout.length > 0 && result.stdout.toString('utf-8').trim().length > 0) {
            const backupDir = getBackupDir();
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }
            const safetyFilename = `pre_restore_safety_${Date.now()}.sql`;
            fs.writeFileSync(path.join(backupDir, safetyFilename), result.stdout);
            logger.info(`Backup bezpieczeństwa zapisany: ${safetyFilename}`);
            return safetyFilename;
        }
    } catch {
        logger.warn('Nie udało się utworzyć backupu bezpieczeństwa, kontynuuję restore...');
    }
    return null;
}
