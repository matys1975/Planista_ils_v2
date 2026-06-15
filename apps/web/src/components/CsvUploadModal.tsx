import { useState } from 'react';
import Papa from 'papaparse';
import { Upload, Download, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface CsvUploadModalProps {
  title: string;
  expectedHeaders: string[];
  templateData: any[];
  onUpload: (data: any[]) => Promise<void>;
  isLoading: boolean;
  delimiter?: string;
  acceptExtensions?: string;
  templateFilename?: string;
}

export function CsvUploadModal({ title, expectedHeaders, templateData, onUpload, isLoading, delimiter = ';', acceptExtensions = '.csv', templateFilename = 'szablon_importu.csv' }: CsvUploadModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState('');

  const downloadTemplate = () => {
    const csv = Papa.unparse(templateData, { quotes: false, delimiter });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', templateFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      // Brak sztywnego ustawienia delimiter pozwala PapaParse na automatyczne wykrycie przecinka (,) lub średnika (;)
      complete: async (results) => {
        try {
          const rows = results.data as any[];
          
          if (rows.length === 0) {
            setError('Plik wydaje się być pusty.');
            return;
          }

          // Very simple validation check for required headers
          const headers = results.meta.fields || [];
          const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
          
          if (missingHeaders.length > 0) {
            setError(`Brakuje wymaganych kolumn: ${missingHeaders.join(', ')}. Użyj struktury z szablonu! (Pamiętaj o rozdzielaniu średnikiem 😉)`);
            return;
          }

          await onUpload(rows);
          setIsOpen(false);
          
        } catch (err: any) {
          setError(err.message || 'Wystąpił błąd podczas wysyłania danych na serwer.');
        }
      },
      error: (err) => {
        setError(`Błąd parsowania pliku: ${err.message}`);
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 bg-secondary/50">
          <Upload className="h-4 w-4" /> Masowy Import (CSV)
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 pt-4">
          
          <div className="bg-muted p-4 rounded-xl border border-dashed flex flex-col items-center text-center gap-2">
            <FileSpreadsheet className="w-8 h-8 text-primary/70 mb-2" />
            <h3 className="font-semibold text-sm">Brakuje Ci wyśrubowanego szablonu?</h3>
            <p className="text-xs text-muted-foreground max-w-[300px]">Pobierz przygotowany układ kolumn, zaimportuj do Excela, wypełnij i zapisz ponownie jako Plik CSV (rozdzielany średnikiem).</p>
            <Button variant="secondary" size="sm" onClick={downloadTemplate} className="mt-2 text-xs">
              <Download className="w-4 h-4 mr-2" /> Pobierz {templateFilename}
            </Button>
          </div>

          {error && (
            <div className="p-3 bg-status-danger-bg border border-status-danger-fg/20 rounded-lg flex items-start gap-3 text-status-danger-fg text-sm">
               <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
               <p>{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Wgraj uzupełniony plik (.csv)</label>
            <input 
               type="file" 
               accept={acceptExtensions}
               onChange={handleFileUpload}
               disabled={isLoading}
               className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {isLoading && <p className="text-xs text-muted-foreground mt-2 animate-pulse">Trwa przetwarzanie i autoryzacja danych na serwerach...</p>}
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
