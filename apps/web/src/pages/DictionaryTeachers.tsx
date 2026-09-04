import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useState, useMemo } from 'react';
import { Users, Plus, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Teacher } from '../types/models';
import { exportToCsv } from '../utils/exportToCsv';
import { fetchApi } from '../lib/api';
import { getInstituteShortLabel } from '../utils/instituteLabels';
import { TeacherFormSheet, type TeacherFormData } from '../components/teachers/TeacherFormSheet';
import { TeacherAllocationSheet } from '../components/teachers/TeacherAllocationSheet';
import { TeacherPreviewSheet } from '../components/teachers/TeacherPreviewSheet';
import { TeacherSchedulePrintView } from '../components/teachers/TeacherSchedulePrintView';
import { TeacherPrintOnlyView } from '../components/teachers/TeacherPrintOnlyView';
import { TeachersTable } from '../components/teachers/TeachersTable';
import { InstituteTilesFilter } from '../components/institutes/InstituteTilesFilter';

// ─── API helpers ──────────────────────────────────────────────────────────────
const fetchTeachers = () => fetchApi('/teachers');
const fetchCourses = () => fetchApi('/courses');
const fetchGroups = () => fetchApi('/groups');
const createTeacher = (data: TeacherFormData) => fetchApi('/teachers', { method: 'POST', body: JSON.stringify(data) });
const deleteTeacher = (id: string) => fetchApi(`/teachers/${id}`, { method: 'DELETE' });

const csvTemplate = [
  { firstName: 'Jan', lastName: 'Kowalski', title: 'dr', email: 'j.kowalski@amu.edu.pl', unit: 'ILS', pensumLimit: 210 }
];

