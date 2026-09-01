import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { requireRole, extractFullScope } from '../lib/rbac';
import z from 'zod';

const auditQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
  dateFrom: z.string().optional(), // ISO 8601
  dateTo: z.string().optional(),   // ISO 8601
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
});

export default async function auditLogRoutes(server: FastifyInstance) {
  // ═══════════════════════════════════════════════════════════════════
  // AUDIT LOG — Lista z filtrowaniem i paginacją
  // ═══════════════════════════════════════════════════════════════════
  server.get('/api/v1/audit', {
    preValidation: [server.authenticate, requireRole('ADMIN', 'DEAN')]
  }, async (request, reply) => {
    try {
      const query = auditQuerySchema.parse(request.query);
      const scope = extractFullScope(request);

      // Buduj WHERE clause
      const where: any = {};

      // Scoping: SUPER_ADMIN widzi wszystko, DEAN widzi wydział, ADMIN widzi instytut
      if (!scope.isSuperAdmin) {
        if (scope.facultyId) {
          // DEAN — pokaż logi użytkowników z instytutów wydziału
          const instituteIds = await prisma.institute.findMany({
            where: { facultyId: scope.facultyId },
            select: { id: true },
          });
          const userIds = await prisma.user.findMany({
            where: { instituteId: { in: instituteIds.map(i => i.id) } },
            select: { id: true },
          });
          where.userId = { in: userIds.map(u => u.id) };
        } else if (scope.instituteId) {
          // ADMIN — pokaż logi użytkowników z instytutu
          const userIds = await prisma.user.findMany({
            where: { instituteId: scope.instituteId },
            select: { id: true },
          });
          where.userId = { in: userIds.map(u => u.id) };
        }
      }

      // Filtry
      if (query.userId) where.userId = query.userId;
      if (query.action) where.action = query.action;
      if (query.entityType) where.entityType = query.entityType;
      if (query.entityId) where.entityId = query.entityId;

      if (query.dateFrom || query.dateTo) {
        where.timestamp = {};
        if (query.dateFrom) where.timestamp.gte = new Date(query.dateFrom);
        if (query.dateTo) where.timestamp.lte = new Date(query.dateTo);
      }

      if (query.search) {
        where.OR = [
          { userEmail: { contains: query.search, mode: 'insensitive' } },
          { entityType: { contains: query.search, mode: 'insensitive' } },
          { action: { contains: query.search, mode: 'insensitive' } },
        ];
      }

      const skip = (query.page - 1) * query.limit;

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          skip,
          take: query.limit,
        }),
        prisma.auditLog.count({ where }),
      ]);

      return {
        data: logs,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      };
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Nieprawidłowe parametry', details: err.errors });
      }
      server.log.error(err, 'Audit log query error');
      return reply.code(500).send({ error: 'Błąd wewnętrzny' });
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // AUDIT LOG — Historia konkretnego obiektu
  // ═══════════════════════════════════════════════════════════════════
  server.get('/api/v1/audit/:entityType/:entityId', {
    preValidation: [server.authenticate, requireRole('ADMIN', 'DEAN')]
  }, async (request, reply) => {
    const { entityType, entityId } = request.params as { entityType: string; entityId: string };
    const { page = '1', limit = '20' } = request.query as { page?: string; limit?: string };
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { entityType, entityId },
        orderBy: { timestamp: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.auditLog.count({ where: { entityType, entityId } }),
    ]);

    return {
      data: logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  });

  // ═══════════════════════════════════════════════════════════════════
  // AUDIT LOG — Dostępne wartości filtrów (dla dropdownów w UI)
  // ═══════════════════════════════════════════════════════════════════
  server.get('/api/v1/audit/filters', {
    preValidation: [server.authenticate, requireRole('ADMIN', 'DEAN')]
  }, async () => {
    const [actions, entityTypes] = await Promise.all([
      prisma.auditLog.findMany({ select: { action: true }, distinct: ['action'], orderBy: { action: 'asc' } }),
      prisma.auditLog.findMany({ select: { entityType: true }, distinct: ['entityType'], orderBy: { entityType: 'asc' } }),
    ]);

    return {
      data: {
        actions: actions.map(a => a.action),
        entityTypes: entityTypes.map(e => e.entityType).filter(Boolean),
      },
    };
  });

  // ═══════════════════════════════════════════════════════════════════
  // AUDIT LOG — Eksport CSV
  // ═══════════════════════════════════════════════════════════════════
  server.get('/api/v1/audit/export', {
    preValidation: [server.authenticate, requireRole('ADMIN', 'DEAN')]
  }, async (request, reply) => {
    const { dateFrom, dateTo, action, entityType } = request.query as {
      dateFrom?: string;
      dateTo?: string;
      action?: string;
      entityType?: string;
    };

    const where: any = {};
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (dateFrom || dateTo) {
      where.timestamp = {};
      if (dateFrom) where.timestamp.gte = new Date(dateFrom);
      if (dateTo) where.timestamp.lte = new Date(dateTo);
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 10000, // Safety limit
    });

    // CSV z BOM dla Excela
    const delimiter = ';';
    const headers = ['Timestamp', 'User', 'Action', 'EntityType', 'EntityId', 'IP', 'RequestId'];
    const rows = logs.map(log => [
      log.timestamp.toISOString(),
      log.userEmail || log.userId || '',
      log.action,
      log.entityType || '',
      log.entityId || '',
      log.ipAddress || '',
      log.requestId || '',
    ].map(val => {
      const str = String(val).replace(/"/g, '""');
      return str.includes(delimiter) || str.includes('\n') || str.includes('"') ? `"${str}"` : str;
    }).join(delimiter));

    const csv = [headers.join(delimiter), ...rows].join('\r\n');
    const filename = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`;

    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send('\uFEFF' + csv);
  });
}
