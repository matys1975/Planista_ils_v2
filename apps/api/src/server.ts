import 'dotenv/config';
import Fastify, { FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import path from 'path';
import authPlugin from './plugins/auth';
import authRoutes from './routes/auth';
import roomsRoutes from './routes/rooms';
import teachersRoutes from './routes/teachers';
import semestersRoutes from './routes/semesters';
import groupsRoutes from './routes/groups';
import coursesRoutes from './routes/courses';
import entriesRoutes from './routes/entries';
import workloadRoutes from './routes/workload';
import usersRoutes from './routes/users';
import majorsRoutes from './routes/majors';
import adminRoutes from './routes/admin';
// USOS integration removed — nie jest gotowe do produkcji
import superadminRoutes from './routes/superadmin';
import deanRoutes from './routes/dean';
import institutesRoutes from './routes/institutes';
import staffingRequestsRoutes from './routes/staffingRequests';
import auditLogRoutes from './routes/auditLog';

import { prisma } from './lib/prisma';
import { startAutoBackupScheduler } from './services/backup/autoBackupScheduler';

const server = Fastify({
  bodyLimit: 1024 * 1024,  // 1MB — Audyt #13: jawny limit rozmiaru body
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
      : undefined,
  },
  genReqId: () => crypto.randomUUID(),
  requestIdHeader: 'x-request-id',
});

