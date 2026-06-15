# 📘 Plan Panelu Wydziałowego dla Dziekana

> **Wersja:** 1.0  
> **Data:** 2026-05-15  
> **Autor:** UI/UX Designer & Database Specialist  
> **System:** Planista ILS v2 — Stack: React + TypeScript + Tailwind + shadcn/ui | Fastify + Prisma + PostgreSQL

---

## 1. Wprowadzenie i Cel

### 1.1 Kontekst
System **Planista ILS v2** obsługuje obecnie wiele jednostek organizacyjnych (`Institute`) w ramach wydziału. Po dodaniu dziesiątek instytutów, katedr, setek użytkowników, prowadzących i grup studenckich, **dziekan** potrzebuje **dedykowanego, scentralizowanego panelu analitycznego** z możliwością:

- **sortowania** i **filtrowania** danych z całego wydziału,
- **analizy obciążeń dydaktycznych** (pensum) na poziomie cross-institute,
- **wyciągania raportów** i eksportu do formatów zewnętrznych,
- **monitorowania zasobów** (sale, grupy, kierunki),
- **zarządzania perspektywą** — szybkie przełączanie między widokiem globalnym a symulacją konkretnej jednostki.

### 1.2 Zakres
Ten dokument definiuje:
1. Nową rolę `DEAN` w systemie RBAC.
2. Zmiany w schemacie Prisma (opcjonalne rozszerzenie).
3. Nowe endpointy API (`/api/v1/dean/*`).
4. Architekturę frontendu — nowe strony, komponenty, hooki.
5. Szczegółowy UI/UX design system dla panelu.
6. Specyfikację sortowania, filtrowania, paginacji i eksportu.
7. Roadmapę implementacji.

---

## 2. Architektura Roli `DEAN`

### 2.1 Hierarchia Ról (z rozszerzeniem)

```
SUPER_ADMIN     → Pełna władza nad całym systemem (wszystkie wydziały, konfiguracja globalna)
    │
    └── DEAN    → NOWA: Pełna władza nad jednym wydziałem (wszystkie jego jednostki)
            │
            ├── ADMIN       → Zarządza jednym Institute (swoją jednostką)
            ├── PLANNER     → Planuje zajęcia w jednym Institute
            └── VIEWER      → Tylko podgląd w jednym Institute
```

### 2.2 Uprawnienia Roli `DEAN`

| Operacja | DEAN | SUPER_ADMIN | ADMIN |
|----------|:----:|:-----------:|:-----:|
| Widok wszystkich jednostek wydziału | ✅ | ✅ | ❌ (tylko swoja) |
| Zarządzanie jednostkami (CRUD) | ✅ | ✅ | ❌ |
| Widok obciążeń cross-institute | ✅ | ✅ | ❌ |
| Eksport raportów wydziałowych | ✅ | ✅ | ❌ |
| Symulacja widoku jednostki (Eye) | ✅ | ✅ | ❌ |
| Zarządzanie użytkownikami wydziału | ✅ | ✅ | ❌ (tylko swoi) |
| Import danych do jednostek | ✅ | ✅ | ❌ |
| Backup / Restore bazy | ❌ | ✅ | ❌ |
| Zarządzanie semestrami | ✅ | ✅ | ✅ |
| Planowanie zajęć (grid) | ✅ | ✅ | ✅ |

### 2.3 Zmiany w RBAC

**Plik:** `apps/api/src/lib/rbac.ts`

```typescript
// Dodaj DEAN do bypass list (DEAN ma dostęp do wszystkiego w swoim wydziale)
export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as { id: string; role: string; email: string; facultyId?: string | null };
    if (!user) return reply.code(403).send({ error: 'Brak uprawnień.' });
    
    // SUPER_ADMIN i DEAN bypassują checki ról
    if (user.role === 'SUPER_ADMIN' || user.role === 'DEAN') return;
    
    if (!roles.includes(user.role)) {
      return reply.code(403).send({ error: 'Brak uprawnień do wykonania tej operacji.' });
    }
  };
}

// Nowa funkcja: extractFacultyScope
export function extractFacultyScope(request: FastifyRequest): { facultyId: string | null; instituteIds: string[] | null } {
  const user = request.user as { id: string; role: string; facultyId?: string | null; instituteId?: string | null };
  
  if (user.role === 'SUPER_ADMIN') {
    return { facultyId: null, instituteIds: null }; // No filter
  }
  
  if (user.role === 'DEAN' && user.facultyId) {
    // DEAN widzi wszystkie institute przypisane do jego faculty
    return { facultyId: user.facultyId, instituteIds: null };
  }
  
  // ADMIN/PLANNER/VIEWER — tylko swoje institute
  return { facultyId: null, instituteIds: user.instituteId ? [user.instituteId] : [] };
}
```

---

## 3. Zmiany w Schemacie Prisma

### 3.1 Opcja A: Minimalna (bez modelu Faculty)

**Plik:** `packages/database/prisma/schema.prisma`

```prisma
enum Role {
  SUPER_ADMIN
  DEAN        // ← NOWA ROLA
  ADMIN
  PLANNER
  VIEWER
}

// Dodaj facultyId do User (opcjonalne — jeśli DEAN jest przypisany do wydziału)
model User {
  id           String    @id @default(uuid())
  email        String    @unique
  passwordHash String
  name         String
  role         Role      @default(VIEWER)
  lastLoginAt  DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  version      Int       @default(0)
  instituteId  String?
  institute    Institute? @relation(fields: [instituteId], references: [id])
  facultyId    String?   // ← NOWE: ID wydziału (dla roli DEAN)
}

// Dodaj facultyId do Institute (opcjonalne — grupowanie jednostek w wydziały)
model Institute {
  id        String   @id @default(uuid())
  name      String
  shortCode String?  @unique
  usosCode  String?  @unique
  facultyId String?  // ← NOWE: przypisanie do wydziału
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users       User[]
  courses     Course[]
  teachers    Teacher[]
  rooms       Room[]
  groups      Group[]
  majors      Major[]
  allocations CourseAllocation[]
  entries     ScheduleEntry[]
}
```

