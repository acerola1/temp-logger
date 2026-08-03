import type { z } from 'zod';
import {
  cuttingEventFormSchema,
  cuttingFormSchema,
  sessionCreateSchema,
  sessionEventSchema,
} from '../lib/schemas';

export type CuttingFormValues = z.infer<typeof cuttingFormSchema>;
export type CuttingEventFormValues = z.infer<typeof cuttingEventFormSchema>;
export type SessionEventValues = z.infer<typeof sessionEventSchema>;
export type SessionCreateValues = z.infer<typeof sessionCreateSchema>;
