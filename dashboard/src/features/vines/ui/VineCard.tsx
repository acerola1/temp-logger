import { Sprout } from 'lucide-react';
// A `photos` almodulját közvetlenül importáljuk, nem az indexen át: a kártya így
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

// Egy tőke kártyatartalma: borítóbélyeg, sorszám, fajta, állapot- és
// gyökérzetjelvény, címkék. Szándékosan nincs benne interakció és külső elem —
// a lapon navigáló gomb, a célválasztóban checkboxos label a burkolója.
export function VineCard({ vine }: { vine: Vine }) {
  const rootTypePresentation = ROOT_TYPE_PRESENTATION[vine.rootType];
  const coverPhoto = resolveVineCoverPhoto(vine);

  return (
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
  );
}
