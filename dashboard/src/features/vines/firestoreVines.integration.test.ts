import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applicationDefault, deleteApp as deleteAdminApp, initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore, Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
} from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectStorageEmulator, getBytes, getStorage, ref } from 'firebase/storage';
import type { Firestore } from 'firebase/firestore';
import type { CreateVineInput, Vine } from './model';
import {
  addEvents,
  createVine,
  deleteEvent,
  editEvent,
  editVine,
  subscribeToVines,
} from './firestoreVines';

const projectId = 'demo-esp32-vines-integration';

function waitForVines(
  firestore: Firestore,
  predicate: (vines: Vine[]) => boolean,
): Promise<Vine[]> {
  return new Promise((resolve, reject) => {
    const unsubscribe = subscribeToVines(
      firestore,
      (vines) => {
        if (!predicate(vines)) return;
        unsubscribe();
        resolve(vines);
      },
      reject,
    );
  });
}

async function withTestImage<T>(operation: () => Promise<T>): Promise<T> {
  const originalImage = globalThis.Image;
  class TestImage {
    naturalWidth = 640;
    naturalHeight = 480;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;

    set src(_value: string) {
      queueMicrotask(() => this.onload?.());
    }
  }
  globalThis.Image = TestImage as unknown as typeof Image;

  try {
    return await operation();
  } finally {
    globalThis.Image = originalImage;
  }
}

function vineDocument(
  createdByUid: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    serialNumber: 1,
    variety: 'Teszt',
    hasFruited: false,
    rootType: 'unknown',
    rootstockVariety: '',
    plantingDate: { precision: 'unknown' },
    areaDescription: 'Tesztterület',
    status: 'active',
    tags: [],
    notes: '',
    sourceCuttingId: null,
    events: [],
    createdAt: AdminTimestamp.now(),
    updatedAt: AdminTimestamp.now(),
    createdByUid,
    ...overrides,
  };
}