### 3.2 Opcja B: Pełna (z modelem Faculty) — Rekomendowana dla przyszłości

```prisma
model Faculty {
  id        String   @id @default(uuid())
  name      String   // np. "Wydział Neofilologii"
  shortCode String?  @unique // np. "WN"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  institutes Institute[]
  users      User[]
}

model User {
  // ... istniejące pola ...
  facultyId   String?
  faculty     Faculty?   @relation(fields: [facultyId], references: [id])
}

model Institute {
  // ... istniejące pola ...
  facultyId   String?
  faculty     Faculty?   @relation(fields: [facultyId], references: [id])
}
```

> **Rekomendacja:** Zacznij od **Opcji A** (pole `facultyId` jako String na `User` i `Institute`). Jest to migracja bezbolesna, nie wymaga tworzenia nowego modelu. W przyszłości można łatwo przekształcić w Opcję B.

---

## 4. Nowe Endpointy API (`/api/v1/dean/*`)

### 4.1 Struktura Routingu

**Nowy plik:** `apps/api/src/routes/dean.ts`

```typescript
import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { requireRole, extractFacultyScope } from '../lib/rbac';

export default async function deanRoutes(server: FastifyInstance) {
  const preValidation = [server.authenticate, requireRole('DEAN', 'SUPER_ADMIN')];

  // ═══════════════════════════════════════════════════════════════════
  // DEAN DASHBOARD — Główne statystyki wydziałowe
  // ═══════════════════════════════════════════════════════════════════
  server.get('/api/v1/dean/dashboard', { preValidation }, async (request, reply) => {
    const scope = extractFacultyScope(request);
    // ... (zapytania Prisma poniżej)
  });

  // ═══════════════════════════════════════════════════════════════════
  // DEAN INSTITUTES — Lista jednostek z filtrami i sortowaniem
  // ═══════════════════════════════════════════════════════════════════
  server.get('/api/v1/dean/institutes', { preValidation }, async (request, reply) => {
    // Query params: ?sortBy=name|teachers|courses|users&sortDir=asc|desc&search=&status=
  });

  // ═══════════════════════════════════════════════════════════════════
  // DEAN WORKLOAD — Cross-institute obciążenia z zaawansowanymi filtrami
  // ═══════════════════════════════════════════════════════════════════
  server.get('/api/v1/dean/workload', { preValidation }, async (request, reply) => {
    // Query params: ?semesterId=&sortBy=&sortDir=&status=&unit=&search=
  });

  // ═══════════════════════════════════════════════════════════════════
  // DEAN RESOURCES — Analiza zasobów (sale, grupy, kierunki)
  // ═══════════════════════════════════════════════════════════════════
  server.get('/api/v1/dean/resources', { preValidation }, async (request, reply) => {
    // Query params: ?type=rooms|groups|majors&semesterId=
  });

  // ═══════════════════════════════════════════════════════════════════
  // DEAN USERS — Użytkownicy we wszystkich jednostkach wydziału
  // ═══════════════════════════════════════════════════════════════════
  server.get('/api/v1/dean/users', { preValidation }, async (request, reply) => {
    // Query params: ?sortBy=&sortDir=&search=&role=&instituteId=
  });

  // ═══════════════════════════════════════════════════════════════════
  // DEAN REPORTS — Generowanie raportów
  // ═══════════════════════════════════════════════════════════════════
  server.get('/api/v1/dean/reports/:type', { preValidation }, async (request, reply) => {
    // type = 'workload' | 'resources' | 'summary'
    // Query: ?semesterId=&format=csv|json|pdf
  });
}
```

### 4.2 Szczegółowe Zapytania Prisma

#### 4.2.1 `GET /api/v1/dean/dashboard`

```typescript
const { facultyId, instituteIds } = extractFacultyScope(request);

const instituteWhere = facultyId 
  ? { facultyId }
  : instituteIds 
    ? { id: { in: instituteIds } }
    : {};

const [
  institutesCount,
  teachersCount,
  coursesCount,
  usersCount,
  allocationsCount,
  majorsCount,
  groupsCount,
  roomsCount,
  activeSemesters,
] = await Promise.all([
  prisma.institute.count({ where: instituteWhere }),
  prisma.teacher.count({ where: { institute: instituteWhere } }),
  prisma.course.count({ where: { institute: instituteWhere } }),
  prisma.user.count({ where: { institute: instituteWhere } }),
  prisma.courseAllocation.count({ where: { institute: instituteWhere } }),
  prisma.major.count({ where: { institute: instituteWhere } }),
  prisma.group.count({ where: { institute: instituteWhere } }),
  prisma.room.count({ where: { institute: instituteWhere } }),
  prisma.semester.findMany({ 
    where: { isLocked: false }, 
    orderBy: { dateStart: 'desc' },
    take: 3 
  }),
]);

// Obciążenia — top 10 najbardziej przeciążonych
const teachers = await prisma.teacher.findMany({
  where: { institute: instituteWhere },
  include: {
    institute: { select: { name: true, shortCode: true } },
    allocations: { select: { assignedHours: true } },
  },
});

const workloadSummary = teachers.map(t => {
  const total = t.allocations.reduce((s, a) => s + a.assignedHours, 0);
  return {
    id: t.id,
    name: `${t.title} ${t.firstName} ${t.lastName}`,
    institute: t.institute?.name || '—',
    pensumLimit: t.pensumLimit,
    totalHours: total,
    balance: total - t.pensumLimit,
    utilizationPercent: t.pensumLimit > 0 ? Math.round((total / t.pensumLimit) * 100) : 0,
  };
}).sort((a, b) => b.balance - a.balance); // Najbardziej przeciążeni na górze

return {
  data: {
    counts: { institutesCount, teachersCount, coursesCount, usersCount, allocationsCount, majorsCount, groupsCount, roomsCount },
    activeSemesters,
    workloadSummary: workloadSummary.slice(0, 10),
    alerts: {
      overloaded: workloadSummary.filter(w => w.balance > 0).length,
      underloaded: workloadSummary.filter(w => w.balance < 0).length,
      unassignedCourses: 0, // TODO: policz kursy bez allocations
    }
  }
};
```

