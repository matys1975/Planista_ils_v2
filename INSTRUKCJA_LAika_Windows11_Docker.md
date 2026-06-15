# 📋 Instrukcja uruchomienia Planista ILS v2 na Windows 11 (Docker Desktop)

> **Dla kogo?** Dla osoby, która nie programuje na co dzień, ale potrafi zainstalować programy i skopiować komendy.
> **Co to da?** Aplikacja będzie działać lokalnie w przeglądarce pod adresem `http://localhost:3001`.

---

## ☑️ Krok 1 — Sprawdź, co masz (lub zainstaluj)

Do uruchomienia potrzebujesz **tylko 3 rzeczy**:

| Program | Do czego służy | Gdzie pobrać |
|---------|----------------|--------------|
| **Git** | Pobranie kodu z GitHuba | <https://git-scm.com/download/win> |
| **Docker Desktop** | Uruchamia aplikację w "pudełku" bez instalowania bazy danych | <https://www.docker.com/products/docker-desktop/> |
| **PowerShell** | Wbudowany w Windows 11 — służy do wklejania komend | Już masz (szukaj w menu Start) |

### Instalacja w kilku zdaniach:
1. Pobierz **Git** z linku powyżej → uruchom instalator → klikaj "Next" aż do końca.
2. Pobierz **Docker Desktop** → zainstaluj → **uruchom go** i zaloguj (załóż darmowe konto jeśli trzeba).
3. Włącz w Docker Desktop ustawienie: **Settings → General → "Use the WSL 2 based engine"** (zaznaczone domyślnie na Win11).
4. Zrestartuj komputer jeśli Docker poprosi.

---

## ☑️ Krok 2 — Pobierz projekt z GitHuba

1. Otwórz **PowerShell** (prawym przyciskiem na menu Start → "Terminal (Administrator)" lub zwykły PowerShell).
2. Wklej komendę:
   ```powershell
   git clone https://github.com/matys1975/Planista_ils_v2.git
   ```
3. Wejdź do pobranego folderu:
   ```powershell
   cd Planista_ils_v2
   ```

---

## ☑️ Krok 3 — Przygotuj plik z hasłami (`.env`)

Aplikacja potrzebuje pliku z konfiguracją — podobnie jak większość programów potrzebuje pliku ustawień.

### 3A. Skopiuj przykład
W PowerShell (w folderze `Planista_ils_v2`) wpisz:
```powershell
Copy-Item .env.example .env
```

### 3B. Wygeneruj 4 losowe hasła
Wklej poniższą komendę do PowerShell **4 razy** i za każdym razem zapisz wynik (np. w Notatniku):
```powershell
[System.Guid]::NewGuid().ToString("N")
```

Dostaniesz za każdym razem coś w stylu:
```
3f8a2b4c5d6e7f8a9b0c1d2e3f4a5b6c
```

### 3C. Otwórz plik `.env` do edycji
```powershell
notepad .env
```

Uzupełnij **4 wymagane pola** (wklej wygenerowane hasła):

```ini
# === Baza danych ===
POSTGRES_USER=planista
POSTGRES_PASSWORD=3f8a2b4c5d6e7f8a9b0c1d2e3f4a5b6c   # ← wklej hasło 1
POSTGRES_DB=plan_db

# === Redis ===
REDIS_PASSWORD=7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b         # ← wklej hasło 2

# === MinIO ===
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e   # ← wklej hasło 3

# === Aplikacja ===
JWT_SECRET=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2  # ← wklej hasło 4 (dowolne, min. 32 znaki)
CORS_ORIGIN=http://localhost:3001
LOG_LEVEL=info
NODE_ENV=production
```

> 💡 **Wskazówka:** Nie ruszaj pozostałych linii. Zapisz plik w Notatniku (`Ctrl+S`) i zamknij.

---

## ☑️ Krok 4 — Uruchom aplikację w Dockerze

Upewnij się, że **Docker Desktop jest włączony** (zielony pasek w lewym dolnym rogu).

W PowerShell (w folderze `Planista_ils_v2`) wklej:
```powershell
docker compose -f docker-compose.prod.yml up -d --build
```

### Co się dzieje po wklejeniu komendy?
- Docker pobierze obrazy (PostgreSQL, Redis, MinIO) — może to potrwać **5–15 minut** przy pierwszym uruchomieniu.
- Następnie zbuduje aplikację — kolejne **3–5 minut**.
- Na końcu uruchomi wszystkie usługi.

### Jak sprawdzić, czy się zbudowało?
W PowerShell wpisz:
```powershell
docker compose -f docker-compose.prod.yml ps
```

