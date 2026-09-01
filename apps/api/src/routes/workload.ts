import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { requireRole, extractFullScope, buildTeacherWhere } from '../lib/rbac';
import { calculateAllWorkloads } from '../services/workloadService';

export default async function workloadRoutes(server: FastifyInstance) {
  server.get('/api/v1/workload', { preValidation: [server.authenticate] }, async (request, reply) => {
    const { semesterId } = request.query as { semesterId?: string };
    const scope = extractFullScope(request);

    if (!semesterId) {
      return reply.code(400).send({ error: 'Brak wymaganego semesterId' });
    }

    const whereClause = buildTeacherWhere(scope);

    // 1. Pobieramy wszystkich pracowników (z uwzględnieniem izolacji wydziałowej i UCP)
    const teachers = await prisma.teacher.findMany({
      where: whereClause,
      orderBy: { lastName: 'asc' }
    });

    // 2. Pobieramy wpisy do planu w tym semestrze powiązane z tymi pracownikami
    const entryWhere: any = { semesterId };
    if (scope.isSuperAdmin) {
      if (scope.instituteId) {
        entryWhere.teacher = { instituteId: scope.instituteId };
      }
    } else if (scope.facultyId) {
      entryWhere.teacher = { institute: { facultyId: scope.facultyId } };
    } else if (scope.instituteId) {
      entryWhere.OR = [
        { teacher: { instituteId: scope.instituteId } },
        { teacher: { institute: { shortCode: 'UCP' } } },
        { teacher: { institute: { shortCode: 'OKPKN' } } }
      ];
    }

    const entries = await prisma.scheduleEntry.findMany({
      where: entryWhere,
      include: {
        course: true,
        teacher: true,
        room: true,
        groups: {
          include: { group: true }
        }
      }
    });

    // Wzbogać entries o effectiveType z zapisanego we wpisie classType
    const enrichedEntries = entries.map((e: any) => ({
      ...e,
      effectiveType: e.classType || e.course.type,
    }));

    const workloadData = calculateAllWorkloads(teachers, enrichedEntries);

    return { data: workloadData };
  });
}