#### 4.2.2 `GET /api/v1/dean/institutes` (z sortowaniem i filtrowaniem)

```typescript
const { search, sortBy = 'name', sortDir = 'asc', status } = request.query as any;

const orderBy: any = {};
if (sortBy === 'name') orderBy.name = sortDir;
else if (sortBy === 'createdAt') orderBy.createdAt = sortDir;
// Dla sortowania po liczbach (_count) — sortujemy w pamięci po fetchu

const institutes = await prisma.institute.findMany({
  where: {
    ...instituteWhere,
    ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
  },
  include: {
    _count: {
      select: { users: true, courses: true, teachers: true, rooms: true, groups: true, majors: true, allocations: true }
    },
    users: { select: { id: true, name: true, role: true, lastLoginAt: true }, take: 5 },
  },
  orderBy,
});

// Sortowanie po liczbach w pamięci
if (['teachers', 'courses', 'users', 'groups', 'majors'].includes(sortBy)) {
  institutes.sort((a, b) => {
    const aVal = a._count[sortBy as keyof typeof a._count] || 0;
    const bVal = b._count[sortBy as keyof typeof b._count] || 0;
    return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
  });
}

return { data: institutes };
```

#### 4.2.3 `GET /api/v1/dean/workload` (zaawansowane filtrowanie)

```typescript
const { semesterId, sortBy = 'balance', sortDir = 'desc', status, unit, search } = request.query as any;

const teachers = await prisma.teacher.findMany({
  where: {
    institute: instituteWhere,
    ...(unit ? { institute: { name: { equals: unit, mode: 'insensitive' } } } : {}),
    ...(search ? {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ]
    } : {}),
  },
  include: {
    institute: { select: { name: true, shortCode: true } },
    allocations: {
      select: { assignedHours: true, course: { select: { name: true, type: true } } },
      ...(semesterId ? {
        where: { course: { semesterId } }
      } : {}),
    },
  },
});

let workloads = teachers.map(t => {
  const total = t.allocations.reduce((s, a) => s + a.assignedHours, 0);
  return {
    id: t.id,
    name: `${t.title} ${t.firstName} ${t.lastName}`,
    institute: t.institute?.name || '—',
    shortCode: t.institute?.shortCode || '—',
    pensumLimit: t.pensumLimit,
    totalHours: total,
    balance: total - t.pensumLimit,
    isOverloaded: total > t.pensumLimit,
    isUnderloaded: total < t.pensumLimit,
    isOk: total === t.pensumLimit,
    allocationCount: t.allocations.length,
  };
});

// Filtrowanie po statusie
if (status === 'overloaded') workloads = workloads.filter(w => w.isOverloaded);
if (status === 'underloaded') workloads = workloads.filter(w => w.isUnderloaded);
if (status === 'ok') workloads = workloads.filter(w => w.isOk);

// Sortowanie
workloads.sort((a, b) => {
  let cmp = 0;
  if (sortBy === 'name') cmp = a.name.localeCompare(b.name, 'pl');
  else if (sortBy === 'institute') cmp = a.institute.localeCompare(b.institute, 'pl');
  else if (sortBy === 'totalHours') cmp = a.totalHours - b.totalHours;
  else if (sortBy === 'balance') cmp = a.balance - b.balance;
  else if (sortBy === 'pensumLimit') cmp = a.pensumLimit - b.pensumLimit;
  return sortDir === 'asc' ? cmp : -cmp;
});

return { data: workloads };
```

#### 4.2.4 `GET /api/v1/dean/reports/:type` (eksport)

```typescript
const { type } = request.params as { type: string };
const { semesterId, format = 'json' } = request.query as any;

// Pobierz dane (użyj tych samych zapytań co wyżej)
const data = await generateReportData(type, semesterId, instituteWhere);

if (format === 'csv') {
  const csv = convertToCSV(data);
  reply.header('Content-Type', 'text/csv; charset=utf-8');
  reply.header('Content-Disposition', `attachment; filename="report_${type}_${new Date().toISOString().slice(0,10)}.csv"`);
  // Dodaj BOM dla Excela
  reply.send('\uFEFF' + csv);
} else if (format === 'json') {
  reply.send({ data });
} else {
  return reply.code(400).send({ error: 'Nieobsługiwany format. Użyj csv lub json.' });
}
```

---

## 5. Architektura Frontendu

### 5.1 Nowe Pliki i Struktura

