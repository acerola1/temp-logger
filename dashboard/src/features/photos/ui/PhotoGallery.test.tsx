// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Photo } from '../photoMetadata';
import { PhotoGallery, type PhotoGalleryProps } from './PhotoGallery';

function makePhoto(id: string, uploadedAt: string, caption = ''): Photo {
  return {
    id,
    storagePath: `photos/${id}.jpg`,
    downloadUrl: `https://example.test/${id}.jpg`,
    width: 1000,
    height: 750,
    thumbnail: null,
    capturedAt: null,
    uploadedAt,
    caption,
  };
}

const PHOTOS = [
  makePhoto('old', '2026-07-01T10:00:00.000Z', 'Régi kép'),
  makePhoto('new', '2026-08-01T10:00:00.000Z', 'Új kép'),
];

function renderGallery(overrides: Partial<PhotoGalleryProps> = {}) {
  const props: PhotoGalleryProps = {
    galleryId: 'gallery-1',
    photos: PHOTOS,
    alt: 'Dugvány',
    isAdmin: true,
    onAddPhotos: vi.fn().mockResolvedValue(undefined),
    onDeletePhoto: vi.fn().mockResolvedValue(undefined),
    onEditCaption: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(<PhotoGallery {...props} />);
  return props;
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('A fotóválasztó input nem található.');
  return input;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('PhotoGallery', () => {
  it('a legújabb fotóval kezd, és ugyanebben a sorrendben nyitja a lightboxot', async () => {
    const user = userEvent.setup();
    renderGallery();

    expect(screen.getByText('Kép 1/2')).toBeTruthy();
    expect(screen.getByText('Új kép')).toBeTruthy();

    await user.click(screen.getByTitle('Teljes képernyős nézet'));

    const dialog = screen.getByRole('dialog', { name: 'Fotó' });
    expect(dialog).toBeTruthy();
    expect(screen.getByText(/Kép 1\/2 • Új kép/)).toBeTruthy();
    expect(within(dialog).getByRole<HTMLButtonElement>('button', { name: 'Előző kép' }).disabled).toBe(true);
  });

  it('nem admin felhasználónak nem mutat írási műveletet', () => {
    renderGallery({ isAdmin: false });

    expect(screen.queryByRole('button', { name: 'Fotó hozzáadása' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Képaláírás szerkesztése' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Törlés' })).toBeNull();
  });

  it('legfeljebb hat fájlt ad át, és jelzi a kimaradt képeket', async () => {
    const onAddPhotos = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderGallery({ onAddPhotos });
    const files = Array.from({ length: 8 }, (_, index) =>
      new File(['x'], `kep-${index}.jpg`, { type: 'image/jpeg' }),
    );

    await user.upload(fileInput(), files);

    expect(onAddPhotos).toHaveBeenCalledTimes(1);
    expect(onAddPhotos.mock.calls[0]?.[0]).toHaveLength(6);
    expect(screen.getByRole('alert').textContent).toContain('2 kép kimaradt');
  });

  it('az aktív fotó képaláírását módosítja, és üresre is törölheti', async () => {
    const onEditCaption = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderGallery({ onEditCaption });

    await user.click(screen.getByRole('button', { name: 'Képaláírás szerkesztése' }));
    const input = screen.getByRole('textbox', { name: 'Képaláírás' });
    await user.clear(input);
    await user.click(screen.getByRole('button', { name: 'Mentés' }));

    expect(onEditCaption).toHaveBeenCalledWith('new', '');
  });

  it('megerősítés után az aktív fotó törlését kéri', async () => {
    const onDeletePhoto = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window, 'confirm', {
      configurable: true,
      value: vi.fn(() => true),
    });
    const user = userEvent.setup();
    renderGallery({ onDeletePhoto });

    await user.click(screen.getByRole('button', { name: 'Törlés' }));

    expect(onDeletePhoto).toHaveBeenCalledWith('new');
  });

  it('borító-interface nélkül nem mutat borítóműveletet', () => {
    renderGallery();

    expect(screen.queryByRole('button', { name: 'Borítóképnek' })).toBeNull();
    expect(screen.queryByText('Automatikus borító')).toBeNull();
  });

  it('megkülönbözteti az automatikus és a kézzel kijelölt borítót', async () => {
    const onPin = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    const { rerender } = render(
      <PhotoGallery
        {...renderGalleryProps({ cover: { pinnedPhotoId: null, onPin } })}
      />,
    );

    expect(screen.getByText('Automatikus borító')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Borítóképnek' }));
    expect(onPin).toHaveBeenCalledWith('new');

    rerender(
      <PhotoGallery
        {...renderGalleryProps({ cover: { pinnedPhotoId: 'old', onPin } })}
      />,
    );
    expect(screen.getByText('Automatikus borító')).toBeTruthy();
    expect(screen.queryByText('Kijelölt borító')).toBeNull();

    const olderThumbnail = document.querySelector<HTMLButtonElement>('[data-photo-id="old"]');
    if (!olderThumbnail) throw new Error('A régebbi fotó bélyege nem található.');
    await user.click(olderThumbnail);
    expect(screen.getByText('Kijelölt borító')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Automatikus borító' })).toBeTruthy();
  });
});

function renderGalleryProps(overrides: Partial<PhotoGalleryProps> = {}): PhotoGalleryProps {
  return {
    galleryId: 'gallery-cover',
    photos: PHOTOS,
    alt: 'Tőke',
    isAdmin: true,
    onAddPhotos: vi.fn().mockResolvedValue(undefined),
    onDeletePhoto: vi.fn().mockResolvedValue(undefined),
    onEditCaption: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}
