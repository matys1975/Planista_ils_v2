import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, Plus, Trash2, Pencil, AlertTriangle, Calendar, Clock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuthStore } from '../store/auth';
import { fetchApi } from '../lib/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { fetchRooms, createRoom, updateRoom, deleteRoom, type RoomDeleteConflict } from '@/features/dictionary/rooms/api';
import { roomSchema, type RoomFormData } from '@/features/dictionary/rooms/schema';
import type { Room } from '../types/models';

const DAY_NAMES: Record<number, string> = { 1: 'Poniedziałek', 2: 'Wtorek', 3: 'Środa', 4: 'Czwartek', 5: 'Piątek', 6: 'Sobota', 7: 'Niedziela' };

interface DictionaryRoomsProps {
  hideHeader?: boolean;
  filterInstituteId?: string;
}

export function DictionaryRooms({ hideHeader = false, filterInstituteId }: DictionaryRoomsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [deleteConflict, setDeleteConflict] = useState<{ room: Room; conflict: RoomDeleteConflict } | null>(null);
  const queryClient = useQueryClient();
  const { role } = useAuthStore();

  const { data: roomsData, isLoading } = useQuery({
    queryKey: ['rooms'],
    queryFn: fetchRooms
  });

  const isDeanOrSuperAdmin = role === 'DEAN' || role === 'SUPER_ADMIN';

  const { data: institutesData } = useQuery({
    queryKey: ['institutes'],
    queryFn: () => fetchApi('/institutes'),
    enabled: isDeanOrSuperAdmin,
  });

  const institutes = institutesData?.data || [];

  const rooms = filterInstituteId
    ? (roomsData?.data || []).filter((r: any) => r.instituteId === filterInstituteId)
    : (roomsData?.data || []);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<RoomFormData>({
    resolver: zodResolver(roomSchema),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['rooms'] });
    queryClient.invalidateQueries({ queryKey: ['dictionaries'] });
    queryClient.invalidateQueries({ queryKey: ['entries'] });
  };

  const createMutation = useMutation({
    mutationFn: createRoom,
    onSuccess: () => { invalidate(); setIsDialogOpen(false); toast.success('Dodano salę'); },
    onError: (err: any) => toast.error(err.message || 'Błąd dodawania'),
  });

  const updateMutation = useMutation({
    mutationFn: updateRoom,
    onSuccess: () => { invalidate(); setIsDialogOpen(false); setEditingRoom(null); toast.success('Zapisano zmiany'); },
    onError: (err: any) => toast.error(err.message || 'Błąd zapisu'),
  });

  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteRoom = async (room: Room) => {
    setIsDeleting(true);
    try {
      const result = await deleteRoom(room.id, false);
      if ('conflict' in result) {
        // Show conflict dialog
        setDeleteConflict({ room, conflict: result.data });
      } else {
        invalidate();
        toast.success('Salę usunięto');
      }
    } catch (err: any) {
      toast.error(err.message || 'Błąd usuwania');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleForceDelete = async () => {
    if (!deleteConflict) return;
    setIsDeleting(true);
    try {
      const result = await deleteRoom(deleteConflict.room.id, true);
      if ('success' in result) {
        invalidate();
        toast.success(`Usunięto salę i ${result.deletedEntries} wpisów z planu`);
        setDeleteConflict(null);
      }
    } catch (err: any) {
      toast.error(err.message || 'Błąd usuwania');
    } finally {
      setIsDeleting(false);
    }
  };

  const onSubmit = (data: RoomFormData) => {
    if (editingRoom) {
      updateMutation.mutate({ ...data, id: editingRoom.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleOpenEdit = (room: Room) => {
    setEditingRoom(room);
    reset({
      building: room.building,
      number: room.number,
      capacity: room.capacity,
      type: room.type,
      instituteId: room.instituteId || '',
    });
    setIsDialogOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingRoom(null);
    reset({
      building: '',
      number: '',
      capacity: 0,
      type: '',
      instituteId: filterInstituteId || '',
    });
    setIsDialogOpen(true);
  };

  return (
    <div className={hideHeader ? "space-y-4" : "space-y-4 p-4 sm:p-6 animate-in fade-in duration-500"}>
      {!hideHeader && (
        <div className="flex justify-between items-center bg-card px-4 py-3 rounded-xl border border-border/50 shadow-sm gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary rounded-lg shadow-lg">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">Sale wykładowe</h1>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-widest leading-none mt-1">Zarządzaj zasobami lokalowymi</p>
            </div>
          </div>

          <Button size="sm" className="h-8 text-xs font-bold px-4 gap-1.5 bg-primary hover:bg-primary/90 shadow-md shadow-primary/10" onClick={handleOpenCreate}>
            <Plus className="h-3.5 w-3.5" /> Dodaj salę
          </Button>
        </div>
      )}

      {hideHeader && (
        <div className="flex justify-between items-center px-4 py-2 bg-muted/10 border-b rounded-t-xl">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-black uppercase tracking-wider">Sale</span>
          </div>
          <Button size="sm" className="h-7 text-[10px] font-black px-3 gap-1 bg-primary" onClick={handleOpenCreate}>
            <Plus className="h-3.5 w-3.5" /> DODAJ SALĘ
          </Button>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(v) => { if (!v) { setIsDialogOpen(false); setEditingRoom(null); } }}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">{editingRoom ? 'Edytuj salę' : 'Dodaj nową salę'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="building" className="text-xs font-bold uppercase tracking-wider">Budynek</Label>
                <Input id="building" placeholder="np. A-1" {...register('building')} className="h-9 text-sm" />
                {errors.building && <p className="text-[10px] text-destructive font-bold">{errors.building.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="number" className="text-xs font-bold uppercase tracking-wider">Numer</Label>
                <Input id="number" placeholder="np. 012" {...register('number')} className="h-9 text-sm" />
                {errors.number && <p className="text-[10px] text-destructive font-bold">{errors.number.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="capacity" className="text-xs font-bold uppercase tracking-wider">Pojemność</Label>
                <Input id="capacity" type="number" placeholder="np. 30" {...register('capacity')} className="h-9 text-sm" />
                {errors.capacity && <p className="text-[10px] text-destructive font-bold">{errors.capacity.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="type" className="text-xs font-bold uppercase tracking-wider">Typ (W/C/L)</Label>
                <Input id="type" placeholder="np. L" {...register('type')} className="h-9 text-sm" />
                {errors.type && <p className="text-[10px] text-destructive font-bold">{errors.type.message}</p>}
              </div>
            </div>
            {isDeanOrSuperAdmin && (
              <div className="space-y-2">
                <Label htmlFor="instituteId" className="text-xs font-bold uppercase tracking-wider">Jednostka (Instytut)</Label>
                <select
                  id="instituteId"
                  className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  {...register('instituteId')}
                >
                  <option value="">Wybierz jednostkę...</option>
                  {institutes.map((inst: any) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.shortCode ? `${inst.shortCode} — ${inst.name}` : inst.name}
                    </option>
                  ))}
                </select>
                {errors.instituteId && <p className="text-[10px] text-destructive font-bold">{errors.instituteId.message}</p>}
              </div>
            )}
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="w-full bg-primary hover:bg-primary/90 h-10 font-bold">
              {editingRoom ? 'Zapisz zmiany' : 'Dodaj salę'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Force Delete Warning Dialog */}
      <Dialog open={!!deleteConflict} onOpenChange={(v) => { if (!v) setDeleteConflict(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Sala jest używana w planie
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground pt-1">
              Sala <strong className="text-foreground">{deleteConflict?.room.building} {deleteConflict?.room.number}</strong> jest
              przypisana do <strong className="text-foreground">{deleteConflict?.conflict.entriesCount}</strong> wpisów
              w planie zajęć. Usunięcie sali spowoduje jednoczesne usunięcie tych wpisów.
            </DialogDescription>
          </DialogHeader>

          {/* Entries list */}
          {deleteConflict && deleteConflict.conflict.entries.length > 0 && (
            <div className="max-h-52 overflow-y-auto rounded-lg border border-border/50 bg-muted/30">
              <div className="divide-y divide-border/30">
                {deleteConflict.conflict.entries.map((entry, i) => (
                  <div key={entry.id} className="px-3 py-2 text-xs space-y-0.5">
                    <div className="font-bold text-foreground">{entry.course}</div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {entry.teacher}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {DAY_NAMES[entry.day] || `Dzień ${entry.day}`}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {entry.time}
                      </span>
                    </div>
                    <div className="text-muted-foreground/70 text-[10px]">{entry.semester}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setDeleteConflict(null)}
              className="flex-1"
              disabled={isDeleting}
            >
              Anuluj
            </Button>
            <Button
              variant="destructive"
              onClick={handleForceDelete}
              disabled={isDeleting}
              className="flex-1 gap-1.5 font-bold"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {isDeleting ? 'Usuwanie...' : `Usuń salę i ${deleteConflict?.conflict.entriesCount} wpisów`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-cream">
            <TableRow>
              <TableHead className="py-2 text-[10px] font-black uppercase tracking-widest">Budynek</TableHead>
              <TableHead className="py-2 text-[10px] font-black uppercase tracking-widest">Numer sali</TableHead>
              <TableHead className="py-2 text-[10px] font-black uppercase tracking-widest">Pojemność</TableHead>
              <TableHead className="py-2 text-[10px] font-black uppercase tracking-widest">Typ</TableHead>
              <TableHead className="py-2 text-[10px] font-black uppercase tracking-widest">Jednostka</TableHead>
              <TableHead className="py-2 text-[10px] font-black uppercase tracking-widest text-center">Plan</TableHead>
              <TableHead className="text-right py-2 text-[10px] font-black uppercase tracking-widest">Akcje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24 text-sm text-muted-foreground animate-pulse">Ładowanie danych...</TableCell>
              </TableRow>
            ) : rooms.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24 text-sm text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Building2 className="h-8 w-8 text-white" />
                    <span>Brak sal w bazie danych.</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rooms.map((room: any) => {
                const entriesCount = room._count?.entries || 0;
                return (
                  <TableRow key={room.id} className="hover:bg-cream transition-colors">
                    <TableCell className="font-bold text-primary py-2 text-sm">{room.building}</TableCell>
                    <TableCell className="py-2 text-sm font-medium">{room.number}</TableCell>
                    <TableCell className="py-2 text-sm">{room.capacity}</TableCell>
                    <TableCell className="py-2">
                      <span className="px-2 py-0.5 bg-cream-dark text-navy-dark rounded text-[10px] font-bold border border-warm-border uppercase">
                        {room.type}
                      </span>
                    </TableCell>
                    <TableCell className="py-2">
                      {room.institute ? (
                        <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded">
                          {room.institute.shortCode || room.institute.name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Nieprzypisana</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-center">
                      {entriesCount > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px] font-bold border border-amber-200" title={`${entriesCount} wpisów w planie`}>
                          <Calendar className="h-3 w-3" />
                          {entriesCount}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right flex gap-1 justify-end py-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(room)}
                        className="hover:bg-primary/5 hover:text-primary h-7 w-7 transition-all"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteRoom(room)}
                        disabled={isDeleting}
                        className="text-red-400 hover:bg-status-danger-bg hover:text-status-danger-fg h-7 w-7 transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