```
apps/web/src/
├── pages/
│   └── DeanDashboard.tsx              # Główny panel dziekana
├── features/
│   └── dean/
│       ├── components/
│       │   ├── DeanStatsCards.tsx     # KPI cards (liczniki)
│       │   ├── DeanInstitutesTable.tsx # Tabela jednostek z sortowaniem
│       │   ├── DeanWorkloadTable.tsx  # Tabela obciążeń z filtrami
│       │   ├── DeanResourcesPanel.tsx # Analiza sal/grup/kierunków
│       │   ├── DeanUsersTable.tsx     # Użytkownicy wydziału
│       │   ├── DeanReportGenerator.tsx # Generator raportów
│       │   ├── SortableHeader.tsx     # Reużywalny header z sortowaniem
│       │   ├── FilterChips.tsx        # Chip-based filtry
│       │   ├── ExportButton.tsx       # Przycisk eksportu CSV/JSON
│       │   └── SearchInput.tsx        # Wyszukiwarka z debounce
│       ├── hooks/
│       │   ├── useDeanDashboard.ts    # React Query hook dla dashboardu
│       │   ├── useDeanInstitutes.ts   # Hook dla jednostek
│       │   ├── useDeanWorkload.ts     # Hook dla obciążeń
│       │   └── useDeanExport.ts       # Hook dla eksportu
│       └── types/
│           └── dean.types.ts          # Interfejsy TypeScript
├── router.tsx                         # Dodaj route /dean/dashboard
└── layout/
    └── DashboardLayout.tsx            # Dodaj link w sidebarze
```

### 5.2 Router

**Plik:** `apps/web/src/router.tsx`

```typescript
const deanDashboardRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/dean/dashboard',
  component: lazyRouteComponent(() => import('./pages/DeanDashboard'), 'DeanDashboard'),
});

// W routeTree:
dashboardRoute.addChildren([
  // ... istniejące ...
  deanDashboardRoute,
])
```

### 5.3 Sidebar (DashboardLayout)

**Plik:** `apps/web/src/layout/DashboardLayout.tsx`

Dodaj nową sekcję w nawigacji (tylko dla DEAN i SUPER_ADMIN):

```tsx
{(role === 'DEAN' || role === 'SUPER_ADMIN') && (
  <div className={isCollapsed ? 'mt-4 border-t border-slate-800/30 pt-4 flex flex-col items-center' : 'mt-0'}>
    {!isCollapsed && <h2 className="text-[10px] uppercase text-slate-500 font-bold tracking-widest mb-3 mt-8 px-4">Dziekan</h2>}
    <NavTooltip label="Panel Wydziałowy" isCollapsed={isCollapsed}>
      <Link to="/dean/dashboard" className={`...`}>
        <Crown className="h-5 w-5 flex-shrink-0" /> {!isCollapsed && <span>Panel Wydziałowy</span>}
      </Link>
    </NavTooltip>
  </div>
)}
```

---

## 6. UI/UX Design System

### 6.1 Paleta Kolorów (zgodna z istniejącym systemem)

```css
/* Primary */
--dean-primary: #003366;        /* Navy — główny kolor wydziału */
--dean-accent: #00ADEF;         /* Cyan — akcenty, aktywne stany */
--dean-gold: #FFCC00;           /* Złoty — alerty, highlighty */

/* Statusy */
--status-overloaded: #dc2626;   /* Red-600 — nadgodziny */
--status-underloaded: #d97706;  /* Amber-600 — niedobór */
--status-ok: #059669;           /* Emerald-600 — w normie */
--status-neutral: #64748b;      /* Slate-500 — neutralny */

/* Tła */
--bg-card: #ffffff;
--bg-muted: #f8fafc;
--bg-dark: #0f172a;
```

### 6.2 Typografia

| Element | Rozmiar | Waga | Kolor |
|---------|---------|------|-------|
| H1 (nagłówek strony) | 32px | 800 | #003366 |
| H2 (sekcja) | 20px | 700 | #003366 |
| H3 (karta/podsekcja) | 16px | 600 | #1e293b |
| Body | 14px | 400 | #334155 |
| Caption / Label | 10px | 700 | #64748b (uppercase, tracking-widest) |
| Mono (liczby, kody) | 13px | 500 | #475569 |

### 6.3 Komponenty UI

#### 6.3.1 KPI Card (DeanStatsCards)

```tsx
// Wizualizacja:
┌─────────────────────────────────────┐
│  ┌──────┐                           │
│  │ 👥   │  247                       │
│  │icon  │  ────────────────          │
│  └──────┘  PROWADZĄCY               │
│            ↑ 12% vs zeszły semestr  │
└─────────────────────────────────────┘

// Implementacja:
<div className="bg-card rounded-xl border p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-all">
  <div className="p-3 rounded-xl bg-[#00ADEF]/10 text-[#00ADEF]">
    <Icon className="w-6 h-6" />
  </div>
  <div>
    <p className="text-2xl font-bold tracking-tight">{value}</p>
    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">{label}</p>
    {trend && <span className={`text-xs ${trend > 0 ? 'text-emerald-600' : 'text-red-600'}`}>↑ {trend}%</span>}
  </div>
</div>
```

#### 6.3.2 Tabela z Sortowaniem (SortableHeader)

```tsx
// Reużywalny komponent nagłówka:
interface SortableHeaderProps {
  label: string;
  sortKey: string;
  currentSort: { by: string; dir: 'asc' | 'desc' };
  onSort: (key: string) => void;
}

export function SortableHeader({ label, sortKey, currentSort, onSort }: SortableHeaderProps) {
  const isActive = currentSort.by === sortKey;
  return (
    <TableHead>
      <button 
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors font-semibold"
      >
        {label}
        <ArrowUpDown className={`w-3 h-3 ${isActive ? 'text-[#00ADEF]' : 'text-muted-foreground/30'}`} />
        {isActive && <span className="text-[10px] text-[#00ADEF]">{currentSort.dir === 'asc' ? '▲' : '▼'}</span>}
      </button>
    </TableHead>
  );
}
```

