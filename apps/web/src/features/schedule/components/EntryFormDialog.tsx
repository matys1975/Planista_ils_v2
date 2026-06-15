import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/SearchableSelect';
import type { EntryFormData } from '../types';
import type { useScheduleGrid } from '../useScheduleGrid';

interface EntryFormDialogProps {
    hook: ReturnType<typeof useScheduleGrid>;
}

export function EntryFormDialog({ hook }: EntryFormDialogProps) {
    const {
        isModalOpen,
        closeModal,
        slotContext,
        apiError,
        apiConflicts,
        editingEntry,
        selectedGroups,
        toggleGroup,
        register,
        handleSubmit,
        errors,
        watch,
        setValue,
        onSubmit,
        seasonWarning,
        roomOptions,
        dicts,
        selectedSemester,
        createMutation,
        updateMutation,
    } = hook;

    return (
        <Dialog open={isModalOpen} onOpenChange={(setIsOpen) => !setIsOpen && closeModal()}>
            <DialogContent className="max-w-2xl" aria-describedby={undefined}>
                <DialogHeader>
                    <DialogTitle>{editingEntry ? 'Edytuj wpis' : 'Dodaj wpis w planie'} - {slotContext && `Terminarz (${slotContext.start} - ${slotContext.end})`}</DialogTitle>
                </DialogHeader>

                {apiError && (
                    <div className="bg-destructive/15 border border-destructive/30 p-4 rounded-xl flex flex-col gap-3 text-destructive mt-2 shadow-sm relative overflow-hidden">
                        <div className="flex gap-3">
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-destructive" />
                            <AlertTriangle className="w-5 h-5 shrink-0" />
                            <div className="text-sm">
                                <p className="font-bold mb-1">{apiError}</p>
                                <ul className="list-disc pl-4 space-y-1 mt-2">
                                    {apiConflicts.map((c, i) => <li key={i}>{c}</li>)}
                                </ul>
                            </div>
                        </div>
                        {apiConflicts.length > 0 && (
                            <Button
                                type="button"
                                variant="destructive"
                                className="w-full mt-2"
                                onClick={() => onSubmit({ ...watch(), force: true } as any)}
                            >
                                Wymuś zapis mimo kolizji (Fakultety/Lektoraty)
                            </Button>
                        )}
                    </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
                    <input type="hidden" {...register('semesterId')} />
                    <input type="hidden" {...register('dayOfWeek')} />
                    <input type="hidden" {...register('startTime')} />
                    <input type="hidden" {...register('endTime')} />

                    <input type="hidden" {...register('courseId')} />
                    <input type="hidden" {...register('teacherId')} />
                    <input type="hidden" {...register('roomId')} />
                    <input type="hidden" {...register('classType')} />

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Wybierz Przedmiot</Label>
                            <SearchableSelect
                                value={watch('courseId') || ''}
                                onChange={(val) => setValue('courseId', val)}
                                placeholder="Szukaj przedmiotu..."
                                options={(dicts?.courses || [])
                                    .filter((c: any) => c.semesterId === selectedSemester)
                                    .map((c: any) => ({
                                        value: c.id,
                                        label: c.name,
                                        description: `${c.code} (${c.type})`,
                                    }))}
                            />
                            {errors.courseId && <p className="text-xs text-destructive">{errors.courseId.message as string}</p>}
                            {seasonWarning && (
                                <p className="text-xs text-status-warning-fg bg-status-warning-bg p-2 rounded border border-status-warning-fg/20 font-medium">
                                    <AlertTriangle className="w-3 h-3 inline mr-1 mb-0.5" />
                                    {seasonWarning}
                                </p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>Prowadzący</Label>
                            <SearchableSelect
                                value={watch('teacherId') || ''}
                                onChange={(val) => setValue('teacherId', val)}
                                placeholder="Wyszukaj po nazwisku..."
                                options={(dicts?.teachers || []).map((t: any) => ({
                                    value: t.id,
                                    label: `${t.title} ${t.firstName} ${t.lastName}`,
                                    description: t.email,
                                }))}
                            />
                            {errors.teacherId && <p className="text-xs text-destructive">{errors.teacherId.message as string}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Wolne Sale</Label>
                            <SearchableSelect
                                value={watch('roomId') || ''}
                                onChange={(val) => setValue('roomId', val)}
                                placeholder="Wyszukaj salę..."
                                options={roomOptions}
                            />
                            {errors.roomId && <p className="text-xs text-destructive">{errors.roomId.message as string}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Rozkład w miesiącu</Label>
                            <select className="flex h-10 w-full items-center rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm font-semibold [&>option]:bg-background [&>option]:text-foreground" {...register('weekType')}>
                                <option value="AB">Co Tydzień (AB)</option>
                                <option value="A">Tygodnie Nieparzyste (A)</option>
                                <option value="B">Tygodnie Parzyste (B)</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2 border-t pt-4 mt-2">
                        <Label>Przypisane Grupy Studenckie <span className="text-muted-foreground font-normal">(zajęcia łączone → zaznacz grupy z wielu kierunków)</span></Label>
                        <div className="overflow-y-auto max-h-[180px] p-2 bg-muted/20 border rounded-lg space-y-3">
                            {(() => {
                                const semGroups = dicts?.groups?.filter((g: any) => g.semesterId === selectedSemester) || [];
                                if (semGroups.length === 0) {
                                    return <div className="text-xs text-muted-foreground p-2">Brak grup dla wybranego semestru.</div>;
                                }
                                // Grupuj per kierunek
                                const byMajor: Record<string, any[]> = {};
                                semGroups.forEach((g: any) => {
                                    const key = g.major?.code || g.majorName || 'Inne';
                                    if (!byMajor[key]) byMajor[key] = [];
                                    byMajor[key].push(g);
                                });
                                return Object.entries(byMajor).map(([major, groups]) => (
                                    <div key={major}>
                                        <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1 px-1 tracking-wider">{major}</div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                            {groups.map((g: any) => (
                                                <button
                                                    key={g.id}
                                                    type="button"
                                                    onClick={() => toggleGroup(g.id)}
                                                    className={`text-xs px-2 py-1.5 rounded-md border text-left flex justify-between ${selectedGroups.includes(g.id)
                                                        ? 'bg-primary border-primary text-primary-foreground font-medium'
                                                        : 'bg-background hover:bg-muted'
                                                        }`}
                                                >
                                                    <span className="truncate">{g.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>
                    </div>

                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="w-full mt-6">
                        {editingEntry ? 'Zapisz zmiany' : 'Zapisz w grafiku'}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
