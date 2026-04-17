import type { z } from 'zod';
import {
  cuttingFormSchema,
  sessionCreateSchema,
  sessionEventSchema,
  wateringLogSchema,
} from '../lib/schemas';

export type CuttingFormValues = z.infer<typeof cuttingFormSchema>;
export type WateringLogValues = z.infer<typeof wateringLogSchema>;
export type SessionEventValues = z.infer<typeof sessionEventSchema>;
export type SessionCreateValues = z.infer<typeof sessionCreateSchema>;
