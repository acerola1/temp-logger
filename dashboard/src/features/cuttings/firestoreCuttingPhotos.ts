import {
  doc,
  runTransaction,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';
import { deletePhotoObjects } from '../photos';
import type { CuttingPhoto } from '../../types/cutting';

interface StoredCuttingPhoto {
  id?: unknown;
  storagePath?: unknown;
  downloadUrl?: unknown;
  url?: unknown;
  capturedAt?: unknown;
  uploadedAt?: unknown;
  width?: unknown;
  height?: unknown;
  thumbnail?: unknown;
  caption?: unknown;
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function mapThumbnail(value: unknown): CuttingPhoto['thumbnail'] {
  if (!value || typeof value !== 'object') return null;
  const thumbnail = value as Record<string, unknown>;
  const downloadUrl = stringValue(thumbnail.downloadUrl);
  if (!downloadUrl) return null;

  return {
    storagePath: stringValue(thumbnail.storagePath),
    downloadUrl,
    width: typeof thumbnail.width === 'number' ? thumbnail.width : 0,
    height: typeof thumbnail.height === 'number' ? thumbnail.height : 0,
  };
}

/** A régi `url` rekordokat is a közös fotóalakká fordítja, kitalált dátum nélkül. */
export function mapCuttingPhotos(value: unknown, cuttingId: string): CuttingPhoto[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const photo = item as StoredCuttingPhoto;
    const downloadUrl = stringValue(photo.url) || stringValue(photo.downloadUrl);
    if (!downloadUrl) return [];

    return [{
      id: stringValue(photo.id, `${cuttingId}-photo-${index}`),
      storagePath: stringValue(photo.storagePath),
      downloadUrl,
      capturedAt: typeof photo.capturedAt === 'string' ? photo.capturedAt : null,
      uploadedAt: stringValue(photo.uploadedAt, new Date(0).toISOString()),
      width: typeof photo.width === 'number' ? photo.width : 0,
      height: typeof photo.height === 'number' ? photo.height : 0,
      thumbnail: mapThumbnail(photo.thumbnail),
      caption: stringValue(photo.caption),
    } satisfies CuttingPhoto];
  });
}

function photoStoragePaths(photo: CuttingPhoto): string[] {
  return [photo.storagePath, photo.thumbnail?.storagePath]
    .filter((path): path is string => Boolean(path));
}

function storedPhotos(data: DocumentData | undefined): unknown[] {
  return Array.isArray(data?.photos) ? data.photos : [];
}

function storedPhotoId(item: unknown, cuttingId: string, index: number): string | null {
  if (!item || typeof item !== 'object') return null;
  return stringValue((item as StoredCuttingPhoto).id, `${cuttingId}-photo-${index}`);
}

export async function addCuttingPhotos(
  firestore: Firestore,
  storage: FirebaseStorage,
  cuttingId: string,
  photos: readonly CuttingPhoto[],
): Promise<void> {
  const cuttingRef = doc(firestore, 'cuttings', cuttingId);

  try {
    await runTransaction(firestore, async (transaction) => {
      const snapshot = await transaction.get(cuttingRef);
      if (!snapshot.exists()) throw new Error('A dugvány nem található.');

      const existingPhotos = storedPhotos(snapshot.data());
      const existingIds = new Set(
        existingPhotos.flatMap((photo, index) => {
          const id = storedPhotoId(photo, cuttingId, index);
          return id ? [id] : [];
        }),
      );
      const addedPhotos = photos.filter((photo) => !existingIds.has(photo.id));

      transaction.update(cuttingRef, {
        photos: [...existingPhotos, ...addedPhotos],
        updatedAt: new Date().toISOString(),
      });
    });
  } catch (error) {
    await deletePhotoObjects(storage, photos.flatMap(photoStoragePaths));
    throw error;
  }
}

export async function editCuttingPhotoCaption(
  firestore: Firestore,
  cuttingId: string,
  photoId: string,
  caption: string,
): Promise<void> {
  const cuttingRef = doc(firestore, 'cuttings', cuttingId);

  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(cuttingRef);
    if (!snapshot.exists()) throw new Error('A dugvány nem található.');

    const photos = storedPhotos(snapshot.data());
    const photoIndex = photos.findIndex(
      (photo, index) => storedPhotoId(photo, cuttingId, index) === photoId,
    );
    if (photoIndex < 0) throw new Error('A fotó nem található.');

    const photo = photos[photoIndex];
    if (!photo || typeof photo !== 'object') throw new Error('A fotó rekordja hibás.');
    photos[photoIndex] = { ...photo, caption: caption.trim() };
    transaction.update(cuttingRef, {
      photos,
      updatedAt: new Date().toISOString(),
    });
  });
}

export async function deleteCuttingPhoto(
  firestore: Firestore,
  storage: FirebaseStorage,
  cuttingId: string,
  photoId: string,
): Promise<void> {
  const cuttingRef = doc(firestore, 'cuttings', cuttingId);
  const removedPhoto = await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(cuttingRef);
    if (!snapshot.exists()) throw new Error('A dugvány nem található.');

    const photos = storedPhotos(snapshot.data());
    const photoIndex = photos.findIndex(
      (photo, index) => storedPhotoId(photo, cuttingId, index) === photoId,
    );
    if (photoIndex < 0) return null;
    const photo = mapCuttingPhotos(photos, cuttingId).find((item) => item.id === photoId) ?? null;

    transaction.update(cuttingRef, {
      photos: photos.filter((_, index) => index !== photoIndex),
      updatedAt: new Date().toISOString(),
    });
    return photo;
  });

  if (removedPhoto) {
    await deletePhotoObjects(storage, photoStoragePaths(removedPhoto));
  }
}
