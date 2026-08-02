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
import type { Firestore } from 'firebase/firestore';
import type { CreateVineInput, Vine } from './model';
import { createVine, editVine, subscribeToVines } from './firestoreVines';

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

describe('Firestore vine catalog', () => {
  const adminApp = initializeAdminApp({ credential: applicationDefault(), projectId });
  const adminDb = getAdminFirestore(adminApp);
  const clientApp = initializeApp({ projectId, apiKey: 'test-api-key' });
  const clientDb = getFirestore(clientApp);
  const adminClientApp = initializeApp(
    { projectId, apiKey: 'test-api-key' },
    'vine-integration-admin',
  );
  const adminClientDb = getFirestore(adminClientApp);
  const adminClientAuth = getAuth(adminClientApp);
  let adminUid: string;

  beforeAll(async () => {
    connectFirestoreEmulator(clientDb, '127.0.0.1', 8088);
    connectFirestoreEmulator(adminClientDb, '127.0.0.1', 8088);
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
});
