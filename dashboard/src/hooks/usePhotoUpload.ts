import { useCallback, useState } from 'react';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { prepareImageUpload } from '../lib/imageUpload';
import { getFileExtension } from '../lib/fileUtils';

interface UploadFileItem {
  file: File;
}

interface BuildStoragePathParams {
  file: File;
  index: number;
  extension: string;
  generatedId: string;
}

interface UploadRequest {
  files: FileList | UploadFileItem[] | File[];
  storagePathPrefix: string;
  maxImageSide?: number;
  buildStoragePath?: (params: BuildStoragePathParams) => string;
}

export interface UploadedPhoto {
  file: File;
  storagePath: string;
  downloadUrl: string;
  width: number;
  height: number;
  contentType: string;
}

interface UploadState {
  uploading: boolean;
  error: string | null;
  progress: number;
}

function toUploadItems(files: UploadRequest['files']): UploadFileItem[] {
  if (files instanceof FileList) {
    return Array.from(files).map((file) => ({ file }));
  }

  return files.map((item) => {
    if ('file' in item) {
      return item;
    }

    return { file: item };
  });
}

function joinStoragePath(prefix: string, relativePath: string): string {
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '');
  const cleanRelativePath = relativePath.replace(/^\/+/, '');

  return `${cleanPrefix}/${cleanRelativePath}`;
}

export function usePhotoUpload() {
  const [state, setState] = useState<UploadState>({
    uploading: false,
    error: null,
    progress: 0,
  });

  const upload = useCallback(async (request: UploadRequest): Promise<UploadedPhoto[]> => {
    const items = toUploadItems(request.files);
    if (items.length === 0) {
      setState({ uploading: false, error: null, progress: 0 });
      return [];
    }

    setState({ uploading: true, error: null, progress: 0 });

    let uploadedBytes = 0;

    try {
      const preparedItems = await Promise.all(
        items.map(async ({ file }) => ({
          file,
          prepared: await prepareImageUpload(file, { maxImageSide: request.maxImageSide }),
        })),
      );

      const totalBytes = preparedItems.reduce((sum, item) => sum + item.prepared.blob.size, 0);
      const uploads: UploadedPhoto[] = [];

      for (const [index, item] of preparedItems.entries()) {
        const extension = getFileExtension(item.prepared.contentType);
        const generatedId = crypto.randomUUID();
        const relativePath = request.buildStoragePath
          ? request.buildStoragePath({
              file: item.file,
              index,
              extension,
              generatedId,
            })
          : `${generatedId}.${extension}`;
        const storagePath = joinStoragePath(request.storagePathPrefix, relativePath);
        const storageRef = ref(storage, storagePath);

        await new Promise<void>((resolve, reject) => {
          const uploadTask = uploadBytesResumable(storageRef, item.prepared.blob, {
            contentType: item.prepared.contentType,
          });

          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const aggregateTransferred = uploadedBytes + snapshot.bytesTransferred;
              const nextProgress = totalBytes > 0 ? Math.round((aggregateTransferred / totalBytes) * 100) : 100;
              setState((current) => ({ ...current, progress: nextProgress }));
            },
            (nextError) => {
              reject(nextError);
            },
            () => {
              uploadedBytes += item.prepared.blob.size;
              resolve();
            },
          );
        });

        const downloadUrl = await getDownloadURL(storageRef);
        uploads.push({
          file: item.file,
          storagePath,
          downloadUrl,
          width: item.prepared.width,
          height: item.prepared.height,
          contentType: item.prepared.contentType,
        });
      }

      setState({ uploading: false, error: null, progress: 100 });
      return uploads;
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : 'Nem sikerült feltölteni a képet.';
      setState({ uploading: false, error: message, progress: 0 });
      throw nextError;
    }
  }, []);

  return {
    upload,
    uploading: state.uploading,
    error: state.error,
    progress: state.progress,
  };
}
