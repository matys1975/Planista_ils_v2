import { Lock, Unlock } from 'lucide-react';

interface SemesterStatusBadgeProps {
    isLocked: boolean;
}

export function SemesterStatusBadge({ isLocked }: SemesterStatusBadgeProps) {
    if (isLocked) {
        return (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-destructive/10 text-destructive rounded-md text-xs font-semibold">
                <Lock className="w-3 h-3" /> Zablokowany
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-status-active-bg text-status-active-fg rounded-md text-xs font-semibold">
            <Unlock className="w-3 h-3" /> Aktywny / Otwarty
        </span>
    );
}
