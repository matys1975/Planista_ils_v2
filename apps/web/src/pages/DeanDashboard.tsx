import { useState } from 'react';
import { Crown, LayoutDashboard, Building2, BarChart3, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { useDeanDashboard } from '../features/dean/hooks/useDeanDashboard';
import { DeanStatsCards } from '../features/dean/components/DeanStatsCards';
import { DeanWorkloadTable } from '../features/dean/components/DeanWorkloadTable';
import { DeanInstitutesTable } from '../features/dean/components/DeanInstitutesTable';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { WorkloadItem } from '../features/dean/types/dean.types';

type TabKey = 'overview' | 'workload' | 'institutes';

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: 'overview', label: 'Przegląd', icon: LayoutDashboard },
    { key: 'workload', label: 'Obciążenia', icon: BarChart3 },
    { key: 'institutes', label: 'Jednostki', icon: Building2 },
];

export function DeanDashboard() {
    const [activeTab, setActiveTab] = useState<TabKey>('overview');
    const { data, isLoading } = useDeanDashboard();

    const dashboard = data?.data;

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
                            Panel Dziekański
                        </h1>
                        <p className="text-xs text-muted-foreground">
                            Scentralizowany panel analityczny dla Dziekana
                        </p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-muted/40 rounded-lg border p-1 w-fit">
                    {TABS.map((tab) => {
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
            {isLoading ? (
                <div className="text-center py-20 text-muted-foreground">Ładowanie panelu...</div>
            ) : !dashboard ? (
                <div className="text-center py-20 text-muted-foreground">Brak danych.</div>
            ) : (
                <>
                    {activeTab === 'overview' && (
                        <div className="space-y-4">
                            {/* KPI Cards */}
                            <DeanStatsCards counts={dashboard.counts} />

                            {/* Alerts */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-card rounded-xl border p-4 flex items-center gap-4 shadow-sm">
                                    <div className="p-3 rounded-xl bg-status-danger-bg text-status-danger-fg">
                                        <AlertTriangle className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{dashboard.alerts.overloaded}</p>
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                                            Prowadzących z nadgodzinami
                                        </p>
                                    </div>
                                </div>
                                <div className="bg-card rounded-xl border p-4 flex items-center gap-4 shadow-sm">
                                    <div className="p-3 rounded-xl bg-status-warning-bg text-status-warning-fg">
                                        <Info className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{dashboard.alerts.underloaded}</p>
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                                            Prowadzących z niedoborem
                                        </p>
                                    </div>
                                </div>
                                <div className="bg-card rounded-xl border p-4 flex items-center gap-4 shadow-sm">
                                    <div className="p-3 rounded-xl bg-status-active-bg text-status-active-fg">
                                        <CheckCircle className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{dashboard.alerts.unassignedCourses}</p>
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                                            Nieprzypisanych kursów
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Active Semesters */}
                            {dashboard.activeSemesters.length > 0 && (
                                <div className="bg-card rounded-xl border p-5 shadow-sm">
                                    <h3 className="text-sm font-bold text-primary mb-3">Aktywne semestry</h3>
                                    <div className="flex gap-2">
                                        {dashboard.activeSemesters.map((s) => (
                                            <Badge key={s.id} variant="outline" className="text-xs">
                                                {s.name} ({s.year})
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Top 10 Overloaded */}
                            <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
                                <div className="px-5 py-4 border-b bg-muted/20">
                                    <h3 className="text-sm font-bold text-primary">
                                        Top 10 — Najbardziej przeciążeni prowadzący
                                    </h3>
                                </div>
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-cream">
                                            <TableHead className="w-10">#</TableHead>
                                            <TableHead>Prowadzący</TableHead>
                                            <TableHead>Jednostka</TableHead>
                                            <TableHead>Pensum</TableHead>
                                            <TableHead>Godziny</TableHead>
                                            <TableHead>Bilans</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {dashboard.workloadSummary.map((w: WorkloadItem, idx: number) => (
                                            <TableRow key={w.id}>
                                                <TableCell className="font-bold text-muted-foreground">{idx + 1}</TableCell>
                                                <TableCell className="font-medium">{w.name}</TableCell>
                                                <TableCell>{w.institute}</TableCell>
                                                <TableCell>{w.pensumLimit}h</TableCell>
                                                <TableCell>{w.totalHours}h</TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant="outline"
                                                        className={
                                                            w.balance > 0
                                                                ? 'border-status-danger-fg/20 text-status-danger-fg bg-status-danger-bg'
                                                                : 'border-status-active-fg/20 text-status-active-fg bg-status-active-bg'
                                                        }
                                                    >
                                                        {w.balance > 0 ? `+${w.balance}h` : `${w.balance}h`}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'workload' && <DeanWorkloadTable />}
                    {activeTab === 'institutes' && <DeanInstitutesTable />}
                </>
            )}
        </div>
    );
}
