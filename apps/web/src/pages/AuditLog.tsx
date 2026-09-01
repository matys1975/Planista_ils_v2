import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchApi } from '../lib/api';
import { useAuthStore } from '../store/auth';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Shield, Search, ChevronLeft, ChevronRight, Download,
  Clock, User, FileText, ArrowUpDown,
} from 'lucide-react';

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

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  LOGIN_SUCCESS: { label: 'Logowanie', color: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' },
  LOGIN_FAILURE: { label: 'Nieudane logowanie', color: 'bg-red-500/10 text-red-700 border-red-500/20' },
  LOGOUT: { label: 'Wylogowanie', color: 'bg-slate-500/10 text-slate-600 border-slate-500/20' },
  CREATE: { label: 'Utworzenie', color: 'bg-blue-500/10 text-blue-700 border-blue-500/20' },
  UPDATE: { label: 'Edycja', color: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
  DELETE: { label: 'Usunięcie', color: 'bg-red-500/10 text-red-700 border-red-500/20' },
  PASSWORD_CHANGE: { label: 'Zmiana hasła', color: 'bg-violet-500/10 text-violet-700 border-violet-500/20' },
  PASSWORD_RESET: { label: 'Reset hasła', color: 'bg-violet-500/10 text-violet-700 border-violet-500/20' },
  ROLE_CHANGE: { label: 'Zmiana roli', color: 'bg-orange-500/10 text-orange-700 border-orange-500/20' },
  EXPORT: { label: 'Eksport', color: 'bg-cyan-500/10 text-cyan-700 border-cyan-500/20' },
  BULK_IMPORT: { label: 'Import masowy', color: 'bg-indigo-500/10 text-indigo-700 border-indigo-500/20' },
};

const ENTITY_LABELS: Record<string, string> = {
  User: 'Użytkownik',
  Course: 'Przedmiot',
  Room: 'Sala',
  Teacher: 'Prowadzący',
  Group: 'Grupa',
  ScheduleEntry: 'Wpis w planie',
  CourseAllocation: 'Przydział',
  Institute: 'Jednostka',
  StaffingRequest: 'Zapotrzebowanie',
  Semester: 'Semestr',
  Major: 'Kierunek',
};

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
    <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${info.color}`}>
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
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Nagłówek */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-500/10 rounded-lg">
            <Clock className="w-6 h-6 text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-navy-dark">Historia aktywności</h1>
            <p className="text-sm text-gray-500">
              Dziennik wszystkich operacji w systemie
              {pagination && <span className="ml-1">({pagination.total} wpisów)</span>}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="w-4 h-4 mr-1" />
          Eksport CSV
        </Button>
      </div>

      {/* Filtry */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Szukaj (email, typ)..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>

        <select
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          value={actionFilter}
          onChange={e => { setActionFilter(e.target.value); setPage(1); }}
        >
          <option value="">Wszystkie operacje</option>
          {(filterValues?.data?.actions ?? Object.keys(ACTION_LABELS)).map(a => (
            <option key={a} value={a}>{ACTION_LABELS[a]?.label || a}</option>
          ))}
        </select>

        <select
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
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
          placeholder="Od"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={e => { setDateTo(e.target.value); setPage(1); }}
          placeholder="Do"
        />
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Ładowanie...</div>
      ) : error ? (
        <div className="text-center py-12 text-red-500">Błąd ładowania dziennika audytu</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          Brak wpisów spełniających kryteria
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50">
                  <TableHead className="w-[160px]">Czas</TableHead>
                  <TableHead className="w-[180px]">Użytkownik</TableHead>
                  <TableHead className="w-[140px]">Operacja</TableHead>
                  <TableHead className="w-[120px]">Obiekt</TableHead>
                  <TableHead>ID obiektu</TableHead>
                  <TableHead className="w-[120px]">IP</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(log => (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer hover:bg-gray-50/80 transition-colors"
                    onClick={() => setSelectedLog(log)}
                  >
                    <TableCell className="text-xs font-mono text-gray-600">
                      {formatTimestamp(log.timestamp)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.userEmail || log.userId?.slice(0, 8) || '—'}
                    </TableCell>
                    <TableCell>
                      <ActionBadge action={log.action} />
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {log.entityType ? (ENTITY_LABELS[log.entityType] || log.entityType) : '—'}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-gray-400">
                      {log.entityId?.slice(0, 8) || '—'}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-gray-400">
                      {log.ipAddress || '—'}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Paginacja */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Strona {pagination.page} z {pagination.totalPages} ({pagination.total} wpisów)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Dialog szczegółów */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Szczegóły operacji
              {selectedLog && <ActionBadge action={selectedLog.action} />}
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Czas</p>
                  <p className="font-mono">{formatTimestamp(selectedLog.timestamp)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Użytkownik</p>
                  <p>{selectedLog.userEmail || selectedLog.userId || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Adres IP</p>
                  <p className="font-mono">{selectedLog.ipAddress || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Request ID</p>
                  <p className="font-mono text-xs">{selectedLog.requestId || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Obiekt</p>
                  <p>
                    {selectedLog.entityType ? (ENTITY_LABELS[selectedLog.entityType] || selectedLog.entityType) : '—'}
                    {selectedLog.entityId && <span className="ml-1 font-mono text-xs text-gray-400">#{selectedLog.entityId.slice(0, 8)}</span>}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">User-Agent</p>
                  <p className="text-xs truncate max-w-[300px]">{selectedLog.userAgent || '—'}</p>
                </div>
              </div>

              {/* Dane PRZED */}
              {selectedLog.oldData && (
                <div>
                  <p className="text-xs font-semibold text-red-500 mb-1">PRZED zmianą:</p>
                  <pre className="bg-red-50 border border-red-100 rounded-md p-3 text-xs font-mono overflow-x-auto max-h-[200px] overflow-y-auto">
                    {JSON.stringify(selectedLog.oldData, null, 2)}
                  </pre>
                </div>
              )}

              {/* Dane PO */}
              {selectedLog.newData && (
                <div>
                  <p className="text-xs font-semibold text-emerald-500 mb-1">PO zmianie:</p>
                  <pre className="bg-emerald-50 border border-emerald-100 rounded-md p-3 text-xs font-mono overflow-x-auto max-h-[200px] overflow-y-auto">
                    {JSON.stringify(selectedLog.newData, null, 2)}
                  </pre>
                </div>
              )}

              {/* Metadata */}
              {selectedLog.metadata && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">Dodatkowe informacje:</p>
                  <pre className="bg-gray-50 border border-gray-100 rounded-md p-3 text-xs font-mono overflow-x-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
