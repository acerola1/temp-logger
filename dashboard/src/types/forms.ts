import type { z } from 'zod';
import {
  cuttingEventFormSchema,
  cuttingFormSchema,
  sessionCreateSchema,
  sessionEventSchema,
  vineEventFormSchema,
  vineFormSchema,
} from '../lib/schemas';

export type CuttingFormValues = z.infer<typeof cuttingFormSchema>;
export type CuttingEventFormValues = z.infer<typeof cuttingEventFormSchema>;
export type VineFormValues = z.infer<typeof vineFormSchema>;
export type VineEventFormValues = z.infer<typeof vineEventFormSchema>;
export type SessionEventValues = z.infer<typeof sessionEventSchema>;
export type SessionCreateValues = z.infer<typeof sessionCreateSchema>;
