export const timeSlots = [
    { id: 1, start: '08:00', end: '09:30' },
    { id: 2, start: '09:45', end: '11:15' },
    { id: 3, start: '11:30', end: '13:00' },
    { id: 4, start: '13:15', end: '14:45' },
    { id: 5, start: '15:00', end: '16:30' },
    { id: 6, start: '16:45', end: '18:15' },
    { id: 7, start: '18:30', end: '20:00' },
] as const;

export const days = [
    { id: 1, label: 'Poniedziałek' },
    { id: 2, label: 'Wtorek' },
    { id: 3, label: 'Środa' },
    { id: 4, label: 'Czwartek' },
    { id: 5, label: 'Piątek' },
] as const;
