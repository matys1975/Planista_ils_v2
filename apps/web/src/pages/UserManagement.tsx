import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Shield, Trash2, Pencil, UserPlus, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useAuthStore } from '../store/auth';

const userSchema = z.object({
  email: z.string().email('Nieprawidłowy adres e-mail'),
  name: z.string().min(1, 'Imię i nazwisko jest wymagane'),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'PLANNER', 'VIEWER']),
  instituteId: z.string().uuid().optional().or(z.literal('')),
  password: z.string().min(6, 'Hasło musi mieć min. 6 znaków').optional().or(z.literal('')),
  newPassword: z.string().min(6, 'Hasło musi mieć min. 6 znaków').optional().or(z.literal('')),
});

type UserFormData = z.infer<typeof userSchema>;

const roleBadge = (role: string) => {
  const colors: Record<string, string> = {
    SUPER_ADMIN: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
    ADMIN: 'bg-status-danger-bg text-status-danger-fg border-status-danger-fg/20',
    PLANNER: 'bg-navy-mid/10 text-navy-mid border-navy-mid/20',
    VIEWER: 'bg-cream0/10 text-navy-dark border-slate-500/20',
  };
  const labels: Record<string, string> = {
    SUPER_ADMIN: 'SuperAdmin',
    ADMIN: 'Administrator',
    PLANNER: 'Planista',
    VIEWER: 'Przeglądający',
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${colors[role] || ''}`}>
      {labels[role] || role}
    </span>
  );
};

import { fetchApi } from '../lib/api';

export function UserManagement() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const queryClient = useQueryClient();

  const currentRole = useAuthStore((s) => s.role);
  const isSuperAdmin = currentRole === 'SUPER_ADMIN';

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => fetchApi('/users')
  });

  // Pobierz listę instytutów tylko dla SuperAdmina
  const { data: institutesData } = useQuery({
    queryKey: ['superadmin-institutes'],
    queryFn: () => fetchApi('/superadmin/institutes'),
    enabled: isSuperAdmin,
  });

  const institutes = institutesData?.data || [];

  const createMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      const body: any = {
        email: data.email,
        name: data.name,
        role: data.role,
        password: data.password,
      };
      // Tylko SuperAdmin może przesłać instituteId
      if (isSuperAdmin && data.instituteId) {
        body.instituteId = data.instituteId;
      }
      return fetchApi('/users', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); setIsOpen(false); setErrorMsg(''); reset(); },
    onError: (err: any) => setErrorMsg(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: UserFormData & { id: string }) => {
      const { id, ...payload } = data;
      const body: any = { name: payload.name, email: payload.email, role: payload.role };
      if (payload.newPassword) body.newPassword = payload.newPassword;
      // Tylko SuperAdmin może przesłać instituteId
      if (isSuperAdmin && payload.instituteId) {
        body.instituteId = payload.instituteId;
      }
      return fetchApi(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); setIsOpen(false); setEditingUser(null); setErrorMsg(''); reset(); },
    onError: (err: any) => setErrorMsg(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return fetchApi(`/users/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: (err: any) => toast.error(err.message),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: { role: 'VIEWER', instituteId: '' },
  });

  const onSubmit = (data: UserFormData) => {
    setErrorMsg('');
    if (editingUser) {
      updateMutation.mutate({ ...data, id: editingUser.id });
    } else {
      if (!data.password || data.password.trim() === '') {
        setErrorMsg('Podanie hasła jest wymagane przy tworzeniu nowego użytkownika.');
        return;
      }
      createMutation.mutate(data);
    }
  };

  const openEdit = (user: any) => {
    setEditingUser(user);
    setErrorMsg('');
    reset({
      email: user.email,
      name: user.name,
      role: user.role,
      instituteId: user.institute?.id || '',
      password: '',
      newPassword: ''
    });
    setIsOpen(true);
  };

  const openCreate = () => {
    setEditingUser(null);
    setErrorMsg('');
    reset({ email: '', name: '', role: 'VIEWER', instituteId: '', password: '', newPassword: '' });
    setIsOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-card p-6 rounded-xl border shadow-sm flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-status-danger-bg rounded-lg">
            <Shield className="h-6 w-6 text-status-danger-fg" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Zarządzanie użytkownikami</h1>
            <p className="text-muted-foreground text-sm">Dodawanie, edycja i przydzielanie ról w systemie</p>
          </div>
        </div>
        <Button className="gap-2" onClick={openCreate}>
          <UserPlus className="h-4 w-4" /> Dodaj użytkownika
        </Button>

        <Dialog open={isOpen} onOpenChange={(v) => { setIsOpen(v); if (!v) { setErrorMsg(''); setEditingUser(null); reset(); } }}>
          <DialogContent aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>{editingUser ? 'Edytuj użytkownika' : 'Nowy użytkownik systemu'}</DialogTitle>
            </DialogHeader>

            {errorMsg && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm font-medium">{errorMsg}</div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Imię i Nazwisko</Label>
                  <Input id="name" placeholder="Jan Kowalski" {...register('name')} />
                  {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Adres e-mail</Label>
                  <Input id="email" type="email" placeholder="jan@uczelnia.edu.pl" {...register('email')} />
                  {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Rola w systemie</Label>
                  <select
                    id="role"
                    className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm"
                    {...register('role')}
                  >
                    <option value="VIEWER">Przeglądający (Viewer)</option>
                    <option value="PLANNER">Planista (Planner)</option>
                    <option value="ADMIN">Administrator</option>
                    <option value="SUPER_ADMIN">SuperAdmin (Wydziałowy)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{editingUser ? 'Nowe hasło (opcjonalnie)' : 'Hasło'}</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Min. 6 znaków"
                    {...register(editingUser ? 'newPassword' : 'password')}
                  />
                  {errors.password && !editingUser && <p className="text-xs text-destructive">{errors.password.message}</p>}
                  {errors.newPassword && editingUser && <p className="text-xs text-destructive">{errors.newPassword.message}</p>}
                </div>
              </div>

              {/* Tylko SuperAdmin widzi wybór jednostki */}
              {isSuperAdmin && (
                <div className="space-y-2">
                  <Label htmlFor="instituteId" className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    Jednostka organizacyjna
                  </Label>
                  <select
                    id="instituteId"
                    className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm"
                    {...register('instituteId')}
                  >
                    <option value="">— Wybierz jednostkę —</option>
                    {institutes.map((inst: any) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name}{inst.shortCode ? ` (${inst.shortCode})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-muted-foreground">
                    Tylko SuperAdmin może przypisać użytkownika do konkretnej jednostki.
                    Zwykły Admin automatycznie przypisuje do swojej jednostki.
                  </p>
                </div>
              )}

              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="w-full mt-4">
                {editingUser ? 'Zapisz zmiany' : 'Utwórz konto'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Imię i Nazwisko</TableHead>
              <TableHead>Adres e-mail</TableHead>
              <TableHead>Rola</TableHead>
              <TableHead>Jednostka</TableHead>
              <TableHead>Data utworzenia</TableHead>
              <TableHead>Ostatnie logowanie</TableHead>
              <TableHead className="text-right">Akcje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center h-24">Ładowanie...</TableCell></TableRow>
            ) : data?.data?.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center h-24 text-muted-foreground">Brak użytkowników</TableCell></TableRow>
            ) : (
              data?.data?.map((user: any) => (
                <TableRow key={user.id}>
                  <TableCell className="font-semibold">{user.name}</TableCell>
                  <TableCell className="font-mono text-xs">{user.email}</TableCell>
                  <TableCell>{roleBadge(user.role)}</TableCell>
                  <TableCell className="text-sm">
                    {user.institute?.name ? (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        {user.institute.name}
                        {user.institute.shortCode && (
                          <span className="text-xs text-muted-foreground">({user.institute.shortCode})</span>
                        )}
                      </span>
                    ) : (
                      <span className="italic text-muted-foreground/60 text-xs">— brak przypisania —</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString('pl-PL')}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })
                      : <span className="italic text-muted-foreground/60">Nigdy</span>}
                  </TableCell>
                  <TableCell className="text-right flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(user)} className="hover:bg-primary/10 hover:text-primary h-8 w-8">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => {
                        if (confirm(`Czy na pewno usunąć użytkownika ${user.name}?`)) {
                          deleteMutation.mutate(user.id);
                        }
                      }}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
