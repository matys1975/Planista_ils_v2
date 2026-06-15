import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { User, Save, KeyRound, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const profileSchema = z.object({
  name: z.string().min(1, 'Imię jest wymagane'),
  email: z.string().email('Nieprawidłowy adres e-mail'),
  currentPassword: z.string().optional().or(z.literal('')),
  newPassword: z.string().min(6, 'Hasło musi mieć min. 6 znaków').optional().or(z.literal('')),
}).refine((data) => {
  if (data.newPassword && !data.currentPassword) return false;
  return true;
}, { message: 'Podaj aktualne hasło, aby ustawić nowe', path: ['currentPassword'] });

type ProfileFormData = z.infer<typeof profileSchema>;

export function ProfilePage() {
  const { name, login } = useAuthStore();
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: name || '',
      email: '',
    }
  });

  // Załaduj dane po zamontowaniu
  useEffect(() => {
    fetch('/api/v1/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.user) {
          reset({
            name: data.user.name || name || '',
            email: data.user.email || '',
            currentPassword: '',
            newPassword: '',
          });
        }
      })
      .catch(() => {});
  }, []);

  const onSubmit = async (data: ProfileFormData) => {
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      const body: any = { name: data.name, email: data.email };
      if (data.newPassword) {
        body.currentPassword = data.currentPassword;
        body.newPassword = data.newPassword;
      }

      const res = await fetch('/api/v1/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok) {
        setErrorMsg(json.error || 'Błąd zapisu');
        return;
      }

      // Update local auth store name
      login(json.data.role, json.data.name);
      setSuccessMsg('Profil został zaktualizowany pomyślnie!');
      reset({ ...data, currentPassword: '', newPassword: '' });
    } catch (err: any) {
      setErrorMsg('Nie udało się połączyć z serwerem');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4 bg-card p-6 rounded-xl border shadow-sm">
        <div className="p-3 bg-primary/10 rounded-lg">
          <User className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mój Profil</h1>
          <p className="text-muted-foreground text-sm">Edytuj swoje dane osobowe i hasło dostępu</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border shadow-sm p-6">
        {errorMsg && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm font-medium mb-4">{errorMsg}</div>
        )}
        {successMsg && (
          <div className="bg-status-active-bg text-status-active-fg p-3 rounded-md text-sm font-medium mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">Dane podstawowe</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Imię i Nazwisko</Label>
                <Input id="name" {...register('name')} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Adres e-mail</Label>
                <Input id="email" type="email" {...register('email')} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t pt-6">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
              <KeyRound className="h-4 w-4" /> Zmiana hasła <span className="text-xs font-normal normal-case">(opcjonalnie)</span>
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Aktualne hasło</Label>
                <Input id="currentPassword" type="password" placeholder="Wymagane do zmiany" {...register('currentPassword')} />
                {errors.currentPassword && <p className="text-xs text-destructive">{errors.currentPassword.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nowe hasło</Label>
                <Input id="newPassword" type="password" placeholder="Min. 6 znaków" {...register('newPassword')} />
                {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword.message}</p>}
              </div>
            </div>
          </div>

          <Button type="submit" disabled={isLoading} className="gap-2">
            <Save className="h-4 w-4" /> {isLoading ? 'Zapisywanie...' : 'Zapisz zmiany'}
          </Button>
        </form>
      </div>
    </div>
  );
}
