// apps/api/src/services/entryService.ts

import { prisma } from '../lib/prisma';
import z from 'zod';

export const entrySchema = z.object({
  semesterId: z.string().uuid(),
  courseId: z.string().uuid(),
  teacherId: z.string().uuid(),
  roomId: z.string().uuid(),
  groupIds: z.array(z.string().uuid()).min(1, 'Należy przypisać min. 1 grupę'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  dayOfWeek: z.number().int().min(1).max(7),
  weekType: z.enum(['A', 'B', 'AB']),
  classType: z.string().optional().nullable(),
  force: z.boolean().optional(),
});

export type EntryPayload = z.infer<typeof entrySchema>;

export function timeToMinutes(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function doTimesOverlap(s1: string, e1: string, s2: string, e2: string) {
  const start1 = timeToMinutes(s1);
  const end1 = timeToMinutes(e1);
  const start2 = timeToMinutes(s2);
  const end2 = timeToMinutes(e2);
  return start1 < end2 && end1 > start2;
}

export function doWeeksOverlap(w1: string, w2: string) {
  if (w1 === 'AB' || w2 === 'AB') return true;
  return w1 === w2;
}

// Sprawdzenie kolizji — zoptymalizowane zapytanie filtruje po zasobach na poziomie DB
export async function checkCollisions(payload: Partial<EntryPayload> & { semesterId: string, dayOfWeek: number }, excludeId?: string) {
  // Buduj warunki OR tylko dla podanych zasobów
  const orConditions: any[] = [];
  if (payload.roomId) orConditions.push({ roomId: payload.roomId });
  if (payload.teacherId) orConditions.push({ teacherId: payload.teacherId });
  if (payload.groupIds && payload.groupIds.length > 0) {
    orConditions.push({ groups: { some: { groupId: { in: payload.groupIds } } } });
  }

  // Jeśli brak zasobów do sprawdzenia, nie ma co szukać kolizji
  if (orConditions.length === 0) return [];

  const existingEntries = await prisma.scheduleEntry.findMany({
    where: {
      semesterId: payload.semesterId,
      dayOfWeek: payload.dayOfWeek,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      OR: orConditions,
    },
    include: {
      groups: true
    }
  });

  const conflicts: string[] = [];

  for (const existing of existingEntries) {
    if (payload.startTime && payload.endTime && !doTimesOverlap(payload.startTime, payload.endTime, existing.startTime, existing.endTime)) {
      continue;
    }
    if (payload.weekType && !doWeeksOverlap(payload.weekType, existing.weekType)) {
      continue;
    }

    if (payload.roomId && existing.roomId === payload.roomId) {
      conflicts.push(`Zajętość Sali: Sala jest już zarezerwowana.`);
    }
    if (payload.teacherId && existing.teacherId === payload.teacherId) {
      conflicts.push(`Prowadzący Niedostępny: Wykładowca prowadzi inne zajęcia.`);
    }
    
    if (payload.groupIds) {
      const existingGroupIds = existing.groups.map(g => g.groupId);
      const hasGroupCollision = payload.groupIds.some(id => existingGroupIds.includes(id));
      if (hasGroupCollision) {
        conflicts.push(`Kolizja Grup: Przynajmniej jedna podana grupa studencka jest wtedy na innych zajęciach.`);
      }
    }
  }

  return conflicts;
}

export async function createEntry(payload: EntryPayload, instituteId?: string | null) {
  const conflicts = await checkCollisions({
    semesterId: payload.semesterId,
    dayOfWeek: payload.dayOfWeek,
    startTime: payload.startTime,
    endTime: payload.endTime,
    weekType: payload.weekType,
    roomId: payload.roomId,
    teacherId: payload.teacherId,
    groupIds: payload.groupIds,
  });

  if (!payload.force && conflicts.length > 0) {
    const error: any = new Error('Wykryto kolizje przy tworzeniu wpisu.');
    error.conflicts = Array.from(new Set(conflicts));
    throw error;
  }

  const entry = await prisma.scheduleEntry.create({
    data: {
      semesterId: payload.semesterId,
      courseId: payload.courseId,
      teacherId: payload.teacherId,
      roomId: payload.roomId,
      startTime: payload.startTime,
      endTime: payload.endTime,
      dayOfWeek: payload.dayOfWeek,
      weekType: payload.weekType,
      classType: payload.classType,
      ...(instituteId ? { instituteId } : {}),
      groups: {
        create: payload.groupIds.map(id => ({ groupId: id }))
      }
    },
    include: {
      course: true,
      teacher: true,
      room: true,
      groups: { include: { group: true }}
    }
  });
  
  return {
    ...entry,
    groups: entry.groups.map(g => g.group)
  };
}


export async function updateEntry(id: string, payload: Partial<EntryPayload>) {
  const currentEntry = await prisma.scheduleEntry.findUnique({ where: { id }, include: { groups: true } });
  if (!currentEntry) throw new Error('Not Found');

  const newSemesterId = payload.semesterId || currentEntry.semesterId;
  const newDayOfWeek = payload.dayOfWeek || currentEntry.dayOfWeek;
  const newStartTime = payload.startTime || currentEntry.startTime;
  const newEndTime = payload.endTime || currentEntry.endTime;
  const newWeekType = payload.weekType || currentEntry.weekType;
  const newRoomId = payload.roomId || currentEntry.roomId;
  const newTeacherId = payload.teacherId || currentEntry.teacherId;
  const newGroupIds = payload.groupIds || currentEntry.groups.map(g => g.groupId);

  const conflicts = await checkCollisions({
    semesterId: newSemesterId,
    dayOfWeek: newDayOfWeek,
    startTime: newStartTime,
    endTime: newEndTime,
    weekType: newWeekType as "A" | "B" | "AB",
    roomId: newRoomId,
    teacherId: newTeacherId,
    groupIds: newGroupIds,
  }, id);

  if (!payload.force && conflicts.length > 0) {
    const error: Error & { conflicts?: string[] } = new Error('Wykryto kolizje przy edycji/przesuwaniu.');
    error.conflicts = Array.from(new Set(conflicts));
    throw error;
  }

  // Atomowa aktualizacja w transakcji
  const updated = await prisma.$transaction(async (tx) => {
    const updateData: Record<string, unknown> = {
      semesterId: newSemesterId,
      courseId: payload.courseId || currentEntry.courseId,
      teacherId: newTeacherId,
      roomId: newRoomId,
      startTime: newStartTime,
      endTime: newEndTime,
      dayOfWeek: newDayOfWeek,
      weekType: newWeekType,
    };

    if (payload.groupIds) {
      updateData.groups = {
        deleteMany: {},
        create: payload.groupIds.map((gid: string) => ({ groupId: gid }))
      };
    }

    return tx.scheduleEntry.update({
      where: { id },
      data: updateData,
      include: {
        course: true,
        teacher: true,
        room: true,
        groups: { include: { group: true } }
      }
    });
  });

  return { ...updated, groups: updated.groups.map(g => g.group) };
}
