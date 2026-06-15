import { Pencil, Trash2 } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface DraggableEntryCardProps {
    entry: any;
    onDelete: (id: string) => void;
    onEdit: (entry: any) => void;
}

export function DraggableEntryCard({ entry, onDelete, onEdit }: DraggableEntryCardProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: entry.id,
        data: { entry }
    });

    const style = transform ? {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 50 : 1,
        opacity: isDragging ? 0.8 : 1,
    } : undefined;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={`relative bg-primary/10 border border-primary/30 rounded-lg p-2 text-xs hover:border-primary hover:shadow-md transition-all shadow-sm cursor-grab active:cursor-grabbing backdrop-blur-sm print:p-1 print:border-none print:border-l-2 print:border-l-primary print:bg-transparent print:shadow-none print:rounded-none print:break-inside-avoid ${isDragging ? 'ring-2 ring-primary shadow-xl opacity-90 scale-105 z-50' : ''}`}
        >
            <div className="absolute top-1 right-1 flex gap-0.5 z-10 print:hidden">
                <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onEdit(entry); }}
                    className="text-primary/50 hover:text-primary hover:bg-primary/10 transition-colors bg-white rounded-md p-0.5"
                    title="Edytuj"
                >
                    <Pencil className="w-3 h-3" />
                </button>
                <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
                    className="text-destructive/50 hover:text-destructive hover:bg-destructive/10 transition-colors bg-white rounded-md p-0.5"
                    title="Usuń"
                >
                    <Trash2 className="w-3 h-3" />
                </button>
            </div>
            <div className="font-bold text-primary text-[13px] line-clamp-1 mb-1 pr-10 print:text-[10px] print:pr-0 print:mb-0 print:leading-tight">{entry.course.name}</div>
            <div className="flex justify-between items-center text-[10px] print:text-[8px] print:mt-0.5">
                <div className="flex items-center gap-1.5">
                    <span className={`font-bold px-1 py-0.5 rounded text-[9px] ${(entry.effectiveType || entry.course.type) === 'W' ? 'bg-status-info-bg0/20 text-navy-dark' :
                        (entry.effectiveType || entry.course.type) === 'C' ? 'bg-status-warning-bg0/20 text-status-warning-fg' :
                            (entry.effectiveType || entry.course.type) === 'L' ? 'bg-status-active-bg0/20 text-status-active-fg' :
                                (entry.effectiveType || entry.course.type) === 'S' ? 'bg-purple-500/20 text-purple-700' :
                                    (entry.effectiveType || entry.course.type) === 'K' ? 'bg-cyan-500/20 text-cyan-700' :
                                        'bg-muted text-muted-foreground'
                        }`}>{entry.effectiveType || entry.course.type}</span>
                    <span className="font-semibold text-foreground print:text-foreground/80">{entry.teacher.lastName}</span>
                </div>
                <span className="bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-bold print:bg-transparent print:text-foreground print:p-0 print:font-bold">{entry.room.number}</span>
            </div>
            <div className="mt-1 flex gap-1 flex-wrap print:mt-0.5">
                {entry.groups.map((g: any) => (
                    <span key={g.id} className="bg-muted px-1 rounded text-[9px] border shadow-sm print:shadow-none print:bg-transparent print:border-border/50 print:text-[7px]">{g.name}</span>
                ))}
                {entry.weekType !== 'AB' && (
                    <span className="bg-orange-100 text-orange-800 px-1 rounded text-[9px] font-bold border border-orange-200 shadow-sm shadow-orange-100 print:shadow-none print:text-[7px]">Tydz. {entry.weekType}</span>
                )}
            </div>
        </div>
    );
}
