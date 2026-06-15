import { Pencil, Trash2, Search, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type { Teacher } from '../../types/models';

interface TeachersTableProps {
  teachers: Teacher[];
  isLoading: boolean;
  onEdit: (teacher: Teacher) => void;
  onDelete: (id: string) => void;
  onAllocate: (teacher: Teacher) => void;
  onPreview: (teacher: Teacher) => void;
  onPrint: (teacher: Teacher) => void;
  onPrintSchedule: (teacher: Teacher) => void;
}

export function TeachersTable({
  teachers,
  isLoading,
  onEdit,
  onDelete,
  onAllocate,
  onPreview,
  onPrint,
  onPrintSchedule,
}: TeachersTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Prowadzący</TableHead>
          <TableHead>Przydziały</TableHead>
          <TableHead className="text-right">Akcje</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow>
            <TableCell colSpan={3} className="text-center h-24">Ładowanie danych...</TableCell>
          </TableRow>
        ) : teachers.length === 0 ? (
          <TableRow>
            <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">Brak prowadzących w bazie danych.</TableCell>
          </TableRow>
        ) : teachers.map((teacher: Teacher) => (
          <TableRow key={teacher.id} className="transition-colors hover:bg-muted/50 odd:bg-cream dark:odd:bg-navy-deep/50 even:bg-background border-b border-border/50">
            <TableCell>
              <TeacherInfoCell teacher={teacher} />
            </TableCell>
            <TableCell>
              <TeacherAllocationCell teacher={teacher} onAllocate={onAllocate} />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex gap-1 justify-end">
                <Button variant="ghost" size="icon" onClick={() => onPrintSchedule(teacher)} className="hover:bg-status-warning-bg hover:text-status-warning-fg h-8 w-8" title="Drukuj Plan Zajęć">
                  <Calendar className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onPrint(teacher)} className="hover:bg-navy-mid/10 hover:text-navy-mid h-8 w-8" title="Drukuj Wstępny Przydział">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-printer"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect width="12" height="8" x="6" y="14" /></svg>
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onPreview(teacher)} className="hover:bg-status-active-bg hover:text-status-active-fg h-8 w-8" title="Podgląd obciążenia">
                  <Search className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onEdit(teacher)} className="hover:bg-primary/10 hover:text-primary h-8 w-8" title="Edytuj dane">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(teacher.id)} className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8" title="Usuń">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TeacherInfoCell({ teacher }: { teacher: Teacher }) {
  const assignedHours = (teacher as any).allocations?.reduce((sum: number, alloc: any) => sum + (alloc.assignedHours || 0), 0) || 0;
  const pensumPct = teacher.pensumLimit > 0 ? Math.min(100, Math.round((assignedHours / teacher.pensumLimit) * 100)) : 0;
  const isOver = assignedHours > teacher.pensumLimit;

  return (
    <div className="flex flex-col gap-1">
      <div>
        <span className="font-bold text-[14px] text-foreground">{teacher.firstName} {teacher.lastName}</span>
        {teacher.title && <span className="text-[11px] font-medium italic text-primary/70 ml-1.5">{teacher.title}</span>}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="px-2 py-0.5 bg-primary/10 border border-primary/20 rounded text-[10px] font-bold text-primary">{teacher.unit}</span>
        <div className="flex items-center gap-1.5">
          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden" title={`${Math.round(assignedHours)}h / ${teacher.pensumLimit}h`}>
            <div
              className={`h-full rounded-full transition-all ${isOver ? 'bg-destructive' : 'bg-status-active-fg'}`}
              style={{ width: `${pensumPct}%` }}
            />
          </div>
          <span className={`text-[10px] font-bold ${isOver ? 'text-destructive' : 'text-muted-foreground'}`}>
            {Math.round(assignedHours)}h / {teacher.pensumLimit}h
          </span>
        </div>
      </div>
    </div>
  );
}

function TeacherAllocationCell({ teacher, onAllocate }: { teacher: Teacher; onAllocate: (t: Teacher) => void }) {
  const allocations = (teacher as any).allocations ?? [];
  return (
    <div className="flex flex-col gap-2 items-start">
      <button
        type="button"
        onClick={() => onAllocate(teacher)}
        className="text-xs bg-muted/50 border hover:bg-muted text-muted-foreground px-2 py-1 rounded"
      >
        {allocations.length > 0
          ? <span className="font-bold text-primary">{allocations.length} przedmiot(ów) (Edytuj)</span>
          : 'Brak (Przypisz)'}
      </button>

      {allocations.length > 0 && (
        <div className="flex flex-wrap gap-2 w-full mt-1.5">
          {allocations.slice(0, 5).map((alloc: any) => (
            <div key={alloc.id} className="text-[10px] bg-primary/5 border border-primary/20 shadow-sm rounded-md p-1.5 min-w-[120px] max-w-[200px]">
              <div className="flex justify-between items-start gap-1">
                <div className="font-bold text-primary leading-tight truncate" title={alloc.course.name}>{alloc.course.name}</div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${(alloc.classType || alloc.course.type) === 'W' ? 'bg-status-info-bg/20 text-navy-dark' :
                      (alloc.classType || alloc.course.type) === 'C' ? 'bg-status-warning-bg/20 text-status-warning-fg' :
                        'bg-muted text-muted-foreground'
                    }`}>{alloc.classType || alloc.course.type}</span>
                  <div className="text-[9px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded whitespace-nowrap">{alloc.assignedHours || 30}h</div>
                </div>
              </div>
              {alloc.groups?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5 pt-1.5 border-t border-black/5 dark:border-white/5">
                  {alloc.groups.map((g: any) => (
                    <span key={g.groupId} className="text-[9px] bg-secondary/60 text-secondary-foreground px-1.5 py-0.5 rounded shadow-sm border border-border/50">
                      {g.group.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {allocations.length > 5 && <span className="text-[10px] text-muted-foreground">i {allocations.length - 5} więcej...</span>}
        </div>
      )}
    </div>
  );
}
