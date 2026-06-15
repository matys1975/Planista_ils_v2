import { useAuthStore } from '../store/auth';
import { Link } from '@tanstack/react-router';
import { fetchApi } from '../lib/api';
import {
  Building2,
  Calendar,
  Users,
  BookOpen,
  LayoutDashboard,
  BarChart3,
  ArrowRight,
  Shield,
  User,
  Database,
  Download,
  Upload,
  Loader2,
  History,
  AlertTriangle,
  Crown
} from 'lucide-react';

const TILES = [
  {
    title: 'Harmonogram (Grid)',
    description: 'Układaj i zarządzaj planem zajęć w formie wizualnej siatki.',
    icon: LayoutDashboard,
    link: '/harmonogram',
    color: 'bg-navy-mid/10 text-navy-mid',
    primary: true
  },
  {
    title: 'Karty Pensum',
    description: 'Wygeneruj i przeanalizuj obciążenia dydaktyczne.',
    icon: BarChart3,
    link: '/obciazenia',
    color: 'bg-primary/10 text-primary',
    primary: true
  },
  {
    title: 'Podręcznik Użytkownika',
    description: 'Instrukcje, wskazówki i pomoc w obsłudze systemu Planista ILS.',
    icon: BookOpen,
    link: '/podrecznik',
    color: 'bg-gold/10 text-navy-deep',
    primary: true
  },
  {
    title: 'Semestry',
    description: 'Zdefiniuj i aktywuj nowe ramy czasowe do układania zajęć.',
    icon: Calendar,
    link: '/configuration',
    search: { tab: 'semesters' },
    color: 'bg-navy-deep/5 text-navy-dark'
  },
  {
    title: 'Katalog Grup',
    description: 'Baza wszystkich struktur studenckich na kierunkach.',
    icon: Users,
    link: '/configuration',
    search: { tab: 'groups' },
    color: 'bg-navy-deep/5 text-navy-dark'
  },
  {
    title: 'Przydział Sal',
    description: 'Zdefiniuj pule sal wykładowych, laborek i gabinetów.',
    icon: Building2,
    link: '/dictionary/rooms',
    color: 'bg-navy-deep/5 text-navy-dark'
  },
  {
    title: 'Prowadzący',
    description: 'Baza danych personelu (wykładowców/ćwiczeniowców).',
    icon: Users,
    link: '/dictionary/teachers',
    color: 'bg-navy-deep/5 text-navy-dark'
  },
  {
    title: 'Katalog przedmiotów',
    description: 'Moduł zarządzania przedmiotami i przydziałami prowadzących w ILS.',
    icon: BookOpen,
    link: '/dictionary/courses',
    color: 'bg-navy-deep/5 text-navy-dark'
  },
  {
    title: 'Mój Profil',
    description: 'Zmień swoje dane osobowe i hasło dostępu.',
    icon: User,
    link: '/profil',
    color: 'bg-gold/10 text-gold'
  }
];

const ADMIN_TILES = [
  {
    title: 'Użytkownicy',
    description: 'Zarządzaj kontami, rolami i uprawnieniami systemu.',
    icon: Shield,
    link: '/admin/users',
    color: 'bg-status-danger-bg text-status-danger-fg',
    primary: true
  }
];

const FACULTY_TILES = [
  {
    title: 'Panel Wydziałowy',
    description: 'Przegląd jednostek, obciążenia dydaktyczne, raporty i statystyki wydziałowe.',
    icon: Building2,
    link: '/faculty/dashboard',
    color: 'bg-gold/10 text-navy-deep',
    primary: true
  }
];

import { useState, useEffect } from 'react';

