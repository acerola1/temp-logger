import { useMemo, useState } from 'react';
import { CalendarDays, Loader2, ExternalLink, X } from 'lucide-react';
import { formatDate, formatDateTime, toDateTimeLocalValue } from '../../../lib/dateFormat';
import type { VineEventFormValues, VineFormValues } from '../forms';
import type { Vine, VineEvent, VinePlantingDate } from '../model';
import { VineEventForm } from './VineEventForm';
import { VineForm, type VineCuttingOption } from './VineForm';
import {
  ROOT_TYPE_PRESENTATION,
  statusBadgeClass,
  statusLabel,
  tagBadgeClass,
  VINE_EVENT_PRESENTATION,
} from './vinePresentation';

interface VineDetailProps {
  vines: readonly Vine[];
  selectedVine: Vine | null;
  knownVarieties: readonly string[];
  knownRootstockVarieties: readonly string[];
  knownTags: readonly string[];
  cuttingOptions: readonly VineCuttingOption[];
  cuttingOptionsLoading: boolean;
  cuttingOptionsError: string | null;
  isAdmin: boolean;
  isMobileLayout: boolean;
  isPending: boolean;
  uploadProgress: number | null;
  mutationError: string | null;
  onClose: () => void;
  onEdit: (vineId: string, values: VineFormValues) => Promise<void>;
  onAddEvents: (targetVineIds: string[], values: VineEventFormValues, photos: File[]) => Promise<void>;
  onEditEvent: (eventId: string, values: VineEventFormValues) => Promise<void>;
  onDeleteEvent: (eventId: string) => Promise<void>;
  onClearMutationError: () => void;
  onOpenCutting: (cuttingId: string) => void;
}

function defaultEventValues(event?: VineEvent): VineEventFormValues {
  return {
    type: event?.type ?? 'observation',
    occurredAt: toDateTimeLocalValue(event?.occurredAt),
    title: event?.title ?? '',
    notes: event?.notes ?? '',
  };
}

function formatPlantingDate(value: VinePlantingDate): string {
  if (value.precision === 'date') return formatDate(value.date);
  if (value.precision === 'year') return `${value.year}`;
  return 'Ismeretlen';
}

