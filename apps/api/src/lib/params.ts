// apps/api/src/lib/params.ts

import z from 'zod';
import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Waliduje i zwraca UUID z params.id.
 * Rzuca 400 jeśli id nie jest poprawnym UUID.
 */
export function parseIdParam(request: FastifyRequest, reply: FastifyReply): string {
  const { id } = request.params as { id?: string };
  const result = z.string().uuid('Nieprawidłowy identyfikator UUID').safeParse(id);
  if (!result.success) {
    reply.code(400).send({ error: 'Nieprawidłowy identyfikator zasobu.' });
    throw new Error('Invalid UUID');
  }
  return result.data;
}

/**
 * Waliduje i zwraca UUID z dowolnego parametru ścieżki.
 */
export function parseParam(request: FastifyRequest, paramName: string, reply: FastifyReply): string {
  const params = request.params as Record<string, string>;
  const result = z.string().uuid('Nieprawidłowy identyfikator UUID').safeParse(params[paramName]);
  if (!result.success) {
    reply.code(400).send({ error: `Nieprawidłowy identyfikator: ${paramName}` });
    throw new Error(`Invalid UUID param: ${paramName}`);
  }
  return result.data;
}
