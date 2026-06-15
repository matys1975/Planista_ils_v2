import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const initialMajors = [
  { code: 'S1-LSN', name: 'Lingwistyka stosowana (język niemiecki z angielskim)', degree: 'I stopnia', years: 3 },
  { code: 'S1-LSA', name: 'Lingwistyka stosowana (język angielski z niemieckim od podstaw)', degree: 'I stopnia', years: 3 },
  { code: 'S1-LSlk', name: 'Lingwistyka stosowana – lingwistyka komputerowa', degree: 'I stopnia', years: 3 },
  { code: 'S1-LSal', name: 'Applied Linguistics and Intercultural Communication', degree: 'I stopnia', years: 3 },
  { code: 'S2-LSN', name: 'Lingwistyka stosowana MA (język niemiecki z angielskim)', degree: 'II stopnia', years: 2 },
  { code: 'S2-LSA', name: 'Lingwistyka stosowana MA (język angielski z niemieckim)', degree: 'II stopnia', years: 2 },
  { code: 'S2-LSel', name: 'Empirical Linguistics and Language Documentation', degree: 'II stopnia', years: 2 },
];

async function main() {
  console.log('Rozpoczynam migrację początkowych kierunków...');
  for (const major of initialMajors) {
    await prisma.major.upsert({
      where: { code: major.code },
      update: {},
      create: major,
    });
    console.log(`Dodano kierunek: ${major.code}`);
  }
  console.log('Zakończono pomyślnie!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
