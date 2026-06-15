import { useState } from 'react';
import { X, ShieldCheck, ShieldAlert, UserPlus, KeyRound, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/auth';
import { useDeanUsers } from '../hooks/useDeanUsers';
import { useResetPassword } from '../hooks/useResetPassword';
import type { DeanInstitute } from '../types/dean.types';

interface InstituteAdminsDrawerProps {
    institute: DeanInstitute | null;
    isOpen: boolean;
    onClose: () => void;
}

export function InstituteAdminsDrawer({ institute, isOpen, onClose }: InstituteAdminsDrawerProps) {
    const role = useAuthStore((s) => s.role);
    const canManage = role === 'DEAN' || role === 'SUPER_ADMIN';

    const { data: usersData } = useDeanUsers({
        role: 'ADMIN',
        instituteId: institute?.id,
    });

    const admins = usersData?.data || [];
    const resetPassword = useResetPassword();

    const [showResetForm, setShowResetForm] = useState<string | null>(null);
    const [newPassword, setNewPassword] = useState('');

    function handleReset(userId: string) {
        if (!newPassword || newPassword.length < 6) return;
        resetPassword.mutate(
            { userId, newPassword, scope: 'dean' },
            {
                onSuccess: () => {
                    setShowResetForm(null);
                    setNewPassword('');
                },
            }
        );
    }

    if (!isOpen || !institute) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/30" onClick={onClose} />
            <div className="relative w-full max-w-md bg-white h-full shadow-xl flex flex-col animate-in slide-in-from-right duration-200">
                <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold">Administratorzy</h2>
                        {institute.adminCount === 0 ? (
                            <Badge variant="destructive" className="gap-1">
                                <ShieldAlert className="w-3 h-3" />
                                Brak admina
                            </Badge>
                        ) : (
                            <Badge variant="default" className="bg-emerald-600 gap-1">
                                <ShieldCheck className="w-3 h-3" />
                                {institute.adminCount}
                            </Badge>
                        )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        <X className="w-4 h-4" />
                    </Button>
                </div>

                <div className="p-4 space-y-4 overflow-y-auto flex-1">
                    <div className="rounded-lg bg-cream p-3 border">
                        <p className="font-medium text-sm">{institute.name}</p>
                        <p className="text-xs text-muted-foreground">{institute.shortCode || '—'}</p>
                    </div>

                    {admins.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <ShieldAlert className="w-8 h-8 mx-auto mb-2 text-status-warning-fg" />
                            <p className="text-sm font-medium">Brak administratora jednostki</p>
                            <p className="text-xs mt-1">
                                Utwórz konto z rolą ADMIN w zakładce Użytkownicy.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {admins.map((admin) => (
                                <div
                                    key={admin.id}
                                    className="rounded-lg border p-3 space-y-2 hover:border-warm-border transition-colors"
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="font-medium text-sm">{admin.name}</p>
                                            <p className="text-xs text-muted-foreground">{admin.email}</p>
                                        </div>
                                        <Badge
                                            variant={
                                                admin.activityStatus === 'active'
                                                    ? 'default'
                                                    : admin.activityStatus === 'recent'
                                                        ? 'secondary'
                                                        : 'outline'
                                            }
                                            className="text-[10px]"
                                        >
                                            {admin.activityStatus === 'active'
                                                ? 'Aktywny'
                                                : admin.activityStatus === 'recent'
                                                    ? 'Niedawno'
                                                    : 'Nieaktywny'}
                                        </Badge>
                                    </div>

                                    {canManage && (
                                        <div className="flex items-center gap-2 pt-1">
                                            {showResetForm === admin.id ? (
                                                <div className="flex items-center gap-2 flex-1">
                                                    <input
                                                        type="text"
                                                        value={newPassword}
                                                        onChange={(e) => setNewPassword(e.target.value)}
                                                        placeholder="Nowe hasło (min. 6 znaków)"
                                                        className="flex-1 text-xs px-2 py-1 rounded border"
                                                    />
                                                    <Button
                                                        size="sm"
                                                        variant="default"
                                                        className="h-7 text-xs"
                                                        onClick={() => handleReset(admin.id)}
                                                        disabled={resetPassword.isPending}
                                                    >
                                                        <KeyRound className="w-3 h-3 mr-1" />
                                                        Zapisz
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 text-xs"
                                                        onClick={() => {
                                                            setShowResetForm(null);
                                                            setNewPassword('');
                                                        }}
                                                    >
                                                        Anuluj
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 text-xs"
                                                    onClick={() => {
                                                        setShowResetForm(admin.id);
                                                        setNewPassword('');
                                                    }}
                                                >
                                                    <KeyRound className="w-3 h-3 mr-1" />
                                                    Resetuj hasło
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
