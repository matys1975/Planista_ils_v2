import { useState, useEffect, useRef } from 'react';
import { BookOpen, User, Grid3X3, Database, Shield, ClipboardList, Upload, Menu, Crown, AlertCircle, FileSpreadsheet, Printer } from 'lucide-react';
import { Callout } from '@/components/ui/callout';

const sections = [
  { id: 'intro', label: 'Wprowadzenie', icon: BookOpen },
  { id: 'navigation', label: 'Nawigacja i Interfejs', icon: Menu },
  { id: 'dictionaries', label: 'Słowniki', icon: Database },
  { id: 'allocations', label: 'Przydziały', icon: Upload },
  { id: 'grid', label: 'Siatka Zajęć', icon: Grid3X3 },
  { id: 'pensum', label: 'Kalkulator Pensum', icon: ClipboardList },
  { id: 'staffing', label: 'Zapotrzebowania Kadrowe', icon: AlertCircle },
  { id: 'superadmin', label: 'Panel Wydziałowy', icon: Crown },
  { id: 'admin', label: 'Administracja', icon: Shield },
];

export function ManualPage() {
  const [activeSection, setActiveSection] = useState('intro');
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActiveSection(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 }
    );
    sections.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex gap-8 max-w-6xl mx-auto animate-in fade-in duration-500">
      {/* Sticky sidebar nav */}
      <nav className="hidden lg:block w-64 flex-shrink-0">
        <div className="sticky top-6 space-y-1">
          <h2 className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-3 px-2">Spis treści</h2>
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all text-left ${activeSection === s.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
            >
              <s.icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{s.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Main content */}
      <div ref={contentRef} className="flex-1 min-w-0 space-y-16 pb-16 text-balance">
        {/* Header */}
        <div className="border-b pb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-primary/10 rounded-xl"><BookOpen className="w-8 h-8 text-primary" /></div>
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight">Podręcznik Użytkownika</h1>
              <p className="text-sm text-muted-foreground mt-1">Planista ILS — Wersja 1.2 (Aktualizacja Czerwiec 2026)</p>
            </div>
          </div>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Zintegrowany System Zarządzania Siatką Zajęć i Pensum (Planista ILS) to zaawansowane narzędzie wspierające procesy planowania dydaktyki na Wydziale Neofilologii.
          </p>
        </div>

        {/* 1. Wprowadzenie */}
        <section id="intro" className="scroll-mt-8 space-y-6">
          <SectionHeader icon={User} title="1. Pierwsze kroki" />

          <Card title="1.1 Logowanie">
            <p>
              Dostęp do systemu jest ściśle autoryzowany. Aby się zalogować, użyj adresu e-mail oraz hasła przekazanego Ci przez administratora systemu.
              Po zalogowaniu system zapamięta Twoją sesję, chyba że wylogujesz się ręcznie.
            </p>
          </Card>
        </section>

        {/* 2. Nawigacja */}
        <section id="navigation" className="scroll-mt-8 space-y-6">
          <SectionHeader icon={Menu} title="2. Nawigacja i Interfejs" />

          <Card title="2.1 Zwijany Panel Boczny" accent>
            <p className="mb-4">
              Aby zwiększyć obszar roboczy (szczególnie przydatne w widoku Siatki Zajęć), możesz zwinąć menu boczne
              używając przycisku strzałki <kbd className="bg-muted px-1 rounded text-xs border shadow-sm">←</kbd> znajdującego się obok logo.
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Tryb pełny:</strong> Widoczne ikony i nazwy sekcji.</li>
              <li><strong>Tryb kompaktowy:</strong> Widoczne tylko ikony. Po najechaniu myszką wyświetli się podpowiedź z nazwą strony.</li>
            </ul>
            <Callout type="tip">
              System zapamiętuje stan menu — jeśli je zwiniesz, przy kolejnym logowaniu nadal będzie kompaktowe.
            </Callout>
          </Card>

          <Card title="2.2 Grupowanie w Słownikach">
            <p>
              Pozycje w sekcji <strong>Słowniki</strong> można zwijać i rozwijać, klikając bezpośrednio w nagłówek sekcji.
              Pozwala to na szybkie ukrycie rzadziej używanych słowników i zachowanie porządku w menu.
            </p>
          </Card>
        </section>

        {/* 3. Słowniki */}
        <section id="dictionaries" className="scroll-mt-8 space-y-6">
          <SectionHeader icon={Database} title="3. Słowniki (Baza Danych)" />

          <Card title="3.1 Prowadzący i Jednostki" highlight="indigo">
            <p className="mb-4">
              Przy dodawaniu lub edycji prowadzącego, pole <strong>Jednostka organizacyjna</strong> jest teraz listą wyboru.
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Nie można już wpisać nazwy jednostki "z ręki", co zapobiega błędom i dublowaniu instytutów.</li>
              <li>W systemie zdefiniowane są jednostki takie jak: <code className="bg-muted px-1 rounded text-xs">ILS</code>, <code className="bg-muted px-1 rounded text-xs">IFG</code>, <code className="bg-muted px-1 rounded text-xs">UCP</code>, <code className="bg-muted px-1 rounded text-xs">Zlecenie</code> i inne.</li>
            </ul>
          </Card>

          <Card title="3.2 Import Przedmiotów z USOS (Rekomendowane)" highlight="indigo">
            <p className="mb-3">
              Preferowaną formą dodawania przedmiotów do systemu jest <strong>bezpośredni import z bazy USOS</strong>, co minimalizuje błędy i zapewnia spójność danych.
            </p>
            <div className="bg-muted p-3 rounded text-sm space-y-2">
              <p><strong>Jak szukać przedmiotów?</strong></p>
              <p>W oknie importu wyszukujemy przedmioty, podając <strong>dwa pierwsze człony kodu przedmiotu</strong>.</p>
              <p>Przykład dla przedmiotu o pełnym kodzie <code className="bg-background border px-1 rounded text-xs font-bold text-primary">09-S1FHI01-P14313</code>:</p>
              <ul className="list-disc list-inside ml-2 text-foreground/80">
                <li>Wpisujemy do wyszukiwarki: <code className="bg-background border px-1 rounded text-xs font-bold text-primary">09-S1FHI01</code></li>
                <li><strong className="text-foreground">09</strong> — kod wydziału</li>
                <li><strong className="text-foreground">S1</strong> — studia I stopnia</li>
                <li><strong className="text-foreground">FHI</strong> — program studiów (np. filologia hiszpańska)</li>
                <li><strong className="text-foreground">01</strong> — semestr pierwszy (analogicznie <code className="bg-background border px-1 text-xs font-bold">02</code> to semestr drugi, <code className="bg-background border px-1 text-xs font-bold">03</code> to trzeci, itd.)</li>
              </ul>
            </div>
          </Card>

          <Card title="3.3 Ręczne Zdefiniowanie Przedmiotu">
            <p className="mb-2">
              Jeśli przedmiotu z jakiegoś powodu nie ma jeszcze w USOS, możesz dodać go ręcznie używając przycisku <strong>Zdefiniuj przedmiot</strong>.
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4 text-sm text-foreground/80">
              <li>Wymagane jest samodzielne wypełnienie nazwy, kodu, typu zajęć (Wykład, Ćwiczenia, itp.), liczby godzin, punktów ECTS oraz przypisanie go do właściwego Programu Studiów (Kierunku i Roku).</li>
              <li>Przedmiot zdefiniowany w ten sposób zachowuje się identycznie w planowaniu jak ten zaimportowany, wymaga jedynie dokładnego wprowadzenia danych.</li>
            </ul>
          </Card>

          <Card title="3.4 Masowy Import z CSV (Dla zaawansowanych)">
            <p>
              Opcja <strong>Import CSV</strong> w słownikach służy do masowego wgrywania Prowadzących oraz Przedmiotów. 
              Jest to funkcja przeznaczona dla zaawansowanych użytkowników. Aby z niej skorzystać, należy pobrać dedykowany szablon (plik Excel/CSV), który wymusza prawidłową strukturę wgrywanych danych.
            </p>
          </Card>

          <Card title="3.5 Programy Studiów (Kierunki i Lata)">
            <p>
              Przedmioty dodawane do systemu muszą być powiązane z konkretnym <strong>programem studiów i rokiem</strong>.
              Użytkownicy (np. PLANNER) widzą w oknie przypisywania <strong>tylko programy należące do ich jednostki</strong>.
              Wyjątkiem jest SUPER_ADMIN, który ma dostęp do programów ze wszystkich instytutów na wydziale, ułatwiając tym samym zarządzanie pulą ogólnowydziałową. Etykiety zawierają od teraz kody jednostek, aby łatwiej rozpoznać skąd pochodzi dany kierunek.
            </p>
          </Card>
        </section>

        {/* 4. Przydziały */}
        <section id="allocations" className="scroll-mt-8 space-y-6">
          <SectionHeader icon={Upload} title="4. Przydziały (Alokacje)" />
          <Card title="Mechanizm Alokacji">
            <p>
              Alokacja to fundament systemu. Pamiętaj: <strong>Prowadzący musi być przypisany do konkretnego przedmiotu i grupy</strong>,
              zanim będziesz mógł umieścić te zajęcia na siatce. Alokacja określa również liczbę godzin, które prowadzący ma wypracować.
            </p>
          </Card>
        </section>

        {/* 5. Siatka Zajęć */}
        <section id="grid" className="scroll-mt-8 space-y-6">
          <SectionHeader icon={Grid3X3} title="5. Siatka Zajęć" />
          <Card title="Walidacja i Konflikty" highlight="amber">
            <p className="mb-3 text-amber-800 dark:text-amber-200">System w czasie rzeczywistym blokuje:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Nakładanie się zajęć tego samego prowadzącego.</li>
              <li>Podwójną rezerwację tej samej sali.</li>
              <li>Nakładanie się zajęć tej samej grupy studenckiej.</li>
              <li>Przekroczenie pojemności sali (wyświetla ostrzeżenie).</li>
            </ul>
          </Card>
        </section>

        {/* 6. Kalkulator Pensum */}
        <section id="pensum" className="scroll-mt-8 space-y-6">
          <SectionHeader icon={ClipboardList} title="6. Kalkulator Pensum" />

          <Card title="Kolorystyka Obciążeń" accent>
            <p className="mb-4 text-sm">Kolory w tabeli pensum odzwierciedlają stan obciążenia dydaktycznego:</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-2 bg-status-active-bg border border-status-active-fg/20 rounded-lg">
                <span className="w-4 h-4 rounded-full bg-status-active-bg0" />
                <div>
                  <strong className="text-status-active-fg">Zielony: Idealnie</strong>
                  <p className="text-xs">Godziny wypracowane zgadzają się dokładnie z limitem pensum.</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2 bg-status-warning-bg border border-status-warning-fg/20 rounded-lg">
                <span className="w-4 h-4 rounded-full bg-status-warning-bg0" />
                <div>
                  <strong className="text-status-warning-fg">Żółty: Niedociążenie</strong>
                  <p className="text-xs">Prowadzący ma przypisanych mniej godzin niż wynosi jego pensum.</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2 bg-status-danger-bg border border-status-danger-fg/20 rounded-lg">
                <span className="w-4 h-4 rounded-full bg-status-danger-bg0" />
                <div>
                  <strong className="text-status-danger-fg">Fioletowy: Nadgodziny</strong>
                  <p className="text-xs">Liczba godzin przekracza limit — system automatycznie wylicza saldo dodatnie.</p>
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* 7. Zapotrzebowania Kadrowe */}
        <section id="staffing" className="scroll-mt-8 space-y-6">
          <SectionHeader icon={AlertCircle} title="7. Zapotrzebowania Kadrowe (Wakaty)" color="orange" />

          <Card title="Zgłaszanie Braków" accent>
            <p className="mb-3">Moduł ten służy do oficjalnej komunikacji między Instytutem a Dziekanatem w sprawie wakatów i braków kadrowych do obłożenia przedmiotów.</p>
            <ul className="list-disc list-inside space-y-2 ml-4 text-sm">
              <li>Instytut może złożyć zapotrzebowanie na prowadzącego dla konkretnego przedmiotu, podając brakującą liczbę grup oraz własne uwagi.</li>
              <li>Wniosek automatycznie zyskuje status <strong>OCZEKUJĄCE</strong>.</li>
              <li>Podgląd zgłoszonych wakatów z Twojej jednostki znajduje się w zakładce <em>Zapotrzebowania Kadrowe</em> w głównym menu, wyposażonej w interaktywną tabelę z filtrowaniem i wyszukiwarką.</li>
            </ul>
          </Card>
          
          <Card title="Przetwarzanie przez Wydział">
            <p>
              Z poziomu Panelu Wydziałowego, Władze (lub SUPER_ADMIN) widzą wszystkie zgłoszenia spływające z różnych instytutów. 
              Mogą oni zmieniać status zgłoszenia (np. na <em>W REALIZACJI</em> lub <em>ZREALIZOWANE</em>) oraz dodawać oficjalne odpowiedzi (notatki dziekanatu), które są od razu widoczne dla danego Instytutu.
            </p>
          </Card>
        </section>

        {/* 8. Panel Wydziałowy */}
        <section id="superadmin" className="scroll-mt-8 space-y-6">
          <SectionHeader icon={Crown} title="8. Panel Wydziałowy (SuperAdmin / Dziekan)" color="violet" />

          <Card title="Analityka Wydziałowa">
            <p className="mb-4">
              To centrum dowodzenia dla Władz Wydziału. Pozwala na globalny podgląd wszystkich instytutów w jednym miejscu.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-3 bg-violet-500/5 border border-violet-500/20 rounded-lg">
                <h4 className="font-bold text-violet-700 text-xs uppercase mb-1">Filtry Jednostek</h4>
                <p className="text-xs">Szybkie przełączanie widoku między ILS, IFG, IO i innymi za pomocą interaktywnych kafelków.</p>
              </div>
              <div className="p-3 bg-violet-500/5 border border-violet-500/20 rounded-lg">
                <h4 className="font-bold text-violet-700 text-xs uppercase mb-1">Statusy Obciążeń</h4>
                <p className="text-xs">Możliwość filtrowania tabeli tak, aby zobaczyć tylko osoby z nadgodzinami lub tylko niedociążone.</p>
              </div>
            </div>
          </Card>

          <Card title="Eksport i Druk Danych" highlight="indigo">
            <p className="mb-4">
              W zakładce Zapotrzebowań Kadrowych dla całego wydziału dodano zaawansowane opcje raportowania:
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg flex items-start gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-bold text-blue-700 text-xs uppercase mb-1">Eksport CSV</h4>
                  <p className="text-xs">Możliwość pobrania zapotrzebowań do arkusza kalkulacyjnego (np. Excel) z automatycznym podziałem na kolumny i formatowaniem.</p>
                </div>
              </div>
              <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-lg flex items-start gap-2">
                <Printer className="w-5 h-5 text-indigo-600 mt-0.5" />
                <div>
                  <h4 className="font-bold text-indigo-700 text-xs uppercase mb-1">Widok do druku</h4>
                  <p className="text-xs">Generuje czysty, pozbawiony elementów nawigacyjnych raport z podsumowaniem liczby wakatów per instytut, gotowy do druku fizycznego.</p>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Bezpieczeństwo: Kopie Zapasowe Bazy Danych" highlight="amber">
            <p className="mb-3">
              Wydzielona zakładka "Kopie Zapasowe" pozwala Super Administratorom na przeglądanie archiwalnych snapshotów (kopii) bazy danych generowanych automatycznie przez system.
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4 text-sm text-foreground/80">
              <li>Pobieranie plików .sql.gz bezpośrednio na urządzenie lokalne na żądanie.</li>
              <li>Bezpieczeństwo operacyjne – moduł ten jest rygorystycznie chroniony i niewidoczny dla ról innych niż SUPER_ADMIN.</li>
            </ul>
          </Card>
        </section>

        {/* 9. Administracja */}
        <section id="admin" className="scroll-mt-8 space-y-6">
          <SectionHeader icon={Shield} title="9. Administracja Systemem" />

          <Card title="Uprawnienia i Role">
            <p className="mb-3">Każdy użytkownik ma przypisaną rolę określającą zakres kompetencji:</p>
            <ul className="space-y-2 text-sm">
              <li><strong className="text-violet-600">SUPER_ADMIN</strong> — Pełna kontrola nad wszystkimi instytutami, zarządzanie kopiami zapasowymi.</li>
              <li><strong className="text-indigo-600">DEAN</strong> — Wgląd na poziomie Władz Dziekańskich, obsługa wakatów.</li>
              <li><strong className="text-primary">ADMIN</strong> — Zarządzanie użytkownikami w ramach swojego instytutu.</li>
              <li><strong className="text-status-active-fg">PLANNER</strong> — Edycja planu, słowników i zgłaszanie wakatów.</li>
              <li><strong className="text-muted-foreground">VIEWER</strong> — Tylko podgląd danych.</li>
            </ul>
          </Card>
        </section>

      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, color = 'primary' }: { icon: any; title: string; color?: string }) {
  let colorClass = 'text-primary';
  if (color === 'violet') colorClass = 'text-violet-600 dark:text-violet-400';
  if (color === 'orange') colorClass = 'text-orange-600 dark:text-orange-400';
  
  return (
    <h2 className={`text-2xl font-bold flex items-center gap-3 border-b pb-3 ${colorClass}`}>
      <Icon className="w-6 h-6" /> {title}
    </h2>
  );
}

function Card({ title, children, compact, accent, highlight }: {
  title: string; children: React.ReactNode; compact?: boolean; accent?: boolean; highlight?: string;
}) {
  let borderClass = '';
  let bgClass = 'bg-card';
  if (accent) borderClass = 'border-l-4 border-l-primary';
  if (highlight === 'amber') { bgClass = 'bg-status-warning-bg0/5'; borderClass = 'border-l-4 border-l-amber-500 border-status-warning-fg/20'; }
  if (highlight === 'indigo') { bgClass = 'bg-primary/5'; borderClass = 'border-l-4 border-l-primary border-primary/20'; }

  return (
    <div className={`${bgClass} border rounded-lg ${compact ? 'p-4' : 'p-6'} shadow-sm ${borderClass} space-y-3`}>
      <h3 className={`font-bold ${compact ? 'text-base' : 'text-xl'} text-foreground`}>{title}</h3>
      <div className="text-foreground/80 leading-relaxed text-sm space-y-3">{children}</div>
    </div>
  );
}

export { ManualPage as default };
