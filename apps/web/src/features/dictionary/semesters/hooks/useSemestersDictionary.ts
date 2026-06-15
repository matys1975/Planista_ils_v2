import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { fetchSemesters, createSemester, updateSemester, toggleSemesterLock, deleteSemester } from '../api';
import type { Semester } from '../types';
import type { SemesterFormData } from '../schema';

export type DialogMode =
    | { state: 'closed' }
    | { state: 'creating' }
    | { state: 'editing'; id: string };

export function useSemestersDictionary() {
    const [dialogMode, setDialogMode] = useState<DialogMode>({ state: 'closed' });
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ['semesters'],
        queryFn: fetchSemesters,
    });

    const composeInvalidate = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['semesters'] });
        queryClient.invalidateQueries({ queryKey: ['dictionaries'] });
    }, [queryClient]);

    const createMutation = useMutation({
        mutationFn: createSemester,
        onSuccess: () => {
            composeInvalidate();
            toast.success('Dodano pomyślnie');
            setDialogMode({ state: 'closed' });
        },
        onError: (err: any) => toast.error(`Błąd: ${err.message}`),
    });

    const updateMutation = useMutation({
        mutationFn: updateSemester,
        onSuccess: () => {
            composeInvalidate();
            toast.success('Zapisano zmiany');
            setDialogMode({ state: 'closed' });
        },
        onError: (err: any) => toast.error(`Błąd zapisu: ${err.message}`),
    });

    const toggleLockMutation = useMutation({
        mutationFn: toggleSemesterLock,
        onSuccess: composeInvalidate,
        onError: (err: any) => toast.error(`Błąd: ${err.message}`),
    });

    const toggleLock = useCallback(
        (id: string, isLocked: boolean) => {
            toggleLockMutation.mutate({ id, isLocked: !isLocked });
        },
        [toggleLockMutation]
    );

    const deleteMutation = useMutation({
        mutationFn: deleteSemester,
        onSuccess: () => {
            composeInvalidate();
            toast.success('Semestr usunięty');
        },
        onError: (err: any) => toast.error(`Nie można usunąć: ${err.message}`),
    });

    const openCreate = useCallback(() => setDialogMode({ state: 'creating' }), []);
    const openEdit = useCallback((semester: Semester) => setDialogMode({ state: 'editing', id: semester.id }), []);
    const closeDialog = useCallback(() => setDialogMode({ state: 'closed' }), []);

    const editingSemester =
        dialogMode.state === 'editing'
            ? data?.data.find((s) => s.id === dialogMode.id) ?? null
            : null;

    const isCreating = dialogMode.state === 'creating';
    const isDialogOpen = dialogMode.state !== 'closed';

    const handleSubmit = useCallback(
        (formData: SemesterFormData) => {
            if (dialogMode.state === 'editing') {
                updateMutation.mutate({ ...formData, id: dialogMode.id });
            } else {
                createMutation.mutate(formData);
            }
        },
        [dialogMode, createMutation, updateMutation]
    );

    return {
        semesters: data?.data ?? [],
        isLoading,
        dialogMode,
        isDialogOpen,
        isCreating,
        editingSemester,
        openCreate,
        openEdit,
        closeDialog,
        handleSubmit,
        isSubmitting: createMutation.isPending || updateMutation.isPending,
        toggleLock,
        deleteSemester: deleteMutation.mutate,
        isDeleting: deleteMutation.isPending,
    };
}
