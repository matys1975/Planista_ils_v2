import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, Loader2, AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { fetchApi } from '../../lib/api';

interface CloneSemesterModalProps {
  targetSemesterId: string;
  onSuccess: () => void;
}

export function CloneSemesterModal({ targetSemesterId, onSuccess }: CloneSemesterModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sourceSemesterId, setSourceSemesterId] = useState('');
  const [majorId, setMajorId] = useState('');

  // Fetch all semesters to pick a source
  const { data: semestersData } = useQuery({
    queryKey: ['semesters'],
    queryFn: () => fetchApi('/semesters'),
  });

  // Fetch majors for selective cloning
  const { data: majorsData } = useQuery({
    queryKey: ['majors'],
    queryFn: () => fetchApi('/majors'),
  });

  const cloneMutation = useMutation({
    mutationFn: (data: { sourceSemesterId: string; targetSemesterId: string; majorId?: string }) =>
      fetchApi('/courses/clone', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (res) => {
      toast.success(`Klonowanie zakończone! Skopiowano ${res.data.count} przedmiotów.`);
      setIsOpen(false);
      onSuccess();
    },
    onError: (err: any) => {
      toast.error('Błąd klonowania: ' + err.message);
    },
  });

  const handleClone = () => {
    if (!sourceSemesterId) {
      toast.error('Wybierz semestr źródłowy');
      return;
    }
    if (sourceSemesterId === targetSemesterId) {
      toast.error('Semestr źródłowy i docelowy nie mogą być takie same');
      return;
    }
    cloneMutation.mutate({ 
      sourceSemesterId, 
      targetSemesterId, 
      majorId: majorId === 'all' ? undefined : majorId 
    });
  };

  const targetSemester = semestersData?.data?.find((s: any) => s.id === targetSemesterId);
  const otherSemesters = semestersData?.data?.filter((s: any) => s.id !== targetSemesterId) || [];
  const majors = majorsData?.data || [];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs bg-gold/5 hover:bg-gold/10 border-gold/20 text-navy-deep">
          <Copy className="h-3.5 w-3.5" /> Klonuj siatkę
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5 text-navy-mid" />
            Klonowanie przedmiotów
          </DialogTitle>
          <DialogDescription>
            Skopiuj definicje przedmiotów z innego semestru do aktualnie wybranego.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-4">
          <div className="p-3 bg-status-warning-bg border border-status-warning-fg/20 rounded-lg flex gap-3 items-start">
            <AlertTriangle className="h-5 w-5 text-status-warning-fg shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              <strong>Uwaga:</strong> Zostaną skopiowane nazwy, kody, punkty ECTS i kierunki. 
              Przydziały prowadzących (obsada) <strong>nie zostaną</strong> skopiowane, aby uniknąć błędów w nowym roku.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <span>Z semestru:</span>
                <ArrowRight className="h-3 w-3" />
                <span>Do semestru:</span>
              </div>
              
              <div className="grid grid-cols-[1fr,32px,1fr] items-center gap-2">
                <select
                  className="w-full h-10 px-3 py-2 text-sm bg-background border rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={sourceSemesterId}
                  onChange={(e) => setSourceSemesterId(e.target.value)}
                >
                  <option value="">-- Wybierz źródło --</option>
                  {otherSemesters.map((sem: any) => (
                    <option key={sem.id} value={sem.id}>{sem.name} ({sem.year})</option>
                  ))}
                </select>

                <div className="flex justify-center">
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>

                <div className="h-10 px-3 py-2 text-sm bg-muted border rounded-md flex items-center font-medium truncate">
                  {targetSemester?.name || '...'}
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Kierunek (opcjonalnie):</label>
              <select
                className="w-full h-10 px-3 py-2 text-sm bg-background border rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
                value={majorId}
                onChange={(e) => setMajorId(e.target.value)}
              >
                <option value="all">Wszystkie kierunki (cała siatka)</option>
                {majors.map((m: any) => (
                  <option key={m.id} value={m.id}>{m.name} ({m.code})</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground italic">
                Wybierz konkretny kierunek, aby kopiować przedmioty sukcesywnie.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsOpen(false)} disabled={cloneMutation.isPending}>
            Anuluj
          </Button>
          <Button 
            onClick={handleClone} 
            disabled={cloneMutation.isPending || !sourceSemesterId}
            className="bg-gold hover:bg-indigo-700 text-white gap-2"
          >
            {cloneMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            Kopiuj przedmioty
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
