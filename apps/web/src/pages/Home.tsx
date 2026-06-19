import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { fetchApi } from '../lib/api';
import { useAuthStore } from '../store/auth';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Database,
  Download,
  History,
  Loader2,
  Upload,
  User,
} from 'lucide-react';

type BackupItem = {
  name: string;
  size: number;
  createdAt: string;
};

function QuickLinkCard({
  title,
  description,
  to,
  icon: Icon,
  accentClass,
}: {
  title: string;
  description: string;
  to: string;
  icon: typeof User;
  accentClass: string;
}) {
  return (
    <Link
      to={to as any}
      className="group flex min-h-[184px] flex-col justify-between rounded-lg border border-border/70 bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-navy-mid/30 hover:shadow-lg"
    >
      <div className="space-y-4">
        <div className={`inline-flex rounded-lg p-3 ${accentClass}`}>
          <Icon className="h-6 w-6" strokeWidth={1.7} />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="mt-6 flex items-center text-sm font-medium text-primary group-hover:underline">
        Otwórz
        <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

function BackupCard({
  lastBackup,
  backupList,
  showBackupPanel,
  isBackingUp,
  isRestoring,
  onBackup,
  onRestore,
  onToggleHistory,
  onDownloadHistory,
}: {
  lastBackup: string | null;
  backupList: BackupItem[];
  showBackupPanel: boolean;
  isBackingUp: boolean;
  isRestoring: boolean;
  onBackup: () => Promise<void>;
  onRestore: () => void;
  onToggleHistory: () => void;
  onDownloadHistory: (filename: string) => Promise<void>;
}) {
  return (
    <div className="rounded-lg border border-navy-mid/20 bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-lg bg-navy-mid/10 p-3 text-navy-mid">
          <Database className="h-6 w-6" strokeWidth={1.7} />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground">Backup i restore</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Ręczny backup, przywracanie z pliku i szybki dostęp do historii kopii.
          </p>
        </div>
      </div>

      {lastBackup && (
        <p className="mb-4 text-xs text-muted-foreground">
          Ostatni backup: {new Date(lastBackup).toLocaleString('pl-PL')}
        </p>
      )}

      <div className="space-y-2">
        <button
          onClick={() => void onBackup()}
          disabled={isBackingUp || isRestoring}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-navy-deep px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-navy-dark disabled:cursor-wait disabled:opacity-50"
        >
          {isBackingUp ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Tworzę backup...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" /> Pobierz backup bazy
            </>
          )}
        </button>

        <button
          onClick={onRestore}
          disabled={isBackingUp || isRestoring}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-4 py-2.5 text-sm font-medium text-navy-deep transition-colors hover:bg-[#C49A45] disabled:cursor-wait disabled:opacity-50"
        >
          {isRestoring ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Przywracam bazę...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" /> Wgraj backup z pliku
            </>
          )}
        </button>

        {backupList.length > 0 && (
          <button
            onClick={onToggleHistory}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            <History className="h-4 w-4" />
            {showBackupPanel ? 'Ukryj historię' : `Historia backupów (${backupList.length})`}
          </button>
        )}
      </div>

      {showBackupPanel && backupList.length > 0 && (
        <div className="mt-4 max-h-48 space-y-1 overflow-y-auto border-t border-border pt-4">
          {backupList.slice(0, 10).map((item) => (
            <div
              key={item.name}
              className="group flex items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-muted/50"
            >
              <div className="mr-2 min-w-0 flex-1 truncate">
                <span className="font-mono text-muted-foreground">{item.name}</span>
                <span className="ml-2 text-muted-foreground">({(item.size / 1024).toFixed(0)} KB)</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="whitespace-nowrap text-muted-foreground">
                  {new Date(item.createdAt).toLocaleString('pl-PL', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <button
                  onClick={() => void onDownloadHistory(item.name)}
                  className="rounded bg-navy-mid/10 p-1 text-navy-mid opacity-0 transition-opacity hover:bg-navy-mid/20 hover:text-navy-deep group-hover:opacity-100"
                  title="Pobierz ten backup"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 rounded-lg border border-status-warning-fg/20 bg-status-warning-bg p-3">
        <div className="flex gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-status-warning-fg" />
          <p className="text-xs leading-5 text-status-warning-fg">
            <strong>Transfer danych:</strong> pobierz backup na jednym komputerze, prześlij plik
            `.sql` na drugi i wgraj go przyciskiem powyżej.
          </p>
        </div>
      </div>
    </div>
  );
}

export function Home() {
  const { name, role, mustChangePassword } = useAuthStore();
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [backupList, setBackupList] = useState<BackupItem[]>([]);
  const [showBackupPanel, setShowBackupPanel] = useState(false);

  const isSuperAdmin = role === 'SUPER_ADMIN';

  const refreshBackups = async () => {
    try {
      const data = await fetchApi<{ data?: BackupItem[] }>('/admin/backups');
      if (data.data) {
        setBackupList(data.data);
        setLastBackup(data.data[0]?.createdAt ?? null);
      }
    } catch (err) {
      console.error('Błąd pobierania listy backupów', err);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      void refreshBackups();
    }
  }, [isSuperAdmin]);

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const res = await fetch('/api/v1/admin/backup', {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Błąd backupu');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="(.+)"/);

      a.download = match ? match[1] : 'backup_bazy.sql';
      a.href = url;
      a.click();
      window.URL.revokeObjectURL(url);

      setLastBackup(new Date().toISOString());
      await refreshBackups();
    } catch (err: any) {
      alert(`Błąd: ${err.message}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.sql';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const confirmed = window.confirm(
        `⚠️ UWAGA: Przywracanie bazy danych!\n\n` +
          `Plik: ${file.name} (${(file.size / 1024).toFixed(0)} KB)\n\n` +
          `Ta operacja:\n` +
          `• automatycznie utworzy backup bezpieczeństwa obecnych danych\n` +
          `• nadpisze bieżącą bazę danych zawartością pliku\n\n` +
          `Czy na pewno chcesz kontynuować?`,
      );
      if (!confirmed) return;

      setIsRestoring(true);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const result = await fetchApi<{ message: string }>('/admin/restore', {
          method: 'POST',
          body: formData,
        });

        alert(`✅ ${result.message}`);
        await refreshBackups();
        window.location.reload();
      } catch (err: any) {
        alert(`❌ Błąd przywracania: ${err.message}`);
      } finally {
        setIsRestoring(false);
      }
    };
    input.click();
  };

  const handleDownloadHistory = async (filename: string) => {
    try {
      const res = await fetch(`/api/v1/admin/backups/${filename}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!res.ok) {
        let errMsg = 'Błąd pobierania pliku';
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch {}
        throw new Error(errMsg);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.download = filename;
      a.href = url;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Błąd: ${err.message}`);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 animate-in fade-in duration-500">
      <section className="rounded-lg border border-border/60 bg-card px-5 py-6 shadow-sm sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Witaj ponownie{ name ? `, ${name}` : ''}.
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Panel startowy</h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Główna nawigacja znajduje się w menu po lewej stronie. Tutaj zostawiamy tylko
              najważniejsze skróty związane z Twoim kontem i pomocą.
            </p>
          </div>

          <div className="inline-flex w-fit items-center rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Rola: {role}
          </div>
        </div>

        {mustChangePassword && (
          <div className="mt-4 rounded-lg border border-status-warning-fg/20 bg-status-warning-bg px-4 py-3 text-sm text-status-warning-fg">
            Zanim przejdziesz do dalszej pracy, zmień hasło w swoim profilu.
          </div>
        )}
      </section>

      <div className={`grid gap-4 ${isSuperAdmin ? 'xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(360px,1fr)]' : 'md:grid-cols-2'}`}>
        <QuickLinkCard
          title="Mój profil"
          description="Zmień swoje dane, hasło i sprawdź ustawienia konta."
          to="/profil"
          icon={User}
          accentClass="bg-gold/10 text-gold"
        />

        <QuickLinkCard
          title="Podręcznik"
          description="Instrukcje, wskazówki i pomoc do pracy w systemie."
          to="/podrecznik"
          icon={BookOpen}
          accentClass="bg-navy-mid/10 text-navy-mid"
        />

        {isSuperAdmin && (
          <BackupCard
            lastBackup={lastBackup}
            backupList={backupList}
            showBackupPanel={showBackupPanel}
            isBackingUp={isBackingUp}
            isRestoring={isRestoring}
            onBackup={handleBackup}
            onRestore={handleRestore}
            onToggleHistory={() => setShowBackupPanel((value) => !value)}
            onDownloadHistory={handleDownloadHistory}
          />
        )}
      </div>
    </div>
  );
}
