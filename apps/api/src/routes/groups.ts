import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { requireRole, extractFullScope, buildInstituteWhere } from '../lib/rbac';
import { parseIdParam } from '../lib/params';
import z from 'zod';

const createGroupSchema = z.object({
  name: z.string().min(1, 'Nazwa grupy jest wymagana'),
  majorId: z.string().uuid('Nieprawidłowe ID kierunku').nullable().optional(),
  majorName: z.string().nullable().optional(),
  degree: z.string().min(1, 'Stopień studiów jest wymagany'),
  year: z.coerce.number().int().positive('Rok musi być dodatni'),
  size: z.coerce.number().int().positive('Rozmiar musi być dodatni'),
  semesterId: z.string().uuid('Nieprawidłowe ID semestru'),
});

const updateGroupSchema = createGroupSchema.partial();

export default async function groupsRoutes(server: FastifyInstance) {
  server.get('/api/v1/groups', { preValidation: [server.authenticate] }, async (request, reply) => {
    const scope = extractFullScope(request);
    const whereClause = buildInstituteWhere(scope);

    const groups = await prisma.group.findMany({
      where: whereClause,
      include: {
        semester: true,
        major: {
          select: { name: true, code: true }
        }
      },
      orderBy: [
        { majorId: 'asc' },
        { year: 'asc' },
        { name: 'asc' }
      ]
    });
    return { data: groups };
  });

  server.post('/api/v1/groups', { preValidation: [server.authenticate, requireRole('ADMIN', 'PLANNER')] }, async (request, reply) => {
    try {
      const scope = extractFullScope(request);
      const instituteId = scope.instituteId;
      const payload = createGroupSchema.parse(request.body);

      let majorName = payload.majorName;
      if (payload.majorId) {
        const major = await prisma.major.findFirst({ where: { id: payload.majorId, ...buildInstituteWhere(scope) } });
        if (!major) return reply.code(403).send({ error: 'Brak dostępu do wskazanego kierunku.' });
        if (major) {
          majorName = major.name;
        }
      }

      const group = await prisma.group.create({
        data: {
          ...payload,
          majorName,
          ...(instituteId ? { instituteId } : {}),
        },
      });
      return reply.code(201).send({ data: group });
    } catch (err: any) {
      return reply.code(400).send({ error: 'Validation/Constraints Error', details: err.errors });
    }
  });

  server.put('/api/v1/groups/:id', { preValidation: [server.authenticate, requireRole('ADMIN', 'PLANNER')] }, async (request, reply) => {
    const id = parseIdParam(request, reply);
    try {
      // Audyt #4: Weryfikuj przynależność do instytutu
      const instituteId = extractFullScope(request).instituteId;
      if (instituteId) {
        const target = await prisma.group.findFirst({ where: { id, instituteId } });
        if (!target) return reply.code(404).send({ error: 'Nie znaleziono grupy.' });
      }

      const payload = updateGroupSchema.parse(request.body);

      let majorName = payload.majorName;
      if (payload.majorId) {
        const scope = extractFullScope(request);
        const major = await prisma.major.findFirst({ where: { id: payload.majorId, ...buildInstituteWhere(scope) } });
        if (!major) return reply.code(403).send({ error: 'Brak dostępu do wskazanego kierunku.' });
        if (major) {
          majorName = major.name;
        }
      } else if (payload.majorId === null) {
        majorName = null;
      }

      const group = await prisma.group.update({
        where: { id },
        data: {
          ...payload,
          ...(majorName !== undefined ? { majorName } : {}),
        },
      });
      return reply.send({ data: group });
    } catch (err) {
      return reply.code(400).send({ error: 'Validation/Constraints Error or Not Found' });
    }
  });

  server.delete('/api/v1/groups/:id', { preValidation: [server.authenticate, requireRole('ADMIN')] }, async (request, reply) => {
    const id = parseIdParam(request, reply);
    try {
      // Audyt #4: Weryfikuj przynależność do instytutu
      const instituteId = extractFullScope(request).instituteId;
      if (instituteId) {
        const target = await prisma.group.findFirst({ where: { id, instituteId } });
        if (!target) return reply.code(404).send({ error: 'Nie znaleziono grupy.' });
      }

      await prisma.group.delete({ where: { id } });
      return reply.send({ success: true });
    } catch {
      return reply.code(400).send({ error: 'Cannot delete group - it might be used in schedule entries' });
    }
  });
}
