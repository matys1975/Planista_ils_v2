import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { requireRole, extractFullScope, buildTeacherWhere } from '../lib/rbac';
import { parseIdParam } from '../lib/params';
import z from 'zod';

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
            { institute: { shortCode: 'UCP' } },
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
      const sc = extractFullScope(request);
      const payload = createTeacherSchema.parse(request.body);

      // Find the institute by its name (payload.unit)
      const targetInst = await prisma.institute.findFirst({
        where: { name: payload.unit }
      });
      if (!targetInst) {
        return reply.code(400).send({ error: 'Nieprawidłowa jednostka organizacyjna.' });
      }

      // Security check: regular ADMIN/PLANNER can only write to their own institute or UCP
      if (!sc.isSuperAdmin && !sc.facultyId) {
        const ucp = await prisma.institute.findFirst({ where: { shortCode: 'UCP' }, select: { id: true } });
        if (targetInst.id !== sc.instituteId && targetInst.id !== ucp?.id) {
          return reply.code(403).send({ error: 'Nie masz uprawnień do przypisywania pracowników do tej jednostki.' });
        }
      }

      const teacher = await prisma.teacher.create({
        data: {
          ...payload,
          instituteId: targetInst.id,
        },
      });
      return reply.code(201).send({ data: teacher });
    } catch (err) {
      return reply.code(400).send({ error: 'Validation/Constraints Error' });
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

      const ucp = institutes.find(i => i.shortCode === 'UCP');

      const dataToInsert = payload.map(t => {
        const unitClean = t.unit.toLowerCase().trim();
        let targetId = instMap.get(unitClean) || shortCodeMap.get(unitClean);

        // Security / validation: regular admin can only assign to their own institute or UCP
        if (!sc.isSuperAdmin && !sc.facultyId) {
          if (targetId !== sc.instituteId && targetId !== ucp?.id) {
            targetId = sc.instituteId ?? undefined; // fallback to own institute if not permitted
          }
        } else if (!targetId) {
          targetId = sc.instituteId ?? undefined; // fallback to user's institute
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
      const existingTeacher = await prisma.teacher.findUnique({ where: { id } });
      if (!existingTeacher) {
        return reply.code(404).send({ error: 'Nie znaleziono prowadzącego.' });
      }

      // Security check on existing teacher's institute
      if (!sc.isSuperAdmin && !sc.facultyId) {
        const ucp = await prisma.institute.findFirst({ where: { shortCode: 'UCP' }, select: { id: true } });
        if (existingTeacher.instituteId !== sc.instituteId && existingTeacher.instituteId !== ucp?.id) {
          return reply.code(403).send({ error: 'Nie masz uprawnień do edycji tego pracownika.' });
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

        // Security check on new target institute
        if (!sc.isSuperAdmin && !sc.facultyId) {
          const ucp = await prisma.institute.findFirst({ where: { shortCode: 'UCP' }, select: { id: true } });
          if (targetInst.id !== sc.instituteId && targetInst.id !== ucp?.id) {
            return reply.code(403).send({ error: 'Nie masz uprawnień do przypisywania pracowników do tej jednostki.' });
          }
        }
        targetInstituteId = targetInst.id;
      }

      const { version, ...updateData } = payload;

      const teacher = await prisma.teacher.update({
        where: version !== undefined ? { id, version } : { id },
        data: {
          ...updateData,
          instituteId: targetInstituteId,
          version: { increment: 1 }
        },
      });
      return reply.send({ data: teacher });
    } catch (err) {
      if (err instanceof Object && 'code' in err && err.code === 'P2025') {
        return reply.code(409).send({ error: 'Błąd zapisu: Dane zostały w międzyczasie zmodyfikowane przez innego użytkownika. Odśwież stronę.' });
      }
      return reply.code(400).send({ error: 'Validation/Constraints Error or Not Found' });
    }
  });

  server.delete('/api/v1/teachers/:id', { preValidation: [server.authenticate, requireRole('ADMIN')] }, async (request, reply) => {
    const id = parseIdParam(request, reply);
    try {
      const sc = extractFullScope(request);
      const existingTeacher = await prisma.teacher.findUnique({ where: { id } });
      if (!existingTeacher) {
        return reply.code(404).send({ error: 'Nie znaleziono prowadzącego.' });
      }

      if (!sc.isSuperAdmin && !sc.facultyId) {
        const ucp = await prisma.institute.findFirst({ where: { shortCode: 'UCP' }, select: { id: true } });
        if (existingTeacher.instituteId !== sc.instituteId && existingTeacher.instituteId !== ucp?.id) {
          return reply.code(403).send({ error: 'Nie masz uprawnień do usunięcia tego pracownika.' });
        }
      }

      await prisma.teacher.delete({ where: { id } });
      return reply.send({ success: true });
    } catch {
      return reply.code(400).send({ error: 'Cannot delete teacher' });
    }
  });
}