// ─── Main Page Component ──────────────────────────────────────────────────────
export function DictionaryTeachers() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [allocatingTeacher, setAllocatingTeacher] = useState<Teacher | null>(null);
  const [previewTeacher, setPreviewTeacher] = useState<Teacher | null>(null);
  const [printingTeacher, setPrintingTeacher] = useState<Teacher | null>(null);
  const [printingScheduleTeacher, setPrintingScheduleTeacher] = useState<Teacher | null>(null);

  const queryClient = useQueryClient();

  const [selectedUnitKey, setSelectedUnitKey] = useState<string>('all');

  // ─── Queries ───────────────────────────────────────────────────────────────
  const { data: teachersData, isLoading } = useQuery({ queryKey: ['teachers'], queryFn: fetchTeachers });
  const { data: coursesData } = useQuery({ queryKey: ['courses'], queryFn: fetchCourses, enabled: !!allocatingTeacher });
  const { data: groupsData } = useQuery({ queryKey: ['groups'], queryFn: fetchGroups, enabled: !!allocatingTeacher });
  const { data: institutesData } = useQuery({ queryKey: ['institutes'], queryFn: () => fetchApi('/institutes') });

  // ─── Canonical unit grouping for filter (eliminates duplicate tabs) ────────
  const instituteShortCodeByName = useMemo(() => new Map(
    (institutesData?.data || []).map((inst: any) => [inst.name, inst.shortCode || null])
  ), [institutesData]);

  const unitGroups = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; shortCode: string | null; count: number; aliases: string[] }>();

    (teachersData?.data || []).forEach((t: Teacher) => {
      const canonicalName = (t as any).institute?.name || t.unit;
      const shortCode = (t as any).institute?.shortCode || instituteShortCodeByName.get(canonicalName) || instituteShortCodeByName.get(t.unit) || getInstituteShortLabel(canonicalName);
      
      // Group by canonical shortCode if available, otherwise by canonical institute name
      const key = (shortCode && shortCode !== '—') ? shortCode : canonicalName;

      if (!groups.has(key)) {
        groups.set(key, {
          id: key,
          name: canonicalName,
          shortCode: shortCode || null,
          count: 0,
          aliases: [],
        });
      }

      const g = groups.get(key)!;
      g.count += 1;
      if (!g.aliases.includes(t.unit)) g.aliases.push(t.unit);
      if (canonicalName && !g.aliases.includes(canonicalName)) g.aliases.push(canonicalName);
      if (canonicalName.length > g.name.length) g.name = canonicalName;
    });

    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  }, [teachersData, instituteShortCodeByName]);

  const selectedGroup = unitGroups.find(g => g.id === selectedUnitKey);

  const filteredTeachers = useMemo(() => {
    return (teachersData?.data || []).filter((t: Teacher) => {
      if (!selectedUnitKey || selectedUnitKey === 'all') return true;
      if (!selectedGroup) return true;
      const tCanonical = (t as any).institute?.name || t.unit;
      const tShort = (t as any).institute?.shortCode || instituteShortCodeByName.get(tCanonical) || getInstituteShortLabel(tCanonical);
      return selectedGroup.aliases.includes(t.unit) ||
             selectedGroup.aliases.includes(tCanonical) ||
             (tShort === selectedUnitKey) ||
             ((t as any).instituteId && (t as any).institute?.name === selectedGroup.name);
    });
  }, [teachersData, selectedUnitKey, selectedGroup, instituteShortCodeByName]);

  const invalidateTeachers = () => {
    queryClient.invalidateQueries({ queryKey: ['teachers'] });
    queryClient.invalidateQueries({ queryKey: ['courses'] });
    queryClient.invalidateQueries({ queryKey: ['workload'] });
    queryClient.invalidateQueries({ queryKey: ['dictionaries'] });
  };

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: createTeacher,
    onSuccess: () => { invalidateTeachers(); setIsFormOpen(false); toast.success('Dodano prowadzącego'); },
    onError: (err: any) => toast.error(err.message || 'Błąd dodawania prowadzącego'),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: TeacherFormData & { id: string }) => {
      const { id, ...payload } = data;
      return fetchApi(`/teachers/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    },
    onSuccess: () => { invalidateTeachers(); setIsFormOpen(false); setEditingTeacher(null); toast.success('Zaktualizowano prowadzącego'); },
    onError: (err: any) => toast.error(err.message || 'Błąd aktualizacji'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTeacher,
    onSuccess: () => { invalidateTeachers(); toast.success('Usunięto prowadzącego'); },
    onError: (err: any) => toast.error(err.message || 'Błąd usuwania'),
  });

  const createAllocationMutation = useMutation({
    mutationFn: async (data: { courseId: string; teacherId: string; groupIds: string[]; assignedHours: number; classType?: string }) => {
      const { courseId, ...payload } = data;
      return fetchApi(`/courses/${courseId}/allocations`, { method: 'POST', body: JSON.stringify(payload) });
    },
    onSuccess: invalidateTeachers,
  });

  const deleteAllocationMutation = useMutation({
    mutationFn: async (allocId: string) => fetchApi(`/courses/allocations/${allocId}`, { method: 'DELETE' }),
    onSuccess: () => { invalidateTeachers(); toast.success('Przydział usunięty'); },
    onError: (err: any) => toast.error('Błąd usuwania przydziału: ' + err.message),
  });

  const bulkCreateMutation = useMutation({
    mutationFn: async (rows: any[]) => {
      const parsed = rows.map(r => {
        let fakeEmail = r.email;
        if (!fakeEmail || fakeEmail.trim() === '') {
          const cleanFirst = (r.firstName || 'brak').toLowerCase().replace(/[^a-z0-9]/g, '');
          const cleanLast = (r.lastName || 'brak').toLowerCase().replace(/[^a-z0-9]/g, '');
          fakeEmail = `${cleanFirst}.${cleanLast}@amu.edu.pl`;
        }
        return {
          firstName: r.firstName,
          lastName: r.lastName,
          title: r.title,
          email: fakeEmail,
          unit: r.unit || 'Instytut Lingwistyki Stosowanej',
          pensumLimit: parseInt(r.pensumLimit) || 210
        };
      });
      return fetchApi('/teachers/bulk', { method: 'POST', body: JSON.stringify(parsed) });
    },
    onSuccess: (data) => { invalidateTeachers(); toast.success(`Wgrano pomyślnie. Dodano nowych rekordów: ${data.data.count}`); }
  });

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleFormSubmit = (data: TeacherFormData) => {
    if (editingTeacher) {
      updateMutation.mutate({ ...data, id: editingTeacher.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEdit = (teacher: Teacher) => { setEditingTeacher(teacher); setIsFormOpen(true); };
  const openCreate = () => { setEditingTeacher(null); setIsFormOpen(true); };

  const currentAllocatingTeacher = allocatingTeacher
    ? (teachersData?.data?.find((t: any) => t.id === allocatingTeacher.id) || allocatingTeacher)
    : null;

  const toggleUnit = (unit: string) => {
    setSelectedUnits(prev =>
      prev.includes(unit) ? prev.filter(u => u !== unit) : [...prev, unit]
    );
  };

  const handleExportCSV = () => {
    const dataToExport = filteredTeachers.map((t: any) => {
      const assignedCourses = t.allocations
        ? Array.from(new Set(t.allocations.map((a: any) => a.course?.name).filter(Boolean))).join(', ')
        : 'Brak przypisanych przedmiotów';
      
      return {
        ...t,
        assignedCourses
      };
    });

    exportToCsv(
      dataToExport,
      {
        firstName: 'Imię',
        lastName: 'Nazwisko',
        title: 'Tytuł/Stopień',
        email: 'Email',
        unit: 'Jednostka',
        assignedCourses: 'Prowadzi Przedmioty',
        pensumLimit: 'Limit Pensum (Godziny)'
      },
      `Prowadzacy_Eksport_${new Date().toISOString().split('T')[0]}.csv`
    );
  };

  return (
    <>
      <div className="main-ui space-y-4 p-4 sm:p-6 animate-in fade-in duration-500">
        {/* ─── COMPACT PREMIUM HEADER ─── */}
        <div className="flex flex-col sm:flex-row justify-between items-center bg-background/50 backdrop-blur-md px-4 py-3 rounded-xl border border-border/50 shadow-sm gap-4 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary rounded-lg shadow-primary/10 shadow-lg">
              <Users className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-foreground">Prowadzący</h1>

            <div className="h-6 w-[1px] bg-border mx-2 hidden sm:block" />

            {/* Status Pills */}
            <div className="flex flex-wrap gap-1.5 items-center">
              <StatPill
                count={teachersData?.data?.length || 0}
                label="Ogółem"
                color="text-navy-dark"
                bgColor="bg-cream-dark"
                isActive={selectedUnits.length === 0}
                onClick={() => setSelectedUnits([])}
              />
              {selectedUnits.length > 0 && (
                <StatPill
                  count={filteredTeachers.length}
                  label="Wybrano"
                  color="text-primary"
                  bgColor="bg-primary/10"
                  isActive={true}
                  onClick={() => { }}
                />
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs font-bold px-3 gap-1.5 hover:bg-muted" onClick={handleExportCSV}>
              <Download className="h-3.5 w-3.5" /> Eksportuj (CSV)
            </Button>
            <Button size="sm" className="h-8 text-xs font-bold px-4 gap-1.5 bg-primary hover:bg-primary/90 shadow-md shadow-primary/10" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" /> Dodaj
            </Button>
          </div>
        </div>

        {/* ─── DENSE UNIT FILTER BAR ─── */}
        {unitGroups.length > 0 && (
          <InstituteTilesFilter
            items={unitGroups.map((group) => ({
              id: group.id,
              name: group.name,
              shortCode: group.shortCode,
              count: group.count,
            }))}
            selectedId={selectedUnitKey}
            onSelect={(id) => setSelectedUnitKey(id)}
            allCount={teachersData?.data?.length || 0}
            className="print:hidden"
          />
        )}

        <div className="bg-card rounded-xl border shadow-sm">
          <TeachersTable
            teachers={filteredTeachers}
            isLoading={isLoading}
            onEdit={openEdit}
            onDelete={(id) => deleteMutation.mutate(id)}
            onAllocate={setAllocatingTeacher}
            onPreview={(t) => setPreviewTeacher(teachersData?.data?.find((td: any) => td.id === t.id) || t)}
            onPrint={(t) => {
              const enrichedTeacher = teachersData?.data?.find((td: any) => td.id === t.id) || t;
              setPrintingTeacher(enrichedTeacher);
              setTimeout(() => { window.print(); setPrintingTeacher(null); }, 100);
            }}
            onPrintSchedule={(t) => {
              const enrichedTeacher = teachersData?.data?.find((td: any) => td.id === t.id) || t;
              setPrintingScheduleTeacher(enrichedTeacher);
              setTimeout(() => { window.print(); setPrintingScheduleTeacher(null); }, 100);
            }}
          />
        </div>

        <TeacherFormSheet
          isOpen={isFormOpen}
          editingTeacher={editingTeacher}
          isPending={createMutation.isPending || updateMutation.isPending}
          onClose={() => { setIsFormOpen(false); setEditingTeacher(null); }}
          onSubmit={handleFormSubmit}
        />

        <TeacherAllocationSheet
          teacher={currentAllocatingTeacher}
          coursesData={coursesData}
          groupsData={groupsData}
          isCreating={createAllocationMutation.isPending}
          onClose={() => setAllocatingTeacher(null)}
          onCreateAllocation={(data) => createAllocationMutation.mutate(data)}
          onDeleteAllocation={(id) => deleteAllocationMutation.mutate(id)}
        />

        <TeacherPreviewSheet
          teacher={previewTeacher}
          onClose={() => setPreviewTeacher(null)}
        />
      </div>

      {printingTeacher && (
        <TeacherPrintOnlyView teacher={printingTeacher} />
      )}

      {printingScheduleTeacher && (
        <TeacherSchedulePrintView teacher={printingScheduleTeacher} />
      )}
    </>
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

