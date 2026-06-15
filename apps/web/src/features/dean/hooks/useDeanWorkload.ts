import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '../../../lib/api';
import type { DeanWorkload } from '../types/dean.types';

interface WorkloadQueryParams {
    semesterId?: string;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    status?: string;
    unit?: string;
    units?: string[];
    search?: string;
}

export function useDeanWorkload(params: WorkloadQueryParams = {}) {
    const { semesterId, sortBy, sortDir, status, unit, units, search } = params;
    const queryString = new URLSearchParams();
    if (semesterId) queryString.set('semesterId', semesterId);
    if (sortBy) queryString.set('sortBy', sortBy);
    if (sortDir) queryString.set('sortDir', sortDir);
    if (status) queryString.set('status', status);
    if (unit) queryString.set('unit', unit);
    if (units && units.length > 0) queryString.set('units', units.join(','));
    if (search) queryString.set('search', search);

    return useQuery<{ data: DeanWorkload[] }>({
        queryKey: ['dean-workload', semesterId, sortBy, sortDir, status, unit, units, search],
        queryFn: () => fetchApi(`/dean/workload?${queryString.toString()}`),
    });
}
