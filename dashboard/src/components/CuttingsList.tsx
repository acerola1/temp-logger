import { Sprout } from 'lucide-react';
import { formatDate } from '../lib/dateFormat';
import type { Cutting } from '../types/cutting';
import { plantTypeLabel, statusBadgeClass, statusLabel } from './cuttingsViewUtils';

interface CuttingsListProps {
  cuttings: Cutting[];
  selectedCuttingId: string | null;
  onSelectCutting: (cuttingId: string) => void;
}

export function CuttingsList({ cuttings, selectedCuttingId, onSelectCutting }: CuttingsListProps) {
  return (
    <aside className="space-y-3">
      {cuttings.length === 0 && (
        <div className="rounded-3xl border border-dashed border-vine-300 bg-white/70 p-6 text-sm text-vine-500 dark:border-vine-700 dark:bg-vine-800/40 dark:text-vine-300">
          Még nincs felvitt dugvány.
        </div>
      )}

      {cuttings.map((cutting) => {
        const previewUrl = cutting.photos.at(-1)?.downloadUrl ?? null;
        const isSelected = selectedCuttingId === cutting.id;

        return (
          <button
            key={cutting.id}
            onClick={() => onSelectCutting(cutting.id)}
            className={`w-full rounded-3xl border p-3 text-left transition-colors ${
              isSelected
                ? 'border-vine-500 bg-vine-100/80 dark:border-vine-400 dark:bg-vine-800'
                : 'border-vine-200 bg-white/80 hover:bg-vine-50 dark:border-vine-700 dark:bg-vine-900/40 dark:hover:bg-vine-800/70'
            }`}
          >
            <div className="flex gap-3">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-vine-100 dark:bg-vine-800">
                {previewUrl ? (
                  <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Sprout className="h-8 w-8 text-vine-400 dark:text-vine-300" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-vine-500 dark:text-vine-300">
                      #{cutting.serialNumber}
                    </div>
                    <h3 className="truncate text-sm font-semibold text-vine-900 dark:text-vine-50">
                      {cutting.variety}
                    </h3>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${statusBadgeClass(cutting.status)}`}
                  >
                    {statusLabel(cutting.status)}
                  </span>
                </div>

                <p className="mt-1 text-xs text-vine-500 dark:text-vine-300">
                  {plantTypeLabel(cutting.plantType)}
                </p>
                <p className="mt-1 text-xs text-vine-500 dark:text-vine-300">
                  Ültetve: {formatDate(cutting.plantedAt)}
                </p>
                <p className="mt-1 text-xs text-vine-500 dark:text-vine-300">{cutting.photos.length} kép</p>
              </div>
            </div>
          </button>
        );
      })}
    </aside>
  );
}
