// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MAX_VINE_EVENT_TARGETS, type Vine } from '../model';
import { VineTargetPickerDialog } from './VineTargetPickerDialog';

function makeVine(overrides: Partial<Vine> & Pick<Vine, 'id' | 'serialNumber' | 'variety'>): Vine {
  return {
    hasFruited: false,
    rootType: 'own_rooted',
    rootstockVariety: '',
    plantingDate: { precision: 'unknown' },
    areaDescription: '',
    status: 'active',
    tags: [],
    notes: '',
    sourceCuttingId: null,
    photos: [],
    coverPhotoId: null,
    events: [],
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    createdByUid: null,
    ...overrides,
    location: overrides.location === undefined ? 'Telek' : overrides.location,
  };
}

const VINES: readonly Vine[] = [
  makeVine({ id: 'vine-1', serialNumber: 1, variety: 'Kékfrankos', tags: ['déli sor'] }),
  makeVine({ id: 'vine-2', serialNumber: 2, variety: 'Irsai Olivér' }),
  makeVine({ id: 'vine-3', serialNumber: 3, variety: 'Ismeretlen', status: 'ceased' }),
];

function renderDialog(options: { selectedVineIds?: string[]; vines?: readonly Vine[] } = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const view = render(
    <VineTargetPickerDialog
      vines={options.vines ?? VINES}
      tagSuggestions={['déli sor']}
      selectedVineIds={options.selectedVineIds ?? []}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />,
  );

  return { onConfirm, onCancel, unmount: view.unmount };
}

function rowLabels(): string[] {
  return screen
    .getAllByTestId('vine-target-row')
    .map((row) => row.querySelector('input')?.getAttribute('aria-label') ?? '');
}

afterEach(cleanup);

describe('VineTargetPickerDialog', () => {
  it('modális dialógusként nyílik, alapból az aktív tőkékkel', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog', { name: 'Érintett tőkék kiválasztása' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(rowLabels()).toEqual(['#1 - Kékfrankos', '#2 - Irsai Olivér']);
  });

  it('a háttéroldal görgetését a nyitva tartás alatt tiltja, zárás után visszaadja', () => {
    const { unmount } = renderDialog();

    expect(document.body.style.overflow).toBe('hidden');

    unmount();

    expect(document.body.style.overflow).toBe('');
  });

  it('`Esc`-re és az overlayre kattintva is zárul, kijelölés commitálása nélkül', async () => {
    const user = userEvent.setup();
    const escape = renderDialog();

    await user.keyboard('{Escape}');
    expect(escape.onCancel).toHaveBeenCalledTimes(1);
    expect(escape.onConfirm).not.toHaveBeenCalled();

    cleanup();
    const overlay = renderDialog();

    await user.click(screen.getByTestId('dialog-overlay'));
    expect(overlay.onCancel).toHaveBeenCalledTimes(1);
    expect(overlay.onConfirm).not.toHaveBeenCalled();
  });

  it('a `Mind` csak a szűrt tőkéket adja hozzá, a szűrésen kívüli kijelölést megtartja', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog({ selectedVineIds: ['vine-2'] });

    await user.type(screen.getByLabelText('Keresés'), 'Kékfrankos');
    expect(rowLabels()).toEqual(['#1 - Kékfrankos']);

    await user.click(screen.getByRole('button', { name: 'Mind' }));
    expect(screen.getByText('2 kiválasztva')).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Kész' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect([...(onConfirm.mock.calls[0][0] as string[])].sort()).toEqual(['vine-1', 'vine-2']);
  });

  it('a `Törlés` a teljes kijelölést üríti, a szűrőket nem állítja vissza', async () => {
    const user = userEvent.setup();
    renderDialog({ selectedVineIds: ['vine-1', 'vine-2'] });

    await user.selectOptions(screen.getByLabelText('Állapot'), 'ceased');
    await user.click(screen.getByRole('button', { name: 'Törlés' }));

    expect(screen.getByText('0 kiválasztva')).toBeDefined();
    expect((screen.getByLabelText('Állapot') as HTMLSelectElement).value).toBe('ceased');
    expect(rowLabels()).toEqual(['#3 - Ismeretlen']);
  });

  it('a `Mégse` nem commitál, a hívó kijelölése érintetlen marad', async () => {
    const user = userEvent.setup();
    const { onCancel, onConfirm } = renderDialog({ selectedVineIds: ['vine-1'] });

    await user.click(screen.getByRole('checkbox', { name: '#2 - Irsai Olivér' }));
    expect(screen.getByText('2 kiválasztva')).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Mégse' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('a limit feletti kijelölésnél a `Kész` tiltott, és a dialógus üzen', async () => {
    const user = userEvent.setup();
    const manyVines = Array.from({ length: MAX_VINE_EVENT_TARGETS + 1 }, (_, index) =>
      makeVine({ id: `vine-${index + 1}`, serialNumber: index + 1, variety: 'Kékfrankos' }),
    );
    renderDialog({ vines: manyVines });

    await user.click(screen.getByRole('button', { name: 'Mind' }));

    expect(screen.getByText(`${MAX_VINE_EVENT_TARGETS + 1} kiválasztva`)).toBeDefined();
    expect(screen.getByRole('alert').textContent).toBe(
      `Egy esemény legfeljebb ${MAX_VINE_EVENT_TARGETS} tőkére menthető egyszerre.`,
    );
    expect(screen.getByRole('button', { name: 'Kész' }).hasAttribute('disabled')).toBe(true);
  });

  it('a „csak a kiválasztottak" a szűrőktől függetlenül a kijelölést mutatja', async () => {
    const user = userEvent.setup();
    renderDialog({ selectedVineIds: ['vine-3'] });

    // A megszűnt tőke a `Aktív` alapszűrő mellett nem látszik a listában.
    expect(rowLabels()).toEqual(['#1 - Kékfrankos', '#2 - Irsai Olivér']);

    await user.click(screen.getByRole('checkbox', { name: 'Csak a kiválasztottak' }));
    expect(rowLabels()).toEqual(['#3 - Ismeretlen']);

    await user.click(screen.getByRole('checkbox', { name: 'Csak a kiválasztottak' }));
    expect(rowLabels()).toEqual(['#1 - Kékfrankos', '#2 - Irsai Olivér']);
  });

  it('üres találatnál üzenetet mutat, nem üres felületet', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText('Keresés'), 'nincs ilyen fajta');

    expect(screen.queryAllByTestId('vine-target-row')).toHaveLength(0);
    expect(screen.getByRole('status').textContent).toBe('Nincs találat a megadott szűrőkkel.');
  });

  it('megszűnt tőke is választható, ha az állapotszűrő engedi', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog();

    await user.selectOptions(screen.getByLabelText('Állapot'), 'all');
    await user.click(screen.getByRole('checkbox', { name: '#3 - Ismeretlen' }));
    await user.click(screen.getByRole('button', { name: 'Kész' }));

    expect(onConfirm).toHaveBeenCalledWith(['vine-3']);
  });
});
