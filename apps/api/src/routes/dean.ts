// @ts-nocheck
import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { requireRole, extractFacultyScope, extractFullScope } from '../lib/rbac';
import z from 'zod';
import bcrypt from 'bcrypt';
import { SALT_ROUNDS } from '../config/constants';

/**
 * Helper: builds the institute filter based on faculty scope.
 */
function buildInstituteWhere(scope: { facultyId: string | null; instituteIds: string[] | null }) {
    if (scope.facultyId) {
        return { facultyId: scope.facultyId };
    }
    if (scope.instituteIds && scope.instituteIds.length > 0) {
        return { id: { in: scope.instituteIds } };
    }
    return {};
}

/**
 * Guard: ensure DEAN user has a faculty assigned.
 * Returns true if access is allowed, otherwise sends 403 reply.
 */
function assertDeanFaculty(request: FastifyRequest, reply: FastifyReply, scope: { facultyId: string | null; instituteIds: string[] | null }): boolean {
    const userRole = (request.user as any)?.role;
    if (userRole === 'DEAN' && !scope.facultyId) {
        reply.code(403).send({ error: 'Dziekan nie ma przypisanego wydziału. Wyloguj się i zaloguj ponownie, aby odświeżyć sesję.' });
        return false;
    }
    return true;
}

/**
 * Helper: converts data array to CSV string with BOM for Excel.
 */
