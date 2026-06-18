import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import majorsRoutes from './majors';
import { authHeaders, buildRouteTestServer, TEST_IDS, type TestUser } from '../test/routeTestUtils';

const prismaMock = vi.hoisted(() => ({
  major: {
    findUnique: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../lib/prisma', () => ({
  prisma: prismaMock,
}));

describe('majors routes', () => {
  let server: FastifyInstance;

  const adminUser: TestUser = {
    id: TEST_IDS.adminUser,
    role: 'ADMIN',
    email: 'admin@test.local',
    instituteId: TEST_IDS.instituteA,
  };

  const deanUser: TestUser = {
    id: TEST_IDS.deanUser,
    role: 'DEAN',
    email: 'dean@test.local',
    facultyId: TEST_IDS.facultyA,
  };

  beforeAll(async () => {
    server = await buildRouteTestServer(majorsRoutes);
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a major in the authenticated admin institute scope', async () => {
    prismaMock.major.findUnique.mockResolvedValue(null);
    prismaMock.major.create.mockResolvedValue({
      id: TEST_IDS.majorA,
      code: 'ROM-BA',
      name: 'Filologia romanska',
      degree: 'licencjackie',
      years: 3,
      instituteId: TEST_IDS.instituteA,
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/majors',
      headers: authHeaders(adminUser),
      payload: {
        code: 'ROM-BA',
        name: 'Filologia romanska',
        degree: 'licencjackie',
        years: 3,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(prismaMock.major.create).toHaveBeenCalledWith({
      data: {
        code: 'ROM-BA',
        name: 'Filologia romanska',
        degree: 'licencjackie',
        years: 3,
        instituteId: TEST_IDS.instituteA,
      },
    });
  });

  it('rejects dean access to major creation', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/majors',
      headers: authHeaders(deanUser),
      payload: {
        code: 'ROM-MA',
        name: 'Filologia romanska II stopnia',
        degree: 'magisterskie',
        years: 2,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(prismaMock.major.create).not.toHaveBeenCalled();
  });

  it('blocks updating a major outside the admin scope', async () => {
    prismaMock.major.findFirst.mockResolvedValue(null);

    const response = await server.inject({
      method: 'PUT',
      url: `/api/v1/majors/${TEST_IDS.majorA}`,
      headers: authHeaders(adminUser),
      payload: {
        code: 'ROM-BA',
        name: 'Filologia romanska',
        degree: 'licencjackie',
        years: 3,
      },
    });

    expect(response.statusCode).toBe(404);
    expect(prismaMock.major.update).not.toHaveBeenCalled();
  });
});
