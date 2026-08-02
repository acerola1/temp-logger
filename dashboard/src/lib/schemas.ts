import { z } from 'zod';

export const cuttingFormSchema = z.object({
  variety: z.string().trim().min(1, 'A fajta megadása kötelező.'),
  plantType: z.enum(['graft', 'cutting']),
  plantedAt: z.string().min(1, 'Az ültetés dátuma kötelező.'),
  status: z.enum(['active', 'lost', 'archived']),
  categories: z.string(),
  notes: z.string(),
});

export const cuttingEventFormSchema = z.object({
  occurredAt: z.string().min(1, 'Az esemény időpontja kötelező.'),
  type: z.enum(['watering', 'handover', 'planting_out', 'perished']),
  title: z.string(),
  notes: z.string(),
  archive: z.boolean(),
});

export const vineFormSchema = z
  .object({
    variety: z.string().trim().min(1, 'A fajta megadása kötelező.'),
    hasFruited: z.boolean(),
    rootstockType: z.enum(['grafted', 'own_rooted', 'unknown']),
    rootstockVariety: z.string(),
    plantedAtPrecision: z.enum(['date', 'year', 'unknown']),
    plantedAtDate: z.string(),
    plantedAtYear: z.string(),
    areaDescription: z.string().trim().min(1, 'A területleírás megadása kötelező.'),
    status: z.enum(['active', 'removed']),
    tags: z.string(),
    notes: z.string(),
    sourceCuttingId: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.plantedAtPrecision === 'date' && values.plantedAtDate.trim().length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['plantedAtDate'],
        message: 'Pontos telepítési dátumot adj meg, vagy válts év / ismeretlen pontosságra.',
      });
    }

    if (values.plantedAtPrecision === 'year') {
      const year = Number(values.plantedAtYear.trim());
      if (!Number.isInteger(year) || year < 1900 || year > 2100) {
        ctx.addIssue({
          code: 'custom',
          path: ['plantedAtYear'],
          message: 'A telepítési év négy számjegyű szám legyen (1900-2100).',
        });
      }
    }
  });

export const vineEventFormSchema = z.object({
  occurredAt: z.string().min(1, 'Az esemény időpontja kötelező.'),
  type: z.enum(['observation', 'pruning', 'spraying', 'removal']),
  title: z.string(),
  notes: z.string(),
});

export const sessionEventSchema = z.object({
  title: z.string().trim().min(1, 'A cím megadása kötelező.'),
  description: z.string(),
  occurredAt: z.string().min(1, 'Az időpont megadása kötelező.'),
});

export const sessionCreateSchema = z.object({
  name: z.string().trim().min(1, 'A session neve kötelező.'),
  sessionTypeId: z.string().trim().min(1, 'Válassz session típust.'),
});
