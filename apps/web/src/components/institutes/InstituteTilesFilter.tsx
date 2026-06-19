import { getInstituteShortLabel } from '../../utils/instituteLabels';

type InstituteFilterItem = {
  id: string;
  name: string;
  shortCode?: string | null;
  count?: number;
};

interface InstituteTilesFilterProps {
  items: InstituteFilterItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  allCount?: number;
  allLabel?: string;
  className?: string;
}

export function InstituteTilesFilter({
  items,
  selectedId,
  onSelect,
  allCount,
  allLabel = 'Wszystkie',
  className = '',
}: InstituteTilesFilterProps) {
  return (
    <div className={`rounded-lg border bg-card p-3 shadow-sm ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => onSelect('all')}
          className={`rounded-md border px-3 py-1.5 text-xs font-bold transition-all ${
            selectedId === 'all'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-muted-foreground hover:bg-muted'
          }`}
        >
          {allLabel}
          {typeof allCount === 'number' ? ` (${allCount})` : ''}
        </button>

        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`rounded-md border px-3 py-1.5 text-xs font-bold transition-all ${
              selectedId === item.id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground hover:bg-muted'
            }`}
            title={item.name}
          >
            {getInstituteShortLabel(item.name, item.shortCode)}
            {typeof item.count === 'number' ? ` (${item.count})` : ''}
          </button>
        ))}
      </div>
    </div>
  );
}
