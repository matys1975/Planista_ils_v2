import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '../../../lib/api';
import type { DeanInstitute } from '../types/dean.types';

interface InstitutesQueryParams {
    search?: string;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
}

export function useDeanInstitutes(params: InstitutesQueryParams = {}) {
    const { search, sortBy, sortDir } = params;
    const queryString = new URLSearchParams();
    if (search) queryString.set('search', search);
    if (sortBy) queryString.set('sortBy', sortBy);
    if (sortDir) queryString.set('sortDir', sortDir);

    return useQuery<{ data: DeanInstitute[] }>({
        queryKey: ['dean-institutes', search, sortBy, sortDir],
        queryFn: () => fetchApi(`/dean/institutes?${queryString.toString()}`),
    });
}
