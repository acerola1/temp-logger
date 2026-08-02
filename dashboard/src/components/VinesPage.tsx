import { useEffect, useMemo, useState } from 'react';
import { FlaskConical, Plus, RotateCcw } from 'lucide-react';
import { VineDetail } from './VineDetail';
import { VineForm, type VineCuttingOption } from './VineForm';
import { VinesList } from './VinesList';
import {
  getVineIdFromPath,
  getVinePath,
  parseTagsInput,
  plantedAtSortValue,
  toPlantedAt,
} from './vinesViewUtils';
import { useMockVines } from '../hooks/useMockVines';
import { useCuttingsQuery } from '../hooks/queries/useCuttingsQuery';
import { getErrorMessage } from '../lib/errorMessage';
import type { VineFormValues } from '../types/forms';
import type { CreateVineInput, VineRootstockType, VineStatus } from '../types/vine';

type VinesSort = 'updated_desc' | 'planted_desc' | 'variety_asc';
type VinesStatusFilter = 'all' | VineStatus;
type VinesRootstockFilter = 'all' | VineRootstockType;
type VinesFruitedFilter = 'all' | 'yes' | 'no';

const DEFAULT_SORT: VinesSort = 'updated_desc';
const DEFAULT_STATUS: VinesStatusFilter = 'active';
const DEFAULT_ROOTSTOCK: VinesRootstockFilter = 'all';
const DEFAULT_FRUITED: VinesFruitedFilter = 'all';

const DEFAULT_FORM_VALUES = (): VineFormValues => ({
  variety: '',
  hasFruited: false,
  rootstockType: 'unknown',
  rootstockVariety: '',
  plantedAtPrecision: 'unknown',
  plantedAtDate: '',
  plantedAtYear: '',
  areaDescription: '',
  status: 'active',
  tags: '',
  notes: '',
  sourceCuttingId: '',
});

interface VinesFilters {
  query: string;
  status: VinesStatusFilter;
  rootstock: VinesRootstockFilter;
  tag: string;
  fruited: VinesFruitedFilter;
  sort: VinesSort;
}

function parseVinesFiltersFromSearch(search: string): VinesFilters {
  const params = new URLSearchParams(search);
  const rawStatus = params.get('status');
  const rawRootstock = params.get('rootstock');
  const rawFruited = params.get('fruited');
  const rawSort = params.get('sort');

  return {
    query: (params.get('q') ?? '').trim(),
    status:
      rawStatus === 'all' || rawStatus === 'active' || rawStatus === 'removed'
        ? rawStatus
        : DEFAULT_STATUS,
    rootstock:
      rawRootstock === 'grafted' || rawRootstock === 'own_rooted' || rawRootstock === 'unknown'
        ? rawRootstock
        : DEFAULT_ROOTSTOCK,
    tag: (params.get('tag') ?? '').trim(),
    fruited: rawFruited === 'yes' || rawFruited === 'no' ? rawFruited : DEFAULT_FRUITED,
    sort:
      rawSort === 'planted_desc' || rawSort === 'variety_asc' || rawSort === 'updated_desc'
        ? rawSort
        : DEFAULT_SORT,
  };
}

function buildVinesSearch(filters: VinesFilters): string {
  const params = new URLSearchParams();
  const trimmedQuery = filters.query.trim();
  const trimmedTag = filters.tag.trim();

  if (trimmedQuery.length > 0) params.set('q', trimmedQuery);
  if (filters.status !== DEFAULT_STATUS) params.set('status', filters.status);
  if (filters.rootstock !== DEFAULT_ROOTSTOCK) params.set('rootstock', filters.rootstock);
  if (trimmedTag.length > 0) params.set('tag', trimmedTag);
  if (filters.fruited !== DEFAULT_FRUITED) params.set('fruited', filters.fruited);
  if (filters.sort !== DEFAULT_SORT) params.set('sort', filters.sort);

  const serialized = params.toString();
  return serialized.length > 0 ? `?${serialized}` : '';
}

function isMobileLayoutWidth() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 1023px)').matches;
}

const SELECT_CLASS =
  'h-9 w-full rounded-lg border border-vine-200 bg-white px-2.5 text-sm text-vine-900 outline-none focus:border-vine-400 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50 dark:focus:border-vine-500';
