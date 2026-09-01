import { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Middleware RBAC — sprawdza, czy zalogowany użytkownik posiada jedną z wymaganych ról.
 * SUPER_ADMIN automatycznie przechodzi każdy check.
 * Użycie: preValidation: [server.authenticate, requireRole('ADMIN', 'PLANNER')]
 */
export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as { id: string; role: string; email: string; facultyId?: string | null };
    if (!user) {
      return reply.code(403).send({ error: 'Brak uprawnień do wykonania tej operacji.' });
    }
    // SUPER_ADMIN bypassuje checki ról. DEAN musi być dopuszczony jawnie.
    if (user.role === 'SUPER_ADMIN') return;
    if (!roles.includes(user.role)) {
      return reply.code(403).send({ error: 'Brak uprawnień do wykonania tej operacji.' });
    }
  };
}

/**
 * Strict RBAC — TYLKO wymienione role przechodzą. Brak bypass dla DEAN.
 * Użycie: requireStrictRole('SUPER_ADMIN') — tylko superadmin.
 */
export function requireStrictRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as { id: string; role: string; email: string };
    if (!user || !roles.includes(user.role)) {
      return reply.code(403).send({ error: 'Brak uprawnień do wykonania tej operacji.' });
    }
  };
}

/**
 * Extracts faculty scope for DEAN role or institute scope for others.
 * Returns { facultyId, instituteIds } for tenancy-scoped queries.
 * SUPER_ADMIN: no filter (facultyId: null, instituteIds: null).
 * DEAN: filter by facultyId (all institutes in that faculty).
 * ADMIN/PLANNER/VIEWER: filter by instituteId.
 */
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

export interface ScopeFilter {
  facultyId: string | null;
  instituteId: string | null;
  isSuperAdmin: boolean;
  simulatedInstituteId: string | null;
}

/**
 * Extracts full scoped filter context for tenancy queries.
 * This is the ONE function every route should call for data scoping.
 */
export function extractFullScope(request: FastifyRequest): ScopeFilter {
  const user = request.user as { id: string; role: string; instituteId?: string | null; facultyId?: string | null };

  // SUPER_ADMIN
  if (user.role === 'SUPER_ADMIN') {
    const simulatedId = request.headers['x-simulate-institute'] as string;
    if (simulatedId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(simulatedId)) {
        return { isSuperAdmin: true, facultyId: null, instituteId: simulatedId, simulatedInstituteId: simulatedId };
      }
    }
    return { isSuperAdmin: true, facultyId: null, instituteId: null, simulatedInstituteId: null };
  }

  // DEAN — scoped to their faculty. instituteId on the user record is ignored for reads;
  // we always filter by facultyId across all institutes in that faculty.
  if (user.role === 'DEAN') {
    return { isSuperAdmin: false, facultyId: user.facultyId || null, instituteId: null, simulatedInstituteId: null };
  }

  // ADMIN / PLANNER / VIEWER — scoped to their single institute
  return { isSuperAdmin: false, facultyId: null, instituteId: user.instituteId || null, simulatedInstituteId: null };
}

/**
 * Builds a Prisma where-clause fragment for models that have an `institute` relation
 * with a `facultyId` field (e.g. Course, Teacher, Room, Group, Major, ScheduleEntry).
 *
 * Usage:
 *   const scope = extractFullScope(request);
 *   const where = buildInstituteWhere(scope);
 *   prisma.course.findMany({ where })
 */
export function buildInstituteWhere(scope: ScopeFilter): { instituteId?: string; institute?: { facultyId?: string } } | Record<string, never> {
  if (scope.isSuperAdmin && scope.instituteId) {
    // SuperAdmin simulating a specific institute
    return { instituteId: scope.instituteId };
  }
  if (scope.isSuperAdmin) {
    // SuperAdmin with no simulation — no filter
    return {};
  }
  if (scope.facultyId) {
    // DEAN — filter by facultyId through institute relation
    return { institute: { facultyId: scope.facultyId } };
  }
  if (scope.instituteId) {
    // ADMIN/PLANNER/VIEWER
    return { instituteId: scope.instituteId };
  }
  // Fallback safety: no unscoped access for non-super-admins
  return { instituteId: '__NO_ACCESS__' };
}

/**
 * Builds a Prisma where-clause fragment for Teacher model queries
 * (enabling ADMIN/PLANNER/VIEWER to see both their own institute teachers and UCP teachers).
 */
export function buildTeacherWhere(scope: ScopeFilter): any {
  if (scope.isSuperAdmin && scope.instituteId) {
    return { instituteId: scope.instituteId };
  }
  if (scope.isSuperAdmin) {
    return {};
  }
  if (scope.facultyId) {
    return { institute: { facultyId: scope.facultyId } };
  }
  if (scope.instituteId) {
    return {
      OR: [
        { instituteId: scope.instituteId },
        { institute: { shortCode: 'UCP' } },
        { institute: { shortCode: 'OKPKN' } },
        {
          // Prowadzący z innych jednostek, którzy mają alokacje na kursach tego instytutu
          allocations: {
            some: {
              course: { instituteId: scope.instituteId }
            }
          }
        }
      ]
    };
  }
  return { instituteId: '__NO_ACCESS__' };
}

/**
 * Builds a Prisma where-clause fragment for models that filter by teacher's institute
 * (e.g. ScheduleEntry where the teacher belongs to an institute in the scope).
 */
export function buildTeacherInstituteWhere(scope: ScopeFilter): any {
  if (scope.isSuperAdmin && scope.instituteId) {
    return { teacher: { instituteId: scope.instituteId } };
  }
  if (scope.isSuperAdmin) {
    return {};
  }
  if (scope.facultyId) {
    return { teacher: { institute: { facultyId: scope.facultyId } } };
  }
  if (scope.instituteId) {
    return {
      OR: [
        { teacher: { instituteId: scope.instituteId } },
        { teacher: { institute: { shortCode: 'UCP' } } },
        { teacher: { institute: { shortCode: 'OKPKN' } } }
      ]
    };
  }
  return { teacher: { instituteId: '__NO_ACCESS__' } };
}

/**
 * @deprecated Use extractFullScope instead for proper DEAN scoping.
 * Kept for backward compatibility on legacy endpoints that already handle DEAN separately.
 */
export function extractInstituteId(request: FastifyRequest): string | null {
  const scope = extractFullScope(request);
  if (scope.isSuperAdmin) {
    return scope.simulatedInstituteId;
  }
  return scope.instituteId;
}
