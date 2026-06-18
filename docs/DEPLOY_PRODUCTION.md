# Wdrozenie produkcyjne

Ta instrukcja dotyczy aktualizacji istniejacej instalacji Dockerowej na Ubuntu.

## Zalozenia

- repo jest juz sklonowane, np. w `~/planista`
- plik `.env` juz istnieje
- wdrozenie robisz z katalogu projektu

## 1. Wejdz do katalogu projektu

```bash
cd ~/planista
```

## 2. Zrob backup przed wdrozeniem

```bash
mkdir -p backups
docker compose -f docker-compose.prod.yml exec -T postgres sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "backups/pre_deploy_$(date +%F_%H-%M-%S).sql"
ls -lh backups/pre_deploy_*.sql | tail -n 1
```

Plik backupu nie powinien miec rozmiaru `0`.

## 3. Pobierz najnowszy kod

```bash
git pull --ff-only origin master
```

## 4. Zbuduj i uruchom nowe kontenery

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

## 5. Sprawdz stan uslug

```bash
docker compose -f docker-compose.prod.yml ps
curl http://127.0.0.1:3001/api/v1/health
docker compose -f docker-compose.prod.yml logs --tail=100 app
```

Oczekiwany healthcheck:

```json
{"status":"ok","database":"connected"}
```

## 6. Krotki smoke test w aplikacji

Sprawdz po zalogowaniu:

- logowanie do aplikacji
- dashboard laduje sie bez bledu
- slowniki otwieraja sie poprawnie
- mozna zapisac typowa zmiane w swojej roli
- superadmin widzi funkcje globalne
- auto backupy dalej pojawiaja sie w katalogu `backups`

## Wazne uwagi

- Uzywaj `docker compose`, nie `docker-compose`.
- Aktualizacja nie usuwa danych z Postgresa, jesli zostaje ten sam wolumen `pgdata`.
- Nie wykonuj `docker compose down -v` na produkcji, jesli nie chcesz usunac wolumenow.
