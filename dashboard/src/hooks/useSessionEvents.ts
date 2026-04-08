import { useCallback, useMemo } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  orderBy,
  query,
  type DocumentData,
  type QuerySnapshot,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { SessionEvent } from '../types/sensor';
import { useFirestoreCollection } from './useFirestoreSubscription';

const EMPTY_EVENTS: SessionEvent[] = [];

interface FirestoreSessionEvent {
  title?: string;
  description?: string;
  occurredAt?: string;
  imageUrl?: string | null;
  imageStoragePath?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

interface SessionEventInput {
  title: string;
  description: string;
  occurredAt: string;
  imageUrl?: string | null;
  imageStoragePath?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
}

export function useSessionEvents(deviceId: string | null, sessionId: string | null) {
  const eventsQuery = useMemo(() => {
    if (!deviceId || !sessionId) {
      return null;
    }

    return query(
      collection(db, 'devices', deviceId, 'sessions', sessionId, 'events'),
      orderBy('occurredAt', 'asc'),
    );
  }, [deviceId, sessionId]);

  const mapEvents = useCallback(
    (snapshot: QuerySnapshot<DocumentData>) =>
      snapshot.docs.map((snapshotDoc) => {
        const data = snapshotDoc.data() as FirestoreSessionEvent;
        return {
          id: snapshotDoc.id,
          deviceId: deviceId!,
          sessionId: sessionId!,
          title: data.title ?? 'Névtelen esemény',
          description: data.description ?? '',
          occurredAt: data.occurredAt ?? new Date(0).toISOString(),
          imageUrl: data.imageUrl ?? null,
          imageStoragePath: data.imageStoragePath ?? null,
          imageWidth: typeof data.imageWidth === 'number' ? data.imageWidth : null,
          imageHeight: typeof data.imageHeight === 'number' ? data.imageHeight : null,
          createdAt: data.createdAt ?? new Date(0).toISOString(),
          updatedAt: data.updatedAt ?? data.createdAt ?? new Date(0).toISOString(),
        } satisfies SessionEvent;
      }),
    [deviceId, sessionId],
  );

  const subscription = useFirestoreCollection(eventsQuery, mapEvents, {
    initialData: EMPTY_EVENTS,
    enabled: !!eventsQuery,
    onErrorMessage: 'Nem sikerült betölteni a session eseményeket.',
  });

  const createEvent = useCallback(
    async (input: SessionEventInput) => {
      if (!deviceId || !sessionId) {
        return;
      }

      const now = new Date().toISOString();
      await addDoc(collection(db, 'devices', deviceId, 'sessions', sessionId, 'events'), {
        title: input.title.trim(),
        description: input.description.trim(),
        occurredAt: input.occurredAt,
        imageUrl: input.imageUrl ?? null,
        imageStoragePath: input.imageStoragePath ?? null,
        imageWidth: input.imageWidth ?? null,
        imageHeight: input.imageHeight ?? null,
        createdAt: now,
        updatedAt: now,
      });
    },
    [deviceId, sessionId],
  );

  const updateEvent = useCallback(
    async (eventId: string, input: SessionEventInput) => {
      if (!deviceId || !sessionId) {
        return;
      }

      await updateDoc(doc(db, 'devices', deviceId, 'sessions', sessionId, 'events', eventId), {
        title: input.title.trim(),
        description: input.description.trim(),
        occurredAt: input.occurredAt,
        imageUrl: input.imageUrl ?? null,
        imageStoragePath: input.imageStoragePath ?? null,
        imageWidth: input.imageWidth ?? null,
        imageHeight: input.imageHeight ?? null,
        updatedAt: new Date().toISOString(),
      });
    },
    [deviceId, sessionId],
  );

  const deleteEvent = useCallback(
    async (eventId: string) => {
      if (!deviceId || !sessionId) {
        return;
      }

      await deleteDoc(doc(db, 'devices', deviceId, 'sessions', sessionId, 'events', eventId));
    },
    [deviceId, sessionId],
  );

  return {
    ...subscription,
    createEvent,
    updateEvent,
    deleteEvent,
  };
}
