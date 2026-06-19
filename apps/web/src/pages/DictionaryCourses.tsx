import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useState, useMemo, useEffect } from 'react';
import { BookOpen, Plus, Printer, AlertCircle, CheckCircle2, Clock, ArrowUpCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Course, Semester } from '../types/models';
import { exportToCsv } from '../utils/exportToCsv';
import { parseCourseCode } from '../utils/courseUtils';
import { fetchApi } from '../lib/api';
import { CourseFormSheet, type CourseFormData } from '../components/courses/CourseFormSheet';
import { CourseAllocationSheet } from '../components/courses/CourseAllocationSheet';
import { CoursesTable } from '../components/courses/CoursesTable';
import { CloneSemesterModal } from '../components/courses/CloneSemesterModal';
import { UsosImportDialog } from '../components/courses/UsosImportDialog';

import { useAuthStore } from '../store/auth';
import { InstituteTilesFilter } from '../components/institutes/InstituteTilesFilter';

// ─── API helpers ──────────────────────────────────────────────────────────────
const fetchCourses = (semesterId?: string) => fetchApi(`/courses${semesterId ? `?semesterId=${semesterId}` : ''}`);
const fetchSemesters = () => fetchApi('/semesters');
const fetchTeachers = () => fetchApi('/teachers?scope=global');
const fetchGroups = () => fetchApi('/groups');
const fetchMajors = () => fetchApi('/majors');
const createCourse = (data: CourseFormData) => fetchApi('/courses', { method: 'POST', body: JSON.stringify(data) });
const deleteCourse = (id: string) => fetchApi(`/courses/${id}`, { method: 'DELETE' });

const csvTemplate = [
  { code: '09-S1LSN01-P02230', name: 'Wstęp do językoznawstwa', majors: 'S1-LSN, S1-LSA' },
];

