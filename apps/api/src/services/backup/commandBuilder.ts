import path from 'path';

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

function getCleanDbUrl(): string | undefined {
    if (!process.env.DATABASE_URL) return undefined;
    return process.env.DATABASE_URL.split('?')[0];
}

/**
 * Buduje komendę pg_dump w zależności od środowiska.
 * W produkcji (Docker): pg_dump bezpośrednio z DATABASE_URL
 * W dev (lokalnie): docker compose exec -T postgres pg_dump
 */
export function buildPgDumpCommand(): string {
    const cleanUrl = getCleanDbUrl();
    if (process.env.NODE_ENV === 'production' && cleanUrl) {
        return `pg_dump "${cleanUrl}"`;
    }
    return 'docker compose exec -T postgres pg_dump -U admin -d plan_db';
}

/**
 * Buduje komendę psql do przywracania bazy z pliku SQL.
 * Używa flagi --single-transaction żeby przywrócić atomowo.
 */
export function buildPsqlCommand(): string {
    const cleanUrl = getCleanDbUrl();
    if (process.env.NODE_ENV === 'production' && cleanUrl) {
        return `psql "${cleanUrl}"`;
    }
    return 'docker compose exec -T postgres psql -U admin -d plan_db';
}

/**
 * Buduje komendę czyszczenia schematu bazy (DROP SCHEMA + CREATE SCHEMA).
 */
export function buildDropSchemaCommand(): string {
    const cleanUrl = getCleanDbUrl();
    if (process.env.NODE_ENV === 'production' && cleanUrl) {
        return `psql "${cleanUrl}" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;"`;
    }
    return 'docker compose exec -T postgres psql -U admin -d plan_db -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO admin; GRANT ALL ON SCHEMA public TO public;"';
}
