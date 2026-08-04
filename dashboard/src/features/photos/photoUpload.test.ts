import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FirebaseStorage } from 'firebase/storage';
import { uploadPreparedPhotos, type PreparedPhoto } from './photoUpload';

interface StorageRef {
  path: string;
}

const deletedPaths: string[] = [];
const failingPaths = new Set<string>();
// A bélyeg útjában véletlen `photoId` van, ezért a hibát végződésre is lehet kérni.
const failingSuffixes = new Set<string>();

vi.mock('firebase/storage', () => ({
  ref: (_storage: unknown, path: string): StorageRef => ({ path }),
  getDownloadURL: async (storageRef: StorageRef) => `https://storage.test/${storageRef.path}`,
  deleteObject: async (storageRef: StorageRef) => {
    deletedPaths.push(storageRef.path);
  },
  uploadBytesResumable: (storageRef: StorageRef, blob: Blob) => ({
    on: (
      _event: string,
      onSnapshot: (snapshot: { bytesTransferred: number }) => void,
      onError: (error: Error) => void,
      onComplete: () => void,
    ) => {
      onSnapshot({ bytesTransferred: blob.size / 2 });

      const shouldFail =
        failingPaths.has(storageRef.path) ||
        [...failingSuffixes].some((suffix) => storageRef.path.endsWith(suffix));
      if (shouldFail) {
        onError(new Error(`upload failed: ${storageRef.path}`));
        return;
      }

      onSnapshot({ bytesTransferred: blob.size });
      onComplete();
    },
  }),
}));

const storage = {} as FirebaseStorage;

function makePreparedPhoto(bytes: number, capturedAt: string | null = null): PreparedPhoto {
  return {
    blob: new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }),
    width: 100,
    height: 80,
    contentType: 'image/jpeg',
    capturedAt,
    thumbnail: null,
  };
}

function withThumbnail(photo: PreparedPhoto, bytes: number): PreparedPhoto {
  return {
    ...photo,
    thumbnail: {
      blob: new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }),
      width: 40,
      height: 32,
    },
  };
}

function buildStoragePath({ index, extension }: { index: number; extension: string }) {
  return `photos/${index}.${extension}`;
}

beforeEach(() => {
  deletedPaths.length = 0;
  failingPaths.clear();
  failingSuffixes.clear();
});

describe('uploadPreparedPhotos', () => {
  it('feltölti a képeket, és összesített bájt-progresszt jelent', async () => {
    const onProgress = vi.fn();

    const uploads = await uploadPreparedPhotos({
      storage,
      photos: [makePreparedPhoto(100), makePreparedPhoto(300)],
      buildStoragePath,
      onProgress,
    });

    expect(uploads.map((upload) => upload.storagePath)).toEqual([
      'photos/0.jpg',
      'photos/1.jpg',
    ]);
    expect(uploads[0].downloadUrl).toBe('https://storage.test/photos/0.jpg');
    expect(uploads.every((upload) => upload.photoId.length > 0)).toBe(true);
    expect(onProgress.mock.calls).toEqual([
      [50, 400],
      [100, 400],
      [100, 400],
      [250, 400],
      [400, 400],
      [400, 400],
    ]);
    expect(deletedPaths).toEqual([]);
  });

  it('hiba esetén best-effort törli az addig feltöltött objektumokat', async () => {
    failingPaths.add('photos/1.jpg');

    await expect(
      uploadPreparedPhotos({
        storage,
        photos: [makePreparedPhoto(100), makePreparedPhoto(100), makePreparedPhoto(100)],
        buildStoragePath,
      }),
    ).rejects.toThrow('upload failed: photos/1.jpg');

    expect(deletedPaths).toEqual(['photos/0.jpg', 'photos/1.jpg']);
  });

  it('a takarítás hibáját elnyeli, és az eredeti hibát dobja tovább', async () => {
    const storageModule = await import('firebase/storage');
    const deleteObjectSpy = vi
      .spyOn(storageModule, 'deleteObject')
      .mockRejectedValue(new Error('cleanup failed'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    failingPaths.add('photos/0.jpg');

    await expect(
      uploadPreparedPhotos({
        storage,
        photos: [makePreparedPhoto(100)],
        buildStoragePath,
      }),
    ).rejects.toThrow('upload failed: photos/0.jpg');

    expect(deleteObjectSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalled();

    deleteObjectSpy.mockRestore();
    warnSpy.mockRestore();
  });
});

describe('uploadPreparedPhotos bélyeggel', () => {
  function buildPhotoIdPath({
    index,
    photoId,
    extension,
  }: {
    index: number;
    photoId: string;
    extension: string;
  }) {
    return `photos/${index}/${photoId}.${extension}`;
  }

  it('a nagy kép után a bélyeget is feltölti, ugyanabba a mappába', async () => {
    const uploads = await uploadPreparedPhotos({
      storage,
      photos: [withThumbnail(makePreparedPhoto(300), 40)],
      buildStoragePath: buildPhotoIdPath,
    });

    const { photoId, storagePath, thumbnail } = uploads[0];
    expect(storagePath).toBe(`photos/0/${photoId}.jpg`);
    expect(thumbnail).toEqual({
      storagePath: `photos/0/${photoId}_thumb.jpg`,
      downloadUrl: `https://storage.test/photos/0/${photoId}_thumb.jpg`,
      width: 40,
      height: 32,
    });
  });

  it('a bélyeg bájtjait is beleszámolja, így a folyamatjelző nem ugrik vissza', async () => {
    const onProgress = vi.fn();

    await uploadPreparedPhotos({
      storage,
      photos: [withThumbnail(makePreparedPhoto(300), 100)],
      buildStoragePath: buildPhotoIdPath,
      onProgress,
    });

    const reported = onProgress.mock.calls.map(([uploadedBytes]) => uploadedBytes as number);
    expect(onProgress.mock.calls.every(([, totalBytes]) => totalBytes === 400)).toBe(true);
    expect(reported).toEqual([...reported].sort((left, right) => left - right));
    expect(reported.at(-1)).toBe(400);
  });

  it('bélyeg nélküli előkészítéshez nem tölt fel második objektumot', async () => {
    const uploads = await uploadPreparedPhotos({
      storage,
      photos: [makePreparedPhoto(300)],
      buildStoragePath: buildPhotoIdPath,
    });

    expect(uploads[0].thumbnail).toBeNull();
    expect(deletedPaths).toEqual([]);
  });

  it('a bélyeg hibáján a hozzá tartozó nagy kép sem marad a Storage-ban', async () => {
    failingSuffixes.add('_thumb.jpg');

    await expect(
      uploadPreparedPhotos({
        storage,
        photos: [withThumbnail(makePreparedPhoto(100), 20)],
        buildStoragePath: buildPhotoIdPath,
      }),
    ).rejects.toThrow('upload failed');

    expect(deletedPaths).toHaveLength(2);
    expect(deletedPaths[1]).toBe(`${deletedPaths[0].replace(/\.jpg$/, '')}_thumb.jpg`);
  });
});
