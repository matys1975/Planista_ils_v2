import { Plus, AlertTriangle } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { DraggableEntryCard } from './DraggableEntryCard';
import { doWeeksOverlap } from '../utils';

interface DroppableSlotCellProps {
    dayId: number;
    slot: { id: number; start: string; end: string };
    entries: any[];
    onAddClick: (dayId: number, slot: { id: number; start: string; end: string }) => void;
    onDelete: (id: string) => void;
    onEdit: (entry: any) => void;
    viewMode: 'major' | 'room' | 'teacher';
}

export function DroppableSlotCell({ dayId, slot, entries, onAddClick, onDelete, onEdit, viewMode }: DroppableSlotCellProps) {
    const cellId = `${dayId}-${slot.start}-${slot.end}`;
    const { isOver, setNodeRef } = useDroppable({
        id: cellId,
        data: { dayOfWeek: dayId, startTime: slot.start, endTime: slot.end }
    });

    const hasCollision = viewMode === 'room' && entries.some((e1: any, i: number) =>
        entries.some((e2: any, j: number) => i !== j && doWeeksOverlap(e1.weekType, e2.weekType))
    );

    return (
        <td
            ref={setNodeRef}
            className={`border p-2 border-border/60 align-top relative group min-h-[140px] h-[140px] transition-colors print:min-h-0 print:h-auto print:p-0.5 print:align-middle ${isOver ? 'bg-primary/5 border-primary/50' : ''} ${hasCollision ? 'ring-4 ring-inset ring-destructive bg-destructive/10' : ''}`}
        >
            {hasCollision && (
                <div className="absolute top-1 right-1 bg-destructive text-white rounded-full p-1 shadow-sm z-20 print:hidden" title="Kolizja! Zajęcia nakładają się w tym samym tygodniu">
                    <AlertTriangle className="w-3 h-3" />
                </div>
            )}
            <div className="flex flex-col gap-2 h-full absolute inset-0 p-1 overflow-y-auto print:static print:h-auto print:gap-0.5 print:overflow-visible">
                {entries.map((entry: any) => (
                    <DraggableEntryCard key={entry.id} entry={entry} onDelete={onDelete} onEdit={onEdit} />
                ))}

                <button
                    className="w-full flex-1 min-h-[50px] opacity-0 group-hover:opacity-100 border-2 border-dashed border-primary/40 rounded-lg flex items-center justify-center text-primary/80 hover:bg-primary/5 transition-all text-sm font-medium print:hidden"
                    onClick={() => onAddClick(dayId, slot)}
                >
                    <Plus className="w-5 h-5" />
                </button>
            </div>
        </td>
    );
}
