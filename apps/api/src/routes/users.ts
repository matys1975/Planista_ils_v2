import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { requireRole, extractFullScope, buildInstituteWhere } from '../lib/rbac';
import { parseIdParam } from '../lib/params';
import z from 'zod';
import bcrypt from 'bcrypt';
import { SALT_ROUNDS } from '../config/constants';
import type { Prisma } from '@plan/database';

const createUserSchema = z.object({
  email: z.string().email('Nieprawidłowy adres e-mail'),
  password: z.string().min(6, 'Hasło musi mieć min. 6 znaków'),
  name: z.string().min(1, 'Imię i nazwisko jest wymagane'),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'PLANNER', 'VIEWER']).default('VIEWER'),
  instituteId: z.string().uuid().optional(),
});

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6).optional(),
});

const adminUpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'PLANNER', 'VIEWER']).optional(),
  newPassword: z.string().min(6).optional(),
  instituteId: z.string().uuid().optional(),
});

export default async function usersRoutes(server: FastifyInstance) {
  // ==========================================
  // ADMIN: Lista wszystkich użytkowników
  // ==========================================
  server.get('/api/v1/users', {
    preValidation: [server.authenticate, requireRole('ADMIN')]
  }, async (request, reply) => {
    const currentRole = (request.user as any).role;
    if (currentRole === 'DEAN') {
      return reply.code(403).send({ error: 'Dziekan korzysta z endpointu /api/v1/dean/users' });
    }

    const scope = extractFullScope(request);
    const whereClause = buildInstituteWhere(scope);

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        institute: { select: { id: true, name: true, shortCode: true } },
      },
      orderBy: { name: 'asc' }
    });
    return { data: users };
  });

  // ==========================================
  // ADMIN: Tworzenie nowego użytkownika
  // ==========================================
  server.post('/api/v1/users', {
    preValidation: [server.authenticate, requireRole('ADMIN')]
  }, async (request, reply) => {
    try {
      const currentRole = (request.user as any).role;
      if (currentRole === 'DEAN') {
        return reply.code(403).send({ error: 'Dziekan korzysta z endpointu /api/v1/dean/users' });
      }

      const payload = createUserSchema.parse(request.body);

      // Audyt #3: Zapobiegaj eskalacji — tylko SUPER_ADMIN może nadawać rolę SUPER_ADMIN
      const currentUser = request.user as { role: string };
      if (payload.role === 'SUPER_ADMIN' && currentUser.role !== 'SUPER_ADMIN') {
        return reply.code(403).send({ error: 'Tylko SuperAdmin może nadawać rolę SuperAdmin.' });
      }

      // Guard: tylko SUPER_ADMIN lub DEAN mogą nadawać rolę ADMIN
      if (payload.role === 'ADMIN' && !['SUPER_ADMIN', 'DEAN'].includes(currentUser.role)) {
        return reply.code(403).send({ error: 'Brak uprawnień do nadania roli Administrator jednostki.' });
      }

      const passwordHash = await bcrypt.hash(payload.password, SALT_ROUNDS);

      // Przypisanie instytutu:
      // - Tylko SUPER_ADMIN może przypisać do konkretnego instytutu przez body.instituteId
      // - Dla pozostałych: automatycznie do instytutu tworzącego
      let instituteId: string | undefined = extractFullScope(request).instituteId || undefined;
      if (payload.instituteId && currentUser.role === 'SUPER_ADMIN') {
        instituteId = payload.instituteId;
      }

      const user = await prisma.user.create({
        data: {
          email: payload.email,
          name: payload.name,
          role: payload.role,
          passwordHash,
          ...(instituteId ? { instituteId } : {}),
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          instituteId: true,
          createdAt: true,
        }
      });
      return reply.code(201).send({ data: user });
    } catch (err) {
      if (err instanceof Object && 'code' in err && err.code === 'P2002') {
        return reply.code(400).send({ error: 'Użytkownik z takim adresem e-mail już istnieje.' });
      }
      return reply.code(400).send({ error: 'Błąd walidacji' });
    }
  });

  // ==========================================
  // ADMIN: Edycja dowolnego użytkownika
  // ==========================================
  server.put('/api/v1/users/:id', {
    preValidation: [server.authenticate, requireRole('ADMIN')]
  }, async (request, reply) => {
    const id = parseIdParam(request, reply);
    try {
      const currentRole = (request.user as any).role;
      if (currentRole === 'DEAN') {
        return reply.code(403).send({ error: 'Dziekan korzysta z endpointu /api/v1/dean/users' });
      }

      // Audyt #4: Weryfikuj przynależność do instytutu
      const instituteId = extractFullScope(request).instituteId;
      if (instituteId) {
        const target = await prisma.user.findFirst({ where: { id, instituteId } });
        if (!target) return reply.code(404).send({ error: 'Nie znaleziono użytkownika.' });
      }

      const payload = adminUpdateUserSchema.parse(request.body);

      // Audyt #3: Zapobiegaj eskalacji
      const currentUser = request.user as { role: string };
      if (payload.role === 'SUPER_ADMIN' && currentUser.role !== 'SUPER_ADMIN') {
        return reply.code(403).send({ error: 'Tylko SuperAdmin może nadawać rolę SuperAdmin.' });
      }

      const updateData: Prisma.UserUpdateInput = {};

      if (payload.name) updateData.name = payload.name;
      if (payload.email) updateData.email = payload.email;
      if (payload.role) updateData.role = payload.role;
      if (payload.newPassword) {
        updateData.passwordHash = await bcrypt.hash(payload.newPassword, SALT_ROUNDS);
      }

      // Tylko SUPER_ADMIN może zmienić przypisanie do instytutu
      if (payload.instituteId && currentUser.role === 'SUPER_ADMIN') {
        updateData.institute = { connect: { id: payload.instituteId } };
      }

      const user = await prisma.user.update({
        where: { id },
        data: updateData,
        select: { id: true, email: true, name: true, role: true, instituteId: true }
      });
      return reply.send({ data: user });
    } catch (err) {
      if (err instanceof Object && 'code' in err && err.code === 'P2002') {
        return reply.code(400).send({ error: 'Ten adres e-mail jest już zajęty.' });
      }
      return reply.code(400).send({ error: 'Błąd aktualizacji użytkownika' });
    }
  });

  // ==========================================
  // ADMIN: Usuwanie użytkownika
  // ==========================================
  server.delete('/api/v1/users/:id', {
    preValidation: [server.authenticate, requireRole('ADMIN')]
  }, async (request, reply) => {
    const id = parseIdParam(request, reply);
    const currentUser = request.user as { id: string };

    if (currentUser.id === id) {
      return reply.code(400).send({ error: 'Nie możesz usunąć samego siebie!' });
    }

    const currentRole = (request.user as any).role;
    if (currentRole === 'DEAN') {
      return reply.code(403).send({ error: 'Dziekan korzysta z endpointu /api/v1/dean/users' });
    }

    // Audyt #4: Weryfikuj przynależność do instytutu
    const instituteId = extractFullScope(request).instituteId;
    if (instituteId) {
      const target = await prisma.user.findFirst({ where: { id, instituteId } });
      if (!target) return reply.code(404).send({ error: 'Nie znaleziono użytkownika.' });
    }

    try {
      await prisma.user.delete({ where: { id } });
      return reply.send({ success: true });
    } catch {
      return reply.code(400).send({ error: 'Nie udało się usunąć użytkownika.' });
    }
  });

  // ==========================================
  // PROFIL: Edycja własnych danych (dla każdego zalogowanego)
  // ==========================================
  server.put('/api/v1/auth/profile', {
    preValidation: [server.authenticate]
  }, async (request, reply) => {
    const currentUser = request.user as { id: string };
    try {
      const payload = updateProfileSchema.parse(request.body);
      const updateData: Prisma.UserUpdateInput = {};

      if (payload.name) updateData.name = payload.name;
      if (payload.email) updateData.email = payload.email;

      // Zmiana hasła wymaga podania obecnego
      if (payload.newPassword) {
        if (!payload.currentPassword) {
          return reply.code(400).send({ error: 'Podaj aktualne hasło aby ustawić nowe.' });
        }
        const user = await prisma.user.findUnique({ where: { id: currentUser.id } });
        if (!user) return reply.code(404).send({ error: 'Użytkownik nie znaleziony.' });

        const isValid = await bcrypt.compare(payload.currentPassword, user.passwordHash);
        if (!isValid) {
          return reply.code(401).send({ error: 'Aktualne hasło jest nieprawidłowe.' });
        }
        updateData.passwordHash = await bcrypt.hash(payload.newPassword, SALT_ROUNDS);
      }

      const updated = await prisma.user.update({
        where: { id: currentUser.id },
        data: updateData,
        select: { id: true, email: true, name: true, role: true }
      });
      return reply.send({ data: updated });
    } catch (err) {
      if (err instanceof Object && 'code' in err && err.code === 'P2002') {
        return reply.code(400).send({ error: 'Ten adres e-mail jest już zajęty.' });
      }
      return reply.code(400).send({ error: 'Błąd aktualizacji profilu' });
    }
  });
}
