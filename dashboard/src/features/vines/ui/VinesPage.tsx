import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useCuttingsQuery } from '../../../hooks/queries/useCuttingsQuery';
import {
  DEFAULT_VINE_LIST_STATE,
  parseVineListState,
  selectVisibleVines,
  serializeVineListState,
  type VineListState,
} from '../listState';
import {
  toVineEventInput,
  toVineInput,
  type VineEventFormValues,
  type VineFormValues,
} from '../forms';
import { getNextVineSerialNumber, useVineCatalog } from '../useVineCatalog';
import { getLatestVineLocation } from '../vineLocations';
import { useVinePhotoUploadQueue } from '../vinePhotoUploadQueueContext';
import { VineDetail } from './VineDetail';
import { VineForm, type VineCuttingOption } from './VineForm';
import { VineListFilters } from './VineListFilters';
import { VinesList } from './VinesList';

const DEFAULT_FORM_VALUES: VineFormValues = {
  variety: '',
  hasFruited: false,
  rootType: 'unknown',
  rootstockVariety: '',
  plantingDatePrecision: 'unknown',
  plantingDate: '',
  plantingYear: '',
  location: '',
  areaDescription: '',
  status: 'active',
  tags: '',
  notes: '',
  sourceCuttingId: '',
};

function vineIdFromPath(pathname: string): string | null {
  if (!pathname.startsWith('/tokek/')) return null;
  return decodeURIComponent(pathname.slice('/tokek/'.length).split('/')[0] ?? '') || null;
}

function vinePath(vineId: string | null): string {
  return vineId ? `/tokek/${encodeURIComponent(vineId)}` : '/tokek';
}

function replaceUrl(vineId: string | null, state: VineListState) {
  const nextUrl = `${vinePath(vineId)}${serializeVineListState(state)}`;
  if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
    window.history.replaceState({}, '', nextUrl);
  }
}

function isMobileLayoutWidth(): boolean {
  return window.matchMedia('(max-width: 1023px)').matches;
}

function uniqueSorted(values: readonly string[]): string[] {
  const unique = new Map<string, string>();
  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLocaleLowerCase('hu');
    if (trimmed && !unique.has(key)) unique.set(key, trimmed);
  }
  return [...unique.values()].sort((left, right) => left.localeCompare(right, 'hu'));
}

interface VinesPageProps {
  isAdmin: boolean;
}

