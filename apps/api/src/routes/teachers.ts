import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { requireRole, extractFullScope, buildTeacherWhere, SHARED_INSTITUTE_SHORT_CODES } from '../lib/rbac';
import { parseIdParam } from '../lib/params';
import z from 'zod';
import { audit, extractAuditContext, sanitize } from '../services/auditService';

const createTeacherSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  title: z.string().min(1),
  email: z.string().email(),
  unit: z.string().min(1).default('Instytut Lingwistyki Stosowanej'),
  pensumLimit: z.number().int().positive().default(210),
});

const updateTeacherSchema = createTeacherSchema.partial().extend({
  version: z.number().int().nonnegative().optional()
});
const bulkTeacherSchema = z.array(createTeacherSchema);

export default async function teachersRoutes(server: FastifyInstance) {
  server.get('/api/v1/teachers', { preValidation: [server.authenticate] }, async (request, reply) => {
    const { scope } = request.query as { scope?: string };
    const sc = extractFullScope(request);

    let whereClause;
    if (sc.isSuperAdmin && scope === 'global') {
      whereClause = {};
    } else if (scope === 'global' && sc.instituteId) {
      // Find the facultyId of the user's institute
      const inst = await prisma.institute.findUnique({
        where: { id: sc.instituteId },
        select: { facultyId: true }
      });
      if (inst?.facultyId) {
        whereClause = {
          OR: [
            { institute: { facultyId: inst.facultyId } },
            ...SHARED_INSTITUTE_SHORT_CODES.map(code => ({ institute: { shortCode: code } })),
            { instituteId: null }
          ]
        };
      } else {
        whereClause = buildTeacherWhere(sc);
      }
    } else {
      whereClause = buildTeacherWhere(sc);
    }

    const teachers = await prisma.teacher.findMany({
      where: whereClause,
      include: {
        institute: { select: { id: true, name: true, shortCode: true } },
        allocations: {
          include: {
            course: { include: { semester: true } },
            groups: { include: { group: { include: { major: true } } } }
          }
        },
        entries: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            dayOfWeek: true,
            weekType: true,
            semesterId: true,
            classType: true,
            course: { select: { name: true, type: true } },
            room: { select: { building: true, number: true } },
            groups: { select: { group: { select: { name: true, major: { select: { code: true } } } } } },
          }
        }
      },
      orderBy: { lastName: 'asc' }
    });
    return { data: teachers };
  });

  server.post('/api/v1/teachers', { preValidation: [server.authenticate, requireRole('ADMIN', 'PLANNER')] }, async (request, reply) => {
    try {
      const payload = createTeacherSchema.parse(request.body);

      // Find the institute by its name (payload.unit)
      const targetInst = await prisma.institute.findFirst({
        where: { name: payload.unit }
      });
      if (!targetInst) {
        return reply.code(400).send({ error: 'Nieprawidłowa jednostka organizacyjna.' });
      }

      const teacher = await prisma.teacher.create({
        data: {
          ...payload,
          instituteId: targetInst.id,
        },
      });
      const ctx = extractAuditContext(request);
      await audit(ctx, { action: 'CREATE', entityType: 'Teacher', entityId: teacher.id, newData: sanitize(teacher) });
      return reply.code(201).send({ data: teacher });
    } catch (err: any) {
      server.log.error(err, 'Failed to create teacher');
      if (err instanceof Object && 'code' in err && err.code === 'P2002') {
        const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : String(err.meta?.target || '');
        const email = (request.body as any)?.email;
        if (target.includes('email') || !target) {
          return reply.code(409).send({
            error: email
              ? `Prowadzący o adresie e-mail "${email}" już istnieje w bazie danych.`
              : 'Prowadzący o podanym adresie e-mail już istnieje w bazie danych.'
          });
        }
        return reply.code(409).send({ error: `Naruszenie unikalności danych (${target}).` });
      }
      if (err instanceof z.ZodError) {
        const details = err.errors.map(e => e.message).join(', ');
        return reply.code(400).send({ error: `Błąd walidacji danych: ${details}`, details: err.errors });
      }
      return reply.code(400).send({ error: err?.message || 'Wystąpił błąd podczas dodawania prowadzącego.' });
    }
  });

  server.post('/api/v1/teachers/bulk', { preValidation: [server.authenticate, requireRole('ADMIN', 'PLANNER')] }, async (request, reply) => {
    try {
      const sc = extractFullScope(request);
      const payload = bulkTeacherSchema.parse(request.body);

      // Find all institutes to map unit names to IDs
      const institutes = await prisma.institute.findMany();
      const instMap = new Map(institutes.map(i => [i.name.toLowerCase().trim(), i.id]));

      // Also map by shortCode to be friendly to CSV imports (e.g. 'ILS' -> Instytut Lingwistyki Stosowanej)
      const shortCodeMap = new Map(institutes.map(i => [i.shortCode?.toLowerCase().trim() || '', i.id]));

      const dataToInsert = payload.map(t => {
        const unitClean = t.unit.toLowerCase().trim();
        let targetId = instMap.get(unitClean) || shortCodeMap.get(unitClean);

        if (!targetId) {
          targetId = sc.instituteId ?? undefined; // fallback to user's institute if not found
        }

        return {
          firstName: t.firstName,
          lastName: t.lastName,
          title: t.title,
          email: t.email,
          unit: t.unit,
          pensumLimit: t.pensumLimit,
          instituteId: targetId ?? undefined
        };
      });

      const result = await prisma.teacher.createMany({
        data: dataToInsert,
        skipDuplicates: true,
      });
      return reply.code(201).send({ data: { count: result.count } });
    } catch (err) {
      const zodErr = err instanceof z.ZodError ? err.errors : undefined;
      return reply.code(400).send({ error: 'Validation Error in CSV Data', details: zodErr });
    }
  });

  server.put('/api/v1/teachers/:id', { preValidation: [server.authenticate, requireRole('ADMIN', 'PLANNER')] }, async (request, reply) => {
    const id = parseIdParam(request, reply);
    try {
      const sc = extractFullScope(request);
      const existingTeacher = await prisma.teacher.findUnique({
        where: { id },
        include: { institute: { select: { shortCode: true } } }
      });
      if (!existingTeacher) {
        return reply.code(404).send({ error: 'Nie znaleziono prowadzącego.' });
      }

      // Security check on existing teacher's institute (allow own institute + shared units like UCP, OKPKN, SJ UAM, Zlecenie)
      if (!sc.isSuperAdmin && !sc.facultyId) {
        const isSharedUnit = (SHARED_INSTITUTE_SHORT_CODES as readonly string[]).includes(existingTeacher.institute?.shortCode || '');
        if (existingTeacher.instituteId !== sc.instituteId && !isSharedUnit) {
          return reply.code(403).send({ error: 'Nie masz uprawnień do edycji pracownika z innej jednostki.' });
        }
      }

      const payload = updateTeacherSchema.parse(request.body);
      let targetInstituteId = existingTeacher.instituteId;

      if (payload.unit) {
        const targetInst = await prisma.institute.findFirst({
          where: { name: payload.unit }
        });
        if (!targetInst) {
          return reply.code(400).send({ error: 'Nieprawidłowa jednostka organizacyjna.' });
        }
        targetInstituteId = targetInst.id;
      }

      const { version, ...updateData } = payload;

      const oldRecord = await prisma.teacher.findUnique({ where: { id }, select: { id: true, firstName: true, lastName: true, email: true, unit: true, pensumLimit: true, instituteId: true } });

      const teacher = await prisma.teacher.update({
        where: version !== undefined ? { id, version } : { id },
        data: {
          ...updateData,
          instituteId: targetInstituteId,
          version: { increment: 1 }
        },
      });
      const ctx = extractAuditContext(request);
      await audit(ctx, { action: 'UPDATE', entityType: 'Teacher', entityId: id, oldData: sanitize(oldRecord), newData: sanitize(teacher) });
      return reply.send({ data: teacher });
    } catch (err: any) {
      server.log.error(err, 'Failed to update teacher');
      if (err instanceof Object && 'code' in err && err.code === 'P2025') {
        return reply.code(409).send({ error: 'Błąd zapisu: Dane zostały w międzyczasie zmodyfikowane przez innego użytkownika. Odśwież stronę.' });
      }
      if (err instanceof Object && 'code' in err && err.code === 'P2002') {
        const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : String(err.meta?.target || '');
        const email = (request.body as any)?.email;
        if (target.includes('email') || !target) {
          return reply.code(409).send({
            error: email
              ? `Prowadzący o adresie e-mail "${email}" już istnieje w bazie danych.`
              : 'Prowadzący o podanym adresie e-mail już istnieje w bazie danych.'
          });
        }
        return reply.code(409).send({ error: `Naruszenie unikalności danych (${target}).` });
      }
      if (err instanceof z.ZodError) {
        const details = err.errors.map(e => e.message).join(', ');
        return reply.code(400).send({ error: `Błąd walidacji danych: ${details}`, details: err.errors });
      }
      return reply.code(400).send({ error: err?.message || 'Wystąpił błąd podczas aktualizacji prowadzącego.' });
    }
  });

  server.delete('/api/v1/teachers/:id', { preValidation: [server.authenticate, requireRole('ADMIN')] }, async (request, reply) => {
    const id = parseIdParam(request, reply);
    try {
      const sc = extractFullScope(request);
      const existingTeacher = await prisma.teacher.findUnique({
        where: { id },
        include: { institute: { select: { shortCode: true } } }
      });
      if (!existingTeacher) {
        return reply.code(404).send({ error: 'Nie znaleziono prowadzącego.' });
      }

      // Security check: allow deleting own institute teachers + shared units (UCP, OKPKN, SJ UAM, Zlecenie)
      if (!sc.isSuperAdmin && !sc.facultyId) {
        const isSharedUnit = (SHARED_INSTITUTE_SHORT_CODES as readonly string[]).includes(existingTeacher.institute?.shortCode || '');
        if (existingTeacher.instituteId !== sc.instituteId && !isSharedUnit) {
          return reply.code(403).send({ error: 'Nie masz uprawnień do usunięcia pracownika z innej jednostki.' });
        }
      }

      const oldRecord = await prisma.teacher.findUnique({ where: { id } });
      await prisma.teacher.delete({ where: { id } });
      const ctx = extractAuditContext(request);
      await audit(ctx, { action: 'DELETE', entityType: 'Teacher', entityId: id, oldData: sanitize(oldRecord) });
      return reply.send({ success: true });
    } catch (err: any) {
      server.log.error(err, 'Failed to delete teacher');
      return reply.code(400).send({ error: err?.message || 'Nie można usunąć prowadzącego.' });
    }
  });
}
