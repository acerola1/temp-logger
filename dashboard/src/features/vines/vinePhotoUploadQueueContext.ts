import { createContext, useContext, useMemo, useSyncExternalStore } from 'react';
import type { VinePhotoUploadJob, VinePhotoUploadQueue } from './vinePhotoUploadQueue';

export const VinePhotoUploadQueueContext = createContext<VinePhotoUploadQueue | null>(null);

export interface VinePhotoUploadQueueState {
  queue: VinePhotoUploadQueue;
  jobs: readonly VinePhotoUploadJob[];
}

export function useVinePhotoUploadQueue(): VinePhotoUploadQueueState {
  const queue = useContext(VinePhotoUploadQueueContext);
  if (!queue) throw new Error('A tőkefotó-feltöltési sor providere hiányzik.');
  const jobs = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot);
  return useMemo(() => ({ queue, jobs }), [jobs, queue]);
}
