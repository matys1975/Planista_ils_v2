import { useState, useEffect } from 'react';

import { useScheduleData } from './hooks/useScheduleData';
import { useEntryForm } from './hooks/useEntryForm';

export function useScheduleGrid() {
    // ── Filters & View State ───────────────────────────────────────────────
    const [selectedSemester, setSelectedSemester] = useState('');
    const [viewMode, setViewMode] = useState<'major' | 'room' | 'teacher'>('major');
    const [selectedMajor, setSelectedMajor] = useState('S1-LSN');
    const [selectedRoomId, setSelectedRoomId] = useState('');
    const [selectedTeacherId, setSelectedTeacherId] = useState('');
    const [selectedYear, setSelectedYear] = useState('1');

    // ── Data ───────────────────────────────────────────────────────────────
    const { dicts, isLoadingDicts, allEntries, entries } = useScheduleData(
        selectedSemester,
        viewMode,
        selectedMajor,
        selectedRoomId,
        selectedTeacherId,
        selectedYear
    );

    // Autoselect semester on load
    useEffect(() => {
        if (!selectedSemester && dicts?.semesters?.length) {
            const winter2026 = dicts.semesters.find(
                (s: any) => s.type === 'zimowy' && s.year === 2026
            );
            setSelectedSemester(winter2026 ? winter2026.id : dicts.semesters[0].id);
        }
    }, [dicts, selectedSemester]);

    // ── Form + Modal + DnD + Mutations ─────────────────────────────────────
    const form = useEntryForm({ selectedSemester, allEntries, dicts });

    return {
        // State
        selectedSemester,
        setSelectedSemester,
        viewMode,
        setViewMode,
        selectedMajor,
        setSelectedMajor,
        selectedRoomId,
        setSelectedRoomId,
        selectedTeacherId,
        setSelectedTeacherId,
        selectedYear,
        setSelectedYear,
        isModalOpen: form.isModalOpen,
        setIsModalOpen: form.setIsModalOpen,
        slotContext: form.slotContext,
        apiError: form.apiError,
        apiConflicts: form.apiConflicts,
        editingEntry: form.editingEntry,
        selectedGroups: form.selectedGroups,
        isLoadingDicts,

        // Data
        dicts,
        entries,
        allEntries,

        // Form
        register: form.register,
        handleSubmit: form.handleSubmit,
        reset: form.reset,
        setValue: form.setValue,
        watch: form.watch,
        errors: form.errors,
        seasonWarning: form.seasonWarning,
        roomOptions: form.roomOptions,

        // Mutations (re-exported for backward compat)
        createMutation: form.createMutation,
        updateMutation: form.updateMutation,
        deleteMutation: form.deleteMutation,

        // Actions
        toggleGroup: form.toggleGroup,
        openSlotSelection: form.openSlotSelection,
        closeModal: form.closeModal,
        onSubmit: form.onSubmit,
        openEditEntry: form.openEditEntry,
        handleDragEnd: form.handleDragEnd,
    };
}