#### 6.3.3 Filtry Chip-based (FilterChips)

```tsx
// Wizualizacja:
[Filter] [ILS] [IFG] [IFROM] [IJ] [Wyczyść]
        └─ toggle ─┘

// Implementacja:
<div className="flex flex-wrap gap-2 items-center">
  <Filter className="w-4 h-4 text-muted-foreground" />
  {units.map(unit => (
    <Button
      key={unit}
      variant={selected.includes(unit) ? 'default' : 'outline'}
      size="sm"
      onClick={() => toggleUnit(unit)}
      className={`rounded-sm text-xs font-bold px-3 py-1.5 h-auto ${
        selected.includes(unit) 
          ? 'bg-[#00ADEF] border-[#00ADEF] text-white' 
          : 'border-[#00ADEF]/20 text-[#00ADEF]'
      }`}
    >
      {unit}
    </Button>
  ))}
  {selected.length > 0 && (
    <Button variant="ghost" size="sm" onClick={clearAll}>Wyczyść</Button>
  )}
</div>
```

#### 6.3.4 Wskaźnik Obciążenia (WorkloadBar)

```tsx
// Wizualizacja:
// Pensum: 210h | Zrealizowano: 245h
// [████████████████████░░░░░] 116%
// Bilans: +35h (NADGODZINY)

<div className="space-y-1">
  <div className="w-full bg-muted rounded-full h-2.5 relative overflow-hidden border">
    <div 
      className={`absolute top-0 left-0 h-full transition-all duration-500 rounded-full ${
        percentage > 100 ? 'bg-red-500' : percentage === 100 ? 'bg-emerald-500' : 'bg-amber-400'
      }`}
      style={{ width: `${Math.min(percentage, 100)}%` }}
    />
  </div>
  <div className="flex justify-between text-[10px] text-muted-foreground">
    <span>0</span>
    {percentage > 100 && <span className="font-bold text-red-600">Nadgodziny (+{balance}h)</span>}
    <span>{pensumLimit}h limitu</span>
  </div>
</div>
```

---

## 7. Szczegółowa Specyfikacja Modułów

### 7.1 Moduł: Dashboard Główny (`DeanDashboard`)

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│  [HEADER: Panel Wydziałowy — Wydział Neofilologii]              │
├─────────────────────────────────────────────────────────────────┤
│  [KPI CARDS × 6]                                                │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │
│  │Jednostki│ │Prowadzący│ │Kierunki│ │Grupy  │ │Przydziały│     │
│  │   8    │ │   247   │ │   15   │ │  89   │ │   1,240  │     │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘        │
├─────────────────────────────────────────────────────────────────┤
│  [ALERTY I POWIADOMIENIA]                                       │
│  ⚠️ 23 prowadzących z nadgodzinami                              │
│  ⚠️ 5 kursów bez przypisanych grup                              │
│  ℹ️ Aktywny semestr: Zimowy 2025/2026                           │
├─────────────────────────────────────────────────────────────────┤
│  [TOP 10 — NAJBARDZIEJ PRZECIĄŻENI]                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ #  Prowadzący          Jednostka    Pensum  Godz. Bilans │   │
│  │ 1  dr hab. Kowalski    ILS         210     280   +70    │   │
│  │ 2  prof. Nowak         IFG         210     265   +55    │   │
│  │ ...                                                    │   │
│  └──────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  [SKRÓT DO JEDNOSTEK]                                           │
│  [Tabela 5 największych jednostek z licznikami]                 │
└─────────────────────────────────────────────────────────────────┘
```

**Funkcjonalności:**
- Automatyczne odświeżanie co 60 sekund (stale dane).
- Kliknięcie w KPI card przekierowuje do odpowiedniej zakładki.
- Alerty są kolorowane: czerwony (krytyczne), żółty (ostrzeżenia), niebieski (info).

---

### 7.2 Moduł: Jednostki Organizacyjne (`DeanInstitutesTable`)

**Kolumny tabeli (wszystkie sortowalne):**

| Kolumna | Sortowanie | Filtr |
|---------|:----------:|:-----:|
| Nazwa jednostki | A-Z / Z-A | Wyszukiwarka tekstowa |
| Kod skrócony | A-Z / Z-A | — |
| Kod USOS | A-Z / Z-A | — |
| Prowadzący | Liczbowe ↑↓ | — |
| Kierunki | Liczbowe ↑↓ | — |
| Przedmioty | Liczbowe ↑↓ | — |
| Grupy | Liczbowe ↑↓ | — |
| Użytkownicy | Liczbowe ↑↓ | — |
| Sale | Liczbowe ↑↓ | — |
| Akcje | — | — |

**Akcje w wierszu:**
- 👁️ **Symuluj** — przełącza `simulatedInstituteId` i przekierowuje na Home
- 📥 **Eksportuj JSON** — pobiera dane jednostki
- ✏️ **Edytuj** — modal z formularzem
- 🗑️ **Usuń** — z potwierdzeniem

**Funkcjonalności dodatkowe:**
- **Paginacja:** 10/25/50/100 wierszy na stronę.
- **Wyszukiwarka globalna:** filtruje po nazwie i kodzie.
- **Podsumowanie w tfoot:** sumy liczbowe na dole tabeli.

---

### 7.3 Moduł: Obciążenia Wydziałowe (`DeanWorkloadTable`)

**To jest najważniejszy moduł dla dziekana.**

**Kolumny tabeli:**

| Kolumna | Sortowanie | Opis |
|---------|:----------:|------|
| Prowadzący | A-Z / Z-A | Imię, nazwisko, tytuł |
| Jednostka | A-Z / Z-A | Nazwa instytutu + kod |
| Pensum | Liczbowe ↑↓ | Limit godzin |
| Godziny | Liczbowe ↑↓ | Zrealizowane godziny |
| Bilans | Liczbowe ↑↓ | Różnica (kolorowana) |
| Wykorzystanie | Liczbowe ↑↓ | Pasek postępu % |
| Przydziały | Liczbowe ↑↓ | Liczba przypisanych kursów |
| Akcje | — | Podgląd karty pensum |

**Filtry (chip-based + dropdown):**

```
┌─────────────────────────────────────────────────────────────────┐
│  [Filtry:]                                                      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐               │
│  │ ILS ✓   │ │ IFG     │ │ IFROM   │ │ IJ      │ ...          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘               │
│  [Wszyscy] [Nadgodziny] [Niedobór] [W normie]                  │
│                                          [🔍 Szukaj...    ]    │
└─────────────────────────────────────────────────────────────────┘
```

**Kolorowanie wierszy:**
- 🔴 `balance > 0` — `bg-red-500/5`, czerwony badge
- 🟡 `balance < 0` — `bg-amber-500/5`, żółty badge
- 🟢 `balance === 0` — `bg-emerald-500/5`, zielony badge

**Eksport:**
- Przycisk w prawym górnym rogu: **Eksportuj CSV** / **Eksportuj JSON**
- CSV zawiera wszystkie kolumny + dodatkowe (email, szczegóły przydziałów).

---

### 7.4 Moduł: Analiza Zasobów (`DeanResourcesPanel`)

**Zakładki (Tabs):**

#### Zakładka: Sale
```
┌─────────────────────────────────────────────────────────────────┐
│  Budynek  │ Sala   │ Typ        │ Pojemność │ Zajętość │ Status │
│  Collegium│ 101    │ Wykładowa  │ 120       │ 85%      │ 🟢     │
│  Collegium│ 205    │ Lab        │ 30        │ 92%      │ 🟡     │
│  ...                                                              │
└─────────────────────────────────────────────────────────────────┘
```
- **Zajętość:** obliczana na podstawie liczby wpisów w planie / dostępnych slotów.
- **Status:** 🟢 < 90%, 🟡 90-100%, 🔴 > 100% (kolizje).

#### Zakładka: Grupy
```
┌─────────────────────────────────────────────────────────────────┐
│  Nazwa    │ Kierunek   │ Stopień  │ Rok │ Liczebność │ Pokrycie │
│  LSN-1    │ Ling. stos.│ I stopnia│ 1   │ 25         │ 100%    │
│  ...                                                              │
└─────────────────────────────────────────────────────────────────┘
```
- **Pokrycie:** % przedmiotów przypisanych do grupy w aktywnym semestrze.

#### Zakładka: Kierunki
```
┌─────────────────────────────────────────────────────────────────┐
│  Kod      │ Nazwa              │ Stopień  │ Lata │ Grupy │ Kursy │
│  S1-LSN   │ Ling. stos. (niem.)│ I stopnia│ 3    │ 6     │ 45    │
│  ...                                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

