import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
  type Unsubscribe,
  updateDoc,
} from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';
import { MAX_VINE_PHOTOS, MAX_VINE_EVENT_TARGETS } from './model';
import type {
  AddVineEventsInput,
  AddVinePhotosInput,
  CreateVineInput,
  DeleteVineEventInput,
  DeleteVinePhotoInput,
  EditVineInput,
  EditVineEventInput,
  EditVinePhotoCaptionInput,
  SetVineCoverPhotoInput,
  Vine,
  VineEvent,
  VineEventType,
  VinePhoto,
  VinePhotoThumbnail,
  VinePlantingDate,
  VineRootType,
  VineStatus,
} from './model';
import {
  deleteVinePhotoObjects,
  prepareVinePhotos,
  uploadPreparedVinePhotos,
} from './vinePhotos';

export type VineMutationProgress = (progress: number) => void;

function editableFields(input: CreateVineInput) {
  return {
    variety: input.variety.trim(),
    hasFruited: input.hasFruited,
    rootType: input.rootType,
    rootstockVariety:
      input.rootType === 'grafted' ? input.rootstockVariety.trim() : '',
    plantingDate: input.plantingDate,
    areaDescription: input.areaDescription.trim(),
    status: input.status,
    tags: input.tags,
    notes: input.notes.trim(),
    sourceCuttingId: input.sourceCuttingId?.trim() || null,
  };
}

function timestampToIso(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (typeof value === 'string') {
    return value;
  }

  return new Date(0).toISOString();
}

// A `capturedAt` és a `caption` csak a 12-es issue óta kerül a rekordba, ezért a
// régi fotóknál hiányzik: ilyenkor `null`, illetve üres felirat jár.
function optionalTimestampToIso(value: unknown): string | null {
  return value instanceof Timestamp || typeof value === 'string' ? timestampToIso(value) : null;
}

// A bélyeg csak a 17-es issue óta készül, és a régi fotókhoz nincs is: hiányzó
// vagy hibás alak esetén `null`, azaz a felület a nagy képre esik vissza.
function mapPhotoThumbnail(value: unknown): VinePhotoThumbnail | null {
  if (!value || typeof value !== 'object') return null;

  const { storagePath, downloadUrl, width, height } = value as Record<string, unknown>;
  // A letöltési URL nélkül a bélyeg használhatatlan, ezért ilyenkor nincs bélyeg.
  if (typeof downloadUrl !== 'string' || !downloadUrl) return null;

  return {
    storagePath: typeof storagePath === 'string' ? storagePath : '',
    downloadUrl,
    width: typeof width === 'number' ? width : 0,
    height: typeof height === 'number' ? height : 0,
  };
}

function mapPhoto(value: DocumentData): VinePhoto {
  return {
    id: typeof value.id === 'string' ? value.id : '',
    storagePath: typeof value.storagePath === 'string' ? value.storagePath : '',
    downloadUrl: typeof value.downloadUrl === 'string' ? value.downloadUrl : '',
    width: typeof value.width === 'number' ? value.width : 0,
    height: typeof value.height === 'number' ? value.height : 0,
    thumbnail: mapPhotoThumbnail(value.thumbnail),
    capturedAt: optionalTimestampToIso(value.capturedAt),
    uploadedAt: timestampToIso(value.uploadedAt),
    caption: typeof value.caption === 'string' ? value.caption : '',
  };
}

function mapEvent(value: DocumentData): VineEvent {
  return {
    id: typeof value.id === 'string' ? value.id : '',
    type: value.type as VineEventType,
    occurredAt: timestampToIso(value.occurredAt),
    title: typeof value.title === 'string' ? value.title : '',
    notes: typeof value.notes === 'string' ? value.notes : '',
    createdAt: timestampToIso(value.createdAt),
    updatedAt: timestampToIso(value.updatedAt),
  };
}

/**
 * A kijelölt borító azonosítója. Hibás vagy már törölt fotóra mutató érték nem
 * hiba: a feloldás csendben az automatikus borítóra esik vissza, javító írás
 * nélkül.
 */
