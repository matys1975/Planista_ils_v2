import { CalendarDays } from 'lucide-react';
import { useSemestersDictionary } from './hooks/useSemestersDictionary';
import { SemesterFormDialog } from './components/SemesterFormDialog';
import { SemestersTable } from './components/SemestersTable';
import { useAuthStore } from '@/store/auth';

export function DictionarySemestersPage() {
    const { user } = useAuthStore();
    const isSuperAdmin = user?.role === 'SUPER_ADMIN';

    const {
        semesters,
        isLoading,
        isDialogOpen,
        isSubmitting,
        editingSemester,
        openCreate,
        openEdit,
        closeDialog,
        handleSubmit,
        toggleLock,
        deleteSemester,
    } = useSemestersDictionary();

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-card p-4 rounded-xl border shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-lg">
                        <CalendarDays className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Semestry Akademickie</h1>
                        <p className="text-muted-foreground text-sm">
                            {isSuperAdmin
                                ? 'Zarządzaj cyklami i zamykaj historyczne plany'
                                : 'Podgląd semestrów akademickich (zarządzanie: tylko Super Admin)'}
                        </p>
                    </div>
                </div>

                {isSuperAdmin && (
                    <SemesterFormDialog
                        isOpen={isDialogOpen}
                        onOpenChange={(open) => {
                            if (open) openCreate();
                            else closeDialog();
                        }}
                        onSubmit={handleSubmit}
                        editingSemester={editingSemester}
                        isSubmitting={isSubmitting}
                    />
                )}
            </div>

            <div className="bg-card rounded-xl border shadow-sm">
                <SemestersTable
                    semesters={semesters}
                    isLoading={isLoading}
                    onEdit={isSuperAdmin ? openEdit : undefined}
                    onToggleLock={isSuperAdmin ? toggleLock : undefined}
                    onDelete={isSuperAdmin ? deleteSemester : undefined}
                />
            </div>
        </div>
    );
}
