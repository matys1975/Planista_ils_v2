import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { requireRole, extractFullScope } from '../lib/rbac';
import { parseIdParam } from '../lib/params';
import z from 'zod';

const createStaffingRequestSchema = z.object({
  courseId: z.string().uuid(),
  requestedGroups: z.number().int().positive(),
  notes: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'RESOLVED', 'REJECTED']).optional(),
  adminNotes: z.string().optional(),
});

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
      const course = await prisma.course.findUnique({
        where: { id: payload.courseId },
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

      return reply.code(201).send({ data: newRequest });
    } catch (err) {
      return reply.code(400).send({ error: 'Validation Error' });
    }
  });

  // PATCH /api/v1/staffing-requests/:id/status
  server.patch('/api/v1/staffing-requests/:id/status', { preValidation: [server.authenticate, requireRole('SUPER_ADMIN', 'DEAN')] }, async (request, reply) => {
    const id = parseIdParam(request, reply);
    try {
      const payload = updateStatusSchema.parse(request.body);
      
      const req = await prisma.staffingRequest.update({
        where: { id },
        data: { 
          ...(payload.status && { status: payload.status }),
          ...(payload.adminNotes !== undefined && { adminNotes: payload.adminNotes })
        }
      });
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

      await prisma.staffingRequest.delete({ where: { id } });
      return reply.send({ success: true });
    } catch {
      return reply.code(400).send({ error: 'Cannot delete request' });
    }
  });
}
