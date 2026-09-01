import { FastifyInstance } from 'fastify';
import { audit, extractAuditContext, sanitize } from '../services/auditService';
import { prisma } from '../lib/prisma';
import { requireRole, extractFullScope, buildInstituteWhere } from '../lib/rbac';
import { parseIdParam, parseParam } from '../lib/params';
import z from 'zod';
import type { Prisma } from '@plan/database';

const createCourseSchema = z.object({
  code: z.string().min(1, 'Kod/Sygnatura przedmiotu jest wymagany'),
  name: z.string().min(1, 'Nazwa przedmiotu jest wymagana'),
  type: z.enum(['W', 'C', 'L', 'S', 'Pr', 'K']),
  ectsCredits: z.coerce.number().int().min(0, 'Punkty ECTS nie mogą byc ujemne'),
  hoursTotal: z.coerce.number().int().min(0).default(30),
  targetGroupsCount: z.coerce.number().int().min(1).default(1),
  semesterId: z.string().uuid('Nieprawidłowe ID semestru'),
  majors: z.array(z.object({
    majorId: z.string().uuid(),
    year: z.number().int().min(1).max(6),
  })).optional().default([]),
});

const updateCourseSchema = createCourseSchema.partial();
const bulkCourseSchema = z.array(createCourseSchema);

function scopedCourseWhere(scope: ReturnType<typeof extractFullScope>) {
  return buildInstituteWhere(scope) as any;
}

async function getCourseInScope(id: string, scope: ReturnType<typeof extractFullScope>) {
  return prisma.course.findFirst({
    where: { id, ...scopedCourseWhere(scope) },
    select: { id: true, instituteId: true },
  });
}

async function getAllocationInScope(id: string, scope: ReturnType<typeof extractFullScope>) {
  const courseWhere = scopedCourseWhere(scope);
  return prisma.courseAllocation.findFirst({
    where: {
      id,
      ...(Object.keys(courseWhere).length > 0 ? { course: courseWhere } : {}),
    },
    select: { id: true, courseId: true },
  });
}

async function ensureAllocationResourcesInScope(
  payload: { teacherId?: string; groupIds?: string[] },
  scope: ReturnType<typeof extractFullScope>,
  reply: any
) {
  if (payload.teacherId) {
    const teacherWhere: any = { id: payload.teacherId };
    if (!scope.isSuperAdmin) {
      if (scope.facultyId) {
        teacherWhere.institute = { facultyId: scope.facultyId };
      } else if (scope.instituteId) {
        const institute = await prisma.institute.findUnique({
          where: { id: scope.instituteId },
          select: { facultyId: true },
        });
        teacherWhere.OR = [
          { instituteId: scope.instituteId },
          ...(institute?.facultyId ? [{ institute: { facultyId: institute.facultyId } }] : []),
          { institute: { shortCode: 'UCP' } },
          { institute: { shortCode: 'OKPKN' } },
          { instituteId: null },
        ];
      } else {
        teacherWhere.instituteId = '__NO_ACCESS__';
      }
    }

    const teacher = await prisma.teacher.findFirst({
      where: teacherWhere,
      select: { id: true },
    });
    if (!teacher) {
      reply.code(403).send({ error: 'Brak dostępu do wskazanego prowadzącego.' });
      return false;
    }
  }

  if (payload.groupIds && payload.groupIds.length > 0) {
    const groupsCount = await prisma.group.count({
      where: { id: { in: payload.groupIds }, ...scopedCourseWhere(scope) },
    });
    if (groupsCount !== new Set(payload.groupIds).size) {
      reply.code(403).send({ error: 'Brak dostępu do co najmniej jednej wskazanej grupy.' });
      return false;
    }
  }

  return true;
}

