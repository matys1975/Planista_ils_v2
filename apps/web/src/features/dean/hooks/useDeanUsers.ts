import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '../../../lib/api';
import type { DeanUser } from '../types/dean.types';

interface UsersQueryParams {
    search?: string;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    role?: string;
    instituteId?: string;
}

export function useDeanUsers(params: UsersQueryParams = {}) {
    const { search, sortBy, sortDir, role, instituteId } = params;
    const queryString = new URLSearchParams();
    if (search) queryString.set('search', search);
    if (sortBy) queryString.set('sortBy', sortBy);
    if (sortDir) queryString.set('sortDir', sortDir);
    if (role) queryString.set('role', role);
    if (instituteId) queryString.set('instituteId', instituteId);

    return useQuery<{ data: DeanUser[] }>({
        queryKey: ['dean-users', search, sortBy, sortDir, role, instituteId],
        queryFn: () => fetchApi(`/dean/users?${queryString.toString()}`),
    });
}
