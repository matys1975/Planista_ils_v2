import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import { FastifyReply, FastifyRequest } from 'fastify';

export default fp(async (server, opts) => {
  let jwtSecret = process.env.JWT_SECRET;
  
  if (!jwtSecret && process.env.NODE_ENV !== 'production') {
    server.log.warn('JWT_SECRET not found in .env, using default development secret!');
    jwtSecret = 'dev-only-secret-do-not-use-in-production-1234567890';
  }

  if (!jwtSecret) {
    throw new Error('FATAL: JWT_SECRET is not set in environment variables! Set it in .env file.');
  }

  server.register(fastifyJwt, {
    secret: jwtSecret,
    cookie: {
      cookieName: 'token',
      signed: false,
    },
  });

  server.register(fastifyCookie);

  server.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });
});

declare module 'fastify' {
  export interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
