import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '../../../lib/api';
import type { DeanDashboardData } from '../types/dean.types';

export function useDeanDashboard() {
    return useQuery<{ data: DeanDashboardData }>({
        queryKey: ['dean-dashboard'],
        queryFn: () => fetchApi('/dean/dashboard'),
        refetchInterval: 60_000, // auto-refresh co 60s
        staleTime: 30_000,
    });
}
