import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
  type FirebaseStorage,
} from 'firebase/storage';
import { getFileExtension } from '../../lib/fileUtils';
import { prepareImageUpload } from '../../lib/imageUpload';
import type { VineEventPhoto } from './model';

export interface PreparedVineEventPhoto {
  blob: Blob;
  width: number;
  height: number;
  contentType: string;
}

export type VineEventPhotoUploadProgress = (uploadedBytes: number, totalBytes: number) => void;

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
    files.map(async (file) => {
      const prepared = await prepareImageUpload(file, { maxImageSide: 1000 });
      return {
        blob: prepared.blob,
        width: prepared.width,
        height: prepared.height,
        contentType: prepared.contentType,
      };
    }),
  );
}

async function deleteStoragePaths(storage: FirebaseStorage, paths: readonly string[]): Promise<void> {
  await Promise.all(
    paths.map(async (storagePath) => {
      try {
        await deleteObject(ref(storage, storagePath));
      } catch (error) {
        console.warn('Vine event photo cleanup failed:', storagePath, error);
      }
    }),
  );
}

export async function uploadPreparedVineEventPhotos(
  storage: FirebaseStorage,
  vineId: string,
  eventId: string,
  preparedPhotos: readonly PreparedVineEventPhoto[],
  onProgress?: VineEventPhotoUploadProgress,
): Promise<VineEventPhoto[]> {
  const totalBytes = preparedPhotos.reduce((sum, photo) => sum + photo.blob.size, 0);
  let uploadedBytes = 0;
  const uploadedPaths: string[] = [];
  const photos: VineEventPhoto[] = [];

  try {
    for (const prepared of preparedPhotos) {
      const photoId = crypto.randomUUID();
      const extension = getFileExtension(prepared.contentType);
      const storagePath = buildVineEventPhotoStoragePath(vineId, eventId, photoId, extension);
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

      photos.push({
        id: photoId,
        storagePath,
        downloadUrl: await getDownloadURL(storageRef),
        width: prepared.width,
        height: prepared.height,
        uploadedAt: new Date().toISOString(),
      });
    }

    return photos;
  } catch (error) {
    await deleteStoragePaths(storage, uploadedPaths);
    throw error;
  }
}

export async function deleteVineEventPhotos(
  storage: FirebaseStorage,
  photos: readonly VineEventPhoto[],
): Promise<void> {
  await deleteStoragePaths(
    storage,
    photos
      .map((photo) => photo.storagePath)
      .filter((storagePath): storagePath is string => storagePath.length > 0),
  );
}
