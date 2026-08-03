import { z } from 'zod';
import {
  VINE_EVENT_TYPES,
  MAX_VINE_EVENT_PHOTOS,
  MAX_VINE_EVENT_TARGETS,
  VINE_ROOT_TYPES,
  VINE_STATUSES,
  type CreateVineInput,
  type VineEventDetailsInput,
  type VineEventType,
  type VinePlantingDate,
} from './model';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME_PATTERN =
  /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-](\d{2}):(\d{2}))?$/;

function isIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isValidDateTime(value: string): boolean {
  const match = ISO_DATE_TIME_PATTERN.exec(value.trim());
  if (!match) return false;

  const [, date, hours, minutes, seconds = '0', offsetHours = '0', offsetMinutes = '0'] =
    match;

  return (
    isIsoDate(date) &&
    Number(hours) <= 23 &&
    Number(minutes) <= 59 &&
    Number(seconds) <= 59 &&
    Number(offsetHours) <= 23 &&
    Number(offsetMinutes) <= 59 &&
    Number.isFinite(new Date(value).getTime())
  );
}

export const vineFormSchema = z
  .object({
    variety: z.string().trim().min(1, 'A fajta megadása kötelező.'),
    hasFruited: z.boolean(),
    rootType: z.enum(VINE_ROOT_TYPES),
    rootstockVariety: z.string(),
    plantingDatePrecision: z.enum(['date', 'year', 'unknown']),
    plantingDate: z.string(),
    plantingYear: z.string(),
    areaDescription: z.string().trim().min(1, 'A területleírás megadása kötelező.'),
    status: z.enum(VINE_STATUSES),
    tags: z.string(),
    notes: z.string(),
    sourceCuttingId: z.string(),
  })
  .superRefine((values, context) => {
    if (values.plantingDatePrecision === 'date' && !isIsoDate(values.plantingDate.trim())) {
      context.addIssue({
        code: 'custom',
        path: ['plantingDate'],
        message: 'Adj meg érvényes telepítési dátumot.',
      });
    }

    if (values.plantingDatePrecision === 'year') {
      const year = Number(values.plantingYear.trim());
      if (
        !/^\d{4}$/.test(values.plantingYear.trim()) ||
        !Number.isInteger(year) ||
        year < 1000
      ) {
        context.addIssue({
          code: 'custom',
          path: ['plantingYear'],
          message: 'A telepítési év négy számjegyű szám legyen.',
        });
      }
    }
  });

export const vineEventFormSchema = z.object({
  type: z.enum(VINE_EVENT_TYPES),
  occurredAt: z.string().refine(isValidDateTime, 'Adj meg érvényes esemény-időpontot.'),
  title: z.string(),
  notes: z.string(),
});

export type VineFormValues = z.infer<typeof vineFormSchema>;
export type VineEventFormValues = z.infer<typeof vineEventFormSchema>;

export const VINE_EVENT_TYPE_LABEL: Record<VineEventType, string> = {
  observation: 'Megfigyelés',
  pruning: 'Metszés',
  spraying: 'Permetezés',
  ceased: 'Megszűnés',
};

export function getVineEventTargetError(targetCount: number): string | null {
  if (targetCount === 0) return 'Válassz legalább egy tőkét.';
  if (targetCount > MAX_VINE_EVENT_TARGETS) {
    return `Egy esemény legfeljebb ${MAX_VINE_EVENT_TARGETS} tőkére menthető egyszerre.`;
  }
  return null;
}

export interface VineEventPhotoSelection {
  /** A maradék helyre vágott, feltölthető képek. */
  accepted: File[];
  /** Felhasználónak szánt üzenet, ha a kijelölés nem fért bele a korlátba. */
  error: string | null;
}

// Az eseményhez utólag felvett fotók a maradék helyre kerülnek. Ha egy kép sem
// fér be, `accepted` üres: a hívó ilyenkor feltöltést sem indít.
export function selectVineEventPhotos(
  currentCount: number,
  files: readonly File[],
): VineEventPhotoSelection {
  const remainingSlots = Math.max(0, MAX_VINE_EVENT_PHOTOS - currentCount);
  const accepted = files.slice(0, remainingSlots);
  const rejectedCount = files.length - accepted.length;

  if (rejectedCount === 0) return { accepted, error: null };

  if (remainingSlots === 0) {
    return {
      accepted: [],
      error: `Ehhez az eseményhez már ${MAX_VINE_EVENT_PHOTOS} fotó tartozik. Előbb törölj egyet.`,
    };
  }

  return {
    accepted,
    error: `Ehhez az eseményhez már csak ${remainingSlots} fotó vehető fel, ${rejectedCount} kép kimaradt.`,
  };
}

function normalizeTags(value: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const candidate of value.split(',')) {
    const tag = candidate.trim();
    const key = tag.toLocaleLowerCase('hu');
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }

  return tags;
}

function toPlantingDate(values: VineFormValues): VinePlantingDate {
  switch (values.plantingDatePrecision) {
    case 'date':
      return { precision: 'date', date: values.plantingDate.trim() };
    case 'year':
      return { precision: 'year', year: Number(values.plantingYear.trim()) };
    default:
      return { precision: 'unknown' };
  }
}

export function toVineInput(values: VineFormValues): CreateVineInput {
  return {
    variety: values.variety.trim(),
    hasFruited: values.hasFruited,
    rootType: values.rootType,
    rootstockVariety:
      values.rootType === 'grafted' ? values.rootstockVariety.trim() : '',
    plantingDate: toPlantingDate(values),
    areaDescription: values.areaDescription.trim(),
    status: values.status,
    tags: normalizeTags(values.tags),
    notes: values.notes.trim(),
    sourceCuttingId: values.sourceCuttingId.trim() || null,
  };
}

export function toVineEventInput(values: VineEventFormValues): VineEventDetailsInput {
  const title = values.title.trim();

  return {
    type: values.type,
    occurredAt: new Date(values.occurredAt).toISOString(),
    title: title || VINE_EVENT_TYPE_LABEL[values.type],
    notes: values.notes.trim(),
  };
}
