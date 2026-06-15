import { useState } from 'react';
import { Trash2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { Course, Teacher, Group } from '../../types/models';

// Maps a group's major to its code (e.g. 'S1-LSN')
function getGroupMajorCode(group: any): string {
  // Jeśli mamy już obiekt Major z kodem, używamy go bezpośrednio
  if (group.major?.code) return group.major.code;
  
  const isS1 = group.degree === 'I stopnia' || group.degree === 'Jednolite';
  const prefix = isS1 ? 'S1' : 'S2';
  const m = (group.majorName || '').toLowerCase();
  if (m.includes('niemiecki z angielskim')) return `${prefix}-LSN`;
  if (m.includes('angielski z niemieckim')) return `${prefix}-LSA`;
  if (m.includes('komputerowa')) return `${prefix}-LSlk`;
  if (m.includes('intercultural')) return `${prefix}-LSal`;
  if (m.includes('empirical')) return `${prefix}-LSel`;
  return '';
}

interface CourseAllocationSheetProps {
  course: Course | null;
  teachersData: any;
  groupsData: any;
  isCreating: boolean;
  onClose: () => void;
  onCreateAllocation: (data: { courseId: string; teacherId: string; groupIds: string[]; assignedHours: number; classType?: string | null }) => void;
  onDeleteAllocation: (allocId: string) => void;
  onUpdateAllocation: (data: { allocId: string; assignedHours: number; classType?: string | null }) => void;
  onCreateStaffingRequest: (data: { courseId: string; requestedGroups: number; notes: string }) => void;
}

export function CourseAllocationSheet({
  course,
  teachersData,
  groupsData,
  isCreating,
  onClose,
  onCreateAllocation,
  onDeleteAllocation,
  onUpdateAllocation,
  onCreateStaffingRequest,
}: CourseAllocationSheetProps) {
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('');
  const [isTeacherDropdownOpen, setIsTeacherDropdownOpen] = useState(false);
  const [allocAssignedHours, setAllocAssignedHours] = useState(course?.hoursTotal || 30);
  const [allocClassType, setAllocClassType] = useState<string>('');

  // Staffing request state
  const [reqGroups, setReqGroups] = useState<number>(1);
  const [reqNotes, setReqNotes] = useState('');

  const handleClose = () => {
    setSelectedTeacherId('');
    setSelectedGroupIds([]);
    setTeacherSearchQuery('');
    setIsTeacherDropdownOpen(false);
    setAllocClassType('');
    onClose();
  };

  const handleSubmitAllocation = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!course || !selectedTeacherId) return;
    onCreateAllocation({
      courseId: course.id,
      teacherId: selectedTeacherId,
      groupIds: selectedGroupIds,
      assignedHours: allocAssignedHours,
      classType: allocClassType || null,
    });
    setSelectedTeacherId('');
    setSelectedGroupIds([]);
    setTeacherSearchQuery('');
    setAllocAssignedHours(course.hoursTotal || 30);
    setAllocClassType('');
  };

  const handleSubmitRequest = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!course) return;
    onCreateStaffingRequest({
      courseId: course.id,
      requestedGroups: reqGroups,
      notes: reqNotes,
    });
    setReqGroups(1);
    setReqNotes('');
  };

  const filteredGroups = groupsData?.data?.filter((g: any) => {
    const groupCode = getGroupMajorCode(g);
    const courseMajors = course?.majors || [];
    // Show all groups if course has no major restrictions
    return courseMajors.length === 0 || courseMajors.some((cm: any) =>
      cm.major?.code === groupCode && cm.year === g.year
    );
  });

  const groupedByYear = filteredGroups?.reduce((acc: any, g: any) => {
    const degStr = typeof g.degree === 'string' ? g.degree.toUpperCase() : g.degree;
    const yearStr = `${g.year} ROK (${degStr})`;
    if (!acc[yearStr]) acc[yearStr] = [];
    acc[yearStr].push(g);
    return acc;
  }, {});

  const filteredTeachers = teachersData?.data?.filter((t: Teacher) => {
    const search = teacherSearchQuery.toLowerCase();
    return t.lastName.toLowerCase().includes(search) ||
      t.firstName.toLowerCase().includes(search) ||
      (t.title && t.title.toLowerCase().includes(search));
  }) || [];

  return (
    <Sheet open={!!course} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <SheetContent
        side="right"
        className="w-[100vw] sm:max-w-xl overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <SheetHeader className="pb-4">
          <SheetTitle>Przydziały Prowadzących i Grup do zajęć</SheetTitle>
          <p className="text-sm text-muted-foreground">Powiąż ten konkretny przedmiot z wykładowcą oraz grupą.</p>
        </SheetHeader>

        {course && (
          <div className="flex-1 overflow-y-auto pr-4">
            <div className="mb-4">
              <h3 className="font-bold text-lg">{course.name}</h3>
              <p className="text-sm text-muted-foreground">Typ: {course.type} | Semestr: {(course as any).semester?.name}</p>
              <div className="bg-navy-mid/10 border-navy-mid/30 text-blue-800 border p-3 rounded-lg mt-3 text-sm">
                W tym miejscu możesz odgórnie przypisać określonego prowadzącego (oraz docelowe grupy) do tego przedmiotu.
              </div>
            </div>

            <div className="space-y-4">
              {/* Formularz nowego przydziału */}
              <div className="border p-4 bg-muted/20 rounded-xl">
                <h4 className="font-semibold text-sm mb-3">Dodaj nowy przydział</h4>
                <form onSubmit={handleSubmitAllocation} className="space-y-3">
                  <div>
                    <Label>Prowadzący *</Label>
                    <input type="hidden" name="teacherId" value={selectedTeacherId} required />
                    <div className="relative mt-1">
                      <Input
                        placeholder="Wpisz nazwisko, imię lub tytuł..."
                        value={teacherSearchQuery}
                        onChange={(e) => {
                          setTeacherSearchQuery(e.target.value);
                          setSelectedTeacherId('');
                          setIsTeacherDropdownOpen(true);
                        }}
                        onFocus={() => setIsTeacherDropdownOpen(true)}
                        onBlur={() => setTimeout(() => setIsTeacherDropdownOpen(false), 200)}
                        className="w-full bg-background"
                      />
                      {isTeacherDropdownOpen && (
                        <div className="absolute z-50 w-full mt-1 bg-popover border text-popover-foreground shadow-md rounded-md max-h-60 overflow-y-auto">
                          {filteredTeachers.length === 0 ? (
                            <div className="p-3 text-sm text-muted-foreground italic text-center">Brak wyników wyszukiwania</div>
                          ) : filteredTeachers.map((t: Teacher) => (
                            <div
                              key={t.id}
                              className="px-3 py-2 text-sm hover:bg-muted cursor-pointer border-b last:border-0"
                              onClick={() => {
                                setSelectedTeacherId(t.id);
                                setTeacherSearchQuery(`${t.title || ''} ${t.firstName} ${t.lastName}`.trim());
                                setIsTeacherDropdownOpen(false);
                              }}
                            >
                              <div className="font-semibold">{t.lastName} {t.firstName} <span className="font-normal text-muted-foreground ml-1">({t.title})</span></div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">{t.unit} | Pensum: {t.pensumLimit}h</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label>Grupy studenckie (Zaznacz odpowiednie kafelki)</Label>
                    {selectedGroupIds.map(id => (
                      <input key={id} type="hidden" name="groupIds" value={id} />
                    ))}
                    <div className="mt-2 space-y-3 p-3 border rounded-md bg-muted/10 max-h-[200px] overflow-y-auto">
                      {!groupedByYear || Object.keys(groupedByYear).length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Brak zdefiniowanych grup.</p>
                      ) : (
                        Object.keys(groupedByYear).sort().map(year => (
                          <div key={year} className="space-y-1 mt-2 first:mt-0">
                            <div className="text-xs font-bold text-muted-foreground uppercase mb-1">{year}</div>
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {groupedByYear[year].map((g: Group) => {
                                const isSelected = selectedGroupIds.includes(g.id);
                                return (
                                  <button
                                    key={g.id}
                                    type="button"
                                    onClick={() => setSelectedGroupIds(prev =>
                                      isSelected ? prev.filter(id => id !== g.id) : [...prev, g.id]
                                    )}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-all ${
                                      isSelected
                                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                        : 'bg-background hover:bg-muted border-border text-muted-foreground'
                                    }`}
                                  >
                                    {g.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="mt-2">
                    <Label>Godziny prowadzącego</Label>
                    <Input
                      type="number" min="0" max="500"
                      value={allocAssignedHours}
                      onChange={(e) => setAllocAssignedHours(parseInt(e.target.value) || 0)}
                      className="bg-background text-center font-bold mt-1 w-24"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">Ile godzin z tego przedmiotu dostaje prowadzący</p>
                  </div>

                  <div className="mt-2">
                    <Label>Typ zajęć dla tego przydziału</Label>
                    <select
                      value={allocClassType}
                      onChange={(e) => setAllocClassType(e.target.value)}
                      className="mt-1 h-9 w-full px-3 text-sm rounded bg-background border outline-none"
                    >
                      <option value="">Domyślny ({course?.type || '?'})</option>
                      <option value="W">W — Wykład</option>
                      <option value="C">C — Ćwiczenia</option>
                      <option value="L">L — Laboratorium</option>
                      <option value="S">S — Seminarium</option>
                      <option value="Pr">Pr — Praktyki</option>
                      <option value="K">K — Konwersacje</option>
                    </select>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Zmień tylko jeśli przedmiot ma różne formy (np. wykład + ćwiczenia)</p>
                  </div>

                  <Button type="submit" size="sm" className="w-full" disabled={isCreating}>
                    Dodaj Przydział
                  </Button>
                </form>
              </div>

              {/* Lista istniejących przydziałów */}
              <div className="mt-6 border-t pt-4">
                <h4 className="font-semibold text-sm mb-3">Obecne przydziały do przedmiotu</h4>
                {!course.allocations?.length ? (
                  <p className="text-xs text-muted-foreground italic">Brak skonfigurowanych przypisań.</p>
                ) : (
                  <div className="space-y-2">
                    {course.allocations.map((alloc: any) => (
                      <div key={alloc.id} className="border p-3 rounded-lg bg-card shadow-sm flex items-center justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="font-bold text-sm">{alloc.teacher.lastName} {alloc.teacher.firstName}</div>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              (alloc.classType || course?.type) === 'W' ? 'bg-status-info-bg0/15 text-navy-dark border border-navy-mid/30' :
                              (alloc.classType || course?.type) === 'C' ? 'bg-status-warning-bg0/15 text-status-warning-fg border border-status-warning-fg/30' :
                              (alloc.classType || course?.type) === 'L' ? 'bg-status-active-bg0/15 text-status-active-fg border border-status-active-fg/30' :
                              'bg-muted text-muted-foreground border'
                            }`}>
                              {alloc.classType || course?.type}
                            </span>
                          </div>
                          {alloc.groups?.length > 0 ? (
                            <div className="mt-1 flex gap-1 flex-wrap">
                              {alloc.groups.map((g: Group) => (
                                <span key={(g as any).groupId} className="text-[10px] bg-muted px-1.5 py-0.5 rounded border">{(g as any).group.name}</span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-orange-500 block mt-1">Brak wskazanych grup (Wszyscy)</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <input
                            type="number" min="0" max="500"
                            defaultValue={alloc.assignedHours || 30}
                            className="w-14 text-center text-xs font-bold border rounded px-1 py-1 bg-background"
                            onBlur={(e) => {
                              const newVal = parseInt(e.target.value) || 0;
                              if (newVal !== (alloc.assignedHours || 30)) {
                                onUpdateAllocation({ allocId: alloc.id, assignedHours: newVal });
                              }
                            }}
                          />
                          <span className="text-[10px] text-muted-foreground">h</span>
                        </div>
                        <button
                          type="button"
                          className="ml-1 p-1.5 rounded text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
                          onClick={() => onDeleteAllocation(alloc.id)}
                          title="Usuń przydział"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sekcja zgłoszenia wakatów */}
              <div className="mt-6 border-t pt-4">
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <span className="bg-orange-500/10 text-orange-600 p-1 rounded"><AlertCircle className="h-4 w-4" /></span>
                  Zgłoś zapotrzebowanie (Wakat)
                </h4>
                <div className="bg-orange-50/50 border border-orange-200/50 p-4 rounded-xl">
                  <p className="text-xs text-muted-foreground mb-3">
                    Jeśli brakuje Ci prowadzących do obsady zajęć, możesz zgłosić wakat, który będzie widoczny w Panelu Wydziałowym.
                  </p>
                  <form onSubmit={handleSubmitRequest} className="space-y-3">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-1">
                        <Label>Liczba grup</Label>
                        <Input 
                          type="number" min="1" max="20" 
                          value={reqGroups} 
                          onChange={e => setReqGroups(parseInt(e.target.value) || 1)} 
                          required 
                          className="mt-1"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label>Uwagi (np. wymagania)</Label>
                        <Input 
                          placeholder="Np. native speaker" 
                          value={reqNotes} 
                          onChange={e => setReqNotes(e.target.value)} 
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <Button type="submit" variant="outline" size="sm" className="w-full border-orange-200 text-orange-700 hover:bg-orange-50">
                      Zgłoś zapotrzebowanie
                    </Button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
