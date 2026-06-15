# Plan Wdrożenia: SuperAdmin i Wielodostępność (Multi-tenancy)

## Decyzja architektoniczna: Model B — Jedna Wspólna Instancja ✅

Wszystkie jednostki Wydziału Neofilologii pracują na **jednej centralnej instalacji Planisty**.
Każda jednostka ma swojego opiekuna (ADMIN), który loguje się i zarządza danymi *wyłącznie* swojego instytutu.
Dziekan (SUPER_ADMIN) widzi **wszystko na żywo** — bez importów, bez opóźnień.

### Jednostki Wydziału Neofilologii (kody USOS):

| Kod  | Nazwa                                    | USOS      |
|------|------------------------------------------|-----------|
| IE   | Instytut Etnolingwistyki                 | 990020100 |
| IFG  | Instytut Filologii Germańskiej           | 990020200 |
| IFW  | Instytut Filologii Wschodniosłowiańskich | 990020300 |
| IJLR | Instytut Języków i Literatur Romańskich  | 990020400 |
| ILS  | Instytut Lingwistyki Stosowanej          | 990020500 |
| IO   | Instytut Orientalistyki                  | 990020600 |
| KML  | Katedra Metodologii Lingwistyki          | 990020700 |
| KS   | Katedra Skandynawistyki                  | 990020800 |

### Hierarchia ról:

| Rola        | Kto               | Co widzi / robi                                             |
|-------------|--------------------|-------------------------------------------------------------|
| SUPER_ADMIN | Dziekan            | Widzi dane WSZYSTKICH jednostek, statystyki, nadgodziny     |
| ADMIN       | Opiekun instytutu  | Widzi i edytuje TYLKO dane swojego instytutu                |
| PLANNER     | Planista           | Układa plan w ramach swojego instytutu                      |
| VIEWER      | Podgląd            | Tylko odczyt                                                |

---

## KROK 1: Modyfikacja Architektury Bazy Danych (Schema) ✅ ZROBIONE

1. **Model `Institute`** z polami: `name`, `shortCode` (unique), `usosCode` (unique).
2. **`instituteId`** (nullable) dodane do: `User`, `Course`, `Teacher`, `Room`, `Group`, `CourseAllocation`.
3. **Rola `SUPER_ADMIN`** dodana do enuma `Role`.

## KROK 2: Import/Eksport JSON (jako narzędzie migracji) ✅ ZROBIONE

Import JSON służy do **inicjalnej migracji danych** z zewnętrznych źródeł, nie do codziennej pracy.
- Eksport: endpoint `/api/v1/superadmin/institutes/:id/export`
- Import: endpoint `/api/v1/superadmin/import` (inteligentne scalanie)

## KROK 3: Bezpieczeństwo i Izolacja Danych w API ⬜ W TRAKCIE

1. **Izolacja na poziomie zapytań (Tenancy isolation)**:
   Każde zapytanie (np. pobieranie listy przedmiotów) musi automatycznie filtrować wyniki. Jeśli prosi o nie zwykły `ADMIN`, Prisma zapytanie zostanie doposażone w `where: { instituteId: admin.instituteId }`.
2. **Middleware i Autoryzacja** ✅:
   RBAC z automatycznym bypass dla `SUPER_ADMIN` + helper `extractInstituteId()`.

## KROK 4: Interfejs Użytkownika (Frontend) ✅ CZĘŚCIOWO ZROBIONE

1. **Dashboard Wydziałowy** ✅: `/superadmin/dashboard` — CRUD jednostek, statystyki, tabela obciążeń.
2. **Przełącznik Kontekstu** ⬜: SuperAdmin klika "Symuluj widok ILS" → interfejs filtruje się jak dla opiekuna ILS.

---

## Następne kroki (Backlog):

1. ⬜ **Migracja DB**: `prisma db push` + `prisma db seed` na aktywnej bazie.
2. ⬜ **Izolacja tenancy**: Dodanie `where: { instituteId }` w routes: teachers, courses, rooms, groups, workload.
3. ⬜ **Przełącznik kontekstu**: Header `X-Simulate-Institute` + dropdown w sidebar.
4. ⬜ **Hardening**: Zmiana haseł testowych, audit log, rate limiting.
