import { z } from 'zod';

export const entrySchema = z.object({
    semesterId: z.string().min(1, 'Semestr jest wymagany'),
    courseId: z.string().min(1, 'Przedmiot jest wymagany'),
    teacherId: z.string().min(1, 'Prowadzący jest wymagany'),
    roomId: z.string().min(1, 'Sala jest wymagana'),
    groupIds: z.array(z.string()).min(1, 'Wybierz co najmniej 1 grupę'),
    startTime: z.string(),
    endTime: z.string(),
    dayOfWeek: z.coerce.number(),
    weekType: z.enum(['A', 'B', 'AB']),
    classType: z.string().optional().nullable(),
});

export type EntryFormData = z.infer<typeof entrySchema>;
