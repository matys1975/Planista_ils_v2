export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // nowa funkcjonalność
        'fix',      // naprawa błędu
        'docs',     // dokumentacja
        'style',    // formatowanie, brak zmian logiki
        'refactor', // refaktoryzacja kodu
        'perf',     // poprawa wydajności
        'test',     // dodawanie testów
        'chore',    // zmiany w narzędziach, konfiguracji
        'ci',       // zmiany CI/CD
        'revert',   // cofnięcie commita
      ],
    ],
    'subject-case': [0], // nie wymuszamy konkretnego stylu nazw
  },
};
