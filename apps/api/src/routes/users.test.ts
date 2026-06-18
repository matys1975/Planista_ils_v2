import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import usersRoutes from './users';
import { authHeaders, buildRouteTestServer, TEST_IDS, type TestUser } from '../test/routeTestUtils';

const prismaMock = vi.hoisted(() => ({
  user: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
}));

const bcryptMock = vi.hoisted(() => ({
  hash: vi.fn(),
  compare: vi.fn(),
}));

vi.mock('../lib/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('bcrypt', () => ({
  default: bcryptMock,
}));

describe('users routes', () => {
  let server: FastifyInstance;

  const adminUser: TestUser = {
    id: TEST_IDS.adminUser,
    role: 'ADMIN',
    email: 'admin@test.local',
    instituteId: TEST_IDS.instituteA,
  };

  const superAdminUser: TestUser = {
    id: TEST_IDS.superAdminUser,
    role: 'SUPER_ADMIN',
    email: 'superadmin@test.local',
  };

  beforeAll(async () => {
    server = await buildRouteTestServer(usersRoutes);
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    bcryptMock.hash.mockResolvedValue('hashed-value');
  });

  it('blocks admin from creating a super admin', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: authHeaders(adminUser),
      payload: {
        email: 'new.superadmin@test.local',
        password: 'Abcd!23456',
        name: 'Nowy Super Admin',
        role: 'SUPER_ADMIN',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it('creates a scoped user with mustChangePassword enabled', async () => {
    prismaMock.user.create.mockResolvedValue({
      id: TEST_IDS.userA,
      email: 'planner@test.local',
      name: 'Planner',
      role: 'PLANNER',
      instituteId: TEST_IDS.instituteA,
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: authHeaders(adminUser),
      payload: {
        email: 'planner@test.local',
        password: 'Abcd!23456',
        name: 'Planner',
        role: 'PLANNER',
        instituteId: TEST_IDS.instituteB,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: {
        email: 'planner@test.local',
        name: 'Planner',
        role: 'PLANNER',
        passwordHash: 'hashed-value',
        mustChangePassword: true,
        instituteId: TEST_IDS.instituteA,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        instituteId: true,
        createdAt: true,
      },
    });
  });

  it('marks mustChangePassword after admin password reset', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: TEST_IDS.userA,
      instituteId: TEST_IDS.instituteA,
    });
    prismaMock.user.update.mockResolvedValue({
      id: TEST_IDS.userA,
      email: 'viewer@test.local',
      name: 'Viewer',
      role: 'VIEWER',
      instituteId: TEST_IDS.instituteA,
    });

    const response = await server.inject({
      method: 'PUT',
      url: `/api/v1/users/${TEST_IDS.userA}`,
      headers: authHeaders(adminUser),
      payload: {
        newPassword: 'Xyz!987654',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: TEST_IDS.userA },
      data: {
        passwordHash: 'hashed-value',
        mustChangePassword: true,
      },
      select: { id: true, email: true, name: true, role: true, instituteId: true },
    });
  });

  it('requires current password before profile password change', async () => {
    const response = await server.inject({
      method: 'PUT',
      url: '/api/v1/auth/profile',
      headers: authHeaders(superAdminUser),
      payload: {
        newPassword: 'Nowe!Haslo12',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});
