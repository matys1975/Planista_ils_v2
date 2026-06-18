# Backup i restore

## Gdzie sa dane

- PostgreSQL trzyma dane w wolumenie Dockera `pgdata`
- katalog `./backups` na hoscie jest montowany do `/app/backups` w kontenerze aplikacji
- auto backupy zostaja zapisane jako pliki `.sql`

## Reczny backup

Uruchom z katalogu projektu:

```bash
mkdir -p backups
docker compose -f docker-compose.prod.yml exec -T postgres sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "backups/manual_$(date +%F_%H-%M-%S).sql"
ls -lh backups/manual_*.sql | tail -n 1
```

## Jak sprawdzic, czy backup jest poprawny

- plik nie ma rozmiaru `0`
- `ls -lh` pokazuje sensowny rozmiar
- poczatek pliku mozna podejrzec:

```bash
head -n 20 backups/nazwa_pliku.sql
```

## Auto backupy

Po wdrozeniu funkcja auto backupu pozostaje aktywna. Najprosciej sprawdzic to tak:

```bash
ls -lh backups | tail
```

## Restore - zalecenie

Najpierw testuj restore na kopii bazy albo na osobnym hoscie. Nie zaczynaj od produkcji.

## Pelny restore na tej samej bazie

To operacja nadpisujaca dane. Zrob backup bezpieczenstwa przed uruchomieniem.

### 1. Backup bezpieczenstwa

```bash
mkdir -p backups
docker compose -f docker-compose.prod.yml exec -T postgres sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "backups/pre_restore_$(date +%F_%H-%M-%S).sql"
```

### 2. Wyczysc schema `public`

```bash
docker compose -f docker-compose.prod.yml exec -T postgres sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"'
```

### 3. Wgraj backup

```bash
docker compose -f docker-compose.prod.yml exec -T postgres sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < backups/TWOJ_BACKUP.sql
```

### 4. Uruchom ponownie aplikacje

```bash
docker compose -f docker-compose.prod.yml restart app
curl http://127.0.0.1:3001/api/v1/health
```

## Czego nie robic

- nie uruchamiaj restore bez sprawdzonego backupu
- nie usuwaj wolumenow przez `docker compose down -v`, jesli chcesz zachowac dane
- nie nadpisuj produkcji plikiem, ktorego nie zweryfikowales
