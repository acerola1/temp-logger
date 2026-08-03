import type { FirebaseStorage } from 'firebase/storage';
// A keretrendszer-független magot közvetlenül importáljuk, nem az index-en át:
// így a tőke-adatréteg nem húzza be a React-hook Storage-szingletonját.
import { prepareImageUpload } from '../photos/imagePreparation';
import {
  deletePhotoObjects,
  uploadPreparedPhotos,
  type PhotoUploadProgress,
  type PreparedPhoto,
} from '../photos/photoUpload';
import type { VineEventPhoto } from './model';

// A tőkeeseményfotók a szoloink fórumképeinek méretkorlátját követik: a
// hosszabbik oldal 1280 px. Az egész tőke a szabad ég alatt áll, a fontos
// részletek (rügy, metszés, betegségtünet) 1000 px-en már elmosódtak.
const VINE_EVENT_PHOTO_MAX_SIDE = 1280;

export type PreparedVineEventPhoto = PreparedPhoto;

export type VineEventPhotoUploadProgress = PhotoUploadProgress;

export function buildVineEventPhotoStoragePath(
  vineId: string,
  eventId: string,
  photoId: string,
  extension: string,
): string {
  return `vines/${vineId}/events/${eventId}/photos/${photoId}.${extension}`;
}

export async function prepareVineEventPhotos(
  files: readonly File[],
): Promise<PreparedVineEventPhoto[]> {
  return Promise.all(
    files.map((file) => prepareImageUpload(file, { maxImageSide: VINE_EVENT_PHOTO_MAX_SIDE })),
  );
}

export async function uploadPreparedVineEventPhotos(
  storage: FirebaseStorage,
  vineId: string,
  eventId: string,
  preparedPhotos: readonly PreparedVineEventPhoto[],
  onProgress?: VineEventPhotoUploadProgress,
): Promise<VineEventPhoto[]> {
  const uploads = await uploadPreparedPhotos({
    storage,
    photos: preparedPhotos,
    buildStoragePath: ({ photoId, extension }) =>
      buildVineEventPhotoStoragePath(vineId, eventId, photoId, extension),
    onProgress,
  });

  return uploads.map((upload) => ({
    id: upload.photoId,
    storagePath: upload.storagePath,
    downloadUrl: upload.downloadUrl,
    width: upload.width,
    height: upload.height,
    uploadedAt: new Date().toISOString(),
  }));
}

export async function deleteVineEventPhotos(
  storage: FirebaseStorage,
  photos: readonly VineEventPhoto[],
): Promise<void> {
  await deletePhotoObjects(
    storage,
    photos
      .map((photo) => photo.storagePath)
      .filter((storagePath): storagePath is string => storagePath.length > 0),
  );
}