export default async function coursesRoutes(server: FastifyInstance) {
  server.get('/api/v1/courses', { preValidation: [server.authenticate] }, async (request, reply) => {
    const { semesterId } = request.query as { semesterId?: string };
    const scope = extractFullScope(request);
    const whereClause: any = buildInstituteWhere(scope);
    if (semesterId) whereClause.semesterId = semesterId;

    const courses = await prisma.course.findMany({
      where: whereClause,
      include: {
        semester: true,
        majors: { include: { major: true } },
        allocations: {
          include: {
            teacher: true,
            groups: { include: { group: { include: { major: true } } } }
          }
        }
      },
      orderBy: [
        { name: 'asc' }
      ]
    });
    return { data: courses };
  });

  server.post('/api/v1/courses', { preValidation: [server.authenticate, requireRole('ADMIN', 'PLANNER')] }, async (request, reply) => {
    try {
      const instituteId = extractFullScope(request).instituteId;
      const { majors, ...payload } = createCourseSchema.parse(request.body);
      const course = await prisma.course.create({
        data: {
          ...payload,
          ...(instituteId ? { instituteId } : {}),
          majors: {
            create: majors.map(m => ({
              majorId: m.majorId,
              year: m.year
            }))
          }
        },
        include: { majors: { include: { major: true } } }
      });
      const ctx = extractAuditContext(request);
      await audit(ctx, { action: 'CREATE', entityType: 'Course', entityId: course.id, newData: sanitize(course) });
      return reply.code(201).send({ data: course });
    } catch (err) {
      if (err instanceof Object && 'code' in err && err.code === 'P2002') {
        return reply.code(400).send({ error: 'Podany kod przedmiotu już istnieje.' });
      }
      return reply.code(400).send({ error: 'Błąd walidacji danych przedmiotu' });
    }
  });

  server.post('/api/v1/courses/bulk', { preValidation: [server.authenticate, requireRole('ADMIN', 'PLANNER')] }, async (request, reply) => {
    try {
      const payload = bulkCourseSchema.parse(request.body);
      const instituteId = extractFullScope(request).instituteId;

      // use upsert to avoid P2002 errors when re-importing or updating existing courses
      const result = await prisma.$transaction(async (tx) => {
        let count = 0;
        for (const item of payload) {
          const { majors, code, semesterId, ...courseData } = item;

          await tx.course.upsert({
            where: {
              code_semesterId: { code, semesterId }
            },
            update: {
              ...courseData,
              ...(instituteId ? { instituteId } : {}),
              majors: {
                deleteMany: {}, // replace majors
                create: majors?.map((m: any) => ({
                  majorId: m.majorId,
                  year: m.year
                }))
              }
            },
            create: {
              code,
              semesterId,
              ...courseData,
              ...(instituteId ? { instituteId } : {}),
              majors: {
                create: majors?.map((m: any) => ({
                  majorId: m.majorId,
                  year: m.year
                }))
              }
            }
          });
          count++;
        }
        return { count };
      });

      return reply.code(201).send({ data: { count: result.count } });
    } catch (err) {
      server.log.error(err, 'Bulk import error');
      return reply.code(400).send({ error: 'Błąd walidacji danych CSV' });
    }
  });

  server.put('/api/v1/courses/:id', { preValidation: [server.authenticate, requireRole('ADMIN', 'PLANNER')] }, async (request, reply) => {
    const id = parseIdParam(request, reply);
    try {
      // Audyt #4: Weryfikuj przynależność do instytutu
      const instituteId = extractFullScope(request).instituteId;
      if (instituteId) {
        const target = await prisma.course.findFirst({ where: { id, instituteId } });
        if (!target) return reply.code(404).send({ error: 'Nie znaleziono przedmiotu.' });
      }

      const { majors, ...payload } = updateCourseSchema.parse(request.body);
      const oldRecord = await prisma.course.findUnique({ where: { id }, select: { id: true, code: true, name: true, type: true, ectsCredits: true, semesterId: true } });
      const course = await prisma.course.update({
        where: { id },
        data: {
          ...payload,
          ...(majors && {
            majors: {
              deleteMany: {},
              create: majors.map(m => ({
                majorId: m.majorId,
                year: m.year
              }))
            }
          })
        },
        include: { majors: { include: { major: true } } }
      });
      const ctx = extractAuditContext(request);
      await audit(ctx, { action: 'UPDATE', entityType: 'Course', entityId: id, oldData: sanitize(oldRecord), newData: sanitize(course) });
      return reply.send({ data: course });
    } catch (err) {
      if (err instanceof Object && 'code' in err && err.code === 'P2002') {
        return reply.code(400).send({ error: 'Podany kod przedmiotu jest już używany.' });
      }
      return reply.code(400).send({ error: 'Validation/Constraints Error or Not Found' });
    }
  });

  // ========== COURSE ALLOCATIONS ==========

  const allocationSchema = z.object({
    teacherId: z.string().uuid(),
    groupIds: z.array(z.string().uuid()).default([]),
    assignedHours: z.coerce.number().int().min(0).default(30),
    classType: z.enum(['W', 'C', 'L', 'S', 'Pr', 'K']).nullish(),
  });

  server.post('/api/v1/courses/:id/allocations', { preValidation: [server.authenticate, requireRole('ADMIN', 'PLANNER')] }, async (request, reply) => {
    const courseId = parseIdParam(request, reply);
    try {
      const scope = extractFullScope(request);
      const payload = allocationSchema.parse(request.body);
      const course = await getCourseInScope(courseId, scope);
      if (!course) return reply.code(404).send({ error: 'Nie znaleziono przedmiotu lub brak dostępu.' });
      if (!(await ensureAllocationResourcesInScope(payload, scope, reply))) return;

      const allocation = await prisma.courseAllocation.create({
        data: {
          courseId,
          teacherId: payload.teacherId,
          assignedHours: payload.assignedHours,
          classType: payload.classType ?? null,
          ...(course.instituteId ? { instituteId: course.instituteId } : {}),
          groups: {
            create: payload.groupIds.map(groupId => ({
              group: { connect: { id: groupId } }
            }))
          }
        },
        include: { teacher: true, groups: { include: { group: { include: { major: true } } } } }
      });
      const ctx = extractAuditContext(request);
      await audit(ctx, { action: 'CREATE', entityType: 'CourseAllocation', entityId: allocation.id, newData: sanitize(allocation) });
      return reply.code(201).send({ data: allocation });
    } catch (err) {
      return reply.code(400).send({ error: 'Validation Error', details: err instanceof Error ? err.message : undefined });
    }
  });

  server.delete('/api/v1/courses/allocations/:allocId', { preValidation: [server.authenticate, requireRole('ADMIN', 'PLANNER')] }, async (request, reply) => {
    const allocId = parseParam(request, 'allocId', reply);
    try {
      const scope = extractFullScope(request);
      const allocation = await getAllocationInScope(allocId, scope);
      if (!allocation) return reply.code(404).send({ error: 'Nie znaleziono przydziału lub brak dostępu.' });

      // CourseAllocationGroup ma onDelete: Cascade w schemacie Prisma,
      // więc grupy zostaną usunięte automatycznie razem z alokacją.
      const oldRecord = await prisma.courseAllocation.findUnique({ where: { id: allocId } });
      await prisma.courseAllocation.delete({ where: { id: allocId } });
      const ctx = extractAuditContext(request);
      await audit(ctx, { action: 'DELETE', entityType: 'CourseAllocation', entityId: allocId, oldData: sanitize(oldRecord) });
      return reply.send({ success: true });
    } catch (err: any) {
      server.log.error(err, 'Delete allocation error');
      if (err.code === 'P2025') {
        return reply.code(404).send({ error: 'Przydział nie został znaleziony — mógł zostać już usunięty.' });
      }
      return reply.code(400).send({ error: 'Nie udało się usunąć przydziału.', details: err.message });
    }
  });

  // PUT - update allocation (assigned hours, groups)
  const updateAllocationSchema = z.object({
    assignedHours: z.coerce.number().int().min(0).optional(),
    groupIds: z.array(z.string().uuid()).optional(),
    classType: z.enum(['W', 'C', 'L', 'S', 'Pr', 'K']).nullish(),
  });

  server.put('/api/v1/courses/allocations/:allocId', { preValidation: [server.authenticate, requireRole('ADMIN', 'PLANNER')] }, async (request, reply) => {
    const allocId = parseParam(request, 'allocId', reply);
    try {
      const scope = extractFullScope(request);
      const payload = updateAllocationSchema.parse(request.body);
      const allocation = await getAllocationInScope(allocId, scope);
      if (!allocation) return reply.code(404).send({ error: 'Nie znaleziono przydziału lub brak dostępu.' });
      if (!(await ensureAllocationResourcesInScope(payload, scope, reply))) return;

      const oldRecord = await prisma.courseAllocation.findUnique({ where: { id: allocId }, include: { groups: true } });
      // Atomowa aktualizacja w transakcji — chroni przed niespójnymi danymi
      const updated = await prisma.$transaction(async (tx) => {
        const updateData: Prisma.CourseAllocationUpdateInput = {};
        if (payload.assignedHours !== undefined) updateData.assignedHours = payload.assignedHours;
        if (payload.classType !== undefined) updateData.classType = payload.classType ?? null;

        if (Object.keys(updateData).length > 0) {
          await tx.courseAllocation.update({
            where: { id: allocId },
            data: updateData,
          });
        }

        if (payload.groupIds !== undefined) {
          await tx.courseAllocationGroup.deleteMany({ where: { allocationId: allocId } });
          if (payload.groupIds.length > 0) {
            await tx.courseAllocationGroup.createMany({
              data: payload.groupIds.map(groupId => ({ allocationId: allocId, groupId })),
            });
          }
        }

        const updatedAlloc = await tx.courseAllocation.findUnique({
          where: { id: allocId },
          include: { teacher: true, groups: { include: { group: { include: { major: true } } } } }
        });
        const ctx = extractAuditContext(request);
        await audit(ctx, { action: 'UPDATE', entityType: 'CourseAllocation', entityId: allocId, oldData: sanitize(oldRecord), newData: sanitize(updatedAlloc) }, tx);
        return updatedAlloc;
      });
      return reply.send({ data: updated });
    } catch (err) {
      return reply.code(400).send({ error: 'Could not update allocation.' });
    }
  });

  server.delete('/api/v1/courses/:id', { preValidation: [server.authenticate, requireRole('ADMIN')] }, async (request, reply) => {
    const id = parseIdParam(request, reply);
    try {
      // Audyt #4: Weryfikuj przynależność do instytutu
      const instituteId = extractFullScope(request).instituteId;
      if (instituteId) {
        const target = await prisma.course.findFirst({ where: { id, instituteId } });
        if (!target) return reply.code(404).send({ error: 'Nie znaleziono przedmiotu.' });
      }

      const oldRecord = await prisma.course.findUnique({ where: { id } });
      await prisma.course.delete({ where: { id } });
      const ctx = extractAuditContext(request);
      await audit(ctx, { action: 'DELETE', entityType: 'Course', entityId: id, oldData: sanitize(oldRecord) });
      return reply.send({ success: true });
    } catch {
      return reply.code(400).send({ error: 'Cannot delete course - it might be used in schedule entries' });
    }
  });

  // ========== CLONE SEMESTER ==========

  server.post('/api/v1/courses/clone', { preValidation: [server.authenticate, requireRole('ADMIN', 'PLANNER')] }, async (request, reply) => {
    try {
      const cloneSchema = z.object({
        sourceSemesterId: z.string().uuid(),
        targetSemesterId: z.string().uuid(),
        majorId: z.string().uuid().optional(),
      });
      const { sourceSemesterId, targetSemesterId, majorId } = cloneSchema.parse(request.body);
      const instituteId = extractFullScope(request).instituteId;

      // 1. Get all courses from source semester
      const sourceCourses = await prisma.course.findMany({
        where: {
          semesterId: sourceSemesterId,
          ...(instituteId ? { instituteId } : {}),
          ...(majorId ? { majors: { some: { majorId } } } : {})
        },
        include: {
          majors: true
        }
      });

      if (sourceCourses.length === 0) {
        return reply.code(404).send({ error: 'Nie znaleziono przedmiotów w semestrze źródłowym.' });
      }

      // 2. Clone them into target semester
      const result = await prisma.$transaction(async (tx) => {
        let count = 0;
        for (const course of sourceCourses) {
          await tx.course.upsert({
            where: {
              code_semesterId: { code: course.code, semesterId: targetSemesterId }
            },
            update: {
              name: course.name,
              type: course.type,
              ectsCredits: course.ectsCredits,
              hoursTotal: course.hoursTotal,
              targetGroupsCount: course.targetGroupsCount,
              majors: {
                deleteMany: {},
                create: course.majors.map(m => ({
                  majorId: m.majorId,
                  year: m.year
                }))
              }
            },
            create: {
              code: course.code,
              name: course.name,
              type: course.type,
              ectsCredits: course.ectsCredits,
              hoursTotal: course.hoursTotal,
              targetGroupsCount: course.targetGroupsCount,
              semesterId: targetSemesterId,
              instituteId: course.instituteId,
              majors: {
                create: course.majors.map(m => ({
                  majorId: m.majorId,
                  year: m.year
                }))
              }
            }
          });
          count++;
        }
        return { count };
      });

      return reply.code(201).send({ data: result });
    } catch (err) {
      server.log.error(err, 'Clone semester error');
      return reply.code(400).send({ error: 'Błąd podczas klonowania semestru.' });
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // USOS API PROXY — wyszukiwanie przedmiotów z publicznego API USOS
  // ═══════════════════════════════════════════════════════════════════
  
  // Konfiguracja USOS — hardcode z możliwością rozszerzenia
  const USOS_CONFIG = {
    API_BASE: 'https://usosapps.amu.edu.pl/services',
    FAC_ID: '0900000000', // Wydział Neofilologii UAM
    PAGE_SIZE: 20,
    MAX_PAGES: 50, // Safety limit: max 1000 wyników
    DELAY_MS: 300,
  };

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  server.get('/api/v1/usos/search', {
    preValidation: [server.authenticate, requireRole('ADMIN', 'PLANNER')]
  }, async (request, reply) => {
    const { prefix } = request.query as { prefix?: string };

    if (!prefix || prefix.trim().length < 5) {
      return reply.code(400).send({ error: 'Parametr "prefix" musi mieć min. 5 znaków (np. 09-S2LSN01).' });
    }

    const searchPrefix = prefix.trim();
    server.log.info(`USOS search: prefix="${searchPrefix}"`);

    try {
      const allItems: Array<{ code: string; name: string; ects: number }> = [];
      let start = 0;
      let pageCount = 0;

      while (pageCount < USOS_CONFIG.MAX_PAGES) {
        const url = new URL(`${USOS_CONFIG.API_BASE}/courses/search`);
        url.searchParams.set('name', searchPrefix);
        url.searchParams.set('fac_id', USOS_CONFIG.FAC_ID);
        url.searchParams.set('fields', 'course_id|name|ects_credits_simplified');
        url.searchParams.set('num', USOS_CONFIG.PAGE_SIZE.toString());
        url.searchParams.set('start', start.toString());
        url.searchParams.set('format', 'json');

        const response = await fetch(url.toString(), {
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          server.log.error(`USOS API error: ${response.status} ${response.statusText}`);
          return reply.code(502).send({ error: `USOS API zwróciło błąd: ${response.status}` });
        }

        const data = await response.json() as {
          items: Array<{
            course_id: string;
            name?: { pl?: string; en?: string } | string;
            ects_credits_simplified?: number;
          }>;
          next_page: boolean;
        };

        if (!data.items || data.items.length === 0) break;

        for (const item of data.items) {
          const nameObj = item.name;
          let displayName = '';
          if (typeof nameObj === 'object' && nameObj !== null) {
            displayName = nameObj.pl || nameObj.en || '';
          } else if (typeof nameObj === 'string') {
            displayName = nameObj;
          }

          allItems.push({
            code: item.course_id,
            name: displayName,
            ects: Math.round(item.ects_credits_simplified || 0),
          });
        }

        if (!data.next_page) break;
        start += USOS_CONFIG.PAGE_SIZE;
        pageCount++;

        // Rate limiting — żeby nie przeciążać USOS
        if (data.next_page) await sleep(USOS_CONFIG.DELAY_MS);
      }

      // Deduplikacja po kodzie (na wypadek duplikatów z różnych stron)
      const uniqueMap = new Map<string, typeof allItems[0]>();
      for (const item of allItems) {
        if (!uniqueMap.has(item.code)) uniqueMap.set(item.code, item);
      }

      const result = Array.from(uniqueMap.values()).sort((a, b) => a.code.localeCompare(b.code));

      server.log.info(`USOS search done: ${result.length} unique courses found for "${searchPrefix}"`);
      return reply.send({ data: result, count: result.length });
    } catch (err: any) {
      server.log.error(err, 'USOS proxy error');
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        return reply.code(504).send({ error: 'Przekroczono limit czasu połączenia z USOS API.' });
      }
      return reply.code(500).send({ error: 'Błąd wewnętrzny podczas komunikacji z USOS API.' });
    }
  });
}
