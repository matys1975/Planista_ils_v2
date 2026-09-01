import React from 'react';

// ─── Mapowania Etykiet ────────────────────────────────────────────────────────

export const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  LOGIN_SUCCESS: { label: 'Logowanie', color: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' },
  LOGIN_FAILURE: { label: 'Nieudane logowanie', color: 'bg-red-500/10 text-red-700 border-red-500/20' },
  LOGOUT: { label: 'Wylogowanie', color: 'bg-slate-500/10 text-slate-600 border-slate-500/20' },
  CREATE: { label: 'Utworzenie', color: 'bg-blue-500/10 text-blue-700 border-blue-500/20' },
  UPDATE: { label: 'Edycja', color: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
  DELETE: { label: 'Usunięcie', color: 'bg-red-500/10 text-red-700 border-red-500/20' },
  PASSWORD_CHANGE: { label: 'Zmiana hasła', color: 'bg-violet-500/10 text-violet-700 border-violet-500/20' },
  PASSWORD_RESET: { label: 'Reset hasła', color: 'bg-violet-500/10 text-violet-700 border-violet-500/20' },
  ROLE_CHANGE: { label: 'Zmiana roli', color: 'bg-orange-500/10 text-orange-700 border-orange-500/20' },
  EXPORT: { label: 'Eksport', color: 'bg-cyan-500/10 text-cyan-700 border-cyan-500/20' },
  BULK_IMPORT: { label: 'Import masowy', color: 'bg-indigo-500/10 text-indigo-700 border-indigo-500/20' },
};

export const ENTITY_LABELS: Record<string, string> = {
  User: 'Użytkownik',
  Course: 'Przedmiot',
  Room: 'Sala',
  Teacher: 'Prowadzący',
  Group: 'Grupa',
  ScheduleEntry: 'Wpis w planie',
  CourseAllocation: 'Przydział prowadzącego',
  Institute: 'Jednostka',
  StaffingRequest: 'Zapotrzebowanie (wakat)',
  Semester: 'Semestr',
  Major: 'Kierunek',
};

export const FIELD_LABELS: Record<string, string> = {
  name: 'Nazwa',
  firstName: 'Imię',
  lastName: 'Nazwisko',
  title: 'Tytuł/Stopień',
  email: 'E-mail',
  role: 'Rola w systemie',
  unit: 'Jednostka',
  pensumLimit: 'Roczne pensum (godziny)',
  assignedHours: 'Przydzielone godziny',
  classType: 'Typ zajęć',
  hoursTotal: 'Liczba godzin',
  targetGroupsCount: 'Liczba grup',
  ectsCredits: 'Punkty ECTS',
  code: 'Kod',
  building: 'Budynek',
  number: 'Numer sali',
  capacity: 'Pojemność (miejsc)',
  type: 'Typ',
  shortCode: 'Kod skrócony',
  usosCode: 'Kod USOS',
  dayOfWeek: 'Dzień tygodnia',
  startTime: 'Godzina rozpoczęcia',
  endTime: 'Godzina zakończenia',
  weekType: 'Typ tygodnia',
  notes: 'Uwagi / Notatki',
  status: 'Status',
  requestedGroups: 'Liczba wnioskowanych grup',
};

const DAY_NAMES = ['', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];

// ─── Formatowanie podsumowania (One-line summary) ────────────────────────────

export interface AuditSummaryResult {
  title: string;
  details?: string;
}

export function getAuditSummary(log: {
  action: string;
  entityType: string | null;
  oldData: any;
  newData: any;
  metadata: any;
}): AuditSummaryResult {
  const { action, entityType, oldData, newData, metadata } = log;
  const data = newData || oldData || {};

  // 1. Zdarzenia uwierzytelniania
  if (action === 'LOGIN_SUCCESS') {
    return {
      title: 'Pomyślne logowanie',
      details: metadata?.email ? `Konto: ${metadata.email} (${metadata.role || 'użytkownik'})` : undefined,
    };
  }
  if (action === 'LOGIN_FAILURE') {
    const reasonText = metadata?.reason === 'invalid_password' ? 'Błędne hasło' : 'Nieznany użytkownik';
    return {
      title: 'Nieudana próba logowania',
      details: `${reasonText} (${metadata?.email || 'brak emaila'})`,
    };
  }
  if (action === 'LOGOUT') {
    return { title: 'Wylogowanie z systemu' };
  }
  if (action === 'PASSWORD_CHANGE' || action === 'PASSWORD_RESET') {
    return {
      title: action === 'PASSWORD_RESET' ? 'Zresetowano hasło użytkownika' : 'Zmieniono hasło profilu',
      details: data?.email ? `Użytkownik: ${data.email}` : undefined,
    };
  }
  if (action === 'ROLE_CHANGE') {
    return {
      title: 'Zmieniono rolę użytkownika',
      details: oldData?.role && newData?.role ? `${oldData.role} ➔ ${newData.role}` : undefined,
    };
  }

  // 2. Przydziały (CourseAllocation)
  if (entityType === 'CourseAllocation') {
    const teacherName = data.teacher
      ? `${data.teacher.title || ''} ${data.teacher.firstName || ''} ${data.teacher.lastName || ''}`.trim()
      : (data.teacherName || 'Prowadzący');
    const hours = data.assignedHours ? `${data.assignedHours}h` : '';
    const groupsCount = Array.isArray(data.groups) ? data.groups.length : 0;
    const groupsText = groupsCount > 0 ? `${groupsCount} ${groupsCount === 1 ? 'grupa' : groupsCount < 5 ? 'grupy' : 'grup'}` : '';

    if (action === 'CREATE') {
      return {
        title: `Przydzielono: ${teacherName}`,
        details: [hours, groupsText].filter(Boolean).join(' • '),
      };
    }
    if (action === 'UPDATE') {
      return {
        title: `Zaktualizowano przydział: ${teacherName}`,
        details: hours ? `Wymiar: ${hours}` : undefined,
      };
    }
    if (action === 'DELETE') {
      return {
        title: `Usunięto przydział: ${teacherName}`,
        details: hours ? `Było: ${hours}` : undefined,
      };
    }
  }

  // 3. Wpisy w harmonogramie (ScheduleEntry)
  if (entityType === 'ScheduleEntry') {
    const day = data.dayOfWeek ? DAY_NAMES[data.dayOfWeek] || `Dzień ${data.dayOfWeek}` : '';
    const time = data.startTime && data.endTime ? `${data.startTime}-${data.endTime}` : '';
    const courseName = data.course?.name || data.courseName || '';
    const room = data.room ? `s. ${data.room.number}` : '';
    const teacher = data.teacher ? `${data.teacher.firstName?.[0] || ''}. ${data.teacher.lastName || ''}`.trim() : '';

    const summaryParts = [day, time, room, teacher].filter(Boolean).join(' • ');

    if (action === 'CREATE') {
      return {
        title: courseName ? `Nowy wpis: ${courseName}` : 'Dodano zajęcia do planu',
        details: summaryParts,
      };
    }
    if (action === 'UPDATE') {
      return {
        title: courseName ? `Zmieniono wpis: ${courseName}` : 'Edycja wpisu w planie',
        details: summaryParts,
      };
    }
    if (action === 'DELETE') {
      return {
        title: courseName ? `Usunięto wpis: ${courseName}` : 'Usunięto zajęcia z planu',
        details: summaryParts,
      };
    }
  }

  // 4. Prowadzący (Teacher)
  if (entityType === 'Teacher') {
    const name = `${data.title || ''} ${data.firstName || ''} ${data.lastName || ''}`.trim() || data.email || 'Prowadzący';
    const unit = data.unit ? `(${data.unit})` : '';

    if (action === 'CREATE') return { title: `Dodano prowadzącego: ${name}`, details: unit };
    if (action === 'UPDATE') return { title: `Edytowano prowadzącego: ${name}`, details: unit };
    if (action === 'DELETE') return { title: `Usunięto prowadzącego: ${name}`, details: unit };
  }

  // 5. Przedmioty (Course)
  if (entityType === 'Course') {
    const name = data.name || data.code || 'Przedmiot';
    const code = data.code ? `[${data.code}]` : '';

    if (action === 'CREATE') return { title: `Dodano przedmiot: ${name}`, details: code };
    if (action === 'UPDATE') return { title: `Edytowano przedmiot: ${name}`, details: code };
    if (action === 'DELETE') return { title: `Usunięto przedmiot: ${name}`, details: code };
  }

  // 6. Sale (Room)
  if (entityType === 'Room') {
    const roomStr = `Sala ${data.number || ''} ${data.building ? `(${data.building})` : ''}`.trim();
    if (action === 'CREATE') return { title: `Dodano salę: ${roomStr}` };
    if (action === 'UPDATE') return { title: `Edytowano salę: ${roomStr}` };
    if (action === 'DELETE') return { title: `Usunięto salę: ${roomStr}` };
  }

  // 7. Grupy (Group)
  if (entityType === 'Group') {
    const name = data.name || 'Grupa';
    if (action === 'CREATE') return { title: `Dodano grupę: ${name}` };
    if (action === 'UPDATE') return { title: `Edytowano grupę: ${name}` };
    if (action === 'DELETE') return { title: `Usunięto grupę: ${name}` };
  }

  // 8. Jednostki (Institute)
  if (entityType === 'Institute') {
    const name = data.name || data.shortCode || 'Jednostka';
    if (action === 'CREATE') return { title: `Dodano jednostkę: ${name}` };
    if (action === 'UPDATE') return { title: `Edytowano jednostkę: ${name}` };
    if (action === 'DELETE') return { title: `Usunięto jednostkę: ${name}` };
  }

  // 9. Zapotrzebowania (StaffingRequest)
  if (entityType === 'StaffingRequest') {
    const reqText = `${data.requestedGroups || 1} gr. (${data.status || 'NOWE'})`;
    if (action === 'CREATE') return { title: `Zgłoszono zapotrzebowanie na wakat`, details: reqText };
    if (action === 'UPDATE') return { title: `Zaktualizowano zapotrzebowanie`, details: reqText };
    if (action === 'DELETE') return { title: `Usunięto zapotrzebowanie`, details: reqText };
  }

  // 10. Użytkownicy (User)
  if (entityType === 'User') {
    const name = data.name || data.email || 'Użytkownik';
    const role = data.role ? `Rola: ${data.role}` : '';
    if (action === 'CREATE') return { title: `Utworzono użytkownika: ${name}`, details: role };
    if (action === 'UPDATE') return { title: `Edytowano użytkownika: ${name}`, details: role };
    if (action === 'DELETE') return { title: `Usunięto użytkownika: ${name}`, details: role };
  }

  // Domyślny fallback
  const actionName = ACTION_LABELS[action]?.label || action;
  const entityName = entityType ? (ENTITY_LABELS[entityType] || entityType) : '';
  return {
    title: `${actionName} ${entityName}`.trim(),
    details: data.name || data.code || data.email || undefined,
  };
}

// ─── Inteligentne grupowanie grup studenckich ────────────────────────────────

export interface GroupedMajorSummary {
  majorCode: string;
  majorName?: string;
  year?: number;
  groups: string[];
}

export function parseAndGroupStudentGroups(rawGroups: any[]): GroupedMajorSummary[] {
  if (!Array.isArray(rawGroups) || rawGroups.length === 0) return [];

  const map = new Map<string, GroupedMajorSummary>();

  for (const item of rawGroups) {
    const g = item.group || item;
    if (!g) continue;

    const majorCode = g.major?.code || g.majorCode || (g.name ? g.name.split(' ')[0] : 'Inne');
    const majorName = g.major?.name || g.majorName;
    const year = g.year || (g.name?.match(/rok\s*(\d+)/i)?.[1] ? parseInt(g.name.match(/rok\s*(\d+)/i)[1], 10) : undefined);
    
    // Wytnij numer grupy lub krótką nazwę (np. "gr. 2" albo "S1-LSN (rok 2) gr. 2" -> "gr. 2")
    let groupLabel = g.name || 'gr.';
    const grMatch = g.name?.match(/gr\.\s*\d+/i);
    if (grMatch) {
      groupLabel = grMatch[0];
    }

    const key = `${majorCode}|${year || 0}`;
    if (!map.has(key)) {
      map.set(key, {
        majorCode,
        majorName,
        year,
        groups: [],
      });
    }

    const entry = map.get(key)!;
    if (!entry.groups.includes(groupLabel)) {
      entry.groups.push(groupLabel);
    }
  }

  // Posortuj grupy alfabetycznie/numerycznie
  return Array.from(map.values()).map(entry => ({
    ...entry,
    groups: entry.groups.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
  }));
}

// ─── Ekstrakcja zmienionych pól dla UPDATE ───────────────────────────────────

export interface FieldDiff {
  key: string;
  label: string;
  oldValue: any;
  newValue: any;
}

export function extractFieldDiffs(oldData: any, newData: any): FieldDiff[] {
  if (!oldData || !newData) return [];

  const diffs: FieldDiff[] = [];
  const ignoredKeys = new Set([
    'id', 'createdAt', 'updatedAt', 'version', 'passwordHash',
    'instituteId', 'facultyId', 'semesterId', 'courseId', 'teacherId', 'roomId',
    'groupIds', 'allocations', 'entries', 'groups', 'majors', 'teacher', 'course', 'room'
  ]);

  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

  for (const key of allKeys) {
    if (ignoredKeys.has(key)) continue;

    const oldVal = oldData[key];
    const newVal = newData[key];

    // Porównanie wartości prostych lub dat
    const oldStr = oldVal instanceof Date ? oldVal.toISOString() : JSON.stringify(oldVal);
    const newStr = newVal instanceof Date ? newVal.toISOString() : JSON.stringify(newVal);

    if (oldStr !== newStr) {
      diffs.push({
        key,
        label: FIELD_LABELS[key] || key,
        oldValue: oldVal === undefined || oldVal === null ? '—' : formatValueForDisplay(key, oldVal),
        newValue: newVal === undefined || newVal === null ? '—' : formatValueForDisplay(key, newVal),
      });
    }
  }

  return diffs;
}

function formatValueForDisplay(key: string, value: any): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Tak' : 'Nie';
  if (key === 'dayOfWeek' && typeof value === 'number') return DAY_NAMES[value] || String(value);
  if (key === 'assignedHours' || key === 'hoursTotal' || key === 'pensumLimit') return `${value} godz.`;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
