import { useState } from 'react';
import { Search, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDeanInstitutes } from '../hooks/useDeanInstitutes';
import { SortableHeader } from './SortableHeader';
import { InstituteAdminsDrawer } from './InstituteAdminsDrawer';
import type { SortState, DeanInstitute } from '../types/dean.types';

export function DeanInstitutesTable() {
    const [sort, setSort] = useState<SortState>({ by: 'name', dir: 'asc' });
    const [search, setSearch] = useState('');
    const [drawerInstitute, setDrawerInstitute] = useState<DeanInstitute | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);

    const { data, isLoading } = useDeanInstitutes({
        sortBy: sort.by,
        sortDir: sort.dir,
        search: search || undefined,
    });

    const institutes = data?.data || [];

    function handleSort(key: string) {
        setSort((prev) => ({
            by: key,
            dir: prev.by === key && prev.dir === 'asc' ? 'desc' : 'asc',
        }));
    }

    function openDrawer(institute: DeanInstitute) {
        setDrawerInstitute(institute);
        setDrawerOpen(true);
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <div className="relative flex-1 sm:flex-initial">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Szukaj jednostki..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 h-8 text-sm w-full sm:w-72"
                    />
                </div>
            </div>

            <div className="rounded-lg border bg-white overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-cream">
                            <SortableHeader label="Nazwa" sortKey="name" currentSort={sort} onSort={handleSort} />
                            <SortableHeader label="Kod" sortKey="shortCode" currentSort={sort} onSort={handleSort} />
                            <SortableHeader label="Prowadzący" sortKey="teachers" currentSort={sort} onSort={handleSort} />
                            <SortableHeader label="Kierunki" sortKey="majors" currentSort={sort} onSort={handleSort} />
                            <SortableHeader label="Przedmioty" sortKey="courses" currentSort={sort} onSort={handleSort} />
                            <SortableHeader label="Grupy" sortKey="groups" currentSort={sort} onSort={handleSort} />
                            <SortableHeader label="Użytkownicy" sortKey="users" currentSort={sort} onSort={handleSort} />
                            <SortableHeader label="Sale" sortKey="rooms" currentSort={sort} onSort={handleSort} />
                            <TableHead className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Admini</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                                    Ładowanie...
                                </TableCell>
                            </TableRow>
                        ) : institutes.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                                    Brak jednostek do wyświetlenia.
                                </TableCell>
                            </TableRow>
                        ) : (
                            institutes.map((i: DeanInstitute) => (
                                <TableRow key={i.id} className="cursor-pointer hover:bg-cream/80" onClick={() => openDrawer(i)}>
                                    <TableCell className="font-medium">{i.name}</TableCell>
                                    <TableCell>{i.shortCode || '—'}</TableCell>
                                    <TableCell>{i._count.teachers}</TableCell>
                                    <TableCell>{i._count.majors}</TableCell>
                                    <TableCell>{i._count.courses}</TableCell>
                                    <TableCell>{i._count.groups}</TableCell>
                                    <TableCell>{i._count.users}</TableCell>
                                    <TableCell>{i._count.rooms}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5">
                                            {(i.adminCount || 0) === 0 ? (
                                                <Badge variant="destructive" className="text-[10px] gap-1">
                                                    <ShieldAlert className="w-3 h-3" />
                                                    Brak
                                                </Badge>
                                            ) : (i.adminCount || 0) === 1 ? (
                                                <Badge variant="default" className="bg-emerald-600 text-[10px] gap-1">
                                                    <ShieldCheck className="w-3 h-3" />
                                                    1
                                                </Badge>
                                            ) : (
                                                <Badge variant="default" className="bg-emerald-600 text-[10px] gap-1">
                                                    <Users className="w-3 h-3" />
                                                    {i.adminCount}
                                                </Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <InstituteAdminsDrawer
                institute={drawerInstitute}
                isOpen={drawerOpen}
                onClose={() => setDrawerOpen(false)}
            />
        </div>
    );
}
