// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  photos: [],
  coverPhotoId: null,
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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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

  it('sem `add`, sem `edit` módban nem fogad fotófájlt', () => {
    renderAddForm();

    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(screen.queryByText(/fotó választható ki/)).toBeNull();

    cleanup();
    render(
      <VineEventForm
        mode="edit"
        defaultValues={{ type: 'observation', occurredAt: '2026-08-01T10:00', title: '', notes: '' }}
        isPending={false}
        submitError={null}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it('az `edit` mód nem kínál célválasztót', () => {
    render(
      <VineEventForm
        mode="edit"
        defaultValues={{ type: 'observation', occurredAt: '2026-08-01T10:00', title: '', notes: '' }}
        isPending={false}
        submitError={null}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Kiválasztás…' })).toBeNull();
    expect(screen.queryByText(/tőke kiválasztva/)).toBeNull();
  });
});
