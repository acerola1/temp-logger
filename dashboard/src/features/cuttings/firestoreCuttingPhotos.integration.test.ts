import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  applicationDefault,
  deleteApp as deleteAdminApp,
  initializeApp as initializeAdminApp,
} from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
} from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import {
  connectStorageEmulator,
  getBytes,
  getStorage,
  ref,
  uploadBytes,
} from 'firebase/storage';
import type { CuttingPhoto } from '../../types/cutting';
import {
  addCuttingPhotos,
  deleteCuttingPhoto,
  editCuttingPhotoCaption,
} from './firestoreCuttingPhotos';

const projectId = 'demo-esp32-vines-integration';

function photo(id: string, storagePath = `cuttings/cutting-photos/photos/${id}.png`): CuttingPhoto {
  return {
    id,
    storagePath,
    downloadUrl: `http://example.test/${id}.png`,
    width: 640,
    height: 480,
    thumbnail: null,
    capturedAt: null,
    uploadedAt: '2026-08-05T08:00:00.000Z',
    caption: '',
  };
}

function cuttingDocument(uid: string, photos: unknown[] = []) {
  return {
    serialNumber: 1,
    variety: 'Fotóteszt',
    plantType: 'cutting',
    plantedAt: '2026-01-01',
    status: 'active',
    categories: [],
    notes: '',
    photos,
    events: [],
    createdAt: '2026-08-05T07:00:00.000Z',
    updatedAt: '2026-08-05T07:00:00.000Z',
    createdByUid: uid,
  };
}

