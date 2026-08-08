import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Images,
  Loader2,
  Pencil,
  Star,
  Trash2,
} from 'lucide-react';
import { formatMonthDay } from '../../../lib/dateFormat';
import { DEFAULT_MAX_SELECTED_PHOTOS } from '../photoSelection';
import {
  photoDisplayCaption,
  photoDisplayDateText,
  photoDisplayTime,
  resolvePhotoCover,
  sortPhotosNewestFirst,
} from '../photoOrder';
import {
  photoDateLabel,
  photoDateText,
  photoThumbnailUrl,
  type Photo,
} from '../photoMetadata';
import { PhotoLightbox, type PhotoLightboxImage } from './PhotoLightbox';
import { PhotoPickerButtons } from './PhotoPickerButtons';

const SMALL_BUTTON_CLASS =
  'inline-flex items-center gap-1 rounded-lg border border-vine-200 bg-white px-2.5 py-1.5 text-xs font-medium text-vine-700 transition-colors hover:bg-vine-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800';
const DELETE_BUTTON_CLASS =
  'inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-red-900 dark:bg-vine-900 dark:text-red-300 dark:hover:bg-red-950/30';

export interface PhotoGalleryCoverControls {
  pinnedPhotoId: string | null;
  onPin: (photoId: string | null) => Promise<void>;
}

export interface PendingPhoto {
  jobId: string;
  photoId: string;
  fileName: string;
  status: 'queued' | 'preparing' | 'uploading' | 'committing' | 'awaiting-sync' | 'failed';
  progress: number;
  previewUrl: string | null;
  error: string | null;
}

