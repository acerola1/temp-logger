import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Loader2,
  ExternalLink,
  Trash2,
  X,
} from 'lucide-react';
import { Dialog } from '../../../components/Dialog';
import { formatDate, formatDateTime, toDateTimeLocalValue } from '../../../lib/dateFormat';
import {
  PhotoLightbox,
  PhotoPickerButtons,
  photoDisplayCaption,
  photoDisplayDateText,
  photoThumbnailUrl,
  type PhotoLightboxImage,
} from '../../photos';
import type { VineEventFormValues, VineFormValues } from '../forms';
import type { Vine, VineEvent, VinePlantingDate } from '../model';
import type { VinePhotoUploadJob } from '../vinePhotoUploadQueue';
import { resolveVineCoverPhoto, sortVinePhotos } from '../vineCoverPhoto';
import { VineEventForm } from './VineEventForm';
import { VineForm, type VineCuttingOption } from './VineForm';
import { VinePhotoSection } from './VinePhotoSection';
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
  knownLocations: readonly string[];
  knownTags: readonly string[];
  cuttingOptions: readonly VineCuttingOption[];
  cuttingOptionsLoading: boolean;
  cuttingOptionsError: string | null;
  isAdmin: boolean;
  isMobileLayout: boolean;
  isPending: boolean;
  mutationError: string | null;
  pendingPhotos: readonly VinePhotoUploadJob[];
  onClose: () => void;
  onEdit: (vineId: string, values: VineFormValues) => Promise<void>;
  onAddEvents: (targetVineIds: string[], values: VineEventFormValues) => Promise<void>;
  onEditEvent: (eventId: string, values: VineEventFormValues) => Promise<void>;
  onDeleteEvent: (eventId: string) => Promise<void>;
  onDeleteVine: () => Promise<void>;
  onAddPhotos: (photos: File[]) => void;
  onDeletePhoto: (photoId: string) => Promise<void>;
  onEditPhotoCaption: (photoId: string, caption: string) => Promise<void>;
  onSetCoverPhoto: (photoId: string | null) => Promise<void>;
  onRetryPendingPhoto: (jobId: string) => void;
  onCancelPendingPhoto: (jobId: string) => void;
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
    location: vine.location ?? '',
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
  knownLocations,
  knownTags,
  cuttingOptions,
  cuttingOptionsLoading,
  cuttingOptionsError,
  isAdmin,
  isMobileLayout,
  isPending,
  mutationError,
  pendingPhotos,
  onClose,
  onEdit,
  onAddEvents,
  onEditEvent,
  onDeleteEvent,
  onDeleteVine,
  onAddPhotos,
  onDeletePhoto,
  onEditPhotoCaption,
  onSetCoverPhoto,
  onRetryPendingPhoto,
  onCancelPendingPhoto,
  onClearMutationError,
  onOpenCutting,
}: VineDetailProps) {
  const [editMode, setEditMode] = useState(false);
  const [isAddEventFormOpen, setIsAddEventFormOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  // A feltöltési progressz és a hibaüzenet a katalógusban egy közös állapot,
  // ezért jelöljük, hogy a futó művelet fotóművelet-e: az esemény- és
  // alapadatűrlap különben a fotó hibáját is kiírná.
  const [isPhotoMutation, setIsPhotoMutation] = useState(false);
  // Egyetlen tőkére mentett esemény után felajánljuk a fotófelvételt. Ez csak
  // navigációs kényelem: a fotó nem kap eseményhivatkozást.
  const [showPhotoQuickAction, setShowPhotoQuickAction] = useState(false);
  // A fejléc borítójáról nyíló néző a teljes, rendezett tőkefotólistát lapozza —
  // ugyanabban a sorrendben, mint a galéria.
  const [coverLightboxIndex, setCoverLightboxIndex] = useState<number | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  // A veszélyzóna azonosítóhoz kötve nyílik, nem sima logikai kapcsolóval:
  // másik tőke adatlapjára váltva magától összecsukódik, így a törlés nem
  // marad nyitva egy olyan tőkén, amelyiken a felhasználó ki sem nyitotta.
  const [openDangerZoneVineId, setOpenDangerZoneVineId] = useState<string | null>(null);

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
  // A galéria, a lightbox, a lista bélyege és ez a fejléc ugyanabból a közös
  // rendezésből és feloldásból dolgozik: nem tudnak eltérő borítót mutatni.
  const sortedPhotos = useMemo(
    () => (selectedVine ? sortVinePhotos(selectedVine.photos) : []),
    [selectedVine],
  );
  const coverPhoto = useMemo(
    () => (selectedVine ? resolveVineCoverPhoto(selectedVine) : null),
    [selectedVine],
  );
  const lightboxImages = useMemo<PhotoLightboxImage[]>(
    () =>
      sortedPhotos.map((photo) => ({
        id: photo.id,
        url: photo.downloadUrl,
        alt: selectedVine?.variety ?? '',
        caption: photoDisplayCaption(photo),
      })),
    [selectedVine?.variety, sortedPhotos],
  );

  const isDangerZoneOpen = selectedVine !== null && openDangerZoneVineId === selectedVine.id;

  // Minden fotóművelet előtt átállítjuk a jelölést, hogy a progressz és az
  // esetleges hiba a fotószakaszban jelenjen meg, ne az űrlapokon.
  const runPhotoMutation = async (operation: () => Promise<void>) => {
    setIsPhotoMutation(true);
    onClearMutationError();
    await operation();
  };

  const deleteEvent = async (eventId: string) => {
    if (deletingEventId || !window.confirm('Biztosan törlöd ezt az eseményt?')) return;
    setIsPhotoMutation(false);
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

  // Az `editMode` csak a gomb állapota; a szerkesztő tényleges nyitottsága az
  // admin jogtól és a betöltött értékektől is függ. Egy jelzőn vezetjük az űrlap
  // megjelenítését és az olvasó nézet elrejtését, hogy a kettő ne csúszhasson
  // szét (pl. ha a jog elvész nyitott szerkesztő mellett).
  const isEditingBasics = editMode && isAdmin && editFormValues !== null;

  const wrapperClass = isMobileLayout
    ? 'fixed inset-0 z-[110] bg-black/65 p-3'
    : 'rounded-3xl border border-vine-200 bg-white/80 p-5 shadow-sm dark:border-vine-700 dark:bg-vine-900/40';
  const panelClass = isMobileLayout
    ? 'h-full overflow-y-auto rounded-3xl border border-vine-200 bg-white/95 p-4 shadow-xl dark:border-vine-700 dark:bg-vine-900/95'
    : '';

  return (
    <>
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

              {coverPhoto && (
                <figure className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setCoverLightboxIndex(
                        sortedPhotos.findIndex((photo) => photo.id === coverPhoto.photo.id),
                      )
                    }
                    aria-label="Borítókép megnyitása"
                    className="block w-full overflow-hidden rounded-2xl border border-vine-200 bg-vine-100 dark:border-vine-700 dark:bg-vine-800"
                  >
                    {/* Kötött magasságú, vágás nélküli keret: a telefonnal álló
                        helyzetben fotózott tőke is egészben látszik, a fekvő kép
                        nem lóg ki, és a borító mobilon sem tolja el az adatokat.
                        A forrás itt is a bélyeg: az adatlap megnyitása mobilon
                        se töltsön le nagy képet. A részletes változat egy
                        koppintásra, a képnézőben jön le — a borító ezért lágyabb
                        ebben a nagyobb keretben. */}
                    <img
                      src={photoThumbnailUrl(coverPhoto.photo)}
                      alt=""
                      className="h-48 w-full object-contain sm:h-56"
                    />
                  </button>
                  <figcaption className="text-[11px] text-vine-500 dark:text-vine-300">
                    {[
                      coverPhoto.isPinned ? 'Kijelölt borítókép' : 'Automatikus borítókép',
                      coverPhoto.photo.caption,
                      photoDisplayDateText(coverPhoto.photo),
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                  </figcaption>
                </figure>
              )}

              {/* Szerkesztés közben a metaadat-rács és a jegyzet ugyanazt az adatot
                  mutatná, amit az űrlap szerkeszthetően — ezért ilyenkor kimarad. */}
              {!isEditingBasics && (
                <>
                  <dl
                    data-testid="vine-meta"
                    className="grid gap-4 rounded-2xl bg-vine-50 px-4 py-4 sm:grid-cols-2 dark:bg-vine-800/50"
                  >
                    <MetaRow label="Telepítési idő">{formatPlantingDate(selectedVine.plantingDate)}</MetaRow>
                    <MetaRow label="Termett már">{selectedVine.hasFruited ? 'Igen' : 'Nem'}</MetaRow>
                    <MetaRow label="Alanyfajta">
                      {selectedVine.rootstockVariety || <span className="text-vine-500 dark:text-vine-300">Nincs megadva</span>}
                    </MetaRow>
                    <MetaRow label="Helyszín">
                      {selectedVine.location || <span className="text-vine-500 dark:text-vine-300">Nincs megadva</span>}
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

                  <div
                    data-testid="vine-notes"
                    className="rounded-2xl bg-vine-50 px-4 py-3 text-sm text-vine-700 dark:bg-vine-800/60 dark:text-vine-100"
                  >
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-vine-500 dark:text-vine-300">
                      Általános jegyzet
                    </div>
                    {selectedVine.notes || <span className="text-vine-500 dark:text-vine-300">Nincs jegyzet.</span>}
                  </div>
                </>
              )}

              {isAdmin && (
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setEditMode((current) => !current);
                      setIsPhotoMutation(false);
                      onClearMutationError();
                    }}
                    disabled={isPending}
                    className="rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-700 transition-colors hover:bg-vine-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
                  >
                    {editMode ? 'Szerkesztő bezárása' : 'Alapadatok szerkesztése'}
                  </button>
                </div>
              )}

              {isEditingBasics && editFormValues && (
                <VineForm
                  serialNumber={selectedVine.serialNumber}
                  defaultValues={editFormValues}
                  knownVarieties={knownVarieties}
                  knownRootstockVarieties={knownRootstockVarieties}
                  knownLocations={knownLocations}
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
                  submitError={isPhotoMutation ? null : mutationError}
                />
              )}

              <VinePhotoSection
                vine={selectedVine}
                isAdmin={isAdmin}
                isPending={isPending}
                mutationError={isPhotoMutation ? mutationError : null}
                pendingPhotos={pendingPhotos}
                onAddPhotos={onAddPhotos}
                onDeletePhoto={(photoId) => runPhotoMutation(() => onDeletePhoto(photoId))}
                onEditCaption={(photoId, caption) =>
                  runPhotoMutation(() => onEditPhotoCaption(photoId, caption))
                }
                onSetCoverPhoto={(photoId) => runPhotoMutation(() => onSetCoverPhoto(photoId))}
                onRetryPendingPhoto={onRetryPendingPhoto}
                onCancelPendingPhoto={onCancelPendingPhoto}
              />

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
                        setIsPhotoMutation(false);
                        setShowPhotoQuickAction(false);
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
                    // A jelölteket nem szűrjük elő: a célválasztó a teljes
                    // listát kapja, a szűkítés a dialógus állapotszűrőjén van
                    // (alapból `Aktív`). Így megszűnt tőke is választható, ha kell.
                    targetVines={vines}
                    tagSuggestions={knownTags}
                    initialTargetVineId={selectedVine.id}
                    isPending={isPending}
                    submitError={isPhotoMutation ? null : mutationError}
                    onSubmit={async (values, targetVineIds) => {
                      setIsPhotoMutation(false);
                      await onAddEvents(targetVineIds, values);
                      setIsAddEventFormOpen(false);
                      // A gyorsművelet a *megnyitott* tőke fotóválasztóját nyitja
                      // meg, ezért csak akkor jelenik meg, ha az esemény pontosan
                      // ide került. Több célnál a fotó tőkéje kétértelmű lenne.
                      setShowPhotoQuickAction(
                        targetVineIds.length === 1 && targetVineIds[0] === selectedVine.id,
                      );
                    }}
                    onCancel={() => {
                      setIsAddEventFormOpen(false);
                      onClearMutationError();
                    }}
                  />
                )}

                {isAdmin && showPhotoQuickAction && (
                  <div
                    role="status"
                    className="flex flex-col gap-2 rounded-2xl border border-vine-200 bg-vine-50 px-4 py-3 text-sm text-vine-700 sm:flex-row sm:items-center sm:justify-between dark:border-vine-700 dark:bg-vine-800/50 dark:text-vine-100"
                  >
                    <span>Az esemény mentve.</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <PhotoPickerButtons
                        onSelect={(photos) => {
                          setShowPhotoQuickAction(false);
                          onAddPhotos(photos);
                        }}
                        disabled={isPending}
                        singleLabel="Fotó hozzáadása ehhez a tőkéhez"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPhotoQuickAction(false)}
                        className="rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-700 transition-colors hover:bg-vine-50 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
                      >
                        Elrejtés
                      </button>
                    </div>
                  </div>
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
                              submitError={isPhotoMutation ? null : mutationError}
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
                            // Az eseménykártya nem tartalmaz fotósort és
                            // fotóműveletet: a tőke képei a `Fotók` szakaszban élnek.
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
                                  <button type="button" onClick={() => { setEditingEventId(event.id); setIsPhotoMutation(false); onClearMutationError(); }} disabled={isPending} className="rounded-lg border border-vine-200 bg-white px-2.5 py-1.5 text-xs font-medium text-vine-700 transition-colors hover:bg-vine-100 disabled:opacity-70 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800">Szerkesztés</button>
                                  <button type="button" onClick={() => void deleteEvent(event.id)} disabled={isPending || deletingEventId === event.id} className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-red-900 dark:bg-vine-900 dark:text-red-300 dark:hover:bg-red-950/30">
                                    {deletingEventId === event.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Törlés'}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              {isAdmin && selectedVine && (
                <section aria-label="Veszélyzóna">
                  {/* A törlés visszafordíthatatlan és ritka művelet, ezért
                      összecsukva, alacsony hangsúllyal ül az adatlap alján. A
                      piros figyelmeztetés csak a szándékos kinyitás után jelenik meg. */}
                  <button
                    type="button"
                    aria-expanded={isDangerZoneOpen}
                    onClick={() =>
                      setOpenDangerZoneVineId(isDangerZoneOpen ? null : selectedVine.id)
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-vine-500 transition-colors hover:bg-vine-50 hover:text-vine-700 dark:text-vine-400 dark:hover:bg-vine-800/60 dark:hover:text-vine-100"
                  >
                    {isDangerZoneOpen ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                    Veszélyzóna
                  </button>
                  {isDangerZoneOpen && (
                    <div className="mt-2 space-y-3 rounded-2xl border border-red-200 bg-red-50/70 p-4 dark:border-red-900 dark:bg-red-950/20">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-300" />
                        <p className="min-w-0 flex-1 text-sm text-red-700 dark:text-red-300">
                          A végleges törlés nem a tőke megszűnt állapota: minden adatot és képet eltávolít.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsDeleteDialogOpen(true);
                          setIsPhotoMutation(false);
                          onClearMutationError();
                        }}
                        disabled={isPending}
                        className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <Trash2 className="h-4 w-4" />
                        Tőke végleges törlése
                      </button>
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </div>

      </div>

      {/* A néző a mobil részletmodal wrapperén kívül van, hogy a benne lévő
          koppintás ne zárja be magát az adatlapot is. */}
      {coverLightboxIndex !== null && lightboxImages.length > 0 && (
        <PhotoLightbox
          images={lightboxImages}
          initialIndex={Math.max(0, coverLightboxIndex)}
          onClose={() => setCoverLightboxIndex(null)}
          label="Tőkefotók"
        />
      )}

      {isDeleteDialogOpen && selectedVine && (
        <Dialog
          label="Tőke végleges törlésének megerősítése"
          onClose={() => {
            if (!isPending) setIsDeleteDialogOpen(false);
          }}
          className="w-full max-w-lg rounded-3xl border border-red-200 bg-white p-5 shadow-xl dark:border-red-900 dark:bg-vine-900"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-lg font-semibold text-vine-900 dark:text-vine-50">
                  Végleg törlöd ezt a tőkét?
                </h3>
                <p className="mt-1 text-sm font-medium text-vine-700 dark:text-vine-200">
                  Szőlőtőke #{selectedVine.serialNumber} – {selectedVine.variety}
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-200">
              <p>A törlés eltávolítja:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>az alapadatokat és az általános jegyzeteket;</li>
                <li>az összes eseményt és eseményjegyzetet;</li>
                <li>az összes eredeti fotót és bélyegképet.</li>
              </ul>
              <p className="mt-3 font-semibold">A művelet nem vonható vissza.</p>
            </div>

            {mutationError && (
              <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                {mutationError}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsDeleteDialogOpen(false)}
                disabled={isPending}
                className="rounded-xl border border-vine-200 bg-white px-4 py-2 text-sm font-medium text-vine-700 hover:bg-vine-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
              >
                Mégse
              </button>
              <button
                type="button"
                onClick={() => {
                  void onDeleteVine().catch((error) => {
                    console.error('Vine permanent delete error:', error);
                  });
                }}
                disabled={isPending}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isPending ? 'Végleges törlés…' : 'Igen, végleg törlöm'}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
