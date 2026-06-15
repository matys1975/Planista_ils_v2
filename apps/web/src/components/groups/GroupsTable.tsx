import { Pencil, Trash2, CopyPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type { Group } from '../../types/models';

interface GroupsTableProps {
  groups: Group[];
  isLoading: boolean;
  activeMajorTab: string;
  activeYearTab: string;
  onEdit: (group: Group) => void;
  onDelete: (id: string) => void;
  onDuplicate: (group: Group) => void;
}

export function GroupsTable({
  groups,
  isLoading,
  activeMajorTab,
  activeYearTab,
  onEdit,
  onDelete,
  onDuplicate,
}: GroupsTableProps) {
  const filteredGroups = groups.filter((group: any) => {
    if (activeMajorTab !== '' && group.major?.code !== activeMajorTab) return false;
    if (activeYearTab !== 'all' && group.year.toString() !== activeYearTab) return false;
    return true;
  });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nazwa</TableHead>
          <TableHead>Kierunek</TableHead>
          <TableHead>Stopień</TableHead>
          <TableHead>Rok</TableHead>
          <TableHead>Semestr Powiązany</TableHead>
          <TableHead>Liczebność</TableHead>
          <TableHead className="text-right">Akcje</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center h-24">Ładowanie danych...</TableCell>
          </TableRow>
        ) : filteredGroups.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">Brak grup w bazie.</TableCell>
          </TableRow>
        ) : filteredGroups.map((group: any) => (
          <TableRow key={group.id}>
            <TableCell className="font-bold">{group.name}</TableCell>
            <TableCell className="max-w-[200px] truncate" title={group.major?.name || group.majorName}>
              {group.major?.name || group.majorName || '—'}
            </TableCell>
            <TableCell>{group.degree}</TableCell>
            <TableCell>{group.year}</TableCell>
            <TableCell>
               {group.semester ? (
                   <span className="text-xs px-2 py-1 bg-secondary rounded-md whitespace-nowrap">{group.semester.name}</span>
               ) : (
                  <span className="text-destructive text-xs">Brak przydziału</span>
               )}
            </TableCell>
            <TableCell>{group.studentCount || (group as any).size} os.</TableCell>
            <TableCell className="text-right flex gap-1 justify-end">
              <Button variant="ghost" size="icon" onClick={() => onDuplicate(group)} title="Duplikuj" className="hover:bg-status-active-bg hover:text-status-active-fg h-8 w-8">
                <CopyPlus className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onEdit(group)} className="hover:bg-primary/10 hover:text-primary h-8 w-8">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onDelete(group.id)} className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8">
                <Trash2 className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
