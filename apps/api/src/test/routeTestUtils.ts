import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export interface TestUser {
  id: string;
  role: string;
  email: string;
  instituteId?: string | null;
  facultyId?: string | null;
}

export const TEST_IDS = {
  instituteA: '11111111-1111-4111-8111-111111111111',
  instituteB: '22222222-2222-4222-8222-222222222222',
  facultyA: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  courseA: '33333333-3333-4333-8333-333333333333',
  teacherA: '44444444-4444-4444-8444-444444444444',
  teacherB: '55555555-5555-4555-8555-555555555555',
  roomA: '66666666-6666-4666-8666-666666666666',
  groupA: '77777777-7777-4777-8777-777777777777',
  majorA: '88888888-8888-4888-8888-888888888888',
  allocationA: '99999999-9999-4999-8999-999999999999',
  entryA: '12121212-1212-4121-8121-121212121212',
  semesterA: '13131313-1313-4131-8131-131313131313',
  adminUser: '14141414-1414-4141-8141-141414141414',
  deanUser: '15151515-1515-4151-8151-151515151515',
  plannerUser: '16161616-1616-4161-8161-161616161616',
  superAdminUser: '17171717-1717-4171-8171-171717171717',
  userA: '18181818-1818-4181-8181-181818181818',
  staffingRequestA: '19191919-1919-4191-8191-191919191919',
};

export function authHeaders(user?: TestUser) {
  return user ? { 'x-test-user': JSON.stringify(user) } : {};
}

export async function buildRouteTestServer(
  registerRoute: (server: FastifyInstance) => Promise<void>
) {
  const server = Fastify();

  server.decorateRequest('user', null);
  server.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    const rawUser = request.headers['x-test-user'];
    if (!rawUser || Array.isArray(rawUser)) {
      reply.code(401).send({ error: 'Unauthorized' });
      return;
    }

    (request as FastifyRequest & { user: TestUser }).user = JSON.parse(rawUser) as TestUser;
  });

  await server.register(registerRoute);
  await server.ready();

  return server;
}
