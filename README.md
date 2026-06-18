# Planista ILS v2

Planista to system do planowania zajec, zarzadzania obciazeniami dydaktycznymi i pracy w modelu wielojednostkowym.

## Role

- `SUPER_ADMIN` - pelna konfiguracja systemu, jednostek i uzytkownikow
- `ADMIN` - zarzadzanie danymi i uzytkownikami w swojej jednostce
- `PLANNER` - operacyjna edycja planu i przydzialow w swojej jednostce
- `DEAN` - podglad i analityka wydzialowa
- `VIEWER` - podglad danych w swoim zakresie

## Szybki start produkcyjny

1. Skopiuj `.env.example` do `.env` i uzupelnij sekrety.
2. Uruchom:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

3. Aplikacja bedzie dostepna pod `http://localhost:3001`.

## Aktualizacja na serwerze

Pelna instrukcja jest w `docs/DEPLOY_PRODUCTION.md`.

Skrot:

```bash
git pull --ff-only origin master
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
curl http://127.0.0.1:3001/api/v1/health
```

## Backup i restore

Instrukcja jest w `docs/BACKUP_RESTORE.md`.

Checklista po wdrozeniu jest w `docs/POST_DEPLOY_CHECKLIST.md`.

Najwazniejsze:

- produkcyjne dane Postgresa sa trzymane w wolumenie `pgdata`
- katalog `./backups` jest montowany do kontenera aplikacji
- auto backupy pozostaja aktywne
- przed kazdym wdrozeniem warto zrobic reczny backup

## Development

Wymagania:

- Node.js 20+
- Docker Desktop albo lokalny PostgreSQL

Instalacja:

```bash
npm install
```

Uruchomienie:

```bash
npm run dev
```

Dla lokalnego frontendu mozna ustawic opcjonalnie:

```bash
VITE_API_HOST=127.0.0.1
VITE_API_PORT=3334
```

## Struktura repo

- `apps/web` - frontend React + Vite
- `apps/api` - backend Fastify
- `packages/database` - Prisma schema i skrypty bazy
- `backups` - lokalne backupy SQL
- `docs` - instrukcje operacyjne