function toCSV(rows: Record<string, any>[], delimiter = ';'): string {
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const lines = [
        headers.join(delimiter),
        ...rows.map((row) =>
            headers
                .map((h) => {
                    const val = row[h];
                    if (val === null || val === undefined) return '';
                    const str = String(val).replace(/"/g, '""');
                    if (str.includes(delimiter) || str.includes('\n') || str.includes('"')) {
                        return `"${str}"`;
                    }
                    return str;
                })
                .join(delimiter)
        ),
    ];
    return lines.join('\r\n');
}

export default async function deanRoutes(server: FastifyInstance) {
    const preValidation = [server.authenticate, requireRole('DEAN', 'SUPER_ADMIN')];

    // ═══════════════════════════════════════════════════════════════════
    // DEAN DASHBOARD — Główne statystyki wydziałowe
    // ═══════════════════════════════════════════════════════════════════
    server.get('/api/v1/dean/dashboard', { preValidation }, async (request, reply) => {
        const scope = extractFacultyScope(request);
        if (!assertDeanFaculty(request, reply, scope)) return;
        const instituteWhere = buildInstituteWhere(scope);

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
                take: 3,
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

        const workloadSummary = teachers
            .map((t: any) => {
                const total = t.allocations.reduce((s: number, a: any) => s + a.assignedHours, 0);
                return {
                    id: t.id,
                    name: `${t.title} ${t.firstName} ${t.lastName}`,
                    institute: t.institute?.name || '—',
                    pensumLimit: t.pensumLimit,
                    totalHours: total,
                    balance: total - t.pensumLimit,
                    utilizationPercent: t.pensumLimit > 0 ? Math.round((total / t.pensumLimit) * 100) : 0,
                };
            })
            .sort((a, b) => b.balance - a.balance); // Najbardziej przeciążeni na górze

        // Nieprzypisane kursy (alert)
        const unassignedCourses = await prisma.course.findMany({
            where: {
                institute: instituteWhere,
                allocations: { none: {} },
            },
            select: { id: true, code: true, name: true, institute: { select: { name: true } } },
        });

        return {
            data: {
                counts: {
                    institutesCount,
                    teachersCount,
                    coursesCount,
                    usersCount,
                    allocationsCount,
                    majorsCount,
                    groupsCount,
                    roomsCount,
                },
                activeSemesters,
                workloadSummary: workloadSummary.slice(0, 10),
                alerts: {
                    overloaded: workloadSummary.filter((w) => w.balance > 0).length,
                    underloaded: workloadSummary.filter((w) => w.balance < 0).length,
                    unassignedCourses: unassignedCourses.length,
                },
            },
        };
    });

    // ═══════════════════════════════════════════════════════════════════
    // DEAN ANALYTICS — Rozbudowane dane analityczne dla dashboardu
    // ═══════════════════════════════════════════════════════════════════
    server.get('/api/v1/dean/analytics', { preValidation }, async (request, reply) => {
        const scope = extractFacultyScope(request);
        if (!assertDeanFaculty(request, reply, scope)) return;
        const instituteWhere = buildInstituteWhere(scope);

        // 1. Pobierz wszystkie instytuty z prowadzącymi i ich alokacjami
        const institutes = await prisma.institute.findMany({
            where: instituteWhere,
            include: {
                _count: { select: { teachers: true, courses: true, users: true, majors: true, groups: true, rooms: true, allocations: true } },
                teachers: {
                    include: {
                        allocations: { select: { assignedHours: true } },
                    },
                },
                courses: {
                    select: { id: true, allocations: { select: { id: true } } },
                },
            },
            orderBy: { name: 'asc' },
        });

        // 2. Buduj porównanie jednostek
        let totalTeachers = 0;
        let totalOverloaded = 0;
        let totalUnderloaded = 0;
        let totalOk = 0;
        let totalUnassigned = 0;
        let allUtilizations: number[] = [];

        const institutesComparison = institutes.map((inst) => {
            let overloadedCount = 0;
            let underloadedCount = 0;
            let okCount = 0;
            const utilizations: number[] = [];

            // Prowadzący z nadgodzinami / niedoborem + lista
            const overloadedTeachers: { id: string; name: string; balance: number; pensumLimit: number; totalHours: number }[] = [];
            const underloadedTeachers: { id: string; name: string; balance: number; pensumLimit: number; totalHours: number }[] = [];

            for (const t of inst.teachers) {
                const total = t.allocations.reduce((s: number, a: any) => s + a.assignedHours, 0);
                const balance = total - t.pensumLimit;
                const utilPct = t.pensumLimit > 0 ? Math.round((total / t.pensumLimit) * 100) : 0;
                utilizations.push(utilPct);

                const teacherInfo = {
                    id: t.id,
                    name: `${t.title || ''} ${t.firstName} ${t.lastName}`.trim(),
                    balance,
                    pensumLimit: t.pensumLimit,
                    totalHours: total,
                };

                if (balance > 0) {
                    overloadedCount++;
                    overloadedTeachers.push(teacherInfo);
                } else if (balance < 0) {
                    underloadedCount++;
                    underloadedTeachers.push(teacherInfo);
                } else {
                    okCount++;
                }
            }

            // Sortuj: nadgodziny malejąco, niedobory rosnąco
            overloadedTeachers.sort((a, b) => b.balance - a.balance);
            underloadedTeachers.sort((a, b) => a.balance - b.balance);

            const avgUtil = utilizations.length > 0
                ? Math.round(utilizations.reduce((a, b) => a + b, 0) / utilizations.length)
                : 0;

            // Nieprzypisane kursy
            const unassignedCoursesCount = inst.courses.filter((c: any) => c.allocations.length === 0).length;

            // Flagi alertów
            const hasOverloaded = overloadedCount > 0;
            const hasUnderloaded = underloadedCount > 0;
            const hasUnassigned = unassignedCoursesCount > 0;
            let alertLevel: 'ok' | 'warning' | 'critical' = 'ok';
            if (overloadedCount >= 3 || unassignedCoursesCount >= 5) alertLevel = 'critical';
            else if (hasOverloaded || hasUnassigned) alertLevel = 'warning';

            totalTeachers += inst.teachers.length;
            totalOverloaded += overloadedCount;
            totalUnderloaded += underloadedCount;
            totalOk += okCount;
            totalUnassigned += unassignedCoursesCount;
            allUtilizations = allUtilizations.concat(utilizations);

            return {
                id: inst.id,
                name: inst.name,
                shortCode: inst.shortCode || inst.name.substring(0, 4).toUpperCase(),
                teachersCount: inst.teachers.length,
                overloadedCount,
                underloadedCount,
                okCount,
                avgPensumUtilization: avgUtil,
                unassignedCoursesCount,
                coursesCount: inst._count.courses,
                alertLevel,
                overloadedTeachers: overloadedTeachers.slice(0, 10),
                underloadedTeachers: underloadedTeachers.slice(0, 10),
            };
        });

        // 3. KPI globalne
        const avgPensumUtilization = allUtilizations.length > 0
            ? Math.round(allUtilizations.reduce((a, b) => a + b, 0) / allUtilizations.length)
            : 0;

        const problemInstituteCount = institutesComparison.filter((i) => i.alertLevel !== 'ok').length;

        const summaryKPIs = {
            avgPensumUtilization,
            instituteCount: institutes.length,
            problemInstituteCount,
            totalTeachers,
            overloadedTeachers: totalOverloaded,
            underloadedTeachers: totalUnderloaded,
            okTeachers: totalOk,
            unassignedCourses: totalUnassigned,
        };

        // 4. Rozkład statusów prowadzących (do wykresu kołowego)
        const teachersDistribution = {
            ok: totalOk,
            overloaded: totalOverloaded,
            underloaded: totalUnderloaded,
        };

        // 5. Histogram obciążeń
        const histogramBuckets = [
            { range: '0%', min: 0, max: 0 },
            { range: '1-50%', min: 1, max: 50 },
            { range: '51-80%', min: 51, max: 80 },
            { range: '81-99%', min: 81, max: 99 },
            { range: '100%', min: 100, max: 100 },
            { range: '101-120%', min: 101, max: 120 },
            { range: '>120%', min: 121, max: Infinity },
        ];
        const workloadHistogram = histogramBuckets.map((b) => ({
            range: b.range,
            count: allUtilizations.filter((v) => v >= b.min && v <= b.max).length,
        }));

        // 6. Aktywne semestry
        const activeSemesters = await prisma.semester.findMany({
            where: { isLocked: false },
            orderBy: { dateStart: 'desc' },
            take: 3,
        });

        return {
            data: {
                institutesComparison,
                summaryKPIs,
                teachersDistribution,
                workloadHistogram,
                activeSemesters,
            },
        };
    });

    // ═══════════════════════════════════════════════════════════════════
    // DEAN INSTITUTES — Lista jednostek z filtrami i sortowaniem
    // ═══════════════════════════════════════════════════════════════════
    server.get('/api/v1/dean/institutes', { preValidation }, async (request, reply) => {
        const scope = extractFacultyScope(request);
        if (!assertDeanFaculty(request, reply, scope)) return;
        const instituteWhere = buildInstituteWhere(scope);

        const { search, sortBy = 'name', sortDir = 'asc' } = request.query as {
            search?: string;
            sortBy?: string;
            sortDir?: 'asc' | 'desc';
        };

        const orderBy: any = {};
        if (sortBy === 'name') orderBy.name = sortDir;
        else if (sortBy === 'createdAt') orderBy.createdAt = sortDir;

        const institutes = await prisma.institute.findMany({
            where: {
                ...instituteWhere,
                ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
            },
            include: {
                _count: {
                    select: {
                        users: true,
                        courses: true,
                        teachers: true,
                        rooms: true,
                        groups: true,
                        majors: true,
                        allocations: true,
                    },
                },
                users: { select: { id: true, name: true, role: true, lastLoginAt: true }, take: 5 },
            },
            orderBy,
        });

        // Pobierz liczbę administratorów (role=ADMIN) per instytut
        const instituteIds = institutes.map((i) => i.id);
        const adminUsers = await prisma.user.findMany({
            where: {
                role: 'ADMIN',
                instituteId: { in: instituteIds },
            },
            select: { instituteId: true },
        });
        const adminCountMap = new Map<string, number>();
        for (const u of adminUsers) {
            if (u.instituteId) {
                adminCountMap.set(u.instituteId, (adminCountMap.get(u.instituteId) || 0) + 1);
            }
        }

        // Sortowanie po liczbach w pamięci
        if (['teachers', 'courses', 'users', 'groups', 'majors', 'rooms', 'allocations'].includes(sortBy)) {
            institutes.sort((a, b) => {
                const aVal = (a._count as any)[sortBy] || 0;
                const bVal = (b._count as any)[sortBy] || 0;
                return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
            });
        }

        const data = institutes.map((inst) => ({
            ...inst,
            adminCount: adminCountMap.get(inst.id) || 0,
        }));

        return { data };
    });

    // ═══════════════════════════════════════════════════════════════════
    // DEAN WORKLOAD — Cross-institute obciążenia z zaawansowanymi filtrami
    // ═══════════════════════════════════════════════════════════════════
    server.get('/api/v1/dean/workload', { preValidation }, async (request, reply) => {
        const scope = extractFacultyScope(request);
        if (!assertDeanFaculty(request, reply, scope)) return;
        const instituteWhere = buildInstituteWhere(scope);

        const {
            semesterId,
            sortBy = 'balance',
            sortDir = 'desc',
            status,
            unit,
            units,
            search,
        } = request.query as {
            semesterId?: string;
            sortBy?: string;
            sortDir?: 'asc' | 'desc';
            status?: string;
            unit?: string;
            units?: string;
            search?: string;
        };

        // Budujemy filtr jednostek z scaleniem scope + unit/units
        const instituteFilter: any = { ...instituteWhere };
        if (unit) {
            instituteFilter.name = { equals: unit, mode: 'insensitive' };
        }
        if (units) {
            const unitList = units.split(',').map((s) => s.trim()).filter(Boolean);
            if (unitList.length > 0) {
                instituteFilter.name = { in: unitList, mode: 'insensitive' };
            }
        }

        const teachers = await prisma.teacher.findMany({
            where: {
                institute: instituteFilter,
                ...(search
                    ? {
                        OR: [
                            { firstName: { contains: search, mode: 'insensitive' } },
                            { lastName: { contains: search, mode: 'insensitive' } },
                        ],
                    }
                    : {}),
            },
            include: {
                institute: { select: { name: true, shortCode: true } },
                allocations: {
                    select: { assignedHours: true, course: { select: { name: true, type: true, semesterId: true } } },
                    ...(semesterId
                        ? {
                            where: {
                                course: { semesterId },
                            },
                        }
                        : {}),
                },
            },
        });

        let workloads = teachers.map((t) => {
            const total = t.allocations.reduce((s, a) => s + a.assignedHours, 0);
            return {
                id: t.id,
                name: `${t.title} ${t.firstName} ${t.lastName}`,
                institute: t.institute?.name || '—',
                shortCode: t.institute?.shortCode || '—',
                pensumLimit: t.pensumLimit,
                totalHours: total,
                balance: total - t.pensumLimit,
                utilizationPercent: t.pensumLimit > 0 ? Math.round((total / t.pensumLimit) * 100) : 0,
                isOverloaded: total > t.pensumLimit,
                isUnderloaded: total < t.pensumLimit,
                isOk: total === t.pensumLimit,
                allocationCount: t.allocations.length,
            };
        });

        // Filtrowanie po statusie
        if (status === 'overloaded') workloads = workloads.filter((w) => w.isOverloaded);
        if (status === 'underloaded') workloads = workloads.filter((w) => w.isUnderloaded);
        if (status === 'ok') workloads = workloads.filter((w) => w.isOk);

        // Sortowanie
        workloads.sort((a, b) => {
            let cmp = 0;
            if (sortBy === 'name') cmp = a.name.localeCompare(b.name, 'pl');
            else if (sortBy === 'institute') cmp = a.institute.localeCompare(b.institute, 'pl');
            else if (sortBy === 'totalHours') cmp = a.totalHours - b.totalHours;
            else if (sortBy === 'balance') cmp = a.balance - b.balance;
            else if (sortBy === 'pensumLimit') cmp = a.pensumLimit - b.pensumLimit;
            else if (sortBy === 'allocationCount') cmp = a.allocationCount - b.allocationCount;
            return sortDir === 'asc' ? cmp : -cmp;
        });

        return { data: workloads };
    });

    // ═══════════════════════════════════════════════════════════════════
    // DEAN RESOURCES — Analiza zasobów (sale, grupy, kierunki)
    // ═══════════════════════════════════════════════════════════════════
    server.get('/api/v1/dean/resources', { preValidation }, async (request, reply) => {
        const scope = extractFacultyScope(request);
        if (!assertDeanFaculty(request, reply, scope)) return;
        const instituteWhere = buildInstituteWhere(scope);

        const { type = 'rooms', semesterId } = request.query as { type?: string; semesterId?: string };

        if (type === 'rooms') {
            const rooms = await prisma.room.findMany({
                where: { institute: instituteWhere },
                include: {
                    institute: { select: { name: true, shortCode: true } },
                    entries: semesterId
                        ? { where: { semesterId }, select: { dayOfWeek: true, startTime: true, endTime: true } }
                        : { select: { dayOfWeek: true, startTime: true, endTime: true } },
                },
            });

            const slotsPerWeek = 5 * 12; // 5 dni × 12 slotów (8:00-20:00 co godz.)
            const data = rooms.map((r) => {
                const usedSlots = r.entries.length;
                const utilizationPercent = Math.round((usedSlots / slotsPerWeek) * 100);
                return {
                    id: r.id,
                    building: r.building,
                    number: r.number,
                    type: r.type,
                    capacity: r.capacity,
                    usedSlots,
                    utilizationPercent,
                    status: utilizationPercent > 100 ? 'collision' : utilizationPercent >= 90 ? 'warning' : 'ok',
                    institute: r.institute?.name || '—',
                };
            });
            return { data };
        }

        if (type === 'groups') {
            const groups = await prisma.group.findMany({
                where: { institute: instituteWhere },
                include: {
                    institute: { select: { name: true, shortCode: true } },
                    major: { select: { name: true, code: true } },
                    semester: { select: { name: true } },
                    allocations: { select: { id: true } },
                },
            });

            const data = groups.map((g) => ({
                id: g.id,
                name: g.name,
                major: g.major?.name || g.majorName || '—',
                degree: g.degree,
                year: g.year,
                size: g.size,
                semester: g.semester?.name || '—',
                allocationCount: g.allocations.length,
                institute: g.institute?.name || '—',
            }));
            return { data };
        }

        if (type === 'majors') {
            const majors = await prisma.major.findMany({
                where: { institute: instituteWhere },
                include: {
                    institute: { select: { name: true, shortCode: true } },
                    _count: { select: { groups: true, courses: true } },
                },
            });

            const data = majors.map((m) => ({
                id: m.id,
                code: m.code,
                name: m.name,
                degree: m.degree,
                years: m.years,
                groupsCount: m._count.groups,
                coursesCount: m._count.courses,
                institute: m.institute?.name || '—',
            }));
            return { data };
        }

        return reply.code(400).send({ error: 'Nieprawidłowy typ zasobu. Użyj: rooms, groups, majors' });
    });

    // ═══════════════════════════════════════════════════════════════════
    // DEAN USERS — Użytkownicy we wszystkich jednostkach wydziału
    // ═══════════════════════════════════════════════════════════════════
    server.get('/api/v1/dean/users', { preValidation }, async (request, reply) => {
        const scope = extractFacultyScope(request);
        if (!assertDeanFaculty(request, reply, scope)) return;
        const instituteWhere = buildInstituteWhere(scope);

        const { search, sortBy = 'name', sortDir = 'asc', role: roleFilter, instituteId } = request.query as {
            search?: string;
            sortBy?: string;
            sortDir?: 'asc' | 'desc';
            role?: string;
            instituteId?: string;
        };

        const orderBy: any = {};
        if (sortBy === 'name') orderBy.name = sortDir;
        else if (sortBy === 'email') orderBy.email = sortDir;
        else if (sortBy === 'role') orderBy.role = sortDir;
        else if (sortBy === 'createdAt') orderBy.createdAt = sortDir;
        else if (sortBy === 'lastLoginAt') orderBy.lastLoginAt = sortDir;

        const users = await prisma.user.findMany({
            where: {
                institute: instituteWhere,
                ...(search
                    ? {
                        OR: [
                            { name: { contains: search, mode: 'insensitive' } },
                            { email: { contains: search, mode: 'insensitive' } },
                        ],
                    }
                    : {}),
                ...(roleFilter ? { role: roleFilter as any } : {}),
                ...(instituteId ? { instituteId } : {}),
            },
            include: {
                institute: { select: { name: true, shortCode: true } },
            },
            orderBy,
        });

        const now = Date.now();
        const data = users.map((u) => {
            const lastLogin = u.lastLoginAt ? new Date(u.lastLoginAt).getTime() : 0;
            const daysSinceLogin = lastLogin ? Math.floor((now - lastLogin) / (1000 * 60 * 60 * 24)) : Infinity;
            let activityStatus: 'active' | 'recent' | 'inactive' = 'inactive';
            if (daysSinceLogin <= 7) activityStatus = 'active';
            else if (daysSinceLogin <= 30) activityStatus = 'recent';

            return {
                id: u.id,
                name: u.name,
                email: u.email,
                role: u.role,
                institute: u.institute?.name || '—',
                shortCode: u.institute?.shortCode || '—',
                lastLoginAt: u.lastLoginAt,
                createdAt: u.createdAt,
                activityStatus,
                facultyId: u.facultyId,
            };
        });

        return { data };
    });

    // ═══════════════════════════════════════════════════════════════════
    // FACULTIES — lista wydziałów (dla przypisania Dziekana)
    // ═══════════════════════════════════════════════════════════════════
    server.get('/api/v1/faculties', { preValidation }, async () => {
        let faculties = await prisma.faculty.findMany({
            select: { id: true, name: true, shortCode: true },
            orderBy: { name: 'asc' },
        });

        // Audyt #12: Automatycznie utwórz domyślny wydział jeśli tabela jest pusta.
        // System jest dedykowany dla jednego wydziału Neofilologii.
        if (faculties.length === 0) {
            const defaultFaculty = await prisma.faculty.create({
                data: {
                    name: 'Wydział Neofilologii',
                    shortCode: 'WN',
                },
                select: { id: true, name: true, shortCode: true },
            });
            faculties = [defaultFaculty];
        }

        return { data: faculties };
    });

    // ═══════════════════════════════════════════════════════════════════
    // DEAN REPORTS — Generowanie raportów
    // ═══════════════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════════════
    // DEAN USER MANAGEMENT — Create / Edit / Delete users in faculty institutes
    // ═══════════════════════════════════════════════════════════════════

    const deanCreateUserSchema = z.object({
        email: z.string().email(),
        password: z.string().min(6),
        name: z.string().min(1),
        role: z.enum(['ADMIN', 'PLANNER', 'VIEWER', 'DEAN']).default('VIEWER'),
        instituteId: z.string().uuid().optional(),
        facultyId: z.string().uuid().optional(),
    }).refine((data) => {
        if (data.role === 'DEAN' && !data.facultyId) return false;
        return true;
    }, { message: 'Dla roli Dziekan wymagane jest przypisanie wydziału (facultyId).', path: ['facultyId'] });

    const deanUpdateUserSchema = z.object({
        name: z.string().min(1).optional(),
        email: z.string().email().optional(),
        role: z.enum(['ADMIN', 'PLANNER', 'VIEWER', 'DEAN']).optional(),
        newPassword: z.string().min(6).optional(),
        instituteId: z.string().uuid().optional(),
        facultyId: z.string().uuid().optional(),
    }).refine((data) => {
        if (data.role === 'DEAN' && !data.facultyId) return false;
        return true;
    }, { message: 'Dla roli Dziekan wymagane jest przypisanie wydziału (facultyId).', path: ['facultyId'] });

    /**
     * Verify that the given instituteId belongs to the DEAN's faculty.
     */
    async function verifyInstituteInFaculty(instituteId: string, facultyId: string | null, reply: FastifyReply): Promise<boolean> {
        if (!facultyId) {
            await reply.code(403).send({ error: 'Dziekan nie ma przypisanego wydziału.' });
            return false;
        }
        const institute = await prisma.institute.findFirst({
            where: { id: instituteId, facultyId },
            select: { id: true },
        });
        if (!institute) {
            await reply.code(403).send({ error: 'Jednostka nie należy do Twojego wydziału.' });
            return false;
        }
        return true;
    }

    const writePreValidation = [server.authenticate, requireRole('SUPER_ADMIN')];

    server.post('/api/v1/dean/users', { preValidation: writePreValidation }, async (request, reply) => {
        try {
            const payload = deanCreateUserSchema.parse(request.body);
            const scope = extractFacultyScope(request);
            const userRole = (request.user as any)?.role;
            const isSuperAdmin = userRole === 'SUPER_ADMIN';

            if (!isSuperAdmin && !scope.facultyId) {
                return reply.code(403).send({ error: 'Dziekan nie ma przypisanego wydziału.' });
            }

            if (!isSuperAdmin) {
                const ok = await verifyInstituteInFaculty(payload.instituteId, scope.facultyId, reply);
                if (!ok) return;
            }

            const passwordHash = await bcrypt.hash(payload.password, SALT_ROUNDS);
            const user = await prisma.user.create({
                data: {
                    email: payload.email,
                    name: payload.name,
                    role: payload.role,
                    passwordHash,
                    instituteId: payload.instituteId,
                    facultyId: payload.facultyId,
                },
                select: { id: true, email: true, name: true, role: true, instituteId: true, createdAt: true },
            });
            return reply.code(201).send({ data: user });
        } catch (err) {
            if (err instanceof z.ZodError) {
                return reply.code(400).send({ error: 'Błąd walidacji', details: err.errors });
            }
            if (err instanceof Object && 'code' in err && err.code === 'P2002') {
                return reply.code(400).send({ error: 'Użytkownik z takim adresem e-mail już istnieje.' });
            }
            return reply.code(400).send({ error: 'Nie udało się utworzyć użytkownika.' });
        }
    });

    server.put('/api/v1/dean/users/:id', { preValidation: writePreValidation }, async (request, reply) => {
        const { id } = request.params as { id: string };
        try {
            const payload = deanUpdateUserSchema.parse(request.body);
            const scope = extractFacultyScope(request);
            const userRole = (request.user as any)?.role;
            const isSuperAdmin = userRole === 'SUPER_ADMIN';

            if (!isSuperAdmin && !scope.facultyId) {
                return reply.code(403).send({ error: 'Dziekan nie ma przypisanego wydziału.' });
            }

            // Verify target user belongs to dean's faculty (skip for SA)
            let targetUser: any = null;
            if (!isSuperAdmin) {
                targetUser = await prisma.user.findFirst({
                    where: { id },
                    include: { institute: { select: { facultyId: true } } },
                });
                if (!targetUser || targetUser.institute?.facultyId !== scope.facultyId) {
                    return reply.code(404).send({ error: 'Nie znaleziono użytkownika w Twoim wydziale.' });
                }

                // DEAN cannot modify SUPER_ADMIN
                if (targetUser.role === 'SUPER_ADMIN') {
                    return reply.code(403).send({ error: 'Nie możesz modyfikować administratora globalnego.' });
                }
            }

            // If changing institute, verify new one is in faculty
            if (!isSuperAdmin && payload.instituteId) {
                const ok = await verifyInstituteInFaculty(payload.instituteId, scope.facultyId, reply);
                if (!ok) return;
            }

            const updateData: any = {};
            if (payload.name) updateData.name = payload.name;
            if (payload.email) updateData.email = payload.email;
            if (payload.role) updateData.role = payload.role;
            if (payload.instituteId) updateData.instituteId = payload.instituteId;
            if (payload.facultyId) updateData.facultyId = payload.facultyId;
            if (payload.newPassword) updateData.passwordHash = await bcrypt.hash(payload.newPassword, SALT_ROUNDS);

            const user = await prisma.user.update({
                where: { id },
                data: updateData,
                select: { id: true, email: true, name: true, role: true, instituteId: true },
            });
            return reply.send({ data: user });
        } catch (err) {
            if (err instanceof z.ZodError) {
                return reply.code(400).send({ error: 'Błąd walidacji', details: err.errors });
            }
            if (err instanceof Object && 'code' in err && err.code === 'P2002') {
                return reply.code(400).send({ error: 'Ten adres e-mail jest już zajęty.' });
            }
            return reply.code(400).send({ error: 'Nie udało się zaktualizować użytkownika.' });
        }
    });

    server.delete('/api/v1/dean/users/:id', { preValidation: writePreValidation }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const currentUser = request.user as { id: string };
        if (currentUser.id === id) {
            return reply.code(400).send({ error: 'Nie możesz usunąć samego siebie!' });
        }

        const scope = extractFacultyScope(request);
        const userRole = (request.user as any)?.role;
        const isSuperAdmin = userRole === 'SUPER_ADMIN';

        if (!isSuperAdmin && !scope.facultyId) {
            return reply.code(403).send({ error: 'Dziekan nie ma przypisanego wydziału.' });
        }

        if (!isSuperAdmin) {
            const targetUser = await prisma.user.findFirst({
                where: { id },
                include: { institute: { select: { facultyId: true } } },
            });
            if (!targetUser || targetUser.institute?.facultyId !== scope.facultyId) {
                return reply.code(404).send({ error: 'Nie znaleziono użytkownika w Twoim wydziale.' });
            }

            // DEAN cannot delete SUPER_ADMIN
            if (targetUser.role === 'SUPER_ADMIN') {
                return reply.code(403).send({ error: 'Nie możesz usunąć administratora globalnego.' });
            }
        }

        await prisma.user.delete({ where: { id } });
        return reply.send({ success: true });
    });

    // ═══════════════════════════════════════════════════════════════════
    // DEAN PASSWORD RESET — Reset hasła użytkownika wydziału
    // ═══════════════════════════════════════════════════════════════════
    const resetPasswordSchema = z.object({
        newPassword: z.string().min(6, 'Hasło musi mieć min. 6 znaków'),
    });

    server.post('/api/v1/dean/users/:id/reset-password', { preValidation: writePreValidation }, async (request, reply) => {
        const { id } = request.params as { id: string };
        try {
            const payload = resetPasswordSchema.parse(request.body);
            const scope = extractFacultyScope(request);
            const userRole = (request.user as any)?.role;
            const isSuperAdmin = userRole === 'SUPER_ADMIN';

            if (!isSuperAdmin && !scope.facultyId) {
                return reply.code(403).send({ error: 'Dziekan nie ma przypisanego wydziału.' });
            }

            if (!isSuperAdmin) {
                const targetUser = await prisma.user.findFirst({
                    where: { id },
                    include: { institute: { select: { facultyId: true } } },
                });
                if (!targetUser || targetUser.institute?.facultyId !== scope.facultyId) {
                    return reply.code(404).send({ error: 'Nie znaleziono użytkownika w Twoim wydziale.' });
                }

                if (targetUser.role === 'SUPER_ADMIN') {
                    return reply.code(403).send({ error: 'Nie możesz resetować hasła administratora globalnego.' });
                }
            }

            const passwordHash = await bcrypt.hash(payload.newPassword, SALT_ROUNDS);
            await prisma.user.update({
                where: { id },
                data: { passwordHash },
            });

            return reply.send({ success: true, message: 'Hasło zostało zresetowane.' });
        } catch (err) {
            if (err instanceof z.ZodError) {
                return reply.code(400).send({ error: 'Błąd walidacji', details: err.errors });
            }
            return reply.code(400).send({ error: 'Nie udało się zresetować hasła.' });
        }
    });

    // ═══════════════════════════════════════════════════════════════════
    // DEAN REPORTS — Generowanie raportów
    // ═══════════════════════════════════════════════════════════════════
    server.get('/api/v1/dean/reports/:type', { preValidation }, async (request, reply) => {
        const scope = extractFacultyScope(request);
        if (!assertDeanFaculty(request, reply, scope)) return;
        const instituteWhere = buildInstituteWhere(scope);

        const { type } = request.params as { type: string };
        const { semesterId, format = 'json' } = request.query as { semesterId?: string; format?: string };

        if (!['workload', 'resources', 'summary'].includes(type)) {
            return reply.code(400).send({ error: 'Nieprawidłowy typ raportu. Użyj: workload, resources, summary' });
        }

        let data: any[] = [];

        if (type === 'workload') {
            const teachers = await prisma.teacher.findMany({
                where: { institute: instituteWhere },
                include: {
                    institute: { select: { name: true, shortCode: true } },
                    allocations: {
                        select: {
                            assignedHours: true,
                            course: { select: { name: true, type: true, semesterId: true } },
                        },
                        ...(semesterId ? { where: { course: { semesterId } } } : {}),
                    },
                },
            });

            data = teachers.map((t) => {
                const total = t.allocations.reduce((s, a) => s + a.assignedHours, 0);
                return {
                    id: t.id,
                    name: `${t.title} ${t.firstName} ${t.lastName}`,
                    email: t.email,
                    institute: t.institute?.name || '—',
                    shortCode: t.institute?.shortCode || '—',
                    pensumLimit: t.pensumLimit,
                    totalHours: total,
                    balance: total - t.pensumLimit,
                    utilizationPercent: t.pensumLimit > 0 ? Math.round((total / t.pensumLimit) * 100) : 0,
                    allocationCount: t.allocations.length,
                };
            });
        }

        if (type === 'summary') {
            const institutes = await prisma.institute.findMany({
                where: instituteWhere,
                include: {
                    _count: {
                        select: { users: true, courses: true, teachers: true, rooms: true, groups: true, majors: true, allocations: true },
                    },
                },
            });

            data = institutes.map((i) => ({
                id: i.id,
                name: i.name,
                shortCode: i.shortCode,
                usosCode: i.usosCode,
                users: i._count.users,
                courses: i._count.courses,
                teachers: i._count.teachers,
                rooms: i._count.rooms,
                groups: i._count.groups,
                majors: i._count.majors,
                allocations: i._count.allocations,
            }));
        }

        if (type === 'resources') {
            const [rooms, groups, majors] = await Promise.all([
                prisma.room.count({ where: { institute: instituteWhere } }),
                prisma.group.count({ where: { institute: instituteWhere } }),
                prisma.major.count({ where: { institute: instituteWhere } }),
            ]);
            data = [{ rooms, groups, majors }];
        }

        if (format === 'csv') {
            const csv = toCSV(data);
            reply.header('Content-Type', 'text/csv; charset=utf-8');
            reply.header(
                'Content-Disposition',
                `attachment; filename="report_${type}_${new Date().toISOString().slice(0, 10)}.csv"`
            );
            // Dodaj BOM dla Excela
            reply.send('\uFEFF' + csv);
            return;
        }

        reply.send({ data });
    });
}
