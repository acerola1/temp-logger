import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { CalendarClock, ImagePlus, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { storage } from '../lib/firebase';
import { prepareImageUpload } from '../lib/imageUpload';
import { formatDateTime, toDateTimeLocalValue } from '../lib/dateFormat';
import { getFileExtension } from '../lib/fileUtils';
import { indexSessionEvents } from '../lib/sessionEventSequence';
import { sessionEventSchema, type SessionEventValues } from '../lib/schemas';
import type { Session, SessionEvent } from '../types/sensor';

interface SessionEventsDialogProps {
  deviceId: string;
  session: Session;
  events: SessionEvent[];
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  onClose: () => void;
  onCreateEvent: (input: SessionEventInput) => Promise<void>;
  onUpdateEvent: (eventId: string, input: SessionEventInput) => Promise<void>;
  onDeleteEvent: (eventId: string) => Promise<void>;
  onOpenEvent: (event: SessionEvent) => void;
  quickCreateRequest: { occurredAt: string; nonce: number } | null;
  onQuickCreateHandled: () => void;
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

const DEFAULT_FORM_VALUES = (): SessionEventValues => ({
  title: '',
  description: '',
  occurredAt: toDateTimeLocalValue(),
});

async function uploadEventImage(deviceId: string, sessionId: string, file: File, eventId: string) {
  const prepared = await prepareImageUpload(file);
  const extension = getFileExtension(prepared.contentType);
  const imageStoragePath = `sessions/${deviceId}/${sessionId}/events/${eventId}.${extension}`;
  const storageRef = ref(storage, imageStoragePath);

  await uploadBytes(storageRef, prepared.blob, {
    contentType: prepared.contentType,
  });

  const imageUrl = await getDownloadURL(storageRef);

  return {
    imageUrl,
    imageStoragePath,
    imageWidth: prepared.width,
    imageHeight: prepared.height,
  };
}

export function SessionEventsDialog({
  deviceId,
  session,
  events,
  loading,
  error,
  isAdmin,
  onClose,
  onCreateEvent,
  onUpdateEvent,
  onDeleteEvent,
  onOpenEvent,
  quickCreateRequest,
  onQuickCreateHandled,
}: SessionEventsDialogProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [selectedCreateFile, setSelectedCreateFile] = useState<File | null>(null);
  const [selectedEditFile, setSelectedEditFile] = useState<File | null>(null);
  const [removeEditImage, setRemoveEditImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const createFileRef = useRef<HTMLInputElement>(null);
  const editFileRef = useRef<HTMLInputElement>(null);

  const sortedEvents = indexSessionEvents(events)
    .slice()
    .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime());

  const editingEvent = sortedEvents.find((event) => event.id === editEventId) ?? null;

  const {
    register: registerCreate,
    handleSubmit: handleCreateSubmit,
    reset: resetCreate,
    setValue: setCreateValue,
    formState: { errors: createErrors },
  } = useForm<SessionEventValues>({
    resolver: zodResolver(sessionEventSchema),
    defaultValues: DEFAULT_FORM_VALUES(),
  });

  const {
    register: registerEdit,
    handleSubmit: handleEditSubmit,
    reset: resetEdit,
    formState: { errors: editErrors },
  } = useForm<SessionEventValues>({
    resolver: zodResolver(sessionEventSchema),
    defaultValues: DEFAULT_FORM_VALUES(),
  });

  useEffect(() => {
    setShowCreateForm(false);
    setEditEventId(null);
    setSelectedCreateFile(null);
    setSelectedEditFile(null);
    setRemoveEditImage(false);
    setSubmitError(null);
    resetCreate(DEFAULT_FORM_VALUES());
    resetEdit(DEFAULT_FORM_VALUES());
  }, [resetCreate, resetEdit, session.id]);

  useEffect(() => {
    if (!quickCreateRequest || !isAdmin) {
      return;
    }

    setShowCreateForm(true);
    setCreateValue('occurredAt', quickCreateRequest.occurredAt, { shouldValidate: true });
    setSubmitError(null);
    onQuickCreateHandled();
  }, [isAdmin, onQuickCreateHandled, quickCreateRequest, setCreateValue]);

  const handleCreate = async (values: SessionEventValues) => {
    if (!isAdmin) {
      setSubmitError('Csak admin hozhat létre eseményt.');
      return;
    }

    setSaving(true);
    setSubmitError(null);

    let uploadedImage:
      | { imageUrl: string; imageStoragePath: string; imageWidth: number; imageHeight: number }
      | null = null;

    try {
      const tempEventId = crypto.randomUUID();
      if (selectedCreateFile) {
        uploadedImage = await uploadEventImage(deviceId, session.id, selectedCreateFile, tempEventId);
      }

      await onCreateEvent({
        title: values.title.trim(),
        description: values.description.trim(),
        occurredAt: new Date(values.occurredAt).toISOString(),
        ...uploadedImage,
      });

      resetCreate(DEFAULT_FORM_VALUES());
      setSelectedCreateFile(null);
      setShowCreateForm(false);
    } catch (nextError) {
      console.error('Session event create error:', nextError);
      setSubmitError(nextError instanceof Error ? nextError.message : 'Nem sikerült menteni az eseményt.');
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (eventItem: SessionEvent) => {
    setEditEventId(eventItem.id);
    resetEdit({
      title: eventItem.title,
      description: eventItem.description,
      occurredAt: toDateTimeLocalValue(eventItem.occurredAt),
    });
    setSelectedEditFile(null);
    setRemoveEditImage(false);
    setSubmitError(null);
  };

  const handleUpdate = async (values: SessionEventValues) => {
    if (!isAdmin) {
      setSubmitError('Csak admin szerkeszthet eseményt.');
      return;
    }

    if (!editingEvent) {
      return;
    }

    setSaving(true);
    setSubmitError(null);

    let nextImageUrl = editingEvent.imageUrl;
    let nextImageStoragePath = editingEvent.imageStoragePath;
    let nextImageWidth = editingEvent.imageWidth;
    let nextImageHeight = editingEvent.imageHeight;

    try {
      if ((removeEditImage || selectedEditFile) && editingEvent.imageStoragePath) {
        await deleteObject(ref(storage, editingEvent.imageStoragePath));
        nextImageUrl = null;
        nextImageStoragePath = null;
        nextImageWidth = null;
        nextImageHeight = null;
      }

      if (selectedEditFile) {
        const uploadedImage = await uploadEventImage(deviceId, session.id, selectedEditFile, editingEvent.id);
        nextImageUrl = uploadedImage.imageUrl;
        nextImageStoragePath = uploadedImage.imageStoragePath;
        nextImageWidth = uploadedImage.imageWidth;
        nextImageHeight = uploadedImage.imageHeight;
      }

      await onUpdateEvent(editingEvent.id, {
        title: values.title.trim(),
        description: values.description.trim(),
        occurredAt: new Date(values.occurredAt).toISOString(),
        imageUrl: nextImageUrl,
        imageStoragePath: nextImageStoragePath,
        imageWidth: nextImageWidth,
        imageHeight: nextImageHeight,
      });

      setEditEventId(null);
      setSelectedEditFile(null);
      setRemoveEditImage(false);
      resetEdit(DEFAULT_FORM_VALUES());
    } catch (nextError) {
      console.error('Session event update error:', nextError);
      setSubmitError(nextError instanceof Error ? nextError.message : 'Nem sikerült menteni az eseményt.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (eventItem: SessionEvent) => {
    if (!isAdmin) {
      setSubmitError('Csak admin törölhet eseményt.');
      return;
    }
    const confirmed = window.confirm('Biztosan törlöd ezt a session eseményt?');
    if (!confirmed) {
      return;
    }

    setDeletingEventId(eventItem.id);
    setSubmitError(null);

    try {
      if (eventItem.imageStoragePath) {
        await deleteObject(ref(storage, eventItem.imageStoragePath));
      }

      await onDeleteEvent(eventItem.id);

      if (editEventId === eventItem.id) {
        setEditEventId(null);
        setSelectedEditFile(null);
        setRemoveEditImage(false);
        resetEdit(DEFAULT_FORM_VALUES());
      }
    } catch (nextError) {
      console.error('Session event delete error:', nextError);
      setSubmitError(nextError instanceof Error ? nextError.message : 'Nem sikerült törölni az eseményt.');
    } finally {
      setDeletingEventId(null);
    }
  };

  const createFormError =
    (createErrors.title?.message as string | undefined) ||
    (createErrors.occurredAt?.message as string | undefined) ||
    submitError;

  const editFormError =
    (editErrors.title?.message as string | undefined) ||
    (editErrors.occurredAt?.message as string | undefined) ||
    submitError;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-vine-200 bg-white shadow-2xl dark:border-vine-700 dark:bg-vine-800">
        <div className="flex items-start justify-between gap-3 border-b border-vine-100 px-5 py-4 dark:border-vine-700">
          <div>
            <h2 className="text-lg font-semibold text-vine-900 dark:text-vine-50">Session események</h2>
            <p className="mt-1 text-sm text-vine-500 dark:text-vine-300">
              {session.name} · {events.length} esemény
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 transition-colors hover:bg-vine-100 dark:hover:bg-vine-700"
          >
            <X className="h-5 w-5 text-vine-500" />
          </button>
        </div>

        <div className="max-h-[calc(90vh-76px)] overflow-y-auto p-5">
          {isAdmin && (
            <div className="mb-4 flex items-center justify-between gap-3">
              <div />
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm((current) => !current);
                  setSubmitError(null);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-vine-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-vine-700"
              >
                {!showCreateForm && <Plus className="h-4 w-4" />}
                {showCreateForm ? 'Űrlap bezárása' : 'Új esemény'}
              </button>
            </div>
          )}

          {isAdmin && showCreateForm && (
            <form
              onSubmit={handleCreateSubmit((values) => void handleCreate(values))}
              className="mb-4 space-y-3 rounded-2xl bg-vine-50/80 p-4 dark:bg-vine-900/40"
            >
              <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-vine-700 dark:text-vine-200">Időpont</span>
                  <input
                    type="datetime-local"
                    {...registerCreate('occurredAt')}
                    className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-vine-700 dark:text-vine-200">Cím</span>
                  <input
                    {...registerCreate('title')}
                    placeholder="pl. Átrakva a másik sátorba"
                    className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
                  />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-vine-700 dark:text-vine-200">Leírás</span>
                <textarea
                  {...registerCreate('description')}
                  rows={3}
                  className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
                />
              </label>

              <div className="space-y-1">
                <span className="text-xs font-medium text-vine-700 dark:text-vine-200">Kép</span>
                <div className="flex items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-700 transition-colors hover:bg-vine-100 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800">
                    <ImagePlus className="h-4 w-4" />
                    Kép kiválasztása
                    <input
                      ref={createFileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(nextEvent) => setSelectedCreateFile(nextEvent.target.files?.[0] ?? null)}
                    />
                  </label>
                  {selectedCreateFile && (
                    <span className="text-xs text-vine-500 dark:text-vine-300">{selectedCreateFile.name}</span>
                  )}
                </div>
              </div>

              {createFormError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                  {createFormError}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-vine-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-vine-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Esemény mentése
              </button>
            </form>
          )}

          {error && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center text-sm text-vine-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Session események betöltése...
            </div>
          ) : sortedEvents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-vine-300 px-4 py-6 text-sm text-vine-500 dark:border-vine-700 dark:text-vine-300">
              Ehhez a sessionhöz még nincs esemény.
            </div>
          ) : (
            <div className="space-y-3">
              {sortedEvents.map((eventItem) => {
                const isEditing = editEventId === eventItem.id;

                return (
                  <div
                    key={eventItem.id}
                    className="rounded-2xl border border-vine-200 bg-vine-50/70 px-4 py-3 dark:border-vine-700 dark:bg-vine-900/40"
                  >
                    {isEditing ? (
                      <form onSubmit={handleEditSubmit((values) => void handleUpdate(values))} className="space-y-3">
                        <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                          <label className="space-y-1">
                            <span className="text-xs font-medium text-vine-700 dark:text-vine-200">Időpont</span>
                            <input
                              type="datetime-local"
                              {...registerEdit('occurredAt')}
                              className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
                            />
                          </label>

                          <label className="space-y-1">
                            <span className="text-xs font-medium text-vine-700 dark:text-vine-200">Cím</span>
                            <input
                              {...registerEdit('title')}
                              className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
                            />
                          </label>
                        </div>

                        <label className="block space-y-1">
                          <span className="text-xs font-medium text-vine-700 dark:text-vine-200">Leírás</span>
                          <textarea
                            {...registerEdit('description')}
                            rows={3}
                            className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
                          />
                        </label>

                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-700 transition-colors hover:bg-vine-100 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800">
                              <ImagePlus className="h-4 w-4" />
                              Kép cseréje
                              <input
                                ref={editFileRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(nextEvent) => setSelectedEditFile(nextEvent.target.files?.[0] ?? null)}
                              />
                            </label>
                            {selectedEditFile && (
                              <span className="text-xs text-vine-500 dark:text-vine-300">
                                {selectedEditFile.name}
                              </span>
                            )}
                            {eventItem.imageUrl && (
                              <button
                                type="button"
                                onClick={() => setRemoveEditImage((current) => !current)}
                                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
                                  removeEditImage
                                    ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300'
                                    : 'border-vine-200 bg-white text-vine-700 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100'
                                }`}
                              >
                                <X className="h-4 w-4" />
                                {removeEditImage ? 'Képtörlés visszavonása' : 'Kép törlése'}
                              </button>
                            )}
                          </div>
                        </div>

                        {editFormError && (
                          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                            {editFormError}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center gap-2 rounded-xl bg-vine-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-vine-700 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            Mentés
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditEventId(null);
                              setSelectedEditFile(null);
                              setRemoveEditImage(false);
                              setSubmitError(null);
                              resetEdit(DEFAULT_FORM_VALUES());
                            }}
                            className="rounded-xl border border-vine-200 bg-white px-4 py-2 text-sm text-vine-700 transition-colors hover:bg-vine-100 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
                          >
                            Mégse
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <button
                          type="button"
                          onClick={() => onOpenEvent(eventItem)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex items-center gap-2 text-vine-900 dark:text-vine-50">
                            <CalendarClock className="h-4 w-4 text-vine-500" />
                            <span className="font-medium">#{eventItem.sequenceNumber} {eventItem.title}</span>
                          </div>
                          <p className="mt-1 text-xs text-vine-500 dark:text-vine-300">
                            {formatDateTime(eventItem.occurredAt)}
                          </p>
                          {eventItem.description && (
                            <p className="mt-2 line-clamp-2 text-sm text-vine-600 dark:text-vine-200">
                              {eventItem.description}
                            </p>
                          )}
                        </button>

                        <div className="flex shrink-0 items-center gap-2">
                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleStartEdit(eventItem)}
                                className="inline-flex items-center gap-1 rounded-lg border border-vine-200 bg-white px-2.5 py-1.5 text-xs font-medium text-vine-700 transition-colors hover:bg-vine-100 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Szerkesztés
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDelete(eventItem)}
                                disabled={deletingEventId === eventItem.id}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-red-900 dark:bg-vine-900 dark:text-red-300 dark:hover:bg-red-950/30"
                              >
                                {deletingEventId === eventItem.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                                Törlés
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
