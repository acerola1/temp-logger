import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { CuttingsList } from './CuttingsList';
import { CuttingDetail } from './CuttingDetail';
import { CuttingForm } from './CuttingForm';
import {
  getCuttingIdFromPath,
  getCuttingPath,
  parseCategoriesInput,
  toCuttingPhotos,
} from './cuttingsViewUtils';
import { usePhotoUpload } from '../features/photos';
import { useCuttingsQuery } from '../hooks/queries/useCuttingsQuery';
import { getErrorMessage } from '../lib/errorMessage';
import type { CreateCuttingInput } from '../types/cutting';
import type { CuttingFormValues } from '../types/forms';

interface CuttingsPageProps {
  isAdmin: boolean;
}

type CuttingsSort = 'updated_desc' | 'created_desc' | 'planted_desc' | 'variety_asc';
type CuttingsTypeFilter = 'all' | 'cutting' | 'graft';
type CuttingsStatusFilter = 'all' | 'active' | 'lost' | 'archived';

const DEFAULT_SORT: CuttingsSort = 'updated_desc';
const DEFAULT_TYPE: CuttingsTypeFilter = 'all';
const DEFAULT_STATUS: CuttingsStatusFilter = 'active';

const DEFAULT_FORM_VALUES = (): CuttingFormValues => ({
  variety: '',
  plantType: 'cutting',
  plantedAt: new Date().toISOString().slice(0, 10),
  status: 'active',
  categories: '',
  notes: '',
});

function parseCuttingsFiltersFromSearch(search: string): {
  query: string;
  type: CuttingsTypeFilter;
  status: CuttingsStatusFilter;
  category: string;
  sort: CuttingsSort;
} {
  const params = new URLSearchParams(search);
  const query = (params.get('q') ?? '').trim();
  const rawType = params.get('type');
  const rawStatus = params.get('status');
  const rawSort = params.get('sort');
  const category = (params.get('category') ?? '').trim();

  const type: CuttingsTypeFilter =
    rawType === 'cutting' || rawType === 'graft' ? rawType : DEFAULT_TYPE;
  const status: CuttingsStatusFilter =
    rawStatus === 'all' ||
    rawStatus === 'active' ||
    rawStatus === 'lost' ||
    rawStatus === 'archived'
      ? rawStatus
      : DEFAULT_STATUS;
  const sort: CuttingsSort =
    rawSort === 'created_desc' ||
    rawSort === 'planted_desc' ||
    rawSort === 'updated_desc' ||
    rawSort === 'variety_asc'
      ? rawSort
      : DEFAULT_SORT;

  return { query, type, status, category, sort };
}

function buildCuttingsSearch(
  query: string,
  type: CuttingsTypeFilter,
  status: CuttingsStatusFilter,
  category: string,
  sort: CuttingsSort,
): string {
  const params = new URLSearchParams();
  const trimmedQuery = query.trim();
  const trimmedCategory = category.trim();

  if (trimmedQuery.length > 0) {
    params.set('q', trimmedQuery);
  }
  if (type !== DEFAULT_TYPE) {
    params.set('type', type);
  }
  if (status !== DEFAULT_STATUS) {
    params.set('status', status);
  }
  if (trimmedCategory.length > 0) {
    params.set('category', trimmedCategory);
  }
  if (sort !== DEFAULT_SORT) {
    params.set('sort', sort);
  }

  const serialized = params.toString();
  return serialized.length > 0 ? `?${serialized}` : '';
}

function isMobileLayoutWidth() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 1023px)').matches;
}

