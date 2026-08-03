import { useCallback, useState } from 'react';
import { storage } from '../../lib/firebase';
import { prepareImageUpload } from './imagePreparation';
import { uploadPreparedPhotos, type UploadedPhotoObject } from './photoUpload';

interface UploadFileItem {
  file: File;
}

export interface BuildStoragePathParams {
  file: File;
  index: number;
  extension: string;
  photoId: string;
}

export interface UploadRequest {
  files: FileList | UploadFileItem[] | File[];
  storagePathPrefix: string;
  maxImageSide?: number;
  buildStoragePath?: (params: BuildStoragePathParams) => string;
}

export interface UploadedPhoto extends UploadedPhotoObject {
  file: File;
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

    try {
      const files = items.map((item) => item.file);
      const preparedPhotos = await Promise.all(
        files.map((file) => prepareImageUpload(file, { maxImageSide: request.maxImageSide })),
      );

      const uploads = await uploadPreparedPhotos({
        storage,
        photos: preparedPhotos,
        buildStoragePath: ({ index, photoId, extension }) => {
          const relativePath = request.buildStoragePath
            ? request.buildStoragePath({ file: files[index], index, extension, photoId })
            : `${photoId}.${extension}`;

          return joinStoragePath(request.storagePathPrefix, relativePath);
        },
        onProgress: (uploadedBytes, totalBytes) => {
          const nextProgress =
            totalBytes > 0 ? Math.round((Math.min(uploadedBytes, totalBytes) / totalBytes) * 100) : 100;
          setState((current) => ({ ...current, progress: nextProgress }));
        },
      });

      setState({ uploading: false, error: null, progress: 100 });
      return uploads.map((upload, index) => ({ ...upload, file: files[index] }));
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
