import { describe, it, expect } from 'vitest';
import { calculateTeacherWorkload, calculateAllWorkloads } from './workloadService';

describe('workloadService', () => {
  const mockTeacher = {
    id: 't1',
    firstName: 'Jan',
    lastName: 'Kowalski',
    title: 'dr',
    unit: 'Zakład',
    pensumLimit: 210,
  };

  it('calculates workload correctly for AB weekType', () => {
    const entries = [
      {
        id: 'e1',
        course: { name: 'Matematyka', type: 'W' },
        teacherId: 't1',
        room: { building: 'A', number: '101' },
        groups: [{ group: { name: 'G1' } }],
        weekType: 'AB',
        startTime: '08:00',
        endTime: '09:30',
        dayOfWeek: 1,
      }
    ];

    const result = calculateTeacherWorkload(mockTeacher, entries);
    expect(result.plannedHours).toBe(30); // 15 weeks * 2 hours * 1
    expect(result.breakdown[0].hours).toBe(30);
    expect(result.teacher.name).toBe('dr Jan Kowalski');
  });

  it('calculates workload correctly for A or B weekType', () => {
    const entries = [
      {
        id: 'e1',
        course: { name: 'Matematyka', type: 'W' },
        teacherId: 't1',
        room: { building: 'A', number: '101' },
        groups: [{ group: { name: 'G1' } }],
        weekType: 'A',
        startTime: '08:00',
        endTime: '09:30',
        dayOfWeek: 1,
      }
    ];

    const result = calculateTeacherWorkload(mockTeacher, entries);
    expect(result.plannedHours).toBe(15); // 15 weeks * 2 hours * 0.5
    expect(result.breakdown[0].hours).toBe(15);
  });

  it('handles empty entries list', () => {
    const result = calculateTeacherWorkload(mockTeacher, []);
    expect(result.plannedHours).toBe(0);
    expect(result.breakdown.length).toBe(0);
  });

  it('calculates workload for multiple entries', () => {
    const entries = [
      {
        id: 'e1',
        course: { name: 'Matematyka', type: 'W' },
        teacherId: 't1',
        room: { building: 'A', number: '101' },
        groups: [{ group: { name: 'G1' } }],
        weekType: 'AB',
        startTime: '08:00',
        endTime: '09:30',
        dayOfWeek: 1,
      },
      {
        id: 'e2',
        course: { name: 'Fizyka', type: 'L' },
        teacherId: 't1',
        room: { building: 'B', number: '202' },
        groups: [{ group: { name: 'G2' } }],
        weekType: 'B',
        startTime: '10:00',
        endTime: '11:30',
        dayOfWeek: 2,
      }
    ];

    const result = calculateTeacherWorkload(mockTeacher, entries);
    expect(result.plannedHours).toBe(45); // 30 + 15
    expect(result.breakdown.length).toBe(2);
  });

  it('filters entries by teacherId', () => {
    const entries = [
      {
        id: 'e1',
        course: { name: 'Matematyka', type: 'W' },
        teacherId: 't1',
        room: { building: 'A', number: '101' },
        groups: [{ group: { name: 'G1' } }],
        weekType: 'AB',
        startTime: '08:00',
        endTime: '09:30',
        dayOfWeek: 1,
      },
      {
        id: 'e2',
        course: { name: 'Inny przedmiot', type: 'W' },
        teacherId: 't2', // Inny prowadzący
        room: { building: 'A', number: '101' },
        groups: [{ group: { name: 'G2' } }],
        weekType: 'AB',
        startTime: '10:00',
        endTime: '11:30',
        dayOfWeek: 1,
      }
    ];

    const result = calculateTeacherWorkload(mockTeacher, entries);
    expect(result.plannedHours).toBe(30);
    expect(result.breakdown.length).toBe(1);
    expect(result.breakdown[0].id).toBe('e1');
  });

  it('calculateAllWorkloads returns results for all teachers', () => {
    const teachers = [
      mockTeacher,
      { ...mockTeacher, id: 't2', firstName: 'Adam', lastName: 'Nowak' }
    ];
    const entries = [
      {
        id: 'e1',
        course: { name: 'M1', type: 'W' },
        teacherId: 't1',
        room: { building: 'A', number: '1' },
        groups: [],
        weekType: 'AB',
        startTime: '8:00',
        endTime: '9:30',
        dayOfWeek: 1,
      },
      {
        id: 'e2',
        course: { name: 'M2', type: 'W' },
        teacherId: 't2',
        room: { building: 'A', number: '1' },
        groups: [],
        weekType: 'AB',
        startTime: '10:00',
        endTime: '11:30',
        dayOfWeek: 1,
      }
    ];

    const results = calculateAllWorkloads(teachers, entries);
    expect(results.length).toBe(2);
    expect(results[0].plannedHours).toBe(30);
    expect(results[1].plannedHours).toBe(30);
  });

  it('handles teacher name without title', () => {
    const teacher = { ...mockTeacher, title: null };
    const result = calculateTeacherWorkload(teacher, []);
    expect(result.teacher.name).toBe('Jan Kowalski');
  });
});

