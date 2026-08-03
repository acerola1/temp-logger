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
import { MAX_VINE_EVENT_PHOTOS, MAX_VINE_EVENT_TARGETS } from './model';
import type {
  AddVineEventPhotosInput,
  AddVineEventsInput,
  CreateVineInput,
  DeleteVineEventInput,
  DeleteVineEventPhotoInput,
  EditVineInput,
  EditVineEventInput,
  EditVineEventPhotoCaptionInput,
  Vine,
  VineEvent,
  VineEventPhoto,
  VineEventType,
  VinePlantingDate,
  VineRootType,
  VineStatus,
} from './model';
import {
  deleteVineEventPhotos,
  prepareVineEventPhotos,
  uploadPreparedVineEventPhotos,
} from './vineEventPhotos';

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

function mapPhoto(value: DocumentData): VineEventPhoto {
  return {
    id: typeof value.id === 'string' ? value.id : '',
    storagePath: typeof value.storagePath === 'string' ? value.storagePath : '',
    downloadUrl: typeof value.downloadUrl === 'string' ? value.downloadUrl : '',
    width: typeof value.width === 'number' ? value.width : 0,
    height: typeof value.height === 'number' ? value.height : 0,
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
    photos: Array.isArray(value.photos) ? value.photos.map(mapPhoto) : [],
    createdAt: timestampToIso(value.createdAt),
    updatedAt: timestampToIso(value.updatedAt),
  };
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

interface EventWriteArtifact {
  vineId: string;
  eventId: string;
  photos: VineEventPhoto[];
}

interface PersistedEventWriteArtifact extends EventWriteArtifact {
  previousStatus: VineStatus;
}

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
): Promise<boolean> {
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
    return true;
  } catch (error) {
    console.warn('Vine event rollback failed:', artifact.vineId, artifact.eventId, error);
    return false;
  }
}

