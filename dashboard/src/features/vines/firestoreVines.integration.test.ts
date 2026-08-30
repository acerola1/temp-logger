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
import { MAX_VINE_PHOTOS, type CreateVineInput, type Vine, type VinePhoto } from './model';
import {
  addEvents,
  addVinePhotos,
  commitVinePhoto,
  createVine,
  deleteEvent,
  deleteVine,
  deleteVinePhoto,
  editEvent,
  editVinePhotoCaption,
  editVine,
  hasVinePhoto,
  retryDeletedVinePhotoCleanup,
  setCoverPhoto,
  subscribeToVines,
} from './firestoreVines';
import { InMemoryVinePhotoUploadQueue } from './vinePhotoUploadQueue';
import {
  deleteVinePhotoObjects,
  prepareVinePhoto,
  uploadPreparedVinePhoto,
} from './vinePhotos';

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

async function waitUntil(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('A várt integrációs állapot nem érkezett meg.');
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

/**
 * Kiszámítható fotóazonosító egy művelet idejére, hogy a Storage-útvonal
 * előre ismert legyen. A `randomUUID` a `Crypto` prototípusán él, ezért a
 * visszaállítás a saját tulajdonságot törli: `defineProperty`-vel visszaírni
 * nem lehet, és egy ittmaradt csonk a következő tesztek azonosítóit is
 * beégetné.
 */
async function withFixedPhotoId<T>(photoId: string, operation: () => Promise<T>): Promise<T> {
  const originalDescriptor = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
  Object.defineProperty(crypto, 'randomUUID', {
    configurable: true,
    value: () => photoId,
  });

  try {
    return await operation();
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(crypto, 'randomUUID', originalDescriptor);
    } else {
      delete (crypto as { randomUUID?: unknown }).randomUUID;
    }
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
    location: 'Telek',
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
        location: null,
        areaDescription: 'Déli kerítés',
        status: 'active',
        tags: ['csemege'],
        notes: 'Erős növekedés',
        sourceCuttingId: 'missing-cutting',
        // A dokumentum a fotómezők nélkül van seedelve: a hiányzó `photos` üres
        // galéria, a hiányzó `coverPhotoId` automatikus borító.
        photos: [],
        coverPhotoId: null,
        events: [
          {
            id: 'event-1',
            type: 'observation',
            occurredAt: '2026-07-15T08:30:00.000Z',
            title: 'Első fürt',
            notes: '',
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

    // Az új tőkefotó-útvonal és a migrált rekordok régi, eseményes útvonala
    // egyaránt tiltott nem admin írásra.
    await expect(
      uploadBytes(
        ref(nonAdminClientStorage, 'vines/vine-public/photos/photo.png'),
        new Uint8Array([1, 2, 3]),
        { contentType: 'image/png' },
      ),
    ).rejects.toMatchObject({ code: 'storage/unauthorized' });

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

    await expect(
      deleteVine(nonAdminClientDb, nonAdminClientStorage, 'vine-public'),
    ).rejects.toBeDefined();
    expect((await adminDb.collection('vines').doc('vine-public').get()).exists).toBe(true);
  });

  it('admin automatikus következő sorszámmal és szerveridőkkel hoz létre tőkét', async () => {
    const input: CreateVineInput = {
      variety: '  Néró ',
      hasFruited: false,
      rootType: 'unknown',
      rootstockVariety: '',
      plantingDate: { precision: 'unknown' },
      location: '  Telek  ',
      areaDescription: '  Felső sor  ',
      status: 'active',
      tags: ['új'],
      notes: '',
      sourceCuttingId: 'already-deleted-cutting',
    };

    const result = await createVine(adminClientDb, adminUid, input);
    const vines = await waitForVines(adminClientDb, (nextVines) =>
      nextVines.some((vine) => vine.id === result.vineId),
    );
    const created = vines.find((vine) => vine.id === result.vineId);

    expect(result.serialNumber).toBe(1);
    expect(created).toMatchObject({
      serialNumber: 1,
      variety: 'Néró',
      hasFruited: false,
      rootType: 'unknown',
      rootstockVariety: '',
      plantingDate: { precision: 'unknown' },
      location: 'Telek',
      areaDescription: 'Felső sor',
      status: 'active',
      tags: ['új'],
      notes: '',
      sourceCuttingId: 'already-deleted-cutting',
      photos: [],
      coverPhotoId: null,
      events: [],
      createdByUid: adminUid,
    });
    expect(created?.createdAt).not.toBe(new Date(0).toISOString());
    expect(created?.updatedAt).toBe(created?.createdAt);
  });

  it('párhuzamos létrehozások nem kapnak azonos sorszámot', async () => {
    const input: CreateVineInput = {
      variety: 'Cserszegi fűszeres',
      hasFruited: false,
      rootType: 'unknown',
      rootstockVariety: '',
      plantingDate: { precision: 'unknown' },
      location: 'telek',
      areaDescription: 'Középső sor',
      status: 'active',
      tags: [],
      notes: '',
      sourceCuttingId: null,
    };

    const results = await Promise.all([
      createVine(adminClientDb, adminUid, input),
      createVine(adminClientDb, adminUid, { ...input, variety: 'Párhuzamos Néró' }),
    ]);

    expect(results.map((result) => result.serialNumber).sort((a, b) => a - b)).toEqual([2, 3]);
    const vines = await waitForVines(
      adminClientDb,
      (nextVines) => results.every((result) => nextVines.some((vine) => vine.id === result.vineId)),
    );
    expect(
      results.map((result) => vines.find((vine) => vine.id === result.vineId)?.location),
    ).toEqual(['Telek', 'Telek']);
  });

  it('a végleges törléssel felszabadult legkisebb sorszámot újra kiosztja', async () => {
    await adminDb.collection('vines').doc('vine-serial-reuse').set(
      vineDocument(adminUid, { serialNumber: 4 }),
    );
    await deleteVine(adminClientDb, adminClientStorage, 'vine-serial-reuse');

    const result = await createVine(adminClientDb, adminUid, {
      variety: 'Újrahasznált sorszám',
      hasFruited: false,
      rootType: 'unknown',
      rootstockVariety: '',
      plantingDate: { precision: 'unknown' },
      location: 'Telek',
      areaDescription: 'Tesztterület',
      status: 'active',
      tags: [],
      notes: '',
      sourceCuttingId: null,
    });

    expect(result.serialNumber).toBe(4);
  });

  it('a teljes szerkesztőinput nem módosítja a sorszámot, létrehozást és eseményeket', async () => {
    await editVine(adminClientDb, 'vine-public', {
      variety: '  Bianca  ',
      hasFruited: false,
      rootType: 'own_rooted',
      rootstockVariety: 'ezt el kell dobni',
      plantingDate: { precision: 'date', date: '2022-04-03' },
      location: ' Erkély ',
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
      location: 'Erkély',
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

    await addEvents(adminClientDb, {
      targetVineIds: ['vine-event-one', 'vine-event-two'],
      event: {
        type: 'ceased',
        occurredAt: '2026-08-01T10:00:00.000Z',
        title: 'Megszűnés',
        notes: 'Kivágva',
      },
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

    await addEvents(adminClientDb, {
      targetVineIds: ['vine-single-event'],
      event: {
        type: 'observation',
        occurredAt: '2026-08-01T11:00:00.000Z',
        title: 'Egyedi megfigyelés',
        notes: 'Egy tőke',
      },
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

  it('megszűnt tőkéhez nem ad eseményt', async () => {
    await adminDb
      .collection('vines')
      .doc('vine-ceased-target')
      .set(vineDocument(adminUid, { serialNumber: 23, status: 'ceased' }));

    await expect(
      addEvents(adminClientDb, {
        targetVineIds: ['vine-ceased-target'],
        event: {
          type: 'observation',
          occurredAt: '2026-08-01T12:00:00.000Z',
          title: 'Nem engedélyezett',
          notes: '',
        },
      }),
    ).rejects.toThrow('aktív');
  });

  it('a megnyitott megszűnt tőke dokumentált kivételként naplózható', async () => {
    await addEvents(adminClientDb, {
      targetVineIds: ['vine-ceased-target'],
      openedVineId: 'vine-ceased-target',
      event: {
        type: 'observation',
        occurredAt: '2026-08-01T12:30:00.000Z',
        title: 'Utólagos megfigyelés',
        notes: 'A tőke állapota nem változik.',
      },
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

    await deleteEvent(adminClientDb, {
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
  it('400-nál több célpontot a Firestore-olvasás előtt elutasít', async () => {
    await expect(
      addEvents(adminClientDb, {
        targetVineIds: Array.from({ length: 401 }, (_, index) => `vine-${index}`),
        event: {
          type: 'observation',
          occurredAt: '2026-08-02T10:00:00.000Z',
          title: 'Nem menthető',
          notes: '',
        },
      }),
    ).rejects.toThrow('400');
  });

  it('sikertelen eseménymentés nem hagy nyomot a tőkén', async () => {
    await adminDb.collection('vines').doc('vine-event-failure').set(
      vineDocument(adminUid, {
        serialNumber: 25,
        variety: 'Hibás mentés',
        areaDescription: 'Kompenzációterület',
      }),
    );

    // A publikus kliens olvasni tud, írni nem: a tranzakció elhasal.
    await expect(
      addEvents(clientDb, {
        targetVineIds: ['vine-event-failure'],
        event: {
          type: 'observation',
          occurredAt: '2026-08-02T11:00:00.000Z',
          title: 'Nem kerülhet mentésre',
          notes: '',
        },
      }),
    ).rejects.toBeDefined();

    const vines = await waitForVines(
      adminClientDb,
      (nextVines) => nextVines.some((vine) => vine.id === 'vine-event-failure'),
    );
    expect(vines.find((vine) => vine.id === 'vine-event-failure')?.events).toEqual([]);
  });

  function testPhoto(name: string, bytes: number[]): File {
    return new File([new Uint8Array(bytes)], name, { type: 'image/png' });
  }

  /** Fotó nélküli tőke; a fotókat a catalog parancsai teszik bele. */
  async function seedVine(
    vineId: string,
    serialNumber: number,
    overrides: Record<string, unknown> = {},
  ): Promise<Vine> {
    await adminDb.collection('vines').doc(vineId).set(
      vineDocument(adminUid, {
        serialNumber,
        variety: 'Tőkefotó',
        areaDescription: 'Fotóterület',
        photos: [],
        coverPhotoId: null,
        ...overrides,
      }),
    );

    const vines = await waitForVines(
      adminClientDb,
      (nextVines) => nextVines.some((candidate) => candidate.id === vineId),
    );
    const vine = vines.find((candidate) => candidate.id === vineId);
    if (!vine) throw new Error('A teszttőke nem jött létre.');
    return vine;
  }

  async function seedVineWithPhotos(
    vineId: string,
    serialNumber: number,
    photos: File[],
  ): Promise<Vine> {
    const vine = await seedVine(vineId, serialNumber);
    if (photos.length > 0) {
      await withTestImage(() =>
        addVinePhotos(adminClientDb, adminClientStorage, { vineId, photos }),
      );
    }

    const vines = await waitForVines(
      adminClientDb,
      (nextVines) =>
        nextVines.find((candidate) => candidate.id === vineId)?.photos.length === photos.length,
    );
    const withPhotos = vines.find((candidate) => candidate.id === vineId);
    if (!withPhotos) throw new Error('A teszttőke eltűnt.');
    // A `updatedAt` valódi fotófeltöltéssel frissült, ezért a hívó a friss
    // tőkét kapja. Az üres lista csak kényelmi seed, ott nincs írás.
    if (photos.length > 0) expect(withPhotos.updatedAt).not.toBe(vine.updatedAt);
    return withPhotos;
  }

  it('a tőkét minden új és migrált fotóobjektummal törli, másik tőkét nem érint', async () => {
    const vineId = 'vine-delete-complete';
    const currentPath = `vines/${vineId}/photos/current.png`;
    const currentThumbPath = `vines/${vineId}/photos/current_thumb.png`;
    const legacyPath = `vines/${vineId}/events/old-event/photos/legacy.png`;
    const legacyThumbPath = `vines/${vineId}/events/old-event/photos/legacy_thumb.png`;
    const otherPath = 'vines/vine-delete-other/photos/keep.png';
    const paths = [currentPath, currentThumbPath, legacyPath, legacyThumbPath, otherPath];
    await Promise.all(
      paths.map((storagePath, index) =>
        uploadBytes(ref(adminClientStorage, storagePath), new Uint8Array([index + 1])),
      ),
    );
    const photo = (id: string, storagePath: string, thumbnailPath: string): VinePhoto => ({
      id,
      storagePath,
      downloadUrl: `https://example.test/${id}`,
      width: 10,
      height: 10,
      thumbnail: {
        storagePath: thumbnailPath,
        downloadUrl: `https://example.test/${id}-thumb`,
        width: 5,
        height: 5,
      },
      capturedAt: null,
      uploadedAt: '2026-08-30T10:00:00.000Z',
      caption: '',
    });
    await adminDb.collection('vines').doc(vineId).set(vineDocument(adminUid, {
      serialNumber: 41,
      notes: 'Törlendő jegyzet',
      events: [{ id: 'event-delete', title: 'Törlendő esemény' }],
      photos: [
        photo('current', currentPath, currentThumbPath),
        photo('legacy', legacyPath, legacyThumbPath),
      ],
    }));
    await adminDb.collection('vines').doc('vine-delete-other').set(
      vineDocument(adminUid, { serialNumber: 42 }),
    );

    const realtimeRemoval = waitForVines(
      adminClientDb,
      (vines) => !vines.some((vine) => vine.id === vineId),
    );
    await expect(deleteVine(adminClientDb, adminClientStorage, vineId)).resolves.toEqual({
      remainingStoragePaths: [],
    });
    await realtimeRemoval;

    expect((await adminDb.collection('vines').doc(vineId).get()).exists).toBe(false);
    expect((await adminDb.collection('vines').doc('vine-delete-other').get()).exists).toBe(true);
    for (const storagePath of paths.slice(0, 4)) {
      await expect(getBytes(ref(adminClientStorage, storagePath))).rejects.toMatchObject({
        code: 'storage/object-not-found',
      });
    }
    expect(new Uint8Array(await getBytes(ref(adminClientStorage, otherPath)))).toEqual(
      new Uint8Array([5]),
    );
  });

  it('Storage-részhiba után a dokumentum törölt marad, a takarítás idempotensen újrapróbálható', async () => {
    const vineId = 'vine-delete-retry';
    const existingPath = `vines/${vineId}/photos/retry.png`;
    const alreadyMissingPath = `vines/${vineId}/photos/missing.png`;
    await uploadBytes(ref(adminClientStorage, existingPath), new Uint8Array([7]));
    await adminDb.collection('vines').doc(vineId).set(vineDocument(adminUid, {
      serialNumber: 43,
      photos: [
        {
          id: 'retry-photo',
          storagePath: existingPath,
          downloadUrl: 'https://example.test/retry',
          width: 1,
          height: 1,
          thumbnail: {
            storagePath: alreadyMissingPath,
            downloadUrl: 'https://example.test/missing',
            width: 1,
            height: 1,
          },
          capturedAt: null,
          uploadedAt: '2026-08-30T10:00:00.000Z',
          caption: '',
        },
      ],
    }));

    const partial = await deleteVine(adminClientDb, nonAdminClientStorage, vineId);
    expect(partial.remainingStoragePaths).toEqual([existingPath, alreadyMissingPath]);
    expect((await adminDb.collection('vines').doc(vineId).get()).exists).toBe(false);
    expect(await getBytes(ref(adminClientStorage, existingPath))).toBeDefined();

    await expect(
      retryDeletedVinePhotoCleanup(adminClientStorage, partial.remainingStoragePaths),
    ).resolves.toEqual({ remainingStoragePaths: [] });
    await expect(
      retryDeletedVinePhotoCleanup(adminClientStorage, partial.remainingStoragePaths),
    ).resolves.toEqual({ remainingStoragePaths: [] });
  });

  it('egy műveletben több tőkefotót vesz fel az új, eseménymentes útvonalra', async () => {
    const vine = await seedVineWithPhotos('vine-photos-add', 30, [
      testPhoto('elso.png', [1, 1, 1]),
      testPhoto('masodik.png', [2, 2, 2]),
    ]);

    expect(vine.photos.map((photo) => photo.storagePath)).toEqual([
      expect.stringMatching(new RegExp(`^vines/${vine.id}/photos/[^/]+\\.png$`)),
      expect.stringMatching(new RegExp(`^vines/${vine.id}/photos/[^/]+\\.png$`)),
    ]);
    // A feltöltés üres felirattal keletkezik, a többi metaadat megvan.
    expect(vine.photos[0]).toMatchObject({ caption: '', width: 640, height: 480 });
    expect(
      new Uint8Array(await getBytes(ref(adminClientStorage, vine.photos[1]?.storagePath ?? ''))),
    ).toEqual(new Uint8Array([2, 2, 2]));

    // Az új útvonal publikusan olvasható: a galéria bejelentkezés nélkül is
    // megjeleníti a képet.
    expect(
      new Uint8Array(await getBytes(ref(nonAdminClientStorage, vine.photos[1]?.storagePath ?? ''))),
    ).toEqual(new Uint8Array([2, 2, 2]));

    // A bélyeg a nagy kép mellett, ugyanabban a mappában, `_thumb` utótaggal él.
    const thumbnailPath = vine.photos[0]?.thumbnail?.storagePath ?? '';
    expect(thumbnailPath).toBe(vine.photos[0]?.storagePath.replace(/\.png$/, '_thumb.png'));
    // A 640×480-as tesztkép a 120 px-es bélyegméretre, arányosan.
    expect(vine.photos[0]?.thumbnail).toMatchObject({ width: 120, height: 90 });
    expect(new Uint8Array(await getBytes(ref(adminClientStorage, thumbnailPath)))).toEqual(
      new Uint8Array(THUMBNAIL_BYTES),
    );
  });

  it('a stabil photoId-val commitolt egyetlen fotó idempotens', async () => {
    const vineId = 'vine-photo-idempotent';
    await seedVine(vineId, 39);
    const photo: VinePhoto = {
      id: 'stable-photo-id',
      storagePath: `vines/${vineId}/photos/stable-photo-id.jpg`,
      downloadUrl: 'https://example.test/stable-photo-id.jpg',
      width: 640,
      height: 480,
      thumbnail: null,
      capturedAt: null,
      uploadedAt: '2026-08-08T10:00:00.000Z',
      caption: '',
    };

    await Promise.all([
      commitVinePhoto(adminClientDb, vineId, photo),
      editVine(adminClientDb, vineId, {
        variety: 'Párhuzamosan szerkesztett tőke',
        hasFruited: true,
        rootType: 'own_rooted',
        rootstockVariety: '',
        plantingDate: { precision: 'unknown' },
        location: 'Telek',
        areaDescription: 'E2E sor',
        status: 'active',
        tags: [],
        notes: '',
        sourceCuttingId: null,
      }),
    ]);
    const committed = await waitForVines(
      adminClientDb,
      (vines) => vines.find((vine) => vine.id === vineId)?.photos.length === 1,
    );
    const updatedAt = committed.find((vine) => vine.id === vineId)?.updatedAt;
    expect(committed.find((vine) => vine.id === vineId)?.variety).toBe(
      'Párhuzamosan szerkesztett tőke',
    );
    expect(await hasVinePhoto(adminClientDb, vineId, photo.id)).toBe(true);

    await commitVinePhoto(adminClientDb, vineId, photo);
    const snapshot = await adminDb.collection('vines').doc(vineId).get();
    expect(snapshot.data()?.photos).toHaveLength(1);
    expect(snapshot.data()?.updatedAt.toDate().toISOString()).toBe(updatedAt);
  });

  it('egyetlen fotó törlése a többi fotót és a másik tőke fotóit sem érinti', async () => {
    const first = await seedVineWithPhotos('vine-photos-delete-one', 31, [
      testPhoto('marad.png', [4, 4, 4]),
      testPhoto('torlendo.png', [5, 5, 5]),
    ]);
    const second = await seedVineWithPhotos('vine-photos-delete-two', 32, [
      testPhoto('masik-toke.png', [6, 6, 6]),
    ]);
    const keptPhoto = first.photos[0];
    const removedPhoto = first.photos[1];
    const otherVinePhoto = second.photos[0];

    await deleteVinePhoto(adminClientDb, adminClientStorage, {
      vineId: first.id,
      photoId: removedPhoto?.id ?? '',
    });

    const afterDelete = await waitForVines(
      adminClientDb,
      (nextVines) => nextVines.find((vine) => vine.id === first.id)?.photos.length === 1,
    );
    expect(
      afterDelete.find((vine) => vine.id === first.id)?.photos.map((photo) => photo.id),
    ).toEqual([keptPhoto?.id]);
    // A törölt kép nagy változata és bélyege is elment.
    await expect(
      getBytes(ref(adminClientStorage, removedPhoto?.storagePath ?? '')),
    ).rejects.toMatchObject({ code: 'storage/object-not-found' });
    await expect(
      getBytes(ref(adminClientStorage, removedPhoto?.thumbnail?.storagePath ?? '')),
    ).rejects.toMatchObject({ code: 'storage/object-not-found' });
    expect(
      new Uint8Array(await getBytes(ref(adminClientStorage, keptPhoto?.storagePath ?? ''))),
    ).toEqual(new Uint8Array([4, 4, 4]));
    expect(
      afterDelete.find((vine) => vine.id === second.id)?.photos.map((photo) => photo.id),
    ).toEqual([otherVinePhoto?.id]);
    expect(
      new Uint8Array(await getBytes(ref(adminClientStorage, otherVinePhoto?.storagePath ?? ''))),
    ).toEqual(new Uint8Array([6, 6, 6]));
  });

  it('a képaláírást megőrzi, és az üres feliratot is elfogadja', async () => {
    const vine = await seedVineWithPhotos('vine-photos-caption', 33, [
      testPhoto('felirat.png', [7, 7, 7]),
    ]);
    const photoId = vine.photos[0]?.id ?? '';

    await editVinePhotoCaption(adminClientDb, {
      vineId: vine.id,
      photoId,
      caption: '  Két fürt a keleti oldalon  ',
    });

    const captioned = await waitForVines(
      adminClientDb,
      (nextVines) =>
        nextVines.find((candidate) => candidate.id === vine.id)?.photos[0]?.caption ===
        'Két fürt a keleti oldalon',
    );
    expect(captioned.find((candidate) => candidate.id === vine.id)?.updatedAt).not.toBe(
      vine.updatedAt,
    );

    await editVinePhotoCaption(adminClientDb, { vineId: vine.id, photoId, caption: '   ' });

    const cleared = await waitForVines(
      adminClientDb,
      (nextVines) =>
        nextVines.find((candidate) => candidate.id === vine.id)?.photos[0]?.caption === '',
    );
    expect(cleared.find((candidate) => candidate.id === vine.id)?.photos).toHaveLength(1);
  });

  it('sikertelen Firestore-írás után eltávolítja a feltöltött objektumokat', async () => {
    const vine = await seedVineWithPhotos('vine-photos-compensation', 34, [
      testPhoto('marad.png', [8, 8, 8]),
    ]);

    await withFixedPhotoId('compensated-photo', () =>
      withTestImage(async () => {
        // A publikus kliens olvasni tud, írni nem: a feltöltés lefut, a
        // tranzakció elhasal, a Storage-objektumnak mégsem szabad megmaradnia.
        await expect(
          addVinePhotos(clientDb, adminClientStorage, {
            vineId: vine.id,
            photos: [testPhoto('nem-menthet.png', [9, 9, 9])],
          }),
        ).rejects.toBeDefined();
      }),
    );

    await expect(
      getBytes(ref(adminClientStorage, `vines/${vine.id}/photos/compensated-photo.png`)),
    ).rejects.toMatchObject({ code: 'storage/object-not-found' });
    await expect(
      getBytes(ref(adminClientStorage, `vines/${vine.id}/photos/compensated-photo_thumb.png`)),
    ).rejects.toMatchObject({ code: 'storage/object-not-found' });
    const vines = await waitForVines(
      adminClientDb,
      (nextVines) => nextVines.some((candidate) => candidate.id === vine.id),
    );
    expect(vines.find((candidate) => candidate.id === vine.id)?.photos).toHaveLength(1);
  });

  it('a háttérsor sikertelen commit után eltávolítja a feltöltött objektumokat', async () => {
    const vine = await seedVineWithPhotos('vine-queue-compensation', 36, []);
    const ids = ['queue-job', 'queue-compensated-photo'];
    const queue = new InMemoryVinePhotoUploadQueue({
      prepare: prepareVinePhoto,
      upload: (vineId, photoId, prepared, onProgress, signal) =>
        uploadPreparedVinePhoto(
          adminClientStorage,
          vineId,
          photoId,
          prepared,
          onProgress,
          signal,
        ),
      // A publikus kliens nem írhat: ezzel a queue kompenzációs ága fut le.
      commit: (vineId, photo) => commitVinePhoto(clientDb, vineId, photo),
      hasCommitted: (vineId, photoId) => hasVinePhoto(adminClientDb, vineId, photoId),
      cleanup: (photo) => deleteVinePhotoObjects(adminClientStorage, [photo]),
      createId: () => ids.shift() ?? crypto.randomUUID(),
    });

    await withTestImage(async () => {
      queue.enqueue(vine.id, [testPhoto('queue-nem-menthet.png', [7, 8, 9])]);
      await waitUntil(() => queue.getSnapshot()[0]?.status === 'failed');
    });

    expect(queue.getSnapshot()[0]).toMatchObject({
      photoId: 'queue-compensated-photo',
      status: 'failed',
    });
    await expect(
      getBytes(ref(adminClientStorage, `vines/${vine.id}/photos/queue-compensated-photo.png`)),
    ).rejects.toMatchObject({ code: 'storage/object-not-found' });
    await expect(
      getBytes(ref(adminClientStorage, `vines/${vine.id}/photos/queue-compensated-photo_thumb.png`)),
    ).rejects.toMatchObject({ code: 'storage/object-not-found' });
  });

  it('a tőkénkénti fotókorlát fölötti felvételt a fájlok beolvasása előtt elutasítja', async () => {
    const storedPhoto = (index: number) => ({
      id: `limit-photo-${index}`,
      storagePath: `vines/vine-photos-limit/photos/limit-photo-${index}.png`,
      downloadUrl: 'https://example.test/limit.png',
      width: 1,
      height: 1,
      capturedAt: null,
      uploadedAt: '2026-08-03T10:00:00.000Z',
      caption: '',
    });

    await seedVine('vine-photos-limit', 35, {
      variety: 'Teli tőke',
      photos: Array.from({ length: MAX_VINE_PHOTOS }, (_, index) => storedPhoto(index + 1)),
    });

    const invalidFile = { name: 'must-not-be-read.png' } as File;
    await expect(
      addVinePhotos(adminClientDb, adminClientStorage, {
        vineId: 'vine-photos-limit',
        photos: [invalidFile],
      }),
    ).rejects.toThrow(`${MAX_VINE_PHOTOS}`);
  });

  it('borítóképet jelöl ki, majd a kijelölést vissza is vonja', async () => {
    const vine = await seedVineWithPhotos('vine-cover-pin', 36, [
      testPhoto('elso.png', [10, 10, 10]),
      testPhoto('masodik.png', [11, 11, 11]),
    ]);
    const pinnedPhotoId = vine.photos[0]?.id ?? '';

    await setCoverPhoto(adminClientDb, { vineId: vine.id, photoId: pinnedPhotoId });

    const pinned = await waitForVines(
      adminClientDb,
      (nextVines) =>
        nextVines.find((candidate) => candidate.id === vine.id)?.coverPhotoId !== null,
    );
    const pinnedVine = pinned.find((candidate) => candidate.id === vine.id);
    expect(pinnedVine?.coverPhotoId).toBe(pinnedPhotoId);
    expect(pinnedVine?.updatedAt).not.toBe(vine.updatedAt);
    // A kijelölés a fotók adatait nem írja át.
    expect(pinnedVine?.photos).toEqual(vine.photos);

    // Új fotó nem veszi át a kézzel kijelölt borítót.
    await withTestImage(() =>
      addVinePhotos(adminClientDb, adminClientStorage, {
        vineId: vine.id,
        photos: [testPhoto('harmadik.png', [12, 12, 12])],
      }),
    );
    const afterUpload = await waitForVines(
      adminClientDb,
      (nextVines) => nextVines.find((candidate) => candidate.id === vine.id)?.photos.length === 3,
    );
    expect(afterUpload.find((candidate) => candidate.id === vine.id)?.coverPhotoId).toBe(
      pinnedPhotoId,
    );

    await setCoverPhoto(adminClientDb, { vineId: vine.id, photoId: null });

    const cleared = await waitForVines(
      adminClientDb,
      (nextVines) =>
        nextVines.find((candidate) => candidate.id === vine.id)?.coverPhotoId === null,
    );
    expect(cleared.find((candidate) => candidate.id === vine.id)?.coverPhotoId).toBeNull();
  });

  it('nem létező fotóra nem ír borítómutatót', async () => {
    const vine = await seedVineWithPhotos('vine-cover-missing', 37, [
      testPhoto('egyetlen.png', [13, 13, 13]),
    ]);

    await expect(
      setCoverPhoto(adminClientDb, { vineId: vine.id, photoId: 'nincs-ilyen-foto' }),
    ).rejects.toThrow('A fotó nem található.');

    const snapshot = await adminDb.collection('vines').doc(vine.id).get();
    expect(snapshot.data()?.coverPhotoId ?? null).toBeNull();
  });

  it('a kijelölt borító törlésekor a mutató is eltűnik, a többi fotó törlésekor megmarad', async () => {
    const vine = await seedVineWithPhotos('vine-cover-delete-photo', 38, [
      testPhoto('borito.png', [14, 14, 14]),
      testPhoto('masik.png', [15, 15, 15]),
    ]);
    const coverPhotoId = vine.photos[0]?.id ?? '';
    const otherPhotoId = vine.photos[1]?.id ?? '';

    await setCoverPhoto(adminClientDb, { vineId: vine.id, photoId: coverPhotoId });
    await waitForVines(
      adminClientDb,
      (nextVines) =>
        nextVines.find((candidate) => candidate.id === vine.id)?.coverPhotoId === coverPhotoId,
    );

    // A másik fotó törlése nem nyúl a mutatóhoz.
    await deleteVinePhoto(adminClientDb, adminClientStorage, {
      vineId: vine.id,
      photoId: otherPhotoId,
    });
    const afterOtherDelete = await waitForVines(
      adminClientDb,
      (nextVines) => nextVines.find((candidate) => candidate.id === vine.id)?.photos.length === 1,
    );
    expect(afterOtherDelete.find((candidate) => candidate.id === vine.id)?.coverPhotoId).toBe(
      coverPhotoId,
    );

    await deleteVinePhoto(adminClientDb, adminClientStorage, {
      vineId: vine.id,
      photoId: coverPhotoId,
    });
    const afterCoverDelete = await waitForVines(
      adminClientDb,
      (nextVines) => nextVines.find((candidate) => candidate.id === vine.id)?.photos.length === 0,
    );
    expect(afterCoverDelete.find((candidate) => candidate.id === vine.id)?.coverPhotoId).toBeNull();
  });

  it('nem létező borítóazonosítót hiba nélkül, automatikus borítóként olvas', async () => {
    // Ilyen mutatót a felület nem tud létrehozni, egy kézi vagy migrációs
    // beavatkozás után viszont előfordulhat: az olvasás nem hibázhat, és nem is
    // indíthat javító írást.
    const vine = await seedVine('vine-cover-stale', 39, {
      photos: [
        {
          id: 'megvan',
          storagePath: 'vines/vine-cover-stale/photos/megvan.png',
          downloadUrl: 'https://example.test/megvan.png',
          width: 1280,
          height: 960,
          capturedAt: null,
          uploadedAt: '2026-08-04T08:00:00.000Z',
          caption: '',
        },
      ],
      coverPhotoId: 'mar-torolt',
    });

    expect(vine.coverPhotoId).toBe('mar-torolt');
    expect(vine.photos).toHaveLength(1);
    const snapshot = await adminDb.collection('vines').doc(vine.id).get();
    expect(snapshot.data()?.coverPhotoId).toBe('mar-torolt');
  });

  it('a fotóművelet nem módosít eseményt, az eseményművelet pedig fotót', async () => {
    // A seedelt rekordok szándékosan tartalmaznak olyan mezőt, amit a mapper nem
    // ismer. Ha a fotóművelet payloadja tartalmazná az `events` mezőt (vagy az
    // eseményművelet a `photos`-t), a visszaírt, normalizált alakból eltűnne ez a
    // mező — ez a próba tehát a payload szűkségét bizonyítja.
    const vine = await seedVine('vine-photo-event-isolation', 40, {
      photos: [
        {
          id: 'foto-1',
          storagePath: 'vines/vine-photo-event-isolation/photos/foto-1.png',
          downloadUrl: 'https://example.test/foto-1.png',
          width: 1280,
          height: 960,
          capturedAt: null,
          uploadedAt: '2026-08-04T08:00:00.000Z',
          caption: 'eredeti felirat',
          legacyPhotoField: 'nem-veszhet-el',
        },
      ],
      events: [
        {
          id: 'esemeny-1',
          type: 'observation',
          occurredAt: '2026-08-04T09:00:00.000Z',
          title: 'Megfigyelés',
          notes: '',
          createdAt: '2026-08-04T09:00:00.000Z',
          updatedAt: '2026-08-04T09:00:00.000Z',
          legacyEventField: 'nem-veszhet-el',
        },
      ],
    });

    await addEvents(adminClientDb, {
      targetVineIds: [vine.id],
      event: {
        type: 'pruning',
        occurredAt: '2026-08-05T09:00:00.000Z',
        title: 'Metszés',
        notes: '',
      },
    });
    await editEvent(adminClientDb, {
      vineId: vine.id,
      eventId: 'esemeny-1',
      event: {
        type: 'observation',
        occurredAt: '2026-08-04T09:30:00.000Z',
        title: 'Átírt megfigyelés',
        notes: '',
      },
    });
    await deleteEvent(adminClientDb, { vineId: vine.id, eventId: 'esemeny-1' });

    const afterEventWrites = (await adminDb.collection('vines').doc(vine.id).get()).data();
    expect(afterEventWrites?.events).toHaveLength(1);
    expect(afterEventWrites?.events?.[0]?.title).toBe('Metszés');
    // Három eseményművelet után is pontosan ugyanaz a fotórekord van a tőkén: a
    // mapper által nem ismert mező is megvan, tehát a `photos` tömb nem íródott
    // vissza normalizálva.
    expect(afterEventWrites?.photos).toEqual([
      expect.objectContaining({
        id: 'foto-1',
        caption: 'eredeti felirat',
        legacyPhotoField: 'nem-veszhet-el',
      }),
    ]);

    // Fordított irány, külön tőkén: egy eseményművelet is normalizálva írja
    // vissza az `events` tömböt, ezért a két állítás nem férne el egy tőkén.
    const photoOnly = await seedVine('vine-photo-write-isolation', 41, {
      photos: [
        {
          id: 'foto-1',
          storagePath: 'vines/vine-photo-write-isolation/photos/foto-1.png',
          downloadUrl: 'https://example.test/foto-1.png',
          width: 1280,
          height: 960,
          capturedAt: null,
          uploadedAt: '2026-08-04T08:00:00.000Z',
          caption: 'eredeti felirat',
        },
      ],
      events: [
        {
          id: 'esemeny-1',
          type: 'observation',
          occurredAt: '2026-08-04T09:00:00.000Z',
          title: 'Megfigyelés',
          notes: '',
          createdAt: '2026-08-04T09:00:00.000Z',
          updatedAt: '2026-08-04T09:00:00.000Z',
          legacyEventField: 'nem-veszhet-el',
        },
      ],
    });

    await editVinePhotoCaption(adminClientDb, {
      vineId: photoOnly.id,
      photoId: 'foto-1',
      caption: 'új felirat',
    });
    await setCoverPhoto(adminClientDb, { vineId: photoOnly.id, photoId: 'foto-1' });

    const afterPhotoWrites = (await adminDb.collection('vines').doc(photoOnly.id).get()).data();
    expect(afterPhotoWrites?.photos?.[0]?.caption).toBe('új felirat');
    expect(afterPhotoWrites?.coverPhotoId).toBe('foto-1');
    expect(afterPhotoWrites?.events).toEqual([
      expect.objectContaining({
        id: 'esemeny-1',
        title: 'Megfigyelés',
        legacyEventField: 'nem-veszhet-el',
      }),
    ]);
  });

  it('a migrált, régi eseményes útvonalon lévő fotó ugyanúgy megnyílik és törölhető', async () => {
    const legacyPath = 'vines/vine-migrated-photo/events/regi-esemeny/photos/regi.jpg';
    const legacyThumbnailPath =
      'vines/vine-migrated-photo/events/regi-esemeny/photos/regi_thumb.jpg';
    await uploadBytes(ref(adminClientStorage, legacyPath), new Uint8Array([21, 21, 21]), {
      contentType: 'image/jpeg',
    });
    await uploadBytes(
      ref(adminClientStorage, legacyThumbnailPath),
      new Uint8Array([22, 22, 22]),
      { contentType: 'image/jpeg' },
    );

    // A migrációs script eredményének alakja: a fotó a gyökérben él, az útvonalai
    // viszont a régi objektumokra mutatnak, és a borító `coverPhotoId`.
    const vine = await seedVine('vine-migrated-photo', 42, {
      photos: [
        {
          id: 'regi',
          storagePath: legacyPath,
          downloadUrl: 'https://example.test/regi.jpg',
          width: 1280,
          height: 960,
          thumbnail: {
            storagePath: legacyThumbnailPath,
            downloadUrl: 'https://example.test/regi_thumb.jpg',
            width: 120,
            height: 90,
          },
          capturedAt: '2026-05-01T10:00:00.000Z',
          uploadedAt: '2026-05-02T10:00:00.000Z',
          caption: 'régi felirat',
        },
      ],
      coverPhotoId: 'regi',
      events: [
        {
          id: 'regi-esemeny',
          type: 'observation',
          occurredAt: '2026-05-02T09:00:00.000Z',
          title: 'Migrált esemény',
          notes: '',
          createdAt: '2026-05-02T09:00:00.000Z',
          updatedAt: '2026-05-02T09:00:00.000Z',
        },
      ],
    });

    expect(vine.photos[0]).toMatchObject({
      id: 'regi',
      storagePath: legacyPath,
      caption: 'régi felirat',
      capturedAt: '2026-05-01T10:00:00.000Z',
    });
    expect(vine.coverPhotoId).toBe('regi');
    expect(new Uint8Array(await getBytes(ref(adminClientStorage, legacyPath)))).toEqual(
      new Uint8Array([21, 21, 21]),
    );
    // A régi útvonal publikus olvasása megmarad, de nem admin nem írhat rá.
    expect(new Uint8Array(await getBytes(ref(nonAdminClientStorage, legacyPath)))).toEqual(
      new Uint8Array([21, 21, 21]),
    );
    await expect(
      uploadBytes(ref(nonAdminClientStorage, legacyPath), new Uint8Array([0]), {
        contentType: 'image/jpeg',
      }),
    ).rejects.toMatchObject({ code: 'storage/unauthorized' });

    await deleteVinePhoto(adminClientDb, adminClientStorage, {
      vineId: vine.id,
      photoId: 'regi',
    });

    const afterDelete = await waitForVines(
      adminClientDb,
      (nextVines) => nextVines.find((candidate) => candidate.id === vine.id)?.photos.length === 0,
    );
    // A kijelölt borító törlésével a mutató ugyanabban a tranzakcióban nullázódik.
    expect(afterDelete.find((candidate) => candidate.id === vine.id)?.coverPhotoId).toBeNull();
    await expect(getBytes(ref(adminClientStorage, legacyPath))).rejects.toMatchObject({
      code: 'storage/object-not-found',
    });
    await expect(getBytes(ref(adminClientStorage, legacyThumbnailPath))).rejects.toMatchObject({
      code: 'storage/object-not-found',
    });
  });

  it('a hiányzó vagy hibás alakú bélyegmezőt bélyeg nélküli fotóként olvassa', async () => {
    const uploadedAt = AdminTimestamp.fromDate(new Date('2026-08-04T08:00:00.000Z'));
    const vine = await seedVine('vine-thumbnail-legacy', 43, {
      photos: [
        {
          id: 'legacy-with-thumbnail',
          storagePath: 'vines/vine-thumbnail-legacy/photos/a.jpg',
          downloadUrl: 'https://example.test/a.jpg',
          width: 1280,
          height: 960,
          thumbnail: {
            storagePath: 'vines/vine-thumbnail-legacy/photos/a_thumb.jpg',
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
          storagePath: 'vines/vine-thumbnail-legacy/photos/b.jpg',
          downloadUrl: 'https://example.test/b.jpg',
          width: 1280,
          height: 960,
          uploadedAt,
          caption: '',
        },
        // Hibás alak: letöltési URL nélkül a bélyeg használhatatlan.
        {
          id: 'legacy-broken-thumbnail',
          storagePath: 'vines/vine-thumbnail-legacy/photos/c.jpg',
          downloadUrl: 'https://example.test/c.jpg',
          width: 1280,
          height: 960,
          thumbnail: { width: 320 },
          uploadedAt,
          caption: '',
        },
      ],
    });

    expect(vine.photos.map((photo) => photo.thumbnail)).toEqual([
      {
        storagePath: 'vines/vine-thumbnail-legacy/photos/a_thumb.jpg',
        downloadUrl: 'https://example.test/a_thumb.jpg',
        width: 320,
        height: 240,
      },
      null,
      null,
    ]);
    // Az EXIF nélküli fotó a feltöltési idejével kerül a sorrendbe.
    expect(vine.photos.map((photo) => photo.capturedAt)).toEqual([null, null, null]);
    expect(vine.photos.map((photo) => photo.uploadedAt)).toEqual([
      '2026-08-04T08:00:00.000Z',
      '2026-08-04T08:00:00.000Z',
      '2026-08-04T08:00:00.000Z',
    ]);
  });
});
