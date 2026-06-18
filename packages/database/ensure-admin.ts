/**
 * ensure-admin.ts — Tworzy domyślnego SUPER_ADMIN tylko gdy baza nie ma żadnych użytkowników.
 *
 * Uruchamiany automatycznie przy każdym starcie kontenera Docker (docker-entrypoint.sh).
 * Jeśli w bazie istnieje choćby jeden użytkownik (np. z backupu), skrypt nic nie robi.
 *
 * Zmienne środowiskowe (opcjonalne):
 *   DEFAULT_ADMIN_EMAIL    — domyślnie: admin@planista.local
 *   INITIAL_ADMIN_PASSWORD — opcjonalne; domyślnie generowane losowo
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

async function main() {
  const userCount = await prisma.user.count();

  if (userCount > 0) {
    console.log(`✅ Baza zawiera ${userCount} użytkownik(ów) — pomijam tworzenie domyślnego admina.`);
    return;
  }

  // Baza jest pusta — tworzymy domyślne konto
  const email = process.env.INITIAL_ADMIN_EMAIL || 'admin@planista.local';
  const password = process.env.INITIAL_ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64');

  console.log('═══════════════════════════════════════════');
  console.log('  Tworzenie domyślnego konta SUPER_ADMIN');
  console.log('═══════════════════════════════════════════');

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: 'Administrator',
      role: 'SUPER_ADMIN',
    },
  });

  console.log(`✅ Utworzono domyślnego admina:`);
  console.log(`   Email:  ${email}`);
  console.log(`   Hasło:  ${password}`);
  console.log(`   Rola:   SUPER_ADMIN`);
  console.log('');
  console.log('⚠️  Zmień hasło po pierwszym zalogowaniu!');
  console.log('═══════════════════════════════════════════');
}

main()
  .catch((e) => {
    console.error('❌ Błąd ensure-admin:', e);
    // Nie przerywamy startu kontenera — to nie jest krytyczny błąd
    process.exit(0);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
