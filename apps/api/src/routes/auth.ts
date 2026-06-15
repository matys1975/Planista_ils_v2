import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import z from 'zod';
import bcrypt from 'bcrypt';


async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export default async function authRoutes(server: FastifyInstance) {
  server.post('/api/v1/auth/login', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute',
      }
    }
  }, async (request, reply) => {
    try {
      const { email, password } = loginSchema.parse(request.body);

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      const isValid = await verifyPassword(password, user.passwordHash);
      if (!isValid) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      // Aktualizujemy lastLoginAt
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      const token = server.jwt.sign(
        { id: user.id, role: user.role, email: user.email, instituteId: user.instituteId, facultyId: user.facultyId },
        { expiresIn: '7d' }
      );

      const isProduction = process.env.NODE_ENV === 'production';

      reply
        .setCookie('token', token, {
          path: '/',
          httpOnly: true,
          secure: false, // Zmienione: pozwala na logowanie bez HTTPS na adresach zewnetrznych (np. po IP)
          sameSite: 'lax', // Zmienione: wymusza lax zamiast strict na produkcji dla zewnetrznego dostepu
          maxAge: 7 * 24 * 60 * 60, // 7 days
        })
        .send({ success: true, role: user.role, name: user.name, instituteId: user.instituteId, facultyId: user.facultyId });

    } catch (err) {
      server.log.error(err);
      return reply.code(400).send({ error: 'Bad Request' });
    }
  });

  server.post('/api/v1/auth/logout', async (request, reply) => {
    reply
      .clearCookie('token', { path: '/' })
      .send({ success: true });
  });

  server.get('/api/v1/auth/me', { preValidation: [server.authenticate] }, async (request, reply) => {
    const jwtUser = request.user as { id: string; role: string; email: string };
    const user = await prisma.user.findUnique({ where: { id: jwtUser.id }, select: { id: true, name: true, email: true, role: true, instituteId: true, facultyId: true } });
    if (!user) return reply.code(401).send({ error: 'User not found' });
    return { user };
  });

  // USUNIĘTO: endpoint /api/v1/auth/rehash — był publiczny i stanowił lukę bezpieczeństwa.
  // Jeśli potrzebujesz rehashowania haseł, użyj skryptu CLI z dostępem do bazy.
}
