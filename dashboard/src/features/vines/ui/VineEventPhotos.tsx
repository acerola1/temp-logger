import { useState } from 'react';
import { Images, Loader2, Pencil, Star, Trash2 } from 'lucide-react';
// A `photos` almoduljait közvetlenül importáljuk, nem az indexen át: a
// fotósor így nem húzza be a feltöltő hook Firebase-szingletonját.
import { photoDateText } from '../../photos/photoMetadata';
import { PhotoPickerButtons } from '../../photos/ui/PhotoPickerButtons';
import { selectVineEventPhotos } from '../forms';
import { MAX_VINE_EVENT_PHOTOS, type VineEvent, type VineEventPhoto } from '../model';

const CAPTION_INPUT_CLASS =
  'w-full rounded-lg border border-vine-200 bg-white px-2 py-1 text-xs text-vine-900 outline-none transition-colors focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50';
const SMALL_BUTTON_CLASS =
  'inline-flex items-center gap-1 rounded-lg border border-vine-200 bg-white px-2 py-1 text-[11px] font-medium text-vine-700 transition-colors hover:bg-vine-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800';
const DELETE_BUTTON_CLASS =
  'inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2 py-1 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-red-900 dark:bg-vine-900 dark:text-red-300 dark:hover:bg-red-950/30';
// A kijelölt borító gombja lenyomott állapotot mutat, hogy a kijelölés a
// szövegen kívül is látszódjon.
const COVER_BUTTON_CLASS =
  'inline-flex items-center gap-1 rounded-lg border border-vine-500 bg-vine-600 px-2 py-1 text-[11px] font-medium text-white transition-colors hover:bg-vine-700 disabled:cursor-not-allowed disabled:opacity-70 dark:border-vine-400 dark:bg-vine-600 dark:hover:bg-vine-500';

interface VineEventPhotosProps {
  event: VineEvent;
  isAdmin: boolean;
  isPending: boolean;
  /** Az esemény azon fotójának azonosítója, ami éppen a tőke borítója. */
  coverPhotoId: string | null;
  /** `true`, ha a borítót admin jelölte ki, nem a legfrissebb fotóból adódik. */
  isCoverPinned: boolean;
  // Csak akkor kap értéket, ha éppen ehhez az eseményhez tölt fel a felhasználó.
  uploadProgress: number | null;
  // Ugyanígy: az adatréteg hibája csak az érintett eseménynél jelenik meg.
  errorMessage: string | null;
  onOpenPhoto: (index: number) => void;
  onAddPhotos: (files: File[]) => Promise<void>;
  onDeletePhoto: (photoId: string) => Promise<void>;
  onEditCaption: (photoId: string, caption: string) => Promise<void>;
  /** `null` a kijelölés visszavonása, azaz visszatérés az automatikus borítóra. */
  onSetCoverPhoto: (photoId: string | null) => Promise<void>;
}

// Az egy fotós esemény bélyegének nincs sorszáma, a többfotósnak van: a
// felolvasó így nem mond fölösleges „1. fotó”-t.
function photoOpenLabel(title: string, index: number, total: number): string {
  return total > 1 ? `${title} ${index + 1}. fotó megnyitása` : `${title} fotó megnyitása`;
}

function PhotoThumbnail({
  photo,
  label,
  onOpen,
}: {
  photo: VineEventPhoto;
  label: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-vine-200 dark:border-vine-700"
      aria-label={label}
    >
      <img
        src={photo.downloadUrl}
        alt=""
        width={photo.width || undefined}
        height={photo.height || undefined}
        className="h-full w-full object-cover"
      />
    </button>
  );
}

