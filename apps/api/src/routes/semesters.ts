import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { requireStrictRole } from '../lib/rbac';
import { parseIdParam } from '../lib/params';
import z from 'zod';
import type { Prisma } from '@plan/database';

const createSemesterSchema = z.object({
  name: z.string().min(1, 'Nazwa jest wymagana'),
  year: z.coerce.number().int().positive('Rok musi być dodatni'),
  type: z.enum(['zimowy', 'letni', 'Zimowy', 'Letni']).transform((val) => val.toLowerCase()),
  dateStart: z.coerce.date(),
  dateEnd: z.coerce.date(),
  isLocked: z.boolean().default(false).optional(),
});

const updateSemesterSchema = createSemesterSchema.partial();

export default async function semestersRoutes(server: FastifyInstance) {
  server.get('/api/v1/semesters', { preValidation: [server.authenticate] }, async (request, reply) => {
    const semesters = await prisma.semester.findMany({ 
      include: {
        _count: {
          select: { courses: true, groups: true, entries: true }
        }
      },
      orderBy: [
        { year: 'desc' },
        { dateStart: 'desc' }
      ] 
    });
    return { data: semesters };
  });

  server.post('/api/v1/semesters', { preValidation: [server.authenticate, requireStrictRole('SUPER_ADMIN')] }, async (request, reply) => {
    try {
      const payload = createSemesterSchema.parse(request.body);
      const semester = await prisma.semester.create({
        data: {
          name: payload.name,
          year: payload.year,
          type: payload.type,
          dateStart: payload.dateStart,
          dateEnd: payload.dateEnd,
          isLocked: payload.isLocked ?? false,
        },
      });
      return reply.code(201).send({ data: semester });
    } catch (err) {
      const zodErr = err instanceof z.ZodError ? err.errors : undefined;
      return reply.code(400).send({ error: 'Validation/Constraints Error', details: zodErr });
    }
  });

  server.put('/api/v1/semesters/:id', { preValidation: [server.authenticate, requireStrictRole('SUPER_ADMIN')] }, async (request, reply) => {
    const id = parseIdParam(request, reply);
    try {
      const payload = updateSemesterSchema.parse(request.body);
      
      const updateData: Prisma.SemesterUpdateInput = {};
      if (payload.name !== undefined) updateData.name = payload.name;
      if (payload.year !== undefined) updateData.year = payload.year;
      if (payload.type !== undefined) updateData.type = payload.type;
      if (payload.dateStart !== undefined) updateData.dateStart = payload.dateStart;
      if (payload.dateEnd !== undefined) updateData.dateEnd = payload.dateEnd;
      if (payload.isLocked !== undefined) updateData.isLocked = payload.isLocked;

      const semester = await prisma.semester.update({
        where: { id },
        data: updateData,
      });
      return reply.send({ data: semester });
    } catch (err) {
      return reply.code(400).send({ error: 'Validation/Constraints Error or Not Found' });
    }
  });

  server.delete('/api/v1/semesters/:id', { preValidation: [server.authenticate, requireStrictRole('SUPER_ADMIN')] }, async (request, reply) => {
    const id = parseIdParam(request, reply);
    try {
      // Check if there are dependent entries, though DB constraints should handle it
      await prisma.semester.delete({ where: { id } });
      return reply.send({ success: true });
    } catch {
      return reply.code(400).send({ error: 'Cannot delete semester - might have nested courses or groups' });
    }
  });
}
