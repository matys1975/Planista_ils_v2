import { audit, extractAuditContext, sanitize } from '../services/auditService';
import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { requireRole } from '../lib/rbac';
import multipart from '@fastify/multipart';
import z from 'zod';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { SALT_ROUNDS } from '../config/constants';

const instituteSchema = z.object({
  name: z.string().min(1, 'Nazwa jednostki jest wymagana'),
  shortCode: z.string().max(10).optional().nullable(),
  usosCode: z.string().max(20).optional().nullable(),
});

// Audyt #5: Walidacja danych importu JSON
const importTeacherSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  title: z.string().optional().default(''),
  unit: z.string().optional(),
  pensumLimit: z.number().int().min(0).optional().default(210),
});

const importCourseSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  ectsCredits: z.number().int().min(0).optional().default(0),
  hoursTotal: z.number().int().min(0).optional().default(30),
  targetGroupsCount: z.number().int().min(1).optional().default(1),
  semesterId: z.string().uuid(),
  majors: z.array(z.object({
    majorCode: z.string(),
    year: z.number().int(),
  })).optional().default([]),
});

const importRoomSchema = z.object({
  building: z.string().min(1),
  number: z.string().min(1),
  capacity: z.number().int().positive().optional().default(30),
  type: z.string().optional().default('Wykładowa'),
  equipment: z.array(z.string()).optional().default([]),
});

const importGroupSchema = z.object({
  name: z.string().min(1),
  major: z.string().min(1),
  degree: z.string().optional().default('I stopnia'),
  year: z.number().int().min(1).optional().default(1),
  size: z.number().int().positive().optional().default(25),
  semesterId: z.string().uuid(),
});

function normalize(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l').replace(/Ł/g, 'l')
    .trim()
    .toLowerCase();
}

const importDataSchema = z.object({
  instituteName: z.string().min(1, 'Brak pola "instituteName" w pliku JSON.').trim(),
  teachers: z.array(importTeacherSchema).optional().default([]),
  courses: z.array(importCourseSchema).optional().default([]),
  rooms: z.array(importRoomSchema).optional().default([]),
  groups: z.array(importGroupSchema).optional().default([]),
});

