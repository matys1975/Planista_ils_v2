import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useState } from 'react';
import { fetchApi } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Building, Users, BookOpen, GraduationCap, Download, Upload, Plus,
  Pencil, Trash2, BarChart3, AlertTriangle, Loader2, Crown, TrendingUp,
  TrendingDown, Minus, Eye, ArrowUpDown, Search, Filter,
  ShieldCheck, ShieldAlert
} from 'lucide-react';

interface AdminCoverageItem {
  id: string;
  name: string;
  shortCode: string | null;
  usosCode: string | null;
  facultyId: string | null;
  _count: { users: number };
  adminCount: number;
  admins: { id: string; name: string; email: string; lastLoginAt: string | null }[];
  hasAdmin: boolean;
}

interface Institute {
  id: string;
  name: string;
  shortCode: string | null;
  usosCode: string | null;
  createdAt: string;
  _count: {
    users: number;
    courses: number;
    teachers: number;
    rooms: number;
    groups: number;
    majors: number;
    allocations: number;
  };
}
interface TeacherWorkload {
  id: string;
  name: string;
  institute: string;
  pensumLimit: number;
  totalHours: number;
  balance: number;
  isOverloaded: boolean;
}

interface IncompleteGroup {
  id: string;
  name: string;
  degree: string;
  year: number;
  institute: string;
  semester: string;
}

interface StatsData {
  counts: {
    institutesCount: number;
    teachersCount: number;
    coursesCount: number;
    usersCount: number;
    allocationsCount: number;
    majorsCount: number;
  };
  teacherWorkloads: TeacherWorkload[];
  incompleteGroups: IncompleteGroup[];
}

