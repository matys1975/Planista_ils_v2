import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchApi } from '../lib/api';
import { useAuthStore } from '../store/auth';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Shield, Search, ChevronLeft, ChevronRight, Download,
  Clock, FileText, ArrowUpDown, Sparkles, Filter
} from 'lucide-react';
import {
  ACTION_LABELS,
  ENTITY_LABELS,
  getAuditSummary,
} from '../utils/auditFormatters';
import { AuditDetailCard } from '../components/audit/AuditDetailCard';

// ─── Typy ────────────────────────────────────────────────────────────────────

interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  oldData: any;
  newData: any;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  metadata: any;
}

interface PaginatedResponse {
  data: AuditLogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Europe/Warsaw',
  });
}

function ActionBadge({ action }: { action: string }) {
  const info = ACTION_LABELS[action] || { label: action, color: 'bg-gray-100 text-gray-600 border-gray-200' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border ${info.color}`}>
      {info.label}
    </span>
  );
}

// ─── Komponent główny ────────────────────────────────────────────────────────

export function AuditLog() {
  const currentRole = useAuthStore(s => s.role);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const limit = 30;

  // Pobierz dostępne filtry
  const { data: filterValues } = useQuery({
    queryKey: ['audit-filters'],
    queryFn: () => fetchApi<{ data: { actions: string[]; entityTypes: string[] } }>('/api/v1/audit/filters'),
    staleTime: 60_000,
  });

  // Pobierz logi
  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-logs', page, search, actionFilter, entityTypeFilter, dateFrom, dateTo],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (search) params.set('search', search);
      if (actionFilter) params.set('action', actionFilter);
      if (entityTypeFilter) params.set('entityType', entityTypeFilter);
      if (dateFrom) params.set('dateFrom', new Date(dateFrom).toISOString());
      if (dateTo) params.set('dateTo', new Date(dateTo + 'T23:59:59').toISOString());
      return fetchApi<PaginatedResponse>(`/api/v1/audit?${params.toString()}`);
    },
  });

  const logs = data?.data ?? [];
  const pagination = data?.pagination;

  const handleExport = () => {
    const params = new URLSearchParams();
    if (actionFilter) params.set('action', actionFilter);
    if (entityTypeFilter) params.set('entityType', entityTypeFilter);
    if (dateFrom) params.set('dateFrom', new Date(dateFrom).toISOString());
    if (dateTo) params.set('dateTo', new Date(dateTo + 'T23:59:59').toISOString());
    window.open(`/api/v1/audit/export?${params.toString()}`, '_blank');
  };

  if (!['SUPER_ADMIN', 'DEAN', 'ADMIN'].includes(currentRole || '')) {
    return (
      <div className="p-8 text-center text-gray-500">
        <Shield className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p>Brak uprawnień do przeglądania dziennika audytu.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-4 animate-in fade-in duration-300">
      {/* Nagłówek */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-background/50 backdrop-blur-md px-4 py-3 rounded-xl border border-border/50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary rounded-lg shadow-primary/10 shadow-lg text-white">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight">Historia aktywności</h1>
            <p className="text-xs text-muted-foreground">
              Dziennik wszystkich operacji i zmian w systemie
              {pagination && <span className="ml-1 font-semibold">({pagination.total} zdarzeń)</span>}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs font-bold gap-1.5" onClick={handleExport}>
          <Download className="w-3.5 h-3.5" />
          Eksportuj dziennik (CSV)
        </Button>
      </div>

      {/* Filtry */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 bg-card p-3 rounded-xl border shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj (email, nazwisko, kod)..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <select
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background"
          value={actionFilter}
          onChange={e => { setActionFilter(e.target.value); setPage(1); }}
        >
          <option value="">Wszystkie operacje</option>
          {(filterValues?.data?.actions ?? Object.keys(ACTION_LABELS)).map(a => (
            <option key={a} value={a}>{ACTION_LABELS[a]?.label || a}</option>
          ))}
        </select>

        <select
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background"
          value={entityTypeFilter}
          onChange={e => { setEntityTypeFilter(e.target.value); setPage(1); }}
        >
          <option value="">Wszystkie obiekty</option>
          {(filterValues?.data?.entityTypes ?? Object.keys(ENTITY_LABELS)).map(e => (
            <option key={e} value={e}>{ENTITY_LABELS[e as string] || e}</option>
          ))}
        </select>

        <Input
          type="date"
          value={dateFrom}
          onChange={e => { setDateFrom(e.target.value); setPage(1); }}
          placeholder="Data od"
          className="h-9 text-xs"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={e => { setDateTo(e.target.value); setPage(1); }}
          placeholder="Data do"
          className="h-9 text-xs"
        />
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Ładowanie dziennika audytu...</div>
      ) : error ? (
        <div className="text-center py-16 text-destructive text-sm font-semibold">Błąd ładowania dziennika audytu</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-card rounded-xl border">
          <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-semibold text-sm">Brak wpisów spełniających kryteria</p>
          <p className="text-xs text-muted-foreground mt-1">Zmień filtry lub zakres dat, aby wyświetlić więcej wyników.</p>
        </div>
      ) : (
        <>
          <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-[140px] text-xs font-bold">Czas</TableHead>
                  <TableHead className="w-[120px] text-xs font-bold">Operacja</TableHead>
                  <TableHead className="w-[120px] text-xs font-bold">Typ obiektu</TableHead>
                  <TableHead className="text-xs font-bold">Podsumowanie operacji</TableHead>
                  <TableHead className="w-[170px] text-xs font-bold">Użytkownik</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(log => {
                  const summary = getAuditSummary(log);
                  return (
                    <TableRow
                      key={log.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedLog(log)}
                    >
                      <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {formatTimestamp(log.timestamp)}
                      </TableCell>
                      <TableCell>
                        <ActionBadge action={log.action} />
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                        {log.entityType ? (ENTITY_LABELS[log.entityType] || log.entityType) : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-foreground">
                            {summary.title}
                          </p>
                          {summary.details && (
                            <p className="text-[11px] text-muted-foreground truncate max-w-[500px]">
                              {summary.details}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[170px]" title={log.userEmail || log.userId || ''}>
                        {log.userEmail || log.userId?.slice(0, 8) || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground">
                          <ArrowUpDown className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Paginacja */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-2 pt-2">
              <p className="text-xs text-muted-foreground">
                Strona <span className="font-bold text-foreground">{pagination.page}</span> z <span className="font-bold text-foreground">{pagination.totalPages}</span> ({pagination.total} wpisów)
              </p>
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-semibold"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Poprzednia
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-semibold"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Następna <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Dialog szczegółów z dedykowaną kartą */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              Szczegóły operacji w audycie
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <AuditDetailCard log={selectedLog} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
