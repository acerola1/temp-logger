import { useState } from 'react';
import { DEFAULT_MAX_SELECTED_PHOTOS } from '../../photos/photoSelection';
import { PhotoGallery } from '../../photos/ui/PhotoGallery';
import { selectVinePhotos } from '../forms';
import type { Vine } from '../model';

interface VinePhotoSectionProps {
  vine: Vine;
  isAdmin: boolean;
  isPending: boolean;
  uploadProgress: number | null;
  mutationError: string | null;
  onAddPhotos: (photos: File[]) => Promise<void>;
  onDeletePhoto: (photoId: string) => Promise<void>;
  onEditCaption: (photoId: string, caption: string) => Promise<void>;
  onSetCoverPhoto: (photoId: string | null) => Promise<void>;
}

/**
 * A tőke önálló `Fotók` szakasza. A tőke saját felelőssége csak a tőkénkénti
 * kapacitás betartása és a szándékalapú callbackek bekötése — a layout, a
 * sorrend, a lightbox és a borítójelölés a közös galériamodulé.
 */
export function VinePhotoSection({
  vine,
  isAdmin,
  isPending,
  uploadProgress,
  mutationError,
  onAddPhotos,
  onDeletePhoto,
  onEditCaption,
  onSetCoverPhoto,
}: VinePhotoSectionProps) {
  const [capacityError, setCapacityError] = useState<string | null>(null);

  // Publikus nézetben a fotó nélküli tőkén a teljes szakasz rejtve marad; az
  // admin viszont itt kapja a hozzáadási állapotot, ezért nála nem tűnik el.
  if (!isAdmin && vine.photos.length === 0) return null;

  const addPhotos = async (files: File[]) => {
    // A 100-as biztonsági korlát a szabad helyre vág. Nulla kapacitásnál
    // kép-előkészítés és feltöltés sem indul.
    const selection = selectVinePhotos(vine.photos.length, files);
    setCapacityError(selection.error);
    if (selection.accepted.length === 0) return;

    await onAddPhotos(selection.accepted);
  };

  const deletePhoto = async (photoId: string) => {
    setCapacityError(null);
    await onDeletePhoto(photoId);
  };

  return (
    <div className="space-y-3">
      <PhotoGallery
        galleryId={vine.id}
        photos={vine.photos}
        alt={vine.variety}
        isAdmin={isAdmin}
        busy={isPending}
        errorMessage={capacityError ?? mutationError}
        maxSelectionCount={DEFAULT_MAX_SELECTED_PHOTOS}
        emptyMessage="Még nincs fotó ehhez a tőkéhez."
        lightboxLabel="Tőkefotók"
        cover={{ pinnedPhotoId: vine.coverPhotoId, onPin: onSetCoverPhoto }}
        onAddPhotos={addPhotos}
        onDeletePhoto={deletePhoto}
        onEditCaption={onEditCaption}
      />

      {uploadProgress !== null && (
        <div className="space-y-1" role="status">
          <div className="flex justify-between text-xs text-vine-600 dark:text-vine-300">
            <span>Fotók feltöltése</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-vine-200 dark:bg-vine-700">
            <div
              role="progressbar"
              aria-label="Fotók feltöltése"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={uploadProgress}
              className="h-full bg-vine-600 transition-[width]"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
