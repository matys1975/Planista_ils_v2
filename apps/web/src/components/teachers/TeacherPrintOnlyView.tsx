interface TeacherPrintOnlyViewProps {
    teacher: any;
}

/**
 * Komponent renderujący widok drukowalny Karty Obciążeń Dydaktycznych (Przydziały).
 * Widoczny tylko w trybie drukowania `@media print`.
 */
export function TeacherPrintOnlyView({ teacher }: TeacherPrintOnlyViewProps) {
    const allocations = teacher.allocations ?? [];
    const totalHours = allocations.reduce((sum: number, a: any) => sum + (a.assignedHours || 0), 0);
    const pensumLimit = teacher.pensumLimit || 210;
    const isOver = totalHours > pensumLimit;
    const remaining = pensumLimit - totalHours;

    // Grupowanie przydziałów po semestrze
    const groups = allocations.reduce((acc: any[], alloc: any) => {
        const sem = alloc.course?.semester;
        const semId = sem?.id || 'none';
        let group = acc.find((g: any) => g.semId === semId);
        if (!group) {
            group = {
                semId,
                semName: sem?.name || 'Bez semestru',
                semYear: sem?.year || 0,
                semNameRaw: (sem?.name || '').toLowerCase(),
                items: [],
            };
            acc.push(group);
        }
        group.items.push(alloc);
        return acc;
    }, []);

    // Sortowanie: rok rosnąco, w ramach roku zimowy przed letnim
    groups.sort((a: any, b: any) => {
        if (a.semYear !== b.semYear) return a.semYear - b.semYear;
        const aWinter = a.semNameRaw.includes('zim');
        const bWinter = b.semNameRaw.includes('zim');
        if (aWinter !== bWinter) return aWinter ? -1 : 1;
        return a.semName.localeCompare(b.semName);
    });

    return (
        <>
            <style>{`
        @page { size: landscape; margin: 10mm; }
        @media print {
          body { 
            background: white !important; 
            overflow: visible !important; 
            height: auto !important; 
          }
          /* Hide main app UI, show only print area */
          .main-ui { display: none !important; }
          .print-only-container { 
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
          th, td { border: 1px solid #ccc; padding: 6px; text-align: left; font-size: 11px; }
          th { background-color: #f3f4f6; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
        }
        @media screen {
          .print-only-container { display: none !important; }
        }
      `}</style>
            <div className="print-only-container bg-white text-black">
                <div className="text-center space-y-1 mb-6 border-b-2 border-black pb-4">
                    <h1 className="text-xl font-bold uppercase">Uniwersytet im. Adama Mickiewicza w Poznaniu</h1>
                    <h2 className="text-lg font-semibold">{teacher.unit || 'Instytut Lingwistyki Stosowanej'}</h2>
                    <h3 className="text-md mt-4 font-medium uppercase tracking-wider">Wstępna Karta Obciążeń Dydaktycznych (Przydziały)</h3>
                </div>

                <div className="flex justify-between mb-6 text-sm border border-gray-300 p-4 bg-gray-50">
                    <div>
                        <span className="text-gray-600 block text-xs">Prowadzący:</span>
                        <strong className="text-lg">{teacher.title} {teacher.firstName} {teacher.lastName}</strong>
                    </div>
                    <div className="text-right">
                        <span className="text-gray-600 block text-xs">Pensum Limit:</span>
                        <strong className="text-lg">{pensumLimit} godz.</strong>
                    </div>
                </div>

                {allocations.length === 0 ? (
                    <div className="text-center py-4 text-gray-500 text-sm">Brak przydzielonych przedmiotów.</div>
                ) : (
                    groups.map((group: any) => {
                        const groupTotal = group.items.reduce((sum: number, a: any) => sum + (a.assignedHours || 0), 0);
                        return (
                            <div key={group.semId} className="mb-6">
                                <h4 className="text-sm font-bold mb-2 uppercase tracking-wide">{group.semName}</h4>
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-gray-100">
                                            <th className="w-10 text-center">Lp.</th>
                                            <th>Przedmiot</th>
                                            <th className="w-16 text-center">Typ</th>
                                            <th>Grupy</th>
                                            <th className="w-20 text-right">Godziny</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {group.items.map((alloc: any, i: number) => {
                                            const groupsStr = alloc.groups?.map((g: any) => g.group?.name).join(', ') || '-';
                                            return (
                                                <tr key={alloc.id}>
                                                    <td className="text-center">{i + 1}</td>
                                                    <td className="font-medium">{alloc.course?.name} <span className="text-[10px] text-gray-500 ml-1">({alloc.course?.code})</span></td>
                                                    <td className="text-center font-bold">{alloc.classType || alloc.course?.type}</td>
                                                    <td>{groupsStr}</td>
                                                    <td className="text-right font-bold">{alloc.assignedHours || 0}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-gray-100 font-bold border-t-2 border-black">
                                            <td colSpan={4} className="text-right">Suma godzin:</td>
                                            <td className="text-right">{groupTotal}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        );
                    })
                )}

                <div className="mt-8 flex justify-end">
                    <div className="border border-black p-4 w-64 bg-gray-50 text-sm">
                        <h4 className="text-xs text-gray-600 mb-1">Status przydziału:</h4>
                        <div className="flex justify-between font-bold">
                            <span>{isOver ? 'Nadwyżka:' : 'Do dopracowania:'}</span>
                            <span className={isOver ? 'text-status-danger-fg' : 'text-green-600'}>
                                {isOver ? `+${Math.abs(remaining)}h` : `${remaining}h`}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
