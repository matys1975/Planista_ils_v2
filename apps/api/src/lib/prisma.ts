import { PrismaClient } from '@plan/database';

// Singleton PrismaClient — jedna współdzielona instancja dla całej aplikacji.
// Zapobiega wyciekowi połączeń do bazy danych (domyślnie ~5 na instancję).
const prisma = new PrismaClient();

// Graceful shutdown — zamknij połączenia do DB przy zatrzymywaniu procesu
const shutdown = async () => {
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { prisma };
