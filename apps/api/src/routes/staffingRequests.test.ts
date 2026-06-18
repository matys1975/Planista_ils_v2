import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import staffingRequestsRoutes from './staffingRequests';
import { authHeaders, buildRouteTestServer, TEST_IDS, type TestUser } from '../test/routeTestUtils';

const prismaMock = vi.hoisted(() => ({
  course: {
    findFirst: vi.fn(),
  },
  staffingRequest: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../lib/prisma', () => ({
  prisma: prismaMock,
}));

describe('staffing requests routes', () => {
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
    server = await buildRouteTestServer(staffingRequestsRoutes);
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a staffing request only for a course in the current institute', async () => {
    prismaMock.course.findFirst.mockResolvedValue({
      id: TEST_IDS.courseA,
      semesterId: TEST_IDS.semesterA,
    });
    prismaMock.staffingRequest.create.mockResolvedValue({
      id: TEST_IDS.staffingRequestA,
      instituteId: TEST_IDS.instituteA,
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/staffing-requests',
      headers: authHeaders(adminUser),
      payload: {
        courseId: TEST_IDS.courseA,
        requestedGroups: 2,
        notes: 'Potrzebny drugi prowadzacy',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(prismaMock.staffingRequest.create).toHaveBeenCalledWith({
      data: {
        requestedGroups: 2,
        notes: 'Potrzebny drugi prowadzacy',
        courseId: TEST_IDS.courseA,
        semesterId: TEST_IDS.semesterA,
        instituteId: TEST_IDS.instituteA,
        status: 'PENDING',
      },
    });
  });

  it('blocks status update when request is outside dean faculty scope', async () => {
    prismaMock.staffingRequest.findFirst.mockResolvedValue(null);

    const response = await server.inject({
      method: 'PATCH',
      url: `/api/v1/staffing-requests/${TEST_IDS.staffingRequestA}/status`,
      headers: authHeaders(deanUser),
      payload: {
        status: 'RESOLVED',
        adminNotes: 'Zamkniete',
      },
    });

    expect(response.statusCode).toBe(404);
    expect(prismaMock.staffingRequest.update).not.toHaveBeenCalled();
  });

  it('prevents deleting a request from another institute', async () => {
    prismaMock.staffingRequest.findUnique.mockResolvedValue({
      id: TEST_IDS.staffingRequestA,
      instituteId: TEST_IDS.instituteB,
    });

    const response = await server.inject({
      method: 'DELETE',
      url: `/api/v1/staffing-requests/${TEST_IDS.staffingRequestA}`,
      headers: authHeaders(adminUser),
    });

    expect(response.statusCode).toBe(403);
    expect(prismaMock.staffingRequest.delete).not.toHaveBeenCalled();
  });
});
