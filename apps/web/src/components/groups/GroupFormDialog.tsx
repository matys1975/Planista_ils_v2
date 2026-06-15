import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Group, Semester } from '../../types/models';

export const groupSchema = z.object({
  name: z.string().min(1, 'Nazwa jest wymagana'),
  majorId: z.preprocess(
    (val) => (val === '' ? null : val),
    z.string().uuid('Należy wybrać kierunek').nullable().optional()
  ),
  majorName: z.string().nullable().optional(),
  degree: z.string().min(1, 'Stopień studiów jest wymagany'),
  year: z.coerce.number().int().positive('Rok musi być dodatni'),
  size: z.coerce.number().int().positive('Rozmiar (liczba studentów) musi być dodatni'),
  semesterId: z.string().uuid('Należy wybrać semestr powiązany'),
});

export type GroupFormData = z.infer<typeof groupSchema>;

interface GroupFormDialogProps {
  isOpen: boolean;
  editingGroup: Group | null;
  semestersData: any;
  majorsData: any;
  groupsData: any;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (data: GroupFormData) => void;
}

export function GroupFormDialog({
  isOpen,
  editingGroup,
  semestersData,
  majorsData,
  groupsData,
  isPending,
  onClose,
  onSubmit,
}: GroupFormDialogProps) {
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<GroupFormData>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      degree: 'I stopnia',
      year: 1,
      size: 20,
    }
  });

  useEffect(() => {
    if (editingGroup) {
      reset({
        name: editingGroup.name,
        majorId: editingGroup.majorId,
        majorName: editingGroup.majorName,
        degree: editingGroup.degree,
        year: editingGroup.year,
        size: (editingGroup as any).size || 20,
        semesterId: editingGroup.semesterId,
      });
    }
  }, [editingGroup, reset]);

  const formMajorId = watch('majorId');
  const formDegree = watch('degree');
  const formYear = watch('year');

  const generateName = () => {
    const selectedMajor = majorsData?.data?.find((m: any) => m.id === formMajorId);
    if (!selectedMajor) return;

    let code = selectedMajor.code;
    const isS1 = formDegree === 'I stopnia' || formDegree === 'Jednolite';
    const prefix = isS1 ? 'S1' : 'S2';
    
    // Upewnij się, że kod ma prefiks stopnia
    if (!code.startsWith('S1-') && !code.startsWith('S2-')) {
      code = `${prefix}-${code}`;
    }

    if (code && formYear) {
      const prefixStr = `${code} (rok ${formYear}) gr.`;
      const matchingGroups = groupsData?.data?.filter((g: any) => g.name.startsWith(prefixStr)) || [];
      const nextNum = matchingGroups.length + 1;
      const finalName = `${prefixStr} ${nextNum}`;
      setValue('name', finalName);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{editingGroup ? 'Edytuj grupę' : 'Dodaj nową grupę'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="semesterId">Semestr Akademicki</Label>
            <select
              id="semesterId"
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              {...register('semesterId')}
            >
              <option value="">-- Wybierz otwarty semestr --</option>
              {semestersData?.data?.filter((s: Semester) => !s.isLocked).map((sem: Semester) => (
                <option key={sem.id} value={sem.id}>{sem.name} ({sem.year})</option>
              ))}
            </select>
            {errors.semesterId && <p className="text-xs text-destructive">{errors.semesterId.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="majorId">Kierunek / Specjalność</Label>
            <select id="majorId" className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('majorId')}>
              <option value="">-- Wybierz kierunek z bazy --</option>
              {majorsData?.data?.map((m: any) => (
                <option key={m.id} value={m.id}>{m.name} ({m.code})</option>
              ))}
            </select>
            {errors.majorId && <p className="text-xs text-destructive">{errors.majorId.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nazwa/Sygnatura</Label>
              <div className="flex gap-2">
                <Input id="name" placeholder="np. 1 LSN" {...register('name')} />
                <Button type="button" variant="secondary" onClick={generateName} title="Generuj" className="px-3">
                  <Wand2 className="h-4 w-4" />
                </Button>
              </div>
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="degree">Stopień studiów</Label>
              <select id="degree" className="flex h-10 w-full items-center border rounded-md bg-background px-3 py-2 text-sm" {...register('degree')}>
                <option value="I stopnia">I stopnia (Licencjackie)</option>
                <option value="II stopnia">II stopnia (Magisterskie)</option>
                <option value="Podyplomowe">Podyplomowe</option>
                <option value="Jednolite">Jednolite magisterskie</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="year">Rok studiowania</Label>
              <Input id="year" type="number" min="1" max="5" {...register('year')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="size">Wielkość grupy (osób)</Label>
              <Input id="size" type="number" min="1" {...register('size')} />
            </div>
          </div>

          <Button type="submit" disabled={isPending} className="w-full mt-4">
            {editingGroup ? 'Zapisz zmiany' : 'Dodaj grupę'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
