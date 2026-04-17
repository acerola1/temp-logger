import { useEffect, useMemo, useRef, useState } from 'react';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
  CalendarDays,
  Camera,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ImagePlus,
  Loader2,
  Plus,
  Search,
  SearchX,
  Sprout,
  Trash2,
  X,
} from 'lucide-react';
import { storage } from '../lib/firebase';
import { prepareImageUpload } from '../lib/imageUpload';
import { formatDate, formatDateTime, formatMonthDay } from '../lib/dateFormat';
import { useCuttings } from '../hooks/useCuttings';
import type { CreateCuttingInput, Cutting, CuttingPhoto, CuttingStatus } from '../types/cutting';

interface CuttingsPageProps {
  isAdmin: boolean;
}

type CreateFormState = {
  variety: string;
  plantType: 'graft' | 'cutting';
  plantedAt: string;
  status: CuttingStatus;
  notes: string;
};

const DEFAULT_FORM_STATE: CreateFormState = {
  variety: '',
  plantType: 'cutting',
  plantedAt: new Date().toISOString().slice(0, 10),
  status: 'active',
  notes: '',
};

function isMobileUserAgent() {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(
    navigator.userAgent,
  );
}

function toDateTimeLocalValue(value: string | Date = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function toDateInputValue(value: string): string {
  return toDateTimeLocalValue(value).slice(0, 10);
}

function getFileExtension(contentType: string): string {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  return 'jpg';
}

function getCuttingPath(cuttingId: string | null): string {
  return cuttingId ? `/dugvanyok/${cuttingId}` : '/dugvanyok';
}

function getCuttingIdFromPath(pathname: string): string | null {
  if (!pathname.startsWith('/dugvanyok/')) {
    return null;
  }

  const cuttingId = pathname.slice('/dugvanyok/'.length).split('/')[0];
  return cuttingId || null;
}

function plantTypeLabel(value: Cutting['plantType']) {
  return value === 'graft' ? 'Oltvány' : 'Dugvány';
}

function statusLabel(value: CuttingStatus) {
  switch (value) {
    case 'rooted':
      return 'Begyökeresedett';
    case 'lost':
      return 'Elveszett';
    case 'archived':
      return 'Archivált';
    default:
      return 'Aktív';
  }
}

function statusBadgeClass(value: CuttingStatus) {
  switch (value) {
    case 'rooted':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
    case 'lost':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200';
    case 'archived':
      return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100';
    default:
      return 'bg-vine-100 text-vine-800 dark:bg-vine-800 dark:text-vine-100';
  }
}

async function uploadCuttingPhotos(cuttingId: string, files: FileList): Promise<CuttingPhoto[]> {
  const uploads = Array.from(files).map(async (file) => {
    const prepared = await prepareImageUpload(file);
    const photoId = crypto.randomUUID();
    const extension = getFileExtension(prepared.contentType);
    const storagePath = `cuttings/${cuttingId}/photos/${photoId}.${extension}`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, prepared.blob, {
      contentType: prepared.contentType,
    });

    const downloadUrl = await getDownloadURL(storageRef);
    const now = new Date().toISOString();

    return {
      id: photoId,
      storagePath,
      downloadUrl,
      capturedAt: now,
      uploadedAt: now,
      width: prepared.width,
      height: prepared.height,
      caption: '',
    } satisfies CuttingPhoto;
  });

  return Promise.all(uploads);
}

