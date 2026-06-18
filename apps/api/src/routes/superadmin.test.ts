import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import superadminRoutes from './superadmin';
import { authHeaders, buildRouteTestServer, TEST_IDS, type TestUser } from '../test/routeTestUtils';

const prismaMock = vi.hoisted(() => ({
  institute: {
    findUnique: vi.fn(),
  },
  teacher: {
    findUnique: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

const bcryptMock = vi.hoisted(() => ({
  hash: vi.fn(),
}));

const cryptoMock = vi.hoisted(() => ({
  randomBytes: vi.fn(),
}));

vi.mock('../lib/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('bcrypt', () => ({
  default: bcryptMock,
}));

vi.mock('crypto', () => ({
  default: cryptoMock,
}));

describe('superadmin routes', () => {
  let server: FastifyInstance;

  const superAdminUser: TestUser = {
    id: TEST_IDS.superAdminUser,
    role: 'SUPER_ADMIN',
    email: 'superadmin@test.local',
  };

  beforeAll(async () => {
    server = await buildRouteTestServer(superadminRoutes);
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    bcryptMock.hash.mockResolvedValue('hashed-value');
    cryptoMock.randomBytes.mockReturnValue({
      toString: vi.fn(() => 'temp-pass-123'),
    });
  });

  it('creates admin account from teacher with temporary password and mustChangePassword', async () => {
    prismaMock.institute.findUnique.mockResolvedValue({
      id: TEST_IDS.instituteA,
      name: 'Instytut A',
    });
    prismaMock.teacher.findUnique.mockResolvedValue({
      id: TEST_IDS.teacherA,
      email: 'teacher@test.local',
      title: 'dr',
      firstName: 'Anna',
      lastName: 'Nowak',
    });
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.create.mockResolvedValue({
      id: TEST_IDS.userA,
      email: 'teacher@test.local',
      name: 'dr Anna Nowak',
      role: 'ADMIN',
      instituteId: TEST_IDS.instituteA,
      mustChangePassword: true,
    });

    const response = await server.inject({
      method: 'POST',
      url: `/api/v1/superadmin/institutes/${TEST_IDS.instituteA}/assign-admin`,
      headers: authHeaders(superAdminUser),
      payload: {
        teacherId: TEST_IDS.teacherA,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(cryptoMock.randomBytes).toHaveBeenCalledWith(12);
    expect(bcryptMock.hash).toHaveBeenCalledWith('temp-pass-123', 12);
    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: {
        email: 'teacher@test.local',
        name: 'dr Anna Nowak',
        passwordHash: 'hashed-value',
        role: 'ADMIN',
        instituteId: TEST_IDS.instituteA,
        mustChangePassword: true,
      },
    });
    expect(response.json()).toMatchObject({
      temporaryPassword: 'temp-pass-123',
      data: {
        id: TEST_IDS.userA,
        role: 'ADMIN',
        instituteId: TEST_IDS.instituteA,
      },
    });
  });

  it('promotes existing user to institute admin without creating duplicate account', async () => {
    prismaMock.institute.findUnique.mockResolvedValue({
      id: TEST_IDS.instituteA,
      name: 'Instytut A',
    });
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: TEST_IDS.userA,
      name: 'Existing Admin',
      email: 'existing@test.local',
      role: 'VIEWER',
      instituteId: TEST_IDS.instituteB,
    });
    prismaMock.user.update.mockResolvedValue({
      id: TEST_IDS.userA,
      name: 'Existing Admin',
      email: 'existing@test.local',
      role: 'ADMIN',
      instituteId: TEST_IDS.instituteA,
    });

    const response = await server.inject({
      method: 'POST',
      url: `/api/v1/superadmin/institutes/${TEST_IDS.instituteA}/assign-admin`,
      headers: authHeaders(superAdminUser),
      payload: {
        name: 'Existing Admin',
        email: 'existing@test.local',
        password: 'Abcd!23456',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: TEST_IDS.userA },
      data: { role: 'ADMIN', instituteId: TEST_IDS.instituteA },
    });
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it('resets password globally and forces password change', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: TEST_IDS.userA,
      email: 'reset@test.local',
    });
    prismaMock.user.update.mockResolvedValue({});

    const response = await server.inject({
      method: 'POST',
      url: `/api/v1/superadmin/users/${TEST_IDS.userA}/reset-password`,
      headers: authHeaders(superAdminUser),
      payload: {
        newPassword: 'Nowe!Haslo12',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(bcryptMock.hash).toHaveBeenCalledWith('Nowe!Haslo12', 12);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: TEST_IDS.userA },
      data: { passwordHash: 'hashed-value', mustChangePassword: true },
    });
  });

  it('demotes admin only when user belongs to the specified institute', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: TEST_IDS.userA,
      name: 'Admin User',
      instituteId: TEST_IDS.instituteA,
    });
    prismaMock.user.update.mockResolvedValue({
      id: TEST_IDS.userA,
      role: 'VIEWER',
    });

    const response = await server.inject({
      method: 'DELETE',
      url: `/api/v1/superadmin/institutes/${TEST_IDS.instituteA}/admins/${TEST_IDS.userA}`,
      headers: authHeaders(superAdminUser),
    });

    expect(response.statusCode).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: TEST_IDS.userA },
      data: { role: 'VIEWER' },
    });
  });
});
