import React from 'react';
import { Pencil, Trash2, AlertCircle, CheckCircle2, Clock, ArrowUpCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Course } from '../../types/models';
import { Badge } from '@/components/ui/badge';

// Converts course type code to a human-readable label
export function decodeType(t: string): string {
  const map: Record<string, string> = {
    W: 'Wykład (W)', C: 'Ćwiczenia (C)', L: 'Laboratoria (L)',
    S: 'Seminarium (S)', Pr: 'Praktyki (Pr)', K: 'Konwersacja (K)',
  };
  return map[t] ?? t;
}

interface CoursesTableProps {
  courses: Course[];
  isLoading: boolean;
  activeMajorTab: string;
  activeYearTab: string;
  onEdit: (course: Course) => void;
  onDelete: (id: string) => void;
  onAllocate: (course: Course) => void;
}

/**
 * Calculates allocation metrics for a single course
 */
function getAllocationMetrics(course: any) {
  const allocations = course.allocations ?? [];
  const totalAssigned = allocations.reduce((sum: number, alloc: any) => sum + (alloc.assignedHours || 0), 0);
  const nominalHours = course.hoursTotal || 30;
  const expectedGroups = course.targetGroupsCount || 1;
  const expectedTotalHours = nominalHours * expectedGroups;

  let status: 'unassigned' | 'partial' | 'full' | 'over' = 'unassigned';
  if (totalAssigned === 0) status = 'unassigned';
  else if (totalAssigned < expectedTotalHours) status = 'partial';
  else if (totalAssigned === expectedTotalHours) status = 'full';
  else status = 'over';

  return { totalAssigned, expectedTotalHours, nominalHours, expectedGroups, status };
}

