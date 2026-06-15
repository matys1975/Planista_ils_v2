import { z } from 'zod';

export const semesterSchema = z.object({
    name: z.string().min(1, 'Nazwa jest wymagana'),
    year: z.coerce.number().int().positive('Rok musi być dodatni'),
    type: z.enum(['zimowy', 'letni']),
    dateStart: z.string().min(1, 'Data rozpoczęcia jest wymagana'),
    dateEnd: z.string().min(1, 'Data zakończenia jest wymagana'),
    isLocked: z.boolean(),
});

export type SemesterFormData = z.infer<typeof semesterSchema>;
