import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { requireRole, extractFullScope } from '../lib/rbac';
import { parseIdParam } from '../lib/params';
import z from 'zod';
import { audit, extractAuditContext, sanitize } from '../services/auditService';

const createStaffingRequestSchema = z.object({
  courseId: z.string().uuid(),
  requestedGroups: z.number().int().positive(),
  notes: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'RESOLVED', 'REJECTED']).optional(),
  adminNotes: z.string().optional(),
});

function staffingScopeWhere(sc: ReturnType<typeof extractFullScope>) {
  if (sc.isSuperAdmin) return {};
  if (sc.facultyId) return { institute: { facultyId: sc.facultyId } };
  if (sc.instituteId) return { instituteId: sc.instituteId };
  return { instituteId: '__NO_ACCESS__' };
}

export default async function staffingRequestsRoutes(server: FastifyInstance) {
  // GET /api/v1/staffing-requests
  server.get('/api/v1/staffing-requests', { preValidation: [server.authenticate] }, async (request, reply) => {
    const sc = extractFullScope(request);
    const { scope } = request.query as { scope?: string };

    let whereClause = {};

    // Jeśli nie żąda globalnie albo nie ma praw do global, ogranicz do jego instytutu
    if (scope !== 'global' || (!sc.isSuperAdmin && !sc.facultyId)) {
      if (sc.instituteId) {
        whereClause = { instituteId: sc.instituteId };
      } else {
        return reply.code(403).send({ error: 'Brak przypisania do instytutu.' });
      }
    }

    const requests = await prisma.staffingRequest.findMany({
      where: whereClause,
      include: {
        course: {
          select: { code: true, name: true, type: true, hoursTotal: true }
        },
        institute: {
          select: { name: true, shortCode: true }
        },
        semester: {
          select: { name: true, year: true, type: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return { data: requests };
  });

  // POST /api/v1/staffing-requests
  server.post('/api/v1/staffing-requests', { preValidation: [server.authenticate, requireRole('ADMIN', 'PLANNER')] }, async (request, reply) => {
    try {
      const sc = extractFullScope(request);
      if (!sc.instituteId) {
        return reply.code(403).send({ error: 'Tylko przypisani do instytutu mogą zgłaszać zapotrzebowania.' });
      }

      const payload = createStaffingRequestSchema.parse(request.body);

      // Sprawdź czy course istnieje
      const course = await prisma.course.findFirst({
        where: { id: payload.courseId, instituteId: sc.instituteId },
      });

      if (!course) {
        return reply.code(404).send({ error: 'Nie znaleziono przedmiotu.' });
      }

      const newRequest = await prisma.staffingRequest.create({
        data: {
          requestedGroups: payload.requestedGroups,
          notes: payload.notes,
          courseId: course.id,
          semesterId: course.semesterId,
          instituteId: sc.instituteId,
          status: 'PENDING',
        }
      });
      const ctx = extractAuditContext(request);
      await audit(ctx, { action: 'CREATE', entityType: 'StaffingRequest', entityId: newRequest.id, newData: sanitize(newRequest) });
      return reply.code(201).send({ data: newRequest });
    } catch (err) {
      return reply.code(400).send({ error: 'Validation Error' });
    }
  });

  // PATCH /api/v1/staffing-requests/:id/status
  server.patch('/api/v1/staffing-requests/:id/status', { preValidation: [server.authenticate, requireRole('SUPER_ADMIN', 'DEAN')] }, async (request, reply) => {
    const id = parseIdParam(request, reply);
    try {
      const sc = extractFullScope(request);
      const payload = updateStatusSchema.parse(request.body);

      const existing = await prisma.staffingRequest.findFirst({
        where: { id, ...staffingScopeWhere(sc) },
        select: { id: true },
      });
      if (!existing) return reply.code(404).send({ error: 'Nie znaleziono zgłoszenia lub brak dostępu.' });

      const oldRecord = await prisma.staffingRequest.findUnique({ where: { id }, select: { id: true, requestedGroups: true, notes: true, status: true, adminNotes: true, instituteId: true, courseId: true, semesterId: true } });

      const req = await prisma.staffingRequest.update({
        where: { id },
        data: { 
          ...(payload.status && { status: payload.status }),
          ...(payload.adminNotes !== undefined && { adminNotes: payload.adminNotes })
        }
      });
      const ctx = extractAuditContext(request);
      await audit(ctx, { action: 'UPDATE', entityType: 'StaffingRequest', entityId: id, oldData: sanitize(oldRecord), newData: sanitize(req) });
      return { data: req };
    } catch (err) {
      return reply.code(400).send({ error: 'Validation Error' });
    }
  });

  // DELETE /api/v1/staffing-requests/:id
  server.delete('/api/v1/staffing-requests/:id', { preValidation: [server.authenticate, requireRole('ADMIN', 'PLANNER')] }, async (request, reply) => {
    const id = parseIdParam(request, reply);
    try {
      const sc = extractFullScope(request);
      const existing = await prisma.staffingRequest.findUnique({ where: { id } });
      
      if (!existing) {
        return reply.code(404).send({ error: 'Nie znaleziono.' });
      }
      
      if (!sc.isSuperAdmin && existing.instituteId !== sc.instituteId) {
        return reply.code(403).send({ error: 'Brak uprawnień do usunięcia tego zgłoszenia.' });
      }

      const oldRecord = await prisma.staffingRequest.findUnique({ where: { id } });
      await prisma.staffingRequest.delete({ where: { id } });
      const ctx = extractAuditContext(request);
      await audit(ctx, { action: 'DELETE', entityType: 'StaffingRequest', entityId: id, oldData: sanitize(oldRecord) });
      return reply.send({ success: true });
    } catch {
      return reply.code(400).send({ error: 'Cannot delete request' });
    }
  });
}
