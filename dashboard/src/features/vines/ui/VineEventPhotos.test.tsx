// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MAX_VINE_EVENT_PHOTOS, type VineEvent, type VineEventPhoto } from '../model';
import { VineEventPhotos } from './VineEventPhotos';

function photo(index: number, overrides: Partial<VineEventPhoto> = {}): VineEventPhoto {
  return {
    id: `photo-${index}`,
    storagePath: `vines/vine-1/events/event-1/photos/photo-${index}.jpg`,
    downloadUrl: `https://example.test/photo-${index}.jpg`,
    width: 800,
    height: 600,
    capturedAt: null,
    uploadedAt: '2026-08-01T10:00:00.000Z',
    caption: '',
    ...overrides,
  };
}

function event(photos: VineEventPhoto[]): VineEvent {
  return {
    id: 'event-1',
    type: 'observation',
    occurredAt: '2026-08-01T09:00:00.000Z',
    title: 'Első fürtök',
    notes: '',
    photos,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
  };
}

function makeFile(name: string): File {
  return new File(['x'], name, { type: 'image/jpeg' });
}

function renderPhotos({
  photos = [photo(1)],
  isAdmin = true,
  isPending = false,
  handlers = {},
}: {
  photos?: VineEventPhoto[];
  isAdmin?: boolean;
  isPending?: boolean;
  handlers?: {
    onAddPhotos?: (files: File[]) => Promise<void>;
    onDeletePhoto?: (photoId: string) => Promise<void>;
    onEditCaption?: (photoId: string, caption: string) => Promise<void>;
    onOpenPhoto?: (index: number) => void;
  };
} = {}) {
  const onAddPhotos = vi.fn(handlers.onAddPhotos ?? (() => Promise.resolve()));
  const onDeletePhoto = vi.fn(handlers.onDeletePhoto ?? (() => Promise.resolve()));
  const onEditCaption = vi.fn(handlers.onEditCaption ?? (() => Promise.resolve()));
  const onOpenPhoto = vi.fn(handlers.onOpenPhoto ?? (() => undefined));

  render(
    <VineEventPhotos
      event={event(photos)}
      isAdmin={isAdmin}
      isPending={isPending}
      uploadProgress={null}
      errorMessage={null}
      onOpenPhoto={onOpenPhoto}
      onAddPhotos={onAddPhotos}
      onDeletePhoto={onDeletePhoto}
      onEditCaption={onEditCaption}
    />,
  );

  return { onAddPhotos, onDeletePhoto, onEditCaption, onOpenPhoto };
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('A rejtett fájlinput nem található.');
  return input;
}

