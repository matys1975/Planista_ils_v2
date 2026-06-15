import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { requireRole, extractFullScope, buildTeacherInstituteWhere } from '../lib/rbac';
import { parseIdParam } from '../lib/params';
import { entrySchema, createEntry, updateEntry } from '../services/entryService';

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

      const formattedEntry = await createEntry(payload);
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

      const formattedEntry = await updateEntry(id, payload);
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
      await prisma.scheduleEntry.delete({ where: { id } });
      return reply.send({ success: true });
    } catch {
      return reply.code(400).send({ error: 'Nie udało się skasować wpisu planu.' });
    }
  });
}
