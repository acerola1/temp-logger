import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarDays, ExternalLink, ImagePlus, Loader2, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { VineForm, type VineCuttingOption } from './VineForm';
import { formatDate, formatDateTime, toDateTimeLocalValue } from '../lib/dateFormat';
import { vineEventFormSchema } from '../lib/schemas';
import type { VineEventFormValues, VineFormValues } from '../types/forms';
import type { Vine, VineEvent, VineEventPhoto } from '../types/vine';
import {
  VINE_EVENT_TYPE_ICON,
  VINE_EVENT_TYPE_OPTIONS,
  formatPlantedAt,
  formatTagsInput,
  fromPlantedAt,
  parseTagsInput,
  rootstockBadgeClass,
  rootstockTypeLabel,
  toPlantedAt,
  vineEventMarkerClasses,
  vineEventTypeLabel,
  vineStatusBadgeClass,
  vineStatusLabel,
  vineTagBadgeClass,
} from './vinesViewUtils';

interface VineDetailProps {
  vines: Vine[];
  selectedVine: Vine | null;
  knownVarieties: string[];
  knownRootstockVarieties: string[];
  knownTags: string[];
  cuttingOptions: VineCuttingOption[];
  isAdmin: boolean;
  isMobileLayout: boolean;
  isUpdating: boolean;
  onCloseSelectedVine: () => void;
  onUpdateVine: (vineId: string, updates: Partial<Omit<Vine, 'id'>>) => Promise<void>;
  onOpenCutting: (cuttingId: string) => void;
  updateErrorMessage: string | null;
  onClearUpdateError: () => void;
}

const DEFAULT_EVENT_FORM_VALUES = (): VineEventFormValues => ({
  occurredAt: toDateTimeLocalValue(),
  type: 'observation',
  title: '',
  notes: '',
});

const DEFAULT_EDIT_FORM_VALUES = (vine: Vine): VineFormValues => ({
  variety: vine.variety,
  hasFruited: vine.hasFruited,
  rootstockType: vine.rootstockType,
  rootstockVariety: vine.rootstockVariety,
  ...fromPlantedAt(vine.plantedAt),
  areaDescription: vine.areaDescription,
  status: vine.status,
  tags: formatTagsInput(vine.tags),
  notes: vine.notes,
  sourceCuttingId: vine.sourceCuttingId ?? '',
});

const INPUT_CLASS =
  'w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none transition-colors focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50';
const FIELD_LABEL_CLASS = 'text-xs font-medium text-vine-700 dark:text-vine-200';

// Prototípus: a kiválasztott fájlok blob URL-t kapnak, feltöltés nélkül.
async function filesToPhotos(files: File[]): Promise<VineEventPhoto[]> {
  return Promise.all(
    files.map(
      (file) =>
        new Promise<VineEventPhoto>((resolve) => {
          const downloadUrl = URL.createObjectURL(file);
          const image = new Image();
          image.onload = () =>
            resolve({
              id: crypto.randomUUID(),
              downloadUrl,
              width: image.naturalWidth,
              height: image.naturalHeight,
            });
          image.onerror = () =>
            resolve({ id: crypto.randomUUID(), downloadUrl, width: 0, height: 0 });
          image.src = downloadUrl;
        }),
    ),
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-vine-500 dark:text-vine-300">
        {label}
      </dt>
      <dd className="text-sm text-vine-900 dark:text-vine-50">{children}</dd>
    </div>
  );
}