describe('Firestore vine catalog', () => {
  const adminApp = initializeAdminApp({ credential: applicationDefault(), projectId });
  const adminDb = getAdminFirestore(adminApp);
  const clientApp = initializeApp({ projectId, apiKey: 'test-api-key' });
  const clientDb = getFirestore(clientApp);
  const adminClientApp = initializeApp(
    { projectId, apiKey: 'test-api-key', storageBucket: `${projectId}.appspot.com` },
    'vine-integration-admin',
  );
  const adminClientDb = getFirestore(adminClientApp);
  const adminClientStorage = getStorage(adminClientApp);
  const adminClientAuth = getAuth(adminClientApp);
  let adminUid: string;

  beforeAll(async () => {
    connectFirestoreEmulator(clientDb, '127.0.0.1', 8088);
    connectFirestoreEmulator(adminClientDb, '127.0.0.1', 8088);
    connectStorageEmulator(adminClientStorage, '127.0.0.1', 9199);
    connectAuthEmulator(adminClientAuth, 'http://127.0.0.1:9099', {
      disableWarnings: true,
    });
    const credential = await createUserWithEmailAndPassword(
      adminClientAuth,
      'vine-admin@example.com',
      'Admin1234!',
    );
    adminUid = credential.user.uid;
    await adminDb.collection('admins').doc(adminUid).set({ role: 'admin' });
    await adminDb.collection('vines').doc('vine-public').set({
      serialNumber: 7,
      variety: '  Pölöskei muskotály  ',
      hasFruited: true,
      rootType: 'grafted',
      rootstockVariety: '5BB',
      plantingDate: { precision: 'year', year: 2021 },
      areaDescription: 'Déli kerítés',
      status: 'active',
      tags: ['csemege'],
      notes: 'Erős növekedés',
      sourceCuttingId: 'missing-cutting',
      events: [
        {
          id: 'event-1',
          type: 'observation',
          occurredAt: '2026-07-15T08:30:00.000Z',
          title: 'Első fürt',
          notes: '',
          photos: [],
          createdAt: AdminTimestamp.fromDate(new Date('2026-07-15T09:00:00.000Z')),
          updatedAt: AdminTimestamp.fromDate(new Date('2026-07-15T09:00:00.000Z')),
        },
      ],
      createdAt: AdminTimestamp.fromDate(new Date('2026-07-01T10:00:00.000Z')),
      updatedAt: AdminTimestamp.fromDate(new Date('2026-07-16T10:00:00.000Z')),
      createdByUid: 'admin-1',
    });
  });

  afterAll(async () => {
    await deleteApp(clientApp);
    await deleteApp(adminClientApp);
    await deleteAdminApp(adminApp);
  });

  it('publikus kliens realtime domain tőkeként olvassa a Firestore dokumentumot', async () => {
    const vines = await waitForVines(clientDb, (nextVines) => nextVines.length > 0);

    expect(vines).toEqual([
      {
        id: 'vine-public',
        serialNumber: 7,
        variety: 'Pölöskei muskotály',
        hasFruited: true,
        rootType: 'grafted',
        rootstockVariety: '5BB',
        plantingDate: { precision: 'year', year: 2021 },
        areaDescription: 'Déli kerítés',
        status: 'active',
        tags: ['csemege'],
        notes: 'Erős növekedés',
        sourceCuttingId: 'missing-cutting',
        events: [
          {
            id: 'event-1',
            type: 'observation',
            occurredAt: '2026-07-15T08:30:00.000Z',
            title: 'Első fürt',
            notes: '',
            photos: [],
            createdAt: '2026-07-15T09:00:00.000Z',
            updatedAt: '2026-07-15T09:00:00.000Z',
          },
        ],
        createdAt: '2026-07-01T10:00:00.000Z',
        updatedAt: '2026-07-16T10:00:00.000Z',
        createdByUid: 'admin-1',
      },
    ]);
  });

  it('admin automatikus következő sorszámmal és szerveridőkkel hoz létre tőkét', async () => {
    const input: CreateVineInput = {
      variety: '  Néró ',
      hasFruited: false,
      rootType: 'unknown',
      rootstockVariety: '',
      plantingDate: { precision: 'unknown' },
      areaDescription: '  Felső sor  ',
      status: 'active',
      tags: ['új'],
      notes: '',
      sourceCuttingId: 'already-deleted-cutting',
    };

    const result = await createVine(adminClientDb, adminUid, 8, input);
    const vines = await waitForVines(adminClientDb, (nextVines) =>
      nextVines.some((vine) => vine.id === result.vineId),
    );
    const created = vines.find((vine) => vine.id === result.vineId);

    expect(result.serialNumber).toBe(8);
    expect(created).toMatchObject({
      serialNumber: 8,
      variety: 'Néró',
      hasFruited: false,
      rootType: 'unknown',
      rootstockVariety: '',
      plantingDate: { precision: 'unknown' },
      areaDescription: 'Felső sor',
      status: 'active',
      tags: ['új'],
      notes: '',
      sourceCuttingId: 'already-deleted-cutting',
      events: [],
      createdByUid: adminUid,
    });
    expect(created?.createdAt).not.toBe(new Date(0).toISOString());
    expect(created?.updatedAt).toBe(created?.createdAt);
  });

  it('a catalog által lefoglalt sorszámot snapshot-frissítés előtt sem osztja ki újra', async () => {
    const input: CreateVineInput = {
      variety: 'Cserszegi fűszeres',
      hasFruited: false,
      rootType: 'unknown',
      rootstockVariety: '',
      plantingDate: { precision: 'unknown' },
      areaDescription: 'Középső sor',
      status: 'active',
      tags: [],
      notes: '',
      sourceCuttingId: null,
    };

    const result = await createVine(
      adminClientDb,
      adminUid,
      9,
      input,
    );

    expect(result.serialNumber).toBe(9);
  });

  it('a teljes szerkesztőinput nem módosítja a sorszámot, létrehozást és eseményeket', async () => {
    await editVine(adminClientDb, 'vine-public', {
      variety: '  Bianca  ',
      hasFruited: false,
      rootType: 'own_rooted',
      rootstockVariety: 'ezt el kell dobni',
      plantingDate: { precision: 'date', date: '2022-04-03' },
      areaDescription: '  Alsó lugas ',
      status: 'ceased',
      tags: ['borszőlő'],
      notes: '  új jegyzet  ',
      sourceCuttingId: null,
    });
    const vines = await waitForVines(
      adminClientDb,
      (nextVines) =>
        nextVines.find((vine) => vine.id === 'vine-public')?.variety === 'Bianca',
    );
    const edited = vines.find((vine) => vine.id === 'vine-public');

    expect(edited).toMatchObject({
      serialNumber: 7,
      variety: 'Bianca',
      hasFruited: false,
      rootType: 'own_rooted',
      rootstockVariety: '',
      plantingDate: { precision: 'date', date: '2022-04-03' },
      areaDescription: 'Alsó lugas',
      status: 'ceased',
      tags: ['borszőlő'],
      notes: 'új jegyzet',
      sourceCuttingId: null,
      createdAt: '2026-07-01T10:00:00.000Z',
      createdByUid: 'admin-1',
      events: [{ id: 'event-1', title: 'Első fürt' }],
    });
    expect(edited?.updatedAt).not.toBe('2026-07-16T10:00:00.000Z');
  });

  it('több tőkéhez külön eseménypéldányt ír és a megszűnési állapotot együtt frissíti', async () => {
    await Promise.all(
      [
        ['vine-event-one', 20],
        ['vine-event-two', 21],
      ].map(([vineId, serialNumber]) =>
        adminDb
          .collection('vines')
          .doc(vineId as string)
          .set(vineDocument(adminUid, { serialNumber })),
      ),
    );

    await addEvents(adminClientDb, adminClientStorage, {
      targetVineIds: ['vine-event-one', 'vine-event-two'],
      event: {
        type: 'ceased',
        occurredAt: '2026-08-01T10:00:00.000Z',
        title: 'Megszűnés',
        notes: 'Kivágva',
      },
      photos: [],
    });

    const vines = await waitForVines(
      adminClientDb,
      (nextVines) =>
        nextVines.filter((vine) =>
          ['vine-event-one', 'vine-event-two'].includes(vine.id),
        ).every((vine) => vine.status === 'ceased' && vine.events.length === 1),
    );
    const first = vines.find((vine) => vine.id === 'vine-event-one');
    const second = vines.find((vine) => vine.id === 'vine-event-two');

    expect(first?.events[0]).toMatchObject({
      type: 'ceased',
      occurredAt: '2026-08-01T10:00:00.000Z',
      title: 'Megszűnés',
      notes: 'Kivágva',
      photos: [],
    });
    expect(first?.events[0]?.id).toBeTruthy();
    expect(first?.events[0]?.id).not.toBe(second?.events[0]?.id);
    expect(first?.updatedAt).not.toBe(first?.createdAt);
  });

  it('egyetlen aktív tőkéhez is hozzáad eseményt', async () => {
    await adminDb
      .collection('vines')
      .doc('vine-single-event')
      .set(vineDocument(adminUid, { serialNumber: 22 }));

    await addEvents(adminClientDb, adminClientStorage, {
      targetVineIds: ['vine-single-event'],
      event: {
        type: 'observation',
        occurredAt: '2026-08-01T11:00:00.000Z',
        title: 'Egyedi megfigyelés',
        notes: 'Egy tőke',
      },
      photos: [],
    });

    const vines = await waitForVines(
      adminClientDb,
      (nextVines) =>
        nextVines.find((vine) => vine.id === 'vine-single-event')?.events.length === 1,
    );
    expect(vines.find((vine) => vine.id === 'vine-single-event')).toMatchObject({
      status: 'active',
      events: [{ type: 'observation', title: 'Egyedi megfigyelés' }],
    });
  });

  it('megszűnt tőkéhez még a fotó-előkészítés előtt sem ad eseményt', async () => {
    await adminDb
      .collection('vines')
      .doc('vine-ceased-target')
      .set(vineDocument(adminUid, { serialNumber: 23, status: 'ceased' }));

    const invalidFile = { name: 'must-not-be-read.png' } as File;
    await expect(
      addEvents(adminClientDb, adminClientStorage, {
        targetVineIds: ['vine-ceased-target'],
        event: {
          type: 'observation',
          occurredAt: '2026-08-01T12:00:00.000Z',
          title: 'Nem engedélyezett',
          notes: '',
        },
        photos: [invalidFile],
      }),
    ).rejects.toThrow('aktív');
  });

  it('az esemény szerkesztése és törlése nem aktiválja újra a tőkét', async () => {
    const vines = await waitForVines(
      adminClientDb,
      (nextVines) => nextVines.some((vine) => vine.id === 'vine-event-one' && vine.events.length === 1),
    );
    const eventId = vines.find((vine) => vine.id === 'vine-event-one')?.events[0]?.id;
    if (!eventId) throw new Error('A tesztesemény nem jött létre.');

    await editEvent(adminClientDb, {
      vineId: 'vine-event-one',
      eventId,
      event: {
        type: 'observation',
        occurredAt: '2026-08-02T10:00:00.000Z',
        title: 'Utólagos megfigyelés',
        notes: 'Az állapot maradjon megszűnt.',
      },
    });

    const editedVines = await waitForVines(
      adminClientDb,
      (nextVines) =>
        nextVines.find((vine) => vine.id === 'vine-event-one')?.events[0]?.title ===
        'Utólagos megfigyelés',
    );
    expect(editedVines.find((vine) => vine.id === 'vine-event-one')).toMatchObject({
      status: 'ceased',
      events: [{ id: eventId, type: 'observation' }],
    });

    await deleteEvent(adminClientDb, adminClientStorage, {
      vineId: 'vine-event-one',
      eventId,
    });

    const deletedVines = await waitForVines(
      adminClientDb,
      (nextVines) => nextVines.find((vine) => vine.id === 'vine-event-one')?.events.length === 0,
    );
    expect(deletedVines.find((vine) => vine.id === 'vine-event-one')).toMatchObject({
      status: 'ceased',
      events: [],
    });
  });

  it('400-nál több célpontot feltöltés előtt elutasít', async () => {
    const invalidFile = { name: 'invalid.png' } as File;

    await expect(
      addEvents(adminClientDb, adminClientStorage, {
        targetVineIds: Array.from({ length: 401 }, (_, index) => `vine-${index}`),
        event: {
          type: 'observation',
          occurredAt: '2026-08-02T10:00:00.000Z',
          title: 'Nem menthető',
          notes: '',
        },
        photos: [invalidFile],
      }),
    ).rejects.toThrow('400');
  });

  it('sikertelen Firestore-írás után eltávolítja az adott művelet feltöltéseit', async () => {
    await adminDb.collection('vines').doc('vine-compensation').set(
      vineDocument(adminUid, {
        serialNumber: 25,
        variety: 'Kompenzációteszt',
        areaDescription: 'Kompenzációterület',
      }),
    );

    const randomUuidDescriptor = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
    Object.defineProperty(crypto, 'randomUUID', {
      configurable: true,
      value: (() => {
        const generatedIds = ['comp-event', 'comp-photo'];
        let index = 0;
        return () => generatedIds[index++ % generatedIds.length];
      })(),
    });

    try {
      await withTestImage(async () => {
        await expect(
          addEvents(clientDb, adminClientStorage, {
            targetVineIds: ['vine-compensation'],
            event: {
              type: 'observation',
              occurredAt: '2026-08-02T11:00:00.000Z',
              title: 'Nem kerülhet mentésre',
              notes: '',
            },
            photos: [new File([new Uint8Array([4, 5, 6])], 'failed.png', { type: 'image/png' })],
          }),
        ).rejects.toBeDefined();
      });
    } finally {
      if (randomUuidDescriptor) {
        Object.defineProperty(crypto, 'randomUUID', randomUuidDescriptor);
      }
    }

    await expect(
      getBytes(
        ref(
          adminClientStorage,
          'vines/vine-compensation/events/comp-event/photos/comp-photo.png',
        ),
      ),
    ).rejects.toMatchObject({ code: 'storage/object-not-found' });
    const vines = await waitForVines(
      adminClientDb,
      (nextVines) => nextVines.some((vine) => vine.id === 'vine-compensation'),
    );
    expect(vines.find((vine) => vine.id === 'vine-compensation')?.events).toEqual([]);
  });

  it('tőkénként önálló fotót tárol, és egy esemény törlése nem törli a másikét', async () => {
    await Promise.all(
      [
        ['vine-photo-one', 30],
        ['vine-photo-two', 31],
      ].map(([vineId, serialNumber]) =>
        adminDb
          .collection('vines')
          .doc(vineId as string)
          .set(
            vineDocument(adminUid, {
              serialNumber,
              variety: 'Fotóteszt',
              areaDescription: 'Fotóterület',
            }),
          ),
      ),
    );

    await withTestImage(async () => {
      await addEvents(adminClientDb, adminClientStorage, {
        targetVineIds: ['vine-photo-one', 'vine-photo-two'],
        event: {
          type: 'observation',
          occurredAt: '2026-08-02T12:00:00.000Z',
          title: 'Fotózott állapot',
          notes: '',
        },
        photos: [new File([new Uint8Array([1, 2, 3])], 'vine.png', { type: 'image/png' })],
      });
    });

    const vinesWithPhotos = await waitForVines(
      adminClientDb,
      (nextVines) =>
        nextVines
          .filter((vine) => ['vine-photo-one', 'vine-photo-two'].includes(vine.id))
          .every((vine) => vine.events[0]?.photos.length === 1),
    );
    const first = vinesWithPhotos.find((vine) => vine.id === 'vine-photo-one');
    const second = vinesWithPhotos.find((vine) => vine.id === 'vine-photo-two');
    const firstEvent = first?.events[0];
    const secondEvent = second?.events[0];
    const firstPhoto = firstEvent?.photos[0];
    const secondPhoto = secondEvent?.photos[0];

    expect(firstPhoto?.storagePath).toMatch(
      /^vines\/vine-photo-one\/events\/[^/]+\/photos\/[^/]+\.png$/,
    );
    expect(secondPhoto?.storagePath).toMatch(
      /^vines\/vine-photo-two\/events\/[^/]+\/photos\/[^/]+\.png$/,
    );
    expect(firstPhoto?.storagePath).not.toBe(secondPhoto?.storagePath);
    expect(new Uint8Array(await getBytes(ref(adminClientStorage, firstPhoto?.storagePath ?? '')))).toEqual(
      new Uint8Array([1, 2, 3]),
    );

    await deleteEvent(adminClientDb, adminClientStorage, {
      vineId: 'vine-photo-one',
      eventId: firstEvent?.id ?? '',
    });

    await waitForVines(
      adminClientDb,
      (nextVines) => nextVines.find((vine) => vine.id === 'vine-photo-one')?.events.length === 0,
    );
    await expect(
      getBytes(ref(adminClientStorage, firstPhoto?.storagePath ?? '')),
    ).rejects.toBeDefined();
    expect(new Uint8Array(await getBytes(ref(adminClientStorage, secondPhoto?.storagePath ?? '')))).toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });
});
