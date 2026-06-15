// ═══════════════════════════════════════════════════════════════════
// Typy analityczne dla dashboardu wydziałowego
// ═══════════════════════════════════════════════════════════════════

export interface TeacherAlert {
    id: string;
    name: string;
    balance: number;
    pensumLimit: number;
    totalHours: number;
}

export interface InstituteComparison {
    id: string;
    name: string;
    shortCode: string;
    teachersCount: number;
    overloadedCount: number;
    underloadedCount: number;
    okCount: number;
    avgPensumUtilization: number;
    unassignedCoursesCount: number;
    coursesCount: number;
    alertLevel: 'ok' | 'warning' | 'critical';
    overloadedTeachers: TeacherAlert[];
    underloadedTeachers: TeacherAlert[];
}

export interface SummaryKPIs {
    avgPensumUtilization: number;
    instituteCount: number;
    problemInstituteCount: number;
    totalTeachers: number;
    overloadedTeachers: number;
    underloadedTeachers: number;
    okTeachers: number;
    unassignedCourses: number;
}

export interface TeachersDistribution {
    ok: number;
    overloaded: number;
    underloaded: number;
}

export interface HistogramBucket {
    range: string;
    count: number;
}

export interface ActiveSemester {
    id: string;
    name: string;
    year: number;
    type: string;
}

export interface AnalyticsData {
    institutesComparison: InstituteComparison[];
    summaryKPIs: SummaryKPIs;
    teachersDistribution: TeachersDistribution;
    workloadHistogram: HistogramBucket[];
    activeSemesters: ActiveSemester[];
}
