import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
  type FirebaseStorage,
} from 'firebase/storage';
import type { IsoDateTimeString } from '../../types/datetime';
import { getFileExtension, type PreparedImageUpload } from './imagePreparation';

export type PreparedPhoto = PreparedImageUpload;

/**
 * A bélyeg a nagy kép mellé, ugyanabba a mappába kerül, `_thumb` utótaggal: a
 * `storage.rules` `photos/{fileName}` mintája így változtatás nélkül érvényes rá.
 */
export const PHOTO_THUMBNAIL_SUFFIX = '_thumb';

export interface UploadedPhotoThumbnailObject {
  storagePath: string;
  downloadUrl: string;
  width: number;
  height: number;
}

export interface UploadedPhotoObject {
  photoId: string;
  storagePath: string;
  downloadUrl: string;
  width: number;
  height: number;
  contentType: string;
  /** Az előkészítéskor kiolvasott EXIF-készítési idő, továbbadva a rekordnak. */
  capturedAt: IsoDateTimeString | null;
  /** A feltöltött bélyeg, vagy `null`, ha az előkészítés nem készített. */
  thumbnail: UploadedPhotoThumbnailObject | null;
}

export type PhotoUploadProgress = (uploadedBytes: number, totalBytes: number) => void;

export interface BuildPhotoStoragePathParams {
  index: number;
  /**
   * A fájlnév törzse. A bélyegnél ugyanaz az azonosító, `_thumb` utótaggal —
   * a hívó tehát fájlnévként használja, ne fotóazonosítóként.
   */
  photoId: string;
  extension: string;
}

export interface UploadPreparedPhotosRequest {
  storage: FirebaseStorage;
  photos: readonly PreparedPhoto[];
  buildStoragePath: (params: BuildPhotoStoragePathParams) => string;
  onProgress?: PhotoUploadProgress;
  /** A hívó által előre lefoglalt stabil azonosítók. */
  photoIds?: readonly string[];
  /** Megszakításkor az éppen aktív Firebase UploadTask is leáll. */
  signal?: AbortSignal;
}

function abortError(): DOMException {
  return new DOMException('A fotófeltöltés megszakadt.', 'AbortError');
}

// Best-effort takarítás: a hívó hibaága fut tovább, a Storage-hibát csak naplózzuk.
export async function deletePhotoObjects(
  storage: FirebaseStorage,
  storagePaths: readonly string[],
): Promise<void> {
  await Promise.all(
    storagePaths.map(async (storagePath) => {
      try {
        await deleteObject(ref(storage, storagePath));
      } catch (error) {
        console.warn('Photo cleanup failed:', storagePath, error);
      }
    }),
  );
}

// Soros feltöltés: a részleges eredmény hibára eltűnik, hogy ne maradjon árva
// Storage-objektum egyetlen hívónál sem.
export async function uploadPreparedPhotos({
  storage,
  photos,
  buildStoragePath,
  onProgress,
  photoIds,
  signal,
}: UploadPreparedPhotosRequest): Promise<UploadedPhotoObject[]> {
  if (photoIds && photoIds.length !== photos.length) {
    throw new Error('Minden előkészített fotóhoz pontosan egy azonosító szükséges.');
  }
  // A bélyegek bájtjai is benne vannak az összegben, hogy a folyamatjelző ne
  // ugorjon vissza, amikor a kis kép feltöltése következik.
  const totalBytes = photos.reduce(
    (sum, photo) => sum + photo.blob.size + (photo.thumbnail?.blob.size ?? 0),
    0,
  );
  let uploadedBytes = 0;
  const uploadedPaths: string[] = [];
  const uploads: UploadedPhotoObject[] = [];

  const uploadBlob = async (
    storagePath: string,
    blob: Blob,
    contentType: string,
  ): Promise<string> => {
    if (signal?.aborted) throw abortError();
    const storageRef = ref(storage, storagePath);
    uploadedPaths.push(storagePath);

    await new Promise<void>((resolve, reject) => {
      const uploadTask = uploadBytesResumable(storageRef, blob, { contentType });
      const abort = () => {
        uploadTask.cancel();
        reject(abortError());
      };
      signal?.addEventListener('abort', abort, { once: true });

      uploadTask.on(
        'state_changed',
        (snapshot) => onProgress?.(uploadedBytes + snapshot.bytesTransferred, totalBytes),
        (error) => {
          signal?.removeEventListener('abort', abort);
          reject(signal?.aborted ? abortError() : error);
        },
        () => {
          signal?.removeEventListener('abort', abort);
          uploadedBytes += blob.size;
          onProgress?.(uploadedBytes, totalBytes);
          resolve();
        },
      );
    });

    return getDownloadURL(storageRef);
  };

  try {
    for (const [index, prepared] of photos.entries()) {
      if (signal?.aborted) throw abortError();
      const photoId = photoIds?.[index] ?? crypto.randomUUID();
      const extension = getFileExtension(prepared.contentType);
      const storagePath = buildStoragePath({ index, photoId, extension });
      const downloadUrl = await uploadBlob(storagePath, prepared.blob, prepared.contentType);

      // A bélyeg a nagy kép után megy fel: a `photoId` ugyanaz, csak a fájlnév
      // kap `_thumb` utótagot, így a hívó útvonalképzése változatlan marad.
      let thumbnail: UploadedPhotoThumbnailObject | null = null;
      if (prepared.thumbnail) {
        const thumbnailPath = buildStoragePath({
          index,
          photoId: `${photoId}${PHOTO_THUMBNAIL_SUFFIX}`,
          extension,
        });

        thumbnail = {
          storagePath: thumbnailPath,
          downloadUrl: await uploadBlob(
            thumbnailPath,
            prepared.thumbnail.blob,
            prepared.contentType,
          ),
          width: prepared.thumbnail.width,
          height: prepared.thumbnail.height,
        };
      }

      uploads.push({
        photoId,
        storagePath,
        downloadUrl,
        width: prepared.width,
        height: prepared.height,
        contentType: prepared.contentType,
        capturedAt: prepared.capturedAt,
        thumbnail,
      });
    }

    return uploads;
  } catch (error) {
    await deletePhotoObjects(storage, uploadedPaths);
    throw error;
  }
}
