import { TrendingUp, AlertTriangle, Users, BookOpen } from 'lucide-react';
import type { SummaryKPIs } from '../../types/analytics.types';

interface Props {
    kpis: SummaryKPIs;
}

export function DashboardKPICards({ kpis }: Props) {
    const utilizationColor =
        kpis.avgPensumUtilization >= 90 && kpis.avgPensumUtilization <= 110
            ? 'text-emerald-600'
            : kpis.avgPensumUtilization > 110
                ? 'text-red-600'
                : 'text-amber-600';

    const utilizationBg =
        kpis.avgPensumUtilization >= 90 && kpis.avgPensumUtilization <= 110
            ? 'bg-emerald-50 border-emerald-200'
            : kpis.avgPensumUtilization > 110
                ? 'bg-red-50 border-red-200'
                : 'bg-amber-50 border-amber-200';

    const cards = [
        {
            label: 'Wypełnienie pensum',
            value: `${kpis.avgPensumUtilization}%`,
            subtitle: `${kpis.totalTeachers} prowadzących łącznie`,
            icon: TrendingUp,
            colorClass: utilizationColor,
            bgClass: utilizationBg,
        },
        {
            label: 'Jednostki z problemami',
            value: `${kpis.problemInstituteCount}/${kpis.instituteCount}`,
            subtitle: 'wymaga uwagi',
            icon: AlertTriangle,
            colorClass:
                kpis.problemInstituteCount === 0 ? 'text-emerald-600' : 'text-red-600',
            bgClass:
                kpis.problemInstituteCount === 0
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-red-50 border-red-200',
        },
        {
            label: 'Prowadzący do uwagi',
            value: String(kpis.overloadedTeachers + kpis.underloadedTeachers),
            subtitle: `${kpis.overloadedTeachers} nadgodz. · ${kpis.underloadedTeachers} niedobór`,
            icon: Users,
            colorClass:
                kpis.overloadedTeachers + kpis.underloadedTeachers === 0
                    ? 'text-emerald-600'
                    : 'text-amber-600',
            bgClass:
                kpis.overloadedTeachers + kpis.underloadedTeachers === 0
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-amber-50 border-amber-200',
        },
        {
            label: 'Nieprzypisane kursy',
            value: String(kpis.unassignedCourses),
            subtitle: 'bez prowadzącego',
            icon: BookOpen,
            colorClass: kpis.unassignedCourses === 0 ? 'text-emerald-600' : 'text-red-600',
            bgClass:
                kpis.unassignedCourses === 0
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-red-50 border-red-200',
        },
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((card) => {
                const Icon = card.icon;
                return (
                    <div
                        key={card.label}
                        className={`rounded-xl border p-5 flex items-start gap-4 shadow-sm transition-all hover:shadow-md ${card.bgClass}`}
                    >
                        <div className={`p-3 rounded-xl bg-white/80 shadow-sm ${card.colorClass}`}>
                            <Icon className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                            <p className={`text-3xl font-extrabold tracking-tight ${card.colorClass}`}>
                                {card.value}
                            </p>
                            <p className="text-[11px] uppercase font-bold text-muted-foreground tracking-widest mt-0.5">
                                {card.label}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
