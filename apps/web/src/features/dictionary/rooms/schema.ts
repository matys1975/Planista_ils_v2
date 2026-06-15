import { z } from 'zod';

export const roomSchema = z.object({
    building: z.string().min(1, 'Budynek jest wymagany'),
    number: z.string().min(1, 'Numer sali jest wymagany'),
    capacity: z.coerce.number().int().positive('Pojemność musi być > 0'),
    type: z.string().min(1, 'Typ sali jest wymagany'),
    instituteId: z.string().optional(),
});

export type RoomFormData = z.infer<typeof roomSchema>;
