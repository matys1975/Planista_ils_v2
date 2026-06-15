import { fetchApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import type { Room } from '../../../types/models';
import type { RoomFormData } from './schema';

export function fetchRooms() {
    return fetchApi<{ data: Room[] }>('/rooms');
}

export function createRoom(data: RoomFormData) {
    return fetchApi('/rooms', { method: 'POST', body: JSON.stringify(data) });
}

export function updateRoom(data: RoomFormData & { id: string }) {
    const { id, ...payload } = data;
    return fetchApi(`/rooms/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export interface RoomDeleteConflict {
    error: string;
    entriesCount: number;
    entries: Array<{
        id: string;
        course: string;
        teacher: string;
        day: number;
        time: string;
        semester: string;
    }>;
}

export type RoomDeleteResult =
    | { success: true; deletedEntries: number }
    | { conflict: true; data: RoomDeleteConflict };

/**
 * Attempts to delete a room. If force=false and the room has schedule entries,
 * returns conflict info instead of throwing. If force=true, cascade-deletes entries.
 */
export async function deleteRoom(id: string, force = false): Promise<RoomDeleteResult> {
    const query = force ? '?force=true' : '';
    const url = `/api/v1/rooms/${id}${query}`;

    const headers: Record<string, string> = {};
    const simulatedId = useAuthStore.getState().simulatedInstituteId;
    if (simulatedId) {
        headers['X-Simulate-Institute'] = simulatedId;
    }

    const response = await fetch(url, {
        method: 'DELETE',
        credentials: 'include',
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
    });

    const data = await response.json().catch(() => null);

    if (response.status === 409 && data?.entriesCount) {
        return { conflict: true, data: data as RoomDeleteConflict };
    }

    if (!response.ok) {
        throw new Error(data?.error || `Błąd usuwania sali (${response.status})`);
    }

    return { success: true, deletedEntries: data?.deletedEntries || 0 };
}
