import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Search, Download, Loader2, CheckSquare, Square, GraduationCap,
  AlertTriangle, BookOpen, Wand2, Calendar,
} from 'lucide-react';
import { fetchApi } from '../../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface UsosImportDialogProps {
  activeSemesterId: string;
  semestersData: any;
  majorsData: any;
  onSuccess: () => void;
}

interface UsosCourse {
  code: string;
  name: string;
  ects: number;
}

interface PerCourseOverrides {
  type: string;
  hours: number;
}

const COURSE_TYPES = [
  { value: 'W', label: 'Wykład' },
  { value: 'C', label: 'Ćwiczenia' },
  { value: 'L', label: 'Laboratorium' },
  { value: 'S', label: 'Seminarium' },
  { value: 'Pr', label: 'Praktyki' },
  { value: 'K', label: 'Konwersatorium' },
] as const;

const TYPE_SHORT: Record<string, string> = { W: 'Wyk', C: 'Ćw', L: 'Lab', S: 'Sem', Pr: 'Prak', K: 'Konw' };

export function UsosImportDialog({ activeSemesterId, semestersData, majorsData, onSuccess }: UsosImportDialogProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [prefix, setPrefix] = useState('');
  const [searchedPrefix, setSearchedPrefix] = useState('');
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());

  // Semester selection
  const [chosenSemesterId, setChosenSemesterId] = useState('');
  const effectiveSemesterId = chosenSemesterId || activeSemesterId;

  // Major + year
  const [selectedMajorId, setSelectedMajorId] = useState('');
  const [selectedStudyYear, setSelectedStudyYear] = useState(1);

  // Global defaults
  const [defaultType, setDefaultType] = useState('W');
  const [defaultHours, setDefaultHours] = useState(30);

  // Per-course overrides: code → { type, hours }
  const [overrides, setOverrides] = useState<Map<string, PerCourseOverrides>>(new Map());

  // Computed semester helpers
  const semesters: any[] = semestersData?.data || [];
  const uniqueYears = useMemo(() =>
    Array.from(new Set(semesters.map((s: any) => s.year))).sort((a: number, b: number) => b - a),
    [semesters]
  );
  const chosenSemester = semesters.find((s: any) => s.id === effectiveSemesterId);

  function getOverride(code: string): PerCourseOverrides {
    return overrides.get(code) || { type: defaultType, hours: defaultHours };
  }

  function setOverrideField(code: string, field: keyof PerCourseOverrides, value: string | number) {
    setOverrides(prev => {
      const next = new Map(prev);
      const current = next.get(code) || { type: defaultType, hours: defaultHours };
      next.set(code, { ...current, [field]: value });
      return next;
    });
  }

  function applyDefaultsToAll() {
    setOverrides(prev => {
      const next = new Map(prev);
      for (const c of usosCourses) {
        next.set(c.code, { type: defaultType, hours: defaultHours });
      }
      return next;
    });
    toast.success(`Zastosowano domyślne: ${TYPE_SHORT[defaultType] || defaultType}, ${defaultHours}h`);
  }

  // USOS search query
  const {
    data: usosData,
    isLoading: isSearching,
    error: searchError,
    isFetching,
  } = useQuery({
    queryKey: ['usos-search', searchedPrefix],
    queryFn: () => fetchApi(`/usos/search?prefix=${encodeURIComponent(searchedPrefix)}`),
    enabled: searchedPrefix.length >= 5,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const usosCourses: UsosCourse[] = usosData?.data || [];

  // Bulk import mutation
  const importMutation = useMutation({
    mutationFn: async (courses: UsosCourse[]) => {
      const payload = courses.map(c => {
        const ov = getOverride(c.code);
        return {
          code: c.code,
          name: c.name,
          type: ov.type,
          ectsCredits: c.ects,
          hoursTotal: ov.hours,
          targetGroupsCount: 1,
          semesterId: effectiveSemesterId,
          majors: selectedMajorId ? [{ majorId: selectedMajorId, year: selectedStudyYear }] : [],
        };
      });
      return fetchApi('/courses/bulk', { method: 'POST', body: JSON.stringify(payload) });
    },
    onSuccess: (data) => {
      toast.success(`Zaimportowano ${data.data.count} przedmiotów z USOS.`);
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      onSuccess();
      handleClose();
    },
    onError: (err: any) => toast.error(`Błąd importu: ${err.message}`),
  });

  const handleSearch = () => {
    if (prefix.trim().length >= 5) {
      setSearchedPrefix(prefix.trim());
      setSelectedCodes(new Set());
      setOverrides(new Map());
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setPrefix('');
    setSearchedPrefix('');
    setSelectedCodes(new Set());
    setChosenSemesterId('');
    setSelectedMajorId('');
    setSelectedStudyYear(1);
    setDefaultType('W');
    setDefaultHours(30);
    setOverrides(new Map());
  };

  const toggleCode = (code: string) => {
    setSelectedCodes(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedCodes.size === usosCourses.length) {
      setSelectedCodes(new Set());
    } else {
      setSelectedCodes(new Set(usosCourses.map(c => c.code)));
    }
  };

  const selectedMajor = majorsData?.data?.find((m: any) => m.id === selectedMajorId);
  const selectedCoursesList = usosCourses.filter(c => selectedCodes.has(c.code));

  const handleImport = () => {
    if (selectedCoursesList.length === 0) {
      toast.error('Zaznacz przynajmniej 1 przedmiot.');
      return;
    }
    if (!effectiveSemesterId) {
      toast.error('Wybierz semestr.');
      return;
    }
    importMutation.mutate(selectedCoursesList);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs font-bold px-3 gap-1.5"
        onClick={() => setIsOpen(true)}
      >
        <GraduationCap className="h-3.5 w-3.5" />
        Import USOS
      </Button>

      <Dialog open={isOpen} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-gold" />
              Import przedmiotów z USOS
            </DialogTitle>
          </DialogHeader>

          {/* Search Bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Kod programu USOS (np. 09-S2LSN01)..."
                value={prefix}
                onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                className="pl-9 font-mono"
                autoFocus
              />
            </div>
            <Button onClick={handleSearch} disabled={prefix.trim().length < 5 || isFetching}>
              {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Szukaj
            </Button>
          </div>

          {/* Search Error */}
          {searchError && (
            <div className="flex items-center gap-2 text-sm text-status-danger-fg bg-status-danger-bg rounded-lg p-3">
              <AlertTriangle className="w-4 h-4" />
              {(searchError as any)?.message || 'Błąd połączenia z USOS API'}
            </div>
          )}

          {/* Results */}
          {searchedPrefix && !isSearching && usosCourses.length > 0 && (
            <>
              {/* ═══ Config Panel ═══ */}
              <div className="rounded-lg border bg-cream-dark/50 overflow-hidden">

                {/* Row 1: Semester + Major + Study Year */}
                <div className="flex flex-wrap gap-3 items-end p-3 border-b bg-cream-dark/30">
                  <div className="flex items-center gap-1 mr-1">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Semestr docelowy</span>
                  </div>

                  {/* Academic year */}
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Rok akad.</Label>
                    <div className="flex gap-1">
                      {uniqueYears.map((year: number) => {
                        const isActive = chosenSemester?.year === year;
                        return (
                          <button
                            key={year}
                            onClick={() => {
                              const sem = semesters.find((s: any) => s.year === year);
                              if (sem) setChosenSemesterId(sem.id);
                            }}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${isActive
                              ? 'bg-primary text-white shadow-sm'
                              : 'bg-white border hover:bg-muted text-muted-foreground'
                            }`}
                          >
                            {year}/{year + 1}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Semester type */}
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Semestr</Label>
                    <div className="flex gap-1">
                      {['zimowy', 'letni'].map((type) => {
                        const currentYear = chosenSemester?.year;
                        const isActive = chosenSemester?.type?.toLowerCase() === type;
                        return (
                          <button
                            key={type}
                            onClick={() => {
                              const sem = semesters.find((s: any) => s.year === currentYear && s.type.toLowerCase() === type);
                              if (sem) setChosenSemesterId(sem.id);
                            }}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold capitalize transition-all ${isActive
                              ? 'bg-primary text-white shadow-sm'
                              : 'bg-white border hover:bg-muted text-muted-foreground'
                            }`}
                          >
                            {type}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="h-6 w-[1px] bg-border mx-1 self-end" />

                  {/* Major */}
                  <div className="space-y-1 flex-1 min-w-[140px]">
                    <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Kierunek</Label>
                    <select
                      value={selectedMajorId}
                      onChange={(e) => setSelectedMajorId(e.target.value)}
                      className="w-full h-8 text-sm border rounded-md px-2 bg-white"
                    >
                      <option value="">— brak —</option>
                      {majorsData?.data?.map((m: any) => (
                        <option key={m.id} value={m.id}>{m.code} — {m.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Study year */}
                  {selectedMajorId && (
                    <div className="space-y-1 w-24">
                      <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Rok studiów</Label>
                      <select
                        value={selectedStudyYear}
                        onChange={(e) => setSelectedStudyYear(parseInt(e.target.value))}
                        className="w-full h-8 text-sm border rounded-md px-2 bg-white"
                      >
                        {Array.from({ length: selectedMajor?.years || 3 }).map((_, i) => (
                          <option key={i + 1} value={i + 1}>{i + 1} rok</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Row 2: Default type + hours + apply to all */}
                <div className="flex flex-wrap gap-3 items-end p-3">
                  <div className="space-y-1 w-28">
                    <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Domyślny typ</Label>
                    <select
                      value={defaultType}
                      onChange={(e) => setDefaultType(e.target.value)}
                      className="w-full h-8 text-sm border rounded-md px-2 bg-white"
                    >
                      {COURSE_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1 w-16">
                    <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Godz.</Label>
                    <Input
                      type="number"
                      value={defaultHours}
                      onChange={(e) => setDefaultHours(parseInt(e.target.value) || 30)}
                      min={1}
                      className="h-8 text-sm"
                    />
                  </div>

                  <Button variant="outline" size="sm" onClick={applyDefaultsToAll} className="h-8 text-xs gap-1 self-end">
                    <Wand2 className="w-3.5 h-3.5" /> Zastosuj do wszystkich
                  </Button>

                  <div className="flex-1" />

                  {/* Active semester indicator */}
                  {chosenSemester && (
                    <div className="self-end">
                      <Badge variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary">
                        <Calendar className="w-3 h-3" />
                        {chosenSemester.year}/{chosenSemester.year + 1} {chosenSemester.type}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>

              {/* Results header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    <BookOpen className="w-3 h-3 mr-1" />
                    {usosCourses.length} przedmiotów
                  </Badge>
                  <Badge className="bg-gold text-navy-deep text-xs">
                    {selectedCodes.size} zaznaczonych
                  </Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={toggleAll} className="text-xs gap-1.5">
                  {selectedCodes.size === usosCourses.length
                    ? <><CheckSquare className="w-3.5 h-3.5" /> Odznacz wszystkie</>
                    : <><Square className="w-3.5 h-3.5" /> Zaznacz wszystkie</>
                  }
                </Button>
              </div>

              {/* Table with per-row type & hours */}
              <div className="flex-1 overflow-y-auto border rounded-lg max-h-[35vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Kod USOS</TableHead>
                      <TableHead>Nazwa przedmiotu</TableHead>
                      <TableHead className="w-14 text-center">ECTS</TableHead>
                      <TableHead className="w-24 text-center">Typ</TableHead>
                      <TableHead className="w-20 text-center">Godziny</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usosCourses.map((course) => {
                      const isSelected = selectedCodes.has(course.code);
                      const ov = getOverride(course.code);
                      return (
                        <TableRow
                          key={course.code}
                          className={`transition-colors ${isSelected ? 'bg-gold/10' : 'hover:bg-cream-dark'}`}
                        >
                          <TableCell className="text-center">
                            <button onClick={() => toggleCode(course.code)} className="cursor-pointer">
                              {isSelected
                                ? <CheckSquare className="w-4 h-4 text-gold" />
                                : <Square className="w-4 h-4 text-muted-foreground/40" />
                              }
                            </button>
                          </TableCell>
                          <TableCell>
                            <button onClick={() => toggleCode(course.code)} className="cursor-pointer">
                              <span className="font-mono text-xs text-navy-mid font-semibold">{course.code}</span>
                            </button>
                          </TableCell>
                          <TableCell>
                            <button onClick={() => toggleCode(course.code)} className="cursor-pointer text-left">
                              <span className="text-sm">{course.name}</span>
                            </button>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="text-xs">{course.ects}</Badge>
                          </TableCell>
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={ov.type}
                              onChange={(e) => setOverrideField(course.code, 'type', e.target.value)}
                              className="h-7 text-[11px] border rounded px-1 bg-white w-full font-semibold"
                            >
                              {COURSE_TYPES.map(t => (
                                <option key={t.value} value={t.value}>{t.value}</option>
                              ))}
                            </select>
                          </TableCell>
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="number"
                              value={ov.hours}
                              onChange={(e) => setOverrideField(course.code, 'hours', parseInt(e.target.value) || 30)}
                              min={1}
                              className="h-7 text-[11px] border rounded px-1.5 bg-white w-full text-center font-semibold"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Import button */}
              <Button
                onClick={handleImport}
                disabled={selectedCodes.size === 0 || importMutation.isPending || !effectiveSemesterId}
                className="w-full gap-2"
              >
                {importMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Importuję...</>
                ) : (
                  <><Download className="w-4 h-4" /> Importuj zaznaczone ({selectedCodes.size})</>
                )}
              </Button>
            </>
          )}

          {/* Empty state */}
          {searchedPrefix && !isSearching && usosCourses.length === 0 && !searchError && (
            <div className="text-center py-12 text-muted-foreground">
              <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Brak wyników dla „{searchedPrefix}"</p>
              <p className="text-xs mt-1">Spróbuj inny kod programu (np. 09-S2LSN01)</p>
            </div>
          )}

          {/* Loading state */}
          {isSearching && (
            <div className="text-center py-12 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-gold" />
              <p className="text-sm font-medium">Przeszukuję USOS API...</p>
              <p className="text-xs mt-1">Może to potrwać kilka sekund (paginacja)</p>
            </div>
          )}

          {/* Initial state */}
          {!searchedPrefix && !isSearching && (
            <div className="text-center py-10 px-6 text-muted-foreground">
              <Search className="w-10 h-10 mx-auto mb-4 opacity-30 text-primary" />
              <h3 className="text-base font-bold text-foreground mb-2">Jak szukać przedmiotów w USOS?</h3>
              <p className="text-sm mb-4">Wpisz <strong>dwa pierwsze człony kodu przedmiotu</strong> (np. dla przedmiotu 09-S1FHI01-P14313 wpisujemy 09-S1FHI01).</p>
              
              <div className="bg-muted/50 p-4 rounded-lg text-left text-xs max-w-md mx-auto space-y-1.5 border border-border/50">
                <p>Przykład kodu: <code className="bg-background border px-1.5 py-0.5 rounded font-mono font-bold text-primary shadow-sm">09-S1FHI01</code></p>
                <ul className="list-disc list-inside ml-2 mt-2 space-y-1 text-foreground/80">
                  <li><strong className="text-foreground">09</strong> — kod wydziału (Neofilologia)</li>
                  <li><strong className="text-foreground">S1</strong> — studia I stopnia (S2 to II st.)</li>
                  <li><strong className="text-foreground">FHI</strong> — kod kierunku/programu (filologia hiszpańska)</li>
                  <li><strong className="text-foreground">01</strong> — semestr pierwszy (analogicznie 02 to drugi, 03 to trzeci...)</li>
                </ul>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