const start = async () => {
  try {
    // Naprawa #10: CORS — origin ze zmiennej środowiskowej
    await server.register(cors, {
      origin: (origin, cb) => {
        // W dev: akceptuj wszystkie originy (dostęp z sieci lokalnej po IP)
        // W prod: akceptuj skonfigurowany CORS_ORIGIN
        if (!origin || process.env.NODE_ENV !== 'production') {
          cb(null, true);
          return;
        }
        cb(null, process.env.CORS_ORIGIN || 'http://localhost:3001');
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    });

    // Naprawa #11: Rate limiting — ochrona przed brute-force
    await server.register(rateLimit, {
      max: 2000,
      timeWindow: '1 minute',
    });

    // Naprawa #12: Helmet — nagłówki bezpieczeństwa HTTP (CSP, HSTS, X-Content-Type-Options)
    await server.register(helmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          styleSrcElem: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          imgSrc: ["'self'", "data:", "blob:"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          connectSrc: ["'self'"],
          upgradeInsecureRequests: null,
        },
      },
    });

    await server.register(authPlugin);

    // ═══════════════════════════════════════════════════════════════════
    // GLOBALNY MIDDLEWARE BEZPIECZEŃSTWA
    // ═══════════════════════════════════════════════════════════════════

    // Lista publicznych endpointów niewymagających autoryzacji
    const PUBLIC_PATHS = [
      '/api/v1/health',
      '/api/v1/auth/login',
      '/api/v1/auth/logout',
    ];

    /**
     * Sprawdza czy ścieżka jest publiczna (nie wymaga autoryzacji).
     * Uwzględnia jawne PUBLIC_PATHS oraz wszystkie zasoby pod /public/*.
     */
    function isPublicPath(url: string): boolean {
      if (PUBLIC_PATHS.some(p => url === p)) return true;
      if (url.startsWith('/public/')) return true;
      return false;
    }

    function isPasswordChangePath(url: string): boolean {
      return [
        '/api/v1/auth/me',
        '/api/v1/auth/profile',
        '/api/v1/auth/logout',
      ].includes(url);
    }

    /**
     * Ustawia nagłówki zapobiegające cache'owaniu odpowiedzi.
     * Stosowane dla wszystkich endpointów API z wyjątkiem publicznych.
     */
    function setNoCacheHeaders(reply: FastifyReply): void {
      reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      reply.header('Pragma', 'no-cache');
      reply.header('Expires', '0');
    }

    // Hook #1: Globalne wymuszenie Cache-Control: no-store dla wszystkich
    // endpointów API z autoryzacją (pomija publiczne ścieżki i zasoby /public).
    // Zapobiega cache'owaniu wrażliwych danych w przeglądarce i proxy.
    server.addHook('onSend', async (request, reply, payload) => {
      const url = request.url.split('?')[0]; // usuń query string

      // Dla endpointów API (nie-publicznych) wymuszamy brak cache
      if (url.startsWith('/api/') && !isPublicPath(url)) {
        setNoCacheHeaders(reply);
      }

      return payload;
    });

    // Hook #2: Globalna weryfikacja autoryzacji dla wszystkich endpointów
    // API poza publicznymi. Działa jako dodatkowa warstwa zabezpieczająca
    // (defense in depth) – nawet jeśli programista zapomni dodać
    // preValidation w nowej trasie, hook wymusi autoryzację.
    server.addHook('onRequest', async (request, reply) => {
      const url = request.url.split('?')[0];

      // Pomijamy ścieżki publiczne, zasoby /public oraz wszystko poza /api/
      if (isPublicPath(url) || !url.startsWith('/api/')) {
        return;
      }

      // Dla wszystkich pozostałych endpointów API wymagamy autoryzacji
      try {
        await request.jwtVerify();
        const jwtUser = request.user as { id?: string };
        if (!isPasswordChangePath(url) && jwtUser.id) {
          const user = await prisma.user.findUnique({
            where: { id: jwtUser.id },
            select: { mustChangePassword: true },
          });
          if (user?.mustChangePassword) {
            setNoCacheHeaders(reply);
            return reply.code(403).send({
              error: 'PASSWORD_CHANGE_REQUIRED',
              message: 'Wymagana jest zmiana hasla przed dalszym korzystaniem z aplikacji.',
            });
          }
        }
      } catch (err) {
        // Ustawiamy nagłówki anty-cache również dla odpowiedzi 401,
        // ponieważ onSend może nie zadziałać przy wcześniejszym przerwaniu.
        setNoCacheHeaders(reply);
        return reply.code(401).send({ error: 'Unauthorized' });
      }
    });

    // Hook #3: Upewniamy się, że odpowiedzi z błędami autoryzacji (403)
    // oraz inne odpowiedzi z middleware RBAC również mają no-store.
    server.addHook('preHandler', async (request, reply) => {
      const url = request.url.split('?')[0];
      if (url.startsWith('/api/') && !isPublicPath(url)) {
        // Jeśli odpowiedź już ma ustawiony status błędu (np. z preValidation),
        // dodajemy nagłówki anty-cache na wypadek gdyby onSend nie przechwycił.
        const statusCode = reply.statusCode;
        if (statusCode >= 400) {
          setNoCacheHeaders(reply);
        }
      }
    });

    // Health check z weryfikacją połączenia do bazy danych
    server.get('/api/v1/health', async (request, reply) => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        return { status: 'ok', database: 'connected', timestamp: new Date().toISOString() };
      } catch {
        return reply.code(503).send({ status: 'error', database: 'disconnected', timestamp: new Date().toISOString() });
      }
    });

    await server.register(authRoutes);
    await server.register(roomsRoutes);
    await server.register(teachersRoutes);
    await server.register(semestersRoutes);
    await server.register(groupsRoutes);
    await server.register(coursesRoutes);
    await server.register(entriesRoutes);
    await server.register(workloadRoutes);
    await server.register(usersRoutes);
    await server.register(majorsRoutes);
    await server.register(adminRoutes);
    await server.register(superadminRoutes);
    await server.register(deanRoutes);
    await server.register(institutesRoutes);
    await server.register(staffingRequestsRoutes);
    await server.register(auditLogRoutes);

    // ─── Serwowanie frontendu w trybie produkcyjnym ────────────────────
    if (process.env.NODE_ENV === 'production') {
      const fastifyStatic = (await import('@fastify/static')).default;
      const frontendPath = path.join(__dirname, '..', '..', 'web', 'dist');

      await server.register(fastifyStatic, {
        root: frontendPath,
        prefix: '/',
        wildcard: false,       // Nie przechwytuj /api/* jako pliki statyczne
      });

      // SPA fallback — każdy GET nie-API trafia do index.html (client-side routing)
      server.setNotFoundHandler(async (request, reply) => {
        if (request.method === 'GET' && !request.url.startsWith('/api/')) {
          return reply.sendFile('index.html', frontendPath);
        }
        return reply.code(404).send({ error: 'Not Found' });
      });

      server.log.info(`Frontend statyczny serwowany z: ${frontendPath}`);
    }

    const port = parseInt(process.env.PORT || '3333', 10);
    const host = process.env.HOST || '0.0.0.0';
    await server.listen({ port, host });
    server.log.info(`Server is running on http://${host}:${port}`);

    // Uruchom automatyczny scheduler backupów (tylko produkcja)
    if (process.env.NODE_ENV === 'production') {
      startAutoBackupScheduler({
        info: (msg) => server.log.info(msg),
        warn: (msg) => server.log.warn(msg),
        error: (msg) => server.log.error(msg),
      });
    }
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
