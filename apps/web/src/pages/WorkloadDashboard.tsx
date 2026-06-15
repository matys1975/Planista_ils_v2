import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Filter, Printer } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

async function fetchWorkload(semesterId: string) {
  if (!semesterId) return { data: [] };
  const res = await fetch(`/api/v1/workload?semesterId=${semesterId}`);
  if (!res.ok) throw new Error('Error fetching workload');
  return res.json();
}

async function fetchSemesters() {
  const res = await fetch('/api/v1/semesters');
  if (!res.ok) throw new Error('Network error');
  return res.json();
}

export function WorkloadDashboard() {
  const [selectedSemester, setSelectedSemester] = useState('');
  const [printData, setPrintData] = useState<any>(null);

  const { data: dicts } = useQuery({ 
    queryKey: ['semesters'], 
    queryFn: fetchSemesters 
  });

  const { data: workloadResponse, isLoading } = useQuery({
    queryKey: ['workload', selectedSemester],
    queryFn: () => fetchWorkload(selectedSemester),
    enabled: !!selectedSemester
  });

  const workloadData = workloadResponse?.data || [];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-card p-6 rounded-xl border shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-lg">
            <BarChart3 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Kalkulator Pensum</h1>
            <p className="text-muted-foreground text-sm">Rozliczenie obciążeń dydaktycznych nauczycieli na bazie siatki.</p>
          </div>
        </div>

        <div className="flex items-center gap-4 border p-2 px-4 rounded-lg bg-background">
          <Filter className="w-5 h-5 text-muted-foreground" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Aktywny Semestr: </span>
            <select 
              value={selectedSemester} 
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="text-sm p-1 rounded border-b focus:outline-none"
            >
              <option value="">Wybierz raport...</option>
              {dicts?.data?.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name} ({s.year})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedSemester ? (
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[30%]">Prowadzący</TableHead>
                <TableHead>Wykonanie vs Roczny Limit</TableHead>
                <TableHead className="w-32 text-right">Zrealizowano</TableHead>
                <TableHead className="w-32 text-right">Status</TableHead>
                <TableHead className="w-24 text-center">Formularz</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                <TableCell colSpan={5} className="text-center h-24">Przeliczanie setek danych bilingowych...</TableCell>
                </TableRow>
              ) : workloadData.length === 0 ? (
                <TableRow>
                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">Brak zarejestrowanych prowadzących.</TableCell>
                </TableRow>
              ) : (
                workloadData.map((w: any) => {
                  const percentage = w.pensumLimit > 0 ? Math.round((w.plannedHours / w.pensumLimit) * 100) : 0;
                  const isOverload = percentage > 100;
                  const isDone = percentage === 100;

                  // Rbg progress bar filling computation
                  const fillPercentage = Math.min(percentage, 100);
                  
                  // Status badge rules
                  const pBadge = isOverload
                    ? "bg-purple-100 text-purple-800 border-purple-200"
                    : isDone
                    ? "bg-green-100 text-green-800 border-green-200"
                    : "bg-yellow-100 text-yellow-800 border-yellow-200";

                  return (
                  <TableRow key={w.teacher.id} className="group">
                    <TableCell>
                      <div className="font-semibold text-sm">{w.teacher.name}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">{w.teacher.unit}</div>
                    </TableCell>
                    <TableCell>
                       <div className="w-full bg-muted rounded-full min-h-2 h-2.5 relative overflow-hidden border">
                          <div 
                            className={`absolute top-0 left-0 h-full transition-all duration-500 rounded-full ${
                              isOverload ? 'bg-purple-500' : isDone ? 'bg-green-500' : 'bg-yellow-400'
                            }`}
                            style={{ width: `${fillPercentage}%` }}
                          />
                       </div>
                       <div className="flex justify-between items-center text-[10px] mt-1 text-muted-foreground">
                         <span>0</span>
                         {isOverload && <span className="font-bold text-purple-600">Nadgodziny (+{w.plannedHours - w.pensumLimit} h)</span>}
                         <span>{w.pensumLimit}h limitu etatu</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-right">
                       <span className="font-mono text-sm border bg-background px-2 py-1 rounded shadow-sm">
                         {w.plannedHours} h
                       </span>
                    </TableCell>
                    <TableCell className="text-right">
                       <span className={`px-2 py-1 border rounded-md text-[10px] font-bold shadow-sm ${pBadge}`}>
                         {isOverload ? 'NADGODZINY' : isDone ? 'PEŁEN ETAT' : 'NIEDOBÓR'}
                       </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="sm" onClick={() => setPrintData(w)} title="Podgląd Karty">
                        <Printer className="w-4 h-4 text-primary" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex-1 border rounded-xl flex items-center justify-center bg-card p-12 text-center text-muted-foreground border-dashed">
          Wybierz intersujący Cię semestr by wyciągnąć statystyki rozplanowania nauczycieli na żywo.
        </div>
      )}

      {/* MODAL / KARTA PENSUM */}
      <Dialog open={!!printData} onOpenChange={(open) => !open && setPrintData(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-white max-h-[90vh] flex flex-col pointer-events-auto">
          <DialogHeader className="p-4 border-b bg-muted/50 no-print">
            <DialogTitle className="flex justify-between items-center">
              Podgląd Indywidualnej Karty Obciążeń
              <Button onClick={() => window.print()} className="gap-2">
                <Printer className="w-4 h-4" /> Drukuj IKOD
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          <div className="p-8 overflow-y-auto print-area bg-white text-black font-sans">
            <style>{`
              @page { size: landscape; margin: 10mm; }
              @media print {
                body { 
                  background: white !important; 
                  overflow: visible !important; 
                  height: auto !important; 
                }
                #root { display: none !important; }
                
                /* Ukrywamy maskę/tło (Overlay) z Radix UI */
                [data-radix-portal] > * { display: none !important; }
                [data-radix-portal] > [role="dialog"] { 
                  display: block !important; 
                  position: static !important;
                  height: auto !important;
                  max-height: none !important;
                  overflow: visible !important;
                  transform: none !important;
                  box-shadow: none !important;
                  border: none !important;
                  padding: 0 !important;
                  margin: 0 !important;
                  background: transparent !important;
                }

                .print-area { 
                  display: block !important; 
                  color: black !important; 
                  padding: 0 !important; 
                  margin: 0 !important;
                  width: 100% !important;
                }
                .no-print { display: none !important; }
                table { page-break-inside: auto; }
                tr { page-break-inside: avoid; page-break-after: auto; }
                thead { display: table-header-group; }
                tfoot { display: table-footer-group; }
              }
            `}</style>
            
            {/* WŁAŚCIWY DRUK: Nagi UI bez ogólnego tailwind dark mode etc */}
            {printData && (
              <div className="mx-auto max-w-3xl space-y-8">
                <div className="text-center space-y-1 mb-8 border-b-2 border-black pb-4">
                  <h1 className="text-xl font-bold uppercase">Uniwersytet im. Adama Mickiewicza w Poznaniu</h1>
                  <h2 className="text-lg font-semibold">{printData.teacher.unit}</h2>
                  <h3 className="text-md mt-4 font-medium uppercase tracking-wider">Indywidualna Karta Obciążeń Dydaktycznych (IKOD)</h3>
                  <p className="text-sm">za semestr: <strong>{dicts?.data?.find((s: any) => s.id === selectedSemester)?.name}</strong></p>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6 text-sm border p-4 bg-gray-50/50">
                  <div>
                    <span className="text-gray-600 block text-xs">Prowadzący:</span>
                    <strong className="text-lg">{printData.teacher.name}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-600 block text-xs">Limit Pensum:</span>
                    <strong className="text-lg">{printData.pensumLimit} godz.</strong>
                  </div>
                </div>

                <div className="mt-8">
                  <h4 className="font-bold border-b mb-2 text-sm">Szczegółowy wykaz zrealizowanych zajęć</h4>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-100 border-y border-black">
                        <th className="py-2 px-2 border-r border-black/20">Lp.</th>
                        <th className="py-2 px-2 border-r border-black/20">Nazwa przedmiotu</th>
                        <th className="py-2 px-2 border-r border-black/20">Typ</th>
                        <th className="py-2 px-2 border-r border-black/20">Dzień</th>
                        <th className="py-2 px-2 border-r border-black/20">Sala</th>
                        <th className="py-2 px-2 border-r border-black/20">Grupy</th>
                        <th className="py-2 px-2 text-right">Godzin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {printData.breakdown.map((item: any, i: number) => {
                        const daysMap = ['Nie', 'Pon', 'Wto', 'Śro', 'Czw', 'Pią', 'Sob'];
                        return (
                          <tr key={item.id} className="border-b border-black/20">
                            <td className="py-2 px-2 border-r border-black/20 text-center">{i + 1}</td>
                            <td className="py-2 px-2 border-r border-black/20 font-medium">{item.course}</td>
                            <td className="py-2 px-2 border-r border-black/20 text-center">{item.type} {item.weekType !== 'AB' ? `(Tydz. ${item.weekType})` : ''}</td>
                            <td className="py-2 px-2 border-r border-black/20 text-center">{daysMap[item.dayOfWeek]}<br/><span className="text-[10px] text-gray-500">{item.startTime}</span></td>
                            <td className="py-2 px-2 border-r border-black/20 text-center">{item.room || '-'}</td>
                            <td className="py-2 px-2 border-r border-black/20">{item.groups || '-'}</td>
                            <td className="py-2 px-2 text-right font-bold">{item.hours}</td>
                          </tr>
                        );
                      })}
                      {printData.breakdown.length === 0 && (
                        <tr><td colSpan={7} className="text-center py-4 text-gray-500">Brak zajęć wpisanych do planu.</td></tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-100 border-t-2 border-black font-bold">
                        <td colSpan={6} className="py-2 px-2 text-right">Suma wyliczonych godzin dydaktycznych:</td>
                        <td className="py-2 px-2 text-right">{printData.plannedHours}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="mt-8 flex justify-end">
                  <div className="border border-black p-4 w-64 bg-gray-50/50">
                    <h4 className="text-xs text-gray-600 mb-1">Podsumowanie rozliczenia:</h4>
                    <div className="flex justify-between mb-1">
                      <span>Wymiar etatu:</span>
                      <strong>{printData.pensumLimit}</strong>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span>Zrealizowano:</span>
                      <strong>{printData.plannedHours}</strong>
                    </div>
                    <div className="flex justify-between mt-2 pt-2 border-t border-black">
                      <span>Bilans:</span>
                      <strong className={
                        printData.plannedHours > printData.pensumLimit ? 'text-status-danger-fg' : ''
                      }>
                        {printData.plannedHours > printData.pensumLimit 
                          ? `+ ${printData.plannedHours - printData.pensumLimit} (Nadgodziny)`
                          : printData.plannedHours === printData.pensumLimit
                          ? `0 (Pełen etat)`
                          : `- ${printData.pensumLimit - printData.plannedHours} (Niedobór)`
                        }
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="mt-16 flex justify-between px-8">
                  <div className="text-center">
                    <div className="w-48 border-b border-black mb-2 mx-auto"></div>
                    <span className="text-xs text-gray-500">Podpis sporządzającego</span>
                  </div>
                  <div className="text-center">
                    <div className="w-48 border-b border-black mb-2 mx-auto"></div>
                    <span className="text-xs text-gray-500">Podpis prowadzącego</span>
                  </div>
                </div>
                
                <div className="mt-12 text-[9px] text-gray-400 text-center border-t pt-4">
                  Dokument wygenerowany elektronicznie z systemu Planista ILS. Data wygenerowania: {new Date().toLocaleDateString('pl-PL')}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