export function VineDetail({
  vines,
  selectedVine,
  knownVarieties,
  knownRootstockVarieties,
  knownTags,
  cuttingOptions,
  isAdmin,
  isMobileLayout,
  isUpdating,
  onCloseSelectedVine,
  onUpdateVine,
  onOpenCutting,
  updateErrorMessage,
  onClearUpdateError,
}: VineDetailProps) {
  const [editMode, setEditMode] = useState(false);
  const [isAddEventFormOpen, setIsAddEventFormOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventDeletingId, setEventDeletingId] = useState<string | null>(null);
  const [targetVineIds, setTargetVineIds] = useState<string[]>([]);
  const [newEventFiles, setNewEventFiles] = useState<File[]>([]);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const {
    register: registerAddEvent,
    handleSubmit: handleAddEventSubmit,
    reset: resetAddEventForm,
    setError: setAddEventError,
    clearErrors: clearAddEventErrors,
    watch: watchAddEvent,
    formState: { errors: addEventFormErrors },
  } = useForm<VineEventFormValues>({
    resolver: zodResolver(vineEventFormSchema),
    defaultValues: DEFAULT_EVENT_FORM_VALUES(),
  });

  const {
    register: registerEditEvent,
    handleSubmit: handleEditEventSubmit,
    reset: resetEditEventForm,
    formState: { errors: editEventFormErrors },
  } = useForm<VineEventFormValues>({
    resolver: zodResolver(vineEventFormSchema),
    defaultValues: DEFAULT_EVENT_FORM_VALUES(),
  });

  const watchedAddEventType = watchAddEvent('type');

  useEffect(() => {
    setEditMode(false);
    setEditingEventId(null);
    setIsAddEventFormOpen(false);
    setNewEventFiles([]);
    setTargetVineIds(selectedVine ? [selectedVine.id] : []);
    resetAddEventForm(DEFAULT_EVENT_FORM_VALUES());
    resetEditEventForm(DEFAULT_EVENT_FORM_VALUES());
  }, [resetAddEventForm, resetEditEventForm, selectedVine]);

  const sortedEvents = useMemo(
    () =>
      selectedVine
        ? [...selectedVine.events].sort(
            (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
          )
        : [],
    [selectedVine],
  );

  // Új esemény aktív tőkékre rögzíthető. Kivétel a most megnyitott tőke, hogy egy
  // megszűnt tőke naplója is bővíthető maradjon.
  const eventTargetVines = useMemo(
    () => vines.filter((vine) => vine.status === 'active' || vine.id === selectedVine?.id),
    [vines, selectedVine],
  );

  const selectedTargetIds = useMemo(() => {
    const selectable = new Set(eventTargetVines.map((vine) => vine.id));
    return targetVineIds.filter((id) => selectable.has(id));
  }, [eventTargetVines, targetVineIds]);

  const sourceCuttingLabel = useMemo(
    () =>
      selectedVine?.sourceCuttingId
        ? (cuttingOptions.find((option) => option.id === selectedVine.sourceCuttingId)?.label ??
          'Hivatkozott dugvány')
        : null,
    [cuttingOptions, selectedVine],
  );

  const handleEditSubmit = async (values: VineFormValues) => {
    if (!selectedVine || !isAdmin) return;

    try {
      await onUpdateVine(selectedVine.id, {
        variety: values.variety.trim(),
        hasFruited: values.hasFruited,
        rootstockType: values.rootstockType,
        rootstockVariety:
          values.rootstockType === 'grafted' ? values.rootstockVariety.trim() : '',
        plantedAt: toPlantedAt(values),
        areaDescription: values.areaDescription.trim(),
        status: values.status,
        tags: parseTagsInput(values.tags),
        notes: values.notes.trim(),
        sourceCuttingId: values.sourceCuttingId || null,
      });
      setEditMode(false);
    } catch (error) {
      console.error('Vine edit error:', error);
    }
  };

  const handleAddEvent = async (values: VineEventFormValues) => {
    if (!selectedVine || !isAdmin) return;

    const targets = eventTargetVines.filter((vine) => selectedTargetIds.includes(vine.id));
    if (targets.length === 0) {
      setAddEventError('root', { message: 'Válassz legalább egy tőkét.' });
      return;
    }

    clearAddEventErrors('root');

    try {
      const photos = await filesToPhotos(newEventFiles);
      const occurredAt = new Date(values.occurredAt).toISOString();
      const title = values.title.trim() || vineEventTypeLabel(values.type);
      const notes = values.notes.trim();

      await Promise.all(
        targets.map((vine) => {
          // Minden tőke saját eseménypéldányt kap, hogy külön szerkeszthető legyen.
          const event: VineEvent = {
            id: crypto.randomUUID(),
            type: values.type,
            occurredAt,
            title,
            notes,
            photos: photos.map((photo) => ({ ...photo, id: crypto.randomUUID() })),
          };

          return onUpdateVine(vine.id, {
            events: [...vine.events, event],
            ...(values.type === 'removal' ? { status: 'removed' as const } : {}),
          });
        }),
      );

      resetAddEventForm(DEFAULT_EVENT_FORM_VALUES());
      setNewEventFiles([]);
      setTargetVineIds([selectedVine.id]);
      setIsAddEventFormOpen(false);
    } catch (error) {
      console.error('Vine event add error:', error);
    }
  };

  const handleEditEvent = async (values: VineEventFormValues) => {
    if (!selectedVine || !isAdmin || !editingEventId) return;

    try {
      // A megszűnés esemény módosítása szándékosan nem nyúl a tőke állapotához.
      await onUpdateVine(selectedVine.id, {
        events: selectedVine.events.map((event) =>
          event.id === editingEventId
            ? {
                ...event,
                type: values.type,
                occurredAt: new Date(values.occurredAt).toISOString(),
                title: values.title.trim() || vineEventTypeLabel(values.type),
                notes: values.notes.trim(),
              }
            : event,
        ),
      });
      setEditingEventId(null);
      resetEditEventForm(DEFAULT_EVENT_FORM_VALUES());
    } catch (error) {
      console.error('Vine event edit error:', error);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!selectedVine || !isAdmin || eventDeletingId) return;
    if (!window.confirm('Biztosan törlöd ezt az eseményt a fotóival együtt?')) return;

    setEventDeletingId(eventId);
    try {
      await onUpdateVine(selectedVine.id, {
        events: selectedVine.events.filter((event) => event.id !== eventId),
      });
      if (editingEventId === eventId) {
        setEditingEventId(null);
        resetEditEventForm(DEFAULT_EVENT_FORM_VALUES());
      }
    } catch (error) {
      console.error('Vine event delete error:', error);
    } finally {
      setEventDeletingId(null);
    }
  };

  const startEditingEvent = (event: VineEvent) => {
    setEditingEventId(event.id);
    resetEditEventForm({
      occurredAt: toDateTimeLocalValue(event.occurredAt),
      type: event.type,
      title: event.title,
      notes: event.notes,
    });
  };

  const toggleTargetVine = (vineId: string) => {
    setTargetVineIds((current) =>
      current.includes(vineId) ? current.filter((id) => id !== vineId) : [...current, vineId],
    );
  };

  return (
    <div
      className={
        isMobileLayout
          ? `fixed inset-0 z-[110] bg-black/65 p-3 ${selectedVine ? 'block' : 'hidden'}`
          : 'rounded-3xl border border-vine-200 bg-white/80 p-5 shadow-sm dark:border-vine-700 dark:bg-vine-900/40'
      }
      onClick={isMobileLayout ? onCloseSelectedVine : undefined}
    >
      <div
        className={
          isMobileLayout
            ? 'h-full overflow-y-auto rounded-3xl border border-vine-200 bg-white/95 p-4 shadow-xl dark:border-vine-700 dark:bg-vine-900/95'
            : ''
        }
        onClick={isMobileLayout ? (event) => event.stopPropagation() : undefined}
      >
        {isMobileLayout && selectedVine && (
          <div className="mb-3 flex items-center justify-end">
            <button
              type="button"
              onClick={onCloseSelectedVine}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-vine-200 bg-white text-vine-700 transition-colors hover:bg-vine-50 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
              aria-label="Részletek bezárása"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {!selectedVine ? (
          !isMobileLayout && (
            <div className="flex min-h-72 items-center justify-center text-sm text-vine-500 dark:text-vine-300">
              Válassz egy tőkét a listából.
            </div>
          )
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-[0.24em] text-vine-500 dark:text-vine-300">
                  Szőlőtőke #{selectedVine.serialNumber}
                </div>
                <h3 className="text-2xl font-semibold text-vine-900 dark:text-vine-50">
                  {selectedVine.variety}
                </h3>
                <div className="mt-2 flex flex-wrap gap-1">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${rootstockBadgeClass(selectedVine.rootstockType)}`}
                  >
                    {rootstockTypeLabel(selectedVine.rootstockType)}
                  </span>
                  {selectedVine.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${vineTagBadgeClass(tag)}`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <span
                className={`inline-flex shrink-0 self-start rounded-full px-3 py-1 text-xs font-medium ${vineStatusBadgeClass(selectedVine.status)}`}
              >
                {vineStatusLabel(selectedVine.status)}
              </span>
            </div>

            <dl className="grid gap-4 rounded-2xl bg-vine-50 px-4 py-4 sm:grid-cols-2 dark:bg-vine-800/50">
              <MetaRow label="Telepítési idő">{formatPlantedAt(selectedVine.plantedAt)}</MetaRow>
              <MetaRow label="Termett már">{selectedVine.hasFruited ? 'Igen' : 'Nem'}</MetaRow>
              <MetaRow label="Alanyfajta">
                {selectedVine.rootstockVariety || (
                  <span className="text-vine-500 dark:text-vine-300">Nincs megadva</span>
                )}
              </MetaRow>
              <MetaRow label="Eredeti dugvány">
                {selectedVine.sourceCuttingId ? (
                  <button
                    type="button"
                    onClick={() => onOpenCutting(selectedVine.sourceCuttingId as string)}
                    className="inline-flex items-center gap-1 font-medium text-vine-700 underline underline-offset-2 hover:text-vine-900 dark:text-vine-200 dark:hover:text-vine-50"
                  >
                    {sourceCuttingLabel}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <span className="text-vine-500 dark:text-vine-300">Nincs hivatkozás</span>
                )}
              </MetaRow>
              <div className="sm:col-span-2">
                <MetaRow label="Területleírás">{selectedVine.areaDescription}</MetaRow>
              </div>
              <MetaRow label="Létrehozva">{formatDate(selectedVine.createdAt)}</MetaRow>
              <MetaRow label="Módosítva">{formatDateTime(selectedVine.updatedAt)}</MetaRow>
            </dl>

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
              <VineForm
                serialNumber={selectedVine.serialNumber}
                defaultValues={DEFAULT_EDIT_FORM_VALUES(selectedVine)}
                knownVarieties={knownVarieties}
                knownRootstockVarieties={knownRootstockVarieties}
                knownTags={knownTags}
                cuttingOptions={cuttingOptions}
                isPending={isUpdating}
                submitLabel="Mentés"
                onSubmit={handleEditSubmit}
                onCancel={() => {
                  setEditMode(false);
                  onClearUpdateError();
                }}
                className="rounded-2xl border border-vine-200 bg-vine-50/80 p-4 dark:border-vine-700 dark:bg-vine-800/40"
                submitError={updateErrorMessage}
              />
            )}

            {selectedVine.notes && (
              <div className="rounded-2xl bg-vine-50 px-4 py-3 text-sm text-vine-700 dark:bg-vine-800/60 dark:text-vine-100">
                {selectedVine.notes}
              </div>
            )}

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-medium text-vine-700 dark:text-vine-200">
                  <CalendarDays className="h-4 w-4" />
                  Eseménynapló
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddEventFormOpen((current) => !current);
                      onClearUpdateError();
                      clearAddEventErrors('root');
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-700 transition-colors hover:bg-vine-50 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
                  >
                    {isAddEventFormOpen ? 'Új esemény bezárása' : 'Új esemény'}
                  </button>
                )}
              </div>

              {isAdmin && isAddEventFormOpen && (
                <form
                  onSubmit={handleAddEventSubmit((values) => void handleAddEvent(values))}
                  className="rounded-2xl border border-vine-200 bg-vine-50/80 p-4 dark:border-vine-700 dark:bg-vine-800/40"
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1">
                      <span className={FIELD_LABEL_CLASS}>Típus</span>
                      <select {...registerAddEvent('type')} className={INPUT_CLASS}>
                        {VINE_EVENT_TYPE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {vineEventTypeLabel(option)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1">
                      <span className={FIELD_LABEL_CLASS}>Időpont</span>
                      <input
                        type="datetime-local"
                        {...registerAddEvent('occurredAt')}
                        className={INPUT_CLASS}
                      />
                    </label>

                    <label className="space-y-1">
                      <span className={FIELD_LABEL_CLASS}>Cím</span>
                      <input
                        {...registerAddEvent('title')}
                        placeholder={`Üresen hagyva: ${vineEventTypeLabel(watchedAddEventType)}`}
                        className={INPUT_CLASS}
                      />
                    </label>

                    <label className="space-y-1">
                      <span className={FIELD_LABEL_CLASS}>Jegyzet</span>
                      <input
                        {...registerAddEvent('notes')}
                        placeholder="pl. két csapra metszve"
                        className={INPUT_CLASS}
                      />
                    </label>
                  </div>

                  <label className="mt-3 block space-y-1">
                    <span className={FIELD_LABEL_CLASS}>Fotók</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) =>
                        setNewEventFiles(Array.from(event.target.files ?? []))
                      }
                      className="block w-full text-sm text-vine-700 dark:text-vine-200"
                    />
                    <span className="inline-flex items-center gap-1 text-xs text-vine-500 dark:text-vine-400">
                      <ImagePlus className="h-3.5 w-3.5" />
                      {newEventFiles.length > 0
                        ? `${newEventFiles.length} fotó kiválasztva`
                        : 'Prototípus: a fotók csak a böngészőben élnek, nem töltődnek fel.'}
                    </span>
                  </label>

                  {watchedAddEventType === 'removal' && (
                    <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                      A megszűnés esemény a kiválasztott tőkéket megszűnt állapotba teszi. Az
                      állapot később kézzel visszaállítható.
                    </p>
                  )}

                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={FIELD_LABEL_CLASS}>Érintett tőkék</span>
                      <div className="flex items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setTargetVineIds(eventTargetVines.map((vine) => vine.id));
                            clearAddEventErrors('root');
                          }}
                          className="rounded-lg border border-vine-200 bg-white px-2 py-1 text-vine-700 transition-colors hover:bg-vine-50 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
                        >
                          Mind
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTargetVineIds([]);
                            clearAddEventErrors('root');
                          }}
                          className="rounded-lg border border-vine-200 bg-white px-2 py-1 text-vine-700 transition-colors hover:bg-vine-50 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
                        >
                          Törlés
                        </button>
                      </div>
                    </div>

                    <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-vine-200 bg-white p-2 dark:border-vine-700 dark:bg-vine-900">
                      {eventTargetVines.map((vine) => (
                        <label
                          key={vine.id}
                          className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm text-vine-800 hover:bg-vine-50 dark:text-vine-100 dark:hover:bg-vine-800"
                        >
                          <input
                            type="checkbox"
                            checked={selectedTargetIds.includes(vine.id)}
                            onChange={() => toggleTargetVine(vine.id)}
                            className="h-4 w-4 rounded border-vine-300 text-vine-600 focus:ring-vine-500"
                          />
                          <span>
                            #{vine.serialNumber} - {vine.variety}
                          </span>
                          {vine.status !== 'active' && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${vineStatusBadgeClass(vine.status)}`}
                            >
                              {vineStatusLabel(vine.status)}
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={isUpdating}
                      className="inline-flex items-center gap-2 rounded-xl bg-vine-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-vine-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
                      Esemény mentése ({selectedTargetIds.length})
                    </button>
                    <span className="text-xs text-vine-500 dark:text-vine-300">
                      Tőkénként külön példány jön létre.
                    </span>
                  </div>

                  {(addEventFormErrors.occurredAt?.message ||
                    addEventFormErrors.root?.message ||
                    updateErrorMessage) && (
                    <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                      {addEventFormErrors.occurredAt?.message ??
                        addEventFormErrors.root?.message ??
                        updateErrorMessage}
                    </div>
                  )}
                </form>
              )}

              {sortedEvents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-vine-300 px-4 py-6 text-sm text-vine-500 dark:border-vine-700 dark:text-vine-300">
                  Még nincs esemény ehhez a tőkéhez.
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedEvents.map((event) => {
                    const isEditing = editingEventId === event.id;
                    const Icon = VINE_EVENT_TYPE_ICON[event.type];
                    const marker = vineEventMarkerClasses(event.type);

                    return (
                      <div
                        key={event.id}
                        data-testid="vine-event"
                        className="rounded-2xl bg-vine-50 px-4 py-3 text-sm text-vine-700 dark:bg-vine-800/50 dark:text-vine-100"
                      >
                        {isEditing && isAdmin ? (
                          <form
                            onSubmit={handleEditEventSubmit((values) => void handleEditEvent(values))}
                            className="space-y-3"
                          >
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="space-y-1">
                                <span className={FIELD_LABEL_CLASS}>Típus</span>
                                <select {...registerEditEvent('type')} className={INPUT_CLASS}>
                                  {VINE_EVENT_TYPE_OPTIONS.map((option) => (
                                    <option key={option} value={option}>
                                      {vineEventTypeLabel(option)}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <label className="space-y-1">
                                <span className={FIELD_LABEL_CLASS}>Időpont</span>
                                <input
                                  type="datetime-local"
                                  {...registerEditEvent('occurredAt')}
                                  className={INPUT_CLASS}
                                />
                              </label>

                              <label className="space-y-1">
                                <span className={FIELD_LABEL_CLASS}>Cím</span>
                                <input {...registerEditEvent('title')} className={INPUT_CLASS} />
                              </label>

                              <label className="space-y-1">
                                <span className={FIELD_LABEL_CLASS}>Jegyzet</span>
                                <input {...registerEditEvent('notes')} className={INPUT_CLASS} />
                              </label>
                            </div>

                            {(editEventFormErrors.occurredAt?.message || updateErrorMessage) && (
                              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                                {editEventFormErrors.occurredAt?.message ?? updateErrorMessage}
                              </div>
                            )}

                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="submit"
                                disabled={isUpdating}
                                className="inline-flex items-center gap-2 rounded-xl bg-vine-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-vine-700 disabled:cursor-not-allowed disabled:opacity-70"
                              >
                                {isUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
                                Mentés
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingEventId(null);
                                  resetEditEventForm(DEFAULT_EVENT_FORM_VALUES());
                                  onClearUpdateError();
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
                              <div className="flex min-w-0 gap-3">
                                <span
                                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${marker.dot}`}
                                >
                                  <Icon className={`h-4 w-4 ${marker.icon}`} />
                                </span>
                                <div className="min-w-0">
                                  <div className="text-xs uppercase tracking-wider text-vine-500 dark:text-vine-300">
                                    {vineEventTypeLabel(event.type)}
                                  </div>
                                  <div className="font-semibold">{event.title}</div>
                                  <div className="font-medium">{formatDateTime(event.occurredAt)}</div>
                                  {event.notes && (
                                    <div className="mt-1 text-vine-500 dark:text-vine-300">
                                      {event.notes}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {isAdmin && (
                                <div className="flex shrink-0 items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => startEditingEvent(event)}
                                    className="rounded-lg border border-vine-200 bg-white px-2.5 py-1.5 text-xs font-medium text-vine-700 transition-colors hover:bg-vine-100 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
                                  >
                                    Szerkesztés
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteEvent(event.id)}
                                    disabled={eventDeletingId === event.id}
                                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-red-900 dark:bg-vine-900 dark:text-red-300 dark:hover:bg-red-950/30"
                                  >
                                    {eventDeletingId === event.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      'Törlés'
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>

                            {event.photos.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2 pl-11">
                                {event.photos.map((photo) => (
                                  <button
                                    key={photo.id}
                                    type="button"
                                    onClick={() => setLightboxUrl(photo.downloadUrl)}
                                    className="h-20 w-20 overflow-hidden rounded-xl border border-vine-200 dark:border-vine-700"
                                  >
                                    <img
                                      src={photo.downloadUrl}
                                      alt=""
                                      className="h-full w-full object-cover"
                                    />
                                  </button>
                                ))}
                              </div>
                            )}
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

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <img src={lightboxUrl} alt="" className="max-h-full max-w-full rounded-2xl object-contain" />
        </div>
      )}
    </div>
  );
}
