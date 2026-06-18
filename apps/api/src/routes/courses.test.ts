import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import coursesRoutes from './courses';
import { authHeaders, buildRouteTestServer, TEST_IDS, type TestUser } from '../test/routeTestUtils';

const prismaMock = vi.hoisted(() => ({
  course: {
    findFirst: vi.fn(),
  },
  institute: {
    findUnique: vi.fn(),
  },
  teacher: {
    findFirst: vi.fn(),
  },
  group: {
    count: vi.fn(),
  },
  courseAllocation: {
    findFirst: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../lib/prisma', () => ({
  prisma: prismaMock,
}));

describe('courses routes', () => {
  let server: FastifyInstance;

  const adminUser: TestUser = {
    id: TEST_IDS.adminUser,
    role: 'ADMIN',
    email: 'admin@test.local',
    instituteId: TEST_IDS.instituteA,
  };

  beforeAll(async () => {
    server = await buildRouteTestServer(coursesRoutes);
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an allocation only within accessible resources', async () => {
    prismaMock.course.findFirst.mockResolvedValue({
      id: TEST_IDS.courseA,
      instituteId: TEST_IDS.instituteA,
    });
    prismaMock.institute.findUnique.mockResolvedValue({ facultyId: TEST_IDS.facultyA });
    prismaMock.teacher.findFirst.mockResolvedValue({ id: TEST_IDS.teacherA });
    prismaMock.group.count.mockResolvedValue(1);
    prismaMock.courseAllocation.create.mockResolvedValue({
      id: TEST_IDS.allocationA,
      teacher: { id: TEST_IDS.teacherA },
      groups: [],
    });

    const response = await server.inject({
      method: 'POST',
      url: `/api/v1/courses/${TEST_IDS.courseA}/allocations`,
      headers: authHeaders(adminUser),
      payload: {
        teacherId: TEST_IDS.teacherA,
        groupIds: [TEST_IDS.groupA],
        assignedHours: 30,
        classType: 'C',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(prismaMock.courseAllocation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          courseId: TEST_IDS.courseA,
          teacherId: TEST_IDS.teacherA,
          instituteId: TEST_IDS.instituteA,
        }),
      })
    );
  });

  it('rejects allocation creation for a foreign teacher', async () => {
    prismaMock.course.findFirst.mockResolvedValue({
      id: TEST_IDS.courseA,
      instituteId: TEST_IDS.instituteA,
    });
    prismaMock.institute.findUnique.mockResolvedValue({ facultyId: TEST_IDS.facultyA });
    prismaMock.teacher.findFirst.mockResolvedValue(null);

    const response = await server.inject({
      method: 'POST',
      url: `/api/v1/courses/${TEST_IDS.courseA}/allocations`,
      headers: authHeaders(adminUser),
      payload: {
        teacherId: TEST_IDS.teacherB,
        groupIds: [],
        assignedHours: 15,
        classType: 'L',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(prismaMock.courseAllocation.create).not.toHaveBeenCalled();
  });

  it('blocks deleting an allocation outside the current scope', async () => {
    prismaMock.courseAllocation.findFirst.mockResolvedValue(null);

    const response = await server.inject({
      method: 'DELETE',
      url: `/api/v1/courses/allocations/${TEST_IDS.allocationA}`,
      headers: authHeaders(adminUser),
    });

    expect(response.statusCode).toBe(404);
    expect(prismaMock.courseAllocation.delete).not.toHaveBeenCalled();
  });
});
