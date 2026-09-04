const FALLBACK_SHORT_CODES: Record<string, string> = {
  'Instytut Lingwistyki Stosowanej': 'ILS',
  'Instytut Filologii Germańskiej': 'IFG',
  'Instytut Filologii Romańskiej': 'IFROM',
  'Instytut Językoznawstwa': 'IJ',
  'Studium Praktycznej Nauki Języków Obcych': 'SPNJO',
  'Instytut Filologii Słowiańskiej': 'IFSłow',
  'Instytut Filologii Wschodniosłowiańskich': 'IFW',
  'Studium Językowe UAM': 'SJ UAM',
  'Studium Językowe': 'SJ UAM',
  'SJ UAM': 'SJ UAM',
  'Pracownik UCP': 'UCP',
  'Ośrodek Koordynacyjno-Programowy Kształcenia Nauczycieli': 'OKPKN',
  'OKPKN': 'OKPKN',
  'Pracownik zlecony': 'Zlecenie',
  'Wydział Neofilologii': 'WN',
  'Brak przypisania': '—',
  'Nieznana jednostka': '—',
};

function stripDiacritics(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function buildAcronym(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return '—';

  const parentheticalMatch = trimmed.match(/\(([^)]+)\)\s*$/);
  const suffix = parentheticalMatch ? ` (${parentheticalMatch[1].trim()})` : '';
  const baseName = parentheticalMatch ? trimmed.replace(/\s*\([^)]+\)\s*$/, '') : trimmed;
  const normalizedBase = stripDiacritics(baseName);

  if (/^[A-Z0-9 .-]+$/.test(normalizedBase) && normalizedBase.length <= 12) {
    return `${baseName}${suffix}`;
  }

  const stopWords = new Set(['i', 'oraz', 'im', 'pw', 'w', 'we', 'na', 'do', 'od', 'z']);
  const words = normalizedBase
    .split(/[\s/-]+/)
    .map((word) => word.replace(/[^A-Za-z0-9]/g, ''))
    .filter(Boolean);

  const significantWords = words.filter((word) => !stopWords.has(word.toLowerCase()));
  const sourceWords = significantWords.length > 0 ? significantWords : words;
  const acronym = sourceWords
    .slice(0, 6)
    .map((word) => word[0]?.toUpperCase() || '')
    .join('');

  return `${acronym || normalizedBase.slice(0, 4).toUpperCase()}${suffix}`;
}

export function getInstituteShortLabel(name?: string | null, shortCode?: string | null) {
  if (shortCode && shortCode.trim()) {
    return shortCode.trim();
  }

  if (!name || !name.trim()) {
    return '—';
  }

  return FALLBACK_SHORT_CODES[name] || buildAcronym(name);
}
