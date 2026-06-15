import { Building2, GraduationCap, Users, BookOpen, FolderTree, DoorOpen, ClipboardList } from 'lucide-react';
import type { DeanDashboardCounts } from '../types/dean.types';

const CARD_META = [
    { key: 'institutesCount' as keyof DeanDashboardCounts, label: 'Jednostki', icon: Building2, color: '#003366' },
    { key: 'teachersCount' as keyof DeanDashboardCounts, label: 'Prowadzący', icon: GraduationCap, color: '#00ADEF' },
    { key: 'coursesCount' as keyof DeanDashboardCounts, label: 'Przedmioty', icon: BookOpen, color: '#059669' },
    { key: 'usersCount' as keyof DeanDashboardCounts, label: 'Użytkownicy', icon: Users, color: '#d97706' },
    { key: 'allocationsCount' as keyof DeanDashboardCounts, label: 'Przydziały', icon: ClipboardList, color: '#7c3aed' },
    { key: 'majorsCount' as keyof DeanDashboardCounts, label: 'Kierunki', icon: FolderTree, color: '#db2777' },
    { key: 'groupsCount' as keyof DeanDashboardCounts, label: 'Grupy', icon: Users, color: '#2563eb' },
    { key: 'roomsCount' as keyof DeanDashboardCounts, label: 'Sale', icon: DoorOpen, color: '#0891b2' },
];

interface DeanStatsCardsProps {
    counts: DeanDashboardCounts;
}

export function DeanStatsCards({ counts }: DeanStatsCardsProps) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {CARD_META.map((card) => {
                const Icon = card.icon;
                const value = counts[card.key];
                return (
                    <div
                        key={card.key}
                        className="bg-white rounded-xl border p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-all"
                    >
                        <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${card.color}10`, color: card.color }}>
                            <Icon className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xl font-bold tracking-tight">{value}</p>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                                {card.label}
                            </p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
