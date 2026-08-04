import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applicationDefault, deleteApp as deleteAdminApp, initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore, Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
} from 'firebase/auth';
import { connectFirestoreEmulator, doc, getFirestore, setDoc } from 'firebase/firestore';
import {
  connectStorageEmulator,
  getBytes,
  getStorage,
  ref,
  uploadBytes,
} from 'firebase/storage';
import type { Firestore } from 'firebase/firestore';
import { MAX_VINE_EVENT_PHOTOS, type CreateVineInput, type Vine, type VineEvent } from './model';
import {
  addEventPhotos,
  addEvents,
  createVine,
  deleteEvent,
  deleteEventPhoto,
  editEvent,
  editEventPhotoCaption,
  editVine,
  setCoverPhoto,
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

// A bélyeg bájtjai: a nagy képtől megkülönböztethető tartalom, hogy a
// Storage-ban látszódjon, melyik objektum melyik változat.
const THUMBNAIL_BYTES = [9, 9, 9];

async function withTestImage<T>(operation: () => Promise<T>): Promise<T> {
  const originalImage = globalThis.Image;
  const originalDocument = globalThis.document;
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
  // A 640×480-as tesztkép a nagy kép korlátja alatt van, a bélyegméret fölött:
  // az átméretezés vászna emiatt itt is kell, csak a rajzolás nélkül.
  globalThis.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({ setTransform: () => {}, drawImage: () => {} }),
      toBlob: (callback: (blob: Blob) => void, contentType: string) =>
        callback(new Blob([new Uint8Array(THUMBNAIL_BYTES)], { type: contentType })),
    }),
  } as unknown as Document;

  try {
    return await operation();
  } finally {
    globalThis.Image = originalImage;
    globalThis.document = originalDocument;
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
  const nonAdminClientApp = initializeApp(
    { projectId, apiKey: 'test-api-key', storageBucket: `${projectId}.appspot.com` },
    'vine-integration-non-admin',
  );
  const nonAdminClientDb = getFirestore(nonAdminClientApp);
  const nonAdminClientStorage = getStorage(nonAdminClientApp);
  const nonAdminClientAuth = getAuth(nonAdminClientApp);
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
    connectFirestoreEmulator(nonAdminClientDb, '127.0.0.1', 8088);
    connectStorageEmulator(nonAdminClientStorage, '127.0.0.1', 9199);
    connectAuthEmulator(nonAdminClientAuth, 'http://127.0.0.1:9099', {
      disableWarnings: true,
    });
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
    await createUserWithEmailAndPassword(
      nonAdminClientAuth,
      'vine-user@example.com',
      'User1234!',
    );
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
    await deleteApp(nonAdminClientApp);
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
        // A dokumentum a `coverPhoto` mező előtti alakban van seedelve: a
        // hiányzó mutató automatikus borítót jelent.
        coverPhoto: null,
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

  it('autentikált nem-admin közvetlen Firestore- és Storage-írását elutasítja', async () => {
    await expect(
      setDoc(
        doc(nonAdminClientDb, 'vines', 'vine-forbidden'),
        vineDocument('non-admin', {
          createdAt: '2026-08-03T06:00:00.000Z',
          updatedAt: '2026-08-03T06:00:00.000Z',
        }),
      ),
    ).rejects.toMatchObject({ code: 'permission-denied' });

    await expect(
      uploadBytes(
        ref(
          nonAdminClientStorage,
          'vines/vine-public/events/event-forbidden/photos/photo.png',
        ),
        new Uint8Array([1, 2, 3]),
        { contentType: 'image/png' },
      ),
    ).rejects.toMatchObject({ code: 'storage/unauthorized' });
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

  it('a megnyitott megszűnt tőke dokumentált kivételként naplózható', async () => {
    await addEvents(adminClientDb, adminClientStorage, {
      targetVineIds: ['vine-ceased-target'],
      openedVineId: 'vine-ceased-target',
      event: {
        type: 'observation',
        occurredAt: '2026-08-01T12:30:00.000Z',
        title: 'Utólagos megfigyelés',
        notes: 'A tőke állapota nem változik.',
      },
      photos: [],
    });

    const vines = await waitForVines(
      adminClientDb,
      (nextVines) =>
        nextVines.find((vine) => vine.id === 'vine-ceased-target')?.events.length === 1,
    );
    expect(vines.find((vine) => vine.id === 'vine-ceased-target')).toMatchObject({
      status: 'ceased',
      events: [{ title: 'Utólagos megfigyelés' }],
    });
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

  function testPhoto(name: string, bytes: number[]): File {
    return new File([new Uint8Array(bytes)], name, { type: 'image/png' });
  }

  async function seedVineWithEvent(
    vineId: string,
    serialNumber: number,
    title: string,
    photos: File[] = [],
  ): Promise<{ vine: Vine; event: VineEvent }> {
    await adminDb.collection('vines').doc(vineId).set(
      vineDocument(adminUid, {
        serialNumber,
        variety: 'Utólagos fotó',
        areaDescription: 'Fotóterület',
      }),
    );

    await withTestImage(() =>
      addEvents(adminClientDb, adminClientStorage, {
        targetVineIds: [vineId],
        event: {
          type: 'observation',
          occurredAt: '2026-08-03T09:00:00.000Z',
          title,
          notes: '',
        },
        photos,
      }),
    );

    const vines = await waitForVines(
      adminClientDb,
      (nextVines) => nextVines.find((vine) => vine.id === vineId)?.events.length === 1,
    );
    const vine = vines.find((candidate) => candidate.id === vineId);
    const event = vine?.events[0];
    if (!vine || !event) throw new Error('A tesztesemény nem jött létre.');

    return { vine, event };
  }

  it('meglévő eseményhez egy műveletben több fotót is felvesz ugyanarra az útvonalra', async () => {
    const { vine, event } = await seedVineWithEvent(
      'vine-late-photos',
      40,
      'Utólagos fotózás',
      [testPhoto('elso.png', [1, 1, 1])],
    );

    await withTestImage(() =>
      addEventPhotos(adminClientDb, adminClientStorage, {
        vineId: vine.id,
        eventId: event.id,
        photos: [testPhoto('masodik.png', [2, 2, 2]), testPhoto('harmadik.png', [3, 3, 3])],
      }),
    );

    const vines = await waitForVines(
      adminClientDb,
      (nextVines) =>
        nextVines.find((candidate) => candidate.id === vine.id)?.events[0]?.photos.length === 3,
    );
    const updatedVine = vines.find((candidate) => candidate.id === vine.id);
    const updatedEvent = updatedVine?.events[0];

    expect(updatedEvent?.photos.map((photo) => photo.storagePath)).toEqual([
      expect.stringMatching(
        new RegExp(`^vines/${vine.id}/events/${event.id}/photos/[^/]+\\.png$`),
      ),
      expect.stringMatching(
        new RegExp(`^vines/${vine.id}/events/${event.id}/photos/[^/]+\\.png$`),
      ),
      expect.stringMatching(
        new RegExp(`^vines/${vine.id}/events/${event.id}/photos/[^/]+\\.png$`),
      ),
    ]);
    expect(
      new Uint8Array(
        await getBytes(ref(adminClientStorage, updatedEvent?.photos[2]?.storagePath ?? '')),
      ),
    ).toEqual(new Uint8Array([3, 3, 3]));
    // Az utólagos fotó feliratja üresen keletkezik, a többi metaadat megvan.
    expect(updatedEvent?.photos[1]).toMatchObject({ caption: '', width: 640, height: 480 });
    expect(updatedVine?.updatedAt).not.toBe(vine.updatedAt);
    expect(updatedEvent?.updatedAt).not.toBe(event.updatedAt);
  });

  it('egyetlen fotó törlése az esemény többi fotóját és a másik tőke példányát sem érinti', async () => {
    await Promise.all(
      [
        ['vine-late-delete-one', 41],
        ['vine-late-delete-two', 42],
      ].map(([vineId, serialNumber]) =>
        adminDb
          .collection('vines')
          .doc(vineId as string)
          .set(
            vineDocument(adminUid, {
              serialNumber: serialNumber as number,
              variety: 'Utólagos fotó',
              areaDescription: 'Fotóterület',
            }),
          ),
      ),
    );

    await withTestImage(() =>
      addEvents(adminClientDb, adminClientStorage, {
        targetVineIds: ['vine-late-delete-one', 'vine-late-delete-two'],
        event: {
          type: 'observation',
          occurredAt: '2026-08-03T10:00:00.000Z',
          title: 'Közös fotózás',
          notes: '',
        },
        photos: [testPhoto('kozos.png', [4, 4, 4]), testPhoto('torlendo.png', [5, 5, 5])],
      }),
    );

    const seeded = await waitForVines(
      adminClientDb,
      (nextVines) =>
        nextVines
          .filter((vine) => ['vine-late-delete-one', 'vine-late-delete-two'].includes(vine.id))
          .every((vine) => vine.events[0]?.photos.length === 2),
    );
    const first = seeded.find((vine) => vine.id === 'vine-late-delete-one');
    const second = seeded.find((vine) => vine.id === 'vine-late-delete-two');
    const firstEvent = first?.events[0];
    const keptPhoto = firstEvent?.photos[0];
    const removedPhoto = firstEvent?.photos[1];
    const otherVinePhoto = second?.events[0]?.photos[1];

    await deleteEventPhoto(adminClientDb, adminClientStorage, {
      vineId: 'vine-late-delete-one',
      eventId: firstEvent?.id ?? '',
      photoId: removedPhoto?.id ?? '',
    });

    const afterDelete = await waitForVines(
      adminClientDb,
      (nextVines) =>
        nextVines.find((vine) => vine.id === 'vine-late-delete-one')?.events[0]?.photos.length === 1,
    );
    const remainingPhotos = afterDelete.find((vine) => vine.id === 'vine-late-delete-one')
      ?.events[0]?.photos;

    expect(remainingPhotos?.map((photo) => photo.id)).toEqual([keptPhoto?.id]);
    await expect(
      getBytes(ref(adminClientStorage, removedPhoto?.storagePath ?? '')),
    ).rejects.toMatchObject({ code: 'storage/object-not-found' });
    expect(
      new Uint8Array(await getBytes(ref(adminClientStorage, keptPhoto?.storagePath ?? ''))),
    ).toEqual(new Uint8Array([4, 4, 4]));
    // A másik tőke azonos nevű eseménypéldánya érintetlen marad.
    expect(
      afterDelete.find((vine) => vine.id === 'vine-late-delete-two')?.events[0]?.photos,
    ).toHaveLength(2);
    expect(
      new Uint8Array(await getBytes(ref(adminClientStorage, otherVinePhoto?.storagePath ?? ''))),
    ).toEqual(new Uint8Array([5, 5, 5]));
  });

  it('a képaláírást megőrzi, és az üres feliratot is elfogadja', async () => {
    const { vine, event } = await seedVineWithEvent(
      'vine-late-caption',
      43,
      'Feliratozott fotó',
      [testPhoto('felirat.png', [6, 6, 6])],
    );
    const photoId = event.photos[0]?.id ?? '';

    await editEventPhotoCaption(adminClientDb, {
      vineId: vine.id,
      eventId: event.id,
      photoId,
      caption: '  Két fürt a keleti oldalon  ',
    });

    const captioned = await waitForVines(
      adminClientDb,
      (nextVines) =>
        nextVines.find((candidate) => candidate.id === vine.id)?.events[0]?.photos[0]?.caption ===
        'Két fürt a keleti oldalon',
    );
    expect(captioned.find((candidate) => candidate.id === vine.id)?.updatedAt).not.toBe(
      vine.updatedAt,
    );

    await editEventPhotoCaption(adminClientDb, {
      vineId: vine.id,
      eventId: event.id,
      photoId,
      caption: '   ',
    });

    const cleared = await waitForVines(
      adminClientDb,
      (nextVines) =>
        nextVines.find((candidate) => candidate.id === vine.id)?.events[0]?.photos[0]?.caption ===
        '',
    );
    expect(cleared.find((candidate) => candidate.id === vine.id)?.events[0]?.photos).toHaveLength(1);
  });

  it('sikertelen Firestore-írás után az utólagos feltöltést eltávolítja', async () => {
    const { vine, event } = await seedVineWithEvent(
      'vine-late-compensation',
      44,
      'Kompenzált utólagos fotó',
      [testPhoto('marad.png', [7, 7, 7])],
    );

    const randomUuidDescriptor = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
    Object.defineProperty(crypto, 'randomUUID', {
      configurable: true,
      value: () => 'late-comp-photo',
    });

    try {
      await withTestImage(async () => {
        // A publikus kliens olvasni tud, írni nem: a feltöltés lefut, a
        // tranzakció elhasal, a Storage-objektumnak mégsem szabad megmaradnia.
        await expect(
          addEventPhotos(clientDb, adminClientStorage, {
            vineId: vine.id,
            eventId: event.id,
            photos: [testPhoto('nem-menthet.png', [8, 8, 8])],
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
          `vines/${vine.id}/events/${event.id}/photos/late-comp-photo.png`,
        ),
      ),
    ).rejects.toMatchObject({ code: 'storage/object-not-found' });
    const vines = await waitForVines(
      adminClientDb,
      (nextVines) => nextVines.some((candidate) => candidate.id === vine.id),
    );
    expect(vines.find((candidate) => candidate.id === vine.id)?.events[0]?.photos).toHaveLength(1);
  });

  it('a fotókorlát fölötti felvételt még a fájlok beolvasása előtt elutasítja', async () => {
    const storedPhoto = (index: number) => ({
      id: `limit-photo-${index}`,
      storagePath: `vines/vine-late-limit/events/limit-event/photos/limit-photo-${index}.png`,
      downloadUrl: 'https://example.test/limit.png',
      width: 1,
      height: 1,
      capturedAt: null,
      uploadedAt: '2026-08-03T10:00:00.000Z',
      caption: '',
    });

    await adminDb.collection('vines').doc('vine-late-limit').set(
      vineDocument(adminUid, {
        serialNumber: 45,
        variety: 'Teli esemény',
        areaDescription: 'Fotóterület',
        events: [
          {
            id: 'limit-event',
            type: 'observation',
            occurredAt: '2026-08-03T10:00:00.000Z',
            title: 'Teli fotósor',
            notes: '',
            photos: Array.from({ length: MAX_VINE_EVENT_PHOTOS }, (_, index) =>
              storedPhoto(index + 1),
            ),
            createdAt: AdminTimestamp.now(),
            updatedAt: AdminTimestamp.now(),
          },
        ],
      }),
    );

    const invalidFile = { name: 'must-not-be-read.png' } as File;
    await expect(
      addEventPhotos(adminClientDb, adminClientStorage, {
        vineId: 'vine-late-limit',
        eventId: 'limit-event',
        photos: [invalidFile],
      }),
    ).rejects.toThrow(`${MAX_VINE_EVENT_PHOTOS}`);
  });

  it('borítóképet jelöl ki, majd a kijelölést vissza is vonja', async () => {
    const { vine, event } = await seedVineWithEvent(
      'vine-cover-pin',
      46,
      'Borítóválasztás',
      [testPhoto('elso.png', [7, 7, 7]), testPhoto('masodik.png', [8, 8, 8])],
    );
    const pinnedPhoto = event.photos[0];

    await setCoverPhoto(adminClientDb, {
      vineId: vine.id,
      coverPhoto: { eventId: event.id, photoId: pinnedPhoto?.id ?? '' },
    });

    const pinned = await waitForVines(
      adminClientDb,
      (nextVines) =>
        nextVines.find((candidate) => candidate.id === vine.id)?.coverPhoto !== null,
    );
    const pinnedVine = pinned.find((candidate) => candidate.id === vine.id);
    expect(pinnedVine?.coverPhoto).toEqual({ eventId: event.id, photoId: pinnedPhoto?.id });
    expect(pinnedVine?.updatedAt).not.toBe(vine.updatedAt);
    // A kijelölés a fotók adatait nem írja át.
    expect(pinnedVine?.events[0]?.photos.map((photo) => photo.id)).toEqual(
      event.photos.map((photo) => photo.id),
    );
    expect(pinnedVine?.events[0]?.updatedAt).toBe(event.updatedAt);

    await setCoverPhoto(adminClientDb, { vineId: vine.id, coverPhoto: null });

    const cleared = await waitForVines(
      adminClientDb,
      (nextVines) =>
        nextVines.find((candidate) => candidate.id === vine.id)?.coverPhoto === null,
    );
    expect(cleared.find((candidate) => candidate.id === vine.id)?.coverPhoto).toBeNull();
  });

  it('nem létező eseményre és fotóra nem ír borítómutatót', async () => {
    const { vine, event } = await seedVineWithEvent(
      'vine-cover-missing',
      47,
      'Hibás borító',
      [testPhoto('egyetlen.png', [9, 9, 9])],
    );

    await expect(
      setCoverPhoto(adminClientDb, {
        vineId: vine.id,
        coverPhoto: { eventId: 'nincs-ilyen-esemeny', photoId: event.photos[0]?.id ?? '' },
      }),
    ).rejects.toThrow('Az esemény nem található.');
    await expect(
      setCoverPhoto(adminClientDb, {
        vineId: vine.id,
        coverPhoto: { eventId: event.id, photoId: 'nincs-ilyen-foto' },
      }),
    ).rejects.toThrow('A fotó nem található.');

    const snapshot = await adminDb.collection('vines').doc(vine.id).get();
    expect(snapshot.data()?.coverPhoto ?? null).toBeNull();
  });

  it('a kijelölt borító törlésekor a mutató is eltűnik, a többi fotó törlésekor megmarad', async () => {
    const { vine, event } = await seedVineWithEvent(
      'vine-cover-delete-photo',
      48,
      'Borító törlése',
      [testPhoto('borito.png', [10, 10, 10]), testPhoto('masik.png', [11, 11, 11])],
    );
    const coverPhotoId = event.photos[0]?.id ?? '';
    const otherPhotoId = event.photos[1]?.id ?? '';

    await setCoverPhoto(adminClientDb, {
      vineId: vine.id,
      coverPhoto: { eventId: event.id, photoId: coverPhotoId },
    });
    await waitForVines(
      adminClientDb,
      (nextVines) =>
        nextVines.find((candidate) => candidate.id === vine.id)?.coverPhoto?.photoId ===
        coverPhotoId,
    );

    // A másik fotó törlése nem nyúl a mutatóhoz.
    await deleteEventPhoto(adminClientDb, adminClientStorage, {
      vineId: vine.id,
      eventId: event.id,
      photoId: otherPhotoId,
    });
    const afterOtherDelete = await waitForVines(
      adminClientDb,
      (nextVines) =>
        nextVines.find((candidate) => candidate.id === vine.id)?.events[0]?.photos.length === 1,
    );
    expect(
      afterOtherDelete.find((candidate) => candidate.id === vine.id)?.coverPhoto?.photoId,
    ).toBe(coverPhotoId);

    await deleteEventPhoto(adminClientDb, adminClientStorage, {
      vineId: vine.id,
      eventId: event.id,
      photoId: coverPhotoId,
    });
    const afterCoverDelete = await waitForVines(
      adminClientDb,
      (nextVines) =>
        nextVines.find((candidate) => candidate.id === vine.id)?.events[0]?.photos.length === 0,
    );
    expect(
      afterCoverDelete.find((candidate) => candidate.id === vine.id)?.coverPhoto,
    ).toBeNull();
  });

  it('a kijelölt borítót tartalmazó esemény törlésekor a mutató is eltűnik', async () => {
    const { vine, event } = await seedVineWithEvent(
      'vine-cover-delete-event',
      49,
      'Borító eseménnyel',
      [testPhoto('esemenyfoto.png', [12, 12, 12])],
    );

    await setCoverPhoto(adminClientDb, {
      vineId: vine.id,
      coverPhoto: { eventId: event.id, photoId: event.photos[0]?.id ?? '' },
    });
    await waitForVines(
      adminClientDb,
      (nextVines) =>
        nextVines.find((candidate) => candidate.id === vine.id)?.coverPhoto !== null,
    );

    await deleteEvent(adminClientDb, adminClientStorage, {
      vineId: vine.id,
      eventId: event.id,
    });

    const afterDelete = await waitForVines(
      adminClientDb,
      (nextVines) =>
        nextVines.find((candidate) => candidate.id === vine.id)?.events.length === 0,
    );
    expect(afterDelete.find((candidate) => candidate.id === vine.id)?.coverPhoto).toBeNull();
  });

  it('a fotó mellé bélyeget is feltölt, és a fotó törlésével azt is elviszi', async () => {
    const { vine, event } = await seedVineWithEvent(
      'vine-thumbnail-photo',
      50,
      'Bélyeges fotózás',
      [testPhoto('belyeges.png', [13, 13, 13])],
    );
    const photo = event.photos[0];
    const thumbnailPath = photo?.thumbnail?.storagePath ?? '';

    // A bélyeg a nagy kép mellett, ugyanabban a mappában, `_thumb` utótaggal él.
    expect(thumbnailPath).toBe(photo?.storagePath.replace(/\.png$/, '_thumb.png'));
    // A 640×480-as tesztkép a 320 px-es bélyegméretre, arányosan.
    expect(photo?.thumbnail).toMatchObject({ width: 320, height: 240 });
    expect(
      new Uint8Array(await getBytes(ref(adminClientStorage, thumbnailPath))),
    ).toEqual(new Uint8Array(THUMBNAIL_BYTES));

    await deleteEventPhoto(adminClientDb, adminClientStorage, {
      vineId: vine.id,
      eventId: event.id,
      photoId: photo?.id ?? '',
    });

    await waitForVines(
      adminClientDb,
      (nextVines) =>
        nextVines.find((candidate) => candidate.id === vine.id)?.events[0]?.photos.length === 0,
    );
    await expect(getBytes(ref(adminClientStorage, thumbnailPath))).rejects.toMatchObject({
      code: 'storage/object-not-found',
    });
    await expect(
      getBytes(ref(adminClientStorage, photo?.storagePath ?? '')),
    ).rejects.toMatchObject({ code: 'storage/object-not-found' });
  });

  it('az esemény törlésekor minden hozzá tartozó bélyeg is eltűnik', async () => {
    const { vine, event } = await seedVineWithEvent(
      'vine-thumbnail-event',
      51,
      'Két bélyeges fotó',
      [testPhoto('elso.png', [14, 14, 14]), testPhoto('masodik.png', [15, 15, 15])],
    );
    const thumbnailPaths = event.photos.map((photo) => photo.thumbnail?.storagePath ?? '');

    expect(thumbnailPaths.every((path) => path.endsWith('_thumb.png'))).toBe(true);

    await deleteEvent(adminClientDb, adminClientStorage, {
      vineId: vine.id,
      eventId: event.id,
    });

    await waitForVines(
      adminClientDb,
      (nextVines) => nextVines.find((candidate) => candidate.id === vine.id)?.events.length === 0,
    );
    await Promise.all(
      thumbnailPaths.map((path) =>
        expect(getBytes(ref(adminClientStorage, path))).rejects.toMatchObject({
          code: 'storage/object-not-found',
        }),
      ),
    );
  });

  it('a hiányzó vagy hibás alakú bélyegmezőt bélyeg nélküli fotóként olvassa', async () => {
    const uploadedAt = AdminTimestamp.fromDate(new Date('2026-08-04T08:00:00.000Z'));
    await adminDb.collection('vines').doc('vine-thumbnail-legacy').set(
      vineDocument(adminUid, {
        serialNumber: 52,
        events: [
          {
            id: 'legacy-event',
            type: 'observation',
            occurredAt: uploadedAt,
            title: 'Régi fotók',
            notes: '',
            photos: [
              {
                id: 'legacy-with-thumbnail',
                storagePath: 'vines/vine-thumbnail-legacy/events/legacy-event/photos/a.jpg',
                downloadUrl: 'https://example.test/a.jpg',
                width: 1280,
                height: 960,
                thumbnail: {
                  storagePath:
                    'vines/vine-thumbnail-legacy/events/legacy-event/photos/a_thumb.jpg',
                  downloadUrl: 'https://example.test/a_thumb.jpg',
                  width: 320,
                  height: 240,
                },
                uploadedAt,
                caption: '',
              },
              // A bélyeg előtti rekordban nincs is ilyen mező.
              {
                id: 'legacy-without-thumbnail',
                storagePath: 'vines/vine-thumbnail-legacy/events/legacy-event/photos/b.jpg',
                downloadUrl: 'https://example.test/b.jpg',
                width: 1280,
                height: 960,
                uploadedAt,
                caption: '',
              },
              // Hibás alak: letöltési URL nélkül a bélyeg használhatatlan.
              {
                id: 'legacy-broken-thumbnail',
                storagePath: 'vines/vine-thumbnail-legacy/events/legacy-event/photos/c.jpg',
                downloadUrl: 'https://example.test/c.jpg',
                width: 1280,
                height: 960,
                thumbnail: { width: 320 },
                uploadedAt,
                caption: '',
              },
            ],
            createdAt: uploadedAt,
            updatedAt: uploadedAt,
          },
        ],
      }),
    );

    const vines = await waitForVines(adminClientDb, (nextVines) =>
      nextVines.some((vine) => vine.id === 'vine-thumbnail-legacy'),
    );
    const photos = vines.find((vine) => vine.id === 'vine-thumbnail-legacy')?.events[0]?.photos;

    expect(photos?.map((photo) => photo.thumbnail)).toEqual([
      {
        storagePath: 'vines/vine-thumbnail-legacy/events/legacy-event/photos/a_thumb.jpg',
        downloadUrl: 'https://example.test/a_thumb.jpg',
        width: 320,
        height: 240,
      },
      null,
      null,
    ]);
  });
});