const FILTER_FIELD_CLASS = 'grid gap-1';
const FILTER_LABEL_CLASS =
  'text-[10px] font-semibold uppercase tracking-[0.14em] text-vine-500 dark:text-vine-300';

export function VinesPage() {
  const {
    data: vines,
    isCreating,
    isUpdating,
    createError,
    updateError,
    resetUpdateError,
    createVine,
    updateVine,
    linkDemoCutting,
    resetMockVines,
  } = useMockVines();
  const { data: cuttings } = useCuttingsQuery();

  const [prototypeAdmin, setPrototypeAdmin] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    getVineIdFromPath(window.location.pathname),
  );
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(() => isMobileLayoutWidth());
  const [filters, setFilters] = useState<VinesFilters>(() =>
    parseVinesFiltersFromSearch(window.location.search),
  );

  const patchFilters = (patch: Partial<VinesFilters>) =>
    setFilters((current) => ({ ...current, ...patch }));

  const selectedVine = useMemo(
    () => vines.find((vine) => vine.id === selectedId) ?? null,
    [vines, selectedId],
  );

  const nextSerialNumber = useMemo(
    () => vines.reduce((maxValue, vine) => Math.max(maxValue, vine.serialNumber), 0) + 1,
    [vines],
  );

  const knownVarieties = useMemo(
    () =>
      Array.from(new Set(vines.map((vine) => vine.variety.trim()).filter(Boolean))).sort(
        (left, right) => left.localeCompare(right, 'hu'),
      ),
    [vines],
  );

  const knownRootstockVarieties = useMemo(
    () =>
      Array.from(
        new Set(vines.map((vine) => vine.rootstockVariety.trim()).filter(Boolean)),
      ).sort((left, right) => left.localeCompare(right, 'hu')),
    [vines],
  );

  // A tőkék külön címkeajánlási készletet használnak, nem a dugványokét.
  const knownTags = useMemo(
    () =>
      Array.from(
        new Set(vines.flatMap((vine) => vine.tags.map((tag) => tag.trim()).filter(Boolean))),
      ).sort((left, right) => left.localeCompare(right, 'hu')),
    [vines],
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

  const visibleVines = useMemo(() => {
    const normalizedQuery = filters.query.trim().toLocaleLowerCase('hu');

    const filtered = vines.filter((vine) => {
      if (filters.status !== 'all' && vine.status !== filters.status) return false;
      if (filters.rootstock !== 'all' && vine.rootstockType !== filters.rootstock) return false;
      if (filters.tag && !vine.tags.includes(filters.tag)) return false;
      if (filters.fruited !== 'all' && vine.hasFruited !== (filters.fruited === 'yes')) {
        return false;
      }
      if (!normalizedQuery) return true;

      return (
        vine.variety.toLocaleLowerCase('hu').includes(normalizedQuery) ||
        String(vine.serialNumber).includes(normalizedQuery) ||
        vine.areaDescription.toLocaleLowerCase('hu').includes(normalizedQuery)
      );
    });

    return [...filtered].sort((left, right) => {
      if (filters.sort === 'planted_desc') {
        return plantedAtSortValue(right.plantedAt) - plantedAtSortValue(left.plantedAt);
      }
      if (filters.sort === 'variety_asc') {
        const varietyCompare = left.variety.localeCompare(right.variety, 'hu', {
          sensitivity: 'base',
        });
        return varietyCompare !== 0 ? varietyCompare : left.serialNumber - right.serialNumber;
      }
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });
  }, [filters, vines]);

  useEffect(() => {
    const demoCuttingId = cuttingOptions[0]?.id;
    if (demoCuttingId) {
      linkDemoCutting(demoCuttingId);
    }
  }, [cuttingOptions, linkDemoCutting]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const handleChange = () => setIsMobileLayout(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setSelectedId(getVineIdFromPath(window.location.pathname));
      setFilters(parseVinesFiltersFromSearch(window.location.search));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!selectedVine) {
      if (window.location.pathname !== '/tokek') {
        window.history.replaceState({}, '', `/tokek${window.location.search}`);
      }
      return;
    }

    const expected = `${getVinePath(selectedVine.id)}${window.location.search}`;
    if (`${window.location.pathname}${window.location.search}` !== expected) {
      window.history.replaceState({}, '', expected);
    }
  }, [selectedVine]);

  useEffect(() => {
    const nextSearch = buildVinesSearch(filters);
    if (window.location.search === nextSearch) return;
    window.history.replaceState({}, '', `${window.location.pathname}${nextSearch}`);
  }, [filters]);

  const handleCreate = async (values: VineFormValues) => {
    const vineId = crypto.randomUUID();
    const payload: CreateVineInput = {
      serialNumber: nextSerialNumber,
      variety: values.variety.trim(),
      hasFruited: values.hasFruited,
      rootstockType: values.rootstockType,
      rootstockVariety: values.rootstockType === 'grafted' ? values.rootstockVariety.trim() : '',
      plantedAt: toPlantedAt(values),
      areaDescription: values.areaDescription.trim(),
      status: values.status,
      tags: parseTagsInput(values.tags),
      notes: values.notes.trim(),
      sourceCuttingId: values.sourceCuttingId || null,
    };

    await createVine(vineId, payload);
    window.history.pushState({}, '', `${getVinePath(vineId)}${window.location.search}`);
    setSelectedId(vineId);
    setShowCreateForm(false);
  };

  const handleSelectVine = (vineId: string) => {
    const nextPath = `${getVinePath(vineId)}${window.location.search}`;
    if (`${window.location.pathname}${window.location.search}` !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setSelectedId(vineId);
  };

  const handleCloseSelectedVine = () => {
    const nextPath = `/tokek${window.location.search}`;
    if (`${window.location.pathname}${window.location.search}` !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setSelectedId(null);
  };

  // A dugvány adatlap másik nézetben él, ezért popstate-tel jelzünk az App-nak.
  const handleOpenCutting = (cuttingId: string) => {
    window.history.pushState({}, '', `/dugvanyok/${cuttingId}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-vine-900 dark:text-vine-50">Tőkék</h2>
          <p className="text-sm text-vine-500 dark:text-vine-300">
            A nyaralóban kiültetett szőlőtőkék leltára és élettörténete.
          </p>
        </div>

        {prototypeAdmin && (
          <button
            onClick={() => setShowCreateForm((open) => !open)}
            className="inline-flex items-center gap-2 rounded-xl bg-vine-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-vine-700"
          >
            <Plus className="h-4 w-4" />
            {showCreateForm ? 'Űrlap bezárása' : 'Új tőke'}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 md:flex-row md:items-center md:justify-between dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
        <div className="flex items-start gap-2">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Prototípus: az adatok csak a böngésző memóriájában élnek, oldalfrissítéskor
            visszaállnak. Élesben a módosítás admin jogosultsághoz kötött, az olvasás publikus.
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={prototypeAdmin}
              onChange={(event) => setPrototypeAdmin(event.target.checked)}
              className="h-4 w-4 rounded border-amber-400 text-vine-600 focus:ring-vine-500"
            />
            <span className="whitespace-nowrap">Admin nézet</span>
          </label>
          <button
            type="button"
            onClick={() => {
              resetMockVines();
              setSelectedId(null);
              setShowCreateForm(false);
            }}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-400 bg-white px-2.5 py-1.5 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-900/40"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Minta adatok
          </button>
        </div>
      </div>

      {showCreateForm && prototypeAdmin && (
        <VineForm
          serialNumber={nextSerialNumber}
          defaultValues={DEFAULT_FORM_VALUES()}
          knownVarieties={knownVarieties}
          knownRootstockVarieties={knownRootstockVarieties}
          knownTags={knownTags}
          cuttingOptions={cuttingOptions}
          isPending={isCreating}
          submitLabel="Mentés"
          helperText="Eseményt a tőke adatlapján lehet rögzíteni."
          onSubmit={handleCreate}
          onCancel={() => setShowCreateForm(false)}
          submitError={
            createError ? getErrorMessage(createError, 'Nem sikerült menteni a tőkét.') : null
          }
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <div className="rounded-2xl border border-vine-200 bg-white/80 p-2.5 dark:border-vine-700 dark:bg-vine-900/50">
            <div className="grid gap-2">
              <input
                type="search"
                value={filters.query}
                onChange={(event) => patchFilters({ query: event.target.value })}
                placeholder="Fajta, # sorszám vagy terület"
                className="h-9 rounded-lg border border-vine-200 bg-white px-2.5 text-sm text-vine-900 outline-none placeholder:text-vine-400 focus:border-vine-400 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50 dark:placeholder:text-vine-400 dark:focus:border-vine-500"
              />
              <div className="grid grid-cols-2 gap-2">
                <label className={FILTER_FIELD_CLASS}>
                  <span className={FILTER_LABEL_CLASS}>Rendezés</span>
                  <select
                    value={filters.sort}
                    onChange={(event) => patchFilters({ sort: event.target.value as VinesSort })}
                    className={SELECT_CLASS}
                  >
                    <option value="updated_desc">Módosítva</option>
                    <option value="planted_desc">Telepítve</option>
                    <option value="variety_asc">Fajta neve</option>
                  </select>
                </label>
                <label className={FILTER_FIELD_CLASS}>
                  <span className={FILTER_LABEL_CLASS}>Állapot</span>
                  <select
                    value={filters.status}
                    onChange={(event) =>
                      patchFilters({ status: event.target.value as VinesStatusFilter })
                    }
                    className={SELECT_CLASS}
                  >
                    <option value="active">Aktív</option>
                    <option value="removed">Megszűnt</option>
                    <option value="all">Mind</option>
                  </select>
                </label>
                <label className={FILTER_FIELD_CLASS}>
                  <span className={FILTER_LABEL_CLASS}>Gyökérzet</span>
                  <select
                    value={filters.rootstock}
                    onChange={(event) =>
                      patchFilters({ rootstock: event.target.value as VinesRootstockFilter })
                    }
                    className={SELECT_CLASS}
                  >
                    <option value="all">Mind</option>
                    <option value="grafted">Oltott</option>
                    <option value="own_rooted">Saját gyökerű</option>
                    <option value="unknown">Ismeretlen</option>
                  </select>
                </label>
                <label className={FILTER_FIELD_CLASS}>
                  <span className={FILTER_LABEL_CLASS}>Termés</span>
                  <select
                    value={filters.fruited}
                    onChange={(event) =>
                      patchFilters({ fruited: event.target.value as VinesFruitedFilter })
                    }
                    className={SELECT_CLASS}
                  >
                    <option value="all">Mind</option>
                    <option value="yes">Termett már</option>
                    <option value="no">Még nem</option>
                  </select>
                </label>
                <label className={`col-span-2 ${FILTER_FIELD_CLASS}`}>
                  <span className={FILTER_LABEL_CLASS}>Címke</span>
                  <select
                    value={filters.tag}
                    onChange={(event) => patchFilters({ tag: event.target.value })}
                    className={SELECT_CLASS}
                  >
                    <option value="">Minden címke</option>
                    {knownTags.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </div>

          <p className="px-1 text-xs text-vine-500 dark:text-vine-300">
            {visibleVines.length} tőke a {vines.length} felvittből
          </p>

          <VinesList
            vines={visibleVines}
            selectedVineId={selectedVine?.id ?? null}
            onSelectVine={handleSelectVine}
            emptyMessage={
              vines.length > 0 ? 'Nincs találat a megadott szűrőkkel.' : 'Még nincs felvitt tőke.'
            }
          />
        </aside>

        <VineDetail
          vines={vines}
          selectedVine={selectedVine}
          knownVarieties={knownVarieties}
          knownRootstockVarieties={knownRootstockVarieties}
          knownTags={knownTags}
          cuttingOptions={cuttingOptions}
          isAdmin={prototypeAdmin}
          isMobileLayout={isMobileLayout}
          isUpdating={isUpdating}
          onCloseSelectedVine={handleCloseSelectedVine}
          onUpdateVine={updateVine}
          onOpenCutting={handleOpenCutting}
          updateErrorMessage={
            updateError
              ? getErrorMessage(updateError, 'Nem sikerült menteni a módosításokat.')
              : null
          }
          onClearUpdateError={resetUpdateError}
        />
      </div>
    </section>
  );
}