export function Home() {
  const { name, role } = useAuthStore();
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [backupList, setBackupList] = useState<{ name: string; size: number; createdAt: string }[]>([]);
  const [showBackupPanel, setShowBackupPanel] = useState(false);

  // Pobierz info o backupach
  const refreshBackups = async () => {
    try {
      const data = await fetchApi('/admin/backups');
      if (data.data) {
        setBackupList(data.data);
        if (data.data.length > 0) {
          setLastBackup(data.data[0].createdAt);
        }
      }
    } catch (err) {
      console.error('Błąd pobierania listy backupów', err);
    }
  };

  useEffect(() => {
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') refreshBackups();
  }, [role]);

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      // fetchApi dla backupu (zwróci tekst SQL)
      const res = await fetch('/api/v1/admin/backup', {
        method: 'POST',
        credentials: 'include'
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
      refreshBackups();
    } catch (err: any) {
      alert(`Błąd: ${err.message}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = async () => {
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
        `• Automatycznie utworzy backup bezpieczeństwa obecnych danych\n` +
        `• Nadpisze bieżącą bazę danych zawartością pliku\n\n` +
        `Czy na pewno chcesz kontynuować?`
      );
      if (!confirmed) return;

      setIsRestoring(true);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const result = await fetchApi('/admin/restore', {
          method: 'POST',
          body: formData,
        });

        alert(`✅ ${result.message}`);
        refreshBackups();
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
        credentials: 'include'
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
    <div className="max-w-7xl mx-auto space-y-6 p-4 sm:p-6 animate-in fade-in duration-500">

      {/* Grid of tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...TILES, ...(role === 'ADMIN' || role === 'SUPER_ADMIN' ? ADMIN_TILES : []), ...(role === 'DEAN' || role === 'SUPER_ADMIN' ? FACULTY_TILES : [])].map((tile, i) => {
          const Icon = tile.icon;
          return (
            <Link
              key={i}
              to={tile.link as any}
              search={'search' in tile ? (tile as any).search : undefined}
              className={`group flex items-start flex-col justify-between p-6 rounded-2xl border bg-card transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${tile.primary ? 'border-primary/50 shadow-md rings-1 ring-primary/20' : 'hover:border-border'
                }`}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className={`p-3 rounded-xl ${tile.color}`}>
                  <Icon className="w-8 h-8" strokeWidth={1.5} />
                </div>
                <h3 className="font-semibold text-lg">{tile.title}</h3>
              </div>

              <p className="text-muted-foreground text-sm mb-6 flex-1">
                {tile.description}
              </p>

              <div className="flex items-center text-sm font-medium text-primary mt-auto group-hover:underline">
                Przejdź <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          );
        })}

        {/* Backup Tile — tylko dla SUPER_ADMIN */}
        {role === 'SUPER_ADMIN' && (
          <div className="group flex items-start flex-col justify-between p-6 rounded-2xl border bg-card border-navy-mid/50 shadow-md">
            <div className="flex items-center gap-4 mb-4 w-full">
              <div className="p-3 rounded-xl bg-navy-mid/10 text-navy-mid">
                <Database className="w-8 h-8" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">Baza danych</h3>
                <p className="text-xs text-muted-foreground">Backup, przywracanie i transfer danych</p>
              </div>
            </div>

            {lastBackup && (
              <p className="text-xs text-muted-foreground mb-3">
                Ostatni backup: {new Date(lastBackup).toLocaleString('pl-PL')}
              </p>
            )}

            <div className="w-full space-y-2">
              {/* Backup button */}
              <button
                onClick={handleBackup}
                disabled={isBackingUp || isRestoring}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-navy-deep text-white font-medium text-sm hover:bg-navy-dark transition-colors disabled:opacity-50 disabled:cursor-wait shadow-sm"
              >
                {isBackingUp ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Tworzę backup...</>
                ) : (
                  <><Download className="w-4 h-4" /> Pobierz backup bazy</>
                )}
              </button>

              {/* Restore button */}
              <button
                onClick={handleRestore}
                disabled={isBackingUp || isRestoring}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gold text-navy-deep font-medium text-sm hover:bg-[#C49A45] transition-colors disabled:opacity-50 disabled:cursor-wait shadow-sm"
              >
                {isRestoring ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Przywracam bazę...</>
                ) : (
                  <><Upload className="w-4 h-4" /> Wgraj backup z pliku (.sql)</>
                )}
              </button>

              {/* Backup history toggle */}
              {backupList.length > 0 && (
                <button
                  onClick={() => setShowBackupPanel(!showBackupPanel)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  <History className="w-4 h-4" />
                  {showBackupPanel ? 'Ukryj historię' : `Historia backupów (${backupList.length})`}
                </button>
              )}
            </div>

            {/* Backup history list */}
            {showBackupPanel && backupList.length > 0 && (
              <div className="w-full mt-3 space-y-1 max-h-48 overflow-y-auto border-t pt-3">
                {backupList.slice(0, 10).map((b) => (
                  <div key={b.name} className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-muted/50 group">
                    <div className="truncate flex-1 mr-2">
                      <span className="font-mono text-muted-foreground">{b.name}</span>
                      <span className="text-muted-foreground ml-2">({(b.size / 1024).toFixed(0)} KB)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground whitespace-nowrap">
                        {new Date(b.createdAt).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button 
                        onClick={() => handleDownloadHistory(b.name)}
                        className="p-1 rounded bg-navy-mid/10 text-navy-mid hover:bg-navy-mid/20 hover:text-navy-deep opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Pobierz ten backup"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Info box */}
            <div className="w-full mt-3 p-3 rounded-lg bg-status-warning-bg border border-status-warning-fg/20">
              <div className="flex gap-2">
                <AlertTriangle className="w-4 h-4 text-status-warning-fg flex-shrink-0 mt-0.5" />
                <p className="text-xs text-status-warning-fg">
                  <strong>Transfer danych:</strong> Pobierz backup na jednym komputerze, prześlij plik .sql na drugi, i wgraj go przyciskiem powyżej.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
