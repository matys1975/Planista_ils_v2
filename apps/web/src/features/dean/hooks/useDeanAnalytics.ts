import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '../../../lib/api';
import type { AnalyticsData } from '../types/analytics.types';

export function useDeanAnalytics() {
    return useQuery<{ data: AnalyticsData }>({
        queryKey: ['dean-analytics'],
        queryFn: () => fetchApi('/dean/analytics'),
        refetchInterval: 60_000,
        staleTime: 30_000,
    });
}