describe('Firestore cutting photos', () => {
  const adminApp = initializeAdminApp(
    { credential: applicationDefault(), projectId },
    'cutting-photos-admin-sdk',
  );
  const adminDb = getAdminFirestore(adminApp);
  const anonymousApp = initializeApp({
    projectId,
    apiKey: 'test-api-key',
    storageBucket: `${projectId}.appspot.com`,
  }, 'cutting-photos-anonymous');
  const anonymousDb = getFirestore(anonymousApp);
  const adminClientApp = initializeApp({
    projectId,
    apiKey: 'test-api-key',
    storageBucket: `${projectId}.appspot.com`,
  }, 'cutting-photos-admin');
  const adminClientDb = getFirestore(adminClientApp);
  const adminClientStorage = getStorage(adminClientApp);
  const adminClientAuth = getAuth(adminClientApp);
  let adminUid = '';

  beforeAll(async () => {
    connectFirestoreEmulator(anonymousDb, '127.0.0.1', 8088);
    connectFirestoreEmulator(adminClientDb, '127.0.0.1', 8088);
    connectStorageEmulator(adminClientStorage, '127.0.0.1', 9199);
    connectAuthEmulator(adminClientAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
    const credential = await createUserWithEmailAndPassword(
      adminClientAuth,
      'cutting-photo-admin@example.com',
      'Admin1234!',
    );
    adminUid = credential.user.uid;
    await adminDb.collection('admins').doc(adminUid).set({ role: 'admin' });
  });

  afterAll(async () => {
    await deleteApp(anonymousApp);
    await deleteApp(adminClientApp);
    await deleteAdminApp(adminApp);
  });

  it('párhuzamos feliratmentés és hozzáadás egyetlen fotórekordot sem veszít el', async () => {
    const cuttingId = 'cutting-photos-concurrent';
    await adminDb.collection('cuttings').doc(cuttingId).set(
      cuttingDocument(adminUid, [photo('existing')]),
    );

    await Promise.all([
      editCuttingPhotoCaption(adminClientDb, cuttingId, 'existing', '  Megmaradt felirat  '),
      addCuttingPhotos(adminClientDb, adminClientStorage, cuttingId, [photo('added')]),
    ]);

    const data = (await adminDb.collection('cuttings').doc(cuttingId).get()).data();
    expect(data?.photos).toHaveLength(2);
    expect(data?.photos).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'existing', caption: 'Megmaradt felirat' }),
      expect.objectContaining({ id: 'added', caption: '' }),
    ]));
    expect(data?.updatedAt).not.toBe('2026-08-05T07:00:00.000Z');
  });

  it('legacy fotó feliratán kívül semmilyen más metaadatot nem ír át', async () => {
    const cuttingId = 'cutting-photos-legacy-caption';
    const legacyPhoto = {
      id: 'legacy',
      url: 'http://example.test/legacy.png',
      storagePath: 'cuttings/legacy.png',
      capturedAt: null,
      uploadedAt: '2026-08-01T08:00:00.000Z',
      width: 320,
      height: 240,
      caption: 'Régi felirat',
      legacyMarker: { source: 'import' },
    };
    await adminDb.collection('cuttings').doc(cuttingId).set(
      cuttingDocument(adminUid, [legacyPhoto]),
    );

    await editCuttingPhotoCaption(adminClientDb, cuttingId, 'legacy', '  Új felirat  ');

    const data = (await adminDb.collection('cuttings').doc(cuttingId).get()).data();
    expect(data?.photos).toEqual([{ ...legacyPhoto, caption: 'Új felirat' }]);
  });

  it('előbb eltávolítja a metaadatot, majd best-effort törli a Storage-objektumot', async () => {
    const cuttingId = 'cutting-photos-delete';
    const storedPhoto = photo('delete-me', `cuttings/${cuttingId}/photos/delete-me.png`);
    await adminDb.collection('cuttings').doc(cuttingId).set(
      cuttingDocument(adminUid, [storedPhoto, photo('keep-me')]),
    );
    await uploadBytes(ref(adminClientStorage, storedPhoto.storagePath), new Uint8Array([1, 2, 3]), {
      contentType: 'image/png',
    });

    await deleteCuttingPhoto(adminClientDb, adminClientStorage, cuttingId, storedPhoto.id);

    const data = (await adminDb.collection('cuttings').doc(cuttingId).get()).data();
    expect(data?.photos).toEqual([expect.objectContaining({ id: 'keep-me' })]);
    await expect(getBytes(ref(adminClientStorage, storedPhoto.storagePath))).rejects.toMatchObject({
      code: 'storage/object-not-found',
    });
  });

  it('hiányzó Storage-objektum mellett sem hagy törött publikus fotórekordot', async () => {
    const cuttingId = 'cutting-photos-missing-object';
    const missingPhoto = photo('missing', `cuttings/${cuttingId}/photos/missing.png`);
    await adminDb.collection('cuttings').doc(cuttingId).set(
      cuttingDocument(adminUid, [missingPhoto]),
    );

    await deleteCuttingPhoto(adminClientDb, adminClientStorage, cuttingId, missingPhoto.id);

    const data = (await adminDb.collection('cuttings').doc(cuttingId).get()).data();
    expect(data?.photos).toEqual([]);
  });

  it('sikertelen Firestore-hozzáadás után kitakarítja a már feltöltött objektumot', async () => {
    const cuttingId = 'cutting-photos-compensation';
    const orphan = photo('orphan', `cuttings/${cuttingId}/photos/orphan.png`);
    await adminDb.collection('cuttings').doc(cuttingId).set(cuttingDocument(adminUid));
    await uploadBytes(ref(adminClientStorage, orphan.storagePath), new Uint8Array([4, 5, 6]), {
      contentType: 'image/png',
    });

    await expect(
      addCuttingPhotos(anonymousDb, adminClientStorage, cuttingId, [orphan]),
    ).rejects.toMatchObject({ code: 'permission-denied' });

    await expect(getBytes(ref(adminClientStorage, orphan.storagePath))).rejects.toMatchObject({
      code: 'storage/object-not-found',
    });
    const data = (await adminDb.collection('cuttings').doc(cuttingId).get()).data();
    expect(data?.photos).toEqual([]);
  });
});
