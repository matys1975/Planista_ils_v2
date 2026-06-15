import { fetchApi } from '@/lib/api';
import type { Semester } from './types';
import type { SemesterFormData } from './schema';

export function fetchSemesters() {
    return fetchApi<{ data: Semester[] }>('/semesters');
}

export function createSemester(data: SemesterFormData) {
    return fetchApi('/semesters', {
        method: 'POST',
        body: JSON.stringify({
            ...data,
            dateStart: new Date(data.dateStart).toISOString(),
            dateEnd: new Date(data.dateEnd).toISOString(),
        }),
    });
}

export function updateSemester(data: SemesterFormData & { id: string }) {
    const { id, ...payload } = data;
    return fetchApi(`/semesters/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
            ...payload,
            dateStart: new Date(payload.dateStart).toISOString(),
            dateEnd: new Date(payload.dateEnd).toISOString(),
        }),
    });
}

export function toggleSemesterLock(params: { id: string; isLocked: boolean }) {
    return fetchApi(`/semesters/${params.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isLocked: params.isLocked }),
    });
}

export function deleteSemester(id: string) {
    return fetchApi(`/semesters/${id}`, { method: 'DELETE' });
}
