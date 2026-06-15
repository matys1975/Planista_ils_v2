import React from 'react';

const timeSlots = [
    { id: 1, start: '08:00', end: '09:30' },
    { id: 2, start: '09:45', end: '11:15' },
    { id: 3, start: '11:30', end: '13:00' },
    { id: 4, start: '13:15', end: '14:45' },
    { id: 5, start: '15:00', end: '16:30' },
    { id: 6, start: '16:45', end: '18:15' },
    { id: 7, start: '18:30', end: '20:00' },
];

const days = [
    { id: 1, label: 'Poniedziałek' },
    { id: 2, label: 'Wtorek' },
    { id: 3, label: 'Środa' },
    { id: 4, label: 'Czwartek' },
    { id: 5, label: 'Piątek' },
];

interface TeacherSchedulePrintViewProps {
    teacher: any;
}

export function TeacherSchedulePrintView({ teacher }: TeacherSchedulePrintViewProps) {
    const entries = teacher.entries ?? [];

    return (
        <>
            <style>{`
        @page { size: landscape; margin: 10mm; }
        @media print {
          body { background: white !important; overflow: visible !important; height: auto !important; }
          .main-ui { display: none !important; }
          .print-schedule-container { 
            display: block !important; 
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            z-index: 99999 !important;
            background: white !important;
            color: black !important; 
            padding: 10mm !important; 
            margin: 0 !important; 
            font-family: sans-serif; 
            overflow: visible !important;
          }
          table { page-break-inside: auto; width: 100%; border-collapse: collapse; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          th, td { border: 1px solid #ccc; padding: 6px; text-align: left; font-size: 11px; vertical-align: top; }
          th { background-color: #f3f4f6; text-align: center; }
          thead { display: table-header-group; }
        }
        @media screen {
          .print-schedule-container { display: none !important; }
        }
      `}</style>
            <div className="print-schedule-container bg-white text-black">
                <div className="text-center space-y-1 mb-6 border-b-2 border-black pb-4">
                    <h1 className="text-xl font-bold uppercase">Uniwersytet im. Adama Mickiewicza w Poznaniu</h1>
                    <h2 className="text-lg font-semibold">{teacher.unit || 'Instytut Lingwistyki Stosowanej'}</h2>
                    <h3 className="text-md mt-4 font-medium uppercase tracking-wider">Plan Zajęć Prowadzącego</h3>
                </div>

                <div className="flex justify-between mb-6 text-sm border border-gray-300 p-4 bg-gray-50">
                    <div>
                        <span className="text-gray-600 block text-xs">Prowadzący:</span>
                        <strong className="text-lg">{teacher.title} {teacher.firstName} {teacher.lastName}</strong>
                    </div>
                    <div className="text-right">
                        <span className="text-gray-600 block text-xs">Semestr:</span>
                        <strong className="text-lg">
                            {entries.length > 0 && entries[0].semester?.name ? entries[0].semester.name : '—'}
                        </strong>
                    </div>
                </div>

                <table className="w-full text-left text-xs border-collapse">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="w-20 text-center">Godzina</th>
                            {days.map(day => (
                                <th key={day.id} className="text-center">{day.label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {timeSlots.map(slot => (
                            <tr key={slot.id}>
                                <td className="text-center font-semibold text-[10px]">
                                    <div>{slot.start}</div>
                                    <div className="text-gray-400">-</div>
                                    <div>{slot.end}</div>
                                </td>
                                {days.map(day => {
                                    const slotEntries = entries.filter(
                                        (e: any) => e.dayOfWeek === day.id && e.startTime === slot.start
                                    );
                                    return (
                                        <td key={`${day.id}-${slot.id}`} className="align-top min-h-[60px]">
                                            {slotEntries.length === 0 ? (
                                                <span className="text-gray-300">—</span>
                                            ) : (
                                                <div className="flex flex-col gap-1.5">
                                                    {slotEntries.map((entry: any) => (
                                                        <div key={entry.id} className="border border-gray-200 rounded p-1.5 bg-gray-50">
                                                            <div className="font-bold text-[11px] leading-tight">{entry.course?.name || '—'}</div>
                                                            <div className="flex items-center gap-1 mt-0.5">
                                                                <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${(entry.classType || entry.course?.type) === 'W' ? 'bg-status-info-bg text-navy-dark' :
                                                                    (entry.classType || entry.course?.type) === 'C' ? 'bg-amber-100 text-status-warning-fg' :
                                                                        (entry.classType || entry.course?.type) === 'L' ? 'bg-emerald-100 text-status-active-fg' :
                                                                            (entry.classType || entry.course?.type) === 'S' ? 'bg-purple-100 text-purple-700' :
                                                                                'bg-gray-100 text-gray-600'
                                                                    }`}>
                                                                    {entry.classType || entry.course?.type}
                                                                </span>
                                                                {entry.weekType !== 'AB' && (
                                                                    <span className="text-[8px] font-bold text-orange-700 bg-orange-100 px-1 py-0.5 rounded">Tydz. {entry.weekType}</span>
                                                                )}
                                                            </div>
                                                            <div className="text-[9px] text-gray-600 mt-0.5">
                                                                <span className="font-semibold">Sala:</span> {entry.room?.building}-{entry.room?.number}
                                                            </div>
                                                            {entry.groups && entry.groups.length > 0 && (
                                                                <div className="text-[9px] text-gray-500 mt-0.5">
                                                                    <span className="font-semibold">Grupy:</span> {entry.groups.map((g: any) => g.group?.name || g.name).join(', ')}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>

                {entries.length === 0 && (
                    <div className="text-center text-gray-500 mt-8 text-sm">Brak zaplanowanych zajęć dla tego prowadzącego.</div>
                )}
            </div>
        </>
    );
}
