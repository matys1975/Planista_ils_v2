import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { BookOpen, Clock, Users, GraduationCap } from 'lucide-react';
import type { Teacher } from '../../types/models';

interface TeacherPreviewSheetProps {
  teacher: Teacher | null;
  onClose: () => void;
}

export function TeacherPreviewSheet({ teacher, onClose }: TeacherPreviewSheetProps) {
  if (!teacher) return null;

  const allocations = (teacher as any).allocations ?? [];
  const totalHours = allocations.reduce((sum: number, a: any) => sum + (a.assignedHours || 0), 0);
  const pensumLimit = teacher.pensumLimit || 210;
  const pensumPct = pensumLimit > 0 ? Math.min(100, Math.round((totalHours / pensumLimit) * 100)) : 0;
  const isOver = totalHours > pensumLimit;
  const remaining = pensumLimit - totalHours;

  // Group allocations by semester
  const bySemester: Record<string, any[]> = {};
  for (const alloc of allocations) {
    const semName = alloc.course?.semester?.name || 'Nieprzypisany semestr';
    const semYear = alloc.course?.semester?.year || '';
    const key = `${semName} (${semYear})`;
    if (!bySemester[key]) bySemester[key] = [];
    bySemester[key].push(alloc);
  }

  return (
    <Sheet open={!!teacher} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        className="w-[100vw] sm:max-w-lg overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <SheetHeader className="pb-2 no-print">
          <SheetTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            Podgląd obciążenia
          </SheetTitle>
        </SheetHeader>


        {/* SCREEN ONLY AREA */}
        <div className="mt-4">
          {/* Teacher header card */}
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-5 mb-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight">
                  {teacher.title} {teacher.firstName} {teacher.lastName}
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">{teacher.email}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{(teacher as any).unit}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`text-2xl font-black tabular-nums ${isOver ? 'text-destructive' : 'text-primary'}`}>
                  {totalHours}h
                </span>
                <span className="text-xs text-muted-foreground">z {pensumLimit}h pensum</span>
              </div>
            </div>

            {/* Big progress bar */}
            <div className="mt-4">
              <div className="w-full h-3 bg-muted rounded-full overflow-hidden shadow-inner">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isOver ? 'bg-destructive' : 'bg-status-active-fg'
                  }`}
                  style={{ width: `${pensumPct}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] font-semibold text-muted-foreground">{pensumPct}% pensum</span>
                <span className={`text-[10px] font-bold ${isOver ? 'text-destructive' : remaining <= 30 ? 'text-status-warning-fg' : 'text-status-active-fg'}`}>
                  {isOver ? `Nadwyżka: +${Math.abs(remaining)}h` : `Pozostało: ${remaining}h`}
                </span>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="border rounded-lg p-3 text-center bg-card">
              <BookOpen className="w-4 h-4 mx-auto text-primary mb-1" />
              <div className="text-lg font-bold">{allocations.length}</div>
              <div className="text-[10px] text-muted-foreground">Przydziałów</div>
            </div>
            <div className="border rounded-lg p-3 text-center bg-card">
              <Clock className="w-4 h-4 mx-auto text-status-warning-fg mb-1" />
              <div className="text-lg font-bold">{totalHours}</div>
              <div className="text-[10px] text-muted-foreground">Godzin łącznie</div>
            </div>
            <div className="border rounded-lg p-3 text-center bg-card">
              <Users className="w-4 h-4 mx-auto text-status-active-fg mb-1" />
              <div className="text-lg font-bold">
                {allocations.reduce((sum: number, a: any) => sum + (a.groups?.length || 0), 0)}
              </div>
              <div className="text-[10px] text-muted-foreground">Grup</div>
            </div>
          </div>

          {/* Allocations by semester */}
          {allocations.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Brak przydzielonych przedmiotów</p>
              <p className="text-xs mt-1">Przypisz przedmioty w zakładce "Przedmioty" lub klikając przycisk "Edytuj" przy tym prowadzącym.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(bySemester).map(([semesterKey, allocs]) => {
                const semHours = allocs.reduce((s: number, a: any) => s + (a.assignedHours || 0), 0);
                return (
                  <div key={semesterKey}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
                        📅 {semesterKey}
                      </h3>
                      <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                        {semHours}h
                      </span>
                    </div>

                    <div className="space-y-2">
                      {allocs.map((alloc: any) => (
                        <div
                          key={alloc.id}
                          className="border rounded-lg p-3 bg-card hover:bg-muted/30 transition-colors shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm leading-tight truncate" title={alloc.course?.name}>
                                {alloc.course?.name}
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                                {alloc.course?.code}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-[10px] font-bold bg-muted px-1.5 py-0.5 rounded border">
                                {alloc.classType || alloc.course?.type}
                              </span>
                              <span className="text-sm font-black text-primary tabular-nums">
                                {alloc.assignedHours || 0}h
                              </span>
                            </div>
                          </div>

                          {alloc.groups?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border/50">
                              {alloc.groups.map((g: any) => (
                                <span
                                  key={g.groupId}
                                  className="text-[9px] bg-secondary/60 text-secondary-foreground px-1.5 py-0.5 rounded shadow-sm border border-border/50 font-medium"
                                >
                                  {g.group?.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
