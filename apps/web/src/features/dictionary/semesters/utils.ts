import type { SemesterType } from './types';
import type { SemesterFormData } from './schema';

/**
 * Generuje domyślne wartości formularza semestru na podstawie typu i roku.
 * Pure function – zastępuje useEffect + useForm setValue.
 */
export function deriveSemesterDefaults(year: number, type: SemesterType): Omit<SemesterFormData, 'isLocked'> {
    const nextY = year + 1;
    const typeLabel = type === 'zimowy' ? 'Zimowy' : 'Letni';
    const name = `Semestr ${typeLabel} ${year}/${nextY.toString().slice(-2)}`;

    if (type === 'zimowy') {
        return {
            name,
            year,
            type,
            dateStart: `${year}-10-01`,
            dateEnd: `${nextY}-02-28`,
        };
    }
    return {
        name,
        year,
        type,
        dateStart: `${nextY}-03-01`,
        dateEnd: `${nextY}-06-30`,
    };
}
