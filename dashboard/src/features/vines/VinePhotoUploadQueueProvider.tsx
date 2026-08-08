import { useEffect, useMemo } from 'react';
import { db, storage } from '../../lib/firebase';
import {
  commitVinePhoto,
  hasVinePhoto,
  subscribeToVines,
} from './firestoreVines';
import {
  deleteVinePhotoObjects,
  prepareVinePhoto,
  uploadPreparedVinePhoto,
} from './vinePhotos';
import {
  InMemoryVinePhotoUploadQueue,
} from './vinePhotoUploadQueue';
import { VinePhotoUploadQueueContext } from './vinePhotoUploadQueueContext';

export function VinePhotoUploadQueueProvider({ children }: { children: React.ReactNode }) {
  const queue = useMemo(
    () => new InMemoryVinePhotoUploadQueue({
      prepare: prepareVinePhoto,
      upload: (vineId, photoId, prepared, onProgress, signal) =>
        uploadPreparedVinePhoto(
          storage,
          vineId,
          photoId,
          prepared,
          onProgress,
          signal,
        ),
      commit: (vineId, photo) => commitVinePhoto(db, vineId, photo),
      hasCommitted: (vineId, photoId) => hasVinePhoto(db, vineId, photoId),
      cleanup: (photo) => deleteVinePhotoObjects(storage, [photo]),
    }),
    [],
  );

  useEffect(
    () => subscribeToVines(
      db,
      (vines) => queue.reconcile(vines),
      (error) => console.error('Vine photo queue reconciliation error:', error),
    ),
    [queue],
  );

  return (
    <VinePhotoUploadQueueContext.Provider value={queue}>
      {children}
    </VinePhotoUploadQueueContext.Provider>
  );
}