function toFormValues(vine: Vine): VineFormValues {
  return {
    variety: vine.variety,
    hasFruited: vine.hasFruited,
    rootType: vine.rootType,
    rootstockVariety: vine.rootstockVariety,
    plantingDatePrecision: vine.plantingDate.precision,
    plantingDate: vine.plantingDate.precision === 'date' ? vine.plantingDate.date : '',
    plantingYear: vine.plantingDate.precision === 'year' ? String(vine.plantingDate.year) : '',
    areaDescription: vine.areaDescription,
    status: vine.status,
    tags: vine.tags.join(', '),
    notes: vine.notes,
    sourceCuttingId: vine.sourceCuttingId ?? '',
  };
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
  cuttingOptionsLoading,
  cuttingOptionsError,
  isAdmin,
  isMobileLayout,
  isPending,
  uploadProgress,
  mutationError,
  onClose,
  onEdit,
  onAddEvents,
  onEditEvent,
  onDeleteEvent,
  onClearMutationError,
  onOpenCutting,
}: VineDetailProps) {
  const [editMode, setEditMode] = useState(false);
  const [isAddEventFormOpen, setIsAddEventFormOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const sourceCutting = useMemo(
    () => cuttingOptions.find((option) => option.id === selectedVine?.sourceCuttingId) ?? null,
    [cuttingOptions, selectedVine?.sourceCuttingId],
  );
  const editFormValues = useMemo(
    () => (selectedVine ? toFormValues(selectedVine) : null),
    [selectedVine],
  );
  const editCuttingOptions = useMemo(() => {
    const sourceCuttingId = selectedVine?.sourceCuttingId;
    if (!sourceCuttingId || sourceCutting) return cuttingOptions;

    const currentOption: VineCuttingOption = {
      id: sourceCuttingId,
      label: cuttingOptionsLoading
        ? 'Hivatkozott dugvány betöltése…'
        : cuttingOptionsError
          ? 'A hivatkozott dugvány nem ellenőrizhető'
          : 'A hivatkozott dugvány nem elérhető',
    };
    return [currentOption, ...cuttingOptions];
  }, [cuttingOptions, cuttingOptionsError, cuttingOptionsLoading, selectedVine?.sourceCuttingId, sourceCutting]);
  const sortedEvents = useMemo(
    () => selectedVine
      ? [...selectedVine.events].sort(
          (left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
        )
      : [],
    [selectedVine],
  );
  const eventTargetVines = useMemo(
    () => vines.filter((vine) => vine.status === 'active' || vine.id === selectedVine?.id),
    [selectedVine?.id, vines],
  );

  const deleteEvent = async (eventId: string) => {
    if (deletingEventId || !window.confirm('Biztosan törlöd ezt az eseményt a fotóival együtt?')) return;
    setDeletingEventId(eventId);
    try {
      await onDeleteEvent(eventId);
      if (editingEventId === eventId) setEditingEventId(null);
    } catch (error) {
      console.error('Vine event delete error:', error);
    } finally {
      setDeletingEventId(null);
    }
  };

  if (isMobileLayout && !selectedVine) return null;

  const wrapperClass = isMobileLayout
    ? 'fixed inset-0 z-[110] bg-black/65 p-3'
    : 'rounded-3xl border border-vine-200 bg-white/80 p-5 shadow-sm dark:border-vine-700 dark:bg-vine-900/40';
  const panelClass = isMobileLayout
    ? 'h-full overflow-y-auto rounded-3xl border border-vine-200 bg-white/95 p-4 shadow-xl dark:border-vine-700 dark:bg-vine-900/95'
    : '';

  return (
    <div
      className={wrapperClass}
      onClick={isMobileLayout && !isPending ? onClose : undefined}
      data-testid="vine-detail"
    >
      <div className={panelClass} onClick={isMobileLayout ? (event) => event.stopPropagation() : undefined}>
        {isMobileLayout && selectedVine && (
          <div className="mb-3 flex items-center justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-vine-200 bg-white text-vine-700 transition-colors hover:bg-vine-50 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
              aria-label="Részletek bezárása"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {!selectedVine ? (
          <div className="flex min-h-72 items-center justify-center text-sm text-vine-500 dark:text-vine-300">
            Válassz egy tőkét a listából.
          </div>
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
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROOT_TYPE_PRESENTATION[selectedVine.rootType].badgeClass}`}>
                    {ROOT_TYPE_PRESENTATION[selectedVine.rootType].label}
                  </span>
                  {selectedVine.tags.map((tag) => (
                    <span key={tag} className={`rounded-full px-2 py-0.5 text-xs font-medium ${tagBadgeClass(tag)}`}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <span className={`inline-flex shrink-0 self-start rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass(selectedVine.status)}`}>
                {statusLabel(selectedVine.status)}
              </span>
            </div>

            <dl className="grid gap-4 rounded-2xl bg-vine-50 px-4 py-4 sm:grid-cols-2 dark:bg-vine-800/50">
              <MetaRow label="Telepítési idő">{formatPlantingDate(selectedVine.plantingDate)}</MetaRow>
              <MetaRow label="Termett már">{selectedVine.hasFruited ? 'Igen' : 'Nem'}</MetaRow>
              <MetaRow label="Alanyfajta">
                {selectedVine.rootstockVariety || <span className="text-vine-500 dark:text-vine-300">Nincs megadva</span>}
              </MetaRow>
              <MetaRow label="Eredeti dugvány">
                {!selectedVine.sourceCuttingId ? (
                  <span className="text-vine-500 dark:text-vine-300">Nincs hivatkozás</span>
                ) : cuttingOptionsLoading ? (
                  <span role="status" className="text-vine-500 dark:text-vine-300">
                    Hivatkozott dugvány betöltése…
                  </span>
                ) : cuttingOptionsError ? (
                  <span role="alert" className="text-red-700 dark:text-red-300">
                    A hivatkozott dugvány ellenőrzése sikertelen
                  </span>
                ) : sourceCutting ? (
                  <button
                    type="button"
                    onClick={() => onOpenCutting(sourceCutting.id)}
                    className="inline-flex items-center gap-1 font-medium text-vine-700 underline underline-offset-2 hover:text-vine-900 dark:text-vine-200 dark:hover:text-vine-50"
                  >
                    {sourceCutting.label}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <span role="status" className="text-amber-700 dark:text-amber-300">
                    A hivatkozott dugvány nem elérhető
                  </span>
                )}
              </MetaRow>
              <div className="sm:col-span-2">
                <MetaRow label="Területleírás">{selectedVine.areaDescription}</MetaRow>
              </div>
              <MetaRow label="Létrehozva">{formatDateTime(selectedVine.createdAt)}</MetaRow>
              <MetaRow label="Módosítva">{formatDateTime(selectedVine.updatedAt)}</MetaRow>
            </dl>

            <div className="rounded-2xl bg-vine-50 px-4 py-3 text-sm text-vine-700 dark:bg-vine-800/60 dark:text-vine-100">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-vine-500 dark:text-vine-300">
                Általános jegyzet
              </div>
              {selectedVine.notes || <span className="text-vine-500 dark:text-vine-300">Nincs jegyzet.</span>}
            </div>

            {isAdmin && (
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setEditMode((current) => !current);
                    onClearMutationError();
                  }}
                  disabled={isPending}
                  className="rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-700 transition-colors hover:bg-vine-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
                >
                  {editMode ? 'Szerkesztő bezárása' : 'Alapadatok szerkesztése'}
                </button>
              </div>
            )}

            {editMode && isAdmin && editFormValues && (
              <VineForm
                serialNumber={selectedVine.serialNumber}
                defaultValues={editFormValues}
                knownVarieties={knownVarieties}
                knownRootstockVarieties={knownRootstockVarieties}
                knownTags={knownTags}
                cuttingOptions={editCuttingOptions}
                cuttingOptionsLoading={cuttingOptionsLoading}
                cuttingOptionsError={cuttingOptionsError}
                isPending={isPending}
                submitLabel="Mentés"
                onSubmit={async (values) => {
                  await onEdit(selectedVine.id, values);
                  setEditMode(false);
                }}
                onCancel={() => {
                  setEditMode(false);
                  onClearMutationError();
                }}
                className="rounded-2xl border border-vine-200 bg-vine-50/80 p-4 dark:border-vine-700 dark:bg-vine-800/40"
                submitError={mutationError}
              />
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
                      onClearMutationError();
                    }}
                    disabled={isPending}
                    className="inline-flex items-center gap-2 rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-700 transition-colors hover:bg-vine-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
                  >
                    {isAddEventFormOpen ? 'Új esemény bezárása' : 'Új esemény'}
                  </button>
                )}
              </div>

              {isAdmin && isAddEventFormOpen && (
                <VineEventForm
                  mode="add"
                  defaultValues={defaultEventValues()}
                  targetVines={eventTargetVines}
                  initialTargetVineId={selectedVine.id}
                  isPending={isPending}
                  uploadProgress={uploadProgress}
                  submitError={mutationError}
                  onSubmit={async (values, targetVineIds, photos) => {
                    await onAddEvents(targetVineIds, values, photos);
                    setIsAddEventFormOpen(false);
                  }}
                  onCancel={() => {
                    setIsAddEventFormOpen(false);
                    onClearMutationError();
                  }}
                />
              )}

              {sortedEvents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-vine-300 px-4 py-6 text-sm text-vine-500 dark:border-vine-700 dark:text-vine-300">
                  Még nincs esemény ehhez a tőkéhez.
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedEvents.map((event) => {
                    const presentation = VINE_EVENT_PRESENTATION[event.type];
                    const Icon = presentation.icon;
                    const isEditing = editingEventId === event.id;

                    return (
                      <article key={event.id} data-testid="vine-event" className="rounded-2xl bg-vine-50 px-4 py-3 text-sm text-vine-700 dark:bg-vine-800/50 dark:text-vine-100">
                        {isEditing && isAdmin ? (
                          <VineEventForm
                            mode="edit"
                            defaultValues={defaultEventValues(event)}
                            isPending={isPending}
                            uploadProgress={null}
                            submitError={mutationError}
                            onSubmit={async (values) => {
                              await onEditEvent(event.id, values);
                              setEditingEventId(null);
                            }}
                            onCancel={() => {
                              setEditingEventId(null);
                              onClearMutationError();
                            }}
                          />
                        ) : (
                          <>
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex min-w-0 gap-3">
                                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${presentation.markerClass}`}>
                                  <Icon className={`h-4 w-4 ${presentation.iconClass}`} />
                                </span>
                                <div className="min-w-0">
                                  <div className="text-xs uppercase tracking-wider text-vine-500 dark:text-vine-300">{presentation.label}</div>
                                  <h4 className="font-semibold">{event.title}</h4>
                                  <div className="font-medium">{formatDateTime(event.occurredAt)}</div>
                                  {event.notes && <div className="mt-1 whitespace-pre-wrap text-vine-500 dark:text-vine-300">{event.notes}</div>}
                                </div>
                              </div>

                              {isAdmin && (
                                <div className="flex shrink-0 items-center gap-2">
                                  <button type="button" onClick={() => { setEditingEventId(event.id); onClearMutationError(); }} disabled={isPending} className="rounded-lg border border-vine-200 bg-white px-2.5 py-1.5 text-xs font-medium text-vine-700 transition-colors hover:bg-vine-100 disabled:opacity-70 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800">Szerkesztés</button>
                                  <button type="button" onClick={() => void deleteEvent(event.id)} disabled={isPending || deletingEventId === event.id} className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-red-900 dark:bg-vine-900 dark:text-red-300 dark:hover:bg-red-950/30">
                                    {deletingEventId === event.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Törlés'}
                                  </button>
                                </div>
                              )}
                            </div>

                            {event.photos.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2 pl-11">
                                {event.photos.map((photo) => (
                                  <button key={photo.id} type="button" onClick={() => setLightboxUrl(photo.downloadUrl)} className="h-20 w-20 overflow-hidden rounded-xl border border-vine-200 dark:border-vine-700" aria-label={`${event.title} fotó megnyitása`}>
                                    <img src={photo.downloadUrl} alt="" width={photo.width || undefined} height={photo.height || undefined} className="h-full w-full object-cover" />
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {lightboxUrl && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4" onClick={() => setLightboxUrl(null)} role="dialog" aria-label="Eseményfotó">
          <img src={lightboxUrl} alt="" className="max-h-full max-w-full rounded-2xl object-contain" />
        </div>
      )}
    </div>
  );
}
