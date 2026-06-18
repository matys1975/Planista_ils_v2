import path from 'path';
import fs from 'fs';
import os from 'os';
import { validateSqlContent } from './sqlValidator';
import { buildDropSchemaCommand, buildPrismaDbPushCommand, buildPsqlCommand } from './commandBuilder';
import { runCommand } from './commandRunner';
import { createSafetyBackup } from './backupService';
import type { BackupLogger } from './backupService';

export interface RestoreResult {
    success: boolean;
    message: string;
    details: {
        fileSize: number;
        errors: number;
        safetyBackupCreated: boolean;
    };
}

export async function restoreFromUpload(
    sqlContent: string,
    originalName: string,
    logger: BackupLogger
): Promise<RestoreResult> {
    const violations = validateSqlContent(sqlContent);
    if (violations.length > 0) {
        logger.warn(`Restore ZABLOKOWANY — wykryto zabronione komendy SQL: ${violations.join(', ')}`);
        throw Object.assign(new Error('SQL_VIOLATIONS'), { violations });
    }

    const uploadedFilename = `restore_upload_${Date.now()}.sql`;
    const fullPath = path.join(os.tmpdir(), uploadedFilename);
    fs.writeFileSync(fullPath, sqlContent, 'utf-8');

    logger.info('Restore: tworzę backup bezpieczeństwa przed przywróceniem...');
    const safetyBackupCreated = !!(await createSafetyBackup(logger));

    try {
        logger.info('Restore: czyszczę bazę danych (DROP SCHEMA)...');
        await runCommand(buildDropSchemaCommand(), { maxBuffer: 50 * 1024 * 1024 });

        logger.info(`Restore: przywracam bazę z pliku: ${originalName} (${sqlContent.length} bajtów)`);
        const restoreResult = process.env.NODE_ENV === 'production'
            ? await runCommand(buildPsqlCommand(['-f', fullPath]), { maxBuffer: 50 * 1024 * 1024 })
            : await runCommand(buildPsqlCommand(), { stdinFile: fullPath, maxBuffer: 50 * 1024 * 1024 });

        logger.info('Restore: synchronizuję nowy schemat Prisma...');
        await runCommand(buildPrismaDbPushCommand(), { maxBuffer: 50 * 1024 * 1024 });

        const warnings = restoreResult.stderr.split('\n').filter((l: string) => l.includes('ERROR')).length;

        logger.info(`Restore zakończony pomyślnie. Ostrzeżenia: ${warnings}`);

        return {
            success: true,
            message: `Baza danych przywrócona pomyślnie z pliku: ${originalName}`,
            details: {
                fileSize: sqlContent.length,
                errors: warnings,
                safetyBackupCreated,
            },
        };
    } finally {
        fs.rmSync(fullPath, { force: true });
    }
}
