import { useState } from 'react';
import { DEFAULT_MAX_SELECTED_PHOTOS } from '../../photos/photoSelection';
import { PhotoGallery } from '../../photos/ui/PhotoGallery';
import { selectVinePhotos } from '../forms';
import type { Vine } from '../model';
import type { VinePhotoUploadJob } from '../vinePhotoUploadQueue';

export type PendingVinePhoto = VinePhotoUploadJob;

interface VinePhotoSectionProps {
  vine: Vine;
  isAdmin: boolean;
  isPending: boolean;
  mutationError: string | null;
  pendingPhotos: readonly PendingVinePhoto[];
  onAddPhotos: (photos: File[]) => void;
  onDeletePhoto: (photoId: string) => Promise<void>;
  onEditCaption: (photoId: string, caption: string) => Promise<void>;
  onSetCoverPhoto: (photoId: string | null) => Promise<void>;
  onRetryPendingPhoto: (jobId: string) => void;
  onCancelPendingPhoto: (jobId: string) => void;
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
  mutationError,
  pendingPhotos,
  onAddPhotos,
  onDeletePhoto,
  onEditCaption,
  onSetCoverPhoto,
  onRetryPendingPhoto,
  onCancelPendingPhoto,
}: VinePhotoSectionProps) {
  const [capacityError, setCapacityError] = useState<string | null>(null);

  // Publikus nézetben a fotó nélküli tőkén a teljes szakasz rejtve marad; az
  // admin viszont itt kapja a hozzáadási állapotot, ezért nála nem tűnik el.
  if (!isAdmin && vine.photos.length === 0) return null;

  const addPhotos = (files: File[]) => {
    // A 100-as biztonsági korlát a szabad helyre vág. Nulla kapacitásnál
    // kép-előkészítés és feltöltés sem indul.
    const occupiedPhotoIds = new Set(vine.photos.map((photo) => photo.id));
    for (const pending of pendingPhotos) occupiedPhotoIds.add(pending.photoId);
    const selection = selectVinePhotos(occupiedPhotoIds.size, files);
    setCapacityError(selection.error);
    if (selection.accepted.length === 0) return;

    onAddPhotos(selection.accepted);
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
        pendingPhotos={pendingPhotos}
        onAddPhotos={addPhotos}
        onDeletePhoto={deletePhoto}
        onEditCaption={onEditCaption}
        onRetryPendingPhoto={onRetryPendingPhoto}
        onCancelPendingPhoto={onCancelPendingPhoto}
      />
    </div>
  );
}
