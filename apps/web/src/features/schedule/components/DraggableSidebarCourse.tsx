import { GripVertical } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface DraggableSidebarCourseProps {
    course: any;
    alloc: any;
    placementCount?: number;
}

export function DraggableSidebarCourse({ course, alloc, placementCount = 0 }: DraggableSidebarCourseProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `alloc-${alloc.id}`,
        data: { type: 'course_template', course, alloc }
    });

    const style = transform ? {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 50 : 1,
        opacity: isDragging ? 0.6 : 1,
    } : undefined;

    const isPlaced = placementCount > 0;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={`relative flex items-start gap-2 border rounded-lg p-3 text-sm transition-all shadow-sm cursor-grab active:cursor-grabbing hover:border-primary/60 hover:bg-primary/5 hover:shadow-md hover:-translate-y-0.5
        ${isDragging ? 'ring-2 ring-primary border-primary/50 shadow-xl opacity-90' : ''} 
        ${isPlaced ? 'bg-muted/30 border-muted opacity-60 grayscale-[0.5]' : 'bg-card border-border/80'}`}
        >
            <div className="absolute top-2 right-2 z-10 pointer-events-none">
                {isPlaced && <span className="bg-emerald-100 text-status-active-fg text-[9px] font-bold px-1.5 py-0.5 rounded border border-status-active-fg/20 shadow-sm">Na siatce ({placementCount})</span>}
            </div>
            <GripVertical className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isPlaced ? 'text-muted-foreground/40' : 'text-muted-foreground'}`} />
            <div className="flex-1 pr-14">
                <div className={`font-semibold line-clamp-2 leading-tight ${isPlaced ? 'text-foreground/70' : 'text-primary'}`}>{course.name}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 truncate opacity-70">{course.code}</div>
                <div className="text-[10px] text-muted-foreground mt-1 flex gap-2 font-medium">
                    <span className="text-foreground">{alloc.teacher.lastName}</span>
                    <span className={`px-1 rounded font-bold ${(alloc.classType || course.type) === 'W' ? 'bg-status-info-bg0/20 text-navy-dark' :
                        (alloc.classType || course.type) === 'C' ? 'bg-status-warning-bg0/20 text-status-warning-fg' :
                            (alloc.classType || course.type) === 'L' ? 'bg-status-active-bg0/20 text-status-active-fg' :
                                (alloc.classType || course.type) === 'S' ? 'bg-purple-500/20 text-purple-700' :
                                    'bg-muted text-muted-foreground'
                        }`}>{alloc.classType || course.type}</span>
                    {course.studySemester && <span>Sem. {course.studySemester}</span>}
                </div>
                {alloc.groups?.length > 0 && (
                    <div className="mt-1 flex gap-1 flex-wrap">
                        {alloc.groups.map((g: any) => (
                            <span key={g.groupId} className="text-[9px] bg-muted/60 border px-1 rounded">{g.group.name}</span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