export default async function superadminRoutes(server: FastifyInstance) {
  // All SuperAdmin routes require SUPER_ADMIN role
  const preValidation = [server.authenticate, requireRole('SUPER_ADMIN')];

  // ═══════════════════════════════════════════════════════════════════
  // INSTITUTES CRUD
  // ═══════════════════════════════════════════════════════════════════

  // GET /api/v1/superadmin/institutes — lista wszystkich jednostek
  server.get('/api/v1/superadmin/institutes', { preValidation }, async () => {
    const institutes = await prisma.institute.findMany({
      include: {
        _count: {
          select: {
            users: true,
            courses: true,
            teachers: true,
            rooms: true,
            groups: true,
            majors: true,
            allocations: true,
          }
        }
      },
      orderBy: { name: 'asc' }
    });
    return { data: institutes };
  });

  // POST /api/v1/superadmin/institutes — utwórz nową jednostkę
  server.post('/api/v1/superadmin/institutes', { preValidation }, async (request, reply) => {
    try {
      const payload = instituteSchema.parse(request.body);
      const institute = await prisma.institute.create({ data: payload });
      const ctx = extractAuditContext(request);
      await audit(ctx, { action: 'CREATE', entityType: 'Institute', entityId: institute.id, newData: sanitize(institute) });
      return reply.code(201).send({ data: institute });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Błąd walidacji', details: err.errors });
      }
      return reply.code(400).send({ error: 'Nie udało się utworzyć jednostki.' });
    }
  });

  // PUT /api/v1/superadmin/institutes/:id — edytuj jednostkę
  server.put('/api/v1/superadmin/institutes/:id', { preValidation }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const payload = instituteSchema.parse(request.body);
      const oldRecord = await prisma.institute.findUnique({ where: { id } });
      const institute = await prisma.institute.update({ where: { id }, data: payload });
      const ctx = extractAuditContext(request);
      await audit(ctx, { action: 'UPDATE', entityType: 'Institute', entityId: id, oldData: sanitize(oldRecord), newData: sanitize(institute) });
      return reply.send({ data: institute });
    } catch {
      return reply.code(400).send({ error: 'Nie udało się zaktualizować jednostki.' });
    }
  });

  // DELETE /api/v1/superadmin/institutes/:id — usuń jednostkę
  server.delete('/api/v1/superadmin/institutes/:id', { preValidation }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const oldRecord = await prisma.institute.findUnique({ where: { id } });
      await prisma.institute.delete({ where: { id } });
      const ctx = extractAuditContext(request);
      await audit(ctx, { action: 'DELETE', entityType: 'Institute', entityId: id, oldData: sanitize(oldRecord) });
      return reply.send({ success: true });
    } catch {
      return reply.code(400).send({ error: 'Nie można usunąć jednostki — prawdopodobnie posiada powiązane dane.' });
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // FACULTY-WIDE STATISTICS
  // ═══════════════════════════════════════════════════════════════════

  // GET /api/v1/superadmin/stats — globalne statystyki wydziałowe
  server.get('/api/v1/superadmin/stats', { preValidation }, async () => {
    const [
      institutesCount,
      teachersCount,
      coursesCount,
      usersCount,
      allocationsCount,
      majorsCount,
    ] = await Promise.all([
      prisma.institute.count(),
      prisma.teacher.count(),
      prisma.course.count(),
      prisma.user.count(),
      prisma.courseAllocation.count(),
      prisma.major.count(),
    ]);

    // Workload per teacher across all institutes
    const teachers = await prisma.teacher.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        title: true,
        pensumLimit: true,
        institute: { select: { id: true, name: true } },
        allocations: {
          select: {
            assignedHours: true,
            course: { select: { name: true, type: true } },
          }
        }
      },
      orderBy: { lastName: 'asc' }
    });

    const teacherWorkloads = teachers.map(t => {
      const totalHours = t.allocations.reduce((sum, a) => sum + a.assignedHours, 0);
      return {
        id: t.id,
        name: `${t.title} ${t.firstName} ${t.lastName}`,
        institute: t.institute?.name || 'Brak przypisania',
        pensumLimit: t.pensumLimit,
        totalHours,
        balance: totalHours - t.pensumLimit,
        isOverloaded: totalHours > t.pensumLimit,
      };
    });

    const incompleteGroups = await prisma.group.findMany({
      where: {
        OR: [
          { majorId: null },
          { majorName: null }
        ]
      },
      select: {
        id: true,
        name: true,
        degree: true,
        year: true,
        institute: { select: { name: true } },
        semester: { select: { name: true } }
      }
    });

    return {
      data: {
        counts: { institutesCount, teachersCount, coursesCount, usersCount, allocationsCount, majorsCount },
        teacherWorkloads,
        incompleteGroups: incompleteGroups.map(g => ({
          id: g.id,
          name: g.name,
          degree: g.degree,
          year: g.year,
          institute: g.institute?.name || 'Brak przypisania',
          semester: g.semester?.name || 'Brak przypisania'
        }))
      }
    };
  });

  // ═══════════════════════════════════════════════════════════════════
  // JSON EXPORT — eksport danych instytutu do pliku JSON
  // ═══════════════════════════════════════════════════════════════════

  server.get('/api/v1/superadmin/institutes/:id/export', { preValidation }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const institute = await prisma.institute.findUnique({ where: { id } });
    if (!institute) {
      return reply.code(404).send({ error: 'Nie znaleziono jednostki.' });
    }

    const [teachers, courses, rooms, groups, allocations] = await Promise.all([
      prisma.teacher.findMany({ where: { instituteId: id } }),
      prisma.course.findMany({
        where: { instituteId: id },
        include: { majors: { include: { major: true } } }
      }),
      prisma.room.findMany({ where: { instituteId: id } }),
      prisma.group.findMany({
        where: { instituteId: id },
        include: { major: true }
      }),
      prisma.courseAllocation.findMany({
        where: { instituteId: id },
        include: {
          groups: { include: { group: true } },
          course: { select: { code: true } },
          teacher: { select: { email: true } },
        }
      }),
    ]);

    const exportData = {
      exportVersion: '1.0',
      exportedAt: new Date().toISOString(),
      instituteName: institute.name,
      teachers: teachers.map(t => ({
        email: t.email,
        firstName: t.firstName,
        lastName: t.lastName,
        title: t.title,
        unit: t.unit,
        pensumLimit: t.pensumLimit,
      })),
      courses: courses.map(c => ({
        code: c.code,
        name: c.name,
        type: c.type,
        ectsCredits: c.ectsCredits,
        hoursTotal: c.hoursTotal,
        targetGroupsCount: c.targetGroupsCount,
        semesterId: c.semesterId,
        majors: c.majors.map(m => ({
          majorCode: m.major.code,
          year: m.year,
        })),
      })),
      rooms: rooms.map(r => ({
        building: r.building,
        number: r.number,
        capacity: r.capacity,
        type: r.type,
        equipment: r.equipment,
      })),
      groups: groups.map(g => ({
        name: g.name,
        major: g.major?.code || g.majorName || '',
        degree: g.degree,
        year: g.year,
        size: g.size,
        semesterId: g.semesterId,
      })),
      allocations: allocations.map(a => ({
        courseCode: a.course.code,
        teacherEmail: a.teacher.email,
        assignedHours: a.assignedHours,
        classType: a.classType,
        groupNames: a.groups.map(g => g.group.name),
      })),
    };

    const filename = `export_${institute.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;

    reply
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(JSON.stringify(exportData, null, 2));
  });

  // ═══════════════════════════════════════════════════════════════════
  // JSON IMPORT — inteligentne scalanie danych z pliku JSON
  // ═══════════════════════════════════════════════════════════════════

  await server.register(multipart, {
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  });

  server.post('/api/v1/superadmin/import', { preValidation }, async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        return reply.code(400).send({ error: 'Nie przesłano pliku.' });
      }

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks).toString('utf-8');

      let importData: any;
      try {
        const rawJson = JSON.parse(raw);
        // Audyt #5: Waliduj cały plik importu przez Zod schema
        importData = importDataSchema.parse(rawJson);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ error: 'Plik JSON zawiera nieprawidłowe dane.', details: err.errors.slice(0, 10) });
        }
        return reply.code(400).send({ error: 'Plik nie jest prawidłowym dokumentem JSON.' });
      }

      // 1. Find or create the institute
      let institute = await prisma.institute.findFirst({ where: { name: importData.instituteName } });
      if (!institute) {
        institute = await prisma.institute.create({ data: { name: importData.instituteName } });
      }

      const results = {
        instituteName: institute.name,
        instituteId: institute.id,
        teachersCreated: 0,
        teachersMerged: 0,
        coursesCreated: 0,
        coursesMerged: 0,
        roomsCreated: 0,
        groupsCreated: 0,
        allocationsCreated: 0,
        errors: [] as string[],
      };

      // 2. Import Teachers (merge by email or name)
      if (Array.isArray(importData.teachers)) {
        for (const t of importData.teachers) {
          try {
            const email = t.email.trim().toLowerCase();
            const firstName = t.firstName.trim();
            const lastName = t.lastName.trim();

            // Find existing by email (case-insensitive) or by Name
            let existing = await prisma.teacher.findFirst({
              where: {
                OR: [
                  { email: { equals: email, mode: 'insensitive' } },
                  {
                    AND: [
                      { firstName: { equals: firstName, mode: 'insensitive' } },
                      { lastName: { equals: lastName, mode: 'insensitive' } }
                    ]
                  }
                ]
              }
            });

            if (existing) {
              await prisma.teacher.update({
                where: { id: existing.id },
                data: {
                  instituteId: institute.id,
                  // Aktualizuj email tylko jeśli obecny jest inny (np. alias)
                  ...(existing.email.toLowerCase() !== email ? { email } : {})
                },
              });
              results.teachersMerged++;
            } else {
              await prisma.teacher.create({
                data: {
                  email,
                  firstName,
                  lastName,
                  title: t.title?.trim() || '',
                  unit: t.unit?.trim() || importData.instituteName,
                  pensumLimit: t.pensumLimit || 210,
                  instituteId: institute.id,
                },
              });
              results.teachersCreated++;
            }
          } catch (err: any) {
            results.errors.push(`Nauczyciel ${t.email}: ${err.message}`);
          }
        }
      }

      // 3. Import Courses (merge by code)
      if (Array.isArray(importData.courses)) {
        for (const c of importData.courses) {
          try {
            let course = await prisma.course.findUnique({
              where: {
                code_semesterId: {
                  code: c.code,
                  semesterId: c.semesterId
                }
              }
            });
            if (course) {
              course = await prisma.course.update({
                where: { id: course.id },
                data: { instituteId: institute.id },
              });
              results.coursesMerged++;
            } else {
              course = await prisma.course.create({
                data: {
                  code: c.code,
                  name: c.name,
                  type: c.type,
                  ectsCredits: c.ectsCredits || 0,
                  hoursTotal: c.hoursTotal || 30,
                  targetGroupsCount: c.targetGroupsCount || 1,
                  semesterId: c.semesterId,
                  instituteId: institute.id,
                },
              });
              results.coursesCreated++;
            }

            // Obsługa kierunków (Majors) dla tego przedmiotu
            if (c.majors && Array.isArray(c.majors)) {
              for (const m of c.majors) {
                // Znajdź lub utwórz kierunek i przypisz go do instytutu
                let major = await prisma.major.findUnique({ where: { code: m.majorCode } });
                if (major) {
                  // Jeśli kierunek istnieje, upewnij się że ma przypisany instytut (jeśli nie miał)
                  if (!major.instituteId) {
                    await prisma.major.update({
                      where: { id: major.id },
                      data: { instituteId: institute.id }
                    });
                  }
                } else {
                  // Utwórz nowy kierunek (używając kodu jako nazwy tymczasowej, jeśli brak pełnej w JSON)
                  major = await prisma.major.create({
                    data: {
                      code: m.majorCode,
                      name: m.majorCode, // Nazwa tymczasowa
                      degree: 'I stopnia',
                      years: 3,
                      instituteId: institute.id
                    }
                  });
                }

                // Połącz przedmiot z kierunkiem (CourseOnMajor)
                await prisma.courseOnMajor.upsert({
                  where: {
                    courseId_majorId_year: {
                      courseId: course.id,
                      majorId: major.id,
                      year: m.year
                    }
                  },
                  create: {
                    courseId: course.id,
                    majorId: major.id,
                    year: m.year
                  },
                  update: {} // Już istnieje, nie rób nic
                });
              }
            }
          } catch (err: any) {
            results.errors.push(`Przedmiot ${c.code}: ${err.message}`);
          }
        }
      }

      // 4. Import Rooms
      if (Array.isArray(importData.rooms)) {
        for (const r of importData.rooms) {
          try {
            await prisma.room.create({
              data: {
                building: r.building,
                number: r.number,
                capacity: r.capacity || 30,
                type: r.type || 'Wykładowa',
                equipment: r.equipment || [],
                instituteId: institute.id,
              },
            });
            results.roomsCreated++;
          } catch (err: any) {
            results.errors.push(`Sala ${r.building}/${r.number}: ${err.message}`);
          }
        }
      }

      // 5. Import Groups
      if (Array.isArray(importData.groups)) {
        for (const g of importData.groups) {
          try {
            const groupName = g.name.trim();
            const majorName = g.major.trim();

            // Znajdź kierunek pasujący do grupy (case-insensitive)
            const majorRecord = await prisma.major.findFirst({
              where: {
                OR: [
                  { code: { equals: majorName, mode: 'insensitive' } },
                  { name: { equals: majorName, mode: 'insensitive' } }
                ]
              }
            });

            await prisma.group.create({
              data: {
                name: groupName,
                majorId: majorRecord?.id,
                majorName: majorName,
                degree: g.degree?.trim() || 'I stopnia',
                year: g.year || 1,
                size: g.size || 25,
                semesterId: g.semesterId,
                instituteId: institute.id,
              },
            });
            results.groupsCreated++;
          } catch (err: any) {
            results.errors.push(`Grupa ${g.name}: ${err.message}`);
          }
        }
      }

      server.log.info(`Import zakończony: ${JSON.stringify(results)}`);

      return reply.send({
        success: true,
        message: `Import zakończony dla "${institute.name}".`,
        data: results,
      });
    } catch (err: any) {
      server.log.error(err, 'Import error');
      return reply.code(500).send({ error: 'Błąd importu.', details: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // SUPERADMIN PASSWORD RESET — Globalny reset hasła dowolnego użytkownika
  // ═══════════════════════════════════════════════════════════════════
  const resetPasswordSchema = z.object({
    newPassword: z.string().min(6, 'Hasło musi mieć min. 6 znaków'),
  });

  server.post('/api/v1/superadmin/users/:id/reset-password', { preValidation }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const payload = resetPasswordSchema.parse(request.body);

      const targetUser = await prisma.user.findUnique({ where: { id } });
      if (!targetUser) {
        return reply.code(404).send({ error: 'Nie znaleziono użytkownika.' });
      }

      const passwordHash = await bcrypt.hash(payload.newPassword, SALT_ROUNDS);
      await prisma.user.update({
        where: { id },
        data: { passwordHash, mustChangePassword: true },
      });

      const ctx = extractAuditContext(request);
      await audit(ctx, { action: 'PASSWORD_RESET', entityType: 'User', entityId: id });

      return reply.send({ success: true, message: 'Hasło zostało zresetowane.' });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Błąd walidacji', details: err.errors });
      }
      return reply.code(400).send({ error: 'Nie udało się zresetować hasła.' });
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // INSTITUTE ADMIN COVERAGE — lista jednostek z liczbą adminów
  // ═══════════════════════════════════════════════════════════════════
  server.get('/api/v1/superadmin/institute-admins', { preValidation }, async () => {
    const institutes = await prisma.institute.findMany({
      select: {
        id: true,
        name: true,
        shortCode: true,
        usosCode: true,
        facultyId: true,
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    });

    const instituteIds = institutes.map((i: { id: string }) => i.id);
    const adminUsers = await prisma.user.findMany({
      where: {
        role: 'ADMIN',
        instituteId: { in: instituteIds },
      },
      select: {
        id: true,
        name: true,
        email: true,
        instituteId: true,
        lastLoginAt: true,
      },
    });

    const adminMap = new Map<string, typeof adminUsers>();
    for (const u of adminUsers) {
      if (u.instituteId) {
        const list = adminMap.get(u.instituteId) || [];
        list.push(u);
        adminMap.set(u.instituteId, list);
      }
    }

    const data = institutes.map((inst) => ({
      ...inst,
      adminCount: adminMap.get(inst.id)?.length || 0,
      admins: adminMap.get(inst.id) || [],
      hasAdmin: (adminMap.get(inst.id)?.length || 0) > 0,
    }));

    return { data };
  });

  // ═══════════════════════════════════════════════════════════════════
  // FACULTY TEACHERS SEARCH — szukaj wśród wszystkich prowadzących wydziału
  // ═══════════════════════════════════════════════════════════════════
  server.get('/api/v1/superadmin/faculty-teachers', { preValidation }, async (request) => {
    const { search } = request.query as { search?: string };
    const where: any = {};
    if (search && search.trim().length >= 2) {
      const s = search.trim();
      where.OR = [
        { firstName: { contains: s, mode: 'insensitive' } },
        { lastName: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
      ];
    }
    const teachers = await prisma.teacher.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        title: true,
        email: true,
        institute: { select: { id: true, name: true, shortCode: true } },
      },
      orderBy: { lastName: 'asc' },
      take: 30,
    });
    return { data: teachers };
  });

  // ═══════════════════════════════════════════════════════════════════
  // ASSIGN ADMIN — przypisz admina do jednostki
  // ═══════════════════════════════════════════════════════════════════
  const assignAdminSchema = z.object({
    // Opcja A: z istniejącego prowadzącego
    teacherId: z.string().uuid().optional(),
    // Opcja B: ręcznie (nowy użytkownik)
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    password: z.string().min(6).optional(),
  });

  server.post('/api/v1/superadmin/institutes/:id/assign-admin', { preValidation }, async (request, reply) => {
    const { id: instituteId } = request.params as { id: string };

    const institute = await prisma.institute.findUnique({ where: { id: instituteId } });
    if (!institute) {
      return reply.code(404).send({ error: 'Nie znaleziono jednostki.' });
    }

    const body = assignAdminSchema.parse(request.body);

    if (body.teacherId) {
      // Opcja A: Promuj prowadzącego na admina
      const teacher = await prisma.teacher.findUnique({ where: { id: body.teacherId } });
      if (!teacher) {
        return reply.code(404).send({ error: 'Nie znaleziono prowadzącego.' });
      }

      // Check if user account already exists for this teacher's email
      let user = await prisma.user.findUnique({ where: { email: teacher.email } });
      if (user) {
        // Update existing user — set as ADMIN for this institute
        const oldRole = user.role;
        user = await prisma.user.update({
          where: { id: user.id },
          data: { role: 'ADMIN', instituteId },
        });
        const ctx = extractAuditContext(request);
        await audit(ctx, { action: 'ROLE_CHANGE', entityType: 'User', entityId: user.id, oldData: { role: oldRole }, newData: { role: 'ADMIN' } });
        return reply.send({ data: user, message: `Użytkownik "${user.name}" promowany na admina jednostki "${institute.name}".` });
      } else {
        // Create new user from teacher data
        const temporaryPassword = crypto.randomBytes(12).toString('base64url');
        const passwordHash = await bcrypt.hash(temporaryPassword, SALT_ROUNDS);
        user = await prisma.user.create({
          data: {
            email: teacher.email,
            name: `${teacher.title} ${teacher.firstName} ${teacher.lastName}`.trim(),
            passwordHash,
            role: 'ADMIN',
            instituteId,
            mustChangePassword: true,
          },
        });
        const ctx = extractAuditContext(request);
        await audit(ctx, { action: 'CREATE', entityType: 'User', entityId: user.id, newData: sanitize(user) });
        await audit(ctx, { action: 'ROLE_CHANGE', entityType: 'User', entityId: user.id, oldData: { role: null }, newData: { role: 'ADMIN' } });
        return reply.code(201).send({
          data: user,
          temporaryPassword,
          message: `Utworzono konto admina "${user.name}". Hasło jednorazowe: ${temporaryPassword}. Poproś o zmianę po pierwszym logowaniu.`,
        });
      }
    } else if (body.name && body.email && body.password) {
      // Opcja B: Utwórz nowego użytkownika ręcznie
      const existing = await prisma.user.findUnique({ where: { email: body.email } });
      if (existing) {
        // Update role and institute
        const oldRole = existing.role;
        const updated = await prisma.user.update({
          where: { id: existing.id },
          data: { role: 'ADMIN', instituteId },
        });
        const ctx = extractAuditContext(request);
        await audit(ctx, { action: 'ROLE_CHANGE', entityType: 'User', entityId: existing.id, oldData: { role: oldRole }, newData: { role: 'ADMIN' } });
        return reply.send({ data: updated, message: `Istniejący użytkownik "${updated.name}" przypisany jako admin.` });
      }

      const passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS);
      const user = await prisma.user.create({
        data: {
          email: body.email,
          name: body.name,
          passwordHash,
          role: 'ADMIN',
          instituteId,
          mustChangePassword: true,
        },
      });
      const ctx = extractAuditContext(request);
      await audit(ctx, { action: 'CREATE', entityType: 'User', entityId: user.id, newData: sanitize(user) });
      await audit(ctx, { action: 'ROLE_CHANGE', entityType: 'User', entityId: user.id, oldData: { role: null }, newData: { role: 'ADMIN' } });
      return reply.code(201).send({ data: user, message: `Utworzono admina "${user.name}".` });
    } else {
      return reply.code(400).send({ error: 'Podaj teacherId lub name+email+password.' });
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // REMOVE ADMIN — usuń rolę admina (nie kasuje usera, zmienia na VIEWER)
  // ═══════════════════════════════════════════════════════════════════
  server.delete('/api/v1/superadmin/institutes/:instId/admins/:userId', { preValidation }, async (request, reply) => {
    const { instId, userId } = request.params as { instId: string; userId: string };

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.instituteId !== instId) {
      return reply.code(404).send({ error: 'Nie znaleziono tego admina w danej jednostce.' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { role: 'VIEWER' },
    });

    const ctx = extractAuditContext(request);
    await audit(ctx, { action: 'ROLE_CHANGE', entityType: 'User', entityId: userId, oldData: { role: user.role }, newData: { role: 'VIEWER' } });

    return reply.send({ success: true, message: `Użytkownik "${user.name}" nie jest już adminem.` });
  });
}
