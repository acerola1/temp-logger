import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_MAX_SELECTED_PHOTOS,
  appendSelectedPhotos,
  releaseSelectedPhotos,
  removeSelectedPhotoAt,
  selectedPhotoFiles,
} from './photoSelection';

let createdUrls: string[];
let revokedUrls: string[];

function makeFiles(count: number, prefix = 'kep'): File[] {
  return Array.from({ length: count }, (_, index) =>
    new File(['x'], `${prefix}-${index + 1}.jpg`, { type: 'image/jpeg' }),
  );
}

beforeEach(() => {
  createdUrls = [];
  revokedUrls = [];
  vi.stubGlobal('URL', {
    createObjectURL: () => {
      const url = `blob:kep-${createdUrls.length + 1}`;
      createdUrls.push(url);
      return url;
    },
    revokeObjectURL: (url: string) => {
      revokedUrls.push(url);
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('appendSelectedPhotos', () => {
  it('a több körben választott képeket összefűzi', () => {
    const [first] = makeFiles(1, 'elso');
    const [second] = makeFiles(1, 'masodik');

    const selection = appendSelectedPhotos(appendSelectedPhotos([], [first]).photos, [second]);

    expect(selectedPhotoFiles(selection.photos).map((file) => file.name)).toEqual([
      'elso-1.jpg',
      'masodik-1.jpg',
    ]);
    expect(selection.photos.map((photo) => photo.previewUrl)).toEqual(createdUrls);
    expect(selection.error).toBeNull();
  });

  it('ugyanazt a fájlt másodszor is elfogadja', () => {
    const [file] = makeFiles(1);

    const selection = appendSelectedPhotos(appendSelectedPhotos([], [file]).photos, [file]);

    expect(selection.photos).toHaveLength(2);
  });

  it('a limit feletti kijelölést a maradék helyre vágja és jelzi', () => {
    const current = appendSelectedPhotos([], makeFiles(2, 'meglevo')).photos;

    const selection = appendSelectedPhotos(current, makeFiles(3, 'uj'), 4);

    expect(selectedPhotoFiles(selection.photos).map((file) => file.name)).toEqual([
      'meglevo-1.jpg',
      'meglevo-2.jpg',
      'uj-1.jpg',
      'uj-2.jpg',
    ]);
    expect(selection.rejectedCount).toBe(1);
    expect(selection.error).toBe('Legfeljebb 4 fotó választható ki, 1 kép kimaradt.');
  });

  it('a kimaradó képekhez nem készít objectURL-t', () => {
    appendSelectedPhotos([], makeFiles(5), 2);

    expect(createdUrls).toHaveLength(2);
  });

  it('teli listára semmit nem vesz fel', () => {
    const current = appendSelectedPhotos([], makeFiles(DEFAULT_MAX_SELECTED_PHOTOS)).photos;

    const selection = appendSelectedPhotos(current, makeFiles(2, 'uj'));

    expect(selection.photos).toHaveLength(DEFAULT_MAX_SELECTED_PHOTOS);
    expect(selection.rejectedCount).toBe(2);
    expect(selection.error).toBe(
      `Legfeljebb ${DEFAULT_MAX_SELECTED_PHOTOS} fotó választható ki, 2 kép kimaradt.`,
    );
  });
});

describe('removeSelectedPhotoAt', () => {
  it('csak a megadott indexű képet veszi ki, és felszabadítja az objectURL-jét', () => {
    const photos = appendSelectedPhotos([], makeFiles(3)).photos;

    const remaining = removeSelectedPhotoAt(photos, 1);

    expect(selectedPhotoFiles(remaining).map((file) => file.name)).toEqual([
      'kep-1.jpg',
      'kep-3.jpg',
    ]);
    expect(revokedUrls).toEqual([photos[1].previewUrl]);
  });

  it('nem létező indexre változatlanul hagyja a listát', () => {
    const photos = appendSelectedPhotos([], makeFiles(2)).photos;

    expect(removeSelectedPhotoAt(photos, 5)).toHaveLength(2);
    expect(revokedUrls).toEqual([]);
  });
});

describe('releaseSelectedPhotos', () => {
  it('minden objectURL-t felszabadít', () => {
    const photos = appendSelectedPhotos([], makeFiles(3)).photos;

    releaseSelectedPhotos(photos);

    expect(revokedUrls).toEqual(createdUrls);
  });
});
