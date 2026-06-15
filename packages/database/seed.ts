import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Używamy bcrypt (work factor = 12) zgodnie z zasadami bezpieczeństwa.
const SALT_ROUNDS = 12;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// ═══════════════════════════════════════════════════════════════
// Konfiguracja jednostek Wydziału Neofilologii
// ═══════════════════════════════════════════════════════════════
const INSTITUTES = [
  { name: 'Instytut Etnolingwistyki',                   shortCode: 'IE',   usosCode: '990020100' },
  { name: 'Instytut Filologii Germańskiej',             shortCode: 'IFG',  usosCode: '990020200' },
  { name: 'Instytut Filologii Wschodniosłowiańskich',   shortCode: 'IFW',  usosCode: '990020300' },
  { name: 'Instytut Języków i Literatur Romańskich',    shortCode: 'IJLR', usosCode: '990020400' },
  { name: 'Instytut Lingwistyki Stosowanej',            shortCode: 'ILS',  usosCode: '990020500' },
  { name: 'Instytut Orientalistyki',                    shortCode: 'IO',   usosCode: '990020600' },
  { name: 'Katedra Metodologii Lingwistyki',            shortCode: 'KML',  usosCode: '990020700' },
  { name: 'Katedra Skandynawistyki',                    shortCode: 'KS',   usosCode: '990020800' },
];

/**
 * Mapuje pełny kod jednostki pracownika (np. "0990020504") na kod USOS instytutu.
 * Logika: pozycje 1-7 (bez wiodącego 0) dają prefix "9900205", 
 * co matchujemy na kody USOS instytutów (pierwsze 7 znaków).
 * Np. "0990020504" → "9900205" → matchuje "990020500" (ILS).
 */
