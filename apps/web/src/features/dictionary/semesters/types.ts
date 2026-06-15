export interface Semester {
    id: string;
    name: string;
    year: number;
    type: 'zimowy' | 'letni';
    dateStart: string;
    dateEnd: string;
    isLocked: boolean;
    _count?: {
        courses?: number;
        groups?: number;
        entries?: number;
    };
}

export type SemesterType = 'zimowy' | 'letni';
