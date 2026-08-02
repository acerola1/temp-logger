import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useCuttingsQuery } from '../../../hooks/queries/useCuttingsQuery';
import {
  DEFAULT_VINE_LIST_STATE,
  parseVineListState,
  selectVisibleVines,
  serializeVineListState,
  type VineListFruited,
  type VineListRootType,
  type VineListSort,
  type VineListState,
  type VineListStatus,
} from '../listState';
import { toVineInput, type VineFormValues } from '../forms';
import { getNextVineSerialNumber, useVineCatalog } from '../useVineCatalog';
import { VineDetail } from './VineDetail';
import { VineForm, type VineCuttingOption } from './VineForm';
import { VinesList } from './VinesList';

const SELECT_CLASS =
  'h-9 w-full rounded-lg border border-vine-200 bg-white px-2.5 text-sm text-vine-900 outline-none focus:border-vine-400 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50 dark:focus:border-vine-500';
const FILTER_FIELD_CLASS = 'grid gap-1';
const FILTER_LABEL_CLASS =
  'text-[10px] font-semibold uppercase tracking-[0.14em] text-vine-500 dark:text-vine-300';

const DEFAULT_FORM_VALUES: VineFormValues = {
  variety: '',
  hasFruited: false,
  rootType: 'unknown',
  rootstockVariety: '',
  plantingDatePrecision: 'unknown',
  plantingDate: '',
  plantingYear: '',
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
  const { data: cuttings, loading: loadingCuttings, error: cuttingsError } = useCuttingsQuery();
  const [listState, setListState] = useState<VineListState>(() =>
    parseVineListState(window.location.search),
  );
  const [selectedVineId, setSelectedVineId] = useState<string | null>(() =>
    vineIdFromPath(window.location.pathname),
  );
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(isMobileLayoutWidth);

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
    const { vineId } = await catalog.createVine(toVineInput(values));
    setShowCreateForm(false);
    navigateToVine(vineId);
  };

  const handleEdit = async (vineId: string, values: VineFormValues) => {
    await catalog.editVine(vineId, toVineInput(values));
  };

  const handleOpenCutting = (cuttingId: string) => {
    window.history.pushState({}, '', `/dugvanyok/${encodeURIComponent(cuttingId)}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <section className="space-y-6" data-access-mode={isAdmin ? 'admin' : 'public'}>
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
          defaultValues={DEFAULT_FORM_VALUES}
          knownVarieties={knownVarieties}
          knownRootstockVarieties={knownRootstockVarieties}
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
          <div className="rounded-2xl border border-vine-200 bg-white/80 p-2.5 dark:border-vine-700 dark:bg-vine-900/50">
            <div className="grid gap-2">
              <label>
                <span className="sr-only">Keresés</span>
                <input
                  type="search"
                  value={listState.query}
                  onChange={(event) => patchListState({ query: event.target.value })}
                  placeholder="Fajta, # sorszám vagy terület"
                  className="h-9 w-full rounded-lg border border-vine-200 bg-white px-2.5 text-sm text-vine-900 outline-none placeholder:text-vine-400 focus:border-vine-400 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50 dark:placeholder:text-vine-400 dark:focus:border-vine-500"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className={FILTER_FIELD_CLASS}>
                  <span className={FILTER_LABEL_CLASS}>Rendezés</span>
                  <select value={listState.sort} onChange={(event) => patchListState({ sort: event.target.value as VineListSort })} className={SELECT_CLASS}>
                    <option value="updated_desc">Módosítva</option>
                    <option value="planting_desc">Telepítve</option>
                    <option value="variety_asc">Fajta neve</option>
                  </select>
                </label>
                <label className={FILTER_FIELD_CLASS}>
                  <span className={FILTER_LABEL_CLASS}>Állapot</span>
                  <select value={listState.status} onChange={(event) => patchListState({ status: event.target.value as VineListStatus })} className={SELECT_CLASS}>
                    <option value="active">Aktív</option>
                    <option value="ceased">Megszűnt</option>
                    <option value="all">Mind</option>
                  </select>
                </label>
                <label className={FILTER_FIELD_CLASS}>
                  <span className={FILTER_LABEL_CLASS}>Gyökérzet</span>
                  <select value={listState.rootType} onChange={(event) => patchListState({ rootType: event.target.value as VineListRootType })} className={SELECT_CLASS}>
                    <option value="all">Mind</option>
                    <option value="grafted">Oltott</option>
                    <option value="own_rooted">Saját gyökerű</option>
                    <option value="unknown">Ismeretlen</option>
                  </select>
                </label>
                <label className={FILTER_FIELD_CLASS}>
                  <span className={FILTER_LABEL_CLASS}>Termés</span>
                  <select value={listState.fruited} onChange={(event) => patchListState({ fruited: event.target.value as VineListFruited })} className={SELECT_CLASS}>
                    <option value="all">Mind</option>
                    <option value="yes">Termett már</option>
                    <option value="no">Még nem</option>
                  </select>
                </label>
                <label className={`col-span-2 ${FILTER_FIELD_CLASS}`}>
                  <span className={FILTER_LABEL_CLASS}>Címke</span>
                  <select value={listState.tag} onChange={(event) => patchListState({ tag: event.target.value })} className={SELECT_CLASS}>
                    <option value="">Minden címke</option>
                    {catalog.tagSuggestions.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
                  </select>
                </label>
              </div>
            </div>
          </div>

          {!catalog.loadingVines && !catalog.error && (
            <div className="flex items-center justify-between gap-2 px-1">
              <p className="text-xs text-vine-500 dark:text-vine-300">
                {visibleVines.length} tőke a {catalog.vines.length} felvittből
              </p>
              {serializeVineListState(listState) && (
                <button type="button" onClick={() => setListState({ ...DEFAULT_VINE_LIST_STATE })} className="text-xs font-medium text-vine-600 hover:text-vine-800 dark:text-vine-300 dark:hover:text-vine-100">
                  Alaphelyzet
                </button>
              )}
            </div>
          )}

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
          selectedVine={selectedVine}
          knownVarieties={knownVarieties}
          knownRootstockVarieties={knownRootstockVarieties}
          knownTags={catalog.tagSuggestions}
          cuttingOptions={cuttingOptions}
          cuttingOptionsLoading={loadingCuttings}
          cuttingOptionsError={cuttingsError}
          isAdmin={isAdmin}
          isMobileLayout={isMobileLayout}
          isPending={catalog.mutation.pending}
          mutationError={catalog.mutation.error}
          onClose={() => navigateToVine(null)}
          onEdit={handleEdit}
          onOpenCutting={handleOpenCutting}
        />
      </div>
    </section>
  );
}
