import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteObject, ref } from 'firebase/storage';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ImagePlus,
  Loader2,
  Search,
  SearchX,
  Sprout,
  Trash2,
  X,
} from 'lucide-react';
import { storage } from '../lib/firebase';
import { formatDateTime, formatMonthDay } from '../lib/dateFormat';
import { usePhotoPicker } from '../hooks/usePhotoPicker';
import { usePhotoUpload } from '../hooks/usePhotoUpload';
import type { Cutting } from '../types/cutting';
import { toCuttingPhotos } from './cuttingsViewUtils';

interface CuttingPhotoGalleryProps {
  cutting: Cutting;
  isAdmin: boolean;
  onUpdateCutting: (cuttingId: string, updates: Partial<Omit<Cutting, 'id'>>) => Promise<void>;
  updateErrorMessage: string | null;
  onClearUpdateError: () => void;
  highlightedPhotoId?: string | null;
}

export function CuttingPhotoGallery({
  cutting,
  isAdmin,
  onUpdateCutting,
  updateErrorMessage,
  onClearUpdateError,
  highlightedPhotoId = null,
}: CuttingPhotoGalleryProps) {
  const [photoDeletingId, setPhotoDeletingId] = useState<string | null>(null);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState(false);
  const [photoViewerZoom, setPhotoViewerZoom] = useState(1);
  const [photoViewerOffset, setPhotoViewerOffset] = useState({ x: 0, y: 0 });
  const [isPhotoViewerDragging, setIsPhotoViewerDragging] = useState(false);
  const [photoViewerDragStart, setPhotoViewerDragStart] = useState({ x: 0, y: 0 });
  const detailFileInputRef = useRef<HTMLInputElement>(null);
  const latestPhotosRef = useRef(cutting.photos);
  const { isMobileDevice, openPicker } = usePhotoPicker();
  const {
    upload: uploadPhotos,
    uploading: photoUploading,
    error: photoUploadError,
  } = usePhotoUpload();

  const activePhoto =
    cutting.photos.find((photo) => photo.id === activePhotoId) ?? cutting.photos.at(-1) ?? null;
  const totalPhotos = cutting.photos.length;
  const activePhotoIndex = activePhoto
    ? cutting.photos.findIndex((photo) => photo.id === activePhoto.id)
    : -1;

  const goToPreviousPhoto = useCallback(() => {
    if (totalPhotos <= 1 || activePhotoIndex < 0) {
      return;
    }
    const previousIndex = (activePhotoIndex - 1 + totalPhotos) % totalPhotos;
    setActivePhotoId(cutting.photos[previousIndex]?.id ?? null);
  }, [activePhotoIndex, cutting.photos, totalPhotos]);

  const goToNextPhoto = useCallback(() => {
    if (totalPhotos <= 1 || activePhotoIndex < 0) {
      return;
    }
    const nextIndex = (activePhotoIndex + 1) % totalPhotos;
    setActivePhotoId(cutting.photos[nextIndex]?.id ?? null);
  }, [activePhotoIndex, cutting.photos, totalPhotos]);

  const resetPhotoViewerTransform = useCallback(() => {
    setPhotoViewerZoom(1);
    setPhotoViewerOffset({ x: 0, y: 0 });
    setIsPhotoViewerDragging(false);
  }, []);

  const adjustPhotoViewerZoom = useCallback((delta: number) => {
    setPhotoViewerZoom((current) => {
      const next = Math.max(1, Math.min(6, current + delta));
      if (next <= 1) {
        setPhotoViewerOffset({ x: 0, y: 0 });
        setIsPhotoViewerDragging(false);
      }
      return next;
    });
  }, []);

  const zoomInPhotoViewer = useCallback(() => {
    adjustPhotoViewerZoom(0.25);
  }, [adjustPhotoViewerZoom]);

  const zoomOutPhotoViewer = useCallback(() => {
    adjustPhotoViewerZoom(-0.25);
  }, [adjustPhotoViewerZoom]);

  useEffect(() => {
    latestPhotosRef.current = cutting.photos;
  }, [cutting.photos]);

  useEffect(() => {
    setActivePhotoId(cutting.photos.at(-1)?.id ?? null);
    setIsPhotoViewerOpen(false);
    resetPhotoViewerTransform();
  }, [cutting.id, cutting.photos, resetPhotoViewerTransform]);

  useEffect(() => {
    if (!isPhotoViewerOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsPhotoViewerOpen(false);
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goToPreviousPhoto();
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goToNextPhoto();
        return;
      }

      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        zoomInPhotoViewer();
        return;
      }

      if (event.key === '-') {
        event.preventDefault();
        zoomOutPhotoViewer();
        return;
      }

      if (event.key === '0') {
        event.preventDefault();
        resetPhotoViewerTransform();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    goToNextPhoto,
    goToPreviousPhoto,
    isPhotoViewerOpen,
    resetPhotoViewerTransform,
    zoomInPhotoViewer,
    zoomOutPhotoViewer,
  ]);

  const handleAddPhotos = async (files: FileList | null) => {
    if (!files || !isAdmin) {
      return;
    }
    onClearUpdateError();

    try {
      const uploads = await uploadPhotos({
        files,
        storagePathPrefix: `cuttings/${cutting.id}/photos`,
      });
      const newPhotos = toCuttingPhotos(uploads);
      const mergedPhotos = [...latestPhotosRef.current];
      for (const photo of newPhotos) {
        if (!mergedPhotos.some((item) => item.id === photo.id)) {
          mergedPhotos.push(photo);
        }
      }
      latestPhotosRef.current = mergedPhotos;
      await onUpdateCutting(cutting.id, {
        photos: mergedPhotos,
      });
    } catch (error) {
      console.error('Cutting photo add error:', error);
    }
  };

  const handleDeletePhoto = async () => {
    if (!activePhoto || !isAdmin || photoDeletingId) {
      return;
    }

    const confirmed = window.confirm('Biztosan törlöd ezt a képet?');
    if (!confirmed) {
      return;
    }

    setPhotoDeletingId(activePhoto.id);
    onClearUpdateError();

    try {
      if (activePhoto.storagePath) {
        await deleteObject(ref(storage, activePhoto.storagePath));
      }

      const remainingPhotos = cutting.photos.filter((item) => item.id !== activePhoto.id);
      await onUpdateCutting(cutting.id, {
        photos: remainingPhotos,
      });
      setActivePhotoId(remainingPhotos.at(-1)?.id ?? null);
    } catch (error) {
      console.error('Cutting photo delete error:', error);
    } finally {
      setPhotoDeletingId(null);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-vine-700 dark:text-vine-200">
          <Sprout className="h-4 w-4" />
          Fotók
        </div>

        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={detailFileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => void handleAddPhotos(event.target.files)}
              className="hidden"
            />
            {isMobileDevice ? (
              <>
                <button
                  type="button"
                  onClick={() => openPicker(detailFileInputRef, 'camera')}
                  disabled={photoUploading}
                  className="inline-flex items-center gap-2 rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-700 transition-colors hover:bg-vine-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
                >
                  {photoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  Fotózás
                </button>
                <button
                  type="button"
                  onClick={() => openPicker(detailFileInputRef, 'gallery')}
                  disabled={photoUploading}
                  className="inline-flex items-center gap-2 rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-700 transition-colors hover:bg-vine-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
                >
                  <ImagePlus className="h-4 w-4" />
                  Galéria
                </button>
              </>
            ) : (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-700 transition-colors hover:bg-vine-50 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800">
                {photoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                Fotó hozzáadása
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => void handleAddPhotos(event.target.files)}
                  className="hidden"
                />
              </label>
            )}
          </div>
        )}
      </div>

      {(photoUploadError || updateErrorMessage) && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {photoUploadError ?? updateErrorMessage}
        </div>
      )}

      {cutting.photos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-vine-300 px-4 py-8 text-center text-sm text-vine-500 dark:border-vine-700 dark:text-vine-300">
          Ehhez a dugványhoz még nincs feltöltött kép.
        </div>
      ) : (
        <div className="space-y-3">
          {activePhoto && (
            <div className="overflow-hidden rounded-3xl border border-vine-300/90 bg-vine-50 p-1.5 shadow-[0_8px_20px_-12px_rgba(15,23,42,0.45)] dark:border-vine-500/70 dark:bg-vine-800/55 dark:shadow-[0_10px_26px_-14px_rgba(0,0,0,0.75)]">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsPhotoViewerOpen(true);
                    resetPhotoViewerTransform();
                  }}
                  className="group block w-full text-left"
                  title="Teljes képernyős nézet"
                >
                  <img
                    src={activePhoto.downloadUrl}
                    alt={cutting.variety}
                    className="h-72 w-full rounded-[1.2rem] border border-vine-200/90 object-cover shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)] transition-transform duration-200 group-hover:scale-[1.01] dark:border-vine-600/80 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] sm:h-80"
                  />
                </button>

                {totalPhotos > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={goToPreviousPhoto}
                      className="absolute left-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/45 text-white transition-colors hover:bg-black/60"
                      aria-label="Előző kép"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={goToNextPhoto}
                      className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/45 text-white transition-colors hover:bg-black/60"
                      aria-label="Következő kép"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3 text-xs text-vine-500 dark:text-vine-300">
                <div className="flex items-center gap-3">
                  <span>Kép {activePhotoIndex + 1}/{totalPhotos}</span>
                  <span>Dátum: {formatDateTime(activePhoto.capturedAt ?? activePhoto.uploadedAt)}</span>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => void handleDeletePhoto()}
                    disabled={photoDeletingId === activePhoto.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-red-900 dark:bg-vine-900 dark:text-red-300 dark:hover:bg-red-950/30"
                  >
                    {photoDeletingId === activePhoto.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Törlés
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-6">
            {cutting.photos.map((photo) => {
              const isActive = photo.id === activePhoto?.id;
              const isHighlighted = photo.id === highlightedPhotoId;

              return (
                <button
                  key={photo.id}
                  data-photo-id={photo.id}
                  type="button"
                  onClick={() => setActivePhotoId(photo.id)}
                  className={`relative overflow-hidden rounded-2xl border bg-white/90 p-1 text-left shadow-sm transition-all duration-200 dark:bg-vine-900/60 ${
                    isHighlighted
                      ? 'border-amber-500 ring-2 ring-amber-300 dark:border-amber-400 dark:ring-amber-500/60'
                      : isActive
                        ? 'border-vine-500 ring-2 ring-vine-300 dark:border-vine-300 dark:ring-vine-700'
                        : 'border-vine-300/90 hover:border-vine-400 dark:border-vine-600 dark:hover:border-vine-500'
                  }`}
                >
                  <img
                    src={photo.downloadUrl}
                    alt={cutting.variety}
                    className="h-24 w-full rounded-xl border border-vine-200/80 object-cover dark:border-vine-700/70"
                  />
                  <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    {formatMonthDay(photo.capturedAt ?? photo.uploadedAt)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isPhotoViewerOpen && activePhoto && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setIsPhotoViewerOpen(false)}
        >
          <button
            type="button"
            onClick={() => {
              setIsPhotoViewerOpen(false);
              resetPhotoViewerTransform();
            }}
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white transition-colors hover:bg-black/60"
            aria-label="Bezárás"
          >
            <X className="h-5 w-5" />
          </button>

          <a
            href={activePhoto.downloadUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="absolute right-16 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white transition-colors hover:bg-black/60"
            aria-label="Megnyitás új lapon"
            title="Megnyitás új lapon"
          >
            <ExternalLink className="h-5 w-5" />
          </a>

          <div className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-xl border border-white/30 bg-black/40 p-1 text-white">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                zoomOutPhotoViewer();
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/10"
              aria-label="Kicsinyítés"
              title="Kicsinyítés"
            >
              <SearchX className="h-4 w-4" />
            </button>
            <span className="px-2 text-xs tabular-nums">{Math.round(photoViewerZoom * 100)}%</span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                zoomInPhotoViewer();
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/10"
              aria-label="Nagyítás"
              title="Nagyítás"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                resetPhotoViewerTransform();
              }}
              className="rounded-lg px-2 py-1 text-xs transition-colors hover:bg-white/10"
              aria-label="Nagyítás visszaállítása"
              title="Nagyítás visszaállítása"
            >
              Reset
            </button>
          </div>

          {totalPhotos > 1 && (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  goToPreviousPhoto();
                }}
                className="absolute left-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white transition-colors hover:bg-black/60"
                aria-label="Előző kép"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  goToNextPhoto();
                }}
                className="absolute right-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white transition-colors hover:bg-black/60"
                aria-label="Következő kép"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          <div
            className="flex h-[calc(100vh-96px)] w-[calc(100vw-80px)] cursor-default items-center justify-center overflow-hidden"
            onClick={(event) => event.stopPropagation()}
            onWheel={(event) => {
              event.stopPropagation();
              event.preventDefault();
              adjustPhotoViewerZoom(event.deltaY > 0 ? -0.15 : 0.15);
            }}
            onMouseDown={(event) => {
              if (photoViewerZoom <= 1) {
                return;
              }
              event.preventDefault();
              setIsPhotoViewerDragging(true);
              setPhotoViewerDragStart({
                x: event.clientX - photoViewerOffset.x,
                y: event.clientY - photoViewerOffset.y,
              });
            }}
            onMouseMove={(event) => {
              if (!isPhotoViewerDragging || photoViewerZoom <= 1) {
                return;
              }
              setPhotoViewerOffset({
                x: event.clientX - photoViewerDragStart.x,
                y: event.clientY - photoViewerDragStart.y,
              });
            }}
            onMouseUp={() => setIsPhotoViewerDragging(false)}
            onMouseLeave={() => setIsPhotoViewerDragging(false)}
          >
            <img
              src={activePhoto.downloadUrl}
              alt={cutting.variety}
              className={`max-h-full max-w-full rounded-2xl object-contain ${
                photoViewerZoom > 1 ? 'cursor-grab' : ''
              } ${isPhotoViewerDragging ? 'cursor-grabbing' : ''}`}
              style={{
                transform: `translate(${photoViewerOffset.x}px, ${photoViewerOffset.y}px) scale(${photoViewerZoom})`,
                transformOrigin: 'center center',
                transition: isPhotoViewerDragging ? 'none' : 'transform 160ms ease-out',
              }}
              draggable={false}
            />
          </div>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-xl border border-white/20 bg-black/45 px-4 py-2 text-xs text-white">
            Kép {activePhotoIndex + 1}/{totalPhotos} • Dátum: {formatDateTime(activePhoto.capturedAt ?? activePhoto.uploadedAt)}
          </div>
        </div>
      )}
    </section>
  );
}