### 7.5 Moduł: Użytkownicy Wydziału (`DeanUsersTable`)

**Kolumny:**

| Kolumna | Sortowanie | Filtr |
|---------|:----------:|:-----:|
| Użytkownik | A-Z / Z-A | Wyszukiwarka |
| Email | A-Z / Z-A | — |
| Rola | A-Z / Z-A | Dropdown |
| Jednostka | A-Z / Z-A | Chip-based |
| Ostatnie logowanie | Datowe ↑↓ | — |
| Aktywność | — | — |

**Funkcjonalności:**
- Szybkie filtrowanie po roli (ADMIN, PLANNER, VIEWER).
- Wskaźnik aktywności: 🟢 zalogowany w ciągu 7 dni, 🟡 7-30 dni, 🔴 > 30 dni.
- Przycisk **Zresetuj hasło** (z potwierdzeniem).

---

### 7.6 Moduł: Generator Raportów (`DeanReportGenerator`)

**Formularz:**
```
┌─────────────────────────────────────────────────────────────────┐
│  📊 GENERATOR RAPORTÓW                                          │
├─────────────────────────────────────────────────────────────────┤
│  Typ raportu:    [▼ Obciążenia wydziałowe]                     │
│  Semestr:        [▼ Zimowy 2025/2026]                          │
│  Zakres:         [▼ Cały wydział] [▼ Tylko ILS, IFG]          │
│  Format:         ○ CSV  ● JSON  ○ PDF (w przyszłości)         │
│                                                                 │
│  [✨ Generuj raport]                                           │
└─────────────────────────────────────────────────────────────────┘
```

**Typy raportów:**
1. **Obciążenia wydziałowe** — pełna lista prowadzących z godzinami.
2. **Podsumowanie jednostek** — liczniki per institute.
3. **Analiza zasobów** — sale, grupy, kierunki.
4. **Aktywność użytkowników** — logowania, ostatnia aktywność.

---

## 8. Sortowanie, Filtrowanie, Paginacja, Eksport

### 8.1 Specyfikacja Sortowania

| Pole | Typ | Domyślny kierunek |
|------|-----|:-----------------:|
| `name` (tekst) | `localeCompare('pl')` | asc |
| `institute` (tekst) | `localeCompare('pl')` | asc |
| `pensumLimit` (liczba) | `a - b` | desc |
| `totalHours` (liczba) | `a - b` | desc |
| `balance` (liczba) | `a - b` | desc |
| `createdAt` (data) | `Date.parse` | desc |
| `_count.*` (liczba) | `a - b` | desc |

**UX:**
- Pierwsze kliknięcie → sortowanie domyślne.
- Drugie kliknięcie → odwrotne.
- Trzecie kliknięcie → wyłączenie sortowania (domyślne).
- Aktywna kolumna: niebieska strzałka + podświetlenie.

