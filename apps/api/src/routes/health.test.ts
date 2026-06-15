import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify from 'fastify';

/**
 * Mock Prisma — test nie wymaga połączenia z bazą danych.
 * Dzięki temu pre-commit hook przechodzi lokalnie (poza Dockerem).
 */
const mockQueryRaw = vi.fn();
vi.mock('../lib/prisma', () => ({
  prisma: { $queryRaw: (...args: unknown[]) => mockQueryRaw(...args) },
}));

// Import PO mocku — tak wymaga vitest
import { prisma } from '../lib/prisma';

describe('Health Route', () => {
  let server: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    server = Fastify();
    server.get('/api/v1/health', async (_request, reply) => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        return { status: 'ok', database: 'connected', timestamp: new Date().toISOString() };
      } catch {
        return reply.code(503).send({
          status: 'error', database: 'disconnected', timestamp: new Date().toISOString(),
        });
      }
    });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  it('should return status ok when database is connected', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.status).toBe('ok');
    expect(body.database).toBe('connected');
    expect(body.timestamp).toBeDefined();
  });

  it('should return 503 when database is disconnected', async () => {
    mockQueryRaw.mockRejectedValueOnce(new Error('Connection refused'));

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/health',
    });

    expect(response.statusCode).toBe(503);
    const body = JSON.parse(response.payload);
    expect(body.status).toBe('error');
    expect(body.database).toBe('disconnected');
  });
});
