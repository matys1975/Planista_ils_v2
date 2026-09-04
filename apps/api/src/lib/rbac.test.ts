import { describe, expect, it } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  buildInstituteWhere,
  buildTeacherInstituteWhere,
  buildTeacherWhere,
  extractFullScope,
  requireRole,
} from './rbac';

function requestWithUser(user: Record<string, unknown>, headers: Record<string, string> = {}) {
  return { user, headers } as unknown as FastifyRequest;
}

function captureReply() {
  const state = { statusCode: 200, payload: undefined as unknown };
  const reply = {
    code(code: number) {
      state.statusCode = code;
      return this;
    },
    send(payload: unknown) {
      state.payload = payload;
      return this;
    },
  } as unknown as FastifyReply;

  return { reply, state };
}

describe('rbac role checks', () => {
  it('lets SUPER_ADMIN pass role checks without being listed explicitly', async () => {
    const { reply, state } = captureReply();
    const guard = requireRole('ADMIN');

    await guard(requestWithUser({ id: 'u1', role: 'SUPER_ADMIN', email: 'sa@example.test' }), reply);

    expect(state.statusCode).toBe(200);
    expect(state.payload).toBeUndefined();
  });

  it('does not let DEAN pass role checks unless DEAN is listed explicitly', async () => {
    const { reply, state } = captureReply();
    const guard = requireRole('ADMIN');

    await guard(requestWithUser({ id: 'u1', role: 'DEAN', email: 'dean@example.test' }), reply);

    expect(state.statusCode).toBe(403);
    expect(state.payload).toEqual({ error: 'Brak uprawnień do wykonania tej operacji.' });
  });

  it('lets DEAN pass when DEAN is an allowed role', async () => {
    const { reply, state } = captureReply();
    const guard = requireRole('DEAN', 'SUPER_ADMIN');

    await guard(requestWithUser({ id: 'u1', role: 'DEAN', email: 'dean@example.test' }), reply);

    expect(state.statusCode).toBe(200);
    expect(state.payload).toBeUndefined();
  });
});

describe('rbac scope filters', () => {
  it('keeps SUPER_ADMIN unscoped by default', () => {
    const scope = extractFullScope(requestWithUser({ id: 'u1', role: 'SUPER_ADMIN' }));

    expect(scope).toEqual({
      isSuperAdmin: true,
      facultyId: null,
      instituteId: null,
      simulatedInstituteId: null,
    });
    expect(buildInstituteWhere(scope)).toEqual({});
    expect(buildTeacherWhere(scope)).toEqual({});
  });

  it('scopes SUPER_ADMIN to a simulated institute only when the header is a UUID', () => {
    const simulatedInstituteId = '11111111-1111-4111-8111-111111111111';
    const scope = extractFullScope(
      requestWithUser({ id: 'u1', role: 'SUPER_ADMIN' }, { 'x-simulate-institute': simulatedInstituteId })
    );

    expect(scope.instituteId).toBe(simulatedInstituteId);
    expect(scope.simulatedInstituteId).toBe(simulatedInstituteId);
    expect(buildInstituteWhere(scope)).toEqual({ instituteId: simulatedInstituteId });
  });

  it('scopes DEAN to faculty, not to a single institute', () => {
    const scope = extractFullScope(requestWithUser({
      id: 'u1',
      role: 'DEAN',
      facultyId: 'faculty-1',
      instituteId: 'institute-ignored',
    }));

    expect(scope).toEqual({
      isSuperAdmin: false,
      facultyId: 'faculty-1',
      instituteId: null,
      simulatedInstituteId: null,
    });
    expect(buildInstituteWhere(scope)).toEqual({ institute: { facultyId: 'faculty-1' } });
    expect(buildTeacherInstituteWhere(scope)).toEqual({ teacher: { institute: { facultyId: 'faculty-1' } } });
  });

  it('scopes ADMIN and PLANNER to their own institute', () => {
    const scope = extractFullScope(requestWithUser({
      id: 'u1',
      role: 'ADMIN',
      instituteId: 'institute-1',
    }));

    expect(scope).toEqual({
      isSuperAdmin: false,
      facultyId: null,
      instituteId: 'institute-1',
      simulatedInstituteId: null,
    });
    expect(buildInstituteWhere(scope)).toEqual({ instituteId: 'institute-1' });
  });

  it('uses a no-access sentinel when a non-superadmin has no institute or faculty scope', () => {
    const scope = extractFullScope(requestWithUser({ id: 'u1', role: 'ADMIN' }));

    expect(buildInstituteWhere(scope)).toEqual({ instituteId: '__NO_ACCESS__' });
    expect(buildTeacherWhere(scope)).toEqual({ instituteId: '__NO_ACCESS__' });
    expect(buildTeacherInstituteWhere(scope)).toEqual({ teacher: { instituteId: '__NO_ACCESS__' } });
  });

  it('allows institute users to see own, shared units (UCP, OKPKN, SJ UAM, Zlecenie), and already allocated teachers', () => {
    const scope = extractFullScope(requestWithUser({
      id: 'u1',
      role: 'PLANNER',
      instituteId: 'institute-1',
    }));

    expect(buildTeacherWhere(scope)).toEqual({
      OR: [
        { instituteId: 'institute-1' },
        { institute: { shortCode: 'UCP' } },
        { institute: { shortCode: 'OKPKN' } },
        { institute: { shortCode: 'SJ UAM' } },
        { institute: { shortCode: 'Zlecenie' } },
        { allocations: { some: { course: { instituteId: 'institute-1' } } } },
      ],
    });
    expect(buildTeacherInstituteWhere(scope)).toEqual({
      OR: [
        { teacher: { instituteId: 'institute-1' } },
        { teacher: { institute: { shortCode: 'UCP' } } },
        { teacher: { institute: { shortCode: 'OKPKN' } } },
        { teacher: { institute: { shortCode: 'SJ UAM' } } },
        { teacher: { institute: { shortCode: 'Zlecenie' } } },
      ],
    });
  });
});