### 8.2 Specyfikacja Filtrowania

| Filtr | Typ UI | Wartości |
|-------|--------|----------|
| Jednostka | Chip toggle | Wszystkie unikalne `institute.shortCode` |
| Status pensum | Chip toggle | `all`, `overloaded`, `underloaded`, `ok` |
| Rola użytkownika | Dropdown | `ADMIN`, `PLANNER`, `VIEWER` |
| Semestr | Dropdown | Wszystkie semestry z bazy |
| Wyszukiwarka | Input text | Debounce 300ms, case-insensitive |

**Logika filtrowania (AND):**
```
wynik = dane
  .filter(po jednostce)
  .filter(po statusie)
  .filter(po roli)
  .filter(po semestrze)
  .filter(po wyszukiwarce)
  .sort(po kolumnie)
```

### 8.3 Paginacja

```tsx
// Komponent paginacji (reużywalny)
interface PaginationProps {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

// UI:
[◀ Poprzednia]  Strona 3 z 12  [Następna ▶]
Pokaż: [▼ 10] [ 25 ] [ 50 ] [ 100 ] wierszy
```

**Logika:**
- Domyślnie: 25 wierszy.
- Maksymalnie: 100 wierszy (dla wydajności).
- Przy eksporcie: ignoruj paginację, eksportuj wszystko.

### 8.4 Eksport

| Format | Zawartość | Nagłówki HTTP |
|--------|-----------|---------------|
| **CSV** | Wszystkie przefiltrowane dane | `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment` |
| **JSON** | Wszystkie przefiltrowane dane | `Content-Type: application/json` |
| **PDF** | *(Future)* Wygenerowany raport | — |

**CSV — formatowanie:**
- Separator: średnik `;` (kompatybilność z polskim Excel).
- Kodowanie: UTF-8 z BOM (`\uFEFF`).
- Daty: `YYYY-MM-DD HH:mm`.
- Liczby: z kropką dziesiętną.

---

## 9. Bezpieczeństwo i Uprawnienia

### 9.1 Zasady

1. **DEAN nigdy nie widzi danych innych wydziałów.**
   - Wszystkie zapytania Prisma muszą zawierać `facultyId` w klauzuli `where`.
   - `extractFacultyScope()` jest obligatoryjne w każdym endpoincie DEAN.

2. **DEAN nie może usuwać jednostek z danymi.**
   - Przy DELETE sprawdź `_count` — jeśli > 0, zwróć błąd.

3. **DEAN nie może nadawać roli SUPER_ADMIN.**
   - Walidacja w `users.ts`: `if (payload.role === 'SUPER_ADMIN') return 403`.

4. **DEAN nie ma dostępu do backup/restore.**
   - Te endpointy pozostają tylko dla SUPER_ADMIN.

5. **Symulacja widoku (Eye)** jest bezpieczna.
   - Ustawia tylko `simulatedInstituteId` w localStorage — nie zmienia uprawnień.

### 9.2 Middleware

```typescript
// Dodatkowe sprawdzenie w endpointach DEAN
function requireDeanScope(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user as { role: string; facultyId?: string | null };
  if (user.role === 'SUPER_ADMIN') return; // Bypass
  if (user.role !== 'DEAN') {
    return reply.code(403).send({ error: 'Wymagana rola Dziekan.' });
  }
  if (!user.facultyId) {
    return reply.code(403).send({ error: 'Dziekan nie ma przypisanego wydziału.' });
  }
}
```

---

## 10. Roadmapa Implementacji

### Faza 1: Fundament (1-2 dni)
- [ ] Dodać rolę `DEAN` do enum `Role` w Prisma.
- [ ] Dodać pole `facultyId` do modeli `User` i `Institute`.
- [ ] Wygenerować migrację: `npx prisma migrate dev --name add_dean_role`.
- [ ] Zaktualizować `rbac.ts` — `requireRole` i nowa `extractFacultyScope`.
- [ ] Zaktualizować `auth.ts` (frontend store) — dodać `facultyId`.

### Faza 2: API Backend (2-3 dni)
- [ ] Utworzyć `apps/api/src/routes/dean.ts`.
- [ ] Zaimplementować endpointy:
  - `GET /api/v1/dean/dashboard`
  - `GET /api/v1/dean/institutes`
  - `GET /api/v1/dean/workload`
  - `GET /api/v1/dean/resources`
  - `GET /api/v1/dean/users`
  - `GET /api/v1/dean/reports/:type`
- [ ] Zarejestrować route w głównym serwerze Fastify.
- [ ] Przetestować endpointy (Postman / curl).

### Faza 3: Frontend — Struktura (1 dzień)
- [ ] Utworzyć katalog `apps/web/src/features/dean/`.
- [ ] Utworzyć typy: `apps/web/src/features/dean/types/dean.types.ts`.
- [ ] Utworzyć hooki React Query.
- [ ] Utworzyć komponenty bazowe: `SortableHeader`, `FilterChips`, `ExportButton`.

### Faza 4: Frontend — Strony (2-3 dni)
- [ ] Utworzyć `DeanDashboard.tsx` (główna strona).
- [ ] Zaimplementować `DeanStatsCards`.
- [ ] Zaimplementować `DeanInstitutesTable` z sortowaniem.
- [ ] Zaimplementować `DeanWorkloadTable` z filtrami.
- [ ] Zaimplementować `DeanResourcesPanel` (Tabs: Sale, Grupy, Kierunki).
- [ ] Zaimplementować `DeanUsersTable`.
- [ ] Zaimplementować `DeanReportGenerator`.

