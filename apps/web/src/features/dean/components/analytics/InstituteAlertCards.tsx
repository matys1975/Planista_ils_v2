import { useState } from 'react';
import { Building2, AlertTriangle, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { InstituteComparison } from '../../types/analytics.types';

interface Props {
    institutes: InstituteComparison[];
}

export function InstituteAlertCards({ institutes }: Props) {
    // Sortuj: critical > warning > ok
    const sorted = [...institutes].sort((a, b) => {
        const order = { critical: 0, warning: 1, ok: 2 };
        return order[a.alertLevel] - order[b.alertLevel];
    });

    const alertInstitutes = sorted.filter((i) => i.alertLevel !== 'ok');
    const okInstitutes = sorted.filter((i) => i.alertLevel === 'ok');
    const [showOk, setShowOk] = useState(false);

    if (institutes.length === 0) return null;

    return (
        <div className="space-y-4">
            {/* Nagłówek sekcji */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-bold text-primary">
                        Jednostki wymagające uwagi ({alertInstitutes.length})
                    </h3>
                </div>
                {okInstitutes.length > 0 && (
                    <button
                        onClick={() => setShowOk(!showOk)}
                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                    >
                        {showOk ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {showOk ? 'Ukryj OK' : `Pokaż wszystkie (${okInstitutes.length} OK)`}
                    </button>
                )}
            </div>

            {/* Karty z alertami */}
            {alertInstitutes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {alertInstitutes.map((inst) => (
                        <InstituteCard key={inst.id} institute={inst} />
                    ))}
                </div>
            ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center text-sm text-emerald-700">
                    ✅ Wszystkie jednostki mają prawidłowe obciążenia — brak alertów.
                </div>
            )}

            {/* Karty OK (ukryte domyślnie) */}
            {showOk && okInstitutes.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {okInstitutes.map((inst) => (
                        <InstituteCard key={inst.id} institute={inst} />
                    ))}
                </div>
            )}
        </div>
    );
}

function InstituteCard({ institute: inst }: { institute: InstituteComparison }) {
    const [expanded, setExpanded] = useState(false);

    const alertBorder =
        inst.alertLevel === 'critical'
            ? 'border-red-300 bg-red-50/50'
            : inst.alertLevel === 'warning'
                ? 'border-amber-300 bg-amber-50/50'
                : 'border-emerald-200 bg-emerald-50/30';

    const alertBadge =
        inst.alertLevel === 'critical'
            ? 'bg-red-100 text-red-700 border-red-300'
            : inst.alertLevel === 'warning'
                ? 'bg-amber-100 text-amber-700 border-amber-300'
                : 'bg-emerald-100 text-emerald-700 border-emerald-300';

    const totalAlerts = inst.overloadedCount + inst.underloadedCount;

    return (
        <div className={`rounded-xl border-2 p-4 shadow-sm transition-all hover:shadow-md ${alertBorder}`}>
            {/* Nagłówek */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-extrabold text-primary">{inst.shortCode}</span>
                    </div>
                    <div>
                        <p className="text-sm font-bold text-foreground leading-tight">{inst.name}</p>
                        <p className="text-[10px] text-muted-foreground">{inst.teachersCount} prowadzących · {inst.coursesCount} kursów</p>
                    </div>
                </div>
                {totalAlerts > 0 && (
                    <Badge className={`text-[10px] font-bold border ${alertBadge}`}>
                        ⚠️ {totalAlerts}
                    </Badge>
                )}
            </div>

            {/* Metryki */}
            <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center p-2 rounded-lg bg-white/60">
                    <p className="text-lg font-bold text-primary">{inst.avgPensumUtilization}%</p>
                    <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">Pensum</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-white/60">
                    <p className="text-lg font-bold text-red-600">{inst.overloadedCount}</p>
                    <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">Nadgodz.</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-white/60">
                    <p className="text-lg font-bold text-amber-600">{inst.underloadedCount}</p>
                    <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">Niedobór</p>
                </div>
            </div>

            {/* Nieprzypisane kursy */}
            {inst.unassignedCoursesCount > 0 && (
                <div className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded-lg bg-red-100/60 text-red-700">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">{inst.unassignedCoursesCount} nieprzypisanych kursów</span>
                </div>
            )}

            {/* Rozwijana lista prowadzących */}
            {(inst.overloadedTeachers.length > 0 || inst.underloadedTeachers.length > 0) && (
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full text-xs text-muted-foreground hover:text-primary flex items-center justify-center gap-1 pt-2 border-t border-current/10 transition-colors"
                >
                    <Users className="w-3 h-3" />
                    {expanded ? 'Ukryj szczegóły' : 'Pokaż prowadzących'}
                    {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
            )}

            {expanded && (
                <div className="mt-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
                    {inst.overloadedTeachers.length > 0 && (
                        <div>
                            <p className="text-[10px] uppercase font-bold text-red-600 tracking-widest mb-1 flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" /> Nadgodziny
                            </p>
                            <div className="space-y-1">
                                {inst.overloadedTeachers.map((t) => (
                                    <div key={t.id} className="flex justify-between items-center text-xs px-2 py-1 rounded bg-white/60">
                                        <span className="truncate font-medium text-foreground">{t.name}</span>
                                        <span className="font-bold text-red-600 whitespace-nowrap ml-2">+{t.balance}h</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {inst.underloadedTeachers.length > 0 && (
                        <div>
                            <p className="text-[10px] uppercase font-bold text-amber-600 tracking-widest mb-1 flex items-center gap-1">
                                <TrendingDown className="w-3 h-3" /> Niedobór pensum
                            </p>
                            <div className="space-y-1">
                                {inst.underloadedTeachers.map((t) => (
                                    <div key={t.id} className="flex justify-between items-center text-xs px-2 py-1 rounded bg-white/60">
                                        <span className="truncate font-medium text-foreground">{t.name}</span>
                                        <span className="font-bold text-amber-600 whitespace-nowrap ml-2">{t.balance}h</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
