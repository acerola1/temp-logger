// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_MAX_SELECTED_PHOTOS } from '../../photos/photoSelection';
import type { Vine } from '../model';
import { VineEventForm } from './VineEventForm';

const VINE: Vine = {
  id: 'vine-1',
  serialNumber: 1,
  variety: 'Kékfrankos',
  hasFruited: false,
  rootType: 'own_rooted',
  rootstockVariety: '',
  plantingDate: { precision: 'unknown' },
  areaDescription: 'Déli sor',
  status: 'active',
  tags: [],
  notes: '',
  sourceCuttingId: null,
  events: [],
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
  createdByUid: null,
};

function makeFile(name: string): File {
  return new File(['x'], name, { type: 'image/jpeg' });
}

function renderForm(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  const view = render(
    <VineEventForm
      mode="add"
      defaultValues={{ type: 'observation', occurredAt: '2026-08-01T10:00', title: '', notes: '' }}
      targetVines={[VINE]}
      initialTargetVineId={VINE.id}
      isPending={false}
      uploadProgress={null}
      submitError={null}
      onSubmit={onSubmit}
      onCancel={vi.fn()}
    />,
  );

  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('A rejtett fájlinput nem található.');
  return { onSubmit, fileInput: input, unmount: view.unmount };
}

let createdUrls: string[];
let revokedUrls: string[];

beforeEach(() => {
  createdUrls = [];
  revokedUrls = [];
  URL.createObjectURL = vi.fn(() => {
    const url = `blob:kep-${createdUrls.length + 1}`;
    createdUrls.push(url);
    return url;
  });
  URL.revokeObjectURL = vi.fn((url: string) => {
    revokedUrls.push(url);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('VineEventForm fotókiválasztás', () => {
  it('a kiválasztott képek bélyegként látszanak és a beküldésbe kerülnek', async () => {
    const user = userEvent.setup();
    const { onSubmit, fileInput } = renderForm();

    await user.upload(fileInput, [makeFile('elso.jpg'), makeFile('masodik.jpg')]);

    expect(screen.getAllByRole('img').map((image) => image.getAttribute('alt'))).toEqual([
      'elso.jpg',
      'masodik.jpg',
    ]);
    expect(screen.getByText(`2/${DEFAULT_MAX_SELECTED_PHOTOS} fotó kiválasztva`)).toBeDefined();

    await user.click(screen.getByRole('button', { name: /Esemény mentése/ }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [, targetVineIds, photos] = onSubmit.mock.calls[0] as [unknown, string[], File[]];
    expect(targetVineIds).toEqual([VINE.id]);
    expect(photos.map((photo) => photo.name)).toEqual(['elso.jpg', 'masodik.jpg']);
  });

  it('a további körben választott kép hozzáadódik, nem írja felül a listát', async () => {
    const user = userEvent.setup();
    const { fileInput } = renderForm();

    await user.upload(fileInput, makeFile('elso.jpg'));
    await user.upload(fileInput, makeFile('kamera.jpg'));

    expect(screen.getAllByRole('img').map((image) => image.getAttribute('alt'))).toEqual([
      'elso.jpg',
      'kamera.jpg',
    ]);
  });

  it('az eltávolított kép a beküldésbe sem kerül bele', async () => {
    const user = userEvent.setup();
    const { onSubmit, fileInput } = renderForm();

    await user.upload(fileInput, [makeFile('elso.jpg'), makeFile('masodik.jpg')]);
    await user.click(screen.getByRole('button', { name: 'elso.jpg eltávolítása' }));

    expect(screen.getAllByRole('img')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: /Esemény mentése/ }));

    const [, , photos] = onSubmit.mock.calls[0] as [unknown, string[], File[]];
    expect(photos.map((photo) => photo.name)).toEqual(['masodik.jpg']);
  });

  it('az eltávolítás és a lecsatolás minden objectURL-t felszabadít', async () => {
    const user = userEvent.setup();
    const { fileInput, unmount } = renderForm();

    await user.upload(fileInput, [makeFile('elso.jpg'), makeFile('masodik.jpg')]);
    await user.click(screen.getByRole('button', { name: 'elso.jpg eltávolítása' }));

    expect(revokedUrls).toEqual([createdUrls[0]]);

    unmount();

    expect(revokedUrls.slice().sort()).toEqual(createdUrls.slice().sort());
  });

  it('a limit feletti kijelölést üzenettel elutasítja', async () => {
    const user = userEvent.setup();
    const { fileInput } = renderForm();

    await user.upload(
      fileInput,
      Array.from({ length: DEFAULT_MAX_SELECTED_PHOTOS + 2 }, (_, index) =>
        makeFile(`kep-${index + 1}.jpg`),
      ),
    );

    expect(screen.getAllByRole('img')).toHaveLength(DEFAULT_MAX_SELECTED_PHOTOS);
    expect(
      screen.getByText(
        `Legfeljebb ${DEFAULT_MAX_SELECTED_PHOTOS} fotó választható ki, 2 kép kimaradt.`,
      ),
    ).toBeDefined();
  });
});
