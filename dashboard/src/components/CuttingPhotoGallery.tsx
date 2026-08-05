import { DEFAULT_MAX_IMAGE_SIDE, PhotoGallery, usePhotoUpload } from '../features/photos';
import type { Cutting, CuttingPhoto } from '../types/cutting';
import { toCuttingPhotos } from './cuttingsViewUtils';

interface CuttingPhotoGalleryProps {
  cutting: Cutting;
  isAdmin: boolean;
  isUpdating: boolean;
  onAddPhotos: (cuttingId: string, photos: CuttingPhoto[]) => Promise<void>;
  onDeletePhoto: (cuttingId: string, photoId: string) => Promise<void>;
  onEditCaption: (cuttingId: string, photoId: string, caption: string) => Promise<void>;
  updateErrorMessage: string | null;
  onClearUpdateError: () => void;
  highlightedPhotoId?: string | null;
}

/** A dugvány saját felelőssége csak a Storage-feltöltés és a domain callbackek bekötése. */
export function CuttingPhotoGallery({
  cutting,
  isAdmin,
  isUpdating,
  onAddPhotos,
  onDeletePhoto,
  onEditCaption,
  updateErrorMessage,
  onClearUpdateError,
  highlightedPhotoId = null,
}: CuttingPhotoGalleryProps) {
  const {
    upload: uploadPhotos,
    uploading: photoUploading,
    error: photoUploadError,
  } = usePhotoUpload();

  const handleAddPhotos = async (files: File[]) => {
    if (!isAdmin) return;
    onClearUpdateError();

    const uploads = await uploadPhotos({
      files,
      storagePathPrefix: `cuttings/${cutting.id}/photos`,
      maxImageSide: DEFAULT_MAX_IMAGE_SIDE,
    });
    await onAddPhotos(cutting.id, toCuttingPhotos(uploads));
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!isAdmin) return;
    onClearUpdateError();
    await onDeletePhoto(cutting.id, photoId);
  };

  const handleEditCaption = async (photoId: string, caption: string) => {
    if (!isAdmin) return;
    onClearUpdateError();
    await onEditCaption(cutting.id, photoId, caption);
  };

  return (
    <PhotoGallery
      galleryId={cutting.id}
      photos={cutting.photos}
      alt={cutting.variety}
      isAdmin={isAdmin}
      busy={photoUploading || isUpdating}
      errorMessage={photoUploadError ?? updateErrorMessage}
      highlightedPhotoId={highlightedPhotoId}
      emptyMessage="Ehhez a dugványhoz még nincs feltöltött kép."
      lightboxLabel="Dugványfotók"
      onAddPhotos={handleAddPhotos}
      onDeletePhoto={handleDeletePhoto}
      onEditCaption={handleEditCaption}
    />
  );
}