// Az eseménykártya fotósora. Admin módban a `CuttingPhotoGallery` admin
// fejlécének nyelvét követi: bal oldalt a szakasz címe a darabszámmal, jobb
// oldalt a közös választógombok, fotónként aláírás-szerkesztés és törlés.
export function VineEventPhotos({
  event,
  isAdmin,
  isPending,
  coverPhotoId,
  isCoverPinned,
  uploadProgress,
  errorMessage,
  onOpenPhoto,
  onAddPhotos,
  onDeletePhoto,
  onEditCaption,
  onSetCoverPhoto,
}: VineEventPhotosProps) {
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [coveringPhotoId, setCoveringPhotoId] = useState<string | null>(null);
  const [captionPhotoId, setCaptionPhotoId] = useState<string | null>(null);
  const [captionDraft, setCaptionDraft] = useState('');
  const [isSavingCaption, setIsSavingCaption] = useState(false);
  const photos = event.photos;

  const addPhotos = async (files: File[]) => {
    const selection = selectVineEventPhotos(photos.length, files);
    setPhotoError(selection.error);
    // A korlát fölötti kijelölésnél feltöltés sem indul.
    if (selection.accepted.length === 0) return;

    try {
      await onAddPhotos(selection.accepted);
    } catch (error) {
      console.error('Vine event photo add error:', error);
    }
  };

  const deletePhoto = async (photoId: string) => {
    if (deletingPhotoId || !window.confirm('Biztosan törlöd ezt a képet?')) return;

    setPhotoError(null);
    setDeletingPhotoId(photoId);
    try {
      await onDeletePhoto(photoId);
      if (captionPhotoId === photoId) setCaptionPhotoId(null);
    } catch (error) {
      console.error('Vine event photo delete error:', error);
    } finally {
      setDeletingPhotoId(null);
    }
  };

  // A lenyomott gomb visszavonja a kijelölést, a többi kép gombja átveszi a
  // borítót — külön visszavonás nélkül.
  const setCoverPhoto = async (photoId: string, isPinnedCover: boolean) => {
    if (coveringPhotoId) return;

    setPhotoError(null);
    setCoveringPhotoId(photoId);
    try {
      await onSetCoverPhoto(isPinnedCover ? null : photoId);
    } catch (error) {
      console.error('Vine cover photo error:', error);
    } finally {
      setCoveringPhotoId(null);
    }
  };

  const openCaptionEditor = (photo: VineEventPhoto) => {
    setPhotoError(null);
    setCaptionDraft(photo.caption);
    setCaptionPhotoId(photo.id);
  };

  const saveCaption = async (photoId: string) => {
    if (isPending || isSavingCaption) return;

    setIsSavingCaption(true);
    try {
      await onEditCaption(photoId, captionDraft);
      setCaptionPhotoId(null);
    } catch (error) {
      console.error('Vine event photo caption error:', error);
    } finally {
      setIsSavingCaption(false);
    }
  };

  if (!isAdmin) {
    if (photos.length === 0) return null;

    return (
      <div className="mt-3 flex flex-wrap gap-2 pl-11">
        {photos.map((photo, photoIndex) => (
          <PhotoThumbnail
            key={photo.id}
            photo={photo}
            label={photoOpenLabel(event.title, photoIndex, photos.length)}
            onOpen={() => onOpenPhoto(photoIndex)}
          />
        ))}
      </div>
    );
  }

  return (
    // Mobilon a bélyeg + felirat páros minden képpontot elhasznál, ezért az
    // eseménymarkerhez igazító behúzás csak `sm` fölött van meg.
    <div className="mt-3 space-y-2 sm:pl-11">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-vine-700 dark:text-vine-200">
          <Images className="h-4 w-4" />
          Fotók {photos.length}/{MAX_VINE_EVENT_PHOTOS}
        </div>
        <PhotoPickerButtons
          onSelect={(files) => void addPhotos(files)}
          disabled={isPending}
          busy={uploadProgress !== null}
          singleLabel="Fotó hozzáadása"
        />
      </div>

      {photos.length === 0 ? (
        <p className="text-xs text-vine-500 dark:text-vine-300">
          Ehhez az eseményhez még nincs fotó.
        </p>
      ) : (
        <ul aria-label={`${event.title} fotói`} className="space-y-2">
          {photos.map((photo, photoIndex) => {
            const isEditingCaption = captionPhotoId === photo.id;
            const isCover = coverPhotoId === photo.id;
            const isPinnedCover = isCover && isCoverPinned;

            return (
              <li
                key={photo.id}
                className="flex items-start gap-3 rounded-xl border border-vine-200 bg-white/80 p-2 dark:border-vine-700 dark:bg-vine-900/40"
              >
                <PhotoThumbnail
                  photo={photo}
                  label={photoOpenLabel(event.title, photoIndex, photos.length)}
                  onOpen={() => onOpenPhoto(photoIndex)}
                />

                <div className="min-w-0 flex-1 space-y-1.5">
                  {isEditingCaption ? (
                    <div className="space-y-1.5">
                      <input
                        value={captionDraft}
                        onChange={(changeEvent) => setCaptionDraft(changeEvent.target.value)}
                        onKeyDown={(keyEvent) => {
                          if (keyEvent.key !== 'Enter') return;
                          keyEvent.preventDefault();
                          void saveCaption(photo.id);
                        }}
                        disabled={isSavingCaption}
                        aria-label={`${event.title} ${photoIndex + 1}. fotó képaláírása`}
                        placeholder="Üresen hagyva nincs képaláírás"
                        className={CAPTION_INPUT_CLASS}
                      />
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void saveCaption(photo.id)}
                          disabled={isPending || isSavingCaption}
                          className={SMALL_BUTTON_CLASS}
                        >
                          {isSavingCaption && <Loader2 className="h-3 w-3 animate-spin" />}
                          Aláírás mentése
                        </button>
                        <button
                          type="button"
                          onClick={() => setCaptionPhotoId(null)}
                          disabled={isSavingCaption}
                          className={SMALL_BUTTON_CLASS}
                        >
                          Mégse
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="break-words text-xs text-vine-700 dark:text-vine-100">
                      {photo.caption || (
                        <span className="text-vine-500 dark:text-vine-300">Nincs képaláírás.</span>
                      )}
                    </p>
                  )}

                  {isCover && !isCoverPinned && (
                    <p className="text-[11px] font-medium text-vine-600 dark:text-vine-300">
                      Automatikus borító
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-vine-500 dark:text-vine-300">
                    <span>{photoDateText(photo)}</span>
                    {!isEditingCaption && (
                      // Három gomb már nem fér ki 375 px-en egy sorba: a csoport
                      // maga is tördel, különben kilóg a kártyából.
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => void setCoverPhoto(photo.id, isPinnedCover)}
                          disabled={isPending || coveringPhotoId === photo.id}
                          aria-pressed={isPinnedCover}
                          aria-label={
                            isPinnedCover
                              ? `${event.title} ${photoIndex + 1}. fotó borítóképkijelölésének visszavonása`
                              : `${event.title} ${photoIndex + 1}. fotó kijelölése borítóképnek`
                          }
                          className={isPinnedCover ? COVER_BUTTON_CLASS : SMALL_BUTTON_CLASS}
                        >
                          {coveringPhotoId === photo.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Star
                              className={`h-3 w-3 ${isPinnedCover ? 'fill-current' : ''}`}
                            />
                          )}
                          Borító
                        </button>
                        <button
                          type="button"
                          onClick={() => openCaptionEditor(photo)}
                          disabled={isPending}
                          aria-label={`${event.title} ${photoIndex + 1}. fotó képaláírásának szerkesztése`}
                          className={SMALL_BUTTON_CLASS}
                        >
                          <Pencil className="h-3 w-3" />
                          Aláírás
                        </button>
                        <button
                          type="button"
                          onClick={() => void deletePhoto(photo.id)}
                          disabled={isPending || deletingPhotoId === photo.id}
                          aria-label={`${event.title} ${photoIndex + 1}. fotó törlése`}
                          className={DELETE_BUTTON_CLASS}
                        >
                          {deletingPhotoId === photo.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                          Törlés
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {uploadProgress !== null && (
        <div className="space-y-1" role="status">
          <div className="flex justify-between text-[11px] text-vine-600 dark:text-vine-300">
            <span>Fotók feltöltése</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-vine-200 dark:bg-vine-700">
            <div
              role="progressbar"
              aria-label={`${event.title} fotóinak feltöltése`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={uploadProgress}
              className="h-full bg-vine-600 transition-[width]"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {(photoError || errorMessage) && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-300">
          {photoError ?? errorMessage}
        </p>
      )}
    </div>
  );
}
