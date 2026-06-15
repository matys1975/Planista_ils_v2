import { useCallback } from 'react';

interface ExportParams {
    type: 'workload' | 'resources' | 'summary';
    semesterId?: string;
    format?: 'csv' | 'json';
}

export function useDeanExport() {
    const exportReport = useCallback(async (params: ExportParams) => {
        const { type, semesterId, format = 'csv' } = params;
        const queryString = new URLSearchParams();
        queryString.set('format', format);
        if (semesterId) queryString.set('semesterId', semesterId);

        const url = `/api/v1/dean/reports/${type}?${queryString.toString()}`;

        if (format === 'csv') {
            // Pobierz plik i wymuś download
            const response = await fetch(url, { credentials: 'include' });
            if (!response.ok) throw new Error('Błąd pobierania raportu');
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `report_${type}_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);
        } else {
            // JSON — otwórz w nowym oknie lub pobierz
            window.open(url, '_blank');
        }
    }, []);

    return { exportReport };
}
