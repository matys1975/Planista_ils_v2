import { useState } from 'react';
import {
    Building2, LayoutDashboard, BarChart3, Users as UsersIcon,
    ShieldCheck, Eye, Download, Pencil, Trash2, Plus, Upload,
    Loader2, Search, Crown, AlertCircle, Printer
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { useDeanAnalytics } from '../features/dean/hooks/useDeanAnalytics';
import { useDeanInstitutes } from '../features/dean/hooks/useDeanInstitutes';
import { useDeanUsers } from '../features/dean/hooks/useDeanUsers';
import { DashboardKPICards } from '../features/dean/components/analytics/DashboardKPICards';
import { InstituteComparisonChart } from '../features/dean/components/analytics/InstituteComparisonChart';
import { InstituteAlertCards } from '../features/dean/components/analytics/InstituteAlertCards';
import { TeacherStatusPieChart, WorkloadHistogram } from '../features/dean/components/analytics/WorkloadDistributionCharts';
import { DeanWorkloadTable } from '../features/dean/components/DeanWorkloadTable';
import { DeanInstitutesTable } from '../features/dean/components/DeanInstitutesTable';
import { SortableHeader } from '../features/dean/components/SortableHeader';
import { fetchApi } from '../lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

import type { SortState, DeanInstitute, DeanUser } from '../features/dean/types/dean.types';

type TabKey = 'overview' | 'institutes' | 'workload' | 'users' | 'requests' | 'admin-coverage';

const ALL_TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: 'overview', label: 'Przegląd', icon: LayoutDashboard },
    { key: 'institutes', label: 'Jednostki', icon: Building2 },
    { key: 'workload', label: 'Obciążenia', icon: BarChart3 },
    { key: 'users', label: 'Użytkownicy', icon: UsersIcon },
    { key: 'requests', label: 'Zapotrzebowania', icon: AlertCircle },
];

/* ═══════════════════════════════════════════════════════════════════ */
/*  FACULTY DASHBOARD                                                */
/* ═══════════════════════════════════════════════════════════════════ */

