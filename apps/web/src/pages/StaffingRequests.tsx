import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { fetchApi } from '../lib/api';
import { AlertCircle, Trash2, Inbox, Clock, CheckCircle2, XCircle, Search } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function StaffingRequests() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: requestsData, isLoading } = useQuery({
    queryKey: ['staffingRequests'],
    queryFn: () => fetchApi('/staffing-requests'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetchApi(`/staffing-requests/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staffingRequests'] });
      toast.success('Zapotrzebowanie anulowane');
    },
    onError: (err: any) => toast.error('Błąd usuwania: ' + err.message)
  });

  const requests = requestsData?.data || [];

  const filteredRequests = useMemo(() => {
    return requests.filter((req: any) => {
      const matchesStatus = filterStatus === 'ALL' || req.status === filterStatus;
      const matchesSearch = req.course.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            req.course.code.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [requests, filterStatus, searchQuery]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': return <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-200"><Clock className="w-3 h-3 mr-1" /> Oczekujące</Badge>;
      case 'IN_PROGRESS': return <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">W realizacji</Badge>;
      case 'RESOLVED': return <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="w-3 h-3 mr-1" /> Zrealizowane</Badge>;
      case 'REJECTED': return <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" /> Odrzucone</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto animate-in fade-in duration-500">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-500/20 p-5 rounded-2xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-orange-500/20 rounded-xl text-orange-700 shadow-sm">
            <AlertCircle className="h-7 w-7" />
          </div>
          <div>
            <h1 className="font-black text-2xl tracking-tight text-foreground">Zapotrzebowania Kadrowe</h1>
            <p className="text-sm text-muted-foreground mt-1">Zarządzaj swoimi zgłoszeniami o wakatach przesłanymi do Dziekanatu.</p>
          </div>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-card p-2 rounded-xl border shadow-sm">
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto p-1">
          {[
            { id: 'ALL', label: 'Wszystkie' },
            { id: 'PENDING', label: 'Oczekujące' },
            { id: 'IN_PROGRESS', label: 'W realizacji' },
            { id: 'RESOLVED', label: 'Zrealizowane' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                filterStatus === tab.id 
                  ? 'bg-primary text-primary-foreground shadow-md' 
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64 px-2 sm:px-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Szukaj przedmiotu..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-muted/50 border-transparent focus-visible:border-primary h-9"
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-[30%]">Przedmiot</TableHead>
              <TableHead className="w-[15%] text-center">Braki (Grupy/Godz)</TableHead>
              <TableHead className="w-[20%]">Nasze Uwagi</TableHead>
              <TableHead className="w-[20%] text-blue-700">Notatki Dziekanatu</TableHead>
              <TableHead className="w-[10%]">Status</TableHead>
              <TableHead className="w-[5%] text-right">Akcje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <TableRow key={idx}>
                  <TableCell><Skeleton className="h-5 w-3/4 mb-2" /><Skeleton className="h-3 w-1/2" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : filteredRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                      <Inbox className="h-8 w-8 opacity-50" />
                    </div>
                    <p className="text-lg font-semibold text-foreground">Brak zgłoszeń</p>
                    <p className="text-sm mt-1">Nie znaleziono zapotrzebowań spełniających kryteria.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredRequests.map((req: any) => (
                <TableRow key={req.id} className="group hover:bg-muted/30 transition-colors">
                  <TableCell className="py-4">
                    <div className="font-bold text-foreground">{req.course.name}</div>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">{req.course.code}</span>
                      <span className="text-[10px] text-muted-foreground border-l pl-2">{req.course.type}</span>
                      <span className="text-[10px] text-muted-foreground border-l pl-2">Sem: {req.semester.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-lg font-black text-destructive">{req.requestedGroups}</span>
                      <span className="text-[10px] text-muted-foreground font-semibold bg-muted px-1.5 rounded mt-0.5">
                        {req.requestedGroups * (req.course.hoursTotal || 30)}h
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {req.notes ? (
                      <p className="text-xs text-muted-foreground line-clamp-2" title={req.notes}>{req.notes}</p>
                    ) : (
                      <span className="text-xs text-muted-foreground/40 italic">Brak uwag</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {req.adminNotes ? (
                      <p className="text-xs text-blue-700 font-medium bg-blue-50/50 p-2 rounded-lg border border-blue-100 line-clamp-2" title={req.adminNotes}>
                        {req.adminNotes}
                      </p>
                    ) : (
                      <span className="text-xs text-muted-foreground/40 italic">Oczekuje na odpowiedź...</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(req.status)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => {
                        if (confirm('Czy na pewno chcesz anulować to zapotrzebowanie? Tej operacji nie można cofnąć.')) {
                          deleteMutation.mutate(req.id);
                        }
                      }}
                      title="Anuluj zapotrzebowanie"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
