import React, { useState } from 'react';
import { UploadCloud, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Callout } from '@/components/ui/callout';

import { fetchApi } from '@/lib/api';


interface USOSExportButtonProps {
  semesterId: string;
}

export function USOSExportButton({ semesterId }: USOSExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [exportResult, setExportResult] = useState<any>(null);

  const checkStatus = async () => {
    setIsChecking(true);
    setStatus(null);
    setExportResult(null);
    try {
      const data = await fetchApi('/api/v1/usos/status');
      setStatus(data);
    } catch (error: any) {
      setStatus({ connected: false, message: error.message || 'Błąd połączenia z serwerem API' });
    } finally {
      setIsChecking(false);
    }
  };

  const handleExport = async () => {
    if (!semesterId) return;
    setIsExporting(true);
    setExportResult(null);
    try {
      const data = await fetchApi(`/api/v1/usos/export/${semesterId}`, {
        method: 'POST',
      });
      setExportResult(data);
    } catch (error: any) {
      setExportResult({ error: 'Export failed', message: error.message });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (open) checkStatus();
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-gold/30 text-navy-mid hover:bg-gold hover:text-white shadow-sm ml-2 print:hidden">
          <UploadCloud className="w-4 h-4 mr-2" /> Eksportuj do USOS
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-navy-mid" />
            Integracja z systemem USOS
          </DialogTitle>
          <DialogDescription>
            Ten moduł pozwala na automatyczne przesłanie ułożonego planu zajęć dla wybranego semestru do uniwersyteckiego systemu USOS (UAM).
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {isChecking ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : status ? (
            <>
              {status.connected ? (
                <Callout type="info">
                  Klucze autoryzacyjne działają poprawnie. Odkryto {status.methodCount} dostępnych metod.
                  Gotowy do synchronizacji planu.
                </Callout>
              ) : (
                <Callout type="danger">
                  {status.message || 'Nie można połączyć się z serwerami UAM. Sprawdź plik .env i konfigurację kluczy.'}
                </Callout>
              )}
            </>
          ) : null}

          {exportResult && (
            <div className="mt-4">
              {exportResult.error ? (
                <Callout type="danger">
                  <div className="font-semibold mb-1">Błąd eksportu</div>
                  {exportResult.message}
                </Callout>
              ) : (
                <Callout type="info">
                  <div className="font-semibold mb-1">Raport z eksportu</div>
                  <ul className="list-disc pl-4 mt-2">
                    <li>Pomyślnie zsynchronizowano: <b>{exportResult.success}</b> wpisów</li>
                    <li>Błędy: <b>{exportResult.failed}</b> wpisów</li>
                  </ul>
                  {exportResult.errors?.length > 0 && (
                    <div className="mt-2 text-xs overflow-auto max-h-32 bg-white/50 p-2 rounded">
                      {exportResult.errors.map((err: string, i: number) => <div key={i} className="text-status-danger-fg">{err}</div>)}
                    </div>
                  )}
                </Callout>
              )}
            </div>
          )}
          
          <div className="text-sm text-muted-foreground border-l-2 border-orange-400 pl-3">
            <strong>Wymagania mapowania:</strong> Upewnij się, że Sale, Prowadzący i Przedmioty mają uzupełnione pole <code>usosId</code>. Wpisy bez poprawnego mapowania zostaną pominięte podczas eksportu.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Anuluj</Button>
          <Button 
            onClick={handleExport} 
            disabled={!status?.connected || isExporting}
            className="bg-gold hover:bg-indigo-700"
          >
            {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {isExporting ? 'Wysyłanie danych...' : 'Rozpocznij Eksport'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
