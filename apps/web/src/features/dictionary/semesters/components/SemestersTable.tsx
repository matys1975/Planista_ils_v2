import { Lock, Unlock, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import type { Semester } from '../types';
import { SemesterStatusBadge } from './SemesterStatusBadge';

interface SemestersTableProps {
    semesters: Semester[];
    isLoading: boolean;
    onEdit?: (semester: Semester) => void;
    onToggleLock?: (id: string, isLocked: boolean) => void;
    onDelete?: (id: string) => void;
}

export function SemestersTable({ semesters, isLoading, onEdit, onToggleLock, onDelete }: SemestersTableProps) {
    const hasActions = !!(onEdit || onToggleLock || onDelete);
    const colSpan = hasActions ? 7 : 6;

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Nazwa</TableHead>
                    <TableHead>Rok</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Okres trwania</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Zawartość (puste do usunięcia)</TableHead>
                    {hasActions && <TableHead className="text-right">Akcje</TableHead>}
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    <TableRow>
                        <TableCell colSpan={colSpan} className="text-center h-24">
                            Ładowanie danych...
                        </TableCell>
                    </TableRow>
                ) : semesters.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={colSpan} className="text-center h-24 text-muted-foreground">
                            Brak zdefiniowanych semestrów.
                        </TableCell>
                    </TableRow>
                ) : (
                    semesters.map((semester) => (
                        <TableRow key={semester.id}>
                            <TableCell className="font-medium">{semester.name}</TableCell>
                            <TableCell>{semester.year}</TableCell>
                            <TableCell className="capitalize">{semester.type}</TableCell>
                            <TableCell>
                                {new Date(semester.dateStart).toLocaleDateString('pl-PL')} -{' '}
                                {new Date(semester.dateEnd).toLocaleDateString('pl-PL')}
                            </TableCell>
                            <TableCell>
                                <SemesterStatusBadge isLocked={semester.isLocked} />
                            </TableCell>
                            <TableCell>
                                <div className="text-xs text-muted-foreground font-mono">
                                    <div>Przedmioty: {semester._count?.courses ?? 0}</div>
                                    <div>Grupy: {semester._count?.groups ?? 0}</div>
                                    <div>Plan: {semester._count?.entries ?? 0}</div>
                                </div>
                            </TableCell>
                            {hasActions && (
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        {onToggleLock && (
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="text-xs"
                                                onClick={() => onToggleLock(semester.id, semester.isLocked)}
                                            >
                                                {semester.isLocked ? 'Odblokuj' : 'Zablokuj'}
                                            </Button>
                                        )}
                                        {onEdit && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => onEdit(semester)}
                                                className="hover:bg-primary/10 hover:text-primary h-8 w-8"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        )}
                                        {onDelete && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => onDelete(semester.id)}
                                                className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            )}
                        </TableRow>
                    ))
                )}
            </TableBody>
        </Table>
    );
}
