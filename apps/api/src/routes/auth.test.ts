import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import authRoutes from './auth';
import { TEST_IDS } from '../test/routeTestUtils';

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

const bcryptMock = vi.hoisted(() => ({
  compare: vi.fn(),
}));

vi.mock('../lib/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('bcrypt', () => ({
  default: bcryptMock,
}));

describe('auth routes', () => {
  let server: FastifyInstance;
  let jwtSignMock: ReturnType<typeof vi.fn>;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalCookieSecure = process.env.COOKIE_SECURE;

  beforeAll(async () => {
    server = Fastify();
    await server.register(cookie);

    jwtSignMock = vi.fn(() => 'signed-jwt-token');
    server.decorate('jwt', { sign: jwtSignMock });
    server.decorateRequest('user', null);
    server.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
      const rawUser = request.headers['x-test-user'];
      if (!rawUser || Array.isArray(rawUser)) {
        reply.code(401).send({ error: 'Unauthorized' });
        return;
      }
      (request as FastifyRequest & { user: unknown }).user = JSON.parse(rawUser);
    });

    await server.register(authRoutes);
    await server.ready();
  });

  afterAll(async () => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalCookieSecure === undefined) {
      delete process.env.COOKIE_SECURE;
    } else {
      process.env.COOKIE_SECURE = originalCookieSecure;
    }
    await server.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
    delete process.env.COOKIE_SECURE;
  });

  it('logs in successfully and returns mustChangePassword state', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: TEST_IDS.userA,
      email: 'planner@test.local',
      name: 'Planner',
      role: 'PLANNER',
      instituteId: TEST_IDS.instituteA,
      facultyId: null,
      passwordHash: 'stored-hash',
      mustChangePassword: true,
    });
    prismaMock.user.update.mockResolvedValue({});
    bcryptMock.compare.mockResolvedValue(true);

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'planner@test.local',
        password: 'Abcd!23456',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(jwtSignMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: TEST_IDS.userA,
        role: 'PLANNER',
        email: 'planner@test.local',
        instituteId: TEST_IDS.instituteA,
        mustChangePassword: true,
      }),
      { expiresIn: '7d' }
    );
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: TEST_IDS.userA },
      data: { lastLoginAt: expect.any(Date) },
    });

    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.mustChangePassword).toBe(true);

    const setCookie = response.headers['set-cookie'];
    expect(setCookie).toContain('token=signed-jwt-token');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).not.toContain('Secure');
  });

  it('rejects invalid credentials', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: TEST_IDS.userA,
      email: 'planner@test.local',
      passwordHash: 'stored-hash',
    });
    bcryptMock.compare.mockResolvedValue(false);

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'planner@test.local',
        password: 'wrong-password',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(jwtSignMock).not.toHaveBeenCalled();
  });

  it('sets Secure cookie when proxy indicates https in production', async () => {
    process.env.NODE_ENV = 'production';
    prismaMock.user.findUnique.mockResolvedValue({
      id: TEST_IDS.userA,
      email: 'secure@test.local',
      name: 'Secure User',
      role: 'ADMIN',
      instituteId: TEST_IDS.instituteA,
      facultyId: null,
      passwordHash: 'stored-hash',
      mustChangePassword: false,
    });
    prismaMock.user.update.mockResolvedValue({});
    bcryptMock.compare.mockResolvedValue(true);

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: {
        'x-forwarded-proto': 'https',
      },
      payload: {
        email: 'secure@test.local',
        password: 'Abcd!23456',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['set-cookie']).toContain('Secure');
  });

  it('clears cookie on logout', async () => {
    process.env.COOKIE_SECURE = 'true';

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['set-cookie']).toContain('token=');
    expect(response.headers['set-cookie']).toContain('Max-Age=0');
    expect(response.headers['set-cookie']).toContain('Secure');
  });

  it('returns authenticated user profile with mustChangePassword flag', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: TEST_IDS.userA,
      name: 'Planner',
      email: 'planner@test.local',
      role: 'PLANNER',
      instituteId: TEST_IDS.instituteA,
      facultyId: null,
      mustChangePassword: true,
    });

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        'x-test-user': JSON.stringify({
          id: TEST_IDS.userA,
          role: 'PLANNER',
          email: 'planner@test.local',
        }),
      },
    });

    expect(response.statusCode).toBe(200);
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: TEST_IDS.userA },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        instituteId: true,
        facultyId: true,
        mustChangePassword: true,
      },
    });
    expect(response.json()).toEqual({
      user: {
        id: TEST_IDS.userA,
        name: 'Planner',
        email: 'planner@test.local',
        role: 'PLANNER',
        instituteId: TEST_IDS.instituteA,
        facultyId: null,
        mustChangePassword: true,
      },
    });
  });
});
