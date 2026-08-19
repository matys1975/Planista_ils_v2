import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '../store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchApi } from '../lib/api';
import { queryClient } from '../lib/queryClient';
const loginSchema = z.object({
  email: z.string().email({ message: 'Nieprawidłowy e-mail' }),
  password: z.string().min(1, { message: 'Hasło jest wymagane' }),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();
  const loginFn = useAuthStore((s) => s.login);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setErrorMsg('');
    try {
      const body = await fetchApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (!body) {
        setErrorMsg('Błąd logowania');
        return;
      }

      queryClient.clear();
      loginFn(body.role, body.name, body.instituteId || null, body.facultyId || null, Boolean(body.mustChangePassword));
      navigate({ to: body.mustChangePassword ? '/profil' : '/' });
    } catch (err: any) {
      setErrorMsg(err.message || 'Nie można połączyć się z serwerem API');
    }
  };

  return (
    <div className="w-full min-h-screen flex flex-col lg:flex-row bg-cream font-sans selection:bg-navy-mid/30">
      {/* Sekcja graficzna (lewa) */}
      <div className="relative hidden lg:block lg:w-[min(50%,83.8vh)] lg:flex-none bg-navy-deep overflow-hidden border-r border-navy-dark/30">
        <img
          src="/tlo_login.webp"
          alt=""
          className="absolute inset-0 w-full h-full object-contain object-center"
        />
      </div>

      {/* Sekcja logowania (prawa) */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 relative">
        <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in-95 duration-500">

          <div className="flex items-center gap-3 mb-10 justify-center lg:justify-start">
            <div className="p-2 bg-gold/10 rounded-lg border border-gold/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gold"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 12 12 17 22 12" /><polyline points="2 17 12 22 22 17" /></svg>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight font-display text-navy-deep">Planista ILS</h1>
          </div>

          <div className="text-center lg:text-left">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Witaj ponownie</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Wprowadź swój e-mail i hasło, aby uzyskać dostęp do panelu.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground font-semibold">Adres e-mail</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder="admin@uczelnia.edu.pl"
                className="h-11 bg-white border-warm-border text-foreground placeholder:text-muted-foreground focus-visible:ring-navy-mid shadow-sm"
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground font-semibold">Hasło</Label>
              <Input
                id="password"
                type="password"
                {...register('password')}
                placeholder="••••••••"
                className="h-11 bg-white border-warm-border text-foreground placeholder:text-muted-foreground focus-visible:ring-navy-mid shadow-sm"
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            {errorMsg && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive text-center font-medium">
                {errorMsg}
              </div>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 text-base font-semibold shadow-md shadow-navy-deep/10 transition-all hover:-translate-y-0.5 mt-2"
            >
              {isSubmitting ? 'Logowanie...' : 'Zaloguj się'}
            </Button>
          </form>

          <div className="text-center text-xs text-muted-foreground mt-8 space-y-1">
            <p>&copy; {new Date().getFullYear()} Instytut Lingwistyki Stosowanej.</p>
            <p className="opacity-80">Projekt i wykonanie: Mateusz Ławniczak</p>
          </div>
        </div>
      </div>
    </div>
  );
}