export function CoursesTable({
  courses,
  isLoading,
  activeMajorTab,
  activeYearTab,
  onEdit,
  onDelete,
  onAllocate,
}: CoursesTableProps) {
  const filteredCourses = courses;

  return (
    <TooltipProvider>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[100px]">Status</TableHead>
            <TableHead className="w-[120px]">Kod</TableHead>
            <TableHead>Nazwa Przedmiotu</TableHead>
            <TableHead>Kierunki</TableHead>
            <TableHead>Typ</TableHead>
            <TableHead>Obsada</TableHead>
            <TableHead>Godziny</TableHead>
            <TableHead>ECTS</TableHead>
            <TableHead className="text-right print:hidden">Akcje</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center h-24">Ładowanie danych...</TableCell>
            </TableRow>
          ) : filteredCourses.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center h-24 text-muted-foreground">Brak zdefiniowanych kursów.</TableCell>
            </TableRow>
          ) : (
            <>
              {[
                { type: 'zimowy', label: '❄️ Semestr Zimowy', headerClass: 'bg-status-info-bg/50 dark:bg-blue-900/20 text-navy-dark dark:text-blue-400 border-y-blue-200 dark:border-y-blue-800' },
                { type: 'letni', label: '☀️ Semestr Letni', headerClass: 'bg-orange-50/50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border-y-orange-200 dark:border-y-orange-800' },
                { type: 'inne', label: 'Inne / Brak semestru', headerClass: 'bg-muted/50 text-muted-foreground' }
              ].map(({ type, label, headerClass }) => {
                const semCourses = filteredCourses.filter((c: any) =>
                  type === 'inne' ? !c.semester?.type || !['zimowy', 'letni'].includes(c.semester.type.toLowerCase()) : c.semester?.type?.toLowerCase() === type
                );

                if (semCourses.length === 0) return null;

                return (
                  <React.Fragment key={type}>
                    <TableRow className={`hover:bg-transparent ${headerClass}`}>
                      <TableCell colSpan={9} className="font-bold py-2 text-sm uppercase tracking-wider">{label}</TableCell>
                    </TableRow>
                    {semCourses.map((course: any) => {
                      const metrics = getAllocationMetrics(course);

                      return (
                        <TableRow key={course.id} className="transition-colors border-b border-border/50 group">
                          {/* Status Badge */}
                          <TableCell>
                            <StatusBadge status={metrics.status} />
                          </TableCell>

                          <TableCell className="font-mono text-[11px] text-muted-foreground">{course.code}</TableCell>

                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-semibold text-[13px] group-hover:text-primary transition-colors">{course.name}</span>
                              <span className="text-[10px] text-muted-foreground">{course.semester?.name}</span>
                            </div>
                          </TableCell>

                          {/* Kierunki */}
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {course.majors && course.majors.length > 0 ? course.majors.map((m: any) => (
                                <Badge key={`${m.majorId}-${m.year}`} variant="outline" className="text-[9px] px-1.5 py-0 h-5 font-bold border-primary/20 bg-primary/5 text-primary">
                                  {m.major?.code} ({m.year}r)
                                </Badge>
                              )) : <span className="text-[10px] text-muted-foreground italic">Ogólny</span>}
                            </div>
                          </TableCell>

                          {/* Typ */}
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs font-bold cursor-help border-b border-dotted border-muted-foreground/50">{course.type}</span>
                              </TooltipTrigger>
                              <TooltipContent>{decodeType(course.type)}</TooltipContent>
                            </Tooltip>
                          </TableCell>

                          {/* Przydziały */}
                          <TableCell>
                            <AllocationCell course={course} onAllocate={onAllocate} />
                          </TableCell>

                          {/* Godziny */}
                          <TableCell>
                            <HoursCell metrics={metrics} />
                          </TableCell>

                          <TableCell className="font-bold text-sm text-center">{course.ectsCredits}</TableCell>

                          <TableCell className="text-right print:hidden">
                            <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" onClick={() => onEdit(course)} className="hover:bg-primary/10 hover:text-primary h-8 w-8">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => onDelete(course.id)} className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </>
          )}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'unassigned' | 'partial' | 'full' | 'over' }) {
  const configs = {
    unassigned: { icon: AlertCircle, label: 'Nieobsadzony', color: 'bg-destructive/10 text-destructive border-destructive/20' },
    partial: { icon: Clock, label: 'Częściowy', color: 'bg-status-warning-bg text-status-warning-fg border-status-warning-fg/20' },
    full: { icon: CheckCircle2, label: 'Obsadzony', color: 'bg-status-active-bg text-status-active-fg border-status-active-fg/20' },
    over: { icon: ArrowUpCircle, label: 'Nadmiar', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
  };

  const config = configs[status];
  const Icon = config.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-bold w-fit ${config.color}`}>
          <Icon className="h-3 w-3" />
          <span className="hidden sm:inline uppercase tracking-tight">{config.label}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>Status obsadzenia: {config.label}</TooltipContent>
    </Tooltip>
  );
}

function AllocationCell({ course, onAllocate }: { course: Course; onAllocate: (c: Course) => void }) {
  const allocations = (course as any).allocations ?? [];
  return (
    <div className="flex flex-col gap-2 items-start">
      <button
        onClick={() => onAllocate(course)}
        className="text-[10px] bg-muted/50 border hover:bg-muted text-muted-foreground px-2 py-0.5 rounded transition-colors print:hidden"
      >
        {allocations.length > 0
          ? <span className="font-bold text-primary">Edytuj obsadę ({allocations.length})</span>
          : '+ Dodaj obsadę'}
      </button>

      {allocations.length > 0 && (
        <div className="flex flex-wrap gap-1 w-full mt-0.5 max-w-[300px]">
          {allocations.map((alloc: any) => (
            <Tooltip key={alloc.id}>
              <TooltipTrigger asChild>
                <div className="text-[10px] bg-background border border-border/50 shadow-sm rounded px-1.5 py-0.5 flex items-center gap-1 cursor-default">
                  <span className="text-primary/70 font-semibold">{alloc.teacher.lastName}</span>
                  <span className="text-[8px] bg-muted px-1 rounded uppercase font-bold">{alloc.assignedHours}h</span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="p-2">
                <div className="text-xs">
                  <p className="font-bold">{alloc.teacher.firstName} {alloc.teacher.lastName}</p>
                  <p className="text-muted-foreground mt-1">Typ zajęć: {decodeType(alloc.classType || course.type)}</p>
                  <p className="text-muted-foreground">Liczba godzin: {alloc.assignedHours}h</p>
                  {alloc.groups?.length > 0 && (
                    <div className="mt-2 pt-1 border-t flex flex-wrap gap-1">
                      {alloc.groups.map((g: any) => (
                        <span key={g.groupId} className="bg-primary/10 text-primary px-1 rounded text-[10px]">{g.group.name}</span>
                      ))}
                    </div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      )}
    </div>
  );
}

function HoursCell({ metrics }: { metrics: any }) {
  const { totalAssigned, expectedTotalHours, nominalHours, expectedGroups, status } = metrics;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-bold leading-none">{totalAssigned}h</span>
        <span className="text-muted-foreground font-normal text-[10px]">/ {expectedTotalHours}h</span>
      </div>

      {/* Mini Progress Bar */}
      <div className="w-24 h-1.5 bg-muted rounded-full mt-1.5 overflow-hidden border">
        <div
          className={`h-full transition-all duration-500 ${status === 'unassigned' ? 'w-0' :
            status === 'partial' ? 'bg-status-warning-bg0' :
              status === 'full' ? 'bg-status-active-bg0' : 'bg-purple-500'
            }`}
          style={{ width: `${Math.min((totalAssigned / expectedTotalHours) * 100, 100)}%` }}
        />
      </div>

      <div className="mt-1 flex items-center gap-1">
        <Info className="h-2.5 w-2.5 text-muted-foreground" />
        <span className="text-[9px] text-muted-foreground font-medium">
          {nominalHours}h × {expectedGroups} {expectedGroups === 1 ? 'grupa' : 'grupy'}
        </span>
      </div>
    </div>
  );
}
