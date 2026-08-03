import { describe, expect, it } from 'vitest';
import {
  selectVineEventPhotos,
  toVineEventInput,
  toVineInput,
  getVineEventTargetError,
  vineEventFormSchema,
  vineFormSchema,
  type VineFormValues,
} from './forms';
import { MAX_VINE_EVENT_PHOTOS } from './model';

function validVineForm(overrides: Partial<VineFormValues> = {}): VineFormValues {
  return {
    variety: ' Kékfrankos ',
    hasFruited: false,
    rootType: 'grafted',
    rootstockVariety: ' Teleki 5C ',
    plantingDatePrecision: 'unknown',
    plantingDate: '',
    plantingYear: '',
    areaDescription: ' Ház mögötti sor ',
    status: 'active',
    tags: ' pergola, Öreg tőke, PERGOLA, ',
    notes: ' háttérjegyzet ',
    sourceCuttingId: ' cutting-1 ',
    ...overrides,
  };
}

describe('vineFormSchema', () => {
  it('requires a non-empty trimmed variety and area description', () => {
    expect(vineFormSchema.safeParse(validVineForm({ variety: '   ' })).success).toBe(false);
    expect(vineFormSchema.safeParse(validVineForm({ areaDescription: '\t' })).success).toBe(
      false,
    );
    expect(vineFormSchema.safeParse(validVineForm({ variety: 'Ismeretlen' })).success).toBe(
      true,
    );
  });

  it('validates the selected planting-date precision', () => {
    expect(
      vineFormSchema.safeParse(
        validVineForm({ plantingDatePrecision: 'date', plantingDate: '2025-02-29' }),
      ).success,
    ).toBe(false);
    expect(
      vineFormSchema.safeParse(
        validVineForm({ plantingDatePrecision: 'date', plantingDate: '2024-02-29' }),
      ).success,
    ).toBe(true);
    expect(
      vineFormSchema.safeParse(
        validVineForm({ plantingDatePrecision: 'year', plantingYear: '1998' }),
      ).success,
    ).toBe(true);
    expect(
      vineFormSchema.safeParse(
        validVineForm({ plantingDatePrecision: 'year', plantingYear: '98' }),
      ).success,
    ).toBe(false);
    expect(
      vineFormSchema.safeParse(
        validVineForm({ plantingDatePrecision: 'year', plantingYear: '0000' }),
      ).success,
    ).toBe(false);
  });
});

describe('toVineInput', () => {
  it('normalizes text, tags and the optional cutting reference', () => {
    expect(toVineInput(validVineForm())).toEqual({
      variety: 'Kékfrankos',
      hasFruited: false,
      rootType: 'grafted',
      rootstockVariety: 'Teleki 5C',
      plantingDate: { precision: 'unknown' },
      areaDescription: 'Ház mögötti sor',
      status: 'active',
      tags: ['pergola', 'Öreg tőke'],
      notes: 'háttérjegyzet',
      sourceCuttingId: 'cutting-1',
    });
  });

  it('normalizes the three planting-date variants', () => {
    expect(
      toVineInput(
        validVineForm({ plantingDatePrecision: 'date', plantingDate: '2024-04-06' }),
      ).plantingDate,
    ).toEqual({ precision: 'date', date: '2024-04-06' });
    expect(
      toVineInput(
        validVineForm({ plantingDatePrecision: 'year', plantingYear: ' 1998 ' }),
      ).plantingDate,
    ).toEqual({ precision: 'year', year: 1998 });
    expect(toVineInput(validVineForm()).plantingDate).toEqual({ precision: 'unknown' });
  });

  it('clears the rootstock variety for non-grafted vines', () => {
    expect(
      toVineInput(validVineForm({ rootType: 'own_rooted' })).rootstockVariety,
    ).toBe('');
    expect(toVineInput(validVineForm({ rootType: 'unknown' })).rootstockVariety).toBe('');
  });

  it('normalizes an empty cutting reference to null', () => {
    expect(toVineInput(validVineForm({ sourceCuttingId: '  ' })).sourceCuttingId).toBeNull();
  });
});

describe('vine event forms', () => {
  it('validates the bulk target count before submission', () => {
    expect(getVineEventTargetError(0)).toContain('legalább egy');
    expect(getVineEventTargetError(400)).toBeNull();
    expect(getVineEventTargetError(401)).toContain('400');
  });

  it.each(['2026-01-01', '1', '2026-02-30T10:00', '2026-01-01T24:00'])(
    'rejects an invalid event date-time: %s',
    (occurredAt) => {
      expect(
        vineEventFormSchema.safeParse({
          type: 'observation',
          occurredAt,
          title: '',
          notes: '',
        }).success,
      ).toBe(false);
    },
  );

  it('validates and converts an event time to an ISO timestamp', () => {
    const values = vineEventFormSchema.parse({
      type: 'pruning',
      occurredAt: '2026-02-14T10:30:00+01:00',
      title: ' Téli metszés ',
      notes: ' két csapra metszve ',
    });

    expect(toVineEventInput(values)).toEqual({
      type: 'pruning',
      occurredAt: '2026-02-14T09:30:00.000Z',
      title: 'Téli metszés',
      notes: 'két csapra metszve',
    });
  });

  it.each([
    ['observation', 'Megfigyelés'],
    ['pruning', 'Metszés'],
    ['spraying', 'Permetezés'],
    ['ceased', 'Megszűnés'],
  ] as const)('uses the Hungarian %s label for an empty title', (type, title) => {
    expect(
      toVineEventInput({ type, occurredAt: '2026-01-01T10:00', title: ' ', notes: '' })
        .title,
    ).toBe(title);
  });
});

describe('vine event photo selection', () => {
  const files = (count: number): File[] =>
    Array.from({ length: count }, (_, index) => new File(['x'], `kep-${index + 1}.jpg`));

  it('a korlát alatti kijelölést érintetlenül átengedi', () => {
    const selection = selectVineEventPhotos(MAX_VINE_EVENT_PHOTOS - 2, files(2));

    expect(selection.accepted).toHaveLength(2);
    expect(selection.error).toBeNull();
  });

  it('a maradék helyre vág, és a kimaradt képekről szól', () => {
    const selection = selectVineEventPhotos(MAX_VINE_EVENT_PHOTOS - 1, files(3));

    expect(selection.accepted.map((file) => file.name)).toEqual(['kep-1.jpg']);
    expect(selection.error).toBe(
      'Ehhez az eseményhez már csak 1 fotó vehető fel, 2 kép kimaradt.',
    );
  });

  it('teli eseménynél egyetlen képet sem engedélyez', () => {
    const selection = selectVineEventPhotos(MAX_VINE_EVENT_PHOTOS, files(1));

    expect(selection.accepted).toEqual([]);
    expect(selection.error).toContain(`már ${MAX_VINE_EVENT_PHOTOS} fotó tartozik`);
  });
});