export function CuttingsPage({ isAdmin }: CuttingsPageProps) {
  const {
    data: cuttings,
    loading,
    error,
    createCutting,
    updateCutting,
    isCreating,
    isUpdating,
    createError,
    updateError,
    resetUpdateError,
  } = useCuttingsQuery();
  const { upload: uploadPhotos } = usePhotoUpload();
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    getCuttingIdFromPath(window.location.pathname),
  );
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(() => isMobileLayoutWidth());
  const [searchQuery, setSearchQuery] = useState(() => parseCuttingsFiltersFromSearch(window.location.search).query);
  const [typeFilter, setTypeFilter] = useState<CuttingsTypeFilter>(
    () => parseCuttingsFiltersFromSearch(window.location.search).type,
  );
  const [statusFilter, setStatusFilter] = useState<CuttingsStatusFilter>(
    () => parseCuttingsFiltersFromSearch(window.location.search).status,
  );
  const [categoryFilter, setCategoryFilter] = useState<string>(
    () => parseCuttingsFiltersFromSearch(window.location.search).category,
  );
  const [sortBy, setSortBy] = useState<CuttingsSort>(
    () => parseCuttingsFiltersFromSearch(window.location.search).sort,
  );

  const selectedCutting = useMemo(
    () => cuttings.find((cutting) => cutting.id === selectedId) ?? null,
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
  const knownCategories = useMemo(
    () =>
      Array.from(
        new Set(
          cuttings.flatMap((cutting) =>
            cutting.categories.map((category) => category.trim()).filter((value) => value.length > 0),
          ),
        ),
      ).sort((left, right) => left.localeCompare(right, 'hu')),
    [cuttings],
  );
  const filteredAndSortedCuttings = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase('hu');
    const filtered = cuttings.filter((cutting) => {
      if (typeFilter !== 'all' && cutting.plantType !== typeFilter) {
        return false;
      }
      if (statusFilter !== 'all' && cutting.status !== statusFilter) {
        return false;
      }
      if (categoryFilter && !cutting.categories.includes(categoryFilter)) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }

      const varietyMatch = cutting.variety.toLocaleLowerCase('hu').includes(normalizedQuery);
      const serialMatch = String(cutting.serialNumber).includes(normalizedQuery);
      return varietyMatch || serialMatch;
    });

    const toMs = (value: string) => new Date(value).getTime();

    return [...filtered].sort((left, right) => {
      if (sortBy === 'created_desc') {
        return toMs(right.createdAt) - toMs(left.createdAt);
      }
      if (sortBy === 'planted_desc') {
        return toMs(right.plantedAt) - toMs(left.plantedAt);
      }
      if (sortBy === 'variety_asc') {
        const varietyCompare = left.variety.localeCompare(right.variety, 'hu', {
          sensitivity: 'base',
        });
        if (varietyCompare !== 0) {
          return varietyCompare;
        }
        return left.serialNumber - right.serialNumber;
      }
      return toMs(right.updatedAt) - toMs(left.updatedAt);
    });
  }, [categoryFilter, cuttings, searchQuery, sortBy, statusFilter, typeFilter]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const handleChange = () => setIsMobileLayout(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setSelectedId(getCuttingIdFromPath(window.location.pathname));
      const parsed = parseCuttingsFiltersFromSearch(window.location.search);
      setSearchQuery(parsed.query);
      setTypeFilter(parsed.type);
      setStatusFilter(parsed.status);
      setCategoryFilter(parsed.category);
      setSortBy(parsed.sort);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (cuttings.length === 0) {
      if (window.location.pathname !== '/dugvanyok') {
        window.history.replaceState({}, '', `/dugvanyok${window.location.search}`);
      }
      return;
    }

    if (!selectedCutting) {
      if (window.location.pathname !== '/dugvanyok') {
        window.history.replaceState({}, '', `/dugvanyok${window.location.search}`);
      }
      return;
    }

    const expectedPathWithSearch = `${getCuttingPath(selectedCutting.id)}${window.location.search}`;
    const currentPathWithSearch = `${window.location.pathname}${window.location.search}`;
    if (currentPathWithSearch !== expectedPathWithSearch) {
      window.history.replaceState({}, '', expectedPathWithSearch);
    }
  }, [cuttings, selectedCutting]);

  useEffect(() => {
    const nextSearch = buildCuttingsSearch(
      searchQuery,
      typeFilter,
      statusFilter,
      categoryFilter,
      sortBy,
    );
    if (window.location.search === nextSearch) {
      return;
    }
    window.history.replaceState({}, '', `${window.location.pathname}${nextSearch}`);
  }, [categoryFilter, searchQuery, sortBy, statusFilter, typeFilter]);

  const handleCreate = async (values: CuttingFormValues, files: FileList | null) => {
    if (!isAdmin) {
      throw new Error('Csak admin tud új dugványt létrehozni.');
    }

    const cuttingId = crypto.randomUUID();
    const uploads = files
      ? await uploadPhotos({
          files,
          storagePathPrefix: `cuttings/${cuttingId}/photos`,
        })
      : [];
    const photos = toCuttingPhotos(uploads);
    const payload: CreateCuttingInput = {
      serialNumber: nextSerialNumber,
      variety: values.variety.trim(),
      plantType: values.plantType,
      plantedAt: values.plantedAt,
      status: values.status,
      categories: parseCategoriesInput(values.categories),
      notes: values.notes.trim(),
      photos,
    };

    await createCutting(cuttingId, payload);
    window.history.pushState({}, '', `${getCuttingPath(cuttingId)}${window.location.search}`);
    setSelectedId(cuttingId);
    setShowCreateForm(false);
  };

  const handleSelectCutting = (cuttingId: string) => {
    const nextPath = `${getCuttingPath(cuttingId)}${window.location.search}`;
    const currentPathWithSearch = `${window.location.pathname}${window.location.search}`;
    if (currentPathWithSearch !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setSelectedId(cuttingId);
  };

  const handleCloseSelectedCutting = () => {
    const nextPath = `/dugvanyok${window.location.search}`;
    const currentPathWithSearch = `${window.location.pathname}${window.location.search}`;
    if (currentPathWithSearch !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setSelectedId(null);
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
        <CuttingForm
          serialNumber={nextSerialNumber}
          defaultValues={DEFAULT_FORM_VALUES()}
          knownVarieties={knownVarieties}
          knownCategories={knownCategories}
          isPending={isCreating}
          submitLabel="Mentés"
          helperText="Esemény napló a részletes nézetben adható hozzá."
          showPhotoUpload
          onSubmit={handleCreate}
          submitError={
            createError ? getErrorMessage(createError, 'Nem sikerült menteni a dugványt.') : null
          }
        />
      )}

      {!isAdmin && (
        <div className="rounded-2xl border border-vine-200 bg-white/60 px-4 py-3 text-sm text-vine-600 dark:border-vine-700 dark:bg-vine-800/40 dark:text-vine-200">
          Megfigyelő nézet. Új dugványt és képet csak admin tud rögzíteni.
        </div>
      )}

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
            <div className="rounded-2xl border border-vine-200 bg-white/80 p-2.5 dark:border-vine-700 dark:bg-vine-900/50">
              <div className="grid gap-2">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Fajta vagy # sorszám"
                  className="h-9 rounded-lg border border-vine-200 bg-white px-2.5 text-sm text-vine-900 outline-none ring-0 placeholder:text-vine-400 focus:border-vine-400 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50 dark:placeholder:text-vine-400 dark:focus:border-vine-500"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value as CuttingsSort)}
                    className="h-9 rounded-lg border border-vine-200 bg-white px-2.5 text-sm text-vine-900 outline-none ring-0 focus:border-vine-400 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50 dark:focus:border-vine-500"
                  >
                    <option value="updated_desc">Utoljára módosítva</option>
                    <option value="created_desc">Létrehozva</option>
                    <option value="planted_desc">Ültetési dátum</option>
                    <option value="variety_asc">Fajta neve</option>
                  </select>
                  <select
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value as CuttingsTypeFilter)}
                    className="h-9 rounded-lg border border-vine-200 bg-white px-2.5 text-sm text-vine-900 outline-none ring-0 focus:border-vine-400 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50 dark:focus:border-vine-500"
                  >
                    <option value="all">Mind</option>
                    <option value="cutting">Dugvány</option>
                    <option value="graft">Oltvány</option>
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as CuttingsStatusFilter)}
                    className="col-span-2 h-9 rounded-lg border border-vine-200 bg-white px-2.5 text-sm text-vine-900 outline-none ring-0 focus:border-vine-400 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50 dark:focus:border-vine-500"
                  >
                    <option value="active">Aktív</option>
                    <option value="lost">Elpusztult</option>
                    <option value="archived">Archivált</option>
                    <option value="all">Mind</option>
                  </select>
                  <select
                    value={categoryFilter}
                    onChange={(event) => setCategoryFilter(event.target.value)}
                    className="col-span-2 h-9 rounded-lg border border-vine-200 bg-white px-2.5 text-sm text-vine-900 outline-none ring-0 focus:border-vine-400 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50 dark:focus:border-vine-500"
                  >
                    <option value="">Minden címke</option>
                    {knownCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <CuttingsList
              cuttings={filteredAndSortedCuttings}
              selectedCuttingId={selectedCutting?.id ?? null}
              onSelectCutting={handleSelectCutting}
              emptyMessage={
                cuttings.length > 0
                  ? 'Nincs találat a megadott szűrőkkel.'
                  : 'Még nincs felvitt dugvány.'
              }
            />
          </aside>

          <CuttingDetail
            cuttings={cuttings}
            selectedCutting={selectedCutting}
            knownVarieties={knownVarieties}
            knownCategories={knownCategories}
            isAdmin={isAdmin}
            isMobileLayout={isMobileLayout}
            isUpdating={isUpdating}
            onCloseSelectedCutting={handleCloseSelectedCutting}
            onUpdateCutting={updateCutting}
            updateErrorMessage={
              updateError
                ? getErrorMessage(updateError, 'Nem sikerült menteni a módosításokat.')
                : null
            }
            onClearUpdateError={resetUpdateError}
          />
        </div>
      )}
    </section>
  );
}