export function CuttingsPage({ isAdmin }: CuttingsPageProps) {
  const { data: cuttings, loading, error, createCutting, updateCutting } = useCuttings();
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    getCuttingIdFromPath(window.location.pathname),
  );
  const [formState, setFormState] = useState<CreateFormState>(DEFAULT_FORM_STATE);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [photoActionError, setPhotoActionError] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoDeletingId, setPhotoDeletingId] = useState<string | null>(null);
  const [eventNotes, setEventNotes] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [eventAt, setEventAt] = useState(toDateTimeLocalValue());
  const [eventSaving, setEventSaving] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);
  const [eventDeletingId, setEventDeletingId] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingEventTitle, setEditingEventTitle] = useState('');
  const [editingEventAt, setEditingEventAt] = useState(toDateTimeLocalValue());
  const [editingEventNotes, setEditingEventNotes] = useState('');
  const [editingEventSaving, setEditingEventSaving] = useState(false);
  const [editingEventError, setEditingEventError] = useState<string | null>(null);
  const [targetCuttingIds, setTargetCuttingIds] = useState<string[]>([]);
  const [editState, setEditState] = useState<CreateFormState>(DEFAULT_FORM_STATE);
  const [editMode, setEditMode] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState(false);
  const [photoViewerZoom, setPhotoViewerZoom] = useState(1);
  const [photoViewerOffset, setPhotoViewerOffset] = useState({ x: 0, y: 0 });
  const [isPhotoViewerDragging, setIsPhotoViewerDragging] = useState(false);
  const [photoViewerDragStart, setPhotoViewerDragStart] = useState({ x: 0, y: 0 });
  const createFileInputRef = useRef<HTMLInputElement>(null);
  const detailFileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useMemo(() => isMobileUserAgent(), []);

  const selectedCutting = useMemo(
    () => cuttings.find((cutting) => cutting.id === selectedId) ?? cuttings[0] ?? null,
    [cuttings, selectedId],
  );
  const nextSerialNumber = useMemo(
    () => cuttings.reduce((maxValue, cutting) => Math.max(maxValue, cutting.serialNumber), 0) + 1,
    [cuttings],
  );
  const knownVarieties = useMemo(
    () =>
      Array.from(
        new Set(
          cuttings
            .map((cutting) => cutting.variety.trim())
            .filter((variety) => variety.length > 0),
        ),
      ).sort((left, right) => left.localeCompare(right, 'hu')),
    [cuttings],
  );
  const activePhoto =
    selectedCutting?.photos.find((photo) => photo.id === activePhotoId) ??
    selectedCutting?.photos.at(-1) ??
    null;
  const activePhotoIndex =
    selectedCutting && activePhoto
      ? selectedCutting.photos.findIndex((photo) => photo.id === activePhoto.id)
      : -1;
  const totalPhotos = selectedCutting?.photos.length ?? 0;

  useEffect(() => {
    const handlePopState = () => {
      setSelectedId(getCuttingIdFromPath(window.location.pathname));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!selectedCutting) {
      setEditState(DEFAULT_FORM_STATE);
      setEditMode(false);
      setEditError(null);
      setActivePhotoId(null);
      setEditingEventId(null);
      setEditingEventError(null);
      setTargetCuttingIds([]);
      return;
    }

    setEditState({
      variety: selectedCutting.variety,
      plantType: selectedCutting.plantType,
      plantedAt: toDateInputValue(selectedCutting.plantedAt),
      status: selectedCutting.status,
      notes: selectedCutting.notes,
    });
    setEditMode(false);
    setEditError(null);
    setActivePhotoId(selectedCutting.photos.at(-1)?.id ?? null);
    setEditingEventId(null);
    setEditingEventError(null);
    setTargetCuttingIds([selectedCutting.id]);
  }, [nextSerialNumber, selectedCutting]);

  useEffect(() => {
    if (cuttings.length === 0) {
      if (window.location.pathname !== '/dugvanyok') {
        window.history.replaceState({}, '', '/dugvanyok');
      }
      return;
    }

    if (!selectedCutting) {
      const fallbackCutting = cuttings[0];
      setSelectedId(fallbackCutting.id);
      window.history.replaceState({}, '', getCuttingPath(fallbackCutting.id));
      return;
    }

    const expectedPath = getCuttingPath(selectedCutting.id);
    if (window.location.pathname !== expectedPath) {
      window.history.replaceState({}, '', expectedPath);
    }
  }, [cuttings, selectedCutting]);

  useEffect(() => {
    if (!showCreateForm) {
      return;
    }
  }, [nextSerialNumber, showCreateForm]);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isAdmin) {
      setFormError('Csak admin tud új dugványt létrehozni.');
      return;
    }

    if (!formState.variety.trim()) {
      setFormError('A fajta megadása kötelező.');
      return;
    }

    if (!formState.plantedAt) {
      setFormError('Az ültetés dátuma kötelező.');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const cuttingId = crypto.randomUUID();
      const photos = selectedFiles ? await uploadCuttingPhotos(cuttingId, selectedFiles) : [];
      const payload: CreateCuttingInput = {
        serialNumber: nextSerialNumber,
        variety: formState.variety,
        plantType: formState.plantType,
        plantedAt: formState.plantedAt,
        status: formState.status,
        notes: formState.notes,
        photos,
      };

      await createCutting(cuttingId, payload);
      window.history.pushState({}, '', getCuttingPath(cuttingId));
      setSelectedId(cuttingId);
      setFormState(DEFAULT_FORM_STATE);
      setSelectedFiles(null);
      setShowCreateForm(false);
    } catch (nextError) {
      console.error('Cutting create error:', nextError);
      setFormError(nextError instanceof Error ? nextError.message : 'Nem sikerült menteni a dugványt.');
    } finally {
      setSaving(false);
    }
  };

  const openPicker = (
    inputRef: React.RefObject<HTMLInputElement | null>,
    source: 'camera' | 'gallery',
  ) => {
    const input = inputRef.current;
    if (!input) return;

    if (source === 'camera') {
      input.setAttribute('capture', 'environment');
    } else {
      input.removeAttribute('capture');
    }

    input.value = '';
    input.click();
  };

  const handleAddPhotos = async (files: FileList | null) => {
    if (!files || !selectedCutting || !isAdmin) {
      return;
    }

    setPhotoUploading(true);
    setPhotoActionError(null);

    try {
      const newPhotos = await uploadCuttingPhotos(selectedCutting.id, files);
      await updateCutting(selectedCutting.id, {
        photos: [...selectedCutting.photos, ...newPhotos],
      });
    } catch (nextError) {
      console.error('Cutting photo add error:', nextError);
      setPhotoActionError(
        nextError instanceof Error ? nextError.message : 'Nem sikerült feltölteni a fotókat.',
      );
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleDeletePhoto = async (photo: CuttingPhoto) => {
    if (!selectedCutting || !isAdmin || photoDeletingId) {
      return;
    }

    const confirmed = window.confirm('Biztosan törlöd ezt a képet?');
    if (!confirmed) {
      return;
    }

    setPhotoDeletingId(photo.id);
    setPhotoActionError(null);

    try {
      if (photo.storagePath) {
        await deleteObject(ref(storage, photo.storagePath));
      }

      const remainingPhotos = selectedCutting.photos.filter((item) => item.id !== photo.id);
      await updateCutting(selectedCutting.id, {
        photos: remainingPhotos,
      });

      const nextActivePhoto = remainingPhotos.at(-1) ?? null;
      setActivePhotoId(nextActivePhoto?.id ?? null);
    } catch (nextError) {
      console.error('Cutting photo delete error:', nextError);
      setPhotoActionError(
        nextError instanceof Error ? nextError.message : 'Nem sikerült törölni a fotót.',
      );
    } finally {
      setPhotoDeletingId(null);
    }
  };

  const goToPreviousPhoto = () => {
    if (!selectedCutting || totalPhotos <= 1 || activePhotoIndex < 0) {
      return;
    }

    const previousIndex = (activePhotoIndex - 1 + totalPhotos) % totalPhotos;
    setActivePhotoId(selectedCutting.photos[previousIndex]?.id ?? null);
  };

  const goToNextPhoto = () => {
    if (!selectedCutting || totalPhotos <= 1 || activePhotoIndex < 0) {
      return;
    }

    const nextIndex = (activePhotoIndex + 1) % totalPhotos;
    setActivePhotoId(selectedCutting.photos[nextIndex]?.id ?? null);
  };

  const clampPhotoViewerZoom = (value: number) => Math.max(1, Math.min(6, value));

  const resetPhotoViewerTransform = () => {
    setPhotoViewerZoom(1);
    setPhotoViewerOffset({ x: 0, y: 0 });
    setIsPhotoViewerDragging(false);
  };

  const setPhotoViewerZoomWithReset = (nextZoom: number) => {
    const clampedZoom = clampPhotoViewerZoom(nextZoom);
    setPhotoViewerZoom(clampedZoom);
    if (clampedZoom <= 1) {
      setPhotoViewerOffset({ x: 0, y: 0 });
      setIsPhotoViewerDragging(false);
    }
  };

  const zoomInPhotoViewer = () => {
    setPhotoViewerZoomWithReset(photoViewerZoom + 0.25);
  };

  const zoomOutPhotoViewer = () => {
    setPhotoViewerZoomWithReset(photoViewerZoom - 0.25);
  };

  useEffect(() => {
    if (!isPhotoViewerOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsPhotoViewerOpen(false);
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goToPreviousPhoto();
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goToNextPhoto();
        return;
      }

      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        zoomInPhotoViewer();
        return;
      }

      if (event.key === '-') {
        event.preventDefault();
        zoomOutPhotoViewer();
        return;
      }

      if (event.key === '0') {
        event.preventDefault();
        resetPhotoViewerTransform();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNextPhoto, goToPreviousPhoto, isPhotoViewerOpen, photoViewerZoom]);

  useEffect(() => {
    if (!isPhotoViewerOpen) {
      return;
    }
    resetPhotoViewerTransform();
  }, [activePhoto?.id, isPhotoViewerOpen]);

  const handleAddEvent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isAdmin) {
      return;
    }

    if (!eventAt) {
      setEventError('Az esemény időpontja kötelező.');
      return;
    }

    if (targetCuttingIds.length === 0) {
      setEventError('Válassz legalább egy dugványt.');
      return;
    }

    setEventSaving(true);
    setEventError(null);

    try {
      const sharedEvent = {
        id: crypto.randomUUID(),
        occurredAt: new Date(eventAt).toISOString(),
        title: eventTitle.trim() || 'Esemény',
        notes: eventNotes.trim(),
      };
      const targetCuttings = cuttings.filter((cutting) => targetCuttingIds.includes(cutting.id));

      await Promise.all(
        targetCuttings.map((cutting) =>
          updateCutting(cutting.id, {
            events: [...cutting.events, sharedEvent],
          }),
        ),
      );

      setEventAt(toDateTimeLocalValue());
      setEventTitle('');
      setEventNotes('');
      setTargetCuttingIds(selectedCutting ? [selectedCutting.id] : []);
    } catch (nextError) {
      console.error('Cutting event add error:', nextError);
      setEventError(
        nextError instanceof Error ? nextError.message : 'Nem sikerült menteni az eseményt.',
      );
    } finally {
      setEventSaving(false);
    }
  };

  const startEditingEvent = (log: { id: string; occurredAt: string; title: string; notes: string }) => {
    setEditingEventId(log.id);
    setEditingEventAt(toDateTimeLocalValue(log.occurredAt));
    setEditingEventTitle(log.title);
    setEditingEventNotes(log.notes);
    setEditingEventError(null);
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!selectedCutting || !isAdmin || eventDeletingId) {
      return;
    }

    const confirmed = window.confirm('Biztosan törlöd ezt az esemény bejegyzést?');
    if (!confirmed) {
      return;
    }

    setEventDeletingId(eventId);
    setEventError(null);
    setEditingEventError(null);

    try {
      await updateCutting(selectedCutting.id, {
        events: selectedCutting.events.filter((item) => item.id !== eventId),
      });

      if (editingEventId === eventId) {
        setEditingEventId(null);
        setEditingEventTitle('');
        setEditingEventNotes('');
        setEditingEventAt(toDateTimeLocalValue());
      }
    } catch (nextError) {
      console.error('Cutting event delete error:', nextError);
      setEventError(
        nextError instanceof Error
          ? nextError.message
          : 'Nem sikerült törölni az esemény bejegyzést.',
      );
    } finally {
      setEventDeletingId(null);
    }
  };

  const handleEditEvent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedCutting || !isAdmin || !editingEventId) {
      return;
    }

    if (!editingEventAt) {
      setEditingEventError('Az esemény időpontja kötelező.');
      return;
    }

    setEditingEventSaving(true);
    setEditingEventError(null);

    try {
      await updateCutting(selectedCutting.id, {
        events: selectedCutting.events.map((log) =>
          log.id === editingEventId
            ? {
                ...log,
                occurredAt: new Date(editingEventAt).toISOString(),
                title: editingEventTitle.trim() || 'Esemény',
                notes: editingEventNotes.trim(),
              }
            : log,
        ),
      });

      setEditingEventId(null);
      setEditingEventTitle('');
      setEditingEventNotes('');
      setEditingEventAt(toDateTimeLocalValue());
    } catch (nextError) {
      console.error('Cutting event edit error:', nextError);
      setEditingEventError(
        nextError instanceof Error
          ? nextError.message
          : 'Nem sikerült menteni az esemény bejegyzést.',
      );
    } finally {
      setEditingEventSaving(false);
    }
  };

  const toggleTargetCutting = (cuttingId: string) => {
    setTargetCuttingIds((current) =>
      current.includes(cuttingId)
        ? current.filter((id) => id !== cuttingId)
        : [...current, cuttingId],
    );
  };

  const handleSelectCutting = (cuttingId: string) => {
    const nextPath = getCuttingPath(cuttingId);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setSelectedId(cuttingId);
  };

  const handleEditSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedCutting || !isAdmin) {
      return;
    }

    if (!editState.variety.trim()) {
      setEditError('A fajta megadása kötelező.');
      return;
    }

    if (!editState.plantedAt) {
      setEditError('Az ültetés dátuma kötelező.');
      return;
    }

    setEditSaving(true);
    setEditError(null);

    try {
      await updateCutting(selectedCutting.id, {
        variety: editState.variety.trim(),
        plantType: editState.plantType,
        plantedAt: editState.plantedAt,
        status: editState.status,
        notes: editState.notes.trim(),
      });
      setEditMode(false);
    } catch (nextError) {
      console.error('Cutting edit error:', nextError);
      setEditError(
        nextError instanceof Error ? nextError.message : 'Nem sikerült menteni a módosításokat.',
      );
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-vine-900 dark:text-vine-50">Dugványok</h2>
          <p className="text-sm text-vine-500 dark:text-vine-300">
            Cserepezett szőlő dugványok és oltványok követése fotókkal.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowCreateForm((open) => !open)}
            className="inline-flex items-center gap-2 rounded-xl bg-vine-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-vine-700"
          >
            <Plus className="h-4 w-4" />
            {showCreateForm ? 'Űrlap bezárása' : 'Új dugvány'}
          </button>
        )}
      </div>

      {showCreateForm && isAdmin && (
        <form
          onSubmit={handleCreate}
          className="rounded-3xl border border-vine-200 bg-white/80 p-5 shadow-sm dark:border-vine-700 dark:bg-vine-800/60"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <span className="text-sm font-medium text-vine-700 dark:text-vine-200">Sorszám</span>
              <div className="rounded-xl border border-vine-200 bg-vine-50 px-3 py-2 text-sm font-semibold text-vine-900 dark:border-vine-700 dark:bg-vine-800 dark:text-vine-50">
                #{nextSerialNumber}
              </div>
            </div>

            <label className="space-y-1">
              <span className="text-sm font-medium text-vine-700 dark:text-vine-200">Fajta</span>
              <input
                list="known-grape-varieties"
                value={formState.variety}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, variety: event.target.value }))
                }
                className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none transition-colors focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
                placeholder="pl. Kékfrankos"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-vine-700 dark:text-vine-200">Típus</span>
              <select
                value={formState.plantType}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    plantType: event.target.value as CreateFormState['plantType'],
                  }))
                }
                className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none transition-colors focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
              >
                <option value="cutting">Dugvány</option>
                <option value="graft">Oltvány</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-vine-700 dark:text-vine-200">Ültetés dátuma</span>
              <input
                type="date"
                value={formState.plantedAt}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, plantedAt: event.target.value }))
                }
                className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none transition-colors focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-vine-700 dark:text-vine-200">Állapot</span>
              <select
                value={formState.status}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    status: event.target.value as CuttingStatus,
                  }))
                }
                className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none transition-colors focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
              >
                <option value="active">Aktív</option>
                <option value="rooted">Begyökeresedett</option>
                <option value="lost">Elveszett</option>
                <option value="archived">Archivált</option>
              </select>
            </label>
          </div>

          <label className="mt-4 block space-y-1">
            <span className="text-sm font-medium text-vine-700 dark:text-vine-200">Jegyzet</span>
            <textarea
              value={formState.notes}
              onChange={(event) =>
                setFormState((current) => ({ ...current, notes: event.target.value }))
              }
              rows={3}
              className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none transition-colors focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
              placeholder="Rövid megjegyzés a dugvány állapotáról"
            />
          </label>

          <label className="mt-4 block space-y-1">
            <span className="text-sm font-medium text-vine-700 dark:text-vine-200">Képek</span>
            <input
              ref={createFileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => setSelectedFiles(event.target.files)}
              className="hidden"
            />
            {isMobile ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openPicker(createFileInputRef, 'camera')}
                  className="inline-flex items-center gap-2 rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-700 transition-colors hover:bg-vine-50 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
                >
                  <Camera className="h-4 w-4" />
                  Kamera
                </button>
                <button
                  type="button"
                  onClick={() => openPicker(createFileInputRef, 'gallery')}
                  className="inline-flex items-center gap-2 rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-700 transition-colors hover:bg-vine-50 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
                >
                  <ImagePlus className="h-4 w-4" />
                  Galéria
                </button>
              </div>
            ) : (
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => setSelectedFiles(event.target.files)}
                className="block w-full text-sm text-vine-700 dark:text-vine-200"
              />
            )}
            {selectedFiles && selectedFiles.length > 0 && (
              <p className="text-xs text-vine-500 dark:text-vine-400">
                {selectedFiles.length} kép kiválasztva
              </p>
            )}
            <p className="text-xs text-vine-500 dark:text-vine-400">
              A képek a kliensen 1000 px hosszabbik oldalra lesznek átméretezve.
            </p>
          </label>

          {formError && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              {formError}
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-vine-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-vine-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Mentés
            </button>
            <span className="text-xs text-vine-500 dark:text-vine-400">
              Esemény napló a részletes nézetben adható hozzá.
            </span>
          </div>
        </form>
      )}

      {!isAdmin && (
        <div className="rounded-2xl border border-vine-200 bg-white/60 px-4 py-3 text-sm text-vine-600 dark:border-vine-700 dark:bg-vine-800/40 dark:text-vine-200">
          Megfigyelő nézet. Új dugványt és képet csak admin tud rögzíteni.
        </div>
      )}

      <datalist id="known-grape-varieties">
        {knownVarieties.map((variety) => (
          <option key={variety} value={variety} />
        ))}
      </datalist>

      {loading && (
        <div className="flex items-center justify-center py-16 text-vine-400">
          <Loader2 className="mr-2 h-6 w-6 animate-spin" />
          Dugványok betöltése...
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-3">
            {cuttings.length === 0 && (
              <div className="rounded-3xl border border-dashed border-vine-300 bg-white/70 p-6 text-sm text-vine-500 dark:border-vine-700 dark:bg-vine-800/40 dark:text-vine-300">
                Még nincs felvitt dugvány.
              </div>
            )}

            {cuttings.map((cutting) => {
              const previewUrl = cutting.photos.at(-1)?.downloadUrl ?? null;
              const isSelected = selectedCutting?.id === cutting.id;

              return (
                <button
                  key={cutting.id}
                  onClick={() => handleSelectCutting(cutting.id)}
                  className={`w-full rounded-3xl border p-3 text-left transition-colors ${
                    isSelected
                      ? 'border-vine-500 bg-vine-100/80 dark:border-vine-400 dark:bg-vine-800'
                      : 'border-vine-200 bg-white/80 hover:bg-vine-50 dark:border-vine-700 dark:bg-vine-900/40 dark:hover:bg-vine-800/70'
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-vine-100 dark:bg-vine-800">
                      {previewUrl ? (
                        <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Sprout className="h-8 w-8 text-vine-400 dark:text-vine-300" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-vine-500 dark:text-vine-300">
                            #{cutting.serialNumber}
                          </div>
                          <h3 className="truncate text-sm font-semibold text-vine-900 dark:text-vine-50">
                            {cutting.variety}
                          </h3>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${statusBadgeClass(cutting.status)}`}
                        >
                          {statusLabel(cutting.status)}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-vine-500 dark:text-vine-300">
                        {plantTypeLabel(cutting.plantType)}
                      </p>
                      <p className="mt-1 text-xs text-vine-500 dark:text-vine-300">
                        Ültetve: {formatDate(cutting.plantedAt)}
                      </p>
                      <p className="mt-1 text-xs text-vine-500 dark:text-vine-300">
                        {cutting.photos.length} kép
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </aside>

          <div className="rounded-3xl border border-vine-200 bg-white/80 p-5 shadow-sm dark:border-vine-700 dark:bg-vine-900/40">
            {!selectedCutting ? (
              <div className="flex min-h-72 items-center justify-center text-sm text-vine-500 dark:text-vine-300">
                Válassz egy dugványt a listából.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-[0.24em] text-vine-500 dark:text-vine-300">
                      Dugvány #{selectedCutting.serialNumber}
                    </div>
                    <h3 className="text-2xl font-semibold text-vine-900 dark:text-vine-50">
                      {selectedCutting.variety}
                    </h3>
                    <p className="mt-1 text-sm text-vine-500 dark:text-vine-300">
                      {plantTypeLabel(selectedCutting.plantType)} · Ültetve:{' '}
                      {formatDate(selectedCutting.plantedAt)}
                    </p>
                  </div>

                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass(selectedCutting.status)}`}
                  >
                    {statusLabel(selectedCutting.status)}
                  </span>
                </div>

                {isAdmin && (
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => setEditMode((current) => !current)}
                      className="rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-700 transition-colors hover:bg-vine-50 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
                    >
                      {editMode ? 'Szerkesztő bezárása' : 'Alapadatok szerkesztése'}
                    </button>
                  </div>
                )}

                {editMode && isAdmin && (
                  <form
                    onSubmit={handleEditSubmit}
                    className="rounded-2xl border border-vine-200 bg-vine-50/80 p-4 dark:border-vine-700 dark:bg-vine-800/40"
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1">
                        <span className="text-sm font-medium text-vine-700 dark:text-vine-200">
                          Sorszám
                        </span>
                        <div className="rounded-xl border border-vine-200 bg-vine-50 px-3 py-2 text-sm font-semibold text-vine-900 dark:border-vine-700 dark:bg-vine-800 dark:text-vine-50">
                          #{selectedCutting.serialNumber}
                        </div>
                      </div>

                      <label className="space-y-1">
                        <span className="text-sm font-medium text-vine-700 dark:text-vine-200">
                          Fajta
                        </span>
                        <input
                          list="known-grape-varieties"
                          value={editState.variety}
                          onChange={(event) =>
                            setEditState((current) => ({ ...current, variety: event.target.value }))
                          }
                          className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none transition-colors focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
                        />
                      </label>

                      <label className="space-y-1">
                        <span className="text-sm font-medium text-vine-700 dark:text-vine-200">
                          Típus
                        </span>
                        <select
                          value={editState.plantType}
                          onChange={(event) =>
                            setEditState((current) => ({
                              ...current,
                              plantType: event.target.value as CreateFormState['plantType'],
                            }))
                          }
                          className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none transition-colors focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
                        >
                          <option value="cutting">Dugvány</option>
                          <option value="graft">Oltvány</option>
                        </select>
                      </label>

                      <label className="space-y-1">
                        <span className="text-sm font-medium text-vine-700 dark:text-vine-200">
                          Ültetés dátuma
                        </span>
                        <input
                          type="date"
                          value={editState.plantedAt}
                          onChange={(event) =>
                            setEditState((current) => ({ ...current, plantedAt: event.target.value }))
                          }
                          className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none transition-colors focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
                        />
                      </label>

                      <label className="space-y-1">
                        <span className="text-sm font-medium text-vine-700 dark:text-vine-200">
                          Állapot
                        </span>
                        <select
                          value={editState.status}
                          onChange={(event) =>
                            setEditState((current) => ({
                              ...current,
                              status: event.target.value as CuttingStatus,
                            }))
                          }
                          className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none transition-colors focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
                        >
                          <option value="active">Aktív</option>
                          <option value="rooted">Begyökeresedett</option>
                          <option value="lost">Elveszett</option>
                          <option value="archived">Archivált</option>
                        </select>
                      </label>
                    </div>

                    <label className="mt-4 block space-y-1">
                      <span className="text-sm font-medium text-vine-700 dark:text-vine-200">
                        Jegyzet
                      </span>
                      <textarea
                        value={editState.notes}
                        onChange={(event) =>
                          setEditState((current) => ({ ...current, notes: event.target.value }))
                        }
                        rows={3}
                        className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none transition-colors focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
                      />
                    </label>

                    {editError && (
                      <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                        {editError}
                      </div>
                    )}

                    <div className="mt-4 flex items-center gap-3">
                      <button
                        type="submit"
                        disabled={editSaving}
                        className="inline-flex items-center gap-2 rounded-xl bg-vine-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-vine-700 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {editSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                        Mentés
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditMode(false);
                          setEditError(null);
                          setEditState({
                            variety: selectedCutting.variety,
                            plantType: selectedCutting.plantType,
                            plantedAt: toDateInputValue(selectedCutting.plantedAt),
                            status: selectedCutting.status,
                            notes: selectedCutting.notes,
                          });
                        }}
                        className="rounded-xl border border-vine-200 bg-white px-4 py-2 text-sm text-vine-700 transition-colors hover:bg-vine-50 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
                      >
                        Mégse
                      </button>
                    </div>
                  </form>
                )}

                {selectedCutting.notes && (
                  <div className="rounded-2xl bg-vine-50 px-4 py-3 text-sm text-vine-700 dark:bg-vine-800/60 dark:text-vine-100">
                    {selectedCutting.notes}
                  </div>
                )}

                <section className="space-y-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-vine-700 dark:text-vine-200">
                      <Sprout className="h-4 w-4" />
                      Fotók
                    </div>

                    {isAdmin && (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          ref={detailFileInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(event) => void handleAddPhotos(event.target.files)}
                          className="hidden"
                        />
                        {isMobile ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openPicker(detailFileInputRef, 'camera')}
                              disabled={photoUploading}
                              className="inline-flex items-center gap-2 rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-700 transition-colors hover:bg-vine-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
                            >
                              {photoUploading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Camera className="h-4 w-4" />
                              )}
                              Fotózás
                            </button>
                            <button
                              type="button"
                              onClick={() => openPicker(detailFileInputRef, 'gallery')}
                              disabled={photoUploading}
                              className="inline-flex items-center gap-2 rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-700 transition-colors hover:bg-vine-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
                            >
                              <ImagePlus className="h-4 w-4" />
                              Galéria
                            </button>
                          </>
                        ) : (
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-700 transition-colors hover:bg-vine-50 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800">
                            {photoUploading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ImagePlus className="h-4 w-4" />
                            )}
                            Fotó hozzáadása
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={(event) => void handleAddPhotos(event.target.files)}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                    )}
                  </div>

                  {photoActionError && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                      {photoActionError}
                    </div>
                  )}

                  {selectedCutting.photos.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-vine-300 px-4 py-8 text-center text-sm text-vine-500 dark:border-vine-700 dark:text-vine-300">
                      Ehhez a dugványhoz még nincs feltöltött kép.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activePhoto && (
                        <div className="overflow-hidden rounded-3xl border border-vine-200 bg-vine-50 dark:border-vine-700 dark:bg-vine-800/50">
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => {
                                setIsPhotoViewerOpen(true);
                                resetPhotoViewerTransform();
                              }}
                              className="group block w-full text-left"
                              title="Teljes képernyős nézet"
                            >
                              <img
                                src={activePhoto.downloadUrl}
                                alt={selectedCutting.variety}
                                className="h-72 w-full object-cover transition-transform duration-200 group-hover:scale-[1.01] sm:h-80"
                              />
                            </button>

                            {totalPhotos > 1 && (
                              <>
                                <button
                                  type="button"
                                  onClick={goToPreviousPhoto}
                                  className="absolute left-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/45 text-white transition-colors hover:bg-black/60"
                                  aria-label="Előző kép"
                                >
                                  <ChevronLeft className="h-5 w-5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={goToNextPhoto}
                                  className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/45 text-white transition-colors hover:bg-black/60"
                                  aria-label="Következő kép"
                                >
                                  <ChevronRight className="h-5 w-5" />
                                </button>
                              </>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-3 px-4 py-3 text-xs text-vine-500 dark:text-vine-300">
                            <div className="flex items-center gap-3">
                              <span>
                                Kép {activePhotoIndex + 1}/{totalPhotos}
                              </span>
                              <span>
                                Dátum: {formatDateTime(activePhoto.capturedAt ?? activePhoto.uploadedAt)}
                              </span>
                            </div>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => void handleDeletePhoto(activePhoto)}
                                disabled={photoDeletingId === activePhoto.id}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-red-900 dark:bg-vine-900 dark:text-red-300 dark:hover:bg-red-950/30"
                              >
                                {photoDeletingId === activePhoto.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                                Törlés
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-6">
                        {selectedCutting.photos.map((photo) => {
                          const isActive = photo.id === activePhoto?.id;

                          return (
                            <button
                              key={photo.id}
                              type="button"
                              onClick={() => setActivePhotoId(photo.id)}
                              className={`relative overflow-hidden rounded-2xl border text-left transition-colors ${
                                isActive
                                  ? 'border-vine-500 ring-2 ring-vine-300 dark:border-vine-300 dark:ring-vine-700'
                                  : 'border-vine-200 dark:border-vine-700'
                              }`}
                            >
                              <img
                                src={photo.downloadUrl}
                                alt={selectedCutting.variety}
                                className="h-24 w-full object-cover"
                              />
                              <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                                {formatMonthDay(photo.capturedAt ?? photo.uploadedAt)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </section>

                {isPhotoViewerOpen && activePhoto && (
                  <div
                    className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4"
                    onClick={() => setIsPhotoViewerOpen(false)}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setIsPhotoViewerOpen(false);
                        resetPhotoViewerTransform();
                      }}
                      className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white transition-colors hover:bg-black/60"
                      aria-label="Bezárás"
                    >
                      <X className="h-5 w-5" />
                    </button>

                    <a
                      href={activePhoto.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="absolute right-16 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white transition-colors hover:bg-black/60"
                      aria-label="Megnyitás új lapon"
                      title="Megnyitás új lapon"
                    >
                      <ExternalLink className="h-5 w-5" />
                    </a>

                    <div className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-xl border border-white/30 bg-black/40 p-1 text-white">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          zoomOutPhotoViewer();
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/10"
                        aria-label="Kicsinyítés"
                        title="Kicsinyítés"
                      >
                        <SearchX className="h-4 w-4" />
                      </button>
                      <span className="px-2 text-xs tabular-nums">{Math.round(photoViewerZoom * 100)}%</span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          zoomInPhotoViewer();
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/10"
                        aria-label="Nagyítás"
                        title="Nagyítás"
                      >
                        <Search className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          resetPhotoViewerTransform();
                        }}
                        className="rounded-lg px-2 py-1 text-xs transition-colors hover:bg-white/10"
                        aria-label="Nagyítás visszaállítása"
                        title="Nagyítás visszaállítása"
                      >
                        Reset
                      </button>
                    </div>

                    {totalPhotos > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            goToPreviousPhoto();
                          }}
                          className="absolute left-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white transition-colors hover:bg-black/60"
                          aria-label="Előző kép"
                        >
                          <ChevronLeft className="h-6 w-6" />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            goToNextPhoto();
                          }}
                          className="absolute right-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white transition-colors hover:bg-black/60"
                          aria-label="Következő kép"
                        >
                          <ChevronRight className="h-6 w-6" />
                        </button>
                      </>
                    )}

                    <div
                      className="flex h-[calc(100vh-96px)] w-[calc(100vw-80px)] cursor-default items-center justify-center overflow-hidden"
                      onClick={(event) => event.stopPropagation()}
                      onWheel={(event) => {
                        event.stopPropagation();
                        event.preventDefault();
                        const direction = event.deltaY > 0 ? -0.15 : 0.15;
                        setPhotoViewerZoomWithReset(photoViewerZoom + direction);
                      }}
                      onMouseDown={(event) => {
                        if (photoViewerZoom <= 1) {
                          return;
                        }
                        event.preventDefault();
                        setIsPhotoViewerDragging(true);
                        setPhotoViewerDragStart({
                          x: event.clientX - photoViewerOffset.x,
                          y: event.clientY - photoViewerOffset.y,
                        });
                      }}
                      onMouseMove={(event) => {
                        if (!isPhotoViewerDragging || photoViewerZoom <= 1) {
                          return;
                        }
                        setPhotoViewerOffset({
                          x: event.clientX - photoViewerDragStart.x,
                          y: event.clientY - photoViewerDragStart.y,
                        });
                      }}
                      onMouseUp={() => setIsPhotoViewerDragging(false)}
                      onMouseLeave={() => setIsPhotoViewerDragging(false)}
                    >
                      <img
                        src={activePhoto.downloadUrl}
                        alt={selectedCutting.variety}
                        className={`max-h-full max-w-full rounded-2xl object-contain ${
                          photoViewerZoom > 1 ? 'cursor-grab' : ''
                        } ${isPhotoViewerDragging ? 'cursor-grabbing' : ''}`}
                        style={{
                          transform: `translate(${photoViewerOffset.x}px, ${photoViewerOffset.y}px) scale(${photoViewerZoom})`,
                          transformOrigin: 'center center',
                          transition: isPhotoViewerDragging ? 'none' : 'transform 160ms ease-out',
                        }}
                        draggable={false}
                      />
                    </div>

                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-xl border border-white/20 bg-black/45 px-4 py-2 text-xs text-white">
                      Kép {activePhotoIndex + 1}/{totalPhotos} • Dátum:{' '}
                      {formatDateTime(activePhoto.capturedAt ?? activePhoto.uploadedAt)}
                    </div>
                  </div>
                )}

                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-vine-700 dark:text-vine-200">
                    <CalendarDays className="h-4 w-4" />
                    Esemény napló
                  </div>

                  {isAdmin && (
                    <form
                      onSubmit={handleAddEvent}
                      className="rounded-2xl border border-vine-200 bg-vine-50/80 p-4 dark:border-vine-700 dark:bg-vine-800/40"
                    >
                      <div className="grid gap-3 md:grid-cols-[220px_220px_minmax(0,1fr)]">
                        <label className="space-y-1">
                          <span className="text-xs font-medium text-vine-700 dark:text-vine-200">
                            Időpont
                          </span>
                          <input
                            type="datetime-local"
                            value={eventAt}
                            onChange={(event) => setEventAt(event.target.value)}
                            className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none transition-colors focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
                          />
                        </label>

                        <label className="space-y-1">
                          <span className="text-xs font-medium text-vine-700 dark:text-vine-200">
                            Cím
                          </span>
                          <input
                            value={eventTitle}
                            onChange={(event) => setEventTitle(event.target.value)}
                            placeholder="pl. Permetezés"
                            className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none transition-colors focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
                          />
                        </label>

                        <label className="space-y-1">
                          <span className="text-xs font-medium text-vine-700 dark:text-vine-200">
                            Jegyzet
                          </span>
                          <input
                            value={eventNotes}
                            onChange={(event) => setEventNotes(event.target.value)}
                            placeholder="pl. lombtrágya kijuttatva"
                            className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none transition-colors focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
                          />
                        </label>
                      </div>

                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-vine-700 dark:text-vine-200">
                            Érintett dugványok
                          </span>
                          <div className="flex items-center gap-2 text-xs">
                            <button
                              type="button"
                              onClick={() => setTargetCuttingIds(cuttings.map((cutting) => cutting.id))}
                              className="rounded-lg border border-vine-200 bg-white px-2 py-1 text-vine-700 transition-colors hover:bg-vine-50 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
                            >
                              Mind
                            </button>
                            <button
                              type="button"
                              onClick={() => setTargetCuttingIds([])}
                              className="rounded-lg border border-vine-200 bg-white px-2 py-1 text-vine-700 transition-colors hover:bg-vine-50 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
                            >
                              Törlés
                            </button>
                          </div>
                        </div>

                        <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-vine-200 bg-white p-2 dark:border-vine-700 dark:bg-vine-900">
                          {cuttings.map((cutting) => (
                            <label
                              key={cutting.id}
                              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm text-vine-800 hover:bg-vine-50 dark:text-vine-100 dark:hover:bg-vine-800"
                            >
                              <input
                                type="checkbox"
                                checked={targetCuttingIds.includes(cutting.id)}
                                onChange={() => toggleTargetCutting(cutting.id)}
                                className="h-4 w-4 rounded border-vine-300 text-vine-600 focus:ring-vine-500"
                              />
                              <span>
                                #{cutting.serialNumber} - {cutting.variety}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-3">
                        <button
                          type="submit"
                          disabled={eventSaving}
                          className="inline-flex items-center gap-2 rounded-xl bg-vine-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-vine-700 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {eventSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                          Esemény mentése ({targetCuttingIds.length})
                        </button>
                        <span className="text-xs text-vine-500 dark:text-vine-300">
                          Tömeges mentés több dugványra.
                        </span>
                      </div>

                      {eventError && (
                        <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                          {eventError}
                        </div>
                      )}
                    </form>
                  )}

                  {selectedCutting.events.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-vine-300 px-4 py-6 text-sm text-vine-500 dark:border-vine-700 dark:text-vine-300">
                      Még nincs esemény bejegyzés.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {[...selectedCutting.events]
                        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
                        .map((log) => {
                          const isEditing = editingEventId === log.id;

                          return (
                            <div
                              key={log.id}
                              className="rounded-2xl bg-vine-50 px-4 py-3 text-sm text-vine-700 dark:bg-vine-800/50 dark:text-vine-100"
                            >
                              {isEditing && isAdmin ? (
                                <form onSubmit={handleEditEvent} className="space-y-3">
                                  <div className="grid gap-3 md:grid-cols-[220px_220px_minmax(0,1fr)]">
                                    <label className="space-y-1">
                                      <span className="text-xs font-medium text-vine-700 dark:text-vine-200">
                                        Időpont
                                      </span>
                                      <input
                                        type="datetime-local"
                                        value={editingEventAt}
                                        onChange={(event) => setEditingEventAt(event.target.value)}
                                        className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none transition-colors focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
                                      />
                                    </label>

                                    <label className="space-y-1">
                                      <span className="text-xs font-medium text-vine-700 dark:text-vine-200">
                                        Cím
                                      </span>
                                      <input
                                        value={editingEventTitle}
                                        onChange={(event) => setEditingEventTitle(event.target.value)}
                                        className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none transition-colors focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
                                      />
                                    </label>

                                    <label className="space-y-1">
                                      <span className="text-xs font-medium text-vine-700 dark:text-vine-200">
                                        Jegyzet
                                      </span>
                                      <input
                                        value={editingEventNotes}
                                        onChange={(event) => setEditingEventNotes(event.target.value)}
                                        className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none transition-colors focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
                                      />
                                    </label>
                                  </div>

                                  {editingEventError && (
                                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                                      {editingEventError}
                                    </div>
                                  )}

                                  <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      type="submit"
                                      disabled={editingEventSaving}
                                      className="inline-flex items-center gap-2 rounded-xl bg-vine-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-vine-700 disabled:cursor-not-allowed disabled:opacity-70"
                                    >
                                      {editingEventSaving && (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      )}
                                      Mentés
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingEventId(null);
                                        setEditingEventTitle('');
                                        setEditingEventError(null);
                                      }}
                                      className="rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-700 transition-colors hover:bg-vine-50 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
                                    >
                                      Mégse
                                    </button>
                                  </div>
                                </form>
                              ) : (
                                <>
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <div className="font-semibold">{log.title || 'Esemény'}</div>
                                      <div className="font-medium">{formatDateTime(log.occurredAt)}</div>
                                      {log.notes && (
                                        <div className="mt-1 text-vine-500 dark:text-vine-300">
                                          {log.notes}
                                        </div>
                                      )}
                                    </div>

                                    {isAdmin && (
                                      <div className="flex shrink-0 items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => startEditingEvent(log)}
                                          className="rounded-lg border border-vine-200 bg-white px-2.5 py-1.5 text-xs font-medium text-vine-700 transition-colors hover:bg-vine-100 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
                                        >
                                          Szerkesztés
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void handleDeleteEvent(log.id)}
                                          disabled={eventDeletingId === log.id}
                                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-red-900 dark:bg-vine-900 dark:text-red-300 dark:hover:bg-red-950/30"
                                        >
                                          {eventDeletingId === log.id ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                          ) : (
                                            <Trash2 className="h-3.5 w-3.5" />
                                          )}
                                          Törlés
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
