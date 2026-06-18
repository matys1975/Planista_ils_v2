import path from 'path';

export interface CommandSpec {
    command: string;
    args: string[];
    cwd?: string;
    maskedForLog?: string;
}

const RESET_SCHEMA_SQL = 'DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;';
const RESET_SCHEMA_SQL_DEV = 'DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO admin; GRANT ALL ON SCHEMA public TO public;';

/**
 * Zwraca ścieżkę do katalogu backupów.
 * W Dockerze: /app/backups (montowany jako volume)
 * Lokalnie: ../../backups (względem apps/api)
 */
export function getBackupDir(): string {
    if (process.env.BACKUP_DIR) return process.env.BACKUP_DIR;
    if (process.env.NODE_ENV === 'production') {
        return path.join(process.cwd(), 'backups'); // w produkcji cwd to /app, więc ścieżka to /app/backups
    }
    return path.join(process.cwd(), '..', '..', 'backups');
}

export function getProjectRoot(): string {
    return process.env.NODE_ENV === 'production'
        ? process.cwd()
        : path.join(process.cwd(), '..', '..');
}

function getCleanDbUrl(): string | undefined {
    if (!process.env.DATABASE_URL) return undefined;
    return process.env.DATABASE_URL.split('?')[0];
}

/**
 * Buduje komendę pg_dump w zależności od środowiska.
 * W produkcji (Docker): pg_dump bezpośrednio z DATABASE_URL
 * W dev (lokalnie): docker compose exec -T postgres pg_dump
 */
function dockerComposeCommand(): string {
    return process.platform === 'win32' ? 'docker.cmd' : 'docker';
}

function npxCommand(): string {
    return process.platform === 'win32' ? 'npx.cmd' : 'npx';
}

function maskDbUrl(url: string): string {
    return url.replace(/\/\/([^:/@]+):([^@]+)@/, '//***:***@');
}

export function formatCommandForLog(spec: CommandSpec): string {
    if (spec.maskedForLog) return spec.maskedForLog;
    return [spec.command, ...spec.args].join(' ');
}

export function buildPgDumpCommand(): CommandSpec {
    const cleanUrl = getCleanDbUrl();
    if (process.env.NODE_ENV === 'production' && cleanUrl) {
        return {
            command: 'pg_dump',
            args: [cleanUrl],
            cwd: getProjectRoot(),
            maskedForLog: `pg_dump "${maskDbUrl(cleanUrl)}"`,
        };
    }
    return {
        command: dockerComposeCommand(),
        args: ['compose', 'exec', '-T', 'postgres', 'pg_dump', '-U', 'admin', '-d', 'plan_db'],
        cwd: getProjectRoot(),
    };
}

/**
 * Buduje komendę psql do przywracania bazy z pliku SQL.
 * Używa flagi --single-transaction żeby przywrócić atomowo.
 */
export function buildPsqlCommand(extraArgs: string[] = []): CommandSpec {
    const cleanUrl = getCleanDbUrl();
    if (process.env.NODE_ENV === 'production' && cleanUrl) {
        return {
            command: 'psql',
            args: [cleanUrl, ...extraArgs],
            cwd: getProjectRoot(),
            maskedForLog: `psql "${maskDbUrl(cleanUrl)}" ${extraArgs.join(' ')}`.trim(),
        };
    }
    return {
        command: dockerComposeCommand(),
        args: ['compose', 'exec', '-T', 'postgres', 'psql', '-U', 'admin', '-d', 'plan_db', ...extraArgs],
        cwd: getProjectRoot(),
    };
}

/**
 * Buduje komendę czyszczenia schematu bazy (DROP SCHEMA + CREATE SCHEMA).
 */
export function buildDropSchemaCommand(): CommandSpec {
    const resetSql = process.env.NODE_ENV === 'production' ? RESET_SCHEMA_SQL : RESET_SCHEMA_SQL_DEV;
    return buildPsqlCommand(['-c', resetSql]);
}

export function buildPrismaDbPushCommand(): CommandSpec {
    if (process.env.NODE_ENV === 'production') {
        return {
            command: './packages/database/node_modules/.bin/prisma',
            args: ['db', 'push', '--accept-data-loss', '--schema=packages/database/prisma/schema.prisma'],
            cwd: process.cwd(),
        };
    }

    return {
        command: npxCommand(),
        args: ['-y', 'prisma', 'db', 'push', '--accept-data-loss'],
        cwd: path.join(process.cwd(), '..', '..', 'packages', 'database'),
    };
}
