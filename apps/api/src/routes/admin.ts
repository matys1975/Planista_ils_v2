import { FastifyInstance } from 'fastify';
import { requireRole } from '../lib/rbac';
import multipart from '@fastify/multipart';
import { streamBackup, listBackups, downloadBackup } from '../services/backup/backupService';
import { restoreFromUpload } from '../services/backup/restoreService';
import { getBackupDir } from '../services/backup/commandBuilder';
import path from 'path';
import fs from 'fs';

function wrapLogger(server: FastifyInstance) {
  return {
    info: (msg: string) => server.log.info(msg),
    warn: (msg: string) => server.log.warn(msg),
    error: (msg: string) => server.log.error(msg),
  };
}

export default async function adminRoutes(server: FastifyInstance) {
  await server.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024,
    },
  });

  // POST /api/v1/admin/backup
  server.post('/api/v1/admin/backup', {
    preValidation: [server.authenticate, requireRole('SUPER_ADMIN')],
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 hour',
      },
    },
  }, async (_request, reply) => {
    try {
      const { filename, buffer } = await streamBackup(wrapLogger(server));

      if (buffer.length === 0) {
        return reply.code(500).send({ error: 'Backup jest pusty. Sprawdź czy baza danych jest uruchomiona.' });
      }

      reply
        .header('Content-Type', 'application/sql')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(buffer);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Nieznany błąd';
      server.log.error(`Błąd backupu: ${errMsg}`);
      return reply.code(500).send({
        error: 'Nie udało się utworzyć backupu bazy danych.',
        details: errMsg,
      });
    }
  });

  // GET /api/v1/admin/backups
  server.get('/api/v1/admin/backups', { preValidation: [server.authenticate, requireRole('SUPER_ADMIN')] }, async (_request, _reply) => {
    try {
      return { data: listBackups() };
    } catch (err) {
      return _reply.code(500).send({ error: 'Nie udało się odczytać listy backupów.' });
    }
  });

  // GET /api/v1/admin/backups/:filename
  server.get('/api/v1/admin/backups/:filename', { preValidation: [server.authenticate, requireRole('SUPER_ADMIN')] }, async (request, reply) => {
    const { filename } = request.params as { filename: string };

    const safeName = path.basename(filename);
    if (!safeName.endsWith('.sql')) {
      return reply.code(400).send({ error: 'Tylko pliki .sql są dozwolone.' });
    }

    try {
      const fileContent = downloadBackup(safeName);
      reply
        .header('Content-Type', 'application/sql')
        .header('Content-Disposition', `attachment; filename="${safeName}"`)
        .send(fileContent);
    } catch {
      return reply.code(404).send({ error: 'Nie znaleziono pliku backupu.' });
    }
  });

  // POST /api/v1/admin/restore
  server.post('/api/v1/admin/restore', {
    preValidation: [server.authenticate, requireRole('SUPER_ADMIN')],
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 hour',
      },
    },
  }, async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        return reply.code(400).send({ error: 'Nie przesłano pliku. Wybierz plik .sql do przywrócenia.' });
      }

      const originalName = data.filename || '';
      if (!originalName.endsWith('.sql')) {
        return reply.code(400).send({ error: 'Dozwolone są tylko pliki z rozszerzeniem .sql' });
      }

      const fileChunks: Buffer[] = [];
      for await (const chunk of data.file) {
        fileChunks.push(chunk);
      }
      const sqlContent = Buffer.concat(fileChunks).toString('utf-8');

      if (!sqlContent || sqlContent.trim().length < 10) {
        return reply.code(400).send({ error: 'Plik SQL jest pusty lub nieprawidłowy.' });
      }

      const jwtUser = request.user as { id: string; email: string };
      server.log.info(`Restore: rozpoczęto przez użytkownika ${jwtUser.email} (${jwtUser.id}), plik: ${originalName}`);

      const result = await restoreFromUpload(sqlContent, originalName, wrapLogger(server));
      server.log.info(`Restore zakończony pomyślnie przez ${jwtUser.email}. Ostrzeżenia: ${result.details.errors}`);

      return reply.send(result);
    } catch (err: any) {
      if (err.message === 'SQL_VIOLATIONS' && err.violations) {
        return reply.code(400).send({
          error: 'Plik SQL zawiera zabronione komendy i nie może zostać przywrócony.',
          violations: err.violations,
        });
      }
      const errMsg = err instanceof Error ? err.message : 'Nieznany błąd';
      server.log.error(`Błąd restore: ${errMsg}`);
      return reply.code(500).send({
        error: 'Nie udało się przywrócić bazy danych.',
        details: errMsg,
      });
    }
  });
}