export function SuperAdminDashboard() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingInstitute, setEditingInstitute] = useState<Institute | null>(null);
  const [instituteName, setInstituteName] = useState('');
  const [instituteShortCode, setInstituteShortCode] = useState('');
  const [instituteUsosCode, setInstituteUsosCode] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  // ─── Workload filters & sorting ─────────────────────────────
  const [wlSelectedUnits, setWlSelectedUnits] = useState<string[]>([]);
  const [wlStatusFilter, setWlStatusFilter] = useState<'all' | 'overloaded' | 'underloaded' | 'ok'>('all');
  const [wlSearch, setWlSearch] = useState('');
  const [wlSortBy, setWlSortBy] = useState<'name' | 'institute' | 'totalHours' | 'balance'>('balance');
  const [wlSortDir, setWlSortDir] = useState<'asc' | 'desc'>('desc');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const setSimulatedInstituteId = useAuthStore(state => state.setSimulatedInstituteId);

  // ─── Dane ─────────────────────────────────────────────────────
  const { data: institutesData, isLoading: institutesLoading } = useQuery({
    queryKey: ['superadmin-institutes'],
    queryFn: () => fetchApi('/superadmin/institutes'),
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['superadmin-stats'],
    queryFn: () => fetchApi('/superadmin/stats'),
  });

  const institutes: Institute[] = institutesData?.data || [];
  const stats: StatsData | null = statsData?.data || null;

  // ─── Mutacje ──────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: { name: string; shortCode?: string; usosCode?: string }) => fetchApi('/superadmin/institutes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-institutes'] });
      setIsCreateOpen(false);
      resetForm();
      toast.success('Jednostka utworzona pomyślnie.');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name: string; shortCode?: string; usosCode?: string }) => fetchApi(`/superadmin/institutes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-institutes'] });
      setEditingInstitute(null);
      resetForm();
      toast.success('Jednostka zaktualizowana.');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetchApi(`/superadmin/institutes/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-institutes'] });
      queryClient.invalidateQueries({ queryKey: ['superadmin-stats'] });
      toast.success('Jednostka usunięta.');
    },
    onError: (err: any) => toast.error(err.message),
  });

  // ─── Eksport JSON ─────────────────────────────────────────────
  const handleExport = async (institute: Institute) => {
    try {
      const res = await fetch(`/api/v1/superadmin/institutes/${institute.id}/export`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Błąd eksportu');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export_${institute.name.replace(/\s+/g, '_')}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success(`Wyeksportowano dane "${institute.name}".`);
    } catch (err: any) {
      toast.error(`Błąd eksportu: ${err.message}`);
    }
  };

  // ─── Import JSON ──────────────────────────────────────────────
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const confirmed = window.confirm(
        `📦 Import danych z pliku JSON\n\n` +
        `Plik: ${file.name} (${(file.size / 1024).toFixed(0)} KB)\n\n` +
        `Ta operacja:\n` +
        `• Utworzy nowy instytut (lub podepnie pod istniejący)\n` +
        `• Scali nauczycieli po adresie e-mail\n` +
        `• Scali przedmioty po kodzie\n\n` +
        `Czy kontynuować?`
      );
      if (!confirmed) return;

      setIsImporting(true);
      setImportResult(null);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`/api/v1/superadmin/import`, {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Błąd importu');

        setImportResult(result.data);
        queryClient.invalidateQueries({ queryKey: ['superadmin-institutes'] });
        queryClient.invalidateQueries({ queryKey: ['superadmin-stats'] });
        toast.success(result.message);
      } catch (err: any) {
        toast.error(`Błąd importu: ${err.message}`);
      } finally {
        setIsImporting(false);
      }
    };
    input.click();
  };

  // ─── Admin Coverage ───────────────────────────────────────────
  const { data: adminCoverageData, isLoading: adminCoverageLoading } = useQuery({
    queryKey: ['superadmin-institute-admins'],
    queryFn: () => fetchApi('/superadmin/institute-admins'),
  });

  const adminCoverage: AdminCoverageItem[] = adminCoverageData?.data || [];
  const adminCoverageMissing = adminCoverage.filter(i => !i.hasAdmin).length;

  // ─── Helpers ──────────────────────────────────────────────────
  const resetForm = () => {
    setInstituteName('');
    setInstituteShortCode('');
    setInstituteUsosCode('');
  };

  const openEdit = (inst: Institute) => {
    setEditingInstitute(inst);
    setInstituteName(inst.name);
    setInstituteShortCode(inst.shortCode || '');
    setInstituteUsosCode(inst.usosCode || '');
  };

  const openCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const overloadedCount = stats?.teacherWorkloads.filter(t => t.isOverloaded).length || 0;

  // ─── Workload filtering & sorting logic ─────────────────────
  const wlUniqueUnits = Array.from(new Set(stats?.teacherWorkloads.map(t => t.institute) || [])).filter(Boolean).sort();

  const toggleWlSort = (col: typeof wlSortBy) => {
    if (wlSortBy === col) {
      setWlSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setWlSortBy(col);
      setWlSortDir(col === 'name' || col === 'institute' ? 'asc' : 'desc');
    }
  };

  const filteredWorkloads = (stats?.teacherWorkloads || [])
    .filter(t => wlSelectedUnits.length === 0 || wlSelectedUnits.includes(t.institute))
    .filter(t => {
      if (wlStatusFilter === 'overloaded') return t.balance > 0;
      if (wlStatusFilter === 'underloaded') return t.balance < 0;
      if (wlStatusFilter === 'ok') return t.balance === 0;
      return true;
    })
    .filter(t => {
      if (!wlSearch.trim()) return true;
      const q = wlSearch.toLowerCase();
      return t.name.toLowerCase().includes(q) || t.institute.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      let cmp = 0;
      if (wlSortBy === 'name') cmp = a.name.localeCompare(b.name, 'pl');
      else if (wlSortBy === 'institute') cmp = a.institute.localeCompare(b.institute, 'pl');
      else if (wlSortBy === 'totalHours') cmp = a.totalHours - b.totalHours;
      else if (wlSortBy === 'balance') cmp = a.balance - b.balance;
      return wlSortDir === 'asc' ? cmp : -cmp;
    });

  const wlOverCount = filteredWorkloads.filter(t => t.balance > 0).length;
  const wlUnderCount = filteredWorkloads.filter(t => t.balance < 0).length;
  const wlOkCount = filteredWorkloads.filter(t => t.balance === 0).length;

  return (
    <div className="space-y-6 p-4 sm:p-6 animate-in fade-in duration-500">
      {/* ═══ Header ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-card px-4 sm:px-6 py-4 rounded-xl border shadow-sm gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary rounded-lg shadow-sm">
            <Crown className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-primary">Zarządzanie Wydziałem</h1>
            <p className="text-xs text-muted-foreground">Jednostki, import/eksport i statystyki wydziałowe</p>
          </div>
        </div>
      </div>

      {/* ═══ Stats Cards ═══ */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Kierunki', value: stats.counts?.majorsCount || 0, icon: GraduationCap, color: 'text-accent bg-accent/10' },
            { label: 'Prowadzący', value: stats.counts?.teachersCount || 0, icon: Users, color: 'text-accent bg-accent/10' },
            { label: 'Przedmioty', value: stats.counts?.coursesCount || 0, icon: BookOpen, color: 'text-accent bg-accent/10' },
            { label: 'Użytkownicy', value: stats.counts?.usersCount || 0, icon: Crown, color: 'text-accent bg-accent/10' },
            { label: 'Przydziały', value: stats.counts?.allocationsCount || 0, icon: BarChart3, color: 'text-primary bg-primary/10' },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-card rounded-xl border p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-all hover:border-accent/30 group">
                <div className={`p-3 rounded-xl transition-colors ${stat.color} group-hover:scale-110 duration-300`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">{stat.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ Institutes Table ═══ */}
      <div className="bg-card rounded-xl border shadow-sm">
        <div className="flex justify-between items-center p-6 border-b flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Building className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-primary">Jednostki organizacyjne</h2>
              <p className="text-sm text-muted-foreground">Instytuty i katedry wydziału</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={handleImport} disabled={isImporting}>
              {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Importuj z JSON
            </Button>
            <Button className="gap-2" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Nowa jednostka
            </Button>
          </div>
        </div>

        {/* Import Result */}
        {importResult && (
          <div className="mx-6 mt-4 p-4 rounded-lg bg-status-active-bg border border-status-active-fg/20">
            <h4 className="font-semibold text-sm text-status-active-fg mb-2">✅ Wynik importu: {importResult.instituteName}</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <span>Nauczyciele: +{importResult.teachersCreated} nowych, ~{importResult.teachersMerged} scalonych</span>
              <span>Przedmioty: +{importResult.coursesCreated} nowych, ~{importResult.coursesMerged} scalonych</span>
              <span>Sale: +{importResult.roomsCreated}</span>
              <span>Grupy: +{importResult.groupsCreated}</span>
            </div>
            {importResult.errors?.length > 0 && (
              <div className="mt-2 text-xs text-status-warning-fg">
                <AlertTriangle className="inline w-3 h-3 mr-1" />
                {importResult.errors.length} ostrzeżeń
              </div>
            )}
            <button onClick={() => setImportResult(null)} className="mt-2 text-xs text-muted-foreground hover:underline">Zamknij</button>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nazwa jednostki</TableHead>
              <TableHead className="text-center">Kod</TableHead>
              <TableHead className="text-center">USOS</TableHead>
              <TableHead className="text-center">Prowadzący</TableHead>
              <TableHead className="text-center">Kierunki</TableHead>
              <TableHead className="text-center">Przedmioty</TableHead>
              <TableHead className="text-center">Użytkownicy</TableHead>
              <TableHead className="text-right">Akcje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {institutesLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center h-24"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
            ) : institutes.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center h-24 text-muted-foreground">Brak jednostek. Utwórz pierwszą lub zaimportuj dane.</TableCell></TableRow>
            ) : (
              institutes.map((inst) => (
                <TableRow key={inst.id}>
                  <TableCell className="font-semibold text-primary">{inst.name}</TableCell>
                  <TableCell className="text-center"><span className="px-2 py-0.5 rounded bg-accent/10 text-accent text-xs font-bold border border-accent/20">{inst.shortCode || '—'}</span></TableCell>
                  <TableCell className="text-center font-mono text-xs text-muted-foreground">{inst.usosCode || '—'}</TableCell>
                  <TableCell className="text-center font-medium">{inst._count?.teachers || 0}</TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-bold border border-accent/20 min-w-[32px]">
                      {inst._count?.majors || 0}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-primary/5 text-primary text-xs font-bold border border-primary/10 min-w-[32px]">
                      {inst._count?.courses || 0}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">{inst._count?.users || 0}</TableCell>
                  <TableCell className="text-right flex gap-1 justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Symuluj widok tej jednostki"
                      onClick={() => {
                        setSimulatedInstituteId(inst.id);
                        navigate({ to: '/' });
                      }}
                      className="hover:bg-navy-mid/10 hover:text-navy-mid h-8 w-8"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Eksportuj dane do JSON" onClick={() => handleExport(inst)} className="hover:bg-status-active-bg hover:text-status-active-fg h-8 w-8">
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Edytuj" onClick={() => openEdit(inst)} className="hover:bg-primary/10 hover:text-primary h-8 w-8">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" title="Usuń"
                      onClick={() => {
                        if (confirm(`Czy na pewno usunąć jednostkę "${inst.name}" i wszystkie jej powiązania?`)) {
                          deleteMutation.mutate(inst.id);
                        }
                      }}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {institutes.length > 0 && (
            <tfoot className="bg-muted/30 font-bold border-t-2 border-muted">
              <TableRow>
                <TableCell colSpan={3} className="py-4 px-6 text-primary text-sm tracking-wider">SUMA W TABELI</TableCell>
                <TableCell className="text-center">
                  {institutes.reduce((sum, inst) => sum + (inst._count?.teachers || 0), 0)}
                </TableCell>
                <TableCell className="text-center">
                  <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-accent text-white text-xs font-bold min-w-[32px]">
                    {institutes.reduce((sum, inst) => sum + (inst._count?.majors || 0), 0)}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-primary text-white text-xs font-bold min-w-[32px]">
                    {institutes.reduce((sum, inst) => sum + (inst._count?.courses || 0), 0)}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  {institutes.reduce((sum, inst) => sum + (inst._count?.users || 0), 0)}
                </TableCell>
                <TableCell />
              </TableRow>
            </tfoot>
          )}
        </Table>
      </div>

      {/* ═══ Admin Coverage Section ═══ */}
      <div className="bg-card rounded-xl border shadow-sm">
        <div className="flex justify-between items-center p-6 border-b flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-primary">Pokrycie administratorami</h2>
              <p className="text-sm text-muted-foreground">
                {adminCoverage.length} jednostek — {adminCoverageMissing} bez admina
                {adminCoverageMissing > 0 && (
                  <span className="ml-2 text-status-danger-fg font-semibold">(wymaga uwagi!)</span>
                )}
              </p>
            </div>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nazwa jednostki</TableHead>
              <TableHead className="text-center">Kod</TableHead>
              <TableHead className="text-center">Użytkownicy</TableHead>
              <TableHead className="text-center">Administratorzy</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead>Ostatnie logowanie</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {adminCoverageLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center h-24"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
            ) : adminCoverage.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">Brak jednostek.</TableCell></TableRow>
            ) : (
              adminCoverage.map((inst) => (
                <TableRow key={inst.id} className={!inst.hasAdmin ? 'bg-status-danger-bg0/5' : undefined}>
                  <TableCell className="font-semibold text-primary">{inst.name}</TableCell>
                  <TableCell className="text-center">
                    <span className="px-2 py-0.5 rounded bg-accent/10 text-accent text-xs font-bold border border-accent/20">
                      {inst.shortCode || '—'}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">{inst._count?.users || 0}</TableCell>
                  <TableCell className="text-center">
                    {inst.adminCount > 0 ? (
                      <span className="font-semibold text-status-active-fg">{inst.adminCount}</span>
                    ) : (
                      <span className="text-status-danger-fg font-semibold">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {inst.hasAdmin ? (
                      <Badge variant="default" className="bg-emerald-600 gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        OK
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1">
                        <ShieldAlert className="w-3 h-3" />
                        Brak admina
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {inst.admins.length > 0 ? (
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {inst.admins.map(a => (
                          <div key={a.id} className="flex items-center gap-1.5">
                            <span className="font-medium text-foreground">{a.name}</span>
                            <span className="text-[10px]">{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleDateString('pl-PL') : 'nigdy'}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ═══ Incomplete Groups (No Major) Section ═══ */}
      <div className="bg-card rounded-xl border shadow-sm">
        <div className="flex justify-between items-center p-6 border-b flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-500/10 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
                Grupy bez przypisanego kierunku
                {stats?.incompleteGroups && stats.incompleteGroups.length > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {stats.incompleteGroups.length}
                  </Badge>
                )}
              </h2>
              <p className="text-sm text-muted-foreground">
                Grupy studenckie w systemie, które nie mają zdefiniowanego kierunku studiów (major)
              </p>
            </div>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nazwa grupy</TableHead>
              <TableHead>Jednostka</TableHead>
              <TableHead>Semestr</TableHead>
              <TableHead className="text-center">Rok</TableHead>
              <TableHead className="text-center">Stopień</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {statsLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : !stats?.incompleteGroups || stats.incompleteGroups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24 text-emerald-600 font-medium bg-emerald-500/5">
                  ✅ Wszystkie grupy mają poprawnie przypisany kierunek studiów.
                </TableCell>
              </TableRow>
            ) : (
              stats.incompleteGroups.map((group) => (
                <TableRow key={group.id} className="hover:bg-muted/50">
                  <TableCell className="font-semibold text-foreground">{group.name}</TableCell>
                  <TableCell className="text-muted-foreground">{group.institute}</TableCell>
                  <TableCell className="text-muted-foreground">{group.semester}</TableCell>
                  <TableCell className="text-center font-medium">{group.year}</TableCell>
                  <TableCell className="text-center">
                    <span className="px-2 py-0.5 rounded bg-accent/10 text-accent text-xs font-bold border border-accent/20">
                      {group.degree === 'FIRST_CYCLE' ? 'I stopień' : group.degree === 'SECOND_CYCLE' ? 'II stopień' : group.degree}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ═══ Cross-Institute Workload Table ═══ */}
      {stats && stats.teacherWorkloads.length > 0 && (
        <div className="bg-card rounded-xl border shadow-sm">
          <div className="flex justify-between items-center p-6 border-b flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-accent/10 rounded-lg">
                <BarChart3 className="h-6 w-6 text-accent" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-primary">Obciążenia wydziałowe</h2>
                <p className="text-sm text-muted-foreground">
                  {filteredWorkloads.length} prowadzących
                  {wlOverCount > 0 && (
                    <span className="ml-2 text-status-danger-fg font-semibold">
                      ({wlOverCount} z nadgodzinami)
                    </span>
                  )}
                  {wlUnderCount > 0 && (
                    <span className="ml-2 text-status-active-fg font-semibold">
                      ({wlUnderCount} niedociążonych)
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* ─── Filtry ─── */}
          <div className="p-4 border-b space-y-3">
            {/* Rząd 1: Kafelki jednostek */}
            <div className="flex flex-wrap gap-2 items-center">
              <Filter className="w-4 h-4 text-muted-foreground" />
              {wlUniqueUnits.map(unit => {
                const isSelected = wlSelectedUnits.includes(unit);
                // Wyciągnij krótki kod z nazwy instytutu
                const shortCode = unit
                  .replace('Instytut Lingwistyki Stosowanej', 'ILS')
                  .replace('Instytut Filologii Germańskiej', 'IFG')
                  .replace('Instytut Filologii Romańskiej', 'IFROM')
                  .replace('Instytut Językoznawstwa', 'IJ')
                  .replace('Studium Praktycznej Nauki Języków Obcych', 'SPNJO')
                  .replace('Instytut Filologii Słowiańskiej', 'IFSłow')
                  .replace('Instytut Filologii Wschodniosłowiańskich', 'IFW')
                  .replace('Pracownik UCP', 'UCP')
                  .replace('Pracownik zlecony', 'Zlecenie')
                  .replace('Wydział Neofilologii', 'WN')
                  .replace('Brak przypisania', '—');
                return (
                  <Button
                    key={unit}
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setWlSelectedUnits(prev =>
                      prev.includes(unit) ? prev.filter(u => u !== unit) : [...prev, unit]
                    )}
                    className={`rounded-sm text-xs font-bold px-3 py-1.5 h-auto whitespace-nowrap border-2 transition-all ${isSelected
                      ? 'bg-accent border-accent text-white hover:bg-accent/90'
                      : 'border-accent/20 text-accent hover:bg-accent/5 hover:border-accent/40'
                      }`}
                    title={unit}
                  >
                    {shortCode}
                  </Button>
                );
              })}
              {wlSelectedUnits.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setWlSelectedUnits([])} className="text-xs">
                  Wyczyść
                </Button>
              )}
            </div>

            {/* Rząd 2: Status + Szukaj */}
            <div className="flex flex-wrap gap-2 items-center">
              <Button
                variant={wlStatusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setWlStatusFilter('all')}
                className="rounded-sm text-xs h-auto px-3 py-1.5"
              >
                Wszyscy
              </Button>
              <Button
                variant={wlStatusFilter === 'overloaded' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setWlStatusFilter('overloaded')}
                className="rounded-sm text-xs h-auto px-3 py-1.5 border-red-300 hover:bg-status-danger-bg"
              >
                <TrendingUp className="w-3 h-3 mr-1 text-status-danger-fg" />
                Nadgodziny ({stats.teacherWorkloads.filter(t => t.balance > 0).length})
              </Button>
              <Button
                variant={wlStatusFilter === 'underloaded' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setWlStatusFilter('underloaded')}
                className="rounded-sm text-xs h-auto px-3 py-1.5 border-emerald-300 hover:bg-status-active-bg"
              >
                <TrendingDown className="w-3 h-3 mr-1 text-status-active-fg" />
                Niedociążeni ({stats.teacherWorkloads.filter(t => t.balance < 0).length})
              </Button>
              <Button
                variant={wlStatusFilter === 'ok' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setWlStatusFilter('ok')}
                className="rounded-sm text-xs h-auto px-3 py-1.5 border-warm-border hover:bg-cream"
              >
                <Minus className="w-3 h-3 mr-1 text-muted-foreground" />
                W normie ({stats.teacherWorkloads.filter(t => t.balance === 0).length})
              </Button>

              <div className="ml-auto relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Szukaj prowadzącego..."
                  value={wlSearch}
                  onChange={e => setWlSearch(e.target.value)}
                  className="pl-8 h-8 text-sm w-56"
                />
              </div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button onClick={() => toggleWlSort('name')} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                    Prowadzący
                    <ArrowUpDown className={`w-3 h-3 ${wlSortBy === 'name' ? 'text-primary' : 'text-muted-foreground/50'}`} />
                  </button>
                </TableHead>
                <TableHead>
                  <button onClick={() => toggleWlSort('institute')} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                    Jednostka
                    <ArrowUpDown className={`w-3 h-3 ${wlSortBy === 'institute' ? 'text-primary' : 'text-muted-foreground/50'}`} />
                  </button>
                </TableHead>
                <TableHead className="text-center">Pensum</TableHead>
                <TableHead className="text-center">
                  <button onClick={() => toggleWlSort('totalHours')} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                    Godziny
                    <ArrowUpDown className={`w-3 h-3 ${wlSortBy === 'totalHours' ? 'text-primary' : 'text-muted-foreground/50'}`} />
                  </button>
                </TableHead>
                <TableHead className="text-center">
                  <button onClick={() => toggleWlSort('balance')} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                    Bilans
                    <ArrowUpDown className={`w-3 h-3 ${wlSortBy === 'balance' ? 'text-primary' : 'text-muted-foreground/50'}`} />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWorkloads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Brak wyników dla wybranych filtrów
                  </TableCell>
                </TableRow>
              ) : filteredWorkloads.map((t) => (
                <TableRow key={t.id} className={t.balance > 0 ? 'bg-status-danger-bg0/5' : t.balance < 0 ? 'bg-status-warning-bg0/5' : 'bg-status-active-bg0/5'}>
                  <TableCell className="font-semibold">{t.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.institute}</TableCell>
                  <TableCell className="text-center">{t.pensumLimit}h</TableCell>
                  <TableCell className="text-center font-medium">{t.totalHours}h</TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${t.balance > 0
                      ? 'bg-status-danger-bg text-status-danger-fg'
                      : t.balance < 0
                        ? 'bg-status-warning-bg text-status-warning-fg'
                        : 'bg-status-active-bg text-status-active-fg'
                      }`}>
                      {t.balance > 0 ? <TrendingUp className="w-3 h-3" /> : t.balance < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                      {t.balance > 0 ? '+' : ''}{t.balance}h
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ═══ Create/Edit Dialog ═══ */}
      <Dialog open={isCreateOpen || !!editingInstitute} onOpenChange={(v) => { if (!v) { setIsCreateOpen(false); setEditingInstitute(null); resetForm(); } }}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{editingInstitute ? 'Edytuj jednostkę' : 'Nowa jednostka organizacyjna'}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const payload = {
                name: instituteName,
                shortCode: instituteShortCode || undefined,
                usosCode: instituteUsosCode || undefined,
              };
              if (editingInstitute) {
                updateMutation.mutate({ id: editingInstitute.id, ...payload });
              } else {
                createMutation.mutate(payload);
              }
            }}
            className="space-y-4 pt-4"
          >
            <div className="space-y-2">
              <Label htmlFor="instituteName">Nazwa jednostki</Label>
              <Input
                id="instituteName"
                placeholder="np. Instytut Filologii Romańskiej"
                value={instituteName}
                onChange={(e) => setInstituteName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="instituteShortCode">Kod skrócony</Label>
                <Input
                  id="instituteShortCode"
                  placeholder="np. ILS"
                  value={instituteShortCode}
                  onChange={(e) => setInstituteShortCode(e.target.value)}
                  maxLength={10}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instituteUsosCode">Kod USOS</Label>
                <Input
                  id="instituteUsosCode"
                  placeholder="np. 990020500"
                  value={instituteUsosCode}
                  onChange={(e) => setInstituteUsosCode(e.target.value)}
                  maxLength={20}
                />
              </div>
            </div>
            <Button type="submit" disabled={!instituteName.trim() || createMutation.isPending || updateMutation.isPending} className="w-full">
              {editingInstitute ? 'Zapisz zmiany' : 'Utwórz jednostkę'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
