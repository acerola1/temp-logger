import type { Vine } from '../model';
import { VineCard } from './VineCard';

interface VinesListProps {
  vines: readonly Vine[];
  selectedVineId: string | null;
  loading: boolean;
  error: string | null;
  hasVines: boolean;
  onSelectVine: (vineId: string) => void;
}

function Message({ children, tone = 'empty' }: { children: React.ReactNode; tone?: 'empty' | 'error' }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-3xl border p-6 text-sm ${
        tone === 'error'
          ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200'
          : 'border-dashed border-vine-300 bg-white/70 text-vine-500 dark:border-vine-700 dark:bg-vine-800/40 dark:text-vine-300'
      }`}
    >
      {children}
    </div>
  );
}

function LoadingCards() {
  return (
    <div role="status" aria-label="Tőkék betöltése" className="space-y-3">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="h-[104px] animate-pulse rounded-3xl border border-vine-200 bg-white/60 dark:border-vine-700 dark:bg-vine-900/40"
        />
      ))}
      <span className="sr-only">Tőkék betöltése...</span>
    </div>
  );
}

export function VinesList({
  vines,
  selectedVineId,
  loading,
  error,
  hasVines,
  onSelectVine,
}: VinesListProps) {
  if (loading) return <LoadingCards />;
  if (error) return <Message tone="error">{error}</Message>;
  if (!hasVines) return <Message>Még nincs felvitt tőke.</Message>;
  if (vines.length === 0) return <Message>Nincs találat a megadott szűrőkkel.</Message>;

  return (
    <div className="space-y-3" aria-label="Tőkelista">
      {vines.map((vine) => {
        const isSelected = selectedVineId === vine.id;

        return (
          <button
            key={vine.id}
            type="button"
            data-testid="vine-card"
            aria-pressed={isSelected}
            onClick={() => onSelectVine(vine.id)}
            className={`w-full rounded-3xl border p-3 text-left transition-colors ${
              isSelected
                ? 'border-vine-500 bg-vine-100/80 ring-1 ring-vine-500/20 dark:border-vine-400 dark:bg-vine-800'
                : 'border-vine-200 bg-white/80 hover:bg-vine-50 dark:border-vine-700 dark:bg-vine-900/40 dark:hover:bg-vine-800/70'
            }`}
          >
            <VineCard vine={vine} />
          </button>
        );
      })}
    </div>
  );
}
