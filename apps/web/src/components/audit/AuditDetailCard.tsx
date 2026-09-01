import React, { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  User, BookOpen, Clock, Building2, Users, Calendar,
  ArrowRight, ChevronDown, ChevronUp, Copy, Check,
  ExternalLink, FileCode, CheckCircle2, AlertCircle, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  parseAndGroupStudentGroups,
  extractFieldDiffs,
  ACTION_LABELS,
  ENTITY_LABELS,
  FIELD_LABELS,
  getAuditSummary,
} from '../../utils/auditFormatters';

interface AuditDetailCardProps {
  log: {
    id: string;
    timestamp: string;
    userId: string | null;
    userEmail: string | null;
    action: string;
    entityType: string | null;
    entityId: string | null;
    oldData: any;
    newData: any;
    ipAddress: string | null;
    userAgent: string | null;
    requestId: string | null;
    metadata: any;
  };
}

export function AuditDetailCard({ log }: AuditDetailCardProps) {
  const [showRawJson, setShowRawJson] = useState(false);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const data = log.newData || log.oldData || {};
  const isUpdate = log.action === 'UPDATE';
  const diffs = isUpdate ? extractFieldDiffs(log.oldData, log.newData) : [];
  const summary = getAuditSummary(log);

  const handleCopyJson = () => {
    const jsonStr = JSON.stringify({
      logId: log.id,
      timestamp: log.timestamp,
      user: log.userEmail,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      oldData: log.oldData,
      newData: log.newData,
      metadata: log.metadata,
    }, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      {/* ─── 1. Główny baner podsumowania zdarzenia ─── */}
      <div className="rounded-xl border bg-gradient-to-r from-primary/[0.04] to-primary/[0.01] p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${ACTION_LABELS[log.action]?.color || 'bg-muted'}`}>
              {ACTION_LABELS[log.action]?.label || log.action}
            </span>
            {log.entityType && (
              <span className="text-xs font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">
                {ENTITY_LABELS[log.entityType] || log.entityType}
              </span>
            )}
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            {new Date(log.timestamp).toLocaleString('pl-PL')}
          </span>
        </div>

        <h3 className="text-base font-bold text-foreground">
          {summary.title}
        </h3>
        {summary.details && (
          <p className="text-xs text-muted-foreground mt-1 font-medium">
            {summary.details}
          </p>
        )}
      </div>

      {/* ─── 2. Karta dedykowana: CourseAllocation (Przydział) ─── */}
      {log.entityType === 'CourseAllocation' && (
        <CourseAllocationView data={data} oldData={log.oldData} isUpdate={isUpdate} />
      )}

      {/* ─── 3. Karta dedykowana: ScheduleEntry (Harmonogram) ─── */}
      {log.entityType === 'ScheduleEntry' && (
        <ScheduleEntryView data={data} oldData={log.oldData} isUpdate={isUpdate} />
      )}

      {/* ─── 4. Karta dedykowana: Teacher (Prowadzący) ─── */}
      {log.entityType === 'Teacher' && (
        <TeacherView data={data} />
      )}

      {/* ─── 5. Karta dedykowana: Course (Przedmiot) ─── */}
      {log.entityType === 'Course' && (
        <CourseView data={data} />
      )}

      {/* ─── 6. Karta dedykowana: Room (Sala) ─── */}
      {log.entityType === 'Room' && (
        <RoomView data={data} />
      )}

      {/* ─── 7. Karta dedykowana: User (Użytkownik) ─── */}
      {log.entityType === 'User' && (
        <UserView data={data} metadata={log.metadata} action={log.action} />
      )}

      {/* ─── 8. Karta porównania zmian dla operacji UPDATE ─── */}
      {isUpdate && diffs.length > 0 && (
        <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            Zmodyfikowane właściwości ({diffs.length})
          </div>
          <div className="border rounded-lg overflow-hidden divide-y text-xs">
            {diffs.map(diff => (
              <div key={diff.key} className="grid grid-cols-1 sm:grid-cols-3 p-2.5 gap-2 items-center hover:bg-muted/30">
                <span className="font-semibold text-foreground">{diff.label}</span>
                <span className="text-red-600 bg-red-50 dark:bg-red-950/30 px-2 py-1 rounded font-mono truncate">
                  {diff.oldValue}
                </span>
                <div className="flex items-center gap-2">
                  <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0 hidden sm:block" />
                  <span className="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded font-mono font-bold truncate">
                    {diff.newValue}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── 9. Metadane techniczne (Kto, IP, Request ID) ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-lg bg-muted/20 border text-[11px]">
        <div>
          <span className="text-muted-foreground block text-[10px] uppercase font-bold">Użytkownik</span>
          <span className="font-semibold truncate block" title={log.userEmail || log.userId || ''}>
            {log.userEmail || log.userId?.slice(0, 8) || '—'}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[10px] uppercase font-bold">Adres IP</span>
          <span className="font-mono text-muted-foreground block">{log.ipAddress || '—'}</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[10px] uppercase font-bold">ID Obiektu</span>
          <span className="font-mono text-muted-foreground block truncate" title={log.entityId || ''}>
            {log.entityId ? `#${log.entityId.slice(0, 8)}` : '—'}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[10px] uppercase font-bold">Request ID</span>
          <span className="font-mono text-muted-foreground block truncate" title={log.requestId || ''}>
            {log.requestId ? log.requestId.slice(0, 8) : '—'}
          </span>
        </div>
      </div>

      {/* ─── 10. Nawigacja do obiektu ─── */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t">
        <div className="flex gap-2">
          {log.entityType === 'Course' || log.entityType === 'CourseAllocation' ? (
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 gap-1.5"
              onClick={() => navigate({ to: '/dictionary/courses' as any })}
            >
              <BookOpen className="w-3.5 h-3.5 text-primary" />
              Otwórz słownik przedmiotów
            </Button>
          ) : log.entityType === 'Teacher' ? (
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 gap-1.5"
              onClick={() => navigate({ to: '/dictionary/teachers' as any })}
            >
              <Users className="w-3.5 h-3.5 text-primary" />
              Otwórz słownik prowadzących
            </Button>
          ) : log.entityType === 'ScheduleEntry' ? (
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 gap-1.5"
              onClick={() => navigate({ to: '/harmonogram' as any })}
            >
              <Calendar className="w-3.5 h-3.5 text-primary" />
              Otwórz harmonogram zajęć
            </Button>
          ) : null}
        </div>

        {/* Przełącznik surowego JSON */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-8 text-muted-foreground gap-1.5"
            onClick={() => setShowRawJson(!showRawJson)}
          >
            <FileCode className="w-3.5 h-3.5" />
            {showRawJson ? 'Ukryj surowy JSON' : 'Pokaż surowy JSON'}
            {showRawJson ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
        </div>
      </div>

      {/* ─── 11. Sekcja surowego JSON-a (zwijana) ─── */}
      {showRawJson && (
        <div className="rounded-xl border bg-muted/40 p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between pb-2 border-b">
            <span className="font-mono text-[10px] uppercase font-bold text-muted-foreground">
              Inspekcja danych JSON
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px] gap-1"
              onClick={handleCopyJson}
            >
              {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Skopiowano!' : 'Kopiuj całość'}
            </Button>
          </div>

          {log.oldData && (
            <div>
              <p className="text-[10px] font-bold text-red-500 mb-1 uppercase">PRZED zmianą (oldData):</p>
              <pre className="bg-red-50/50 dark:bg-red-950/20 border border-red-200/50 rounded p-2 text-[11px] font-mono overflow-x-auto max-h-[160px]">
                {JSON.stringify(log.oldData, null, 2)}
              </pre>
            </div>
          )}

          {log.newData && (
            <div>
              <p className="text-[10px] font-bold text-emerald-500 mb-1 uppercase">PO zmianie (newData):</p>
              <pre className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 rounded p-2 text-[11px] font-mono overflow-x-auto max-h-[160px]">
                {JSON.stringify(log.newData, null, 2)}
              </pre>
            </div>
          )}

          {log.metadata && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground mb-1 uppercase">Metadane:</p>
              <pre className="bg-background border rounded p-2 text-[11px] font-mono overflow-x-auto">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Podkomponenty kart dedykowanych ─────────────────────────────────────────

function CourseAllocationView({ data }: { data: any; oldData?: any; isUpdate?: boolean }) {
  const teacher = data.teacher || {};
  const teacherFullName = `${teacher.title || ''} ${teacher.firstName || ''} ${teacher.lastName || ''}`.trim() || '—';
  const groupsSummary = parseAndGroupStudentGroups(data.groups || []);
  const totalGroupsCount = Array.isArray(data.groups) ? data.groups.length : 0;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4 shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Prowadzący */}
        <div className="p-3 bg-muted/20 rounded-lg border space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-primary font-bold">
            <User className="w-3.5 h-3.5" />
            Prowadzący
          </div>
          <p className="text-sm font-bold text-foreground">{teacherFullName}</p>
          {teacher.unit && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Building2 className="w-3 h-3 text-muted-foreground" />
              {teacher.unit}
            </p>
          )}
          {teacher.email && (
            <p className="text-xs font-mono text-muted-foreground">{teacher.email}</p>
          )}
        </div>

        {/* Wymiar godzin */}
        <div className="p-3 bg-muted/20 rounded-lg border space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-primary font-bold">
            <Clock className="w-3.5 h-3.5" />
            Wymiar i typ zajęć
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black text-foreground">
              {data.assignedHours ? `${data.assignedHours} godz.` : '30 godz.'}
            </span>
            {data.classType && (
              <span className="text-xs font-bold uppercase bg-primary/10 text-primary px-2 py-0.5 rounded">
                Typ: {data.classType}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">Liczba przydzielonych godzin w semestrze</p>
        </div>
      </div>

      {/* Grupy studenckie */}
      {groupsSummary.length > 0 && (
        <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-1.5 text-foreground">
              <Users className="w-3.5 h-3.5 text-primary" />
              Przypisane grupy ({totalGroupsCount})
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {groupsSummary.map(item => (
              <div key={`${item.majorCode}-${item.year}`} className="p-2.5 rounded-lg bg-primary/[0.03] border border-primary/10">
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="text-xs font-bold text-primary">
                    {item.majorCode} {item.year ? `(rok ${item.year})` : ''}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {item.groups.length} {item.groups.length === 1 ? 'grupa' : 'grupy'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {item.groups.map(gr => (
                    <span key={gr} className="text-[11px] bg-background border px-1.5 py-0.5 rounded font-mono font-medium">
                      {gr}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ScheduleEntryView({ data }: { data: any; oldData?: any; isUpdate?: boolean }) {
  const DAY_NAMES = ['', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];
  const dayName = data.dayOfWeek ? DAY_NAMES[data.dayOfWeek] || `Dzień ${data.dayOfWeek}` : '—';
  const timeStr = data.startTime && data.endTime ? `${data.startTime} - ${data.endTime}` : '—';
  const weekLabel = data.weekType === 'AB' ? 'Co tydzień (AB)' : `Tydzień ${data.weekType || 'AB'}`;
  const teacherName = data.teacher
    ? `${data.teacher.title || ''} ${data.teacher.firstName || ''} ${data.teacher.lastName || ''}`.trim()
    : 'Brak przypisania';
  const roomName = data.room ? `Sala ${data.room.number} ${data.room.building ? `(${data.room.building})` : ''}` : 'Brak sali';
  const courseName = data.course?.name || data.courseName || 'Przedmiot';

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 bg-muted/20 rounded-lg border">
          <span className="text-[10px] font-bold uppercase text-muted-foreground block">Termin zajęć</span>
          <p className="text-sm font-bold text-foreground mt-0.5">{dayName}, {timeStr}</p>
          <span className="text-xs text-primary font-semibold">{weekLabel}</span>
        </div>

        <div className="p-3 bg-muted/20 rounded-lg border">
          <span className="text-[10px] font-bold uppercase text-muted-foreground block">Prowadzący & Sala</span>
          <p className="text-sm font-bold text-foreground mt-0.5">{teacherName}</p>
          <p className="text-xs text-muted-foreground">{roomName}</p>
        </div>

        <div className="p-3 bg-muted/20 rounded-lg border">
          <span className="text-[10px] font-bold uppercase text-muted-foreground block">Przedmiot</span>
          <p className="text-sm font-bold text-foreground mt-0.5 truncate" title={courseName}>{courseName}</p>
          {data.classType && (
            <span className="text-xs font-bold uppercase text-primary">Typ: {data.classType}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function TeacherView({ data }: { data: any }) {
  const fullName = `${data.title || ''} ${data.firstName || ''} ${data.lastName || ''}`.trim() || '—';
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-primary/10 rounded-full text-primary">
          <User className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-base font-bold text-foreground">{fullName}</h4>
          <p className="text-xs text-muted-foreground">{data.email || 'Brak adresu e-mail'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t text-xs">
        <div>
          <span className="text-muted-foreground block text-[10px] uppercase font-bold">Jednostka</span>
          <span className="font-semibold">{data.unit || '—'}</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[10px] uppercase font-bold">Limit pensum</span>
          <span className="font-semibold">{data.pensumLimit ? `${data.pensumLimit} godz.` : '210 godz.'}</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[10px] uppercase font-bold">Tytuł/Stopień</span>
          <span className="font-semibold">{data.title || '—'}</span>
        </div>
      </div>
    </div>
  );
}

function CourseView({ data }: { data: any }) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-primary/10 rounded-full text-primary">
          <BookOpen className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-base font-bold text-foreground">{data.name || '—'}</h4>
          <p className="text-xs font-mono text-muted-foreground">{data.code || 'Brak kodu'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t text-xs">
        <div>
          <span className="text-muted-foreground block text-[10px] uppercase font-bold">Typ zajęć</span>
          <span className="font-semibold uppercase">{data.type || '—'}</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[10px] uppercase font-bold">Liczba godzin</span>
          <span className="font-semibold">{data.hoursTotal ? `${data.hoursTotal}h` : '—'}</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[10px] uppercase font-bold">Punkty ECTS</span>
          <span className="font-semibold">{data.ectsCredits ?? '—'}</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[10px] uppercase font-bold">Liczba grup</span>
          <span className="font-semibold">{data.targetGroupsCount ?? 1}</span>
        </div>
      </div>
    </div>
  );
}

function RoomView({ data }: { data: any }) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground block text-[10px] uppercase font-bold">Numer sali</span>
          <span className="font-bold text-sm">{data.number || '—'}</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[10px] uppercase font-bold">Budynek</span>
          <span className="font-semibold">{data.building || '—'}</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[10px] uppercase font-bold">Pojemność</span>
          <span className="font-semibold">{data.capacity ? `${data.capacity} miejsc` : '—'}</span>
        </div>
      </div>
    </div>
  );
}

function UserView({ data, metadata, action }: { data: any; metadata: any; action: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-primary/10 rounded-full text-primary">
          <User className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-base font-bold text-foreground">{data.name || metadata?.email || '—'}</h4>
          <p className="text-xs text-muted-foreground">{data.email || metadata?.email || '—'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
        <div>
          <span className="text-muted-foreground block text-[10px] uppercase font-bold">Rola</span>
          <span className="font-bold text-primary">{data.role || metadata?.role || '—'}</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[10px] uppercase font-bold">Typ operacji</span>
          <span className="font-semibold">{action}</span>
        </div>
      </div>
    </div>
  );
}
