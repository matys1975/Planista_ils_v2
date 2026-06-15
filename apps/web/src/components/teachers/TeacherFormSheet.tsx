import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { fetchApi } from '../../lib/api';
import type { Teacher } from '../../types/models';

export const teacherSchema = z.object({
  firstName: z.string().min(1, 'Imię jest wymagane'),
  lastName: z.string().min(1, 'Nazwisko jest wymagane'),
  title: z.string().min(1, 'Tytuł naukowy jest wymagany'),
  email: z.string().email('Niepoprawny adres email'),
  unit: z.string().min(1, 'Jednostka organizacyjna jest wymagana'),
  pensumLimit: z.coerce.number().int().positive(),
  version: z.number().int().nonnegative().optional(),
});

export type TeacherFormData = z.infer<typeof teacherSchema>;

interface TeacherFormSheetProps {
  isOpen: boolean;
  editingTeacher: Teacher | null;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (data: TeacherFormData) => void;
}

export function TeacherFormSheet({
  isOpen,
  editingTeacher,
  isPending,
  onClose,
  onSubmit,
}: TeacherFormSheetProps) {
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<TeacherFormData>({
    resolver: zodResolver(teacherSchema),
    defaultValues: {
      unit: '',
      pensumLimit: 210,
    }
  });

  // Pobieranie listy jednostek
  const { data: institutesData } = useQuery({
    queryKey: ['institutes'],
    queryFn: () => fetchApi('/institutes'),
  });

  const institutes = institutesData?.data || [];

  useEffect(() => {
    if (editingTeacher) {
      reset({
        firstName: editingTeacher.firstName,
        lastName: editingTeacher.lastName,
        title: editingTeacher.title || '',
        email: (editingTeacher as any).email || '',
        unit: editingTeacher.unit || '',
        pensumLimit: editingTeacher.pensumLimit,
        version: (editingTeacher as any).version,
      });
    } else {
      reset({ unit: '', pensumLimit: 210, version: undefined });
    }
  }, [editingTeacher, reset]);

  return (
    <Sheet open={isOpen} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="w-[100vw] sm:max-w-md overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <SheetHeader className="mb-6">
          <SheetTitle className="text-2xl">{editingTeacher ? 'Edytuj prowadzącego' : 'Nowy prowadzący'}</SheetTitle>
          <p className="text-sm text-muted-foreground">Wypełnij poniższe karty, aby zachować ewidencję personelu w systemie.</p>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* KARTA 1: Identyfikacja osobowa */}
          <div className="p-4 bg-muted/20 border rounded-xl space-y-4">
            <h3 className="font-semibold flex items-center text-primary">
              <span className="bg-primary/20 text-primary w-6 h-6 flex items-center justify-center rounded-md mr-2 text-xs">1</span>
              Dane pracownika
            </h3>

            <div className="space-y-2">
              <Label htmlFor="title" className="mb-2 block text-sm font-medium">Tytuł zawodowy/naukowy</Label>
              <select 
                {...register('title')}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">-- Wybierz tytuł --</option>
                <option value="mgr">mgr</option>
                <option value="dr">dr</option>
                <option value="dr hab.">dr hab.</option>
                <option value="prof.">prof.</option>
              </select>
              {errors.title && <p className="text-xs text-destructive mt-1">{errors.title.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">Imię</Label>
                <Input id="firstName" placeholder="np. Jan" className="bg-background" {...register('firstName')} />
                {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nazwisko</Label>
                <Input id="lastName" placeholder="np. Kowalski" className="bg-background" {...register('lastName')} />
                {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <Label htmlFor="email">E-mail służbowy</Label>
              <Input id="email" type="email" placeholder="np. jan.kowalski@amu.edu.pl" className="bg-background font-mono text-sm" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
          </div>

          {/* KARTA 2: Usytuowanie organizacyjne */}
          <div className="p-4 bg-muted/20 border rounded-xl space-y-4">
            <h3 className="font-semibold flex items-center text-primary">
              <span className="bg-primary/20 text-primary w-6 h-6 flex items-center justify-center rounded-md mr-2 text-xs">2</span>
              Zatrudnienie
            </h3>

            <div className="space-y-2">
              <Label htmlFor="unit" className="text-sm font-medium">Jednostka organizacyjna</Label>
              <select 
                id="unit"
                {...register('unit')}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">-- Wybierz jednostkę --</option>
                {institutes.map((inst: any) => (
                  <option key={inst.id} value={inst.name}>
                    {inst.name}
                  </option>
                ))}
              </select>
              {errors.unit && <p className="text-xs text-destructive mt-1">{errors.unit.message}</p>}
              <p className="text-[10px] text-muted-foreground mt-1 italic">
                * Jednostki są zarządzane przez SuperAdmina w Panelu Wydziałowym.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <Label htmlFor="pensumLimit">Roczne Pensum (limit uczelniany)</Label>
              <Input id="pensumLimit" type="number" step="1" className="bg-background text-lg font-bold text-center w-full max-w-[150px]" {...register('pensumLimit')} />
              {errors.pensumLimit && <p className="text-xs text-destructive">{errors.pensumLimit.message}</p>}
            </div>
          </div>

          <div className="sticky bottom-0 pt-4 pb-2 bg-background/90 backdrop-blur-md border-t flex gap-3 mt-8">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Anuluj
            </Button>
            <Button type="submit" disabled={isPending} className="flex-[2] gap-2">
              {editingTeacher ? 'Zapisz zmiany' : <><Plus className="w-4 h-4" /> Dodaj prowadzącego</>}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