// A happy-dom nem ad `window.confirm`-ot, a törléshez viszont kell.
function stubConfirm(answer: boolean) {
  vi.stubGlobal('confirm', vi.fn(() => answer));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('VineEventPhotos nem admin módban', () => {
  it('csak a bélyegeket mutatja, fotóműveleti gomb nélkül', () => {
    renderPhotos({ photos: [photo(1), photo(2)], isAdmin: false });

    expect(screen.getByRole('button', { name: 'Első fürtök 1. fotó megnyitása' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Első fürtök 2. fotó megnyitása' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Fotó hozzáadása|Kép kiválasztása/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /fotó törlése/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /képaláírásának szerkesztése/ })).toBeNull();
  });

  it('fotó nélküli eseményhez semmit nem rajzol', () => {
    renderPhotos({ photos: [], isAdmin: false });

    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('VineEventPhotos utólagos fotófelvétel', () => {
  it('több kiválasztott fotót egy műveletben ad át', async () => {
    const user = userEvent.setup();
    const { onAddPhotos } = renderPhotos();

    await user.upload(fileInput(), [makeFile('elso.jpg'), makeFile('masodik.jpg')]);

    expect(onAddPhotos).toHaveBeenCalledTimes(1);
    expect((onAddPhotos.mock.calls[0][0] as File[]).map((file) => file.name)).toEqual([
      'elso.jpg',
      'masodik.jpg',
    ]);
  });

  it('teli eseménynél üzenetet ad, és nem indít feltöltést', async () => {
    const user = userEvent.setup();
    const { onAddPhotos } = renderPhotos({
      photos: Array.from({ length: MAX_VINE_EVENT_PHOTOS }, (_, index) => photo(index + 1)),
    });

    await user.upload(fileInput(), makeFile('nem-fer-be.jpg'));

    expect(onAddPhotos).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain(
      `Ehhez az eseményhez már ${MAX_VINE_EVENT_PHOTOS} fotó tartozik`,
    );
  });

  it('a maradék helyre vág, és a kimaradt képekről szól', async () => {
    const user = userEvent.setup();
    const { onAddPhotos } = renderPhotos({
      photos: Array.from({ length: MAX_VINE_EVENT_PHOTOS - 1 }, (_, index) => photo(index + 1)),
    });

    await user.upload(fileInput(), [makeFile('befer.jpg'), makeFile('kimarad.jpg')]);

    expect((onAddPhotos.mock.calls[0][0] as File[]).map((file) => file.name)).toEqual([
      'befer.jpg',
    ]);
    expect(screen.getByRole('alert').textContent).toContain('1 kép kimaradt');
  });
});

describe('VineEventPhotos fotótörlés', () => {
  it('megerősítés után az adott fotó azonosítóját törli', async () => {
    const user = userEvent.setup();
    stubConfirm(true);
    const { onDeletePhoto } = renderPhotos({ photos: [photo(1), photo(2)] });

    await user.click(screen.getByRole('button', { name: 'Első fürtök 2. fotó törlése' }));

    expect(onDeletePhoto).toHaveBeenCalledWith('photo-2');
  });

  it('elutasított megerősítés után nem töröl', async () => {
    const user = userEvent.setup();
    stubConfirm(false);
    const { onDeletePhoto } = renderPhotos({ photos: [photo(1)] });

    await user.click(screen.getByRole('button', { name: 'Első fürtök 1. fotó törlése' }));

    expect(onDeletePhoto).not.toHaveBeenCalled();
  });
});

describe('VineEventPhotos képaláírás', () => {
  it('a meglévő feliratot mutatja, és a szerkesztőt azzal nyitja', async () => {
    const user = userEvent.setup();
    renderPhotos({ photos: [photo(1, { caption: 'Két fürt' })] });

    expect(screen.getByText('Két fürt')).toBeDefined();

    await user.click(
      screen.getByRole('button', { name: 'Első fürtök 1. fotó képaláírásának szerkesztése' }),
    );

    expect(screen.getByRole('textbox', { name: 'Első fürtök 1. fotó képaláírása' })).toHaveProperty(
      'value',
      'Két fürt',
    );
  });

  it('a beírt feliratot mentésre átadja, és bezárja a szerkesztőt', async () => {
    const user = userEvent.setup();
    const { onEditCaption } = renderPhotos({ photos: [photo(1)] });

    await user.click(
      screen.getByRole('button', { name: 'Első fürtök 1. fotó képaláírásának szerkesztése' }),
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Első fürtök 1. fotó képaláírása' }),
      'Rügyfakadás',
    );
    await user.click(screen.getByRole('button', { name: 'Aláírás mentése' }));

    expect(onEditCaption).toHaveBeenCalledWith('photo-1', 'Rügyfakadás');
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('az üres felirat is érvényes mentés', async () => {
    const user = userEvent.setup();
    const { onEditCaption } = renderPhotos({ photos: [photo(1, { caption: 'Törlendő' })] });

    await user.click(
      screen.getByRole('button', { name: 'Első fürtök 1. fotó képaláírásának szerkesztése' }),
    );
    await user.clear(screen.getByRole('textbox', { name: 'Első fürtök 1. fotó képaláírása' }));
    await user.keyboard('{Enter}');

    expect(onEditCaption).toHaveBeenCalledWith('photo-1', '');
  });

  it('a Mégse nem hív mentést', async () => {
    const user = userEvent.setup();
    const { onEditCaption } = renderPhotos({ photos: [photo(1)] });

    await user.click(
      screen.getByRole('button', { name: 'Első fürtök 1. fotó képaláírásának szerkesztése' }),
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Első fürtök 1. fotó képaláírása' }),
      'Mégsem ez',
    );
    await user.click(screen.getByRole('button', { name: 'Mégse' }));

    expect(onEditCaption).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});
