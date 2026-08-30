// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MAX_VINE_PHOTOS, type Vine, type VinePhoto } from '../model';
import type { VinePhotoUploadJob } from '../vinePhotoUploadQueue';
import { VinePhotoSection } from './VinePhotoSection';

function photo(id: string, overrides: Partial<VinePhoto> = {}): VinePhoto {
  return {
    id,
    storagePath: `vines/vine-1/photos/${id}.jpg`,
    downloadUrl: `https://example.test/${id}.jpg`,
    width: 1280,
    height: 960,
    thumbnail: null,
    capturedAt: null,
    uploadedAt: '2026-08-01T10:00:00.000Z',
    caption: '',
    ...overrides,
  };
}

function vine(photos: VinePhoto[], coverPhotoId: string | null = null): Vine {
  return {
    id: 'vine-1',
    serialNumber: 1,
    variety: 'Kékfrankos',
    hasFruited: false,
    rootType: 'own_rooted',
    rootstockVariety: '',
    plantingDate: { precision: 'unknown' },
    location: 'Telek',
    areaDescription: 'Déli sor',
    status: 'active',
    tags: [],
    notes: '',
    sourceCuttingId: null,
    photos,
    coverPhotoId,
    events: [],
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    createdByUid: null,
  };
}

function renderSection(
  target: Vine,
  {
    isAdmin = true,
    onAddPhotos = vi.fn().mockResolvedValue(undefined),
    pendingPhotos = [],
  }: {
    isAdmin?: boolean;
    onAddPhotos?: Mock<(photos: File[]) => void>;
    pendingPhotos?: VinePhotoUploadJob[];
  } = {},
) {
  render(
    <VinePhotoSection
      vine={target}
      isAdmin={isAdmin}
      isPending={false}
      mutationError={null}
      pendingPhotos={pendingPhotos}
      onAddPhotos={onAddPhotos}
      onDeletePhoto={vi.fn().mockResolvedValue(undefined)}
      onEditCaption={vi.fn().mockResolvedValue(undefined)}
      onSetCoverPhoto={vi.fn().mockResolvedValue(undefined)}
      onRetryPendingPhoto={vi.fn()}
      onCancelPendingPhoto={vi.fn()}
    />,
  );
  return { onAddPhotos };
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('A rejtett fájlinput nem található.');
  return input;
}

function makeFiles(count: number): File[] {
  return Array.from(
    { length: count },
    (_, index) => new File(['x'], `kep-${index + 1}.jpg`, { type: 'image/jpeg' }),
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('VinePhotoSection', () => {
  it('publikus nézetben fotó nélkül nem jelenít meg szakaszt', () => {
    renderSection(vine([]), { isAdmin: false });

    expect(screen.queryByRole('region', { name: 'Fotók' })).toBeNull();
  });

  it('adminnak fotó nélkül is üres állapotot és választógombot ad', () => {
    renderSection(vine([]));

    expect(screen.getByText('Fotók (0)')).toBeDefined();
    expect(screen.getByText('Még nincs fotó ehhez a tőkéhez.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Fotó hozzáadása' })).toBeDefined();
  });

  it('publikus nézetben meglévő képnél a galéria látszik, írási művelet nélkül', () => {
    renderSection(vine([photo('a')]), { isAdmin: false });

    expect(screen.getByText('Fotók (1)')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Fotó hozzáadása' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Törlés' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Borítókép/ })).toBeNull();
  });

  it('a maradék helyre vág, és a kimaradt képekről szól', async () => {
    const user = userEvent.setup();
    const photos = Array.from({ length: MAX_VINE_PHOTOS - 1 }, (_, index) =>
      photo(`meglevo-${index}`),
    );
    const { onAddPhotos } = renderSection(vine(photos));

    await user.upload(fileInput(), makeFiles(3));

    expect(onAddPhotos).toHaveBeenCalledTimes(1);
    expect((onAddPhotos.mock.calls[0][0] as File[]).map((file) => file.name)).toEqual([
      'kep-1.jpg',
    ]);
    expect(
      screen.getByText('Ehhez a tőkéhez már csak 1 fotó vehető fel, 2 kép kimaradt.'),
    ).toBeDefined();
  });

  it('nulla szabad helynél feltöltést sem indít', async () => {
    const user = userEvent.setup();
    const photos = Array.from({ length: MAX_VINE_PHOTOS }, (_, index) => photo(`meglevo-${index}`));
    const { onAddPhotos } = renderSection(vine(photos));

    await user.upload(fileInput(), makeFiles(1));

    expect(onAddPhotos).not.toHaveBeenCalled();
    expect(
      screen.getByText(`Ehhez a tőkéhez már ${MAX_VINE_PHOTOS} fotó tartozik. Előbb törölj egyet.`),
    ).toBeDefined();
  });

  it('a függő photoId-ket is beleszámolja a kapacitásba', async () => {
    const user = userEvent.setup();
    const photos = Array.from({ length: MAX_VINE_PHOTOS - 1 }, (_, index) =>
      photo(`meglevo-${index}`),
    );
    const onAddPhotos = vi.fn();
    renderSection(vine(photos), {
      onAddPhotos,
      pendingPhotos: [{
        jobId: 'job-1',
        photoId: 'pending-1',
        vineId: 'vine-1',
        fileName: 'pending.jpg',
        status: 'uploading' as const,
        progress: 20,
        previewUrl: null,
        error: null,
      }],
    });

    await user.upload(fileInput(), makeFiles(1));
    expect(onAddPhotos).not.toHaveBeenCalled();
  });

  it('a kézzel kijelölt és az automatikus borítót külön jelzi', async () => {
    const user = userEvent.setup();
    const photos = [
      photo('regi', { capturedAt: '2026-05-01T08:00:00.000Z' }),
      photo('friss', { capturedAt: '2026-07-01T08:00:00.000Z' }),
    ];

    renderSection(vine(photos));
    expect(screen.getByText('Automatikus borító')).toBeDefined();

    cleanup();
    renderSection(vine(photos, 'regi'));
    // A kijelölt kép nem a rendezés első eleme, ezért rá kell lépni.
    await user.click(screen.getByRole('button', { name: 'Következő kép' }));
    expect(screen.getByText('Kijelölt borító')).toBeDefined();
  });
});
