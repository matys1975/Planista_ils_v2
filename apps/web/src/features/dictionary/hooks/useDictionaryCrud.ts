import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export type DialogMode =
    | { state: 'closed' }
    | { state: 'creating' }
    | { state: 'editing'; id: string };

interface UseDictionaryCrudOptions<T extends { id: string }, FormT> {
    queryKey: string;
    fetchFn: () => Promise<{ data: T[] }>;
    createFn: (data: FormT) => Promise<unknown>;
    updateFn: (data: FormT & { id: string }) => Promise<unknown>;
    deleteFn: (id: string) => Promise<unknown>;
    invalidateKeys?: string[];
    successMessages?: {
        create?: string;
        update?: string;
        delete?: string;
    };
}

export function useDictionaryCrud<T extends { id: string }, FormT>(options: UseDictionaryCrudOptions<T, FormT>) {
    const {
        queryKey,
        fetchFn,
        createFn,
        updateFn,
        deleteFn,
        invalidateKeys = [],
        successMessages = {},
    } = options;

    const [dialogMode, setDialogMode] = useState<DialogMode>({ state: 'closed' });
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery<{ data: T[] }>({ queryKey: [queryKey], queryFn: fetchFn });

    const invalidate = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
        for (const key of invalidateKeys) {
            queryClient.invalidateQueries({ queryKey: [key] });
        }
    }, [queryClient, queryKey, invalidateKeys]);

    const createMutation = useMutation({
        mutationFn: createFn,
        onSuccess: () => {
            invalidate();
            toast.success(successMessages.create || 'Dodano pomyślnie');
            setDialogMode({ state: 'closed' });
        },
        onError: (err: any) => toast.error(err.message || 'Błąd dodawania'),
    });

    const updateMutation = useMutation({
        mutationFn: updateFn,
        onSuccess: () => {
            invalidate();
            toast.success(successMessages.update || 'Zapisano zmiany');
            setDialogMode({ state: 'closed' });
        },
        onError: (err: any) => toast.error(err.message || 'Błąd zapisu'),
    });

    const deleteMutation = useMutation({
        mutationFn: deleteFn,
        onSuccess: () => {
            invalidate();
            toast.success(successMessages.delete || 'Usunięto');
        },
        onError: (err: any) => toast.error(err.message || 'Błąd usuwania'),
    });

    const openCreate = useCallback(() => setDialogMode({ state: 'creating' }), []);
    const openEdit = useCallback((item: T) => setDialogMode({ state: 'editing', id: item.id }), []);
    const closeDialog = useCallback(() => setDialogMode({ state: 'closed' }), []);

    const editingItem =
        dialogMode.state === 'editing'
            ? data?.data.find((s) => s.id === dialogMode.id) ?? null
            : null;

    const isDialogOpen = dialogMode.state !== 'closed';

    const handleSubmit = useCallback(
        (formData: FormT) => {
            if (dialogMode.state === 'editing') {
                updateMutation.mutate({ ...formData, id: dialogMode.id } as FormT & { id: string });
            } else {
                createMutation.mutate(formData);
            }
        },
        [dialogMode, createMutation, updateMutation]
    );

    return {
        items: data?.data ?? [],
        isLoading,
        dialogMode,
        isDialogOpen,
        editingItem,
        openCreate,
        openEdit,
        closeDialog,
        handleSubmit,
        isSubmitting: createMutation.isPending || updateMutation.isPending,
        deleteItem: deleteMutation.mutate,
        isDeleting: deleteMutation.isPending,
    };
}