export function FacultyDashboard() {
    const { role, name } = useAuthStore();
    const isAdmin = role === 'SUPER_ADMIN';
    const tabs = isAdmin
        ? [...ALL_TABS, { key: 'admin-coverage' as TabKey, label: 'Pokrycie adminami', icon: ShieldCheck }]
        : ALL_TABS;

    const [activeTab, setActiveTab] = useState<TabKey>('overview');

    return (
        <div className="space-y-6 p-4 sm:p-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-card px-4 sm:px-6 py-4 rounded-xl border shadow-sm gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary rounded-lg shadow-sm">
                        <Crown className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div>
                        <h1 className="text-xl font-extrabold tracking-tight text-primary">
                            Panel Wydziałowy
                        </h1>
                        <p className="text-xs text-muted-foreground">
                            {isAdmin ? 'Pełna administracja wydziałem' : 'Scentralizowany panel analityczny dla Dziekana'}
                        </p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-muted/40 rounded-lg border p-1 w-fit flex-wrap">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${isActive
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'text-muted-foreground hover:bg-muted'
                                    }`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Content */}
            {activeTab === 'overview' && <OverviewTab />}
            {activeTab === 'institutes' && <InstitutesTab isAdmin={isAdmin} />}
            {activeTab === 'workload' && <WorkloadTab />}
            {activeTab === 'users' && <UsersTab isAdmin={isAdmin} />}
            {activeTab === 'requests' && <DeanStaffingRequestsTab />}
            {isAdmin && activeTab === 'admin-coverage' && <AdminCoverageTab />}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  OVERVIEW — Nowy analityczny przegląd                             */
/* ═══════════════════════════════════════════════════════════════════ */

function OverviewTab() {
    const { data, isLoading } = useDeanAnalytics();
    const analytics = data?.data;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Ładowanie analityki wydziałowej...</span>
            </div>
        );
    }
    if (!analytics) {
        return <div className="text-center py-20 text-muted-foreground">Brak danych analitycznych.</div>;
    }

    return (
        <div className="space-y-6">
            {/* 1. Kluczowe KPI — 4 karty zamiast 8 */}
            <DashboardKPICards kpis={analytics.summaryKPIs} />

            {/* 2. Główny wykres porównawczy jednostek */}
            <InstituteComparisonChart institutes={analytics.institutesComparison} />

            {/* 3. Karty jednostek z alertami */}
            <InstituteAlertCards institutes={analytics.institutesComparison} />

            {/* 4. Wykresy rozkładów — obok siebie */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <TeacherStatusPieChart distribution={analytics.teachersDistribution} />
                <WorkloadHistogram histogram={analytics.workloadHistogram} />
            </div>

            {/* 5. Aktywne semestry (kompaktowo) */}
            {analytics.activeSemesters.length > 0 && (
                <div className="bg-card rounded-xl border p-4 shadow-sm flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                        Aktywne semestry:
                    </span>
                    {analytics.activeSemesters.map((s: any) => (
                        <Badge key={s.id} variant="outline" className="text-xs">
                            {s.name} ({s.year})
                        </Badge>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  INSTITUTES                                                       */
/* ═══════════════════════════════════════════════════════════════════ */

function InstitutesTab({ isAdmin }: { isAdmin: boolean }) {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const setSimulatedInstituteId = useAuthStore((s) => s.setSimulatedInstituteId);

    const [sort, setSort] = useState<SortState>({ by: 'name', dir: 'asc' });
    const [search, setSearch] = useState('');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editing, setEditing] = useState<DeanInstitute | null>(null);
    const [instituteName, setInstituteName] = useState('');
    const [instituteShortCode, setInstituteShortCode] = useState('');
    const [instituteUsosCode, setInstituteUsosCode] = useState('');
    const [isImporting, setIsImporting] = useState(false);

    const { data, isLoading } = useDeanInstitutes({ sortBy: sort.by, sortDir: sort.dir, search: search || undefined });
    const institutes: DeanInstitute[] = data?.data || [];

    function handleSort(key: string) {
        setSort((prev) => ({ by: key, dir: prev.by === key && prev.dir === 'asc' ? 'desc' : 'asc' }));
    }

    const createMutation = useMutation({
        mutationFn: (payload: any) => fetchApi('/superadmin/institutes', { method: 'POST', body: JSON.stringify(payload) }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['dean-institutes'] }); setIsCreateOpen(false); resetForm(); toast.success('Jednostka utworzona.'); },
        onError: (err: any) => toast.error(err.message),
    });
    const updateMutation = useMutation({
        mutationFn: ({ id, ...data }: any) => fetchApi(`/superadmin/institutes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['dean-institutes'] }); setEditing(null); resetForm(); toast.success('Jednostka zaktualizowana.'); },
        onError: (err: any) => toast.error(err.message),
    });
    const deleteMutation = useMutation({
        mutationFn: (id: string) => fetchApi(`/superadmin/institutes/${id}`, { method: 'DELETE' }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['dean-institutes'] }); toast.success('Jednostka usunięta.'); },
        onError: (err: any) => toast.error(err.message),
    });

    function resetForm() { setInstituteName(''); setInstituteShortCode(''); setInstituteUsosCode(''); }
    function openEdit(inst: DeanInstitute) { setEditing(inst); setInstituteName(inst.name); setInstituteShortCode(inst.shortCode || ''); setInstituteUsosCode(inst.usosCode || ''); setIsCreateOpen(true); }
    function openCreate() { resetForm(); setEditing(null); setIsCreateOpen(true); }

    const handleExport = async (inst: DeanInstitute) => {
        const res = await fetch(`/api/v1/superadmin/institutes/${inst.id}/export`, { credentials: 'include' });
        if (!res.ok) { toast.error('Błąd eksportu'); return; }
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `export_${inst.name.replace(/\s+/g, '_')}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success(`Wyeksportowano dane "${inst.name}".`);
    };

    const handleImport = () => {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = '.json';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return;
            if (!window.confirm(`Import danych z pliku JSON\n\nPlik: ${file.name}\n\nCzy kontynuować?`)) return;
            setIsImporting(true);
            try {
                const formData = new FormData(); formData.append('file', file);
                const res = await fetch(`/api/v1/superadmin/import`, { method: 'POST', body: formData, credentials: 'include' });
                const result = await res.json();
                if (!res.ok) throw new Error(result.error || 'Błąd importu');
                queryClient.invalidateQueries({ queryKey: ['dean-institutes'] });
                toast.success(result.message);
            } catch (err: any) { toast.error(`Błąd importu: ${err.message}`); } finally { setIsImporting(false); }
        };
        input.click();
    };

    if (!isAdmin) {
        return <DeanInstitutesTable />;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="relative flex-1 sm:flex-initial">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Szukaj jednostki..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-8 text-sm w-full sm:w-72" />
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleImport} disabled={isImporting}>
                        {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Import JSON
                    </Button>
                    <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4" /> Nowa jednostka</Button>
                </div>
            </div>

            <div className="rounded-lg border bg-white overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-cream">
                            <SortableHeader label="Nazwa" sortKey="name" currentSort={sort} onSort={handleSort} />
                            <SortableHeader label="Kod" sortKey="shortCode" currentSort={sort} onSort={handleSort} />
                            <SortableHeader label="Prowadzący" sortKey="teachers" currentSort={sort} onSort={handleSort} />
                            <SortableHeader label="Kierunki" sortKey="majors" currentSort={sort} onSort={handleSort} />
                            <SortableHeader label="Przedmioty" sortKey="courses" currentSort={sort} onSort={handleSort} />
                            <SortableHeader label="Użytkownicy" sortKey="users" currentSort={sort} onSort={handleSort} />
                            <TableHead className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Akcje</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></TableCell></TableRow>
                        ) : institutes.length === 0 ? (
                            <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Brak jednostek.</TableCell></TableRow>
                        ) : (
                            institutes.map((i: DeanInstitute) => (
                                <TableRow key={i.id}>
                                    <TableCell className="font-medium">{i.name}</TableCell>
                                    <TableCell><span className="px-2 py-0.5 rounded bg-accent/10 text-accent text-xs font-bold border border-accent/20">{i.shortCode || '—'}</span></TableCell>
                                    <TableCell>{i._count?.teachers || 0}</TableCell>
                                    <TableCell>{i._count?.majors || 0}</TableCell>
                                    <TableCell>{i._count?.courses || 0}</TableCell>
                                    <TableCell>{i._count?.users || 0}</TableCell>
                                    <TableCell>
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="icon" title="Symuluj widok" onClick={() => { setSimulatedInstituteId(i.id); navigate({ to: '/' }); }} className="hover:bg-navy-mid/10 hover:text-navy-mid h-8 w-8"><Eye className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" title="Eksportuj JSON" onClick={() => handleExport(i)} className="hover:bg-status-active-bg hover:text-status-active-fg h-8 w-8"><Download className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" title="Edytuj" onClick={() => openEdit(i)} className="hover:bg-primary/10 hover:text-primary h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" title="Usuń" onClick={() => { if (confirm(`Usunąć jednostkę "${i.name}"?`)) deleteMutation.mutate(i.id); }} className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8"><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Create/Edit Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={(v) => { if (!v) { setIsCreateOpen(false); setEditing(null); resetForm(); } }}>
                <DialogContent aria-describedby={undefined}>
                    <DialogHeader><DialogTitle>{editing ? 'Edytuj jednostkę' : 'Nowa jednostka'}</DialogTitle></DialogHeader>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        const payload = { name: instituteName, shortCode: instituteShortCode || undefined, usosCode: instituteUsosCode || undefined };
                        if (editing) updateMutation.mutate({ id: editing.id, ...payload });
                        else createMutation.mutate(payload);
                    }} className="space-y-4 pt-4">
                        <div className="space-y-2"><Label>Nazwa jednostki</Label><Input value={instituteName} onChange={(e) => setInstituteName(e.target.value)} autoFocus /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Kod skrócony</Label><Input value={instituteShortCode} onChange={(e) => setInstituteShortCode(e.target.value)} maxLength={10} /></div>
                            <div className="space-y-2"><Label>Kod USOS</Label><Input value={instituteUsosCode} onChange={(e) => setInstituteUsosCode(e.target.value)} maxLength={20} /></div>
                        </div>
                        <Button type="submit" disabled={!instituteName.trim() || createMutation.isPending || updateMutation.isPending} className="w-full">
                            {editing ? 'Zapisz zmiany' : 'Utwórz jednostkę'}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  WORKLOAD                                                         */
/* ═══════════════════════════════════════════════════════════════════ */

function WorkloadTab() {
    return <DeanWorkloadTable />;
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  USERS                                                            */
/* ═══════════════════════════════════════════════════════════════════ */

function UsersTab({ isAdmin }: { isAdmin: boolean }) {
    const queryClient = useQueryClient();
    const [sort, setSort] = useState<SortState>({ by: 'name', dir: 'asc' });
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<DeanUser | null>(null);
    const [formName, setFormName] = useState('');
    const [formEmail, setFormEmail] = useState('');
    const [formRole, setFormRole] = useState('VIEWER');
    const [formPassword, setFormPassword] = useState('');
    const [formFacultyId, setFormFacultyId] = useState('');
    const [resetUserId, setResetUserId] = useState<string | null>(null);
    const [resetPassword, setResetPassword] = useState('');

    const { data: facultiesData } = useQuery({
        queryKey: ['faculties'],
        queryFn: () => fetchApi('/api/v1/faculties'),
        enabled: isAdmin,
    });
    const faculties = facultiesData?.data || [];

    const { data, isLoading } = useDeanUsers({ sortBy: sort.by, sortDir: sort.dir, search: search || undefined, role: roleFilter || undefined });
    const users: DeanUser[] = data?.data || [];

    function handleSort(key: string) {
        setSort((prev) => ({ by: key, dir: prev.by === key && prev.dir === 'asc' ? 'desc' : 'asc' }));
    }

    const createMutation = useMutation({
        mutationFn: (payload: any) => fetchApi('/api/v1/dean/users', { method: 'POST', body: JSON.stringify(payload) }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['dean-users'] }); closeForm(); toast.success('Użytkownik utworzony.'); },
        onError: (err: any) => toast.error(err.message),
    });
    const updateMutation = useMutation({
        mutationFn: ({ id, ...data }: any) => fetchApi(`/api/v1/dean/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['dean-users'] }); closeForm(); toast.success('Użytkownik zaktualizowany.'); },
        onError: (err: any) => toast.error(err.message),
    });
    const deleteMutation = useMutation({
        mutationFn: (id: string) => fetchApi(`/api/v1/dean/users/${id}`, { method: 'DELETE' }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['dean-users'] }); toast.success('Użytkownik usunięty.'); },
        onError: (err: any) => toast.error(err.message),
    });
    const resetMutation = useMutation({
        mutationFn: ({ id, password }: { id: string; password: string }) => fetchApi(`/api/v1/dean/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword: password }) }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['dean-users'] }); setResetUserId(null); setResetPassword(''); toast.success('Hasło zresetowane.'); },
        onError: (err: any) => toast.error(err.message),
    });

    function closeForm() { setIsFormOpen(false); setEditingUser(null); setFormName(''); setFormEmail(''); setFormRole('VIEWER'); setFormPassword(''); setFormFacultyId(''); }
    function openCreate() { closeForm(); setIsFormOpen(true); }
    function openEdit(u: DeanUser) { setEditingUser(u); setFormName(u.name); setFormEmail(u.email); setFormRole(u.role); setFormPassword(''); setFormFacultyId(u.facultyId || ''); setIsFormOpen(true); }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-1">
                    <div className="relative flex-1 sm:flex-initial">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input placeholder="Szukaj użytkownika..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-8 text-sm w-full sm:w-72" />
                    </div>
                    <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="h-8 text-sm border rounded-md px-2 bg-white">
                        <option value="">Wszystkie role</option>
                        <option value="ADMIN">ADMIN</option>
                        <option value="PLANNER">PLANNER</option>
                        <option value="VIEWER">VIEWER</option>
                        <option value="DEAN">Dziekan</option>
                    </select>
                </div>
                {isAdmin && <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4" /> Nowy użytkownik</Button>}
            </div>

            <div className="rounded-lg border bg-white overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-cream">
                            <SortableHeader label="Użytkownik" sortKey="name" currentSort={sort} onSort={handleSort} />
                            <SortableHeader label="Email" sortKey="email" currentSort={sort} onSort={handleSort} />
                            <SortableHeader label="Rola" sortKey="role" currentSort={sort} onSort={handleSort} />
                            <SortableHeader label="Jednostka" sortKey="institute" currentSort={sort} onSort={handleSort} />
                            <SortableHeader label="Ostatnie logowanie" sortKey="lastLoginAt" currentSort={sort} onSort={handleSort} />
                            <TableHead className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Aktywność</TableHead>
                            {isAdmin && <TableHead className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Akcje</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></TableCell></TableRow>
                        ) : users.length === 0 ? (
                            <TableRow><TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-12 text-muted-foreground">Brak użytkowników.</TableCell></TableRow>
                        ) : (
                            users.map((u) => (
                                <TableRow key={u.id}>
                                    <TableCell className="font-medium">{u.name}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                                    <TableCell><Badge variant="outline" className="text-xs">{u.role}</Badge></TableCell>
                                    <TableCell>{u.institute}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('pl-PL') : 'nigdy'}</TableCell>
                                    <TableCell>
                                        {u.activityStatus === 'active' ? <Badge className="bg-emerald-600 text-[10px]">Aktywny</Badge> :
                                            u.activityStatus === 'recent' ? <Badge className="bg-status-warning-bg0 text-[10px]">Niedawno</Badge> :
                                                <Badge variant="secondary" className="text-[10px]">Bezczynny</Badge>}
                                    </TableCell>
                                    {isAdmin && (
                                        <TableCell>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="icon" title="Reset hasła" onClick={() => setResetUserId(u.id)} className="hover:bg-navy-mid/10 hover:text-navy-mid h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" title="Edytuj" onClick={() => openEdit(u)} className="hover:bg-primary/10 hover:text-primary h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" title="Usuń" onClick={() => { if (confirm(`Usunąć użytkownika "${u.name}"?`)) deleteMutation.mutate(u.id); }} className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8"><Trash2 className="h-4 w-4" /></Button>
                                            </div>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Create/Edit Dialog */}
            <Dialog open={isFormOpen} onOpenChange={(v) => { if (!v) closeForm(); }}>
                <DialogContent aria-describedby={undefined}>
                    <DialogHeader><DialogTitle>{editingUser ? 'Edytuj użytkownika' : 'Nowy użytkownik'}</DialogTitle></DialogHeader>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        if (editingUser) {
                            const payload: any = { name: formName, email: formEmail, role: formRole };
                            if (formPassword) payload.newPassword = formPassword;
                            if (formFacultyId) payload.facultyId = formFacultyId;
                            updateMutation.mutate({ id: editingUser.id, ...payload });
                        } else {
                            const payload: any = { name: formName, email: formEmail, role: formRole, password: formPassword };
                            if (formFacultyId) payload.facultyId = formFacultyId;
                            createMutation.mutate(payload);
                        }
                    }} className="space-y-4 pt-4">
                        <div className="space-y-2"><Label>Imię i nazwisko</Label><Input value={formName} onChange={(e) => setFormName(e.target.value)} required /></div>
                        <div className="space-y-2"><Label>Email</Label><Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} required /></div>
                        <div className="space-y-2"><Label>Rola</Label>
                            <select value={formRole} onChange={(e) => setFormRole(e.target.value)} className="w-full h-10 border rounded-md px-2 bg-white text-sm">
                                <option value="ADMIN">ADMIN</option>
                                <option value="PLANNER">PLANNER</option>
                                <option value="VIEWER">VIEWER</option>
                                <option value="DEAN">Dziekan</option>
                            </select>
                        </div>
                        {formRole === 'DEAN' && (
                            <div className="space-y-2">
                                <Label>Wydział</Label>
                                <select value={formFacultyId} onChange={(e) => setFormFacultyId(e.target.value)} className="w-full h-10 border rounded-md px-2 bg-white text-sm" required>
                                    <option value="">Wybierz wydział</option>
                                    {faculties.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                            </div>
                        )}
                        <div className="space-y-2"><Label>{editingUser ? 'Nowe hasło (opcjonalnie)' : 'Hasło'}</Label><Input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} required={!editingUser} minLength={6} /></div>
                        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="w-full">
                            {editingUser ? 'Zapisz zmiany' : 'Utwórz użytkownika'}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Reset Password Dialog */}
            <Dialog open={!!resetUserId} onOpenChange={(v) => { if (!v) { setResetUserId(null); setResetPassword(''); } }}>
                <DialogContent aria-describedby={undefined}>
                    <DialogHeader><DialogTitle>Reset hasła</DialogTitle></DialogHeader>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        if (resetUserId && resetPassword.length >= 6) resetMutation.mutate({ id: resetUserId, password: resetPassword });
                    }} className="space-y-4 pt-4">
                        <div className="space-y-2"><Label>Nowe hasło (min. 6 znaków)</Label><Input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} minLength={6} required /></div>
                        <Button type="submit" disabled={resetMutation.isPending} className="w-full">Zresetuj hasło</Button>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  ADMIN COVERAGE (SuperAdmin only)                                 */
/* ═══════════════════════════════════════════════════════════════════ */

function AdminCoverageTab() {
    const queryClient = useQueryClient();
    const { data, isLoading } = useQuery({
        queryKey: ['superadmin-institute-admins'],
        queryFn: () => fetchApi('/superadmin/institute-admins'),
    });
    const coverage: any[] = data?.data || [];

    // Dialog state
    const [selectedInst, setSelectedInst] = useState<any | null>(null);
    const [assignMode, setAssignMode] = useState<'search' | 'manual'>('search');

    // Search teachers
    const [teacherSearch, setTeacherSearch] = useState('');
    const { data: teachersData } = useQuery({
        queryKey: ['faculty-teachers', teacherSearch],
        queryFn: () => fetchApi(`/superadmin/faculty-teachers?search=${encodeURIComponent(teacherSearch)}`),
        enabled: !!selectedInst && teacherSearch.length >= 2,
    });
    const foundTeachers: any[] = teachersData?.data || [];

    // Manual form
    const [manualName, setManualName] = useState('');
    const [manualEmail, setManualEmail] = useState('');
    const [manualPassword, setManualPassword] = useState('');

    // Mutations
    const assignFromTeacher = useMutation({
        mutationFn: ({ instituteId, teacherId }: { instituteId: string; teacherId: string }) =>
            fetchApi(`/superadmin/institutes/${instituteId}/assign-admin`, { method: 'POST', body: JSON.stringify({ teacherId }) }),
        onSuccess: (res: any) => { queryClient.invalidateQueries({ queryKey: ['superadmin-institute-admins'] }); toast.success(res.message); closeDialog(); },
        onError: (err: any) => toast.error(err.message),
    });

    const assignManual = useMutation({
        mutationFn: ({ instituteId, name, email, password }: { instituteId: string; name: string; email: string; password: string }) =>
            fetchApi(`/superadmin/institutes/${instituteId}/assign-admin`, { method: 'POST', body: JSON.stringify({ name, email, password }) }),
        onSuccess: (res: any) => { queryClient.invalidateQueries({ queryKey: ['superadmin-institute-admins'] }); toast.success(res.message); closeDialog(); },
        onError: (err: any) => toast.error(err.message),
    });

    const removeAdmin = useMutation({
        mutationFn: ({ instId, userId }: { instId: string; userId: string }) =>
            fetchApi(`/superadmin/institutes/${instId}/admins/${userId}`, { method: 'DELETE' }),
        onSuccess: (res: any) => { queryClient.invalidateQueries({ queryKey: ['superadmin-institute-admins'] }); toast.success(res.message); },
        onError: (err: any) => toast.error(err.message),
    });

    function closeDialog() {
        setSelectedInst(null);
        setTeacherSearch('');
        setManualName('');
        setManualEmail('');
        setManualPassword('');
        setAssignMode('search');
    }

    return (
        <div className="space-y-4">
            <div className="bg-card rounded-xl border shadow-sm p-6">
                <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-primary/10 rounded-lg"><ShieldCheck className="h-6 w-6 text-primary" /></div>
                    <div>
                        <h2 className="text-xl font-bold tracking-tight text-primary">Pokrycie administratorami</h2>
                        <p className="text-sm text-muted-foreground">{coverage.length} jednostek — {coverage.filter((i) => !i.hasAdmin).length} bez admina</p>
                    </div>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow><TableHead>Nazwa jednostki</TableHead><TableHead className="text-center">Kod</TableHead><TableHead className="text-center">Użytkownicy</TableHead>
                            <TableHead className="text-center">Administratorzy</TableHead><TableHead className="text-center">Status</TableHead><TableHead>Admini / Ostatnie logowanie</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-12"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></TableCell></TableRow>
                        ) : coverage.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Brak danych.</TableCell></TableRow>
                        ) : (
                            coverage.map((inst) => (
                                <TableRow key={inst.id} className={!inst.hasAdmin ? 'bg-status-danger-bg/30' : undefined}>
                                    <TableCell className="font-semibold text-primary">{inst.name}</TableCell>
                                    <TableCell className="text-center"><span className="px-2 py-0.5 rounded bg-accent/10 text-accent text-xs font-bold border border-accent/20">{inst.shortCode || '—'}</span></TableCell>
                                    <TableCell className="text-center">{inst._count?.users || 0}</TableCell>
                                    <TableCell className="text-center">{inst.adminCount > 0 ? <span className="font-semibold text-status-active-fg">{inst.adminCount}</span> : <span className="text-status-danger-fg font-semibold">0</span>}</TableCell>
                                    <TableCell className="text-center">
                                        <button
                                            onClick={() => setSelectedInst(inst)}
                                            className="cursor-pointer transition-transform hover:scale-105"
                                            title="Kliknij, aby zarządzać adminami"
                                        >
                                            {inst.hasAdmin
                                                ? <Badge className="bg-status-active-fg gap-1 cursor-pointer hover:bg-status-active-fg/80"><span className="w-3 h-3">✓</span>OK</Badge>
                                                : <Badge variant="destructive" className="gap-1 cursor-pointer hover:bg-destructive/80"><span className="w-3 h-3">⚠</span>Brak admina</Badge>
                                            }
                                        </button>
                                    </TableCell>
                                    <TableCell>
                                        {inst.admins?.length > 0 ? (
                                            <div className="text-xs text-muted-foreground space-y-1">
                                                {inst.admins.map((a: any) => (
                                                    <div key={a.id} className="flex items-center gap-1.5 group">
                                                        <span className="font-medium text-foreground">{a.name}</span>
                                                        <span className="text-[10px]">{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleDateString('pl-PL') : 'nigdy'}</span>
                                                        <button
                                                            onClick={() => { if (confirm(`Usunąć rolę admina dla "${a.name}"?`)) removeAdmin.mutate({ instId: inst.id, userId: a.id }); }}
                                                            className="opacity-0 group-hover:opacity-100 text-status-danger-fg hover:text-destructive transition-opacity ml-1"
                                                            title="Usuń rolę admina"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : <span className="text-xs text-muted-foreground">—</span>}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* ═══ Assign Admin Dialog ═══ */}
            <Dialog open={!!selectedInst} onOpenChange={(v) => { if (!v) closeDialog(); }}>
                <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-primary" />
                            Zarządzanie adminami — {selectedInst?.name}
                        </DialogTitle>
                    </DialogHeader>

                    {/* Existing admins list */}
                    {selectedInst?.admins?.length > 0 && (
                        <div className="border rounded-lg p-3 bg-cream-dark/50 space-y-1.5">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-2">Obecni admini</p>
                            {selectedInst.admins.map((a: any) => (
                                <div key={a.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-cream-header">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-full bg-gold flex items-center justify-center text-navy-deep font-bold text-[10px]">
                                            {a.name?.[0]}
                                        </div>
                                        <div>
                                            <span className="text-sm font-medium">{a.name}</span>
                                            <span className="text-xs text-muted-foreground ml-2">{a.email}</span>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost" size="icon"
                                        className="h-7 w-7 text-status-danger-fg hover:bg-status-danger-bg"
                                        onClick={() => { if (confirm(`Usunąć rolę admina dla "${a.name}"?`)) removeAdmin.mutate({ instId: selectedInst.id, userId: a.id }); }}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Mode toggle */}
                    <div className="flex gap-1 bg-muted/40 rounded-lg border p-1">
                        <button
                            onClick={() => setAssignMode('search')}
                            className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${assignMode === 'search' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted'}`}
                        >
                            <Search className="w-3.5 h-3.5 inline mr-1.5" />Szukaj prowadzącego
                        </button>
                        <button
                            onClick={() => setAssignMode('manual')}
                            className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${assignMode === 'manual' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted'}`}
                        >
                            <Plus className="w-3.5 h-3.5 inline mr-1.5" />Ręcznie
                        </button>
                    </div>

                    {assignMode === 'search' ? (
                        <div className="space-y-3">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Szukaj po nazwisku, imieniu lub emailu (min. 2 znaki)..."
                                    value={teacherSearch}
                                    onChange={(e) => setTeacherSearch(e.target.value)}
                                    className="pl-9"
                                    autoFocus
                                />
                            </div>

                            {teacherSearch.length >= 2 && (
                                <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
                                    {foundTeachers.length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center py-6">Brak wyników dla „{teacherSearch}"</p>
                                    ) : (
                                        foundTeachers.map((t) => (
                                            <button
                                                key={t.id}
                                                onClick={() => { if (selectedInst) assignFromTeacher.mutate({ instituteId: selectedInst.id, teacherId: t.id }); }}
                                                disabled={assignFromTeacher.isPending}
                                                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-cream-dark transition-colors text-left disabled:opacity-50"
                                            >
                                                <div>
                                                    <div className="text-sm font-medium">{t.title} {t.firstName} {t.lastName}</div>
                                                    <div className="text-xs text-muted-foreground">{t.email}</div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {t.institute && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/20 font-bold">
                                                            {t.institute.shortCode || t.institute.name}
                                                        </span>
                                                    )}
                                                    <Plus className="w-4 h-4 text-status-active-fg" />
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            if (selectedInst && manualName && manualEmail && manualPassword) {
                                assignManual.mutate({ instituteId: selectedInst.id, name: manualName, email: manualEmail, password: manualPassword });
                            }
                        }} className="space-y-3">
                            <div className="space-y-2"><Label>Imię i nazwisko</Label><Input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Jan Kowalski" required /></div>
                            <div className="space-y-2"><Label>Email</Label><Input type="email" value={manualEmail} onChange={(e) => setManualEmail(e.target.value)} placeholder="jan.kowalski@amu.edu.pl" required /></div>
                            <div className="space-y-2"><Label>Hasło (min. 6 znaków)</Label><Input type="password" value={manualPassword} onChange={(e) => setManualPassword(e.target.value)} minLength={6} required /></div>
                            <Button type="submit" className="w-full" disabled={assignManual.isPending || !manualName || !manualEmail || manualPassword.length < 6}>
                                {assignManual.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Tworzę...</> : <><Plus className="w-4 h-4" /> Utwórz admina</>}
                            </Button>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  DEAN STAFFING REQUESTS                                           */
/* ═══════════════════════════════════════════════════════════════════ */

function DeanStaffingRequestsTab() {
    const queryClient = useQueryClient();
    const { data: requestsData, isLoading } = useQuery({
        queryKey: ['dean-staffing-requests'],
        queryFn: () => fetchApi('/staffing-requests?scope=global'),
    });

    const statusMutation = useMutation({
        mutationFn: ({ id, status, adminNotes }: { id: string, status?: string, adminNotes?: string }) => 
            fetchApi(`/staffing-requests/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, adminNotes }) }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dean-staffing-requests'] });
            toast.success('Zapisano zmianę');
        },
        onError: (err: any) => toast.error('Błąd zmiany statusu: ' + err.message)
    });

    const handleExportCSV = () => {
        const requests = requestsData?.data || [];
        if (requests.length === 0) {
            toast.error('Brak danych do eksportu');
            return;
        }

        const headers = ['Jednostka', 'Przedmiot', 'Kod przedmiotu', 'Typ', 'Semestr', 'Liczba grup', 'Liczba godzin', 'Uwagi Instytutu', 'Notatki Dziekanatu', 'Status'];
        
        const rows = requests.map((req: any) => [
            req.institute?.name || 'Nieznana jednostka',
            req.course.name,
            req.course.code,
            req.course.type,
            req.semester.name,
            req.requestedGroups,
            req.requestedGroups * (req.course.hoursTotal || 30),
            req.notes || '',
            req.adminNotes || '',
            req.status === 'PENDING' ? 'OCZEKUJĄCE' : 
            req.status === 'IN_PROGRESS' ? 'W REALIZACJI' : 
            req.status === 'RESOLVED' ? 'ZREALIZOWANE' : 'ODRZUCONE'
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `zapotrzebowania_wydzial_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handlePrint = () => {
        window.print();
    };

    if (isLoading) return <div className="p-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>;

    const requests = requestsData?.data || [];

    // Pogrupuj po jednostkach
    const grouped = requests.reduce((acc: any, req: any) => {
        const instName = req.institute?.name || 'Nieznana jednostka';
        if (!acc[instName]) acc[instName] = [];
        acc[instName].push(req);
        return acc;
    }, {});

    return (
        <div id="print-staffing-requests" className="space-y-6">
            <style>
                {`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #print-staffing-requests, #print-staffing-requests * {
                        visibility: visible;
                    }
                    #print-staffing-requests {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        margin: 0;
                        padding: 20px;
                    }
                }
                `}
            </style>
            <div className="flex justify-end gap-3 print:hidden">
                <Button variant="outline" size="sm" onClick={handleExportCSV} className="bg-white">
                    <Download className="w-4 h-4 mr-2" />
                    Eksportuj CSV
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint} className="bg-white">
                    <Printer className="w-4 h-4 mr-2" />
                    Drukuj
                </Button>
            </div>

            {/* Nagłówek widoczny tylko przy drukowaniu */}
            <div className="hidden print:block mb-6">
                <h2 className="text-2xl font-bold">Zapotrzebowania (Braki kadrowe) - Wydział</h2>
                <p className="text-sm text-gray-500">Wygenerowano: {new Date().toLocaleDateString('pl-PL')}</p>
            </div>

            {Object.keys(grouped).length === 0 ? (
                <div className="p-8 text-center text-muted-foreground bg-card border rounded-xl shadow-sm print:border-none">
                    <AlertCircle className="h-8 w-8 mx-auto mb-3 opacity-20 print:hidden" />
                    Brak zgłoszonych zapotrzebowań z instytutów.
                </div>
            ) : (
                Object.entries(grouped).map(([instName, instRequests]: [string, any]) => {
                    const totalGroups = instRequests.reduce((acc: number, req: any) => acc + (req.requestedGroups || 0), 0);
                    const totalHours = instRequests.reduce((acc: number, req: any) => acc + ((req.requestedGroups || 0) * (req.course.hoursTotal || 30)), 0);
                    const totalRequests = instRequests.length;

                    return (
                    <div key={instName} className="bg-card border rounded-xl shadow-sm overflow-hidden animate-in fade-in print:shadow-none print:border-gray-300 print:mb-6 print:break-inside-avoid">
                        <div className="bg-muted/50 px-4 py-3 border-b flex justify-between items-center print:bg-gray-100 print:border-gray-300">
                            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground print:text-black">{instName}</h3>
                            <Badge variant="secondary" className="text-xs print:border print:border-gray-400 print:bg-white">{instRequests.length} zgłoszeń</Badge>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left print:text-xs">
                                <thead className="text-xs uppercase text-muted-foreground border-b bg-muted/20 print:bg-gray-50 print:text-black">
                                    <tr>
                                        <th className="px-4 py-2 font-semibold border-r print:border-gray-300">
                                            Przedmiot
                                            <div className="text-[10px] mt-0.5 opacity-70 normal-case font-medium">Suma przedmiotów: {totalRequests}</div>
                                        </th>
                                        <th className="px-4 py-2 font-semibold border-r print:border-gray-300">Semestr</th>
                                        <th className="px-4 py-2 font-semibold border-r print:border-gray-300">
                                            Grupy / Godziny
                                            <div className="text-[10px] mt-0.5 opacity-70 normal-case font-medium">Suma: {totalGroups} gr. / {totalHours}h</div>
                                        </th>
                                        <th className="px-4 py-2 font-semibold w-48 border-r print:border-gray-300">Uwagi Instytutu</th>
                                        <th className="px-4 py-2 font-semibold w-48 border-r print:border-gray-300">Notatki Dziekanatu</th>
                                        <th className="px-4 py-2 font-semibold text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border print:divide-gray-300">
                                    {instRequests.map((req: any) => (
                                        <tr key={req.id} className="hover:bg-muted/30 transition-colors print:break-inside-avoid">
                                            <td className="px-4 py-3 border-r print:border-gray-300">
                                                <div className="font-bold">{req.course.name}</div>
                                                <div className="text-[10px] text-muted-foreground print:text-gray-600">{req.course.code} | {req.course.type}</div>
                                            </td>
                                            <td className="px-4 py-3 text-xs border-r print:border-gray-300">{req.semester.name}</td>
                                            <td className="px-4 py-3 border-r print:border-gray-300">
                                                <span className="font-bold">{req.requestedGroups}</span> gr. 
                                                <span className="text-muted-foreground ml-1 text-[10px] uppercase print:text-gray-600">({req.requestedGroups * (req.course.hoursTotal || 30)}h)</span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground break-words border-r print:border-gray-300 print:text-black">
                                                {req.notes || <span className="opacity-50 italic">brak uwag</span>}
                                            </td>
                                            <td className="px-4 py-3 border-r print:border-gray-300">
                                                {/* Textarea dla interakcji, zwykły tekst dla druku */}
                                                <div className="print:hidden">
                                                    <textarea 
                                                        defaultValue={req.adminNotes || ''}
                                                        placeholder="Wpisz odpowiedź/notatkę..."
                                                        className="w-full text-xs p-1.5 border rounded-md min-h-[40px] resize-y"
                                                        onBlur={(e) => {
                                                            if (e.target.value !== (req.adminNotes || '')) {
                                                                statusMutation.mutate({ id: req.id, adminNotes: e.target.value });
                                                            }
                                                        }}
                                                    />
                                                </div>
                                                <div className="hidden print:block text-xs break-words">
                                                    {req.adminNotes || '-'}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="print:hidden">
                                                    <select 
                                                        value={req.status}
                                                        onChange={(e) => statusMutation.mutate({ id: req.id, status: e.target.value })}
                                                        className={`text-[10px] font-bold px-2 py-1.5 border rounded-md outline-none cursor-pointer uppercase transition-colors ${
                                                            req.status === 'PENDING' ? 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200' :
                                                            req.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200' :
                                                            req.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200' :
                                                            'bg-red-100 text-red-700 border-red-200 hover:bg-red-200'
                                                        }`}
                                                    >
                                                        <option value="PENDING">OCZEKUJĄCE</option>
                                                        <option value="IN_PROGRESS">W REALIZACJI</option>
                                                        <option value="RESOLVED">ZREALIZOWANE</option>
                                                        <option value="REJECTED">ODRZUCONE</option>
                                                    </select>
                                                </div>
                                                <div className="hidden print:block text-[10px] font-bold uppercase">
                                                    {req.status === 'PENDING' ? 'OCZEKUJĄCE' : 
                                                     req.status === 'IN_PROGRESS' ? 'W REALIZACJI' : 
                                                     req.status === 'RESOLVED' ? 'ZREALIZOWANE' : 'ODRZUCONE'}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
                })
            )}
        </div>
    );
}
