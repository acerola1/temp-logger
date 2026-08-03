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

export interface UploadedPhotoObject {
  photoId: string;
  storagePath: string;
  downloadUrl: string;
  width: number;
  height: number;
  contentType: string;
  /** Az előkészítéskor kiolvasott EXIF-készítési idő, továbbadva a rekordnak. */
  capturedAt: IsoDateTimeString | null;
}

export type PhotoUploadProgress = (uploadedBytes: number, totalBytes: number) => void;

export interface BuildPhotoStoragePathParams {
  index: number;
  photoId: string;
  extension: string;
}

export interface UploadPreparedPhotosRequest {
  storage: FirebaseStorage;
  photos: readonly PreparedPhoto[];
  buildStoragePath: (params: BuildPhotoStoragePathParams) => string;
  onProgress?: PhotoUploadProgress;
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
}: UploadPreparedPhotosRequest): Promise<UploadedPhotoObject[]> {
  const totalBytes = photos.reduce((sum, photo) => sum + photo.blob.size, 0);
  let uploadedBytes = 0;
  const uploadedPaths: string[] = [];
  const uploads: UploadedPhotoObject[] = [];

  try {
    for (const [index, prepared] of photos.entries()) {
      const photoId = crypto.randomUUID();
      const extension = getFileExtension(prepared.contentType);
      const storagePath = buildStoragePath({ index, photoId, extension });
      const storageRef = ref(storage, storagePath);
      uploadedPaths.push(storagePath);

      await new Promise<void>((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, prepared.blob, {
          contentType: prepared.contentType,
        });

        uploadTask.on(
          'state_changed',
          (snapshot) => onProgress?.(uploadedBytes + snapshot.bytesTransferred, totalBytes),
          reject,
          () => {
            uploadedBytes += prepared.blob.size;
            onProgress?.(uploadedBytes, totalBytes);
            resolve();
          },
        );
      });

      uploads.push({
        photoId,
        storagePath,
        downloadUrl: await getDownloadURL(storageRef),
        width: prepared.width,
        height: prepared.height,
        contentType: prepared.contentType,
        capturedAt: prepared.capturedAt,
      });
    }

    return uploads;
  } catch (error) {
    await deletePhotoObjects(storage, uploadedPaths);
    throw error;
  }
}
