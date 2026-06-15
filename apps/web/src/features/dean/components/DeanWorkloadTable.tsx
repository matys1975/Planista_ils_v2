import { useState, useMemo } from 'react';
import { Search, Filter, Building2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useDeanWorkload } from '../hooks/useDeanWorkload';
import { useDeanInstitutes } from '../hooks/useDeanInstitutes';
import { SortableHeader } from './SortableHeader';
import { ExportButton } from './ExportButton';
import type { SortState, DeanWorkload } from '../types/dean.types';

const STATUS_FILTERS = [
    { key: 'all', label: 'Wszyscy' },
    { key: 'overloaded', label: 'Nadgodziny' },
    { key: 'underloaded', label: 'Niedobór' },
    { key: 'ok', label: 'W normie' },
];

export function DeanWorkloadTable() {
    const [sort, setSort] = useState<SortState>({ by: 'balance', dir: 'desc' });
    const [statusFilter, setStatusFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [selectedUnits, setSelectedUnits] = useState<string[]>([]);

    const { data: institutesData, isLoading: institutesLoading } = useDeanInstitutes();
    const { data, isLoading } = useDeanWorkload({
        sortBy: sort.by,
        sortDir: sort.dir,
        status: statusFilter === 'all' ? undefined : statusFilter,
        units: selectedUnits.length > 0 ? selectedUnits : undefined,
        search: search || undefined,
    });

    const workloads = data?.data || [];
    const institutes = institutesData?.data || [];

    // Agregacja liczby prowadzących per jednostka z aktualnych danych workload
    const unitCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const w of workloads) {
            counts[w.institute] = (counts[w.institute] || 0) + 1;
        }
        return counts;
    }, [workloads]);

    const hasActiveFilters = statusFilter !== 'all' || search !== '' || selectedUnits.length > 0;

    function handleSort(key: string) {
        setSort((prev) => ({
            by: key,
            dir: prev.by === key && prev.dir === 'asc' ? 'desc' : 'asc',
        }));
    }

    function toggleUnit(unitName: string) {
        setSelectedUnits((prev) =>
            prev.includes(unitName) ? prev.filter((u) => u !== unitName) : [...prev, unitName]
        );
    }

    function clearFilters() {
        setStatusFilter('all');
        setSearch('');
        setSelectedUnits([]);
    }

    function selectAllUnits() {
        setSelectedUnits([]);
    }

    return (
        <div className="space-y-4">
            {/* ── Kafelki jednostek ── */}
            <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="w-4 h-4" />
                    <span className="font-medium">Filtruj po jednostce</span>
                </div>
                <div className="flex flex-wrap gap-2">
                    {/* Kafelek "Wszystkie" */}
                    <button
                        onClick={selectAllUnits}
                        className={`relative flex flex-col items-start px-3 py-2 rounded-lg border text-left transition-all min-w-[90px]
                            ${selectedUnits.length === 0
                                ? 'bg-[#003366] text-white border-[#003366] shadow-sm'
                                : 'bg-white text-navy-dark border-warm-border hover:border-[#003366]/40 hover:bg-cream'
                            }`}
                    >
                        <span className="text-xs font-semibold">Wszystkie</span>
                        <span className={`text-[10px] ${selectedUnits.length === 0 ? 'text-white/80' : 'text-muted-foreground'}`}>
                            {workloads.length} prowadzących
                        </span>
                    </button>

                    {/* Kafelki poszczególnych jednostek */}
                    {institutesLoading ? (
                        <div className="text-xs text-muted-foreground py-2">Ładowanie jednostek…</div>
                    ) : (
                        institutes.map((inst) => {
                            const isSelected = selectedUnits.includes(inst.name);
                            const count = unitCounts[inst.name] ?? 0;
                            return (
                                <button
                                    key={inst.id}
                                    onClick={() => toggleUnit(inst.name)}
                                    title={inst.name}
                                    className={`relative flex flex-col items-start px-3 py-2 rounded-lg border text-left transition-all min-w-[90px]
                                        ${isSelected
                                            ? 'bg-[#00ADEF] text-white border-[#00ADEF] shadow-sm'
                                            : 'bg-white text-navy-dark border-warm-border hover:border-[#00ADEF]/40 hover:bg-cream'
                                        }`}
                                >
                                    <span className="text-xs font-semibold truncate max-w-[140px]">
                                        {inst.shortCode || inst.name}
                                    </span>
                                    <span className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-muted-foreground'}`}>
                                        {count} prowadzących
                                    </span>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {/* ── Status filtry + wyczyść ── */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="flex flex-wrap gap-2 items-center">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    {STATUS_FILTERS.map((f) => (
                        <Button
                            key={f.key}
                            variant={statusFilter === f.key ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setStatusFilter(f.key)}
                            className={`text-xs h-8 ${statusFilter === f.key
                                ? 'bg-[#00ADEF] hover:bg-[#00ADEF]/90 text-white'
                                : 'border-[#00ADEF]/20 text-[#00ADEF]'
                                }`}
                        >
                            {f.label}
                        </Button>
                    ))}

                    {hasActiveFilters && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearFilters}
                            className="text-xs h-8 text-muted-foreground hover:text-status-danger-fg gap-1"
                        >
                            <X className="w-3.5 h-3.5" />
                            Wyczyść filtry
                        </Button>
                    )}
                </div>
                <div className="flex gap-2 items-center w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-initial">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Szukaj prowadzącego..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 h-8 text-sm w-full sm:w-64"
                        />
                    </div>
                    <ExportButton type="workload" label="Eksport" />
                </div>
            </div>

            <div className="rounded-lg border bg-white overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-cream">
                            <SortableHeader label="Prowadzący" sortKey="name" currentSort={sort} onSort={handleSort} />
                            <SortableHeader label="Jednostka" sortKey="institute" currentSort={sort} onSort={handleSort} />
                            <SortableHeader label="Pensum" sortKey="pensumLimit" currentSort={sort} onSort={handleSort} />
                            <SortableHeader label="Godziny" sortKey="totalHours" currentSort={sort} onSort={handleSort} />
                            <SortableHeader label="Bilans" sortKey="balance" currentSort={sort} onSort={handleSort} />
                            <TableHead>Wykorzystanie</TableHead>
                            <SortableHeader label="Przydziały" sortKey="allocationCount" currentSort={sort} onSort={handleSort} />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                                    Ładowanie...
                                </TableCell>
                            </TableRow>
                        ) : workloads.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                                    Brak danych do wyświetlenia.
                                </TableCell>
                            </TableRow>
                        ) : (
                            workloads.map((w: DeanWorkload) => (
                                <TableRow
                                    key={w.id}
                                    className={
                                        w.isOverloaded
                                            ? 'bg-status-danger-bg/15 hover:bg-status-danger-bg/35'
                                            : w.isUnderloaded
                                                ? 'bg-status-warning-bg/15 hover:bg-status-warning-bg/35'
                                                : 'bg-status-active-bg/15 hover:bg-status-active-bg/35'
                                    }
                                >
                                    <TableCell className="font-medium">{w.name}</TableCell>
                                    <TableCell>
                                        <span className="text-xs text-muted-foreground">{w.shortCode}</span>
                                        <br />
                                        {w.institute}
                                    </TableCell>
                                    <TableCell>{w.pensumLimit}h</TableCell>
                                    <TableCell>{w.totalHours}h</TableCell>
                                    <TableCell>
                                        <Badge
                                            variant="outline"
                                            className={
                                                w.balance > 0
                                                    ? 'border-status-danger-fg/20 text-status-danger-fg bg-status-danger-bg'
                                                    : w.balance < 0
                                                        ? 'border-status-warning-fg/20 text-status-warning-fg bg-status-warning-bg'
                                                        : 'border-status-active-fg/20 text-status-active-fg bg-status-active-bg'
                                            }
                                        >
                                            {w.balance > 0 ? `+${w.balance}h` : `${w.balance}h`}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="space-y-1 w-32">
                                            <div className="w-full bg-muted rounded-full h-2 relative overflow-hidden border">
                                                <div
                                                    className={`absolute top-0 left-0 h-full transition-all duration-500 rounded-full ${w.utilizationPercent > 100
                                                        ? 'bg-status-danger-fg'
                                                        : 'bg-status-active-fg'
                                                        }`}
                                                    style={{ width: `${Math.min(w.utilizationPercent, 100)}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between text-[10px] text-muted-foreground">
                                                <span>0</span>
                                                <span className={w.utilizationPercent > 100 ? 'font-bold text-status-danger-fg' : ''}>
                                                    {w.utilizationPercent}%
                                                </span>
                                                <span>{w.pensumLimit}h</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>{w.allocationCount}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
