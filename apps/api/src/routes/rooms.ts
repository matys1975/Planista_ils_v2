import { FastifyInstance } from 'fastify';
import { audit, extractAuditContext, sanitize } from '../services/auditService';
import { prisma } from '../lib/prisma';
import { requireRole, extractFullScope, buildInstituteWhere } from '../lib/rbac';
import { parseIdParam } from '../lib/params';
import z from 'zod';

const createRoomSchema = z.object({
  building: z.string().min(1),
  number: z.string().min(1),
  capacity: z.number().int().positive(),
  type: z.string().min(1),
  equipment: z.array(z.string()).optional(),
  instituteId: z.string().uuid().optional(),
});

async function resolveWritableInstituteId(
  scope: ReturnType<typeof extractFullScope>,
  requestedInstituteId: string | undefined,
  reply: any,
  options: { requireForDean?: boolean } = {}
) {
  if (scope.isSuperAdmin) return requestedInstituteId;

  if (scope.facultyId) {
    if (!requestedInstituteId) {
      if (options.requireForDean) {
        reply.code(400).send({ error: 'Wskaż instytut dla sali.' });
        return null;
      }
      return undefined;
    }

    const institute = await prisma.institute.findFirst({
      where: { id: requestedInstituteId, facultyId: scope.facultyId },
      select: { id: true },
    });
    if (!institute) {
      reply.code(403).send({ error: 'Brak dostępu do wskazanego instytutu.' });
      return null;
    }
    return requestedInstituteId;
  }

  if (requestedInstituteId && requestedInstituteId !== scope.instituteId) {
    reply.code(403).send({ error: 'Brak dostępu do wskazanego instytutu.' });
    return null;
  }

  return scope.instituteId;
}