function mapUnitCodeToInstituteUsosCode(unitCode: string): string | null {
  const cleaned = unitCode.replace(/^0+/, ''); // Usuń wiodące zera → "990020504"
  if (cleaned.length < 7) return null;
  const prefix7 = cleaned.substring(0, 7); // "9900205"
  
  for (const inst of INSTITUTES) {
    if (inst.usosCode.startsWith(prefix7)) {
      return inst.usosCode;
    }
  }
  return null; // Spoza wydziału neofilologii
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  Planista ILS — Seed Database');
  console.log('═══════════════════════════════════════════');

  const defaultSeedPassword = process.env.INITIAL_ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64');
  console.log(`⚠️ Używane hasło dla kont domyślnych: ${defaultSeedPassword}`);

  // ─── 1. Upsert wszystkich 8 instytutów ────────────────────────
  const instituteMap = new Map<string, string>(); // usosCode → id

  for (const inst of INSTITUTES) {
    const record = await prisma.institute.upsert({
      where: { usosCode: inst.usosCode },
      update: { name: inst.name, shortCode: inst.shortCode },
      create: inst,
    });
    instituteMap.set(inst.usosCode, record.id);
  }
  console.log(`✅ Upserted ${INSTITUTES.length} instytutów.`);

  // ─── 2. Konta systemowe ────────────────────────────────────────
  const ilsId = instituteMap.get('990020500')!;

  // SUPER_ADMIN (Dziekan)
  const superAdminEmail = 'superadmin@wydzial.edu.pl';
  await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {},
    create: {
      email: superAdminEmail,
      passwordHash: await hashPassword(defaultSeedPassword),
      name: 'Dziekan Wydziału Neofilologii',
      role: 'SUPER_ADMIN',
    },
  });
  console.log('✅ Super Admin (superadmin@wydzial.edu.pl)');

  // ADMIN ILS (opiekun)
  const adminEmail = 'admin@ils.edu.pl';
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: await hashPassword(defaultSeedPassword),
      name: 'Opiekun ILS',
      role: 'ADMIN',
      instituteId: ilsId,
    },
  });
  console.log('✅ Admin ILS (admin@ils.edu.pl)');

  // ─── 3. Import pracowników z CSV ──────────────────────────────
  const csvPath = path.resolve(__dirname, 'pracownicy_WN.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.log('⚠️  Brak pliku pracownicy_WN.csv — pomijam import pracowników.');
  } else {
    // CSV jest w kodowaniu Windows-1250 (polskie ANSI), nie UTF-8
    const buf = fs.readFileSync(csvPath);
    let raw: string;
    try {
      const iconv = require('iconv-lite');
      raw = iconv.decode(buf, 'windows-1250');
    } catch {
      // Fallback: dekoduj jako latin1 (zachowa polskie znaki lepiej niż UTF-8)
      raw = buf.toString('latin1');
    }
    const lines = raw.split(/\r?\n/).slice(3); // Pomiń 3 linie nagłówka

    let created = 0, updated = 0, skipped = 0, outsideWN = 0;
    const seenEmails = new Set<string>();

    for (const line of lines) {
      if (!line.trim()) continue;
      const parts = line.split(';');
      if (parts.length < 5) continue;

      const [, lastName, firstName, unitCode, email] = parts.map(s => s.trim());
      if (!email || !email.includes('@')) continue;
      
      // Pomiń duplikaty w CSV
      if (seenEmails.has(email.toLowerCase())) {
        skipped++;
        continue;
      }
      seenEmails.add(email.toLowerCase());

      // Mapuj kod jednostki na instytut
      const instituteUsosCode = mapUnitCodeToInstituteUsosCode(unitCode);
      const instituteId = instituteUsosCode ? instituteMap.get(instituteUsosCode) || null : null;
      
      if (!instituteId) outsideWN++;

      // Znajdź instytut dla pola `unit`
      const instituteName = instituteUsosCode 
        ? INSTITUTES.find(i => i.usosCode === instituteUsosCode)?.name || 'Wydział Neofilologii'
        : 'Wydział Neofilologii';

      try {
        // 1. Szukaj po emailu
        let existing = await prisma.teacher.findUnique({ where: { email } });
        
        // 2. Jeśli nie znaleziono po emailu, szukaj po imieniu i nazwisku
        //    (zapobiega duplikatom gdy ta sama osoba ma inny alias emailowy)
        if (!existing && firstName && lastName) {
          const byName = await prisma.teacher.findFirst({
            where: {
              firstName: { equals: firstName, mode: 'insensitive' },
              lastName: { equals: lastName, mode: 'insensitive' },
            },
          });
          if (byName) existing = byName;
        }

        if (existing) {
          // Zawsze aktualizuj imię/nazwisko (naprawa kodowania) + instytut
          await prisma.teacher.update({
            where: { id: existing.id },
            data: {
              firstName: firstName || existing.firstName,
              lastName: lastName || existing.lastName,
              unit: instituteName,
              ...(instituteId && !existing.instituteId ? { instituteId } : {}),
            },
          });
          updated++;
        } else {
          await prisma.teacher.create({
            data: {
              email,
              firstName: firstName || '',
              lastName: lastName || '',
              title: '', // Brak tytułu w CSV — zostanie uzupełniony później
              unit: instituteName,
              pensumLimit: 210, // Domyślny limit
              instituteId,
            },
          });
          created++;
        }
      } catch (err: any) {
        console.log(`  ⚠️  ${email}: ${err.message}`);
      }
    }

    console.log(`✅ Pracownicy z CSV: ${created} nowych, ${updated} zaktualizowanych, ${skipped} duplikatów pominięto.`);
    if (outsideWN > 0) {
      console.log(`   ℹ️  ${outsideWN} pracowników spoza WN (bez przypisania do instytutu).`);
    }

    // ─── 4. Przykładowe kierunki i przedmioty dla ILS ────────────────
    console.log('─── Dodawanie kierunków dla ILS (Lingwistyka Stosowana)...');
    
    const majorsToCreate = [
      { code: 'S1-LSA', name: 'Lingwistyka stosowana (język angielski z niemieckim od podstaw)', degree: 'I stopnia', years: 3 },
      { code: 'S1-LSN', name: 'Lingwistyka stosowana (język niemiecki z angielskim)', degree: 'I stopnia', years: 3 },
      { code: 'S1-LSal', name: 'Applied Linguistics and Intercultural Communication', degree: 'I stopnia', years: 3 },
      { code: 'S1-LSlk', name: 'Lingwistyka stosowana – lingwistyka komputerowa', degree: 'I stopnia', years: 3 },
      { code: 'S2-LSA', name: 'Lingwistyka stosowana MA (język angielski z niemieckim)', degree: 'II stopnia', years: 2 },
      { code: 'S2-LSN', name: 'Lingwistyka stosowana MA (język niemiecki z angielskim)', degree: 'II stopnia', years: 2 },
      { code: 'S2-LSel', name: 'Empirical Linguistics and Language Documentation', degree: 'II stopnia', years: 2 },
    ];

    const majorRecords = [];
    for (const m of majorsToCreate) {
      const record = await prisma.major.upsert({
        where: { code: m.code },
        update: { instituteId: ilsId, name: m.name, degree: m.degree, years: m.years },
        create: { ...m, instituteId: ilsId }
      });
      majorRecords.push(record);
    }

    // Przykładowy semestr
    const semester = await prisma.semester.upsert({
      where: { id: '00000000-0000-0000-0000-000000000001' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Semestr Letni 2023/24',
        year: 2023,
        type: 'letni',
        dateStart: new Date('2024-02-20'),
        dateEnd: new Date('2024-06-30'),
      }
    });

    // Przykładowe przedmioty
    if (semester && majorRecords.length > 0) {
      console.log('─── Dodawanie przykładowych przedmiotów dla ILS...');
      const coursesToCreate = [
        { code: 'ILS-101', name: 'Wstęp do lingwistyki', type: 'W', ectsCredits: 4, hoursTotal: 30 },
        { code: 'ILS-102', name: 'Gramatyka opisowa j. angielskiego', type: 'C', ectsCredits: 5, hoursTotal: 60 },
        { code: 'ILS-103', name: 'Literatura obszaru językowego', type: 'W', ectsCredits: 3, hoursTotal: 30 },
        { code: 'ILS-104', name: 'Praktyczna nauka języka (PNJ)', type: 'L', ectsCredits: 8, hoursTotal: 120 },
      ];

      for (const c of coursesToCreate) {
        const course = await prisma.course.upsert({
          where: { code: c.code },
          update: { instituteId: ilsId, ...c, semesterId: semester.id },
          create: { ...c, semesterId: semester.id, instituteId: ilsId },
        });

        const randomMajor = majorRecords[Math.floor(Math.random() * majorRecords.length)];
        await prisma.courseOnMajor.upsert({
          where: { courseId_majorId_year: { courseId: course.id, majorId: randomMajor.id, year: 1 } },
          update: {},
          create: { courseId: course.id, majorId: randomMajor.id, year: 1 }
        });
      }

      console.log('─── Dodawanie przykładowych grup dla ILS...');
      const groupsToCreate = [
        { name: 'S1-LSN (rok 1) gr. 1', majorCode: 'S1-LSN', year: 1, size: 25 },
        { name: 'S1-LSN (rok 2) gr. 1', majorCode: 'S1-LSN', year: 2, size: 22 },
        { name: 'S1-LSA (rok 1) gr. 1', majorCode: 'S1-LSA', year: 1, size: 24 },
        { name: 'S2-LSN (rok 1) gr. 1', majorCode: 'S2-LSN', year: 1, size: 18 },
      ];

      for (const g of groupsToCreate) {
        const major = majorRecords.find(m => m.code === g.majorCode);
        await prisma.group.create({
          data: {
            name: g.name,
            majorId: major?.id,
            majorName: major?.name,
            degree: major?.degree || 'I stopnia',
            year: g.year,
            size: g.size,
            semesterId: semester.id,
            instituteId: ilsId,
          }
        });
      }
    }
    console.log(`✅ Dodano ${majorRecords.length} kierunków, 4 przedmioty i 4 grupy dla ILS.`);
  }

  console.log('═══════════════════════════════════════════');
  console.log('  Seed zakończony pomyślnie!');
  console.log('═══════════════════════════════════════════');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

