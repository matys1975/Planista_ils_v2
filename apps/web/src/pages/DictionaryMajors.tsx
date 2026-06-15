import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { GraduationCap, Plus, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { fetchApi } from '../lib/api';

const majorSchema = z.object({
  code: z.string().min(1, 'Kod kierunku jest wymagany (np. S1-LSN)'),
  name: z.string().min(1, 'Pełna nazwa jest wymagana'),
  degree: z.string().min(1, 'Stopień studiów jest wymagany'),
  years: z.coerce.number().int().positive('Liczba lat musi być dodatnia'),
});

type MajorFormData = z.infer<typeof majorSchema>;

export function DictionaryMajors({ hideHeader, filterInstituteId }: { hideHeader?: boolean; filterInstituteId?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingMajor, setEditingMajor] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: majorsData, isLoading } = useQuery({
    queryKey: ['majors'],
    queryFn: () => fetchApi('/majors')
  });

  // Client-side institute filter
  const filteredMajors = filterInstituteId
    ? (majorsData?.data || []).filter((m: any) => m.instituteId === filterInstituteId)
    : (majorsData?.data || []);

  const createMutation = useMutation({
    mutationFn: (data: MajorFormData) => fetchApi('/majors', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['majors'] });
      queryClient.invalidateQueries({ queryKey: ['dictionaries'] });
      setIsOpen(false);
      reset();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: MajorFormData & { id: string }) => {
      const { id, ...payload } = data;
      return fetchApi(`/majors/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['majors'] });
      queryClient.invalidateQueries({ queryKey: ['dictionaries'] });
      setIsOpen(false);
      setEditingMajor(null);
      reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetchApi(`/majors/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['majors'] });
      queryClient.invalidateQueries({ queryKey: ['dictionaries'] });
    },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<MajorFormData>({
    resolver: zodResolver(majorSchema),
    defaultValues: {
      degree: 'I stopnia',
      years: 3,
    }
  });

  const onSubmit = (data: MajorFormData) => {
    if (editingMajor) updateMutation.mutate({ ...data, id: editingMajor.id });
    else createMutation.mutate(data);
  };

  const openCreate = () => {
    setEditingMajor(null);
    reset({ degree: 'I stopnia', years: 3, code: '', name: '' });
    setIsOpen(true);
  };

  const openEdit = (major: any) => {
    setEditingMajor(major);
    reset({
      code: major.code,
      name: major.name,
      degree: major.degree,
      years: major.years,
    });
    setIsOpen(true);
  };

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <div className="flex justify-between items-center bg-card p-6 rounded-xl border shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg text-primary">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Kierunki studiów</h1>
              <p className="text-muted-foreground text-sm">Zarządzaj kierunkami, kodami i długością studiów</p>
            </div>
          </div>

          <Button className="gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Dodaj kierunek
          </Button>
        </div>
      )}

      {/* Action bar for embedded mode */}
      {hideHeader && (
        <div className="flex justify-between items-center px-4 py-2 bg-muted/10 border-b">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-black uppercase tracking-wider">Kierunki</span>
          </div>
          <Button size="sm" className="h-7 text-[10px] font-black px-3 gap-1 bg-primary" onClick={openCreate}>
            <Plus className="h-3 w-3" /> DODAJ KIERUNEK
          </Button>
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMajor ? 'Edytuj kierunek' : 'Dodaj nowy kierunek'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Kod (np. S1-LSN)</Label>
                <Input id="code" placeholder="Wpisz kod..." {...register('code')} />
                {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="years">Liczba lat studiów</Label>
                <Input id="years" type="number" min="1" max="6" {...register('years')} />
                {errors.years && <p className="text-xs text-destructive">{errors.years.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Pełna nazwa kierunku</Label>
              <Input id="name" placeholder="np. Lingwistyka stosowana..." {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="degree">Stopień studiów</Label>
              <select
                id="degree"
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                {...register('degree')}
              >
                <option value="I stopnia">I stopnia (Licencjackie)</option>
                <option value="II stopnia">II stopnia (Magisterskie)</option>
                <option value="Jednolite">Jednolite magisterskie</option>
                <option value="Podyplomowe">Podyplomowe</option>
              </select>
              {errors.degree && <p className="text-xs text-destructive">{errors.degree.message}</p>}
            </div>

            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="w-full mt-4">
              {editingMajor ? 'Zapisz zmiany' : 'Dodaj kierunek'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kod</TableHead>
              <TableHead>Pełna nazwa</TableHead>
              <TableHead>Jednostka</TableHead>
              <TableHead>Stopień</TableHead>
              <TableHead>Lata</TableHead>
              <TableHead className="text-center">Przedmioty</TableHead>
              <TableHead className="text-right">Akcje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24">Ładowanie danych...</TableCell>
              </TableRow>
            ) : filteredMajors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">Brak kierunków. Dodaj pierwszy kierunek.</TableCell>
              </TableRow>
            ) : (
              filteredMajors.map((major: any) => (
                <TableRow key={major.id}>
                  <TableCell className="font-semibold text-primary">{major.code}</TableCell>
                  <TableCell>{major.name}</TableCell>
                  <TableCell>
                    {major.institute ? (
                      <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded">
                        {major.institute.shortCode || major.institute.name}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Nieprzypisany</span>
                    )}
                  </TableCell>
                  <TableCell>{major.degree}</TableCell>
                  <TableCell>{major.years}</TableCell>
                  <TableCell className="text-center">
                    <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
                      {major._count?.courses || 0}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(major)}>
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => {
                        if (confirm('Na pewno usunąć ten kierunek?')) {
                          deleteMutation.mutate(major.id);
                        }
                      }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
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
