/**
 * ensure-admin.ts - Tworzy domyslnego SUPER_ADMIN tylko gdy baza nie ma zadnych uzytkownikow.
 *
 * Uruchamiany automatycznie przy kazdym starcie kontenera Docker (docker-entrypoint.sh).
 * Jezeli w bazie istnieje chocby jeden uzytkownik (np. z backupu), skrypt nic nie robi.
 *
 * Zmienne srodowiskowe (opcjonalne):
 *   INITIAL_ADMIN_EMAIL    - domyslnie: admin@planista.local
 *   INITIAL_ADMIN_PASSWORD - opcjonalne; domyslnie generowane losowo
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

async function main() {
  // Upewnij się, że jednostka OKPKN istnieje w bazie
  const okpkn = await prisma.institute.findFirst({
    where: {
      OR: [
        { shortCode: 'OKPKN' },
        { name: { contains: 'Kształcenia Nauczycieli', mode: 'insensitive' } }
      ]
    }
  });

  if (!okpkn) {
    console.log('Tworzenie jednostki OKPKN...');
    await prisma.institute.create({
      data: {
        name: 'Ośrodek Koordynacyjno-Programowy Kształcenia Nauczycieli',
        shortCode: 'OKPKN',
        usosCode: '990020900',
      }
    });
    console.log('✅ Utworzono jednostkę OKPKN.');
  }

  // Normalizuj nazwy jednostek w tabeli Teacher, aby uniknąć duplikatów kafelków (np. "SJ UAM" vs "Studium Językowe UAM")
  try {
    await prisma.$executeRawUnsafe(`
      UPDATE "Teacher" t
      SET unit = i.name
      FROM "Institute" i
      WHERE t."instituteId" = i.id AND t.unit != i.name;
    `);
    await prisma.$executeRawUnsafe(`
      UPDATE "Teacher" t
      SET "instituteId" = i.id, unit = i.name
      FROM "Institute" i
      WHERE t."instituteId" IS NULL
        AND (LOWER(TRIM(t.unit)) = LOWER(TRIM(i."shortCode")) OR LOWER(TRIM(t.unit)) = LOWER(TRIM(i.name)));
    `);
  } catch (err) {
    console.warn('Ostrzeżenie przy normalizacji jednostek nauczycieli:', err);
  }

  const userCount = await prisma.user.count();

  if (userCount > 0) {
    console.log(`Baza zawiera ${userCount} uzytkownik(ow) - pomijam tworzenie domyslnego admina.`);
    return;
  }

  const email = process.env.INITIAL_ADMIN_EMAIL || 'admin@planista.local';
  const password = process.env.INITIAL_ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64');

  console.log('===========================================');
  console.log('  Tworzenie domyslnego konta SUPER_ADMIN');
  console.log('===========================================');

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: 'Administrator',
      role: 'SUPER_ADMIN',
    },
  });

  console.log('Utworzono domyslnego admina:');
  console.log(`  Email: ${email}`);
  console.log(`  Haslo: ${password}`);
  console.log('  Rola: SUPER_ADMIN');
  console.log('');
  console.log('Zmien haslo po pierwszym zalogowaniu.');
  console.log('===========================================');
}

main()
  .catch((e) => {
    console.error('Blad ensure-admin:', e);
    process.exit(0);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
