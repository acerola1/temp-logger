import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
  type Unsubscribe,
  updateDoc,
} from 'firebase/firestore';
import type {
  CreateVineInput,
  EditVineInput,
  Vine,
  VineEvent,
  VineEventPhoto,
  VineEventType,
  VinePlantingDate,
  VineRootType,
  VineStatus,
} from './model';

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

function mapPhoto(value: DocumentData): VineEventPhoto {
  return {
    id: typeof value.id === 'string' ? value.id : '',
    storagePath: typeof value.storagePath === 'string' ? value.storagePath : '',
    downloadUrl: typeof value.downloadUrl === 'string' ? value.downloadUrl : '',
    width: typeof value.width === 'number' ? value.width : 0,
    height: typeof value.height === 'number' ? value.height : 0,
    uploadedAt: timestampToIso(value.uploadedAt),
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
