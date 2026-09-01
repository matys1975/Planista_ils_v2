import { prisma } from '../lib/prisma';
import { Prisma } from '@plan/database';

// ─── Typy ────────────────────────────────────────────────────────────────────

/** Prisma transaction client — ten sam typ co `tx` wewnątrz $transaction */
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export interface AuditContext {
  userId: string | null;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

export interface AuditEntry {
  action: string;
  entityType?: string;
  entityId?: string;
  oldData?: unknown;
  newData?: unknown;
  metadata?: Record<string, unknown>;
}

// ─── Sanitizer ───────────────────────────────────────────────────────────────

const SENSITIVE_FIELDS = [
  'passwordHash', 'password', 'newPassword', 'currentPassword',
  'token', 'secret', 'cookie', 'authorization',
];

/**
 * Usuwa wrażliwe dane z obiektu przed zapisem do audytu.
 * Nigdy nie zapisujemy haseł, tokenów ani cookies.
 */
export function sanitize(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitize);

  const clean = { ...(data as Record<string, unknown>) };
  for (const field of SENSITIVE_FIELDS) {
    if (field in clean) clean[field] = '[REDACTED]';
  }
  return clean;
}

// ─── Główna funkcja audytu ───────────────────────────────────────────────────

/**
 * Centralny zapis audytu.
 *
 * @param ctx  — kontekst użytkownika i requestu (kto, skąd)
 * @param entry — co się stało (akcja, obiekt, dane przed/po)
 * @param tx   — opcjonalny Prisma transaction client (zapis w tej samej transakcji co zmiana danych)
 *
 * Wzorzec użycia w transakcji:
 * ```ts
 * await prisma.$transaction(async (tx) => {
 *   const old = await tx.room.findUnique({ where: { id } });
 *   await tx.room.update({ where: { id }, data: ... });
 *   await audit(ctx, { action: 'UPDATE', entityType: 'Room', entityId: id, oldData: old, newData: ... }, tx);
 * });
 * ```
 */
export async function audit(
  ctx: AuditContext,
  entry: AuditEntry,
  tx?: TxClient,
): Promise<void> {
  const client = tx ?? prisma;
  try {
    await client.auditLog.create({
      data: {
        userId: ctx.userId,
        userEmail: ctx.userEmail,
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        oldData: entry.oldData != null ? (sanitize(entry.oldData) as Prisma.InputJsonValue) : Prisma.DbNull,
        newData: entry.newData != null ? (sanitize(entry.newData) as Prisma.InputJsonValue) : Prisma.DbNull,
        ipAddress: ctx.ipAddress ?? null,
        userAgent: ctx.userAgent?.substring(0, 500) ?? null, // ograniczenie długości
        requestId: ctx.requestId ?? null,
        metadata: entry.metadata != null ? (entry.metadata as Prisma.InputJsonValue) : Prisma.DbNull,
      },
    });
  } catch (err) {
    // Audyt NIGDY nie powinien blokować operacji głównej.
    // Log error, ale nie rzucaj wyjątku.
    console.error('[AUDIT] Failed to write audit log:', err);
  }
}

// ─── Helper: kontekst z Fastify request ──────────────────────────────────────

/**
 * Wyciąga kontekst audytu z obiektu Fastify request.
 * Użycie: `const ctx = extractAuditContext(request);`
 */
export function extractAuditContext(request: {
  user?: { id?: string; email?: string } | unknown;
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
  id?: string;
}): AuditContext {
  const user = request.user as { id?: string; email?: string } | undefined;
  const userAgent = request.headers?.['user-agent'];
  return {
    userId: user?.id ?? null,
    userEmail: user?.email,
    ipAddress: request.ip,
    userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
    requestId: request.id,
  };
}
