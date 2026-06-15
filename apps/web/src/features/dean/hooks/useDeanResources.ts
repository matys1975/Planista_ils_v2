import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '../../../lib/api';
import type { DeanResourceRoom, DeanResourceGroup, DeanResourceMajor } from '../types/dean.types';

interface ResourcesQueryParams {
    type?: 'rooms' | 'groups' | 'majors';
    semesterId?: string;
}

export function useDeanResources(params: ResourcesQueryParams = {}) {
    const { type = 'rooms', semesterId } = params;
    const queryString = new URLSearchParams();
    queryString.set('type', type);
    if (semesterId) queryString.set('semesterId', semesterId);

    return useQuery<{
        data: DeanResourceRoom[] | DeanResourceGroup[] | DeanResourceMajor[];
    }>({
        queryKey: ['dean-resources', type, semesterId],
        queryFn: () => fetchApi(`/dean/resources?${queryString.toString()}`),
    });
}