export interface PhotoGalleryProps {
  galleryId: string;
  photos: readonly Photo[];
  alt: string;
  isAdmin: boolean;
  busy?: boolean;
  errorMessage?: string | null;
  highlightedPhotoId?: string | null;
  maxSelectionCount?: number;
  emptyMessage?: string;
  lightboxLabel?: string;
  cover?: PhotoGalleryCoverControls;
  pendingPhotos?: readonly PendingPhoto[];
  onAddPhotos: (files: File[]) => void | Promise<void>;
  onDeletePhoto: (photoId: string) => Promise<void>;
  onEditCaption: (photoId: string, caption: string) => Promise<void>;
  onRetryPendingPhoto?: (jobId: string) => void;
  onCancelPendingPhoto?: (jobId: string) => void;
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function PhotoGallery({
  galleryId,
  photos,
  alt,
  isAdmin,
  busy = false,
  errorMessage = null,
  highlightedPhotoId = null,
  maxSelectionCount = DEFAULT_MAX_SELECTED_PHOTOS,
  emptyMessage = 'Még nincs feltöltött kép.',
  lightboxLabel = 'Fotó',
  cover,
  pendingPhotos = [],
  onAddPhotos,
  onDeletePhoto,
  onEditCaption,
  onRetryPendingPhoto,
  onCancelPendingPhoto,
}: PhotoGalleryProps) {
  const sortedPhotos = useMemo(() => sortPhotosNewestFirst(photos), [photos]);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [pinningPhotoId, setPinningPhotoId] = useState<string | null>(null);
  const [captionPhotoId, setCaptionPhotoId] = useState<string | null>(null);
  const [captionDraft, setCaptionDraft] = useState('');
  const [isSavingCaption, setIsSavingCaption] = useState(false);
  const previousGalleryId = useRef(galleryId);
  const previousPhotoIds = useRef(new Set(sortedPhotos.map(({ id }) => id)));

  const activePhoto =
    sortedPhotos.find((photo) => photo.id === activePhotoId) ?? sortedPhotos[0] ?? null;
  const activePhotoIndex = activePhoto
    ? sortedPhotos.findIndex((photo) => photo.id === activePhoto.id)
    : -1;
  const resolvedCover = cover
    ? resolvePhotoCover(sortedPhotos, cover.pinnedPhotoId)
    : null;
  const automaticCover = cover ? sortedPhotos[0] ?? null : null;
  const pinnedCover = resolvedCover?.isPinned ? resolvedCover.photo : null;

  const lightboxImages = useMemo<PhotoLightboxImage[]>(
    () =>
      sortedPhotos.map((photo) => ({
        id: photo.id,
        url: photo.downloadUrl,
        alt,
        caption: photoDisplayCaption(photo),
      })),
    [alt, sortedPhotos],
  );

  const photoDateBadges = useMemo(
    () =>
      new Map(
        sortedPhotos.flatMap((photo) => {
          if (photoDisplayTime(photo) === null) return [];
          const label = photoDateLabel(photo);
          return [[photo.id, {
            isCaptured: label.isCaptured,
            badge: formatMonthDay(label.value),
            title: photoDateText(photo),
          }] as const];
        }),
      ),
    [sortedPhotos],
  );

  useEffect(() => {
    const galleryChanged = previousGalleryId.current !== galleryId;
    const newPhoto = sortedPhotos.find((photo) => !previousPhotoIds.current.has(photo.id));

    if (galleryChanged || newPhoto) {
      setActivePhotoId(newPhoto?.id ?? sortedPhotos[0]?.id ?? null);
      setIsLightboxOpen(false);
      setCaptionPhotoId(null);
      setLocalError(null);
    } else if (activePhotoId && !sortedPhotos.some((photo) => photo.id === activePhotoId)) {
      setActivePhotoId(sortedPhotos[0]?.id ?? null);
      setCaptionPhotoId(null);
    }

    previousGalleryId.current = galleryId;
    previousPhotoIds.current = new Set(sortedPhotos.map(({ id }) => id));
  }, [activePhotoId, galleryId, sortedPhotos]);

  const goToPreviousPhoto = useCallback(() => {
    if (sortedPhotos.length <= 1 || activePhotoIndex < 0) return;
    const previousIndex = (activePhotoIndex - 1 + sortedPhotos.length) % sortedPhotos.length;
    setActivePhotoId(sortedPhotos[previousIndex]?.id ?? null);
  }, [activePhotoIndex, sortedPhotos]);

  const goToNextPhoto = useCallback(() => {
    if (sortedPhotos.length <= 1 || activePhotoIndex < 0) return;
    const nextIndex = (activePhotoIndex + 1) % sortedPhotos.length;
    setActivePhotoId(sortedPhotos[nextIndex]?.id ?? null);
  }, [activePhotoIndex, sortedPhotos]);

  const addPhotos = async (files: File[]) => {
    const accepted = files.slice(0, Math.max(0, maxSelectionCount));
    const rejectedCount = files.length - accepted.length;
    setLocalError(
      rejectedCount > 0
        ? `Legfeljebb ${maxSelectionCount} fotó választható ki, ${rejectedCount} kép kimaradt.`
        : null,
    );
    if (accepted.length === 0) return;

    try {
      await onAddPhotos(accepted);
    } catch (error) {
      setLocalError(errorText(error, 'Nem sikerült feltölteni a képeket.'));
    }
  };

  const deletePhoto = async () => {
    if (!activePhoto || deletingPhotoId || !window.confirm('Biztosan törlöd ezt a képet?')) return;
    setLocalError(null);
    setDeletingPhotoId(activePhoto.id);
    try {
      await onDeletePhoto(activePhoto.id);
      if (captionPhotoId === activePhoto.id) setCaptionPhotoId(null);
    } catch (error) {
      setLocalError(errorText(error, 'Nem sikerült törölni a képet.'));
    } finally {
      setDeletingPhotoId(null);
    }
  };

  const openCaptionEditor = () => {
    if (!activePhoto) return;
    setLocalError(null);
    setCaptionDraft(activePhoto.caption);
    setCaptionPhotoId(activePhoto.id);
  };

  const saveCaption = async () => {
    if (!activePhoto || isSavingCaption) return;
    setIsSavingCaption(true);
    try {
      await onEditCaption(activePhoto.id, captionDraft);
      setCaptionPhotoId(null);
    } catch (error) {
      setLocalError(errorText(error, 'Nem sikerült menteni a képaláírást.'));
    } finally {
      setIsSavingCaption(false);
    }
  };

  const pinPhoto = async () => {
    if (!activePhoto || !cover || pinningPhotoId) return;
    const isPinnedActive = cover.pinnedPhotoId === activePhoto.id;
    setLocalError(null);
    setPinningPhotoId(activePhoto.id);
    try {
      await cover.onPin(isPinnedActive ? null : activePhoto.id);
    } catch (error) {
      setLocalError(errorText(error, 'Nem sikerült módosítani a borítóképet.'));
    } finally {
      setPinningPhotoId(null);
    }
  };

  return (
    <section className="space-y-3" aria-label="Fotók">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-vine-700 dark:text-vine-200">
          <Images className="h-4 w-4" />
          Fotók ({sortedPhotos.length})
        </div>
        {isAdmin && (
          <PhotoPickerButtons
            onSelect={(files) => void addPhotos(files)}
            disabled={busy}
            busy={busy}
            singleLabel="Fotó hozzáadása"
          />
        )}
      </div>

      {(localError || errorMessage) && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {localError ?? errorMessage}
        </div>
      )}

      {pendingPhotos.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-vine-200 bg-vine-50/80 p-3 dark:border-vine-700 dark:bg-vine-800/40" aria-label="Feltöltés alatt">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-vine-600 dark:text-vine-300">
            Feltöltés alatt ({pendingPhotos.length})
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2">
            {pendingPhotos.map((pending) => {
              const statusLabel = {
                queued: 'Várakozik',
                preparing: 'Előkészítés',
                uploading: `Feltöltés ${pending.progress}%`,
                committing: 'Mentés',
                'awaiting-sync': 'Szinkronizálás',
                failed: 'Sikertelen',
              }[pending.status];
              const canCancel = ['queued', 'preparing', 'uploading'].includes(pending.status);
              return (
                <div key={pending.jobId} data-upload-job-id={pending.jobId} className="min-w-0 space-y-1.5 rounded-xl border border-vine-200 bg-white p-2 dark:border-vine-700 dark:bg-vine-900">
                  {pending.previewUrl ? (
                    <img src={pending.previewUrl} alt="" className="h-24 w-full rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-24 items-center justify-center rounded-lg bg-vine-100 text-vine-400 dark:bg-vine-800 dark:text-vine-500">
                      <Loader2 className={pending.status === 'failed' ? 'h-5 w-5' : 'h-5 w-5 animate-spin'} />
                    </div>
                  )}
                  <div className="truncate text-[11px] text-vine-500 dark:text-vine-300" title={pending.fileName}>{pending.fileName}</div>
                  <div role="status" className={pending.status === 'failed' ? 'text-xs font-medium text-red-600 dark:text-red-300' : 'text-xs font-medium text-vine-700 dark:text-vine-100'}>{statusLabel}</div>
                  {pending.status === 'uploading' && (
                    <div className="h-1.5 overflow-hidden rounded-full bg-vine-200 dark:bg-vine-700">
                      <div role="progressbar" aria-label={`${pending.fileName} feltöltése`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pending.progress} className="h-full bg-vine-600 transition-[width]" style={{ width: `${pending.progress}%` }} />
                    </div>
                  )}
                  {pending.error && <p role="alert" className="break-all text-[11px] text-red-600 dark:text-red-300">{pending.error}</p>}
                  {pending.status === 'failed' && (
                    <div className="flex flex-wrap gap-1">
                      <button type="button" className={SMALL_BUTTON_CLASS} onClick={() => onRetryPendingPhoto?.(pending.jobId)}>Újrapróbálás</button>
                      <button type="button" className={DELETE_BUTTON_CLASS} onClick={() => onCancelPendingPhoto?.(pending.jobId)}>Eltávolítás</button>
                    </div>
                  )}
                  {canCancel && (
                    <button type="button" className={DELETE_BUTTON_CLASS} onClick={() => onCancelPendingPhoto?.(pending.jobId)}>Megszakítás</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sortedPhotos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-vine-300 px-4 py-8 text-center text-sm text-vine-500 dark:border-vine-700 dark:text-vine-300">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-3">
          {activePhoto && (
            <div className="overflow-hidden rounded-3xl border border-vine-300/90 bg-vine-50 p-1.5 shadow-[0_8px_20px_-12px_rgba(15,23,42,0.45)] dark:border-vine-500/70 dark:bg-vine-800/55 dark:shadow-[0_10px_26px_-14px_rgba(0,0,0,0.75)]">
              <div className="relative">
                <button type="button" onClick={() => setIsLightboxOpen(true)} className="group block w-full text-left" title="Teljes képernyős nézet">
                  <img src={activePhoto.downloadUrl} alt={alt} className="h-72 w-full rounded-[1.2rem] border border-vine-200/90 object-cover shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)] transition-transform duration-200 group-hover:scale-[1.01] dark:border-vine-600/80 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] sm:h-80" />
                </button>
                {sortedPhotos.length > 1 && (
                  <>
                    <button type="button" onClick={goToPreviousPhoto} className="absolute left-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/45 text-white transition-colors hover:bg-black/60" aria-label="Előző kép">
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button type="button" onClick={goToNextPhoto} className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/45 text-white transition-colors hover:bg-black/60" aria-label="Következő kép">
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>

              <div className="space-y-2 px-4 py-3 text-xs text-vine-500 dark:text-vine-300">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <span>Kép {activePhotoIndex + 1}/{sortedPhotos.length}</span>
                    <span>{photoDisplayDateText(activePhoto)}</span>
                    {/* A két állapot kizárja egymást: a legújabb fotó kézi
                        kijelölésekor a `Kijelölt borító` a pontos állítás. */}
                    {automaticCover?.id === activePhoto.id && pinnedCover?.id !== activePhoto.id && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                        <Star className="h-3 w-3" />
                        Automatikus borító
                      </span>
                    )}
                    {pinnedCover?.id === activePhoto.id && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                        <Star className="h-3 w-3 fill-current" />
                        Kijelölt borító
                      </span>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {cover && (
                        <button type="button" onClick={() => void pinPhoto()} disabled={pinningPhotoId !== null || busy} aria-pressed={cover.pinnedPhotoId === activePhoto.id} className={SMALL_BUTTON_CLASS}>
                          {pinningPhotoId === activePhoto.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className="h-3.5 w-3.5" />}
                          {cover.pinnedPhotoId === activePhoto.id ? 'Automatikus borító' : 'Borítóképnek'}
                        </button>
                      )}
                      <button type="button" onClick={openCaptionEditor} disabled={busy} className={SMALL_BUTTON_CLASS} aria-label="Képaláírás szerkesztése">
                        <Pencil className="h-3.5 w-3.5" />
                        Képaláírás
                      </button>
                      <button type="button" onClick={() => void deletePhoto()} disabled={deletingPhotoId === activePhoto.id || busy} className={DELETE_BUTTON_CLASS}>
                        {deletingPhotoId === activePhoto.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        Törlés
                      </button>
                    </div>
                  )}
                </div>

                {captionPhotoId === activePhoto.id ? (
                  <div className="space-y-2">
                    <input value={captionDraft} onChange={(event) => setCaptionDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void saveCaption(); } }} disabled={isSavingCaption} aria-label="Képaláírás" placeholder="Üresen hagyva nincs képaláírás" className="w-full rounded-lg border border-vine-200 bg-white px-2.5 py-1.5 text-xs text-vine-900 outline-none transition-colors focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50" />
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => void saveCaption()} disabled={isSavingCaption || busy} className={SMALL_BUTTON_CLASS}>
                        {isSavingCaption && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Mentés
                      </button>
                      <button type="button" onClick={() => setCaptionPhotoId(null)} disabled={isSavingCaption} className={SMALL_BUTTON_CLASS}>Mégse</button>
                    </div>
                  </div>
                ) : (
                  <p className="break-words text-vine-700 dark:text-vine-100">
                    {activePhoto.caption || <span className="text-vine-500 dark:text-vine-300">Nincs képaláírás.</span>}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-6">
            {sortedPhotos.map((photo) => {
              const isActive = photo.id === activePhoto?.id;
              const isHighlighted = photo.id === highlightedPhotoId;
              const dateBadge = photoDateBadges.get(photo.id);
              return (
                <button key={photo.id} data-photo-id={photo.id} type="button" onClick={() => setActivePhotoId(photo.id)} aria-label={`${alt} fotó megnyitása`} className={`relative overflow-hidden rounded-2xl border bg-white/90 p-1 text-left shadow-sm transition-all duration-200 dark:bg-vine-900/60 ${isHighlighted ? 'border-amber-500 ring-2 ring-amber-300 dark:border-amber-400 dark:ring-amber-500/60' : isActive ? 'border-vine-500 ring-2 ring-vine-300 dark:border-vine-300 dark:ring-vine-700' : 'border-vine-300/90 hover:border-vine-400 dark:border-vine-600 dark:hover:border-vine-500'}`}>
                  <img src={photoThumbnailUrl(photo)} alt="" loading="lazy" className="h-24 w-full rounded-xl border border-vine-200/80 object-cover dark:border-vine-700/70" />
                  {dateBadge && (
                    <span title={dateBadge.title} className={`pointer-events-none absolute left-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white ${dateBadge.isCaptured ? '' : 'italic'}`}>
                      {dateBadge.isCaptured ? '' : '↑'}{dateBadge.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isLightboxOpen && activePhoto && (
        <PhotoLightbox images={lightboxImages} initialIndex={activePhotoIndex} onClose={() => setIsLightboxOpen(false)} onIndexChange={(index) => setActivePhotoId(sortedPhotos[index]?.id ?? null)} label={lightboxLabel} />
      )}
    </section>
  );
}
