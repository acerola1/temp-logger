import type { Vine } from '../types/vine';
import {
  rootstockBadgeClass,
  rootstockTypeLabel,
  vineStatusBadgeClass,
  vineStatusLabel,
  vineTagBadgeClass,
} from './vinesViewUtils';

interface VinesListProps {
  vines: Vine[];
  selectedVineId: string | null;
  onSelectVine: (vineId: string) => void;
  emptyMessage?: string;
}

export function VinesList({
  vines,
  selectedVineId,
  onSelectVine,
  emptyMessage = 'Még nincs felvitt tőke.',
}: VinesListProps) {
  return (
    <div className="space-y-3">
      {vines.length === 0 && (
        <div className="rounded-3xl border border-dashed border-vine-300 bg-white/70 p-6 text-sm text-vine-500 dark:border-vine-700 dark:bg-vine-800/40 dark:text-vine-300">
          {emptyMessage}
        </div>
      )}

      {vines.map((vine) => {
        const isSelected = selectedVineId === vine.id;

        return (
          <button
            key={vine.id}
            data-testid="vine-card"
            onClick={() => onSelectVine(vine.id)}
            className={`w-full rounded-3xl border p-3 text-left transition-colors ${
              isSelected
                ? 'border-vine-500 bg-vine-100/80 dark:border-vine-400 dark:bg-vine-800'
                : 'border-vine-200 bg-white/80 hover:bg-vine-50 dark:border-vine-700 dark:bg-vine-900/40 dark:hover:bg-vine-800/70'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-vine-500 dark:text-vine-300">
                  #{vine.serialNumber}
                </div>
                <h3 className="truncate text-sm font-semibold text-vine-900 dark:text-vine-50">
                  {vine.variety}
                </h3>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${vineStatusBadgeClass(vine.status)}`}
              >
                {vineStatusLabel(vine.status)}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-1">
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${rootstockBadgeClass(vine.rootstockType)}`}
              >
                {rootstockTypeLabel(vine.rootstockType)}
              </span>
              {vine.tags.map((tag) => (
                <span
                  key={tag}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${vineTagBadgeClass(tag)}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
