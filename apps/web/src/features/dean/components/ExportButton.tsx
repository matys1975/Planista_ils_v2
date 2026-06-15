import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDeanExport } from '../hooks/useDeanExport';

interface ExportButtonProps {
    type: 'workload' | 'resources' | 'summary';
    semesterId?: string;
    format?: 'csv' | 'json';
    label?: string;
}

export function ExportButton({ type, semesterId, format = 'csv', label = 'Eksport CSV' }: ExportButtonProps) {
    const { exportReport } = useDeanExport();

    return (
        <Button variant="outline" size="sm" className="gap-2" onClick={() => exportReport({ type, semesterId, format })}>
            <Download className="w-4 h-4" />
            {label}
        </Button>
    );
}
