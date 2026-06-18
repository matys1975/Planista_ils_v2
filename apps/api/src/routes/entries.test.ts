import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import entriesRoutes from './entries';
import { authHeaders, buildRouteTestServer, TEST_IDS, type TestUser } from '../test/routeTestUtils';

const prismaMock = vi.hoisted(() => ({
  course: {
    findFirst: vi.fn(),
  },
  teacher: {
    findFirst: vi.fn(),
  },
  room: {
    findFirst: vi.fn(),
  },
  group: {
    count: vi.fn(),
  },
  scheduleEntry: {
    findFirst: vi.fn(),
    delete: vi.fn(),
  },
}));

const entryServiceMock = vi.hoisted(() => ({
  createEntry: vi.fn(),
  updateEntry: vi.fn(),
}));

vi.mock('../lib/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('../services/entryService', async () => {
  const actual = await vi.importActual<typeof import('../services/entryService')>('../services/entryService');
  return {
    ...actual,
    createEntry: entryServiceMock.createEntry,
    updateEntry: entryServiceMock.updateEntry,
  };
});

describe('entries routes', () => {
  let server: FastifyInstance;

  const plannerUser: TestUser = {
    id: TEST_IDS.plannerUser,
    role: 'PLANNER',
    email: 'planner@test.local',
    instituteId: TEST_IDS.instituteA,
  };

  const createPayload = {
    semesterId: TEST_IDS.semesterA,
    courseId: TEST_IDS.courseA,
    teacherId: TEST_IDS.teacherA,
    roomId: TEST_IDS.roomA,
    groupIds: [TEST_IDS.groupA],
    startTime: '08:00',
    endTime: '09:30',
    dayOfWeek: 1,
    weekType: 'AB',
    classType: 'C',
  };

  beforeAll(async () => {
    server = await buildRouteTestServer(entriesRoutes);
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an entry with institute scope inherited from the course', async () => {
    prismaMock.course.findFirst.mockResolvedValue({
      id: TEST_IDS.courseA,
      instituteId: TEST_IDS.instituteA,
    });
    prismaMock.teacher.findFirst.mockResolvedValue({ id: TEST_IDS.teacherA });
    prismaMock.room.findFirst.mockResolvedValue({ id: TEST_IDS.roomA });
    prismaMock.group.count.mockResolvedValue(1);
    entryServiceMock.createEntry.mockResolvedValue({ id: TEST_IDS.entryA });

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/entries',
      headers: authHeaders(plannerUser),
      payload: createPayload,
    });

    expect(response.statusCode).toBe(201);
    expect(entryServiceMock.createEntry).toHaveBeenCalledWith(createPayload, TEST_IDS.instituteA);
  });

  it('rejects entry creation when the room is outside the current scope', async () => {
    prismaMock.course.findFirst.mockResolvedValue({
      id: TEST_IDS.courseA,
      instituteId: TEST_IDS.instituteA,
    });
    prismaMock.teacher.findFirst.mockResolvedValue({ id: TEST_IDS.teacherA });
    prismaMock.room.findFirst.mockResolvedValue(null);

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/entries',
      headers: authHeaders(plannerUser),
      payload: createPayload,
    });

    expect(response.statusCode).toBe(403);
    expect(entryServiceMock.createEntry).not.toHaveBeenCalled();
  });

  it('blocks deleting an entry outside the current scope', async () => {
    prismaMock.scheduleEntry.findFirst.mockResolvedValue(null);

    const response = await server.inject({
      method: 'DELETE',
      url: `/api/v1/entries/${TEST_IDS.entryA}`,
      headers: authHeaders(plannerUser),
    });

    expect(response.statusCode).toBe(404);
    expect(prismaMock.scheduleEntry.delete).not.toHaveBeenCalled();
  });
});
