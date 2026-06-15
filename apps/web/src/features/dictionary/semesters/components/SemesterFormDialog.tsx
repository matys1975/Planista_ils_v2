import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import type { Semester } from '../types';
import type { SemesterFormData } from '../schema';
import { semesterSchema } from '../schema';
import { deriveSemesterDefaults } from '../utils';

interface SemesterFormDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: SemesterFormData) => void;
    editingSemester: Semester | null;
    isSubmitting: boolean;
}

const baseYear = new Date().getFullYear() - 1;

function mapSemesterToFormData(semester: Semester): SemesterFormData {
    return {
        name: semester.name,
        year: semester.year,
        type: semester.type,
        dateStart: semester.dateStart ? new Date(semester.dateStart).toISOString().split('T')[0] : '',
        dateEnd: semester.dateEnd ? new Date(semester.dateEnd).toISOString().split('T')[0] : '',
        isLocked: semester.isLocked,
    };
}

export function SemesterFormDialog({
    isOpen,
    onOpenChange,
    onSubmit,
    editingSemester,
    isSubmitting,
}: SemesterFormDialogProps) {
    const isEditing = !!editingSemester;

    const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<SemesterFormData>({
        resolver: zodResolver(semesterSchema),
        defaultValues: isEditing
            ? mapSemesterToFormData(editingSemester)
            : { ...deriveSemesterDefaults(baseYear + 1, 'zimowy'), isLocked: false },
    });

    const watchType = watch('type');
    const watchYear = watch('year');

    useEffect(() => {
        if (!isEditing && watchYear) {
            const defaults = deriveSemesterDefaults(Number(watchYear), watchType);
            reset({ ...defaults, isLocked: false });
        }
    }, [watchType, watchYear, isEditing, reset]);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus className="h-4 w-4" /> Dodaj semestr
                </Button>
            </DialogTrigger>
            <DialogContent aria-describedby={undefined}>
                <DialogHeader>
                    <DialogTitle>{isEditing ? 'Edytuj semestr' : 'Dodaj nowy semestr'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="year">Rok Akademicki</Label>
                            <select
                                id="year"
                                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm ring-offset-background disabled:opacity-50"
                                {...register('year')}
                                disabled={isEditing}
                            >
                                {Array.from({ length: 6 }).map((_, i) => {
                                    const y = baseYear + i;
                                    return (
                                        <option key={y} value={y}>
                                            {y} / {y + 1}
                                        </option>
                                    );
                                })}
                            </select>
                            {errors.year && <p className="text-xs text-destructive">{errors.year.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="type">Typ</Label>
                            <select
                                id="type"
                                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm ring-offset-background disabled:opacity-50"
                                {...register('type')}
                                disabled={isEditing}
                            >
                                <option value="zimowy">Zimowy</option>
                                <option value="letni">Letni</option>
                            </select>
                            {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="name">Nazwa semestru</Label>
                        <Input id="name" {...register('name')} className="font-medium text-primary" placeholder="np. Semestr Zimowy 2024/25" />
                        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="dateStart">Początek semestru</Label>
                            <Input id="dateStart" type="date" {...register('dateStart')} />
                            {errors.dateStart && <p className="text-xs text-destructive">{errors.dateStart.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="dateEnd">Koniec semestru</Label>
                            <Input id="dateEnd" type="date" {...register('dateEnd')} />
                            {errors.dateEnd && <p className="text-xs text-destructive">{errors.dateEnd.message}</p>}
                        </div>
                    </div>

                    <Button type="submit" disabled={isSubmitting} className="w-full mt-4">
                        {isEditing ? 'Zapisz zmiany' : 'Utwórz Semestr'}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
