import { Sprout } from 'lucide-react';
// A `photos` almodulját közvetlenül importáljuk, nem az indexen át: a lista így
// nem húzza be a feltöltő hook Firebase-szingletonját.
import { photoThumbnailUrl } from '../../photos/photoMetadata';
import type { Vine } from '../model';
import { resolveVineCoverPhoto } from '../vineCoverPhoto';
import {
  ROOT_TYPE_PRESENTATION,
  statusBadgeClass,
  statusLabel,
  tagBadgeClass,
} from './vinePresentation';

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
        const rootTypePresentation = ROOT_TYPE_PRESENTATION[vine.rootType];
        const coverPhoto = resolveVineCoverPhoto(vine);

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
            <div className="flex gap-3">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-vine-100 dark:bg-vine-800">
                {coverPhoto ? (
                  // A keret 80 px-es, ezért a bélyeg elég ide. A fix méret és a
                  // lusta töltés együtt tartja alacsonyan a lista forgalmát: a
                  // képernyőn kívüli kártyák képe csak görgetésre jön le.
                  <img
                    src={photoThumbnailUrl(coverPhoto.photo)}
                    alt=""
                    width={80}
                    height={80}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Sprout className="h-8 w-8 text-vine-400 dark:text-vine-300" />
                )}
              </div>

              <div className="min-w-0 flex-1">
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
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
