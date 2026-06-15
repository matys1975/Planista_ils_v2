import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { extractFullScope, buildInstituteWhere, requireRole } from '../lib/rbac';
import { parseIdParam } from '../lib/params';

export default async function (server: FastifyInstance) {
  server.get('/api/v1/majors', { preValidation: [server.authenticate] }, async (request, reply) => {
    try {
      const scope = extractFullScope(request);
      const whereClause = buildInstituteWhere(scope);

      const majors = await prisma.major.findMany({
        where: whereClause,
        include: {
          institute: {
            select: { name: true, shortCode: true }
          },
          _count: {
            select: { courses: true }
          }
        },
        orderBy: { code: 'asc' }
      });
      return reply.send({ data: majors });
    } catch (err: any) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  const majorSchema = z.object({
    code: z.string().min(1, 'Kod kierunku jest wymagany'),
    name: z.string().min(1, 'Nazwa kierunku jest wymagana'),
    degree: z.string().min(1, 'Stopień studiów jest wymagany'),
    years: z.coerce.number().int().positive('Liczba lat musi być dodatnia'),
  });

  server.post('/api/v1/majors', { preValidation: [server.authenticate, requireRole('ADMIN')] }, async (request, reply) => {
    try {
      const payload = majorSchema.parse(request.body);
      const instituteId = extractFullScope(request).instituteId;

      const existing = await prisma.major.findUnique({ where: { code: payload.code } });
      if (existing) {
        return reply.code(400).send({ error: 'Kierunek o podanym kodzie już istnieje.' });
      }

      const major = await prisma.major.create({
        data: {
          ...payload,
          ...(instituteId ? { instituteId } : {}),
        }
      });
      return reply.code(201).send({ data: major });
    } catch (err) {
      return reply.code(400).send({ error: 'Validation Error', details: err instanceof z.ZodError ? err.errors : undefined });
    }
  });

  server.put('/api/v1/majors/:id', { preValidation: [server.authenticate, requireRole('ADMIN')] }, async (request, reply) => {
    const id = parseIdParam(request, reply);
    try {
      const payload = majorSchema.parse(request.body);
      const instituteId = extractFullScope(request).instituteId;
      const major = await prisma.major.update({
        where: { id },
        data: {
          ...payload,
          ...(instituteId ? { instituteId } : {}),
        }
      });
      return reply.send({ data: major });
    } catch (err) {
      return reply.code(400).send({ error: 'Validation Error', details: err instanceof z.ZodError ? err.errors : undefined });
    }
  });

  server.delete('/api/v1/majors/:id', { preValidation: [server.authenticate, requireRole('ADMIN')] }, async (request, reply) => {
    const id = parseIdParam(request, reply);
    try {
      await prisma.major.delete({ where: { id } });
      return reply.send({ success: true });
    } catch (err) {
      return reply.code(400).send({ error: 'Could not delete major.', details: err instanceof Error ? err.message : undefined });
    }
  });
}
