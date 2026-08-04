// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
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
  coverPhoto: null,
  events: [],
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
  createdByUid: null,
};

const OTHER_VINE: Vine = {
  ...VINE,
  id: 'vine-2',
  serialNumber: 2,
  variety: 'Irsai Olivér',
  areaDescription: 'Kerti út',
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

function renderAddForm(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  render(
    <VineEventForm
      mode="add"
      defaultValues={{ type: 'observation', occurredAt: '2026-08-01T10:00', title: '', notes: '' }}
      targetVines={[VINE, OTHER_VINE]}
      tagSuggestions={[]}
      initialTargetVineId={VINE.id}
      isPending={false}
      uploadProgress={null}
      submitError={null}
      onSubmit={onSubmit}
      onCancel={vi.fn()}
    />,
  );
  return { onSubmit };
}

describe('VineEventForm célválasztás', () => {
  it('a nyitott tőke előre ki van jelölve, és a dialógus nélkül is mentődik', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderAddForm();

    expect(screen.getByText('1 tőke kiválasztva')).toBeDefined();
    expect(screen.getByText('#1')).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Esemény mentése (1)' }));

    const [, targetVineIds] = onSubmit.mock.calls[0] as [unknown, string[]];
    expect(targetVineIds).toEqual([VINE.id]);
  });

  it('a dialógusból visszaadott kijelölést küldi be', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderAddForm();

    await user.click(screen.getByRole('button', { name: 'Kiválasztás…' }));
    const dialog = screen.getByRole('dialog', { name: 'Érintett tőkék kiválasztása' });
    // A dialógus a mostani kijelöléssel nyílik.
    expect(screen.getByText('1 kiválasztva')).toBeDefined();

    await user.click(screen.getByRole('checkbox', { name: '#2 - Irsai Olivér' }));
    await user.click(within(dialog).getByRole('button', { name: 'Kész' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('2 tőke kiválasztva')).toBeDefined();
    expect(screen.getByText('#1, #2')).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Esemény mentése (2)' }));

    const [, targetVineIds] = onSubmit.mock.calls[0] as [unknown, string[]];
    expect(targetVineIds).toEqual([VINE.id, OTHER_VINE.id]);
  });

  it('a `Mégse` után az űrlap összefoglalója változatlan', async () => {
    const user = userEvent.setup();
    renderAddForm();

    await user.click(screen.getByRole('button', { name: 'Kiválasztás…' }));
    await user.click(screen.getByRole('checkbox', { name: '#2 - Irsai Olivér' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Mégse' }),
    );

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('1 tőke kiválasztva')).toBeDefined();
  });

  it('az `edit` mód nem kínál célválasztót', () => {
    render(
      <VineEventForm
        mode="edit"
        defaultValues={{ type: 'observation', occurredAt: '2026-08-01T10:00', title: '', notes: '' }}
        isPending={false}
        uploadProgress={null}
        submitError={null}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Kiválasztás…' })).toBeNull();
    expect(screen.queryByText(/tőke kiválasztva/)).toBeNull();
  });
});
