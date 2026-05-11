import { z } from 'zod';

export const cuttingFormSchema = z.object({
  variety: z.string().trim().min(1, 'A fajta megadása kötelező.'),
  plantType: z.enum(['graft', 'cutting']),
  plantedAt: z.string().min(1, 'Az ültetés dátuma kötelező.'),
  status: z.enum(['active', 'lost', 'archived']),
  notes: z.string(),
});

export const cuttingEventFormSchema = z.object({
  occurredAt: z.string().min(1, 'Az esemény időpontja kötelező.'),
  type: z.enum(['watering', 'handover', 'planting_out', 'perished']),
  title: z.string(),
  notes: z.string(),
  archive: z.boolean(),
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
