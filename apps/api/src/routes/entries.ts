import { FastifyInstance } from 'fastify';
import { audit, extractAuditContext, sanitize } from '../services/auditService';
import { prisma } from '../lib/prisma';
import { requireRole, extractFullScope, buildInstituteWhere, buildTeacherInstituteWhere, buildTeacherWhere, type ScopeFilter } from '../lib/rbac';
import { parseIdParam } from '../lib/params';
import { entrySchema, createEntry, updateEntry } from '../services/entryService';

function courseScopeWhere(scope: ScopeFilter) {
  const where = buildInstituteWhere(scope) as any;
  if (where.institute) return { institute: where.institute };
  if (where.instituteId) return { instituteId: where.instituteId };
  return where;
}

function entryScopeWhere(scope: ScopeFilter) {
  const courseWhere = courseScopeWhere(scope);
  if (Object.keys(courseWhere).length === 0) return {};
  return { course: courseWhere };
}

async function getScopedCourse(id: string, scope: ScopeFilter) {
  return prisma.course.findFirst({
    where: { id, ...courseScopeWhere(scope) },
    select: { id: true, instituteId: true },
  });
}

async function ensureEntryResourcesInScope(payload: {
  courseId?: string;
  teacherId?: string;
  roomId?: string;
  groupIds?: string[];
}, scope: ScopeFilter, reply: any) {
  let course: { id: string; instituteId: string | null } | null = null;

  if (payload.courseId) {
    course = await getScopedCourse(payload.courseId, scope);
    if (!course) {
      reply.code(403).send({ error: 'Brak dostępu do wskazanego przedmiotu.' });
      return null;
    }
  }

  if (payload.teacherId) {
    const teacher = await prisma.teacher.findFirst({
      where: { id: payload.teacherId, ...buildTeacherWhere(scope) },
      select: { id: true },
    });
    if (!teacher) {
      reply.code(403).send({ error: 'Brak dostępu do wskazanego prowadzącego.' });
      return null;
    }
  }

  if (payload.roomId) {
    const room = await prisma.room.findFirst({
      where: { id: payload.roomId, ...(buildInstituteWhere(scope) as any) },
      select: { id: true },
    });
    if (!room) {
      reply.code(403).send({ error: 'Brak dostępu do wskazanej sali.' });
      return null;
    }
  }

  if (payload.groupIds && payload.groupIds.length > 0) {
    const groupsCount = await prisma.group.count({
      where: { id: { in: payload.groupIds }, ...(buildInstituteWhere(scope) as any) },
    });
    if (groupsCount !== new Set(payload.groupIds).size) {
      reply.code(403).send({ error: 'Brak dostępu do co najmniej jednej wskazanej grupy.' });
      return null;
    }
  }

  return { course };
}

export default async function entriesRoutes(server: FastifyInstance) {

  server.get('/api/v1/entries', { preValidation: [server.authenticate] }, async (request, reply) => {
    const { semesterId } = request.query as { semesterId?: string };
    const scope = extractFullScope(request);

    const whereClause: any = {
      ...(semesterId ? { semesterId } : {}),
      ...buildTeacherInstituteWhere(scope),
    };

    // Zwracamy poszerzone relacje by SIATKA miała napisy, a nie tylko hashe UUID
    const entries = await prisma.scheduleEntry.findMany({
      where: whereClause,
      include: {
        course: true,
        teacher: true,
        room: true,
        groups: {
          include: {
            group: {
              include: { major: true }
            }
          }
        }
      }
    });

    // Płaskie renderowanie listy grup chroniące front-end przed mapowaniem zagnieżdżonym 
    const formattedEntries = entries.map((entry: any) => {
      return {
        ...entry,
        groups: entry.groups.map((g: any) => g.group),
        // effectiveType: classType z zapisanego wpisu (przypisany podczas dodawania) lub domyślny typ kursu
        effectiveType: entry.classType || entry.course.type,
      };
    });

    return { data: formattedEntries };
  });

  server.post('/api/v1/entries', { preValidation: [server.authenticate, requireRole('ADMIN', 'PLANNER')] }, async (request, reply) => {
    try {
      const payload = entrySchema.parse(request.body);
      const scope = extractFullScope(request);
      const access = await ensureEntryResourcesInScope(payload, scope, reply);
      if (!access) return;

      const ctx = extractAuditContext(request);
      const formattedEntry = await createEntry(payload, access.course?.instituteId, ctx);
      return reply.code(201).send({ data: formattedEntry });

    } catch (err) {
      if (err instanceof Error && 'conflicts' in err) {
        return reply.code(409).send({
          error: err.message,
          conflicts: (err as unknown as { conflicts: string[] }).conflicts
        });
      }
      const zodErr = err instanceof Object && 'errors' in err ? (err as { errors: unknown }).errors : undefined;
      return reply.code(400).send({ error: 'Nieprawidłowe wejście', details: zodErr });
    }
  });

  server.put('/api/v1/entries/:id', { preValidation: [server.authenticate, requireRole('ADMIN', 'PLANNER')] }, async (request, reply) => {
    const id = parseIdParam(request, reply);
    try {
      const payload = entrySchema.partial().parse(request.body);
      const scope = extractFullScope(request);

      const currentEntry = await prisma.scheduleEntry.findFirst({
        where: { id, ...entryScopeWhere(scope) },
        select: { id: true },
      });
      if (!currentEntry) return reply.code(404).send({ error: 'Nie znaleziono wpisu planu lub brak dostępu.' });

      const access = await ensureEntryResourcesInScope(payload, scope, reply);
      if (!access) return;

      const ctx = extractAuditContext(request);
      const formattedEntry = await updateEntry(id, payload, ctx);
      return reply.send({ data: formattedEntry });

    } catch (err) {
      if (err instanceof Error && err.message === 'Not Found') return reply.code(404).send({ error: 'Nie znaleziono' });
      if (err instanceof Error && 'conflicts' in err) {
        return reply.code(409).send({
          error: err.message,
          conflicts: (err as unknown as { conflicts: string[] }).conflicts
        });
      }
      const zodErr = err instanceof Object && 'errors' in err ? (err as { errors: unknown }).errors : undefined;
      return reply.code(400).send({ error: 'Nieprawidłowe wejście', details: zodErr });
    }
  });

  server.delete('/api/v1/entries/:id', { preValidation: [server.authenticate, requireRole('ADMIN', 'PLANNER')] }, async (request, reply) => {
    const id = parseIdParam(request, reply);
    try {
      const scope = extractFullScope(request);
      const currentEntry = await prisma.scheduleEntry.findFirst({
        where: { id, ...entryScopeWhere(scope) },
        select: { id: true },
      });
      if (!currentEntry) return reply.code(404).send({ error: 'Nie znaleziono wpisu planu lub brak dostępu.' });

      const oldRecord = await prisma.scheduleEntry.findUnique({ where: { id } });
      await prisma.scheduleEntry.delete({ where: { id } });
      const ctx = extractAuditContext(request);
      await audit(ctx, { action: 'DELETE', entityType: 'ScheduleEntry', entityId: id, oldData: sanitize(oldRecord) });
      return reply.send({ success: true });
    } catch {
      return reply.code(400).send({ error: 'Nie udało się skasować wpisu planu.' });
    }
  });
}
