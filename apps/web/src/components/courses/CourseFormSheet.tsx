import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { Course, Semester } from '../../types/models';
import { parseCourseCode } from '../../utils/courseUtils';

export const courseSchema = z.object({
  code: z.string().min(1, 'Sygnatura jest wymagana'),
  name: z.string().min(1, 'Nazwa przedmiotu jest wymagana'),
  type: z.enum(['W', 'C', 'L', 'S', 'Pr', 'K']),
  ectsCredits: z.coerce.number().int().min(0, 'Wartość ECTS nie może byc ujemna'),
  hoursTotal: z.coerce.number().int().min(0, 'Godziny nie mogą być ujemne'),
  targetGroupsCount: z.coerce.number().int().min(1, 'Liczba grup musi wynosić minimum 1'),
  semesterId: z.string().uuid('Należy wybrać semestr powiązany'),
  majors: z.array(z.object({
    majorId: z.string().uuid(),
    year: z.number().int().min(1).max(6),
  })),
});

export type CourseFormData = z.infer<typeof courseSchema>;

const COURSE_TYPES = [
  { val: 'W', label: 'Wykład', icon: '🎤' },
  { val: 'C', label: 'Ćwiczenia', icon: '📝' },
  { val: 'L', label: 'Laboratoria', icon: '💻' },
  { val: 'S', label: 'Seminarium', icon: '🎓' },
  { val: 'K', label: 'Konwersacje', icon: '💬' },
  { val: 'Pr', label: 'Praktyki', icon: '🛠️' },
] as const;

interface CourseFormSheetProps {
  isOpen: boolean;
  editingCourse: Course | null;
  semestersData: any;
  majorsData: any;
  errorMsg: string;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (data: CourseFormData) => void;
}