export default async function roomsRoutes(server: FastifyInstance) {
  server.get('/api/v1/rooms', { preValidation: [server.authenticate] }, async (request, reply) => {
    const scope = extractFullScope(request);
    const whereClause = buildInstituteWhere(scope);

    const rooms = await prisma.room.findMany({
      where: whereClause,
      include: {
        institute: {
          select: { name: true, shortCode: true }
        },
        _count: {
          select: { entries: true }
        }
      },
      orderBy: { building: 'asc' }
    });
    return { data: rooms };
  });

  server.post('/api/v1/rooms', { preValidation: [server.authenticate, requireRole('ADMIN', 'PLANNER', 'DEAN')] }, async (request, reply) => {
    try {
      const scope = extractFullScope(request);
      // Clean empty instituteId before Zod validation (empty string fails .uuid())
      const body = { ...(request.body as any) };
      if (body.instituteId === '') delete body.instituteId;
      const payload = createRoomSchema.parse(body);
      const resolvedInstituteId = await resolveWritableInstituteId(scope, payload.instituteId, reply, { requireForDean: true });
      if (resolvedInstituteId === null) return;
      const { instituteId: _bodyInstId, ...roomData } = payload;
      const room = await prisma.room.create({
        data: {
          ...roomData,
          equipment: roomData.equipment || [],
          ...(resolvedInstituteId ? { instituteId: resolvedInstituteId } : {}),
        },
      });
      const ctx = extractAuditContext(request);
      await audit(ctx, { action: 'CREATE', entityType: 'Room', entityId: room.id, newData: sanitize(room) });
      return reply.code(201).send({ data: room });
    } catch (err) {
      return reply.code(400).send({ error: 'Validation/Constraints Error' });
    }
  });

  server.put('/api/v1/rooms/:id', { preValidation: [server.authenticate, requireRole('ADMIN', 'PLANNER', 'DEAN')] }, async (request, reply) => {
    const id = parseIdParam(request, reply);
    try {
      const scope = extractFullScope(request);
      const whereClause = buildInstituteWhere(scope);
      if (Object.keys(whereClause).length > 0) {
        const target = await prisma.room.findFirst({ where: { id, ...whereClause } });
        if (!target) return reply.code(404).send({ error: 'Nie znaleziono sali lub brak dostępu.' });
      }

      // Clean empty instituteId before Zod validation
      const putBody = { ...(request.body as any) };
      if (putBody.instituteId === '') delete putBody.instituteId;
      const payload = createRoomSchema.partial().parse(putBody);
      const { instituteId: bodyInstId, ...roomData } = payload;
      const resolvedInstituteId = await resolveWritableInstituteId(scope, bodyInstId, reply);
      if (resolvedInstituteId === null) return;
      const oldRecord = await prisma.room.findUnique({ where: { id }, select: { id: true, building: true, number: true, capacity: true, type: true, instituteId: true } });
      const room = await prisma.room.update({
        where: { id },
        data: {
          ...roomData,
          ...(resolvedInstituteId ? { instituteId: resolvedInstituteId } : {}),
        },
      });
      const ctx = extractAuditContext(request);
      await audit(ctx, { action: 'UPDATE', entityType: 'Room', entityId: id, oldData: sanitize(oldRecord), newData: sanitize(room) });
      return reply.send({ data: room });
    } catch (err) {
      return reply.code(400).send({ error: 'Validation/Constraints Error or Not Found' });
    }
  });

  server.delete('/api/v1/rooms/:id', { preValidation: [server.authenticate, requireRole('ADMIN', 'PLANNER', 'DEAN')] }, async (request, reply) => {
    const id = parseIdParam(request, reply);
    const { force } = request.query as { force?: string };

    try {
      const scope = extractFullScope(request);
      const whereClause = buildInstituteWhere(scope);
      if (Object.keys(whereClause).length > 0) {
        const target = await prisma.room.findFirst({ where: { id, ...whereClause } });
        if (!target) return reply.code(404).send({ error: 'Nie znaleziono sali lub brak dostępu.' });
      }

      // Check for related schedule entries
      const relatedEntries = await prisma.scheduleEntry.findMany({
        where: { roomId: id },
        include: {
          course: { select: { name: true, code: true } },
          teacher: { select: { firstName: true, lastName: true, title: true } },
          semester: { select: { name: true } },
        },
      });

      if (relatedEntries.length > 0 && force !== 'true') {
        // Return details about blocking entries so the frontend can show a warning
        const entrySummaries = relatedEntries.map(e => ({
          id: e.id,
          course: `${e.course.code} — ${e.course.name}`,
          teacher: `${e.teacher.title} ${e.teacher.firstName} ${e.teacher.lastName}`,
          day: e.dayOfWeek,
          time: `${e.startTime}–${e.endTime}`,
          semester: e.semester.name,
        }));

        return reply.code(409).send({
          error: `Sala jest używana w ${relatedEntries.length} wpisach planu. Możesz wymusić usunięcie (razem z wpisami).`,
          entriesCount: relatedEntries.length,
          entries: entrySummaries,
        });
      }

      const oldRecord = await prisma.room.findUnique({ where: { id } });
      // Force delete: remove related entries first, then the room — all in a transaction
      await prisma.$transaction(async (tx) => {
        if (relatedEntries.length > 0) {
          // Delete ScheduleEntryGroup join records first
          await tx.scheduleEntryGroup.deleteMany({
            where: { entryId: { in: relatedEntries.map(e => e.id) } },
          });
          // Delete the schedule entries themselves
          await tx.scheduleEntry.deleteMany({
            where: { roomId: id },
          });
        }
        await tx.room.delete({ where: { id } });
        const ctx = extractAuditContext(request);
        await audit(ctx, { action: 'DELETE', entityType: 'Room', entityId: id, oldData: sanitize(oldRecord) }, tx);
      });

      return reply.send({
        success: true,
        deletedEntries: relatedEntries.length,
      });
    } catch (err: any) {
      server.log.error(err, 'Room delete error');
      if (err.code === 'P2003') {
        return reply.code(400).send({ error: 'Nie można usunąć sali, ponieważ jest przypisana do zajęć w planie.' });
      }
      return reply.code(400).send({ error: 'Wystąpił błąd podczas usuwania sali.' });
    }
  });
}
