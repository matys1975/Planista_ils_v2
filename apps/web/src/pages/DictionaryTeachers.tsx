import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useState } from 'react';
import { Users, Plus, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Teacher } from '../types/models';
import { CsvUploadModal } from '@/components/CsvUploadModal';
import { exportToCsv } from '../utils/exportToCsv';
import { fetchApi } from '../lib/api';
import { TeacherFormSheet, type TeacherFormData } from '../components/teachers/TeacherFormSheet';
import { TeacherAllocationSheet } from '../components/teachers/TeacherAllocationSheet';
import { TeacherPreviewSheet } from '../components/teachers/TeacherPreviewSheet';
import { TeacherSchedulePrintView } from '../components/teachers/TeacherSchedulePrintView';
import { TeacherPrintOnlyView } from '../components/teachers/TeacherPrintOnlyView';
import { TeachersTable } from '../components/teachers/TeachersTable';

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

  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);

  // ─── Queries ───────────────────────────────────────────────────────────────
  const { data: teachersData, isLoading } = useQuery({ queryKey: ['teachers'], queryFn: fetchTeachers });
  const { data: coursesData } = useQuery({ queryKey: ['courses'], queryFn: fetchCourses, enabled: !!allocatingTeacher });
  const { data: groupsData } = useQuery({ queryKey: ['groups'], queryFn: fetchGroups, enabled: !!allocatingTeacher });

  // ─── Deriving unique units for filter ──────────────────────────────────────
  const uniqueUnits = Array.from(new Set((teachersData?.data || []).map((t: Teacher) => t.unit))).sort() as string[];

  const filteredTeachers = (teachersData?.data || []).filter((t: Teacher) => {
    if (selectedUnits.length === 0) return true;
    return selectedUnits.includes(t.unit);
  });

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
            <Button variant="outline" size="sm" className="h-8 text-xs font-bold px-3 gap-1.5" onClick={handleExportCSV}>
              <Download className="h-3.5 w-3.5" /> Eksportuj (CSV)
            </Button>
            <CsvUploadModal
              title="Import"
              expectedHeaders={['firstName', 'lastName', 'title', 'email']}
              templateData={csvTemplate}
              onUpload={async (data) => { await bulkCreateMutation.mutateAsync(data); }}
              isLoading={bulkCreateMutation.isPending}
            />
            <Button size="sm" className="h-8 text-xs font-bold px-4 gap-1.5 bg-primary hover:bg-primary/90 shadow-md shadow-primary/10" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" /> Dodaj
            </Button>
          </div>
        </div>

        {/* ─── DENSE UNIT FILTER BAR ─── */}
        {uniqueUnits.length > 0 && (
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden print:hidden">
            <div className="px-4 py-1.5 bg-muted/20 flex flex-wrap items-center gap-3">
              <span className="text-[10px] font-black uppercase text-muted-foreground/70 tracking-widest">Filtruj Jednostkę:</span>
              <div className="flex flex-wrap gap-1">
                {uniqueUnits.map(unit => {
                  const shortCode = unit.replace('Instytut Lingwistyki Stosowanej', 'ILS')
                    .replace('Instytut Filologii Germańskiej', 'IFG')
                    .replace('Instytut Filologii Romańskiej', 'IFROM')
                    .replace('Instytut Językoznawstwa', 'IJ')
                    .replace('Studium Praktycznej Nauki Języków Obcych', 'SPNJO')
                    .replace('Instytut Filologii Słowiańskiej', 'IFSłow')
                    .replace('Instytut Filologii Wschodniosłowiańskich', 'IFW')
                    .replace('Pracownik UCP', 'UCP')
                    .replace('Pracownik zlecony', 'Zlecenie')
                    .replace('Wydział Neofilologii', 'WN');

                  const isSelected = selectedUnits.includes(unit);
                  return (
                    <button
                      key={unit}
                      onClick={() => toggleUnit(unit)}
                      className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-tight transition-all border ${isSelected
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-background hover:bg-muted text-muted-foreground border-transparent'
                        }`}
                      title={unit}
                    >
                      {shortCode}
                    </button>
                  );
                })}
              </div>
              {selectedUnits.length > 0 && (
                <button
                  onClick={() => setSelectedUnits([])}
                  className="text-[10px] font-black text-destructive uppercase hover:underline ml-2"
                >
                  Wyczyść
                </button>
              )}
            </div>
          </div>
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

