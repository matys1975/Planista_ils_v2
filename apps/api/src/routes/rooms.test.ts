import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import roomsRoutes from './rooms';
import { authHeaders, buildRouteTestServer, TEST_IDS, type TestUser } from '../test/routeTestUtils';

const prismaMock = vi.hoisted(() => ({
  institute: {
    findFirst: vi.fn(),
  },
  room: {
    create: vi.fn(),
    findFirst: vi.fn(),
  },
  scheduleEntry: {
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock('../lib/prisma', () => ({
  prisma: prismaMock,
}));

describe('rooms routes', () => {
  let server: FastifyInstance;

  const deanUser: TestUser = {
    id: TEST_IDS.deanUser,
    role: 'DEAN',
    email: 'dean@test.local',
    facultyId: TEST_IDS.facultyA,
  };

  const adminUser: TestUser = {
    id: TEST_IDS.adminUser,
    role: 'ADMIN',
    email: 'admin@test.local',
    instituteId: TEST_IDS.instituteA,
  };

  beforeAll(async () => {
    server = await buildRouteTestServer(roomsRoutes);
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires dean to explicitly choose institute when creating a room', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/rooms',
      headers: authHeaders(deanUser),
      payload: {
        building: 'A',
        number: '101',
        capacity: 30,
        type: 'cwiczeniowa',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(prismaMock.room.create).not.toHaveBeenCalled();
  });

  it('blocks dean from creating a room in another faculty institute', async () => {
    prismaMock.institute.findFirst.mockResolvedValue(null);

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/rooms',
      headers: authHeaders(deanUser),
      payload: {
        building: 'A',
        number: '102',
        capacity: 25,
        type: 'seminaryjna',
        instituteId: TEST_IDS.instituteB,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(prismaMock.room.create).not.toHaveBeenCalled();
  });

  it('stores admin-created room in admin institute scope when instituteId is omitted', async () => {
    prismaMock.room.create.mockResolvedValue({
      id: TEST_IDS.roomA,
      building: 'B',
      number: '12',
      instituteId: TEST_IDS.instituteA,
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/rooms',
      headers: authHeaders(adminUser),
      payload: {
        building: 'B',
        number: '12',
        capacity: 40,
        type: 'wykladowa',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(prismaMock.room.create).toHaveBeenCalledWith({
      data: {
        building: 'B',
        number: '12',
        capacity: 40,
        type: 'wykladowa',
        equipment: [],
        instituteId: TEST_IDS.instituteA,
      },
    });
  });
});
