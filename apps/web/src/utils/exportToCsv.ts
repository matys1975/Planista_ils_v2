import Papa from 'papaparse';

/**
 * Eksportuje podaną tablicę obiektów do pliku CSV po stronie przeglądarki.
 * 
 * @param data Surowe dane do eksportu.
 * @param columnsMapping Mapowanie kluczy obiektu na nazwy kolumn, e.g. { firstName: "Imię", lastName: "Nazwisko" }
 * @param filename Nazwa pobieranego pliku, np. "Prowadzacy.csv"
 */
export function exportToCsv<T extends Record<string, any>>(
  data: T[],
  columnsMapping: Record<keyof T, string> | Record<string, string>,
  filename: string
) {
  if (!data || data.length === 0) {
    console.warn("Brak danych do eksportu.");
    return;
  }

  // 1. Zmapowanie oryginalnych danych na wybrane kolumny z nowymi, przyjaznymi nazwami
  const mappedData = data.map((item) => {
    const row: Record<string, any> = {};
    for (const [key, columnName] of Object.entries(columnsMapping)) {
      row[columnName] = item[key] !== undefined && item[key] !== null ? item[key] : '';
    }
    return row;
  });

  // 2. Konwersja obiektu na CSV za pomocą PapaParse
  // delimiter ustawiony na średnik ze względu na standard używany często przez polskiego Excela
  const csvString = Papa.unparse(mappedData, {
    delimiter: ';',
    quotes: true,
  });

  // 3. Dodanie BOM (Byte Order Mark), by Excel prawidłowo wczytywał polskie znaki UTF-8
  const utf8BOM = '\uFEFF';
  const blob = new Blob([utf8BOM + csvString], { type: 'text/csv;charset=utf-8;' });

  // 4. Utworzenie tymczasowego linku do pobrania i wymuszenie kliknięcia
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('href', url);
  a.setAttribute('download', filename);
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  
  // 5. Sprzątanie
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