Powinieneś zobaczyć 4 wpisy w stanie `running` (postgres, redis, minio, app).

---

## ☑️ Krok 5 — Otwórz aplikację w przeglądarce

1. Otwórz przeglądarkę (Chrome/Edge/Firefox).
2. Wpisz adres:
   ```
   http://localhost:3001
   ```
3. Powinna się pojawić strona logowania Planista ILS.

---

## ☑️ Krok 6 — Logowanie i przywrócenie backupu

Przy **pierwszym uruchomieniu** aplikacja automatycznie tworzy domyślne konto administratora:

| Pole | Wartość |
|------|---------|
| **Email** | `admin@planista.local` |
| **Hasło** | `admin123` |
| **Rola** | SUPER_ADMIN (pełne uprawnienia) |

### 6A. Zaloguj się
1. Wejdź na `http://localhost:3001`
2. Wpisz email: `admin@planista.local` i hasło: `admin123`
3. Kliknij **Zaloguj**

### 6B. Wgraj backup danych (opcjonalnie)
Jeśli masz plik backupu `.sql` z poprzedniej instalacji:
1. Po zalogowaniu przejdź do panelu **Backup / Przywracanie**
2. Kliknij **Przywróć backup** i wybierz plik `.sql`
3. Po przywróceniu danych — zaloguj się ponownie danymi z backupu (konto `admin@planista.local` zostanie zastąpione danymi z backupu)

> ⚠️ **Ważne:** Po przywróceniu backupu konto `admin@planista.local` może już nie istnieć — zaloguj się danymi, które były w przywróconym backupie.

> 💡 **Wskazówka:** Domyślny email i hasło admina można zmienić w pliku `.env` za pomocą zmiennych `DEFAULT_ADMIN_EMAIL` i `DEFAULT_ADMIN_PASSWORD` **przed** pierwszym uruchomieniem.

---

## 🛑 Jak zatrzymać aplikację?

W PowerShell (w folderze projektu):
```powershell
docker compose -f docker-compose.prod.yml down
```

Aby wyczyścić wszystko (usunąć też dane bazy — **UWAGA, utracisz dane!**):
```powershell
docker compose -f docker-compose.prod.yml down -v
```

---

## 🔧 Co zrobić, gdy coś nie działa?

| Problem | Rozwiązanie |
|---------|-------------|
| "Docker Desktop is not running" | Uruchom Docker Desktop i poczekaj, aż pasek będzie zielony. |
| "Port 5432 is already allocated" | Masz już PostgreSQL na komputerze. Zatrzymaj go w usługach Windows lub zmień port w `docker-compose.prod.yml`. |
| Aplikacja nie odpowiada | Sprawdź logi: `docker compose -f docker-compose.prod.yml logs app` |
| Błąd "variable is not set" | Nie uzupełniłeś któregoś hasła w pliku `.env`. Sprawdź jeszcze raz. |
| Biała strona po wejściu na `localhost:3001` | Poczekaj 30 sekund — frontend może się jeszcze budować. Sprawdź logi. |

---

## 📦 Opcjonalnie: Załaduj przykładowe dane (seed)

Jeśli chcesz, aby baza miała przykładowe dane (testowe):

1. Otwórz plik `.env` w Notatniku.
2. Na dole dodaj linię:
   ```ini
   SEED_DB=true
   ```
3. Zapisz plik.
4. W PowerShell wykonaj:
   ```powershell
   docker compose -f docker-compose.prod.yml up -d --build
   ```
   
   Jeśli kontenery już działają, zrestartuj je:
   ```powershell
   docker compose -f docker-compose.prod.yml restart
   ```

> ⚠️ **Uwaga:** Seed uruchamia się tylko przy pierwszym starcie. Potem zmień `SEED_DB=true` na `SEED_DB=false` (lub usuń tę linię), żeby nie nadpisać danych przy kolejnym restarcie.

---

## ✅ Podsumowanie — całość w 5 krokach

1. Zainstaluj **Git** i **Docker Desktop**.
2. Pobierz projekt: `git clone https://github.com/matys1975/Planista_ils_v2.git`
3. Wejdź do folderu: `cd Planista_ils_v2`
4. Skopiuj `.env.example` → `.env` i uzupełnij **4 hasła**.
5. Uruchom: `docker compose -f docker-compose.prod.yml up -d --build`
6. Wejdź na `http://localhost:3001` 🎉

---

*Instrukcja przygotowana dla Windows 11. W razie problemów — prześlij zrzut ekranu z błędem z PowerShella.*
