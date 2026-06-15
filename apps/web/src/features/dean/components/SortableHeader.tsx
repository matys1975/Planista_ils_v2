import { ArrowUpDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import type { SortState } from '../types/dean.types';

interface SortableHeaderProps {
    label: string;
    sortKey: string;
    currentSort: SortState;
    onSort: (key: string) => void;
}

export function SortableHeader({ label, sortKey, currentSort, onSort }: SortableHeaderProps) {
    const isActive = currentSort.by === sortKey;
    return (
        <TableHead>
            <button
                onClick={() => onSort(sortKey)}
                className="inline-flex items-center gap-1 hover:text-foreground transition-colors font-semibold"
            >
                {label}
                <ArrowUpDown className={`w-3 h-3 ${isActive ? 'text-[#00ADEF]' : 'text-muted-foreground/30'}`} />
                {isActive && <span className="text-[10px] text-[#00ADEF]">{currentSort.dir === 'asc' ? '▲' : '▼'}</span>}
            </button>
        </TableHead>
    );
}
