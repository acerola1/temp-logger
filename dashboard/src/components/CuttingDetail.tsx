import { useCallback, useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarDays, Loader2, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { CuttingForm } from './CuttingForm';
import { CuttingPhotoGallery } from './CuttingPhotoGallery';
import { CuttingTimeline } from './CuttingTimeline';
import type { TimelineSelection } from './CuttingTimeline';
import {
  categoryBadgeClass,
  eventTypeLabel,
  eventTypeStatusOnArchive,
  formatCategoriesInput,
  parseCategoriesInput,
  plantTypeLabel,
  statusBadgeClass,
  statusLabel,
  toDateInputValue,
} from './cuttingsViewUtils';
import { formatDate, formatDateTime, toDateTimeLocalValue } from '../lib/dateFormat';
import { cuttingEventFormSchema } from '../lib/schemas';
import type { Cutting, CuttingEventType, CuttingPhoto } from '../types/cutting';
import type { CuttingEventFormValues, CuttingFormValues } from '../types/forms';

const EVENT_TYPE_OPTIONS: CuttingEventType[] = [
  'watering',
  'handover',
  'planting_out',
  'perished',
];

interface CuttingDetailProps {
  cuttings: Cutting[];
  selectedCutting: Cutting | null;
  knownVarieties: string[];
  knownCategories: string[];
  isAdmin: boolean;
  isMobileLayout: boolean;
  isUpdating: boolean;
  onCloseSelectedCutting: () => void;
  onUpdateCutting: (cuttingId: string, updates: Partial<Omit<Cutting, 'id'>>) => Promise<void>;
  onAddCuttingPhotos: (cuttingId: string, photos: CuttingPhoto[]) => Promise<void>;
  onDeleteCuttingPhoto: (cuttingId: string, photoId: string) => Promise<void>;
  onEditCuttingPhotoCaption: (
    cuttingId: string,
    photoId: string,
    caption: string,
  ) => Promise<void>;
  updateErrorMessage: string | null;
  onClearUpdateError: () => void;
}

const DEFAULT_EVENT_FORM_VALUES = (): CuttingEventFormValues => ({
  occurredAt: toDateTimeLocalValue(),
  type: 'watering',
  title: '',
  notes: '',
  archive: true,
});

const DEFAULT_EDIT_FORM_VALUES = (cutting: Cutting): CuttingFormValues => ({
  variety: cutting.variety,
  plantType: cutting.plantType,
  plantedAt: toDateInputValue(cutting.plantedAt),
  status: cutting.status,
  categories: formatCategoriesInput(cutting.categories),
  notes: cutting.notes,
});

export function CuttingDetail({
  cuttings,
  selectedCutting,
  knownVarieties,
  knownCategories,
  isAdmin,
  isMobileLayout,
  isUpdating,
  onCloseSelectedCutting,
  onUpdateCutting,
  onAddCuttingPhotos,
  onDeleteCuttingPhoto,
  onEditCuttingPhotoCaption,
  updateErrorMessage,
  onClearUpdateError,
}: CuttingDetailProps) {
  const [editMode, setEditMode] = useState(false);
  const [isAddEventFormOpen, setIsAddEventFormOpen] = useState(false);
  const [eventDeletingId, setEventDeletingId] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [targetCuttingIds, setTargetCuttingIds] = useState<string[]>([]);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const {
    register: registerAddEvent,
    handleSubmit: handleAddEventSubmit,
    reset: resetAddEventForm,
    setError: setAddEventError,
    clearErrors: clearAddEventErrors,
    watch: watchAddEvent,
    formState: { errors: addEventFormErrors },
  } = useForm<CuttingEventFormValues>({
    resolver: zodResolver(cuttingEventFormSchema),
    defaultValues: DEFAULT_EVENT_FORM_VALUES(),
  });
  const watchedAddEventType = watchAddEvent('type');
  const closingStatus = eventTypeStatusOnArchive(watchedAddEventType);

  const {
    register: registerEditEvent,
    handleSubmit: handleEditEventSubmit,
    reset: resetEditEventForm,
    formState: { errors: editEventFormErrors },
  } = useForm<CuttingEventFormValues>({
    resolver: zodResolver(cuttingEventFormSchema),
    defaultValues: DEFAULT_EVENT_FORM_VALUES(),
  });

  useEffect(() => {
    if (!selectedCutting) {
      setEditMode(false);
      setEditingEventId(null);
      setTargetCuttingIds([]);
      setIsAddEventFormOpen(false);
      resetAddEventForm(DEFAULT_EVENT_FORM_VALUES());
      resetEditEventForm(DEFAULT_EVENT_FORM_VALUES());
      return;
    }

    setEditMode(false);
    setEditingEventId(null);
    setTargetCuttingIds([selectedCutting.id]);
    setIsAddEventFormOpen(false);
    resetAddEventForm(DEFAULT_EVENT_FORM_VALUES());
    resetEditEventForm(DEFAULT_EVENT_FORM_VALUES());
  }, [resetAddEventForm, resetEditEventForm, selectedCutting]);

  const sortedEvents = useMemo(
    () =>
      selectedCutting
        ? [...selectedCutting.events].sort(
            (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
          )
        : [],
    [selectedCutting],
  );

  // Új esemény csak aktív dugványra kerülhet. Kivétel a most megnyitott egyed:
  // különben egy archivált dugvány saját naplója sem bővíthető.
  const eventTargetCuttings = useMemo(
    () =>
      cuttings.filter(
        (cutting) => cutting.status === 'active' || cutting.id === selectedCutting?.id,
      ),
    [cuttings, selectedCutting],
  );

  // A kijelölés csak a listában szereplő egyedekre érvényes, így a számláló és a
  // mentés akkor is konzisztens, ha egy dugvány közben kikerült az aktívak közül.
  const selectedTargetIds = useMemo(() => {
    const selectableIds = new Set(eventTargetCuttings.map((cutting) => cutting.id));
    return targetCuttingIds.filter((id) => selectableIds.has(id));
  }, [eventTargetCuttings, targetCuttingIds]);

  const handleTimelineActiveChange = useCallback((selection: TimelineSelection | null) => {
    if (!selection?.entityId) {
      setHighlightedId(null);
      return;
    }
    setHighlightedId(selection.entityId);
  }, []);

  const handleEditSubmit = async (values: CuttingFormValues) => {
    if (!selectedCutting || !isAdmin) {
      return;
    }

    try {
      await onUpdateCutting(selectedCutting.id, {
        variety: values.variety.trim(),
        plantType: values.plantType,
        plantedAt: values.plantedAt,
        status: values.status,
        categories: parseCategoriesInput(values.categories),
        notes: values.notes.trim(),
      });
      setEditMode(false);
    } catch (error) {
      console.error('Cutting edit error:', error);
    }
  };

  const handleAddEvent = async (values: CuttingEventFormValues) => {
    if (!selectedCutting || !isAdmin) {
      return;
    }

    const targetCuttings = eventTargetCuttings.filter((cutting) =>
      selectedTargetIds.includes(cutting.id),
    );

    if (targetCuttings.length === 0) {
      setAddEventError('root', { message: 'Válassz legalább egy dugványt.' });
      return;
    }

    clearAddEventErrors('root');

    try {
      const sharedEvent = {
        id: crypto.randomUUID(),
        occurredAt: new Date(values.occurredAt).toISOString(),
        type: values.type,
        title: values.title.trim() || eventTypeLabel(values.type),
        notes: values.notes.trim(),
      };
      const nextStatus = values.archive ? eventTypeStatusOnArchive(values.type) : null;

      await Promise.all(
        targetCuttings.map((cutting) =>
          onUpdateCutting(cutting.id, {
            events: [...cutting.events, sharedEvent],
            ...(nextStatus ? { status: nextStatus } : {}),
          }),
        ),
      );

      resetAddEventForm(DEFAULT_EVENT_FORM_VALUES());
      setTargetCuttingIds([selectedCutting.id]);
      setIsAddEventFormOpen(false);
    } catch (error) {
      console.error('Cutting event add error:', error);
    }
  };

  const startEditingEvent = (eventItem: {
    id: string;
    occurredAt: string;
    type: CuttingEventType;
    title: string;
    notes: string;
  }) => {
    setEditingEventId(eventItem.id);
    resetEditEventForm({
      occurredAt: toDateTimeLocalValue(eventItem.occurredAt),
      type: eventItem.type,
      title: eventItem.title,
      notes: eventItem.notes,
      archive: false,
    });
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

    try {
      await onUpdateCutting(selectedCutting.id, {
        events: selectedCutting.events.filter((item) => item.id !== eventId),
      });

      if (editingEventId === eventId) {
        setEditingEventId(null);
        resetEditEventForm(DEFAULT_EVENT_FORM_VALUES());
      }
    } catch (error) {
      console.error('Cutting event delete error:', error);
    } finally {
      setEventDeletingId(null);
    }
  };

  const handleEditEvent = async (values: CuttingEventFormValues) => {
    if (!selectedCutting || !isAdmin || !editingEventId) {
      return;
    }

    try {
      await onUpdateCutting(selectedCutting.id, {
        events: selectedCutting.events.map((eventItem) =>
          eventItem.id === editingEventId
            ? {
                ...eventItem,
                occurredAt: new Date(values.occurredAt).toISOString(),
                type: values.type,
                title: values.title.trim() || eventTypeLabel(values.type),
                notes: values.notes.trim(),
              }
            : eventItem,
        ),
      });
      setEditingEventId(null);
      resetEditEventForm(DEFAULT_EVENT_FORM_VALUES());
    } catch (error) {
      console.error('Cutting event edit error:', error);
    }
  };

  const toggleTargetCutting = (cuttingId: string) => {
    setTargetCuttingIds((current) =>
      current.includes(cuttingId)
        ? current.filter((id) => id !== cuttingId)
        : [...current, cuttingId],
    );
  };

  return (
    <div
      className={
        isMobileLayout
          ? `fixed inset-0 z-[110] bg-black/65 p-3 ${selectedCutting ? 'block' : 'hidden'}`
          : 'rounded-3xl border border-vine-200 bg-white/80 p-5 shadow-sm dark:border-vine-700 dark:bg-vine-900/40'
      }
      onClick={isMobileLayout ? onCloseSelectedCutting : undefined}
    >
      <div
        className={
          isMobileLayout
            ? 'h-full overflow-y-auto rounded-3xl border border-vine-200 bg-white/95 p-4 shadow-xl dark:border-vine-700 dark:bg-vine-900/95'
            : ''
        }
        onClick={isMobileLayout ? (event) => event.stopPropagation() : undefined}
      >
        {isMobileLayout && selectedCutting && (
          <div className="mb-3 flex items-center justify-end">
            <button
              type="button"
              onClick={onCloseSelectedCutting}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-vine-200 bg-white text-vine-700 transition-colors hover:bg-vine-50 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
              aria-label="Részletek bezárása"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {!selectedCutting ? (
          !isMobileLayout && (
            <div className="flex min-h-72 items-center justify-center text-sm text-vine-500 dark:text-vine-300">
              Válassz egy dugványt a listából.
            </div>
          )
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
                  {plantTypeLabel(selectedCutting.plantType)} · Ültetve: {formatDate(selectedCutting.plantedAt)}
                </p>
                {selectedCutting.categories.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selectedCutting.categories.map((category) => (
                      <span
                        key={category}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${categoryBadgeClass(category)}`}
                      >
                        {category}
                      </span>
                    ))}
                  </div>
                )}
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
              <CuttingForm
                serialNumber={selectedCutting.serialNumber}
                defaultValues={DEFAULT_EDIT_FORM_VALUES(selectedCutting)}
                knownVarieties={knownVarieties}
                knownCategories={knownCategories}
                isPending={isUpdating}
                submitLabel="Mentés"
                showPhotoUpload={false}
                onSubmit={async (values) => handleEditSubmit(values)}
                onCancel={() => {
                  setEditMode(false);
                  onClearUpdateError();
                }}
                className="rounded-2xl border border-vine-200 bg-vine-50/80 p-4 dark:border-vine-700 dark:bg-vine-800/40"
                submitError={editMode ? updateErrorMessage : null}
              />
            )}

            {editMode && updateErrorMessage && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                {updateErrorMessage}
              </div>
            )}

            {selectedCutting.notes && (
              <div className="rounded-2xl bg-vine-50 px-4 py-3 text-sm text-vine-700 dark:bg-vine-800/60 dark:text-vine-100">
                {selectedCutting.notes}
              </div>
            )}

            <CuttingPhotoGallery
              cutting={selectedCutting}
              isAdmin={isAdmin}
              isUpdating={isUpdating}
              onAddPhotos={onAddCuttingPhotos}
              onDeletePhoto={onDeleteCuttingPhoto}
              onEditCaption={onEditCuttingPhotoCaption}
              updateErrorMessage={updateErrorMessage}
              onClearUpdateError={onClearUpdateError}
              highlightedPhotoId={highlightedId}
            />

            <CuttingTimeline cutting={selectedCutting} onActiveItemChange={handleTimelineActiveChange} />

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-medium text-vine-700 dark:text-vine-200">
                  <CalendarDays className="h-4 w-4" />
                  Esemény napló
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
                      <span className="text-xs font-medium text-vine-700 dark:text-vine-200">Típus</span>
                      <select
                        {...registerAddEvent('type')}
                        className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none transition-colors focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
                      >
                        {EVENT_TYPE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {eventTypeLabel(option)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs font-medium text-vine-700 dark:text-vine-200">Időpont</span>
                      <input
                        type="datetime-local"
                        {...registerAddEvent('occurredAt')}
                        className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none transition-colors focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs font-medium text-vine-700 dark:text-vine-200">Cím</span>
                      <input
                        {...registerAddEvent('title')}
                        placeholder={
                          watchedAddEventType === 'handover'
                            ? 'pl. Kovács Pisti'
                            : watchedAddEventType === 'planting_out'
                              ? 'pl. kerti sor 3.'
                              : watchedAddEventType === 'perished'
                                ? 'pl. kiszáradt'
                                : 'pl. Permetezés'
                        }
                        className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none transition-colors focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs font-medium text-vine-700 dark:text-vine-200">Jegyzet</span>
                      <input
                        {...registerAddEvent('notes')}
                        placeholder="pl. lombtrágya kijuttatva"
                        className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none transition-colors focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
                      />
                    </label>
                  </div>

                  {closingStatus && (
                    <label className="mt-3 flex items-center gap-2 text-sm text-vine-700 dark:text-vine-200">
                      <input
                        type="checkbox"
                        {...registerAddEvent('archive')}
                        className="h-4 w-4 rounded border-vine-300 text-vine-600 focus:ring-vine-500"
                      />
                      <span>
                        {closingStatus === 'lost'
                          ? 'Elpusztultnak jelölöm a dugványt'
                          : 'Archiválom a dugványt (kiveszem az aktív listából)'}
                      </span>
                    </label>
                  )}

                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-vine-700 dark:text-vine-200">Érintett dugványok</span>
                      <div className="flex items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setTargetCuttingIds(eventTargetCuttings.map((cutting) => cutting.id));
                            clearAddEventErrors('root');
                          }}
                          className="rounded-lg border border-vine-200 bg-white px-2 py-1 text-vine-700 transition-colors hover:bg-vine-50 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
                        >
                          Mind
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTargetCuttingIds([]);
                            clearAddEventErrors('root');
                          }}
                          className="rounded-lg border border-vine-200 bg-white px-2 py-1 text-vine-700 transition-colors hover:bg-vine-50 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
                        >
                          Törlés
                        </button>
                      </div>
                    </div>

                    <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-vine-200 bg-white p-2 dark:border-vine-700 dark:bg-vine-900">
                      {eventTargetCuttings.length === 0 ? (
                        <p className="px-2 py-1 text-sm text-vine-500 dark:text-vine-300">
                          Nincs aktív dugvány, amire eseményt lehetne rögzíteni.
                        </p>
                      ) : (
                        eventTargetCuttings.map((cutting) => (
                          <label
                            key={cutting.id}
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm text-vine-800 hover:bg-vine-50 dark:text-vine-100 dark:hover:bg-vine-800"
                          >
                            <input
                              type="checkbox"
                              checked={selectedTargetIds.includes(cutting.id)}
                              onChange={() => toggleTargetCutting(cutting.id)}
                              className="h-4 w-4 rounded border-vine-300 text-vine-600 focus:ring-vine-500"
                            />
                            <span>#{cutting.serialNumber} - {cutting.variety}</span>
                            {cutting.status !== 'active' && (
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(cutting.status)}`}
                              >
                                {statusLabel(cutting.status)}
                              </span>
                            )}
                          </label>
                        ))
                      )}
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
                    <span className="text-xs text-vine-500 dark:text-vine-300">Tömeges mentés több dugványra.</span>
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
                  Még nincs esemény bejegyzés.
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedEvents.map((log) => {
                    const isEditing = editingEventId === log.id;

                    return (
                      <div
                        key={log.id}
                        data-event-id={log.id}
                        className={`rounded-2xl px-4 py-3 text-sm text-vine-700 transition-all duration-200 dark:text-vine-100 ${highlightedId === log.id ? 'bg-vine-50 ring-2 ring-blue-400 dark:bg-vine-800/50 dark:ring-blue-500/50' : 'bg-vine-50 dark:bg-vine-800/50'}`}
                      >
                        {isEditing && isAdmin ? (
                          <form
                            onSubmit={handleEditEventSubmit((values) => void handleEditEvent(values))}
                            className="space-y-3"
                          >
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="space-y-1">
                                <span className="text-xs font-medium text-vine-700 dark:text-vine-200">Típus</span>
                                <select
                                  {...registerEditEvent('type')}
                                  className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none transition-colors focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
                                >
                                  {EVENT_TYPE_OPTIONS.map((option) => (
                                    <option key={option} value={option}>
                                      {eventTypeLabel(option)}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <label className="space-y-1">
                                <span className="text-xs font-medium text-vine-700 dark:text-vine-200">Időpont</span>
                                <input
                                  type="datetime-local"
                                  {...registerEditEvent('occurredAt')}
                                  className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none transition-colors focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
                                />
                              </label>

                              <label className="space-y-1">
                                <span className="text-xs font-medium text-vine-700 dark:text-vine-200">Cím</span>
                                <input
                                  {...registerEditEvent('title')}
                                  className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none transition-colors focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
                                />
                              </label>

                              <label className="space-y-1">
                                <span className="text-xs font-medium text-vine-700 dark:text-vine-200">Jegyzet</span>
                                <input
                                  {...registerEditEvent('notes')}
                                  className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none transition-colors focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
                                />
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
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-xs uppercase tracking-wider text-vine-500 dark:text-vine-300">
                                {eventTypeLabel(log.type)}
                              </div>
                              <div className="font-semibold">{log.title || eventTypeLabel(log.type)}</div>
                              <div className="font-medium">{formatDateTime(log.occurredAt)}</div>
                              {log.notes && <div className="mt-1 text-vine-500 dark:text-vine-300">{log.notes}</div>}
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
                                    'Törlés'
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
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
  );
}
