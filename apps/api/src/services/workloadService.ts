import { WEEKS_IN_SEMESTER, HOURS_PER_SLOT } from '../config/constants';

interface Entry {
  id: string;
  course: { name: string; type: string };
  teacherId: string;
  room: { building: string; number: string };
  groups: { group: { name: string } }[];
  weekType: string;
  startTime: string;
  endTime: string;
  dayOfWeek: number;
  effectiveType?: string; // classType override z alokacji lub course.type
}

interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
  title: string | null;
  unit: string | null;
  pensumLimit: number;
}

export function calculateTeacherWorkload(teacher: Teacher, entries: Entry[]) {
  const teacherEntries = entries.filter(e => e.teacherId === teacher.id);
  
  let plannedHours = 0;
  const breakdown = teacherEntries.map(entry => {
    // Każdy slot to 2h, jeśli tydz. A lub B -> dzielimy na 2.
    const mutliplier = entry.weekType === 'AB' ? 1 : 0.5;
    const totalEntryHours = HOURS_PER_SLOT * WEEKS_IN_SEMESTER * mutliplier;
    plannedHours += totalEntryHours;

    return {
      id: entry.id,
      course: entry.course.name,
      type: entry.effectiveType || entry.course.type,
      weekType: entry.weekType,
      startTime: entry.startTime,
      endTime: entry.endTime,
      dayOfWeek: entry.dayOfWeek,
      room: `${entry.room.building} ${entry.room.number}`,
      groups: entry.groups.map(g => g.group.name).join(', '),
      hours: totalEntryHours
    };
  });

  return {
    teacher: {
      id: teacher.id,
      name: `${teacher.title ? teacher.title + ' ' : ''}${teacher.firstName} ${teacher.lastName}`.trim(),
      unit: teacher.unit,
    },
    pensumLimit: teacher.pensumLimit,
    plannedHours,
    breakdown
  };
}

export function calculateAllWorkloads(teachers: Teacher[], entries: Entry[]) {
  return teachers.map(t => calculateTeacherWorkload(t, entries));
}
