import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { extractFullScope, SHARED_INSTITUTE_SHORT_CODES } from '../lib/rbac';

export default async function institutesRoutes(server: FastifyInstance) {
  server.get('/api/v1/institutes', { preValidation: [server.authenticate] }, async (request, reply) => {
    const sc = extractFullScope(request);

    let whereClause: any = {};

    if (!sc.isSuperAdmin) {
      if (sc.facultyId) {
        // Dean — see only institutes belonging to their faculty
        whereClause = { facultyId: sc.facultyId };
      } else if (sc.instituteId) {
        // Admin/Planner — see all institutes in their faculty + shared units (UCP, OKPKN, SJ UAM, Zlecenie, unassigned)
        const inst = await prisma.institute.findUnique({
          where: { id: sc.instituteId },
          select: { facultyId: true },
        });
        if (inst?.facultyId) {
          whereClause = {
            OR: [
              { facultyId: inst.facultyId },
              ...SHARED_INSTITUTE_SHORT_CODES.map(code => ({ shortCode: code })),
              { facultyId: null },
            ],
          };
        } else {
          whereClause = {};
        }
      } else {
        // No access fallback
        whereClause = { id: '__NO_ACCESS__' };
      }
    }

    const institutes = await prisma.institute.findMany({
      where: whereClause,
      include: {
        _count: {
          select: {
            users: true,
            courses: true,
            teachers: true,
            rooms: true,
            groups: true,
            majors: true,
            allocations: true,
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    return { data: institutes };
  });
}
