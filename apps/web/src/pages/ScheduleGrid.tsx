import React, { useMemo, useCallback } from 'react';
import { Calendar as CalendarIcon, Filter, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/SearchableSelect';

import { DndContext } from '@dnd-kit/core';

import { timeSlots, days } from '@/constants/schedule';
import { useScheduleGrid } from '@/features/schedule/useScheduleGrid';
import { EntryFormDialog } from '@/features/schedule/components/EntryFormDialog';
import { DraggableSidebarCourse } from '@/features/schedule/components/DraggableSidebarCourse';
import { DroppableSlotCell } from '@/features/schedule/components/DroppableSlotCell';

export function ScheduleGrid() {
  const hook = useScheduleGrid();

  const {
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
    isLoadingDicts,
    dicts,
    entries,
    allEntries,
    deleteMutation,
    openSlotSelection,
    openEditEntry,
    handleDragEnd,
  } = hook;

  const sidebarCourses = useMemo(() => {
    if (!dicts?.courses) return [];
    return dicts.courses
      .filter((c: any) => {
        if (c.semesterId !== selectedSemester) return false;
        if (selectedMajor) {
          if (!c.majors || !c.majors.some((m: any) => m.major?.code === selectedMajor)) return false;
        }
        if (selectedYear) {
          const yearInt = parseInt(selectedYear);
          if (!c.majors || !c.majors.some((m: any) =>
            (selectedMajor ? m.major?.code === selectedMajor : true) && m.year === yearInt
          )) return false;
        }
        return true;
      })
      .flatMap((course: any) => {
        if (!course.allocations || course.allocations.length === 0) return [];
        return course.allocations.map((alloc: any) => {
          const placementCount = allEntries.filter((e: any) =>
            e.courseId === course.id &&
            e.teacherId === alloc.teacherId &&
            (e.classType || course.type) === (alloc.classType || course.type)
          ).length;
          return (
            <DraggableSidebarCourse key={alloc.id} course={course} alloc={alloc} placementCount={placementCount} />
          );
        });
      })
      .sort((a: any, b: any) => {
        const aCount = a.props.placementCount || 0;
        const bCount = b.props.placementCount || 0;
        if (aCount === 0 && bCount > 0) return -1;
        if (bCount === 0 && aCount > 0) return 1;
        return 0;
      });
  }, [dicts?.courses, selectedSemester, selectedMajor, selectedYear, allEntries]);

  const handleViewModeChange = useCallback((val: string) => {
    const newMode = val as typeof viewMode;
    setViewMode(newMode);
    if (newMode === 'major') {
      setSelectedRoomId('');
      setSelectedTeacherId('');
    } else if (newMode === 'room') {
      setSelectedMajor('');
      setSelectedYear('');
      setSelectedTeacherId('');
    } else if (newMode === 'teacher') {
      setSelectedMajor('');
      setSelectedYear('');
      setSelectedRoomId('');
    }
  }, [setViewMode, setSelectedMajor, setSelectedRoomId, setSelectedTeacherId, setSelectedYear]);

  if (isLoadingDicts) return <div className="p-8">Wczytywanie w pełni...</div>;

  const isGridVisible =
    selectedSemester && (
      (viewMode === 'major' && selectedMajor) ||
      (viewMode === 'room' && selectedRoomId) ||
      (viewMode === 'teacher' && selectedTeacherId)
    );

  return (
    <div className="space-y-4 flex flex-col h-full p-4 sm:p-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-card p-4 rounded-xl border shadow-sm print:hidden">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-lg">
            <CalendarIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Plan Zajęć</h1>
          </div>
        </div>

        <div className="flex items-center gap-4 border p-2 px-4 rounded-lg bg-background flex-wrap">
          <Filter className="w-5 h-5 text-muted-foreground shrink-0" />
          <div className="flex gap-4 flex-wrap">
            <div className="w-52">
              <SearchableSelect
                value={selectedSemester}
                onChange={(val) => setSelectedSemester(val)}
                placeholder="Wybierz semestr (wymagany)..."
                options={(dicts?.semesters || []).map((s: any) => ({
                  value: s.id,
                  label: `${s.name} (${s.year})`,
                }))}
              />
            </div>

            <div className="w-36">
              <SearchableSelect
                value={viewMode}
                onChange={handleViewModeChange}
                placeholder="Widok..."
                options={[
                  { value: 'major', label: 'Kierunek' },
                  { value: 'room', label: 'Sale' },
                  { value: 'teacher', label: 'Prowadzący' },
                ]}
              />
            </div>

            <div className="w-60">
              {viewMode === 'major' ? (
                <SearchableSelect
                  value={selectedMajor}
                  onChange={(val) => { setSelectedMajor(val); setSelectedYear(''); }}
                  placeholder="Wybierz kierunek..."
                  options={(dicts?.majors || []).map((m: any) => ({
                    value: m.code,
                    label: `${m.code} - ${m.name}`,
                  }))}
                />
              ) : viewMode === 'room' ? (
                <SearchableSelect
                  value={selectedRoomId}
                  onChange={(val) => setSelectedRoomId(val)}
                  placeholder="Wybierz salę..."
                  options={(dicts?.rooms || []).map((r: any) => ({
                    value: r.id,
                    label: `${r.number}${r.building}`,
                  }))}
                />
              ) : (
                <SearchableSelect
                  value={selectedTeacherId}
                  onChange={(val) => setSelectedTeacherId(val)}
                  placeholder="Wybierz prowadzącego..."
                  options={(dicts?.teachers || []).map((t: any) => ({
                    value: t.id,
                    label: `${t.firstName} ${t.lastName}`,
                  }))}
                />
              )}
            </div>
          </div>

          <div className={`flex items-center gap-2 ${viewMode === 'major' ? 'visible' : 'invisible'}`}>
            <div className="h-6 w-px bg-border" />
            <span className="text-sm font-medium">Rok: </span>
            <div className="flex gap-1 bg-muted/30 p-0.5 rounded-md border border-border/50">
              <button
                onClick={() => setSelectedYear('')}
                className={`px-3 py-1 text-xs rounded transition-colors ${selectedYear === '' ? 'bg-primary text-primary-foreground font-semibold shadow-sm' : 'hover:bg-muted font-medium'}`}
              >
                Wszystkie
              </button>
              <button
                onClick={() => setSelectedYear('1')}
                className={`px-3 py-1 text-xs rounded transition-colors ${selectedYear === '1' ? 'bg-primary text-primary-foreground font-semibold shadow-sm' : 'hover:bg-muted font-medium'}`}
              >
                1 Rok
              </button>
              <button
                onClick={() => setSelectedYear('2')}
                className={`px-3 py-1 text-xs rounded transition-colors ${selectedYear === '2' ? 'bg-primary text-primary-foreground font-semibold shadow-sm' : 'hover:bg-muted font-medium'}`}
              >
                2 Rok
              </button>
              {selectedMajor.startsWith('S1-') && (
                <button
                  onClick={() => setSelectedYear('3')}
                  className={`px-3 py-1 text-xs rounded transition-colors ${selectedYear === '3' ? 'bg-primary text-primary-foreground font-semibold shadow-sm' : 'hover:bg-muted font-medium'}`}
                >
                  3 Rok
                </button>
              )}
            </div>
          </div>

          {selectedSemester && (
            <Button onClick={() => window.print()} variant="outline" className="border-primary/20 hover:bg-primary hover:text-primary-foreground shadow-sm ml-4 print:hidden">
              <Printer className="w-4 h-4 mr-2" /> Drukuj Plan
            </Button>
          )}
        </div>
      </div>

      {isGridVisible ? (
        <DndContext onDragEnd={handleDragEnd}>
          {/* PRINT HEADER - ONLY VISIBLE IN PRINT MODE */}
          <div className="hidden print:block mb-2 border-b pb-2">
            <div className="flex justify-between items-end">
              <div>
                <h1 className="text-2xl font-bold uppercase tracking-tight text-foreground">Plan Zajęć</h1>
                <p className="text-sm font-medium text-foreground mt-0.5">
                  {viewMode === 'major' ? (
                    <>Kierunek: <span className="font-bold">{dicts?.majors?.find((m: any) => m.code === selectedMajor)?.name || selectedMajor}</span>{selectedYear ? `, ${selectedYear} Rok` : ''}</>
                  ) : viewMode === 'room' ? (
                    <>Sala: <span className="font-bold">{dicts?.rooms?.find((r: any) => r.id === selectedRoomId)?.number}</span> (Bud. {dicts?.rooms?.find((r: any) => r.id === selectedRoomId)?.building})</>
                  ) : (
                    <>Prowadzący: <span className="font-bold">{dicts?.teachers?.find((t: any) => t.id === selectedTeacherId)?.firstName} {dicts?.teachers?.find((t: any) => t.id === selectedTeacherId)?.lastName}</span></>
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-foreground">Instytut Lingwistyki Stosowanej</p>
                <p className="text-xs text-muted-foreground">{dicts?.semesters?.find((s: any) => s.id === selectedSemester)?.name}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-6 flex-1 min-h-[600px] overflow-hidden print:overflow-visible print:min-h-0 print:block">

            {/* Sidebar z dostępnymi modułami – tylko dla widoku Kierunek */}
            {viewMode === 'major' && (
              <div className="w-80 flex-shrink-0 bg-card rounded-xl border shadow-sm flex flex-col h-full overflow-hidden print:hidden">
                <div className="p-4 border-b font-semibold bg-muted/40 text-sm">
                  Lista modułów
                  {selectedMajor ? (
                    <p className="text-xs text-muted-foreground font-normal mt-0.5">Przeciągnij kafelek na siatkę wpisów</p>
                  ) : (
                    <p className="text-xs text-orange-500 font-normal mt-0.5">Wybierz kierunek, by zawęzić listę</p>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2.5 pb-8 h-[calc(100vh-300px)]">
                  {sidebarCourses}

                  {dicts?.courses?.filter((c: any) => c.semesterId === selectedSemester).length === 0 && (
                    <div className="text-sm text-center text-muted-foreground mt-8 p-4 bg-muted/20 rounded-lg">
                      Dodaj przedmioty w Katalogu Kursów najpierw.
                    </div>
                  )}
                  {dicts?.courses?.filter((c: any) => c.semesterId === selectedSemester).length > 0 &&
                    !dicts?.courses.some((c: any) => c.semesterId === selectedSemester && c.allocations?.length > 0) && (
                      <div className="text-sm text-center text-orange-500 mt-8 p-4 bg-orange-500/10 rounded-lg">
                        Przedmioty nie mają skonfigurowanych przydziałów. Skonfiguruj prowadzących w menu Słowniki - Przedmioty.
                      </div>
                    )}
                </div>
              </div>
            )}

            {/* Grid Siatki */}
            <div className="flex-1 bg-card rounded-xl border shadow-sm overflow-auto p-4 relative print:border-none print:shadow-none print:p-0 print:overflow-visible">
              <table className="w-full h-full border-collapse isolate min-w-[1000px] print:min-w-full">
                <thead>
                  <tr>
                    <th className="border p-2 bg-muted/30 w-24 sticky top-0 bg-card z-10 print:p-1 print:text-[10px] print:w-16">Godzina</th>
                    {days.map(day => (
                      <th key={day.id} className="border border-border/60 p-3 bg-primary/5 text-primary font-bold text-center sticky top-0 z-10 w-1/5 shadow-sm print:p-1 print:text-[11px] print:shadow-none">
                        {day.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeSlots.map(slot => (
                    <tr key={slot.id} className="print:break-inside-avoid">
                      <td className="border p-2 text-xs font-semibold text-center text-muted-foreground bg-muted/10 print:p-1 print:text-[9px]">
                        <div>{slot.start}</div>
                        <div className="text-[10px] uppercase mt-1 print:hidden">-</div>
                        <div>{slot.end}</div>
                      </td>
                      {days.map(day => {
                        const cellEntries = entries.filter((e: any) => e.dayOfWeek === day.id && e.startTime === slot.start);
                        return (
                          <DroppableSlotCell
                            key={`${day.id}-${slot.id}`}
                            dayId={day.id}
                            slot={slot}
                            entries={cellEntries}
                            onAddClick={openSlotSelection}
                            onDelete={(id: string) => deleteMutation.mutate(id)}
                            onEdit={openEditEntry}
                            viewMode={viewMode}
                          />
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </DndContext>
      ) : (
        <div className="flex-1 border rounded-xl flex flex-col items-center justify-center bg-card p-12 text-center text-muted-foreground border-dashed gap-4">
          <CalendarIcon className="w-12 h-12 text-muted-foreground/30" />
          <div className="max-w-md">
            <h3 className="text-lg font-semibold text-foreground mb-2">Siatka ukryta dla czytelności</h3>
            <p>
              {!selectedSemester
                ? "Wybierz semestr z górnego paska, aby rozpocząć."
                : "Wybierz z listy u góry interesujący Cię Kierunek, Salę lub Prowadzącego, aby wyświetlić dedykowaną siatkę."}
            </p>
          </div>
        </div>
      )}

      <EntryFormDialog hook={hook} />
    </div>
  );
}
