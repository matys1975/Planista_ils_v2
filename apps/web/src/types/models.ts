export interface Semester {
  id: string;
  name: string;
  year: string;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CourseOnMajor {
  courseId: string;
  majorId: string;
  year: number;
  major?: Major;
}

export interface Major {
  id: string;
  code: string;
  name: string;
  degree: string;
  years: number;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  type: 'W' | 'C' | 'L' | 'S' | 'Pr' | 'K';
  ectsCredits: number;
  hoursTotal?: number;
  targetGroupsCount?: number;
  semesterId: string;
  semester?: Semester;
  majors: CourseOnMajor[];
  allocations?: any[];
}

export interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
  title: string | null;
  email: string;
  unit: string | null;
  pensumLimit: number;
  color?: string | null;
}

export interface Group {
  id: string;
  name: string;
  major: string;
  year: number;
  degree: string;
  studentCount: number;
  semesterId: string;
}

export interface Room {
  id: string;
  name: string;
  building: string;
  number: string;
  capacity: number;
  type: string;
}

export interface ScheduleEntry {
  id: string;
  courseId: string;
  teacherId: string;
  roomId: string;
  semesterId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  weekType: 'A' | 'B' | 'AB';
  color?: string | null;
  course?: Course;
  teacher?: Teacher;
  room?: Room;
  groups?: { groupId: string; group: Group }[];
}

export interface User {
  id: string;
  email: string;
  role: 'ADMIN' | 'PLANNER' | 'VIEWER';
}
