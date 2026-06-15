# Planista ILS v2

System zarządzania pensum i planowania zajęć dla Instytutu Lingwistyki Stosowanej.

## 📥 Pobranie projektu

Aby sklonować repozytorium na nowy komputer, wykonaj:
```bash
git clone https://github.com/matys1975/Planista_ils_v2.git
cd Planista_ils_v2
```

## 🚀 Szybki start (Docker) - Najprostszy sposób

Jeśli masz zainstalowanego Dockera, możesz uruchomić całe środowisko (Baza danych, Redis, MinIO + Aplikacja) jedną komendą.

1. **Przygotuj plik `.env`** w głównym folderze (skopiuj go z `.env.example` lub ze starego komputera).
2. **Uruchom projekt:**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d --build
   ```
3. Aplikacja będzie dostępna pod adresem: `http://localhost:3001`

---

## 🛠️ Instalacja lokalna (Development)

Jeśli chcesz rozwijać projekt lokalnie bez Dockera (lub tylko z bazą w Dockerze):

### 1. Wymagania
- Node.js (v18+)
- PostgreSQL 16
- Redis (opcjonalnie dla niektórych funkcji)

### 2. Instalacja
```bash
# Pobierz zależności
npm install
```

### 3. Konfiguracja zmiennych środowiskowych
Musisz utworzyć pliki `.env` w następujących miejscach (skorzystaj z przykładów `.env.example`):
- `./.env` (główny folder)
- `./apps/api/.env`
- `./apps/web/.env`

### 4. Baza danych (Prisma)
Przed pierwszym uruchomieniem przygotuj bazę:
```bash
# Wygenerowanie klienta
npx turbo run generate

# Synchronizacja schematu z bazą
npx prisma db push --schema=packages/database/prisma/schema.prisma

# (Opcjonalnie) Załadowanie danych testowych
npx ts-node packages/database/seed.ts
```

### 5. Uruchomienie
```bash
npm run dev
```

---

## 📂 Struktura projektu (Monorepo)

- `apps/web` - Frontend (React + Vite + Tailwind)
- `apps/api` - Backend (Fastify + Prisma)
- `packages/database` - Wspólny schemat bazy danych i migracje
- `packages/ui` - Wspólne komponenty UI (jeśli używane)

---

## 💾 Backupy

Wersja Dockerowa automatycznie montuje folder `./backups` z hosta do kontenera. Skrypty do backupu znajdują się w folderze `packages/database`.

---

## 🤝 Kontakt
Autor: Mateusz Ławniczak