### Faza 5: Integracja (1 dzień)
- [ ] Dodać route `/dean/dashboard` w `router.tsx`.
- [ ] Dodać link w `DashboardLayout.tsx` (sekcja "Dziekan").
- [ ] Zaktualizować `Home.tsx` — kafelek "Panel Wydziałowy" dla DEAN.
- [ ] Przetestować pełny flow (logowanie → panel → filtry → eksport).

### Faza 6: Polishing (1 dzień)
- [ ] Dodać loading states (skeletons).
- [ ] Dodać empty states (brak danych).
- [ ] Dodać error handling (toast notifications).
- [ ] Przetestować responsywność (mobile / tablet).
- [ ] Przeprowadzić code review.

---

## 11. Przykładowe Zapytania Prisma (Gotowe do Użycia)

### 11.1 Liczba nieprzypisanych kursów (alert)

```typescript
const unassignedCourses = await prisma.course.findMany({
  where: {
    institute: instituteWhere,
    allocations: { none: {} }, // Brak jakichkolwiek allocations
  },
  select: { id: true, code: true, name: true, institute: { select: { name: true } } },
});
```

### 11.2 Kolizje sal (zajętość > 100%)

```typescript
const roomUtilization = await prisma.room.findMany({
  where: { institute: instituteWhere },
  include: {
    entries: {
      where: { semesterId: activeSemesterId },
      select: { dayOfWeek: true, startTime: true, endTime: true },
    },
  },
});

// Oblicz wykorzystanie w pamięci
const slotsPerWeek = 5 * 12; // 5 dni × 12 slotów (8:00-20:00 co godz.)
const utilization = roomUtilization.map(r => ({
  ...r,
  usedSlots: r.entries.length,
  utilizationPercent: Math.round((r.entries.length / slotsPerWeek) * 100),
}));
```

### 11.3 Trendy semestralne (porównanie z poprzednim semestrem)

```typescript
const currentSemester = await prisma.semester.findFirst({ orderBy: { dateStart: 'desc' } });
const previousSemester = await prisma.semester.findFirst({ 
  where: { dateStart: { lt: currentSemester.dateStart } },
  orderBy: { dateStart: 'desc' } 
});

const [currentAllocations, previousAllocations] = await Promise.all([
  prisma.courseAllocation.count({ where: { course: { semesterId: currentSemester.id } } }),
  prisma.courseAllocation.count({ where: { course: { semesterId: previousSemester.id } } }),
]);

const trend = previousAllocations > 0 
  ? Math.round(((currentAllocations - previousAllocations) / previousAllocations) * 100)
  : 0;
```

---

## 12. Załączniki

### 12.1 Mockup Struktury JSON (API Response)

```json
{
  "data": {
    "counts": {
      "institutesCount": 8,
      "teachersCount": 247,
      "coursesCount": 1560,
      "usersCount": 45,
      "allocationsCount": 3240,
      "majorsCount": 15,
      "groupsCount": 89,
      "roomsCount": 42
    },
    "activeSemesters": [
      { "id": "...", "name": "Zimowy 2025/2026", "year": 2025, "type": "zimowy" }
    ],
    "workloadSummary": [
      {
        "id": "uuid",
        "name": "dr hab. Jan Kowalski",
        "institute": "Instytut Lingwistyki Stosowanej",
        "pensumLimit": 210,
        "totalHours": 280,
        "balance": 70,
        "utilizationPercent": 133
      }
    ],
    "alerts": {
      "overloaded": 23,
      "underloaded": 41,
      "unassignedCourses": 5
    }
  }
}
```

### 12.2 Lista Ikonek (lucide-react)

| Moduł | Ikona |
|-------|-------|
| Dashboard | `LayoutDashboard` |
| Jednostki | `Building` |
| Obciążenia | `BarChart3` |
| Zasoby | `Box` |
| Użytkownicy | `Users` |
| Raporty | `FileText` |
| Eksport | `Download` |
| Sortowanie | `ArrowUpDown` |
| Filtr | `Filter` |
| Szukaj | `Search` |
| Alert | `AlertTriangle` |
| Trend w górę | `TrendingUp` |
| Trend w dół | `TrendingDown` |
| OK | `CheckCircle` |

---

## 13. Podsumowanie

Panel wydziałowy dla dziekana to **centralne narzędzie analityczne** umożliwiające:

1. ✅ **Sortowanie** wszystkich danych po dowolnej kolumnie (tekst, liczby, daty).
2. ✅ **Filtrowanie** wielowarstwowe (jednostki, statusy, role, semestry, wyszukiwarka).
3. ✅ **Analizę obciążeń** cross-institute z wizualizacją (paski, kolory, badge).
4. ✅ **Wyciąganie danych** przez eksport CSV/JSON i generowanie raportów.
5. ✅ **Monitoring zasobów** (sale, grupy, kierunki) z wskaźnikami wykorzystania.
6. ✅ **Zarządzanie perspektywą** — symulacja widoku konkretnej jednostki.

**Kluczowe decyzje architektoniczne:**
- Rola `DEAN` jako osobny poziom między `SUPER_ADMIN` a `ADMIN`.
- Pole `facultyId` jako prosty String (Opcja A) — migracja bezbolesna.
- Nowe endpointy `/api/v1/dean/*` — izolacja logiki dziekana.
- Reużywalne komponenty UI (`SortableHeader`, `FilterChips`, `ExportButton`).
- Pełna integracja z istniejącym design systemem (kolory `#003366`, `#00ADEF`).

---

*Dokument przygotowany do implementacji. Zalecana kolejność: Faza 1 → Faza 2 → Faza 3 → Faza 4 → Faza 5 → Faza 6.*
