import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import deanRoutes from './dean';
import { authHeaders, buildRouteTestServer, TEST_IDS, type TestUser } from '../test/routeTestUtils';

const prismaMock = vi.hoisted(() => ({
  user: {
    findMany: vi.fn(),
  },
  institute: {
    count: vi.fn(),
  },
  teacher: {
    count: vi.fn(),
  },
  course: {
    count: vi.fn(),
  },
  courseAllocation: {
    count: vi.fn(),
  },
  major: {
    count: vi.fn(),
  },
  group: {
    count: vi.fn(),
  },
  room: {
    count: vi.fn(),
  },
  semester: {
    findMany: vi.fn(),
  },
}));

vi.mock('../lib/prisma', () => ({
  prisma: prismaMock,
}));

describe('dean routes', () => {
  let server: FastifyInstance;

  const deanUser: TestUser = {
    id: TEST_IDS.deanUser,
    role: 'DEAN',
    email: 'dean@test.local',
    facultyId: TEST_IDS.facultyA,
  };

  const deanWithoutFaculty: TestUser = {
    id: TEST_IDS.deanUser,
    role: 'DEAN',
    email: 'dean@test.local',
    facultyId: null,
  };

  beforeAll(async () => {
    server = await buildRouteTestServer(deanRoutes);
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects dean dashboard access when dean has no faculty assigned', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/dean/dashboard',
      headers: authHeaders(deanWithoutFaculty),
    });

    expect(response.statusCode).toBe(403);
    expect(prismaMock.institute.count).not.toHaveBeenCalled();
  });

  it('lists users scoped to dean faculty and annotates activity status', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: TEST_IDS.userA,
        name: 'Anna Planner',
        email: 'anna@test.local',
        role: 'PLANNER',
        institute: { name: 'Instytut A', shortCode: 'IA' },
        lastLoginAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        createdAt: new Date('2026-01-10T10:00:00.000Z'),
        facultyId: TEST_IDS.facultyA,
      },
    ]);

    const response = await server.inject({
      method: 'GET',
      url: `/api/v1/dean/users?role=PLANNER&instituteId=${TEST_IDS.instituteA}`,
      headers: authHeaders(deanUser),
    });

    expect(response.statusCode).toBe(200);
    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: {
        institute: { facultyId: TEST_IDS.facultyA },
        role: 'PLANNER',
        instituteId: TEST_IDS.instituteA,
      },
      include: {
        institute: { select: { name: true, shortCode: true } },
      },
      orderBy: { name: 'asc' },
    });

    const body = response.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      id: TEST_IDS.userA,
      name: 'Anna Planner',
      role: 'PLANNER',
      institute: 'Instytut A',
      shortCode: 'IA',
      activityStatus: 'active',
      facultyId: TEST_IDS.facultyA,
    });
  });

  it('blocks dean from using dean write endpoint that is reserved for super admin', async () => {
    const response = await server.inject({
      method: 'POST',
      url: `/api/v1/dean/users/${TEST_IDS.userA}/reset-password`,
      headers: authHeaders(deanUser),
      payload: {
        newPassword: 'Nowe!Haslo12',
      },
    });

    expect(response.statusCode).toBe(403);
  });
});
