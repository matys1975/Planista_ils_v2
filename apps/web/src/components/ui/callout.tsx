import { Info, Lightbulb, AlertTriangle, AlertOctagon } from 'lucide-react';

type CalloutType = 'info' | 'tip' | 'warning' | 'danger';

const styles: Record<CalloutType, { bg: string; border: string; icon: React.ReactNode; label: string }> = {
  info:    { bg: 'bg-status-info-bg border-status-info-fg/30', border: 'border-l-status-info-fg', icon: <Info className="w-5 h-5 text-status-info-fg" />, label: 'Informacja' },
  tip:     { bg: 'bg-status-active-bg border-status-active-fg/30', border: 'border-l-status-active-fg', icon: <Lightbulb className="w-5 h-5 text-status-active-fg" />, label: 'Wskazówka' },
  warning: { bg: 'bg-status-warning-bg border-status-warning-fg/30', border: 'border-l-status-warning-fg', icon: <AlertTriangle className="w-5 h-5 text-status-warning-fg" />, label: 'Uwaga' },
  danger:  { bg: 'bg-status-danger-bg border-status-danger-fg/30', border: 'border-l-status-danger-fg', icon: <AlertOctagon className="w-5 h-5 text-status-danger-fg" />, label: 'Ważne' },
};

export function Callout({ type = 'info', children }: { type?: CalloutType; children: React.ReactNode }) {
  const s = styles[type];
  return (
    <div className={`rounded-lg border border-l-4 p-4 ${s.bg} ${s.border}`}>
      <div className="flex items-center gap-2 font-semibold text-sm mb-1">{s.icon} {s.label}</div>
      <div className="text-sm text-foreground/80 leading-relaxed">{children}</div>
    </div>
  );
}
