import type { Vine, VineRootType, VineStatus } from '../model';

interface VinesListProps {
  vines: readonly Vine[];
  selectedVineId: string | null;
  loading: boolean;
  error: string | null;
  hasVines: boolean;
  onSelectVine: (vineId: string) => void;
}

const ROOT_TYPE_PRESENTATION: Record<VineRootType, { label: string; badgeClass: string }> = {
  grafted: {
    label: 'Oltott',
    badgeClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
  },
  own_rooted: {
    label: 'Saját gyökerű',
    badgeClass: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200',
  },
  unknown: {
    label: 'Ismeretlen gyökérzet',
    badgeClass: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100',
  },
};

function statusLabel(value: VineStatus): string {
  return value === 'ceased' ? 'Megszűnt' : 'Aktív';
}

function statusBadgeClass(value: VineStatus): string {
  return value === 'ceased'
    ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
    : 'bg-vine-100 text-vine-800 dark:bg-vine-800 dark:text-vine-100';
}

const TAG_BADGE_PALETTE: readonly string[] = [
  'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
  'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
  'bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-200',
  'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200',
  'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-200',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
];

function tagBadgeClass(value: string): string {
  const normalized = value.trim().toLocaleLowerCase('hu');
  let hash = 5381;

  for (let index = 0; index < normalized.length; index += 1) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(index)) | 0;
  }

  return TAG_BADGE_PALETTE[Math.abs(hash) % TAG_BADGE_PALETTE.length];
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
          className="h-[94px] animate-pulse rounded-3xl border border-vine-200 bg-white/60 dark:border-vine-700 dark:bg-vine-900/40"
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
        const rootTypePresentation = ROOT_TYPE_PRESENTATION[vine.rootType];

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
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-vine-500 dark:text-vine-300">
                  #{vine.serialNumber}
                </div>
                <h3 className="truncate text-sm font-semibold text-vine-900 dark:text-vine-50">
                  {vine.variety}
                </h3>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${statusBadgeClass(vine.status)}`}>
                {statusLabel(vine.status)}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-1">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${rootTypePresentation.badgeClass}`}>
                {rootTypePresentation.label}
              </span>
              {vine.tags.map((tag) => (
                <span key={tag} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tagBadgeClass(tag)}`}>
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
