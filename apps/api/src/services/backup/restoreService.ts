import path from 'path';
import fs from 'fs';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { validateSqlContent } from './sqlValidator';
import { getBackupDir, buildPsqlCommand, buildDropSchemaCommand } from './commandBuilder';
import { createSafetyBackup } from './backupService';
import type { BackupLogger } from './backupService';

const execAsync = promisify(exec);

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

    logger.info('Restore: czyszczę bazę danych (DROP SCHEMA)...');
    await execAsync(buildDropSchemaCommand());

    logger.info(`Restore: przywracam bazę z pliku: ${originalName} (${sqlContent.length} bajtów)`);
    let psqlCmd = '';
    if (process.env.NODE_ENV === 'production') {
        psqlCmd = `${buildPsqlCommand()} -f "${fullPath}"`;
    } else {
        // Windows (Node) -> Docker
        psqlCmd = `${buildPsqlCommand()} < "${fullPath}"`;
    }
    
    const { stderr } = await execAsync(psqlCmd, {
        maxBuffer: 50 * 1024 * 1024,
    } as any);

    logger.info('Restore: synchronizuję nowy schemat Prisma...');
    const prismaCmd = process.env.NODE_ENV === 'production'
        ? './packages/database/node_modules/.bin/prisma db push --accept-data-loss --schema=packages/database/prisma/schema.prisma'
        : 'npx -y prisma db push --accept-data-loss';
    
    const prismaCwd = process.env.NODE_ENV === 'production'
        ? process.cwd()
        : path.join(process.cwd(), '..', '..', 'packages', 'database');

    await execAsync(prismaCmd, { cwd: prismaCwd });

    const stderrStr = stderr ? String(stderr) : '';
    const warnings = stderrStr.split('\n').filter((l: string) => l.includes('ERROR')).length;

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
}
