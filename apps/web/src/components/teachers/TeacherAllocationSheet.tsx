import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { Teacher, Course, Group } from '../../types/models';

interface TeacherAllocationSheetProps {
  teacher: Teacher | null;
  coursesData: any;
  groupsData: any;
  isCreating: boolean;
  onClose: () => void;
  onCreateAllocation: (data: { courseId: string; teacherId: string; groupIds: string[]; assignedHours: number; classType?: string }) => void;
  onDeleteAllocation: (allocId: string) => void;
}

export function TeacherAllocationSheet({
  teacher,
  coursesData,
  groupsData,
  isCreating,
  onClose,
  onCreateAllocation,
  onDeleteAllocation,
}: TeacherAllocationSheetProps) {
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [assignedHours, setAssignedHours] = useState<number | string>(30);
  const [classType, setClassType] = useState<string>('');
  const [courseSearchQuery, setCourseSearchQuery] = useState('');
  const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false);

  const handleClose = () => {
    setSelectedCourseId('');
    setSelectedGroupIds([]);
    setAssignedHours(30);
    setClassType('');
    setCourseSearchQuery('');
    setIsCourseDropdownOpen(false);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!teacher || !selectedCourseId) return;
    onCreateAllocation({
      courseId: selectedCourseId,
      teacherId: teacher.id,
      groupIds: selectedGroupIds,
      assignedHours: Number(assignedHours),
      classType: classType || undefined,
    });
    setSelectedCourseId('');
    setSelectedGroupIds([]);
    setAssignedHours(30);
    setClassType('');
    setCourseSearchQuery('');
  };

  const filteredCourses = coursesData?.data?.filter((c: Course) => {
    const search = courseSearchQuery.toLowerCase();
    return c.name.toLowerCase().includes(search) ||
           c.code.toLowerCase().includes(search);
  }) || [];

  return (
    <Sheet open={!!teacher} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <SheetContent
        side="right"
        className="w-[100vw] sm:max-w-xl overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <SheetHeader className="pb-4">
          <SheetTitle>Przedmioty przypisane do prowadzącego</SheetTitle>
          <p className="text-sm text-muted-foreground">Powiąż tego wykładowcę z konkretnymi kursami.</p>
        </SheetHeader>

        {teacher && (
          <div className="flex-1 overflow-y-auto pr-4">
            <div className="mb-4">
              <h3 className="font-bold text-lg">{teacher.title} {teacher.firstName} {teacher.lastName}</h3>
              <p className="text-sm text-muted-foreground">{teacher.unit} | Pensum: {teacher.pensumLimit}h</p>
            </div>

            <div className="space-y-4">
              <div className="border p-4 bg-muted/20 rounded-xl">
                <h4 className="font-semibold text-sm mb-3">Przypisz nowy przedmiot</h4>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <Label>Przedmiot *</Label>
                    <input type="hidden" name="courseId" value={selectedCourseId} required />
                    <div className="relative mt-1">
                      <Input
                        placeholder="Wpisz nazwę, kod lub kierunek..."
                        value={courseSearchQuery}
                        onChange={(e) => {
                           setCourseSearchQuery(e.target.value);
                           setSelectedCourseId('');
                           setIsCourseDropdownOpen(true);
                        }}
                        onFocus={() => setIsCourseDropdownOpen(true)}
                        onBlur={() => setTimeout(() => setIsCourseDropdownOpen(false), 200)}
                        className="w-full bg-background"
                      />
                      {isCourseDropdownOpen && (
                        <div className="absolute z-50 w-full mt-1 bg-popover border text-popover-foreground shadow-md rounded-md max-h-60 overflow-y-auto">
                          {filteredCourses.length === 0 ? (
                            <div className="p-3 text-sm text-muted-foreground italic text-center">Brak wyników wyszukiwania</div>
                          ) : filteredCourses.map((c: Course) => (
                            <div
                              key={c.id}
                              className="px-3 py-2 text-sm hover:bg-muted cursor-pointer border-b last:border-0"
                              onClick={() => {
                                 setSelectedCourseId(c.id);
                                 setCourseSearchQuery(`[${c.code}] ${c.name}`);
                                 setAssignedHours(c.hoursTotal || 30);
                                 setIsCourseDropdownOpen(false);
                              }}
                            >
                               <div className="font-semibold">{c.name}</div>
                               <div className="text-[10px] text-muted-foreground font-mono mb-1">{c.code}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label>Grupy studenckie (Zaznacz odpowiednie kafelki)</Label>
                    <div className="mt-2 space-y-3 p-3 border rounded-md bg-muted/10 max-h-[200px] overflow-y-auto">
                      {(() => {
                        const selCourse = selectedCourseId ? coursesData?.data?.find((c: Course) => c.id === selectedCourseId) : null;
                        const courseMajors = selCourse?.majors?.map((m: any) => m.major?.code) || [];
                        const courseYear = selCourse?.studySemester ? Math.ceil(selCourse.studySemester / 2) : null;

                        const filteredGroups = groupsData?.data?.filter((g: any) => {
                          if (!selCourse) return true;
                          const isS1 = g.degree === 'I stopnia' || g.degree === 'Jednolite';
                          const prefix = isS1 ? 'S1' : 'S2';
                          let groupCode = g.major?.code || '';
                          
                          if (!groupCode) {
                            const m = (g.majorName || '').toLowerCase();
                            if (m.includes('niemiecki z angielskim')) groupCode = `${prefix}-LSN`;
                            else if (m.includes('angielski z niemieckim')) groupCode = `${prefix}-LSA`;
                            else if (m.includes('komputerowa')) groupCode = `${prefix}-LSlk`;
                            else if (m.includes('intercultural')) groupCode = `${prefix}-LSal`;
                            else if (m.includes('empirical')) groupCode = `${prefix}-LSel`;
                          }

                          const majorMatch = courseMajors.length === 0 || courseMajors.includes(groupCode);
                          const yearMatch = !courseYear || g.year === courseYear;
                          return majorMatch && yearMatch;
                        });

                        const grouped = filteredGroups?.reduce((acc: any, g: any) => {
                          const yearStr = `${g.year} ROK (${g.degree.toUpperCase()})`;
                          if (!acc[yearStr]) acc[yearStr] = [];
                          acc[yearStr].push(g);
                          return acc;
                        }, {});

                        if (!grouped || Object.keys(grouped).length === 0) return <p className="text-xs text-muted-foreground italic">Brak grup.</p>;

                        return Object.keys(grouped).sort().map(year => (
                          <div key={year} className="space-y-1 mt-2 first:mt-0">
                            <div className="text-xs font-bold text-muted-foreground uppercase mb-1">{year}</div>
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {grouped[year].map((g: Group) => {
                                const isSelected = selectedGroupIds.includes(g.id);
                                return (
                                  <button
                                    key={g.id}
                                    type="button"
                                    onClick={() => setSelectedGroupIds(prev => isSelected ? prev.filter(id => id !== g.id) : [...prev, g.id])}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-all ${isSelected ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'}`}
                                  >
                                    {g.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Liczba godzin (Pensum) *</Label>
                      <Input type="number" min="0" value={assignedHours} onChange={e => setAssignedHours(e.target.value)} required />
                    </div>
                    <div>
                      <Label>Nadpisz Typ Zajęć</Label>
                      <select 
                        className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={classType}
                        onChange={e => setClassType(e.target.value)}
                      >
                        <option value="">Domyślny dla przedmiotu</option>
                        <option value="W">Wykład (W)</option>
                        <option value="C">Ćwiczenia (C)</option>
                        <option value="L">Laboratorium (L)</option>
                        <option value="S">Seminarium (S)</option>
                        <option value="Pr">Praktyki (Pr)</option>
                        <option value="K">Lektorat (K)</option>
                      </select>
                    </div>
                  </div>

                  <Button type="submit" size="sm" className="w-full mt-4" disabled={isCreating}>Przypisz przedmiot</Button>
                </form>
              </div>

              <div className="mt-4 border-t pt-4">
                <h4 className="font-semibold text-sm mb-3">Obecne przypisania</h4>
                {!(teacher as any).allocations?.length ? (
                  <p className="text-xs text-muted-foreground italic">Brak przypisanych przedmiotów.</p>
                ) : (
                  <div className="space-y-2">
                    {(teacher as any).allocations.map((alloc: any) => (
                      <div key={alloc.id} className="border p-3 rounded-lg bg-card shadow-sm flex items-center justify-between">
                        <div>
                          <div className="font-bold text-sm">{alloc.course.name}</div>
                          <div className="text-[10px] text-muted-foreground">{alloc.course.code} | {alloc.classType || alloc.course.type} | Godziny: <span className="font-bold text-foreground">{alloc.assignedHours}h</span>{alloc.course.semester?.type ? ` | Semestr: ${alloc.course.semester.type === 'zimowy' ? 'Zimowy' : alloc.course.semester.type === 'letni' ? 'Letni' : alloc.course.semester.type}` : ''}</div>
                          <div className="mt-1.5 flex gap-1.5 flex-wrap items-center">
                            {alloc.groups?.length > 0 && alloc.groups.map((g: any) => (
                              <span key={g.groupId} className="text-[9px] bg-muted px-1.5 py-0.5 rounded border">{g.group.name}</span>
                            ))}
                          </div>
                        </div>
                        <button type="button" className="ml-2 p-1.5 rounded text-destructive hover:bg-destructive/10" onClick={() => onDeleteAllocation(alloc.id)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        </SheetContent>
      </Sheet>
  );
}