// ─── Main Page Component ──────────────────────────────────────────────────────
export function DictionaryCourses() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [allocatingCourse, setAllocatingCourse] = useState<Course | null>(null);
  const [importSemesterId, setImportSemesterId] = useState('');
  const [activeMajorTab, setActiveMajorTab] = useState('all');
  const [activeYearTab, setActiveYearTab] = useState('all');
  const [activeStatusFilter, setActiveStatusFilter] = useState<'all' | 'unassigned' | 'partial' | 'full' | 'over'>('all');
  const [selectedInstituteId, setSelectedInstituteId] = useState('all');
  const [formError, setFormError] = useState('');

  const queryClient = useQueryClient();
  const { activeSemesterId, setActiveSemesterId, role } = useAuthStore();
  const showInstituteFilter = role === 'DEAN' || role === 'SUPER_ADMIN';

  // ─── Queries ───────────────────────────────────────────────────────────────
  const { data: coursesData, isLoading: isLoadingCourses } = useQuery({
    queryKey: ['courses', activeSemesterId],
    queryFn: () => fetchCourses(activeSemesterId || undefined)
  });
  const { data: semestersData } = useQuery({ queryKey: ['semesters'], queryFn: fetchSemesters });

  // 1. Initialization: If no semester is active, pick the latest one
  useEffect(() => {
    if (!activeSemesterId && semestersData?.data?.length > 0) {
      setActiveSemesterId(semestersData.data[0].id);
    }
  }, [semestersData, activeSemesterId, setActiveSemesterId]);

  // 2. Sync local import state for cloning modal
  useEffect(() => {
    if (activeSemesterId) setImportSemesterId(activeSemesterId);
  }, [activeSemesterId]);

  const { data: teachersData } = useQuery({ queryKey: ['teachers'], queryFn: fetchTeachers, enabled: !!allocatingCourse });
  const { data: groupsData } = useQuery({ queryKey: ['groups'], queryFn: fetchGroups, enabled: !!allocatingCourse });
  const { data: majorsData } = useQuery({ queryKey: ['majors'], queryFn: fetchMajors });
  const { data: institutesData } = useQuery({
    queryKey: ['institutes'],
    queryFn: () => fetchApi('/institutes'),
    enabled: showInstituteFilter,
  });

  const invalidateCourses = () => {
    queryClient.invalidateQueries({ queryKey: ['courses'] });
    queryClient.invalidateQueries({ queryKey: ['teachers'] });
    queryClient.invalidateQueries({ queryKey: ['workload'] });
    queryClient.invalidateQueries({ queryKey: ['dictionaries'] });
  };

  // ─── Course CRUD mutations ─────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: createCourse,
    onSuccess: () => { invalidateCourses(); setIsFormOpen(false); setFormError(''); },
    onError: (err: any) => setFormError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: CourseFormData & { id: string }) => {
      const { id, ...payload } = data;
      return fetchApi(`/courses/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    },
    onSuccess: () => { invalidateCourses(); setIsFormOpen(false); setEditingCourse(null); setFormError(''); },
    onError: (err: any) => setFormError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCourse,
    onSuccess: invalidateCourses,
  });

  // ─── Allocation mutations ──────────────────────────────────────────────────
  const createAllocationMutation = useMutation({
    mutationFn: async (data: { courseId: string; teacherId: string; groupIds: string[]; assignedHours: number; classType?: string | null }) => {
      const { courseId, ...payload } = data;
      return fetchApi(`/courses/${courseId}/allocations`, { method: 'POST', body: JSON.stringify(payload) });
    },
    onSuccess: invalidateCourses,
  });

  const deleteAllocationMutation = useMutation({
    mutationFn: async (allocId: string) => fetchApi(`/courses/allocations/${allocId}`, { method: 'DELETE' }),
    onSuccess: () => { invalidateCourses(); toast.success('Przydział usunięty'); },
    onError: (err: any) => toast.error('Błąd usuwania przydziału: ' + err.message),
  });

  const updateAllocationMutation = useMutation({
    mutationFn: async (data: { allocId: string; assignedHours: number; classType?: string | null }) => {
      const { allocId, ...payload } = data;
      return fetchApi(`/courses/allocations/${allocId}`, { method: 'PUT', body: JSON.stringify(payload) });
    },
    onSuccess: () => { invalidateCourses(); },
  });

  const createStaffingRequestMutation = useMutation({
    mutationFn: async (data: { courseId: string; requestedGroups: number; notes: string }) => {
      return fetchApi(`/staffing-requests`, { method: 'POST', body: JSON.stringify(data) });
    },
    onSuccess: () => {
      toast.success('Zgłoszono zapotrzebowanie (wakat)');
    },
    onError: (err: any) => toast.error('Błąd zgłaszania wakatu: ' + err.message),
  });

  // ─── Bulk import mutation ──────────────────────────────────────────────────
  const bulkCreateMutation = useMutation({
    mutationFn: async (rows: any[]) => {
      if (!importSemesterId) throw new Error('Brak ustawionego semestru do importu!');

      const parsed = rows.map(r => {
        let parsedMajors: string[] = [];
        if (r.majors && typeof r.majors === 'string') {
          parsedMajors = r.majors.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
        if (activeMajorTab !== 'all' && !parsedMajors.includes(activeMajorTab)) parsedMajors.push(activeMajorTab);

        const code = (r.code || '').trim();
        const parsedCode = parseCourseCode(code);
        if (parsedCode.major && !parsedMajors.includes(parsedCode.major)) parsedMajors.push(parsedCode.major);

        return {
          code,
          name: (r.name || '').trim(),
          type: ['W', 'C', 'L', 'S', 'Pr', 'K'].includes(r.type) ? r.type : 'W',
          ectsCredits: parseInt(r.ectsCredits) || 0,
          semesterId: importSemesterId,
          majors: parsedMajors.map(code => {
            const m = majorsData?.data?.find((maj: any) => maj.code === code);
            return m ? { majorId: m.id, year: r.studySemester ? Math.ceil(parseInt(r.studySemester) / 2) : (parsedCode.studyYear || 1) } : null;
          }).filter(Boolean),
        };
      }).filter(r => r.code && r.name);

      if (parsed.length === 0) throw new Error('Brak danych do importu - sprawdź separator (tabulacja) i nagłówki (code, name).');
      return fetchApi('/courses/bulk', { method: 'POST', body: JSON.stringify(parsed) });
    },
    onSuccess: (data) => { invalidateCourses(); toast.success(`Wgrano pomyślnie. Dodano nowych rekordów: ${data.data.count}`); },
    onError: (err: any) => toast.error(`Błąd importu: ${err.message}`),
  });

  // ─── Statistics Calculation ────────────────────────────────────────────────
  const { filteredCourses, stats } = useMemo(() => {
    const courses = coursesData?.data || [];
    const scopedByInstitute = selectedInstituteId === 'all'
      ? courses
      : courses.filter((course: any) => course.instituteId === selectedInstituteId);

    // First pass: Calculate stats for the current major/year selection
    const baseFiltered = scopedByInstitute.filter((course: any) => {
      const majorMatch = activeMajorTab === 'all' || course.majors?.some((m: any) => m.major?.code === activeMajorTab);
      if (!majorMatch) return false;
      if (activeMajorTab === 'all' || activeYearTab === 'all') return true;
      return course.majors?.some((m: any) => m.major?.code === activeMajorTab && m.year === parseInt(activeYearTab));
    });

    const total = baseFiltered.length;
    let unassigned = 0, partial = 0, full = 0, over = 0;

    const withMetrics = baseFiltered.map((course: any) => {
      const allocations = course.allocations ?? [];
      const totalAssigned = allocations.reduce((sum: number, alloc: any) => sum + (alloc.assignedHours || 0), 0);
      const expectedTotalHours = (course.hoursTotal || 30) * (course.targetGroupsCount || 1);

      let status: any = 'unassigned';
      if (totalAssigned === 0) { status = 'unassigned'; unassigned++; }
      else if (totalAssigned < expectedTotalHours) { status = 'partial'; partial++; }
      else if (totalAssigned === expectedTotalHours) { status = 'full'; full++; }
      else { status = 'over'; over++; }

      return { ...course, _status: status };
    });

    // Second pass: apply status filter
    const finalFiltered = withMetrics.filter(c => activeStatusFilter === 'all' || c._status === activeStatusFilter);

    return {
      filteredCourses: finalFiltered,
      stats: {
        total, unassigned, partial, full, over,
        percent: total > 0 ? Math.round((full / total) * 100) : 0
      }
    };
  }, [coursesData, activeMajorTab, activeYearTab, activeStatusFilter, selectedInstituteId]);

  const visibleMajors = useMemo(() => {
    if (selectedInstituteId === 'all') {
      return majorsData?.data || [];
    }
    return (majorsData?.data || []).filter((major: any) => major.instituteId === selectedInstituteId);
  }, [majorsData, selectedInstituteId]);

  useEffect(() => {
    if (activeMajorTab === 'all') return;
    const stillVisible = visibleMajors.some((major: any) => major.code === activeMajorTab);
    if (!stillVisible) {
      setActiveMajorTab('all');
      setActiveYearTab('all');
    }
  }, [visibleMajors, activeMajorTab]);

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleFormSubmit = (data: CourseFormData) => {
    setFormError('');
    if (editingCourse) {
      updateMutation.mutate({ ...data, id: editingCourse.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const openCreate = () => { setEditingCourse(null); setFormError(''); setIsFormOpen(true); };
  const openEdit = (course: Course) => { setEditingCourse(course); setFormError(''); setIsFormOpen(true); };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const dataToExport = filteredCourses.map((c: any) => {
      const assignedTeachers = c.allocations
        ? Array.from(new Set(c.allocations.map((a: any) => `${a.teacher?.title || ''} ${a.teacher?.firstName || ''} ${a.teacher?.lastName || ''}`.trim()).filter(Boolean))).join(', ')
        : 'Brak przypisanych prowadzących';

      const majorName = c.majors?.map((m: any) => m.major?.name).filter(Boolean).join(', ') || 'Brak kierunku';
      const yearOfStudy = c.majors?.map((m: any) => m.year).filter(Boolean).join(', ') || '-';

      return {
        ...c,
        majorName,
        yearOfStudy,
        classType: c.type,
        hours: c.hoursTotal,
        groupCount: c.targetGroupsCount,
        assignedTeachers
      };
    });

    exportToCsv(
      dataToExport,
      {
        code: 'Kod Przedmiotu',
        name: 'Nazwa',
        majorName: 'Kierunek',
        yearOfStudy: 'Rok Studiów',
        classType: 'Typ Zajęć',
        hours: 'Liczba Godzin',
        groupCount: 'Liczba Grup',
        assignedTeachers: 'Prowadzący (Przypisani)'
      },
      `Przedmioty_Eksport_${new Date().toISOString().split('T')[0]}.csv`
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  const selectedMajorObj = visibleMajors.find((m: any) => m.code === activeMajorTab);
  const currentAllocatingCourse = allocatingCourse
    ? (coursesData?.data?.find((c: any) => c.id === allocatingCourse.id) || allocatingCourse)
    : null;
  const institutes = institutesData?.data || [];
  const instituteItems = institutes.map((inst: any) => ({
    id: inst.id,
    name: inst.name,
    shortCode: inst.shortCode,
    count: (coursesData?.data || []).filter((course: any) => course.instituteId === inst.id).length,
  }));

  return (
    <div className="space-y-4 flex flex-col p-4 sm:p-6 animate-in fade-in duration-500">
      {/* Header */}
      {/* ─── COMPACT PREMIUM HEADER ─── */}
      <div className="flex flex-col sm:flex-row justify-between items-center bg-background/50 backdrop-blur-md px-4 py-3 rounded-xl border border-border/50 shadow-sm gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary rounded-lg shadow-primary/10 shadow-lg">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl font-black tracking-tight text-foreground">Przedmioty</h1>

          <div className="h-6 w-[1px] bg-border mx-2 hidden sm:block" />

          {/* Status Pills (Moved to header for density) */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <StatPill
              count={stats.total} label="Wszystkie" color="text-navy-dark" bgColor="bg-cream-dark"
              isActive={activeStatusFilter === 'all'} onClick={() => setActiveStatusFilter('all')}
            />
            <StatPill
              count={stats.full} label="Pełne" color="text-status-active-fg" bgColor="bg-emerald-100"
              isActive={activeStatusFilter === 'full'} onClick={() => setActiveStatusFilter('full')}
            />
            <StatPill
              count={stats.partial} label="Częściowe" color="text-status-warning-fg" bgColor="bg-amber-100"
              isActive={activeStatusFilter === 'partial'} onClick={() => setActiveStatusFilter('partial')}
            />
            <StatPill
              count={stats.unassigned} label="Brak" color="text-destructive" bgColor="bg-destructive/10"
              isActive={activeStatusFilter === 'unassigned'} onClick={() => setActiveStatusFilter('unassigned')}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs font-bold px-3 gap-1.5 hover:bg-muted" onClick={handleExportCSV}>
            <Download className="h-3.5 w-3.5" /> Eksportuj (CSV)
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs font-bold px-3 gap-1.5 hover:bg-muted" onClick={handlePrint}>
            <Printer className="h-3.5 w-3.5" /> Drukuj
          </Button>
          <Button size="sm" className="h-8 text-xs font-bold px-4 gap-1.5 bg-primary hover:bg-primary/90 shadow-md shadow-primary/10" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" /> Dodaj
          </Button>
        </div>
      </div>

      {/* ─── DENSE ACTION & FILTER BAR ─── */}
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden print:hidden">
        <div className="px-4 py-2 bg-muted/20 border-b flex flex-wrap items-center gap-x-8 gap-y-3">

          {/* Academic Year Selectors (Miniaturized) */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase text-muted-foreground/70 tracking-widest">Rok:</span>
            <div className="flex gap-1">
              {Array.from(new Set(semestersData?.data?.map((s: any) => s.year) || [])).sort((a: any, b: any) => b - a).map((year: any) => {
                const isActive = semestersData?.data?.find((s: any) => s.id === activeSemesterId)?.year === year;
                return (
                  <button
                    key={year}
                    onClick={() => {
                      const sem = semestersData?.data?.find((s: any) => s.year === year);
                      if (sem) setActiveSemesterId(sem.id);
                    }}
                    className={`px-3 py-1 rounded-md text-[11px] font-black transition-all ${isActive
                      ? 'bg-primary text-white shadow-sm'
                      : 'hover:bg-background text-muted-foreground border border-transparent'
                      }`}
                  >
                    {year}/{year + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Semester Type Selectors (Miniaturized) */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase text-muted-foreground/70 tracking-widest">Sem:</span>
            <div className="flex gap-1">
              {['zimowy', 'letni'].map((type) => {
                const currentYear = semestersData?.data?.find((s: any) => s.id === activeSemesterId)?.year;
                const isActive = semestersData?.data?.find((s: any) => s.id === activeSemesterId)?.type.toLowerCase() === type;
                return (
                  <button
                    key={type}
                    onClick={() => {
                      const targetSem = semestersData?.data?.find((s: any) => s.year === currentYear && s.type.toLowerCase() === type);
                      if (targetSem) setActiveSemesterId(targetSem.id);
                    }}
                    className={`px-3 py-1 rounded-md text-[11px] font-black capitalize transition-all ${isActive
                      ? 'bg-primary text-white shadow-sm'
                      : 'hover:bg-background text-muted-foreground border border-transparent'
                      }`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1" />

          {/* Advanced Actions (Compact) */}
          <div className="flex items-center gap-1 bg-background/50 border rounded-lg p-0.5">
            <CloneSemesterModal
              targetSemesterId={activeSemesterId || ''}
              onSuccess={invalidateCourses}
            />
            <div className="w-[1px] h-3 bg-border mx-1" />
            <UsosImportDialog
              activeSemesterId={activeSemesterId || ''}
              semestersData={semestersData}
              majorsData={majorsData}
              onSuccess={invalidateCourses}
            />
          </div>
        </div>

      </div>

      {showInstituteFilter && institutes.length > 0 && (
        <InstituteTilesFilter
          items={instituteItems}
          selectedId={selectedInstituteId}
          onSelect={setSelectedInstituteId}
          allCount={coursesData?.data?.length || 0}
          className="print:hidden"
        />
      )}

      {/* Table with major/year filter tabs */}
      <div className="bg-card rounded-xl border shadow-sm print:border-none print:shadow-none">
        {/* Major tabs */}
        <div className="flex px-4 pt-3 pb-1.5 gap-2 overflow-x-auto border-b print:hidden bg-muted/5">
          <button
            onClick={() => setActiveMajorTab('all')}
            className={`px-3 py-1.5 rounded-t-lg text-[11px] font-black uppercase tracking-wider border-b-2 transition-colors ${activeMajorTab === 'all' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            Wszystkie
          </button>
          {visibleMajors.map((m: any) => (
            <button
              key={m.id}
              onClick={() => { setActiveMajorTab(m.code); setActiveYearTab('all'); }}
              className={`px-3 py-1.5 rounded-t-lg text-[11px] font-black uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${activeMajorTab === m.code ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {m.code}
            </button>
          ))}
        </div>

        {/* Year sub-filter — visible only when a specific major is selected */}
        {activeMajorTab !== 'all' && (
          <div className="flex px-4 py-1.5 gap-2 overflow-x-auto bg-muted/10 border-b items-center shadow-inner print:hidden">
            <span className="text-[9px] uppercase font-black text-muted-foreground/60 mr-2 tracking-widest">Filtruj Rok:</span>
            <button
              onClick={() => setActiveYearTab('all')}
              className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold transition-all ${activeYearTab === 'all' ? 'bg-primary text-white shadow-sm' : 'bg-background border border-border/50 text-muted-foreground hover:bg-muted'}`}
            >
              WSZYSTKIE LATA
            </button>
            {Array.from({ length: selectedMajorObj?.years || 3 }).map((_, i) => {
              const year = i + 1;
              return (
                <button
                  key={year}
                  onClick={() => setActiveYearTab(year.toString())}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${activeYearTab === year.toString() ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-background border border-border text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                >
                  {year} rok (Sem {year * 2 - 1}-{year * 2})
                </button>
              );
            })}
          </div>
        )}

        {/* Filter Summary for Print */}
        <div className="hidden print:block mb-6 p-4 border-b">
          <h2 className="text-xl font-bold">Raport Obsady Przedmiotów</h2>
          <p className="text-sm text-muted-foreground">
            Filtr: {activeMajorTab === 'all' ? 'Wszystkie kierunki' : `Kierunek: ${activeMajorTab}`}
            {activeYearTab !== 'all' && `, Rok: ${activeYearTab}`}
            {activeStatusFilter !== 'all' && `, Status: ${activeStatusFilter}`}
          </p>
          <div className="mt-2 text-xs flex gap-4">
            <span>Ogółem kursów: {stats.total}</span>
            <span>Obsadzone: {stats.percent}%</span>
          </div>
        </div>

        <CoursesTable
          courses={filteredCourses}
          isLoading={isLoadingCourses}
          activeMajorTab={activeMajorTab}
          activeYearTab={activeYearTab}
          onEdit={openEdit}
          onDelete={(id) => deleteMutation.mutate(id)}
          onAllocate={setAllocatingCourse}
        />
      </div>

      {/* Sheets (drawers) */}
      <CourseFormSheet
        isOpen={isFormOpen}
        editingCourse={editingCourse}
        semestersData={semestersData}
        majorsData={majorsData}
        errorMsg={formError}
        isPending={createMutation.isPending || updateMutation.isPending}
        onClose={() => { setIsFormOpen(false); setEditingCourse(null); setFormError(''); }}
        onSubmit={handleFormSubmit}
      />

      <CourseAllocationSheet
        course={currentAllocatingCourse}
        teachersData={teachersData}
        groupsData={groupsData}
        isCreating={createAllocationMutation.isPending}
        onClose={() => setAllocatingCourse(null)}
        onCreateAllocation={(data) => createAllocationMutation.mutate(data)}
        onDeleteAllocation={(id) => deleteAllocationMutation.mutate(id)}
        onUpdateAllocation={(data) => updateAllocationMutation.mutate(data)}
        onCreateStaffingRequest={(data) => createStaffingRequestMutation.mutate(data)}
      />
    </div>
  );
}

function StatPill({ count, label, color, bgColor, isActive, onClick }: {
  count: number, label: string, color: string, bgColor: string, isActive: boolean, onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-2.5 py-1 rounded-full border transition-all ${isActive
        ? `ring-1 ring-primary ${bgColor} border-primary/20 shadow-sm scale-105`
        : `bg-background border-border/50 hover:bg-muted/50 shadow-sm`
        }`}
    >
      <span className={`text-xs font-black ${color}`}>{count}</span>
      <span className="text-[9px] uppercase font-black text-muted-foreground/70 tracking-tight">{label}</span>
    </button>
  );
}