export async function addEvents(
  firestore: Firestore,
  storage: FirebaseStorage,
  input: AddVineEventsInput,
  onProgress?: VineMutationProgress,
): Promise<void> {
  const targetVineIds = validateEventTargets(input.targetVineIds);
  await assertActiveEventTargets(firestore, targetVineIds, input.openedVineId);

  const preparedPhotos = await prepareVineEventPhotos(input.photos);
  const targetBytes = preparedPhotos.reduce((sum, photo) => sum + photo.blob.size, 0);
  const totalBytes = targetBytes * targetVineIds.length;
  let completedBytes = 0;
  const artifacts: EventWriteArtifact[] = [];
  const persistedArtifacts: PersistedEventWriteArtifact[] = [];
  const details = normalizeEventDetails(input.event);

  if (preparedPhotos.length > 0) {
    onProgress?.(0);
  }

  try {
    for (const vineId of targetVineIds) {
      const eventId = crypto.randomUUID();
      const photos = await uploadPreparedVineEventPhotos(
        storage,
        vineId,
        eventId,
        preparedPhotos,
        (uploadedBytes, localTotalBytes) => {
          const boundedUploadedBytes = Math.min(uploadedBytes, localTotalBytes);
          const progress = totalBytes > 0
            ? Math.round(((completedBytes + boundedUploadedBytes) / totalBytes) * 100)
            : 100;
          onProgress?.(Math.min(100, progress));
        },
      );
      const artifact = { vineId, eventId, photos } satisfies EventWriteArtifact;
      artifacts.push(artifact);

      const now = Timestamp.now().toDate().toISOString();
      const previousStatus = await appendEvent(
        firestore,
        vineId,
        {
          ...details,
          id: eventId,
          photos,
          createdAt: now,
          updatedAt: now,
        },
        input.openedVineId,
      );
      persistedArtifacts.push({ ...artifact, previousStatus });
      completedBytes += targetBytes;
      onProgress?.(totalBytes > 0 ? Math.round((completedBytes / totalBytes) * 100) : 100);
    }
  } catch (error) {
    for (const artifact of persistedArtifacts) {
      if (await rollbackEvent(firestore, artifact)) {
        await deleteVineEventPhotos(storage, artifact.photos);
      }
    }

    const persistedIds = new Set(persistedArtifacts.map((artifact) => artifact.eventId));
    for (const artifact of artifacts) {
      if (!persistedIds.has(artifact.eventId)) {
        await deleteVineEventPhotos(storage, artifact.photos);
      }
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

// A fotók az esemény beágyazott tömbjében élnek, ezért minden fotóművelet
// tranzakciós read–modify–write ugyanazon a tőkedokumentumon: két párhuzamos
// írás nem írhatja felül egymás fotóit, és a művelet csak a megnevezett esemény
// példányát érinti, más tőke azonos nevű eseményét nem.
async function updateEventPhotos<T>(
  firestore: Firestore,
  vineId: string,
  eventId: string,
  apply: (photos: readonly VineEventPhoto[]) => { photos: VineEventPhoto[]; result: T },
): Promise<T> {
  return runTransaction(firestore, async (transaction) => {
    const vineReference = doc(firestore, 'vines', vineId);
    const snapshot = await transaction.get(vineReference);
    if (!snapshot.exists()) {
      throw new Error('A tőke nem található.');
    }

    const existingEvents = mapStoredEvents(snapshot.data());
    const event = existingEvents.find((candidate) => candidate.id === eventId);
    if (!event) {
      throw new Error('Az esemény nem található.');
    }

    const { photos, result } = apply(event.photos);
    const now = Timestamp.now().toDate().toISOString();
    transaction.update(vineReference, {
      events: existingEvents.map((candidate) =>
        candidate.id === eventId ? { ...candidate, photos, updatedAt: now } : candidate,
      ),
      updatedAt: serverTimestamp(),
    });

    return result;
  });
}

function photoLimitError(): Error {
  return new Error(`Egy eseményhez legfeljebb ${MAX_VINE_EVENT_PHOTOS} fotó tartozhat.`);
}

// A korlátot már a fotók előkészítése előtt megnézzük: hiába töltenénk fel, ha a
// tranzakció úgyis elutasítja.
async function assertEventPhotoCapacity(
  firestore: Firestore,
  input: AddVineEventPhotosInput,
): Promise<void> {
  const snapshot = await getDoc(doc(firestore, 'vines', input.vineId));
  if (!snapshot.exists()) {
    throw new Error('A tőke nem található.');
  }

  const event = mapStoredEvents(snapshot.data()).find(
    (candidate) => candidate.id === input.eventId,
  );
  if (!event) {
    throw new Error('Az esemény nem található.');
  }

  if (event.photos.length + input.photos.length > MAX_VINE_EVENT_PHOTOS) {
    throw photoLimitError();
  }
}

export async function addEventPhotos(
  firestore: Firestore,
  storage: FirebaseStorage,
  input: AddVineEventPhotosInput,
  onProgress?: VineMutationProgress,
): Promise<void> {
  if (input.photos.length === 0) {
    throw new Error('Válassz legalább egy fotót.');
  }

  await assertEventPhotoCapacity(firestore, input);

  const preparedPhotos = await prepareVineEventPhotos(input.photos);
  onProgress?.(0);
  const photos = await uploadPreparedVineEventPhotos(
    storage,
    input.vineId,
    input.eventId,
    preparedPhotos,
    (uploadedBytes, totalBytes) => {
      const progress = totalBytes > 0
        ? Math.round((Math.min(uploadedBytes, totalBytes) / totalBytes) * 100)
        : 100;
      onProgress?.(Math.min(100, progress));
    },
  );

  try {
    await updateEventPhotos(firestore, input.vineId, input.eventId, (existingPhotos) => {
      if (existingPhotos.length + photos.length > MAX_VINE_EVENT_PHOTOS) {
        throw photoLimitError();
      }

      return { photos: [...existingPhotos, ...photos], result: undefined };
    });
  } catch (error) {
    // Storage-kompenzáció: sikertelen Firestore-írás után nem maradhat árva
    // objektum, ahogy az `addEvents`-nél sem.
    await deleteVineEventPhotos(storage, photos);
    throw error;
  }
}

export async function deleteEventPhoto(
  firestore: Firestore,
  storage: FirebaseStorage,
  input: DeleteVineEventPhotoInput,
): Promise<void> {
  // Előbb a Firestore-rekordból vesszük ki a képet, és csak utána töröljük
  // best-effort a Storage-objektumot: a felület így nem mutat olyan bélyeget,
  // ami már nem letölthető.
  const removedPhoto = await updateEventPhotos(
    firestore,
    input.vineId,
    input.eventId,
    (existingPhotos) => {
      const photo = existingPhotos.find((candidate) => candidate.id === input.photoId);
      if (!photo) {
        throw new Error('A fotó nem található.');
      }

      return {
        photos: existingPhotos.filter((candidate) => candidate.id !== input.photoId),
        result: photo,
      };
    },
  );

  await deleteVineEventPhotos(storage, [removedPhoto]);
}

export async function editEventPhotoCaption(
  firestore: Firestore,
  input: EditVineEventPhotoCaptionInput,
): Promise<void> {
  // Az üres felirat érvényes érték: a szerkesztő így tudja törölni is.
  const caption = input.caption.trim();

  await updateEventPhotos(firestore, input.vineId, input.eventId, (existingPhotos) => {
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

export async function deleteEvent(
  firestore: Firestore,
  storage: FirebaseStorage,
  input: DeleteVineEventInput,
): Promise<void> {
  const photos = await runTransaction(firestore, async (transaction) => {
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

    transaction.update(vineReference, {
      events: existingEvents.filter((candidate) => candidate.id !== input.eventId),
      updatedAt: serverTimestamp(),
    });
    return event.photos;
  });

  await deleteVineEventPhotos(storage, photos);
}
