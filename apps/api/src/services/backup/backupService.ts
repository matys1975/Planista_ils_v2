import path from 'path';
import fs from 'fs';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { getBackupDir, buildPgDumpCommand } from './commandBuilder';

const execAsync = promisify(exec);

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
    logger.info(`Wykonuję backup: ${pgDumpCmd.replace(/\/\/.*:.*@/, '//***:***@')}`);

    const backupDir = getBackupDir();
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }
    const filePath = path.join(backupDir, filename);

    const child = spawn(pgDumpCmd, [], {
        cwd: path.join(process.cwd(), '..', '..'),
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
    });

    const fileStream = fs.createWriteStream(filePath);
    const chunks: Buffer[] = [];

    child.stdout.on('data', (chunk: Buffer) => {
        fileStream.write(chunk);
        chunks.push(chunk);
    });

    let stderrOutput = '';
    child.stderr.on('data', (data: Buffer) => {
        stderrOutput += data.toString();
    });

    await new Promise<void>((resolve, reject) => {
        // Zapobiega crashom serwera, jeśli nie można zapisać pliku (np. EACCES)
        fileStream.on('error', (err) => {
            child.kill();
            reject(new Error(`Błąd zapisu pliku backupu (sprawdź uprawnienia do katalogu): ${err.message}`));
        });

        child.on('close', (code) => {
            fileStream.end();
            if (code !== 0) {
                reject(new Error(`pg_dump zakończył się z kodem ${code}: ${stderrOutput}`));
            } else {
                resolve();
            }
        });
        child.on('error', reject);
    });

    const buffer = Buffer.concat(chunks);
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
        const { stdout } = await execAsync(pgDumpCmd, {
            maxBuffer: 50 * 1024 * 1024,
            cwd: path.join(process.cwd(), '..', '..'),
        });
        if (stdout && stdout.trim().length > 0) {
            const safetyFilename = `pre_restore_safety_${Date.now()}.sql`;
            fs.writeFileSync(path.join(getBackupDir(), safetyFilename), stdout, 'utf-8');
            logger.info(`Backup bezpieczeństwa zapisany: ${safetyFilename}`);
            return safetyFilename;
        }
    } catch {
        logger.warn('Nie udało się utworzyć backupu bezpieczeństwa, kontynuuję restore...');
    }
    return null;
}
