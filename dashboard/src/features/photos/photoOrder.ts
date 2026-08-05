import type { Photo } from './photoMetadata';

const LEGACY_UNKNOWN_TIME = 0;

interface IndexedPhoto<TPhoto extends Photo> {
  photo: TPhoto;
  sourceIndex: number;
}

function timestamp(value: string | null): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) && parsed > LEGACY_UNKNOWN_TIME ? parsed : null;
}

/**
 * A fotó valós megjelenítési ideje. A régi mapper epoch-fallbackje nem valódi
 * feltöltési idő, ezért ugyanúgy ismeretlen, mint egy érvénytelen dátum.
 */
export function photoDisplayTime(photo: Pick<Photo, 'capturedAt' | 'uploadedAt'>): number | null {
  return timestamp(photo.capturedAt) ?? timestamp(photo.uploadedAt);
}

/**
 * Legújabb fotó elöl. Az ismeretlen idejű legacy rekordok a végén maradnak,
 * egymás között a tárolt sorrendjüket őrzik.
 */
export function sortPhotosNewestFirst<TPhoto extends Photo>(
  photos: readonly TPhoto[],
): TPhoto[] {
  return photos
    .map((photo, sourceIndex): IndexedPhoto<TPhoto> => ({ photo, sourceIndex }))
    .sort((left, right) => {
      const leftTime = photoDisplayTime(left.photo);
      const rightTime = photoDisplayTime(right.photo);

      if (leftTime === null || rightTime === null) {
        if (leftTime === null && rightTime === null) {
          return left.sourceIndex - right.sourceIndex;
        }
        return leftTime === null ? 1 : -1;
      }

      if (leftTime !== rightTime) return rightTime - leftTime;

      const leftUploadedAt = timestamp(left.photo.uploadedAt) ?? LEGACY_UNKNOWN_TIME;
      const rightUploadedAt = timestamp(right.photo.uploadedAt) ?? LEGACY_UNKNOWN_TIME;
      if (leftUploadedAt !== rightUploadedAt) return rightUploadedAt - leftUploadedAt;

      return right.photo.id.localeCompare(left.photo.id);
    })
    .map(({ photo }) => photo);
}

export interface ResolvedPhotoCover<TPhoto extends Photo> {
  photo: TPhoto;
  isPinned: boolean;
}

/** A kijelölt fotó, vagy érvénytelen/null kijelölésnél a rendezés első eleme. */
export function resolvePhotoCover<TPhoto extends Photo>(
  sortedPhotos: readonly TPhoto[],
  pinnedPhotoId: string | null,
): ResolvedPhotoCover<TPhoto> | null {
  const pinned = pinnedPhotoId
    ? sortedPhotos.find((photo) => photo.id === pinnedPhotoId) ?? null
    : null;

  if (pinned) return { photo: pinned, isPinned: true };
  const automatic = sortedPhotos[0] ?? null;
  return automatic ? { photo: automatic, isPinned: false } : null;
}
