import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DragEndEvent } from '@dnd-kit/core';

import { entrySchema, type EntryFormData } from '../types';
import { doTimesOverlap, doWeeksOverlap } from '../utils';

interface UseEntryFormDeps {
    selectedSemester: string;
    allEntries: any[];
    dicts: any;
}

export function useEntryForm({ selectedSemester, allEntries, dicts }: UseEntryFormDeps) {
    const queryClient = useQueryClient();

    // ── Modal State ────────────────────────────────────────────────────────
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [slotContext, setSlotContext] = useState<{ day: number; start: string; end: string } | null>(null);
    const [apiError, setApiError] = useState('');
    const [apiConflicts, setApiConflicts] = useState<string[]>([]);
    const [editingEntry, setEditingEntry] = useState<any>(null);
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

    // ── Form ───────────────────────────────────────────────────────────────
    const {
        register,
        handleSubmit,
        reset,
        setValue,
        watch,
        formState: { errors },
    } = useForm<EntryFormData>({
        resolver: zodResolver(entrySchema),
        defaultValues: { groupIds: [], weekType: 'AB' },
    });

    const currentDay = watch('dayOfWeek');
    const currentStart = watch('startTime');
    const currentEnd = watch('endTime');
    const currentWeek = watch('weekType');
    const currentCourseId = watch('courseId');

    // ── Derived lookups ──────────────────────────────────────────────────
    const selectedCourseObj = dicts?.courses?.find((c: any) => c.id === currentCourseId);
    const selectedSemesterObj = dicts?.semesters?.find((s: any) => s.id === selectedSemester);

    // ── Derived: season warning ────────────────────────────────────────────
    const seasonWarning = useMemo(() => {
        if (selectedCourseObj?.studySemester && selectedSemesterObj?.type) {
            const isGridWinter = selectedSemesterObj.type === 'zimowy';
            const isCourseWinter = selectedCourseObj.studySemester % 2 === 1;
            if (isGridWinter !== isCourseWinter) {
                return `Uwaga: przypisujesz przedmiot z semestru ${isCourseWinter ? 'zimowego' : 'letniego'} (sem. ${selectedCourseObj.studySemester}) do siatki semestru ${isGridWinter ? 'zimowego' : 'letniego'}!`;
            }
        }
        return null;
    }, [selectedCourseObj, selectedSemesterObj]);

    // ── Derived: occupied rooms ────────────────────────────────────────────
    const occupiedRooms = useMemo(() => {
        if (!currentDay || !currentStart || !currentEnd) return new Map<string, any>();

        const overlappingEntries = allEntries.filter((e: any) => {
            if (editingEntry && e.id === editingEntry.id) return false;
            if (e.dayOfWeek !== Number(currentDay)) return false;
            if (!doWeeksOverlap(currentWeek || 'AB', e.weekType)) return false;
            if (!doTimesOverlap(currentStart, currentEnd, e.startTime, e.endTime)) return false;
            return true;
        });

        const map = new Map<string, any>();
        overlappingEntries.forEach((e: any) => map.set(e.roomId, e));
        return map;
    }, [allEntries, currentDay, currentStart, currentEnd, currentWeek, editingEntry]);

    // ── Derived: room options ──────────────────────────────────────────────
    const roomOptions = useMemo(() => {
        if (!dicts?.rooms) return [];

        return dicts.rooms
            .map((r: any) => {
                const occupier = occupiedRooms.get(r.id);
                const isOccupied = !!occupier;
                let desc = `Typ: ${r.type}, Pojemność: ${r.capacity}`;
                if (isOccupied) {
                    desc = `⚠️ ZAJĘTA: ${occupier.course.name} (${occupier.teacher.lastName})`;
                } else if (currentDay && currentStart) {
                    desc = `✅ WOLNA | ${desc}`;
                }
                return {
                    value: r.id,
                    label: `${r.number}${r.building}`,
                    description: desc,
                    isOccupied,
                };
            })
            .sort((a: any, b: any) => {
                if (a.isOccupied && !b.isOccupied) return 1;
                if (!a.isOccupied && b.isOccupied) return -1;
                return a.label.localeCompare(b.label);
            });
    }, [dicts?.rooms, occupiedRooms, currentDay, currentStart]);

    // ── Mutations ──────────────────────────────────────────────────────────
    const invalidateAfterChange = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['entries'] });
        queryClient.invalidateQueries({ queryKey: ['workload'] });
        queryClient.invalidateQueries({ queryKey: ['dictionaries'] });
    }, [queryClient]);

    const createMutation = useMutation({
        mutationFn: async (data: EntryFormData) => {
            const res = await fetch('/api/v1/entries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const json = await res.json();
            if (!res.ok) throw { status: res.status, data: json };
            return json;
        },
        onSuccess: () => {
            invalidateAfterChange();
            closeModal();
        },
        onError: (err: any) => {
            console.error('API Error details:', err.data);
            if (err.status === 409) {
                setApiError(err.data.error || 'Kolizja harmonogramu!');
                setApiConflicts(err.data.conflicts || []);
            } else {
                setApiError(`Wystąpił błąd podczas zapisu: ${JSON.stringify(err.data?.details || err.data?.error || err)}`);
                setApiConflicts([]);
            }
        },
    });

    const updateMutation = useMutation({
        mutationFn: async (params: { id: string; data: Partial<EntryFormData> & { force?: boolean } }) => {
            const res = await fetch(`/api/v1/entries/${params.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params.data),
            });
            const json = await res.json();
            if (!res.ok) throw { status: res.status, data: json };
            return json;
        },
        onSuccess: () => {
            invalidateAfterChange();
            if (isModalOpen) closeModal();
        },
        onError: (err: any, variables: any) => {
            console.error('Update API Error details:', err.data);
            if (err.status === 409) {
                if (isModalOpen) {
                    setApiError(err.data.error || 'Kolizja harmonogramu!');
                    setApiConflicts(err.data.conflicts || []);
                } else {
                    if (
                        window.confirm(
                            `Wykryto kolizje:\n${(err.data.conflicts || []).join('\n')}\n\nCzy chcesz wymusić przesunięcie mimo to (przydatne dla fakultetów)?`
                        )
                    ) {
                        updateMutation.mutate({ ...variables, data: { ...variables.data, force: true } });
                    }
                }
            } else {
                if (isModalOpen) {
                    setApiError(`Wystąpił błąd podczas zapisu: ${JSON.stringify(err.data?.details || err.data?.error || err)}`);
                    setApiConflicts([]);
                } else {
                    toast.error('Wystąpił nieoczekiwany błąd podczas przesuwania.');
                }
            }
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await fetch(`/api/v1/entries/${id}`, { method: 'DELETE' });
        },
        onSuccess: () => {
            invalidateAfterChange();
        },
    });

    // ── Actions ────────────────────────────────────────────────────────────
    const toggleGroup = useCallback(
        (id: string) => {
            setSelectedGroups((prev) => {
                const updated = prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id];
                setValue('groupIds', updated);
                return updated;
            });
        },
        [setValue]
    );

    const openSlotSelection = useCallback(
        (dayId: number, slot: { id: number; start: string; end: string }) => {
            if (!selectedSemester) {
                toast.warning('Wybierz najpierw semestr!');
                return;
            }
            setApiError('');
            setApiConflicts([]);
            setSelectedGroups([]);
            reset();
            setSlotContext({ day: dayId, start: slot.start, end: slot.end });
            setValue('semesterId', selectedSemester);
            setValue('dayOfWeek', dayId);
            setValue('startTime', slot.start);
            setValue('endTime', slot.end);
            setValue('weekType', 'AB');
            setIsModalOpen(true);
        },
        [selectedSemester, reset, setValue]
    );

    const closeModal = useCallback(() => {
        setIsModalOpen(false);
        setSlotContext(null);
        setApiError('');
        setEditingEntry(null);
    }, []);

    const onSubmit = useCallback(
        (data: EntryFormData) => {
            setApiError('');
            setApiConflicts([]);
            const payload = { ...data, dayOfWeek: Number(data.dayOfWeek) };
            if (editingEntry) {
                updateMutation.mutate({ id: editingEntry.id, data: payload });
            } else {
                createMutation.mutate(payload);
            }
        },
        [editingEntry, createMutation, updateMutation]
    );

    const openEditEntry = useCallback(
        (entry: any) => {
            setApiError('');
            setApiConflicts([]);
            setEditingEntry(entry);
            const entryGroups = entry.groups.map((g: any) => g.id);
            setSelectedGroups(entryGroups);
            reset();
            setSlotContext({ day: entry.dayOfWeek, start: entry.startTime, end: entry.endTime });
            setValue('semesterId', entry.semesterId);
            setValue('courseId', entry.courseId);
            setValue('teacherId', entry.teacherId);
            setValue('roomId', entry.roomId);
            setValue('dayOfWeek', entry.dayOfWeek);
            setValue('startTime', entry.startTime);
            setValue('endTime', entry.endTime);
            setValue('weekType', entry.weekType);
            setValue('classType', entry.classType);
            setValue('groupIds', entryGroups);
            setIsModalOpen(true);
        },
        [reset, setValue]
    );

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over } = event;
            if (!over) return;

            // Upuszczając Przydział z bocznego paska
            if (active.data.current?.type === 'course_template') {
                const course = active.data.current.course;
                const alloc = active.data.current.alloc;
                const targetSlot = over.data.current;
                if (!targetSlot) return;

                setApiError('');
                setApiConflicts([]);
                setEditingEntry(null);
                const allocGroupIds = alloc.groups.map((g: any) => g.groupId);
                setSelectedGroups(allocGroupIds);
                reset();
                setSlotContext({
                    day: targetSlot.dayOfWeek,
                    start: targetSlot.startTime,
                    end: targetSlot.endTime,
                });
                setValue('semesterId', selectedSemester);
                setValue('courseId', course.id);
                setValue('teacherId', alloc.teacherId);
                setValue('groupIds', allocGroupIds);
                setValue('dayOfWeek', targetSlot.dayOfWeek);
                setValue('startTime', targetSlot.startTime);
                setValue('endTime', targetSlot.endTime);
                setValue('weekType', 'AB');
                setValue('classType', alloc.classType || course.type);
                setIsModalOpen(true);
                return;
            }

            // Istniejący wpis – bezpośredni update (przesunięcie)
            const draggedEntry = active.data.current?.entry;
            if (!draggedEntry) return;
            const targetSlot = over.data.current;
            if (!targetSlot) return;
            if (
                draggedEntry.dayOfWeek === targetSlot.dayOfWeek &&
                draggedEntry.startTime === targetSlot.startTime
            ) return;

            updateMutation.mutate({
                id: draggedEntry.id,
                data: {
                    semesterId: draggedEntry.semesterId,
                    courseId: draggedEntry.courseId,
                    teacherId: draggedEntry.teacherId,
                    roomId: draggedEntry.roomId,
                    groupIds: draggedEntry.groups.map((g: any) => g.id),
                    dayOfWeek: targetSlot.dayOfWeek,
                    startTime: targetSlot.startTime,
                    endTime: targetSlot.endTime,
                    weekType: draggedEntry.weekType,
                    classType: draggedEntry.classType,
                },
            });
        },
        [selectedSemester, reset, setValue, updateMutation]
    );

    return {
        // Modal state
        isModalOpen,
        setIsModalOpen,
        slotContext,
        apiError,
        setApiError,
        apiConflicts,
        setApiConflicts,
        editingEntry,
        selectedGroups,

        // Form methods
        register,
        handleSubmit,
        reset,
        setValue,
        watch,
        errors,

        // Derived
        seasonWarning,
        roomOptions,

        // Mutations
        createMutation,
        updateMutation,
        deleteMutation,

        // Actions
        toggleGroup,
        openSlotSelection,
        closeModal,
        onSubmit,
        openEditEntry,
        handleDragEnd,
    };
}
