# Mapa Orientacyjna Kodu (Codebase Orientation Map)

## Podsumowanie (1-Line Summary)
Jest to aplikacja typu full-stack oparta o architekturę monorepo (Turborepo), zarządzająca planami zajęć akademickich, posiadająca backend w Node.js (Fastify), frontend w React oraz bazę danych PostgreSQL zarządzaną przez Prisma ORM.

## Wyjaśnienie w 5 minut (5-Minute Explanation)
- **Główne zadania w kodzie**: Zarządzanie harmonogramami, obciążeniami dydaktycznymi, słownikami (wykładowcy, sale, przedmioty) oraz integracja z systemem USOS.
- **Główne wejścia**: Żądania HTTP (z aplikacji React), zmienne środowiskowe, ewentualnie zapytania do zewnętrznego API USOS.
- **Główne wyjścia**: Zwracanie danych JSON z API, zapis i odczyt z bazy danych PostgreSQL, interfejs użytkownika renderowany w przeglądarce.
- **Kluczowe pliki**:
  - `apps/api/src/server.ts` (Główny punkt startowy backendu)
  - `apps/web/src/router.tsx` (Główny router frontendu - TanStack Router)
  - `packages/database/prisma/schema.prisma` (Główne źródło prawdy o strukturze bazy danych)
- **Główne ścieżki kodu**: Żądanie z klienta React -> Serwer Fastify -> odpowiedni kontroler w `apps/api/src/routes` -> zapytanie przez Prisma Client (`packages/database`) -> odpowiedź JSON.

## Głębsza Analiza (Deep Dive)
- **Typ**: Monorepo (Turborepo) / Full-stack Web App
- **Główne środowiska uruchomieniowe**: Node.js (Backend), Przeglądarka (Frontend)
- **Punkty wejścia (Entry points)**:
  - `apps/api/src/server.ts`: Rejestruje wszystkie wtyczki Fastify (CORS, Rate Limiting, Helmet), podpina trasy (routes) oraz inicjalizuje połączenie z bazą. W trybie produkcyjnym serwuje również pliki statyczne frontendu.
  - `apps/web/src/router.tsx`: Określa wszystkie widoki i to, jak układają się one w drzewo nawigacyjne (np. /harmonogram, /obciazenia).
  - `packages/database/prisma/schema.prisma`: Definiuje całą strukturę bazy PostgreSQL (modele `Course`, `Semester`, `User`, `Room`, `CourseAllocation`, etc.).

## Struktura Głównego Poziomu (Top-Level Structure)
| Ścieżka | Przeznaczenie | Uwagi |
|------|---------|-------|
| `apps/api/` | Główny kod aplikacji serwerowej (Backend) | API Fastify, integracje, serwisy |
| `apps/web/` | Główny kod interfejsu użytkownika (Frontend) | React, Vite, Tailwind CSS, TanStack Router |
| `packages/database/` | Logika i struktura bazy danych | Schemat Prisma, migracje, skrypty seedujące |

## Kluczowe Granice (Key Boundaries)
- **Prezentacja (Frontend)**: Zlokalizowana w `apps/web/src/features` oraz `apps/web/src/pages`.
- **Domena/Aplikacja (Backend)**: Logika zlokalizowana w `apps/api/src/routes/*` oraz `apps/api/src/services/*`.
- **Persystencja (Baza Danych)**: `packages/database/prisma/schema.prisma` oraz dostęp przez `apps/api/src/lib/prisma.ts`.
- **Aspekty przekrojowe (Cross-cutting concerns)**: Autoryzacja na backendzie znajduje się w `apps/api/src/plugins/auth.ts` (weryfikacja tokenów), a po stronie frontendu w `apps/web/src/store/auth.ts` (Zustand).
- **Zbadane pliki**: `apps/api/src/server.ts`, `apps/web/src/router.tsx`, `packages/database/prisma/schema.prisma`.

---

# Plan Rozbudowy Planisty

Zgodnie z naszymi wcześniejszymi ustaleniami oraz dokonanym audytem, plan rozbudowy systemu obejmuje następujące kroki:

## Faza 1: Zarządzanie "classType" w alokacjach
- **Migracja bazy danych**: Dostosowanie tabeli `CourseAllocation` do uwzględnienia pola `classType` (jako rozszerzenie dodane we wcześniejszych migracjach).
- **Aktualizacja API**: Dodanie modyfikatorów `classType` do ścieżki wprowadzania obciążeń (`apps/api/src/routes/workload.ts`).
- **Aktualizacja UI**: Dodanie wyboru specyficznego typu zajęć w komponencie `DraggableSidebarCourse` oraz widoku Obciążeń (Workload Dashboard), co pozwoli jednemu przedmiotowi posiadać kilka wariantów zajęć bez dublowania rekordu `Course`.

## Faza 2: Zaawansowany widok Sal (Room View)
- **Złożone filtry na frontendzie**: Opracowanie nowego trybu wyświetlania w harmonogramie (`scheduleGridRoute`), gdzie osią Y jest czas, a osią X konkretna sala.
- **Weryfikacja konfliktów**: Zmodyfikowanie mechanizmu walidacji podczas upuszczania (drag & drop), by zniwelować "zjawisko nachodzących się kafelków". Badanie konfliktów po `roomId`, `dayOfWeek`, `startTime`, i `endTime`.

## Faza 3: Bezpieczeństwo i Operacje (DevOps)
- **Skrypty tworzenia kopii zapasowych**: Kontynuacja poprawy działania skryptów Windows Batch w katalogu głównym (jak `zrob_backup_aplikacji.bat`), tak aby działały bezbłędnie z uprawnieniami środowiska dockera (backup bazy danych PostgreSQL bezpośrednio z kontenera).
- **Konteneryzacja na VPS**: Kontrolowanie zdrowia usługi w `docker-compose.prod.yml` i poprawności serwowania plików produkcyjnych przez serwer Fastify (z folderu `apps/web/dist`).

## Faza 4: Panel SuperAdmina (Widok Wydziałowy / Dziekański)
- **Wielodostępność (Multi-tenancy) i Agregacja Backupu**: Zaprojektowanie i wdrożenie mechanizmu bezpiecznego wgrywania backupów z innych instancji instytutowych. Baza danych musi zostać rozbudowana o identyfikator jednostki (np. `instituteId`), aby poprawnie odseparować i zarazem móc złączyć dane.
- **Rola SuperAdmin i Nowy Dashboard**: Stworzenie dedykowanego widoku w aplikacji (`/admin/faculty-dashboard`) dostępnego tylko dla nowej roli (Dziekan).
- **Globalne Raportowanie Obciążeń i Braków**: Implementacja algorytmów łączących obciążenia dydaktyczne nauczycieli (szczególnie tych pracujących w kilku instytutach naraz). Raporty pokażą łączne pensum, nadgodziny, braki kadrowe oraz globalny podgląd harmonogramów na poziomie całego wydziału.