export function VinesPage({ isAdmin }: VinesPageProps) {
  const catalog = useVineCatalog();
  const { queue: photoUploadQueue, jobs: photoUploadJobs } = useVinePhotoUploadQueue();
  const { data: cuttings, loading: loadingCuttings, error: cuttingsError } = useCuttingsQuery();
  const [listState, setListState] = useState<VineListState>(() =>
    parseVineListState(window.location.search),
  );
  const [selectedVineId, setSelectedVineId] = useState<string | null>(() =>
    vineIdFromPath(window.location.pathname),
  );
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(isMobileLayoutWidth);
  const [unfinishedCleanupPaths, setUnfinishedCleanupPaths] = useState<string[]>([]);

  const visibleVines = useMemo(
    () => selectVisibleVines(catalog.vines, listState),
    [catalog.vines, listState],
  );
  const routedSelectedVineId =
    !catalog.loadingVines &&
    !catalog.error &&
    selectedVineId &&
    !catalog.vines.some((vine) => vine.id === selectedVineId)
      ? null
      : selectedVineId;
  const selectedVine =
    catalog.vines.find((vine) => vine.id === routedSelectedVineId) ?? null;
  const selectedVinePendingPhotos = useMemo(
    () => photoUploadJobs.filter((job) => job.vineId === selectedVine?.id),
    [photoUploadJobs, selectedVine?.id],
  );
  const nextSerialNumber = getNextVineSerialNumber(catalog.vines);
  const knownVarieties = useMemo(
    () => uniqueSorted(catalog.vines.map((vine) => vine.variety)),
    [catalog.vines],
  );
  const knownRootstockVarieties = useMemo(
    () => uniqueSorted(catalog.vines.map((vine) => vine.rootstockVariety)),
    [catalog.vines],
  );
  const cuttingOptions = useMemo<VineCuttingOption[]>(
    () =>
      [...cuttings]
        .sort((left, right) => left.serialNumber - right.serialNumber)
        .map((cutting) => ({
          id: cutting.id,
          label: `#${cutting.serialNumber} - ${cutting.variety}`,
        })),
    [cuttings],
  );
  const createFormValues = useMemo(
    () => ({ ...DEFAULT_FORM_VALUES, location: getLatestVineLocation(catalog.vines) }),
    [catalog.vines],
  );

  const patchListState = (patch: Partial<VineListState>) => {
    setListState((current) => ({ ...current, ...patch }));
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const handleChange = () => setIsMobileLayout(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setSelectedVineId(vineIdFromPath(window.location.pathname));
      setListState(parseVineListState(window.location.search));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    replaceUrl(routedSelectedVineId, listState);
  }, [listState, routedSelectedVineId]);

  const navigateToVine = (vineId: string | null, mode: 'push' | 'replace' = 'push') => {
    const nextUrl = `${vinePath(vineId)}${serializeVineListState(listState)}`;
    if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
      window.history[mode === 'push' ? 'pushState' : 'replaceState']({}, '', nextUrl);
    }
    setSelectedVineId(vineId);
  };

  const handleCreate = async (values: VineFormValues) => {
    const { vineId } = await catalog.createVine(
      toVineInput(values, catalog.locationSuggestions),
    );
    setShowCreateForm(false);
    navigateToVine(vineId);
  };

  const handleEdit = async (vineId: string, values: VineFormValues) => {
    await catalog.editVine(vineId, toVineInput(values, catalog.locationSuggestions));
  };

  const handleAddEvents = async (targetVineIds: string[], values: VineEventFormValues) => {
    await catalog.addEvents({
      targetVineIds,
      openedVineId: selectedVine?.id,
      event: toVineEventInput(values),
    });
  };

  const handleEditEvent = async (eventId: string, values: VineEventFormValues) => {
    if (!selectedVine) return;
    await catalog.editEvent({
      vineId: selectedVine.id,
      eventId,
      event: toVineEventInput(values),
    });
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!selectedVine) return;
    await catalog.deleteEvent({ vineId: selectedVine.id, eventId });
  };

  const handleDeleteVine = async () => {
    if (!selectedVine) return;
    const vineId = selectedVine.id;
    const queuedPhotoStoragePaths = photoUploadQueue.prepareVineDeletion(vineId);
    try {
      const result = await catalog.deleteVine(vineId, queuedPhotoStoragePaths);
      setUnfinishedCleanupPaths(result.remainingStoragePaths);
      navigateToVine(null, 'replace');
    } catch (error) {
      photoUploadQueue.restoreVine(vineId);
      throw error;
    }
  };

  const retryUnfinishedCleanup = async () => {
    const result = await catalog.retryDeletedVinePhotoCleanup(unfinishedCleanupPaths);
    setUnfinishedCleanupPaths(result.remainingStoragePaths);
  };

  const handleAddPhotos = (photos: File[]) => {
    if (!selectedVine) return;
    photoUploadQueue.enqueue(selectedVine.id, photos);
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!selectedVine) return;
    await catalog.deleteVinePhoto({ vineId: selectedVine.id, photoId });
  };

  const handleEditPhotoCaption = async (photoId: string, caption: string) => {
    if (!selectedVine) return;
    await catalog.editVinePhotoCaption({ vineId: selectedVine.id, photoId, caption });
  };

  const handleSetCoverPhoto = async (photoId: string | null) => {
    if (!selectedVine) return;
    await catalog.setCoverPhoto({ vineId: selectedVine.id, photoId });
  };

  const handleOpenCutting = (cuttingId: string) => {
    window.history.pushState({}, '', `/dugvanyok/${encodeURIComponent(cuttingId)}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <section className="space-y-6" data-access-mode={isAdmin ? 'admin' : 'public'}>
      {unfinishedCleanupPaths.length > 0 && (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          <span>
            A tőke adatai törlődtek, de {unfinishedCleanupPaths.length} képobjektum eltávolítása nem sikerült.
          </span>
          <button
            type="button"
            onClick={() => void retryUnfinishedCleanup()}
            disabled={catalog.mutation.pending}
            className="shrink-0 rounded-xl border border-amber-400 bg-white px-3 py-2 font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-70 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
          >
            Képtakarítás újrapróbálása
          </button>
        </div>
      )}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-vine-900 dark:text-vine-50">Tőkék</h2>
          <p className="text-sm text-vine-500 dark:text-vine-300">
            A nyaralóban kiültetett szőlőtőkék leltára és élettörténete.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowCreateForm((open) => !open)}
            disabled={catalog.mutation.pending}
            className="inline-flex items-center gap-2 rounded-xl bg-vine-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-vine-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Plus className="h-4 w-4" />
            {showCreateForm ? 'Űrlap bezárása' : 'Új tőke'}
          </button>
        )}
      </div>

      {showCreateForm && isAdmin && (
        <VineForm
          serialNumber={nextSerialNumber}
          defaultValues={createFormValues}
          knownVarieties={knownVarieties}
          knownRootstockVarieties={knownRootstockVarieties}
          knownLocations={catalog.locationSuggestions}
          knownTags={catalog.tagSuggestions}
          cuttingOptions={cuttingOptions}
          cuttingOptionsLoading={loadingCuttings}
          cuttingOptionsError={cuttingsError}
          isPending={catalog.mutation.pending}
          submitLabel="Mentés"
          helperText="Eseményt a tőke adatlapján lehet rögzíteni."
          onSubmit={handleCreate}
          onCancel={() => setShowCreateForm(false)}
          submitError={catalog.mutation.error}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <VineListFilters
            state={listState}
            locationSuggestions={catalog.locationSuggestions}
            hasMissingLocation={catalog.vines.some((vine) => vine.location === null)}
            tagSuggestions={catalog.tagSuggestions}
            onPatch={patchListState}
            onReset={() => setListState({ ...DEFAULT_VINE_LIST_STATE })}
            resetVisible={
              !catalog.loadingVines && !catalog.error && serializeVineListState(listState) !== ''
            }
            summary={
              !catalog.loadingVines && !catalog.error
                ? `${visibleVines.length} tőke a ${catalog.vines.length} felvittből`
                : null
            }
          />

          <VinesList
            vines={visibleVines}
            selectedVineId={routedSelectedVineId}
            loading={catalog.loadingVines}
            error={catalog.error}
            hasVines={catalog.vines.length > 0}
            onSelectVine={(vineId) => navigateToVine(vineId)}
          />
        </aside>

        <VineDetail
          key={selectedVine?.id ?? 'no-selection'}
          vines={catalog.vines}
          selectedVine={selectedVine}
          knownVarieties={knownVarieties}
          knownRootstockVarieties={knownRootstockVarieties}
          knownLocations={catalog.locationSuggestions}
          knownTags={catalog.tagSuggestions}
          cuttingOptions={cuttingOptions}
          cuttingOptionsLoading={loadingCuttings}
          cuttingOptionsError={cuttingsError}
          isAdmin={isAdmin}
          isMobileLayout={isMobileLayout}
          isPending={catalog.mutation.pending}
          mutationError={catalog.mutation.error}
          pendingPhotos={selectedVinePendingPhotos}
          onClose={() => navigateToVine(null)}
          onEdit={handleEdit}
          onAddEvents={handleAddEvents}
          onEditEvent={handleEditEvent}
          onDeleteEvent={handleDeleteEvent}
          onDeleteVine={handleDeleteVine}
          onAddPhotos={handleAddPhotos}
          onDeletePhoto={handleDeletePhoto}
          onEditPhotoCaption={handleEditPhotoCaption}
          onSetCoverPhoto={handleSetCoverPhoto}
          onRetryPendingPhoto={(jobId) => photoUploadQueue.retry(jobId)}
          onCancelPendingPhoto={(jobId) => photoUploadQueue.cancel(jobId)}
          onClearMutationError={catalog.clearMutationError}
          onOpenCutting={handleOpenCutting}
        />
      </div>
    </section>
  );
}