export function CourseFormSheet({
  isOpen,
  editingCourse,
  semestersData,
  majorsData,
  errorMsg,
  isPending,
  onClose,
  onSubmit,
}: CourseFormSheetProps) {
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<CourseFormData>({
    resolver: zodResolver(courseSchema),
    defaultValues: { type: 'W', ectsCredits: 3, hoursTotal: 30, targetGroupsCount: 1, majors: [] },
  });

  const watchedCode = watch('code') || '';
  const currentMajors = watch('majors') || [];
  const detectedFromCode = parseCourseCode(watchedCode);
  const lastAutoAppliedCode = useRef('');

  // Reset form when editing course changes
  useEffect(() => {
    if (editingCourse) {
      reset({
        code: editingCourse.code,
        name: editingCourse.name,
        type: editingCourse.type,
        ectsCredits: editingCourse.ectsCredits,
        hoursTotal: editingCourse.hoursTotal || 30,
        targetGroupsCount: editingCourse.targetGroupsCount || 1,
        semesterId: editingCourse.semesterId,
        majors: editingCourse.majors.map((m: any) => ({ majorId: m.majorId, year: m.year })),
      });
    } else {
      reset({ type: 'W', ectsCredits: 3, hoursTotal: 30, targetGroupsCount: 1, majors: [] });
    }
    lastAutoAppliedCode.current = '';
  }, [editingCourse, reset]);

  // Auto-detect major from course code
  useEffect(() => {
    if (!detectedFromCode.major || watchedCode === lastAutoAppliedCode.current) return;
    lastAutoAppliedCode.current = watchedCode;

    const currentMajors = watch('majors') || [];
    const majorFromDb = majorsData?.data?.find((m: any) => m.code === detectedFromCode.major);

    if (majorFromDb) {
      const exists = currentMajors.find((m: any) => m.majorId === majorFromDb.id);
      if (!exists) {
        setValue('majors', [...currentMajors, { majorId: majorFromDb.id, year: detectedFromCode.studyYear || 1 }]);
      }
    }
  }, [watchedCode, detectedFromCode.major, majorsData, setValue, watch]);

  const toggleMajor = (majorId: string, year: number) => {
    const exists = currentMajors.find((m: any) => m.majorId === majorId && m.year === year);
    if (exists) {
      setValue('majors', currentMajors.filter((m: any) => !(m.majorId === majorId && m.year === year)), { shouldValidate: true, shouldDirty: true });
    } else {
      setValue('majors', [...currentMajors, { majorId, year }], { shouldValidate: true, shouldDirty: true });
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <SheetContent
        side="right"
        className="w-[100vw] sm:max-w-md overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <SheetHeader className="mb-6">
          <SheetTitle className="text-2xl">{editingCourse ? 'Edytuj przedmiot' : 'Zdefiniuj przedmiot'}</SheetTitle>
          <p className="text-sm text-muted-foreground">Wypełnij poszczególne pakiety informacji, aby dodać ramy przedmiotu.</p>
        </SheetHeader>

        {errorMsg && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm font-medium mb-4 border border-destructive/20">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* KARTA 1: Identyfikacja */}
          <div className="p-4 bg-muted/20 border rounded-xl space-y-4">
            <h3 className="font-semibold flex items-center text-primary">
              <span className="bg-primary/20 text-primary w-6 h-6 flex items-center justify-center rounded-md mr-2 text-xs">1</span>
              Identyfikacja
            </h3>

            <div className="space-y-2">
              <Label htmlFor="code">Sygnatura/Kod</Label>
              <Input id="code" placeholder="np. 09-S1LSA01-P00560" className="font-mono bg-background" {...register('code')} />
              {detectedFromCode.major && (
                <span className="text-[10px] text-status-active-fg bg-status-active-bg px-2 py-1 rounded-md border border-status-active-fg/20 inline-block mt-1">
                  ✓ {detectedFromCode.majorLabel}, sem. {detectedFromCode.studySemester} ({detectedFromCode.studyYear} rok)
                </span>
              )}
              {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Pełna nazwa kursu</Label>
              <Input id="name" placeholder="np. Wstęp do lingwistyki komputerowej" className="bg-background" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2 pt-2 border-t">
              <Label htmlFor="type" className="mb-2 block">Typ zajęć</Label>
              <div className="grid grid-cols-3 gap-2">
                {COURSE_TYPES.map((t) => {
                  const isSelected = watch('type') === t.val;
                  return (
                    <button
                      key={t.val}
                      type="button"
                      onClick={() => setValue('type', t.val as any, { shouldValidate: true })}
                      className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs font-semibold transition-all ${
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm ring-2 ring-primary/20'
                          : 'bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <span className="text-sm mb-1">{t.icon}</span>
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>
              <input type="hidden" {...register('type')} />
              {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
            </div>
          </div>

          {/* KARTA 2: Usytuowanie w programie */}
          <div className="p-4 bg-muted/20 border rounded-xl space-y-4">
            <h3 className="font-semibold flex items-center text-primary">
              <span className="bg-primary/20 text-primary w-6 h-6 flex items-center justify-center rounded-md mr-2 text-xs">2</span>
              Usytuowanie w programie
            </h3>

            <div className="space-y-2">
              <Label htmlFor="semesterId">Semestr Akademicki <span className="text-muted-foreground font-normal">(kalendarz)</span></Label>
              <select
                id="semesterId"
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                {...register('semesterId')}
              >
                <option value="">-- Wybierz otwarty semestr --</option>
                {semestersData?.data?.filter((s: Semester) => !s.isLocked).map((sem: Semester) => (
                  <option key={sem.id} value={sem.id}>{sem.name} ({sem.year})</option>
                ))}
              </select>
              {errors.semesterId && <p className="text-xs text-destructive">{errors.semesterId.message}</p>}
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ectsCredits">Punkty ECTS</Label>
                <Input id="ectsCredits" type="number" min="0" max="30" className="bg-background text-center text-lg font-bold" {...register('ectsCredits')} />
                {errors.ectsCredits && <p className="text-xs text-destructive">{errors.ectsCredits.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="hoursTotal">Godz. na grupę</Label>
                <Input id="hoursTotal" type="number" min="0" max="500" className="bg-background text-center text-lg font-bold text-primary" {...register('hoursTotal')} />
                {errors.hoursTotal && <p className="text-xs text-destructive">{errors.hoursTotal.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetGroupsCount">Liczba grup</Label>
                <Input id="targetGroupsCount" type="number" min="1" max="50" className="bg-background text-center text-lg font-bold text-primary" {...register('targetGroupsCount')} />
                {errors.targetGroupsCount && <p className="text-xs text-destructive">{errors.targetGroupsCount.message}</p>}
              </div>
            </div>

            <div className="space-y-4 pt-2 border-t">
              <Label>Przypisanie do programu studiów (kierunków i lat)</Label>
              <p className="text-[10px] text-muted-foreground">Zaznacz, na którym roku dany program/kierunek realizuje ten przedmiot.</p>
              <div className="space-y-3">
                {majorsData?.data?.map((m: any) => (
                  <div key={m.id} className="space-y-2 border-b pb-2 last:border-0">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-primary flex items-center gap-2">
                        {m.code}
                        {m.institute?.shortCode && (
                          <span className="px-1.5 py-0.5 rounded bg-muted/50 text-[9px] font-semibold text-muted-foreground border">
                            {m.institute.shortCode}
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] text-muted-foreground text-right max-w-[60%] truncate" title={m.name}>{m.name}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from({ length: m.years }).map((_, i) => {
                        const year = i + 1;
                        const isActive = currentMajors.some((sel: any) => sel.majorId === m.id && sel.year === year);
                        return (
                          <button
                            key={`${m.id}-${year}`}
                            type="button"
                            onClick={() => toggleMajor(m.id, year)}
                            className={`text-[10px] px-2 py-1 rounded border transition-all ${
                              isActive
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background text-muted-foreground hover:bg-muted'
                            }`}
                          >
                            {year} rok
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 pt-4 pb-2 bg-background/90 backdrop-blur-md border-t flex gap-3 mt-8">
            <Button type="button" variant="outline" className="flex-1" onClick={handleClose}>
              Anuluj
            </Button>
            <Button type="submit" disabled={isPending} className="flex-[2] gap-2">
              {editingCourse ? 'Zapisz zmiany' : <><Plus className="w-4 h-4" /> Dodaj przedmiot</>}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
