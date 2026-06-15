export interface DeanDashboardCounts {
    institutesCount: number;
    teachersCount: number;
    coursesCount: number;
    usersCount: number;
    allocationsCount: number;
    majorsCount: number;
    groupsCount: number;
    roomsCount: number;
}

export interface ActiveSemester {
    id: string;
    name: string;
    year: number;
    type: string;
}

export interface WorkloadItem {
    id: string;
    name: string;
    institute: string;
    pensumLimit: number;
    totalHours: number;
    balance: number;
    utilizationPercent: number;
}

export interface DeanAlerts {
    overloaded: number;
    underloaded: number;
    unassignedCourses: number;
}

export interface DeanDashboardData {
    counts: DeanDashboardCounts;
    activeSemesters: ActiveSemester[];
    workloadSummary: WorkloadItem[];
    alerts: DeanAlerts;
}

export interface DeanInstitute {
    id: string;
    name: string;
    shortCode: string | null;
    usosCode: string | null;
    facultyId: string | null;
    createdAt: string;
    updatedAt: string;
    _count: {
        users: number;
        courses: number;
        teachers: number;
        rooms: number;
        groups: number;
        majors: number;
        allocations: number;
    };
    users: { id: string; name: string; role: string; lastLoginAt: string | null }[];
    adminCount?: number;
}

export interface InstituteAdmin {
    id: string;
    name: string;
    email: string;
    lastLoginAt: string | null;
}

export interface InstituteAdminCoverage {
    id: string;
    name: string;
    shortCode: string | null;
    usosCode: string | null;
    facultyId: string | null;
    _count: { users: number };
    adminCount: number;
    admins: InstituteAdmin[];
    hasAdmin: boolean;
}

export interface DeanWorkload {
    id: string;
    name: string;
    institute: string;
    shortCode: string;
    pensumLimit: number;
    totalHours: number;
    balance: number;
    utilizationPercent: number;
    isOverloaded: boolean;
    isUnderloaded: boolean;
    isOk: boolean;
    allocationCount: number;
}

export interface DeanResourceRoom {
    id: string;
    building: string;
    number: string;
    type: string;
    capacity: number;
    usedSlots: number;
    utilizationPercent: number;
    status: 'ok' | 'warning' | 'collision';
    institute: string;
}

export interface DeanResourceGroup {
    id: string;
    name: string;
    major: string;
    degree: string;
    year: number;
    size: number;
    semester: string;
    allocationCount: number;
    institute: string;
}

export interface DeanResourceMajor {
    id: string;
    code: string;
    name: string;
    degree: string;
    years: number;
    groupsCount: number;
    coursesCount: number;
    institute: string;
}

export interface DeanUser {
    id: string;
    name: string;
    email: string;
    role: string;
    institute: string;
    shortCode: string;
    lastLoginAt: string | null;
    createdAt: string;
    activityStatus: 'active' | 'recent' | 'inactive';
    facultyId: string | null;
}

export type SortDir = 'asc' | 'desc';

export interface SortState {
    by: string;
    dir: SortDir;
}
