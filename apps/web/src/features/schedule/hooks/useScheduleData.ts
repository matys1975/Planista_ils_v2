import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { fetchEntries, fetchDictionaries } from '../api';

export function useScheduleData(
    selectedSemester: string,
    viewMode: 'major' | 'room' | 'teacher',
    selectedMajor: string,
    selectedRoomId: string,
    selectedTeacherId: string,
    selectedYear: string
) {
    // ── Queries ────────────────────────────────────────────────────────────
    const { data: dicts, isLoading: isLoadingDicts } = useQuery({
        queryKey: ['dictionaries'],
        queryFn: fetchDictionaries,
    });

    useEffect(() => {
        if (!selectedSemester && dicts?.semesters?.length) {
            const winter2026 = dicts.semesters.find(
                (s: any) => s.type === 'zimowy' && s.year === 2026
            );
            // Autoselect handled by parent setter via returned default
        }
    }, [dicts, selectedSemester]);

    const { data: entriesResponse } = useQuery({
        queryKey: ['entries', selectedSemester],
        queryFn: () => fetchEntries(selectedSemester),
        enabled: !!selectedSemester,
    });

    const allEntries = entriesResponse?.data || [];

    // ── Filtered entries ───────────────────────────────────────────────────
    const entries = useMemo(() => {
        return allEntries.filter((e: any) => {
            if (viewMode === 'room') {
                return selectedRoomId ? e.roomId === selectedRoomId : false;
            }

            if (viewMode === 'teacher') {
                return selectedTeacherId ? e.teacherId === selectedTeacherId : false;
            }

            const majorMatch = selectedMajor
                ? e.groups?.some((g: any) => {
                    const majorCode = g.major?.code || g.majorName || '';
                    const groupName = g.name || '';
                    if (groupName && groupName.startsWith(selectedMajor)) return true;
                    return majorCode === selectedMajor;
                })
                : true;

            const yearMatch = selectedYear
                ? e.groups?.some((g: any) => g.year === parseInt(selectedYear))
                : true;

            return majorMatch && yearMatch;
        });
    }, [allEntries, selectedMajor, selectedYear, viewMode, selectedRoomId, selectedTeacherId]);

    return { dicts, isLoadingDicts, allEntries, entries };
}