function mapCoverPhotoId(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function mapVine(snapshot: QueryDocumentSnapshot<DocumentData>): Vine {
  const value = snapshot.data();

  return {
    id: snapshot.id,
    serialNumber: value.serialNumber,
    variety: typeof value.variety === 'string' ? value.variety.trim() : '',
    hasFruited: value.hasFruited === true,
    rootType: value.rootType as VineRootType,
    rootstockVariety:
      typeof value.rootstockVariety === 'string' ? value.rootstockVariety.trim() : '',
    plantingDate: value.plantingDate as VinePlantingDate,
    areaDescription:
      typeof value.areaDescription === 'string' ? value.areaDescription.trim() : '',
    status: value.status as VineStatus,
    tags: Array.isArray(value.tags)
      ? value.tags.filter((tag): tag is string => typeof tag === 'string')
      : [],
    notes: typeof value.notes === 'string' ? value.notes : '',
    sourceCuttingId:
      typeof value.sourceCuttingId === 'string' ? value.sourceCuttingId : null,
    photos: Array.isArray(value.photos) ? value.photos.map(mapPhoto) : [],
    coverPhotoId: mapCoverPhotoId(value.coverPhotoId),
    events: Array.isArray(value.events) ? value.events.map(mapEvent) : [],
    createdAt: timestampToIso(value.createdAt),
    updatedAt: timestampToIso(value.updatedAt),
    createdByUid: typeof value.createdByUid === 'string' ? value.createdByUid : null,
  };
}

export function subscribeToVines(
  firestore: Firestore,
  onVines: (vines: Vine[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const vinesQuery = query(collection(firestore, 'vines'), orderBy('serialNumber', 'asc'));

  return onSnapshot(
    vinesQuery,
    (snapshot) => onVines(snapshot.docs.map(mapVine)),
    onError,
  );
}

export async function createVine(
  firestore: Firestore,
  createdByUid: string | null,
  serialNumber: number,
  input: CreateVineInput,
): Promise<{ vineId: string; serialNumber: number }> {
  const timestamp = serverTimestamp();
  const reference = await addDoc(collection(firestore, 'vines'), {
    ...editableFields(input),
    serialNumber,
    photos: [],
    coverPhotoId: null,
    events: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    createdByUid,
  });

  return { vineId: reference.id, serialNumber };
}

export async function editVine(
  firestore: Firestore,
  vineId: string,
  input: EditVineInput,
): Promise<void> {
  await updateDoc(doc(firestore, 'vines', vineId), {
    ...editableFields(input),
    updatedAt: serverTimestamp(),
  });
}

function normalizeEventDetails(input: AddVineEventsInput['event']): AddVineEventsInput['event'] {
  return {
    type: input.type,
    occurredAt: input.occurredAt,
    title: input.title.trim(),
    notes: input.notes.trim(),
  };
}

function mapStoredEvents(data: DocumentData): VineEvent[] {
  return Array.isArray(data.events)
    ? data.events.map((value) => mapEvent(value as DocumentData))
    : [];
}

function mapStoredPhotos(data: DocumentData): VinePhoto[] {
  return Array.isArray(data.photos)
    ? data.photos.map((value) => mapPhoto(value as DocumentData))
    : [];
}

function uniqueEventTargetIds(targetVineIds: readonly string[]): string[] {
  return [...new Set(targetVineIds)];
}

async function assertActiveEventTargets(
  firestore: Firestore,
  targetVineIds: readonly string[],
  openedVineId?: string,
): Promise<void> {
  const snapshots = await Promise.all(
    targetVineIds.map((vineId) => getDoc(doc(firestore, 'vines', vineId))),
  );

  if (snapshots.some((snapshot) => !snapshot.exists())) {
    throw new Error('A kiválasztott tőke nem található.');
  }

  if (
    snapshots.some(
      (snapshot) =>
        snapshot.data()?.status !== 'active' && snapshot.id !== openedVineId,
    )
  ) {
    throw new Error('Esemény csak aktív tőkéhez adható.');
  }
}

function validateEventTargets(targetVineIds: readonly string[]): string[] {
  const uniqueTargetIds = uniqueEventTargetIds(targetVineIds);

  if (uniqueTargetIds.length === 0) {
    throw new Error('Válassz legalább egy tőkét.');
  }

  if (uniqueTargetIds.length > MAX_VINE_EVENT_TARGETS) {
    throw new Error(
      `Egy műveletben legfeljebb ${MAX_VINE_EVENT_TARGETS} tőkéhez adhatsz eseményt.`,
    );
  }

  return uniqueTargetIds;
}

interface PersistedEventWriteArtifact {
  vineId: string;
  eventId: string;
  previousStatus: VineStatus;
}

// Az eseményműveletek payloadja sosem tartalmaz `photos` mezőt: egy esemény
// mentése, szerkesztése vagy törlése egyetlen tőkefotót sem módosít.
async function appendEvent(
  firestore: Firestore,
  vineId: string,
  event: VineEvent,
  openedVineId?: string,
): Promise<VineStatus> {
  return runTransaction(firestore, async (transaction) => {
    const vineReference = doc(firestore, 'vines', vineId);
    const snapshot = await transaction.get(vineReference);
    if (!snapshot.exists()) {
      throw new Error('A kiválasztott tőke nem található.');
    }

    const data = snapshot.data();
    if (data.status !== 'active' && vineId !== openedVineId) {
      throw new Error('Esemény csak aktív tőkéhez adható.');
    }

    const existingEvents = mapStoredEvents(data);

    transaction.update(vineReference, {
      events: [...existingEvents, event],
      ...(event.type === 'ceased' ? { status: 'ceased' as const } : {}),
      updatedAt: serverTimestamp(),
    });

    return data.status as VineStatus;
  });
}

async function rollbackEvent(
  firestore: Firestore,
  artifact: PersistedEventWriteArtifact,
): Promise<void> {
  try {
    await runTransaction(firestore, async (transaction) => {
      const vineReference = doc(firestore, 'vines', artifact.vineId);
      const snapshot = await transaction.get(vineReference);
      if (!snapshot.exists()) return;

      const data = snapshot.data();
      const existingEvents = mapStoredEvents(data);
      const nextEvents = existingEvents.filter((event) => event.id !== artifact.eventId);
      const shouldRestoreActiveStatus =
        artifact.previousStatus === 'active' &&
        data.status === 'ceased' &&
        !nextEvents.some((event) => event.type === 'ceased');

      if (nextEvents.length !== existingEvents.length) {
        transaction.update(vineReference, {
          events: nextEvents,
          ...(shouldRestoreActiveStatus ? { status: 'active' as const } : {}),
          updatedAt: serverTimestamp(),
        });
      }
    });
  } catch (error) {
    console.warn('Vine event rollback failed:', artifact.vineId, artifact.eventId, error);
  }
}

export async function addEvents(
  firestore: Firestore,
  input: AddVineEventsInput,
): Promise<void> {
  const targetVineIds = validateEventTargets(input.targetVineIds);
  await assertActiveEventTargets(firestore, targetVineIds, input.openedVineId);

  const persistedArtifacts: PersistedEventWriteArtifact[] = [];
  const details = normalizeEventDetails(input.event);

  try {
    for (const vineId of targetVineIds) {
      const eventId = crypto.randomUUID();
      const now = Timestamp.now().toDate().toISOString();
      const previousStatus = await appendEvent(
        firestore,
        vineId,
        {
          ...details,
          id: eventId,
          createdAt: now,
          updatedAt: now,
        },
        input.openedVineId,
      );
      persistedArtifacts.push({ vineId, eventId, previousStatus });
    }
  } catch (error) {
    // Részleges tömeges mentés nem maradhat: ami már beírt, azt visszavesszük.
    for (const artifact of persistedArtifacts) {
      await rollbackEvent(firestore, artifact);
    }
    throw error;
  }
}

export async function editEvent(
  firestore: Firestore,
  input: EditVineEventInput,
): Promise<void> {
  await runTransaction(firestore, async (transaction) => {
    const vineReference = doc(firestore, 'vines', input.vineId);
    const snapshot = await transaction.get(vineReference);
    if (!snapshot.exists()) {
      throw new Error('A tőke nem található.');
    }

    const data = snapshot.data();
    const existingEvents = mapStoredEvents(data);
    const event = existingEvents.find((candidate) => candidate.id === input.eventId);
    if (!event) {
      throw new Error('Az esemény nem található.');
    }

    const details = normalizeEventDetails(input.event);
    const now = Timestamp.now().toDate().toISOString();
    transaction.update(vineReference, {
      events: existingEvents.map((candidate) =>
        candidate.id === input.eventId
          ? { ...candidate, ...details, updatedAt: now }
          : candidate,
      ),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function deleteEvent(
  firestore: Firestore,
  input: DeleteVineEventInput,
): Promise<void> {
  await runTransaction(firestore, async (transaction) => {
    const vineReference = doc(firestore, 'vines', input.vineId);
    const snapshot = await transaction.get(vineReference);
    if (!snapshot.exists()) {
      throw new Error('A tőke nem található.');
    }

    const existingEvents = mapStoredEvents(snapshot.data());
    if (!existingEvents.some((candidate) => candidate.id === input.eventId)) {
      throw new Error('Az esemény nem található.');
    }

    // Az esemény törlése egyetlen fotót sem visz magával: a tőkefotók önálló
    // életciklust kapnak, ezért a `photos` tömb és a borító érintetlen marad.
    transaction.update(vineReference, {
      events: existingEvents.filter((candidate) => candidate.id !== input.eventId),
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * A fotók a tőke beágyazott tömbjében élnek, ezért minden fotóművelet
 * tranzakciós read–modify–write ugyanazon a dokumentumon: két párhuzamos írás
 * nem írhatja felül egymás fotóit. Az írás szándékosan nem tartalmazza az
 * `events` mezőt, így egy fotóművelet párhuzamos eseménymódosítást sem
 * söpörhet el.
 */
async function updateVinePhotos<T>(
  firestore: Firestore,
  vineId: string,
  apply: (photos: readonly VinePhoto[]) => { photos: VinePhoto[]; result: T },
): Promise<T> {
  return runTransaction(firestore, async (transaction) => {
    const vineReference = doc(firestore, 'vines', vineId);
    const snapshot = await transaction.get(vineReference);
    if (!snapshot.exists()) {
      throw new Error('A tőke nem található.');
    }

    const data = snapshot.data();
    const { photos, result } = apply(mapStoredPhotos(data));
    // A kijelölt borító törlésekor a mutató ugyanebben az írásban tűnik el, hogy
    // a tőkén ne maradjon árva hivatkozás.
    const coverPhotoId = mapCoverPhotoId(data.coverPhotoId);
    const isCoverRemoved =
      coverPhotoId !== null && !photos.some((candidate) => candidate.id === coverPhotoId);

    transaction.update(vineReference, {
      photos,
      ...(isCoverRemoved ? { coverPhotoId: null } : {}),
      updatedAt: serverTimestamp(),
    });

    return result;
  });
}

function photoLimitError(): Error {
  return new Error(`Egy tőkéhez legfeljebb ${MAX_VINE_PHOTOS} fotó tartozhat.`);
}

/**
 * Egyetlen, előre lefoglalt azonosítójú fotó idempotens commitja. Ugyanazzal az
 * azonosítóval ismételve sikeres no-op, így egy elveszett tranzakcióválasz után
 * az újrapróbálás nem készít duplikált rekordot.
 */
export async function commitVinePhoto(
  firestore: Firestore,
  vineId: string,
  photo: VinePhoto,
): Promise<void> {
  await runTransaction(firestore, async (transaction) => {
    const vineReference = doc(firestore, 'vines', vineId);
    const snapshot = await transaction.get(vineReference);
    if (!snapshot.exists()) throw new Error('A tőke nem található.');
    const existingPhotos = mapStoredPhotos(snapshot.data());

    if (existingPhotos.some((candidate) => candidate.id === photo.id)) {
      return;
    }

    if (existingPhotos.length >= MAX_VINE_PHOTOS) throw photoLimitError();
    transaction.update(vineReference, {
      photos: [...existingPhotos, photo],
      updatedAt: serverTimestamp(),
    });
  });
}

export async function hasVinePhoto(
  firestore: Firestore,
  vineId: string,
  photoId: string,
): Promise<boolean> {
  const snapshot = await getDoc(doc(firestore, 'vines', vineId));
  if (!snapshot.exists()) throw new Error('A tőke nem található.');
  return mapStoredPhotos(snapshot.data()).some((photo) => photo.id === photoId);
}

// A korlátot már a fotók előkészítése előtt megnézzük: hiába töltenénk fel, ha a
// tranzakció úgyis elutasítja.
async function assertVinePhotoCapacity(
  firestore: Firestore,
  input: AddVinePhotosInput,
): Promise<void> {
  const snapshot = await getDoc(doc(firestore, 'vines', input.vineId));
  if (!snapshot.exists()) {
    throw new Error('A tőke nem található.');
  }

  if (mapStoredPhotos(snapshot.data()).length + input.photos.length > MAX_VINE_PHOTOS) {
    throw photoLimitError();
  }
}

export async function addVinePhotos(
  firestore: Firestore,
  storage: FirebaseStorage,
  input: AddVinePhotosInput,
  onProgress?: VineMutationProgress,
): Promise<void> {
  if (input.photos.length === 0) {
    throw new Error('Válassz legalább egy fotót.');
  }

  await assertVinePhotoCapacity(firestore, input);

  const preparedPhotos = await prepareVinePhotos(input.photos);
  onProgress?.(0);
  const photos = await uploadPreparedVinePhotos(
    storage,
    input.vineId,
    preparedPhotos,
    (uploadedBytes, totalBytes) => {
      const progress = totalBytes > 0
        ? Math.round((Math.min(uploadedBytes, totalBytes) / totalBytes) * 100)
        : 100;
      onProgress?.(Math.min(100, progress));
    },
  );

  try {
    await updateVinePhotos(firestore, input.vineId, (existingPhotos) => {
      // A korlát a tranzakcióban is szerepel: párhuzamos írás sem léphet túl.
      if (existingPhotos.length + photos.length > MAX_VINE_PHOTOS) {
        throw photoLimitError();
      }

      return { photos: [...existingPhotos, ...photos], result: undefined };
    });
  } catch (error) {
    // Storage-kompenzáció: sikertelen Firestore-írás után nem maradhat árva
    // objektum.
    await deleteVinePhotoObjects(storage, photos);
    throw error;
  }
}

export async function deleteVinePhoto(
  firestore: Firestore,
  storage: FirebaseStorage,
  input: DeleteVinePhotoInput,
): Promise<void> {
  // Előbb a Firestore-rekordból vesszük ki a képet, és csak utána töröljük
  // best-effort a Storage-objektumot: a felület így nem mutat olyan bélyeget,
  // ami már nem letölthető.
  const removedPhoto = await updateVinePhotos(firestore, input.vineId, (existingPhotos) => {
    const photo = existingPhotos.find((candidate) => candidate.id === input.photoId);
    if (!photo) {
      throw new Error('A fotó nem található.');
    }

    return {
      photos: existingPhotos.filter((candidate) => candidate.id !== input.photoId),
      result: photo,
    };
  });

  await deleteVinePhotoObjects(storage, [removedPhoto]);
}

export async function editVinePhotoCaption(
  firestore: Firestore,
  input: EditVinePhotoCaptionInput,
): Promise<void> {
  // Az üres felirat érvényes érték: a szerkesztő így tudja törölni is.
  const caption = input.caption.trim();

  await updateVinePhotos(firestore, input.vineId, (existingPhotos) => {
    if (!existingPhotos.some((candidate) => candidate.id === input.photoId)) {
      throw new Error('A fotó nem található.');
    }

    return {
      photos: existingPhotos.map((candidate) =>
        candidate.id === input.photoId ? { ...candidate, caption } : candidate,
      ),
      result: undefined,
    };
  });
}

/**
 * A borítókép kijelölése, illetve `null`-lal a kijelölés visszavonása. A mutató
 * csak a tőke létező fotójára állhat, ezért a tranzakció ellenőrzi. A fotólistát
 * nem írja át: a kijelölés egyetlen mező.
 */
export async function setCoverPhoto(
  firestore: Firestore,
  input: SetVineCoverPhotoInput,
): Promise<void> {
  await runTransaction(firestore, async (transaction) => {
    const vineReference = doc(firestore, 'vines', input.vineId);
    const snapshot = await transaction.get(vineReference);
    if (!snapshot.exists()) {
      throw new Error('A tőke nem található.');
    }

    if (
      input.photoId &&
      !mapStoredPhotos(snapshot.data()).some((candidate) => candidate.id === input.photoId)
    ) {
      throw new Error('A fotó nem található.');
    }

    transaction.update(vineReference, {
      coverPhotoId: input.photoId,
      updatedAt: serverTimestamp(),
    });
  });
}
