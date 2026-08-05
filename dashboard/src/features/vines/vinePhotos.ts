import type { FirebaseStorage } from 'firebase/storage';
// A keretrendszer-független magot közvetlenül importáljuk, nem az index-en át:
// így a tőke-adatréteg nem húzza be a React-hook Storage-szingletonját.
import { prepareImageUpload } from '../photos/imagePreparation';
import { toPhotoRecord } from '../photos/photoMetadata';
import {
  deletePhotoObjects,
  uploadPreparedPhotos,
  type PhotoUploadProgress,
  type PreparedPhoto,
} from '../photos/photoUpload';
import type { VinePhoto } from './model';

// A tőkefotók a szoloink fórumképeinek méretkorlátját követik: a hosszabbik
// oldal 1280 px. Az egész tőke a szabad ég alatt áll, a fontos részletek (rügy,
// metszés, betegségtünet) 1000 px-en már elmosódtak.
const VINE_PHOTO_MAX_SIDE = 1280;

// A bélyeg a mobiladat kímélésére a lehető legkisebb: 120 px a 80 px-es
// listakeretet 1,5× DPR-ig élesen kitölti. Az adatlap fejléce ennél nagyobb
// keret, ott a bélyeg lágyabb — a részletes kép egy koppintásra, a képnézőben
// jön le, cserébe a lista és az adatlap megnyitása alig fogyaszt adatot.
const VINE_PHOTO_THUMBNAIL_MAX_SIDE = 120;

export type PreparedVinePhoto = PreparedPhoto;

export type VinePhotoUploadProgress = PhotoUploadProgress;

/**
 * Az új tőkefotók útvonala. Nincs benne eseményazonosító: a fotó a tőke önálló
 * képe. A migrált rekordok megtartják a régi, eseményes útvonalukat — új
 * feltöltés viszont sosem használja azt.
 */
export function buildVinePhotoStoragePath(
  vineId: string,
  photoId: string,
  extension: string,
): string {
  return `vines/${vineId}/photos/${photoId}.${extension}`;
}

export async function prepareVinePhotos(
  files: readonly File[],
): Promise<PreparedVinePhoto[]> {
  return Promise.all(
    files.map((file) =>
      prepareImageUpload(file, {
        maxImageSide: VINE_PHOTO_MAX_SIDE,
        thumbnailMaxSide: VINE_PHOTO_THUMBNAIL_MAX_SIDE,
      }),
    ),
  );
}

export async function uploadPreparedVinePhotos(
  storage: FirebaseStorage,
  vineId: string,
  preparedPhotos: readonly PreparedVinePhoto[],
  onProgress?: VinePhotoUploadProgress,
): Promise<VinePhoto[]> {
  const uploads = await uploadPreparedPhotos({
    storage,
    photos: preparedPhotos,
    buildStoragePath: ({ photoId, extension }) =>
      buildVinePhotoStoragePath(vineId, photoId, extension),
    onProgress,
  });

  const now = new Date().toISOString();

  // A felirat üresen keletkezik: a feltöltés nem tud róla, a galériában
  // szerkeszthető utólag.
  return uploads.map((upload) => toPhotoRecord({ ...upload, id: upload.photoId }, now));
}

/**
 * Best-effort Storage-törlés a rekord saját útvonalai alapján. Így a migrált,
 * még a régi eseményes útvonalon álló objektum ugyanúgy törlődik, mint az új.
 */
export async function deleteVinePhotoObjects(
  storage: FirebaseStorage,
  photos: readonly VinePhoto[],
): Promise<void> {
  await deletePhotoObjects(
    storage,
    // A bélyeg önálló Storage-objektum: a nagy képpel együtt kell mennie,
    // különben árva marad.
    photos
      .flatMap((photo) => [photo.storagePath, photo.thumbnail?.storagePath ?? ''])
      .filter((storagePath) => storagePath.length > 0),
  );
}
