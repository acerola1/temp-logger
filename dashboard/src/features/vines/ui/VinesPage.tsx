import { useEffect, useMemo, useState } from 'react';
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
import { useVineCatalog } from '../useVineCatalog';
import { VinesList } from './VinesList';

const SELECT_CLASS =
  'h-9 w-full rounded-lg border border-vine-200 bg-white px-2.5 text-sm text-vine-900 outline-none focus:border-vine-400 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50 dark:focus:border-vine-500';
const FILTER_FIELD_CLASS = 'grid gap-1';
const FILTER_LABEL_CLASS =
  'text-[10px] font-semibold uppercase tracking-[0.14em] text-vine-500 dark:text-vine-300';

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

interface VinesPageProps {
  isAdmin: boolean;
}

export function VinesPage({ isAdmin }: VinesPageProps) {
  const { vines, tagSuggestions, loadingVines, error } = useVineCatalog();
  const [listState, setListState] = useState<VineListState>(() =>
    parseVineListState(window.location.search),
  );
  const [selectedVineId, setSelectedVineId] = useState<string | null>(() =>
    vineIdFromPath(window.location.pathname),
  );

  const visibleVines = useMemo(
    () => selectVisibleVines(vines, listState),
    [listState, vines],
  );
  const routedSelectedVineId =
    !loadingVines && !error && selectedVineId && !vines.some((vine) => vine.id === selectedVineId)
      ? null
      : selectedVineId;

  const patchListState = (patch: Partial<VineListState>) => {
    setListState((current) => ({ ...current, ...patch }));
  };

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

  const selectVine = (vineId: string) => {
    const nextUrl = `${vinePath(vineId)}${serializeVineListState(listState)}`;
    if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
      window.history.pushState({}, '', nextUrl);
    }
    setSelectedVineId(vineId);
  };

  return (
    <section className="space-y-6" data-access-mode={isAdmin ? 'admin' : 'public'}>
      <div>
        <h2 className="text-2xl font-semibold text-vine-900 dark:text-vine-50">Tőkék</h2>
        <p className="text-sm text-vine-500 dark:text-vine-300">
          A nyaralóban kiültetett szőlőtőkék leltára és élettörténete.
        </p>
      </div>

      <div className="w-full space-y-3 lg:w-80">
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
                <select
                  value={listState.sort}
                  onChange={(event) => patchListState({ sort: event.target.value as VineListSort })}
                  className={SELECT_CLASS}
                >
                  <option value="updated_desc">Módosítva</option>
                  <option value="planting_desc">Telepítve</option>
                  <option value="variety_asc">Fajta neve</option>
                </select>
              </label>
              <label className={FILTER_FIELD_CLASS}>
                <span className={FILTER_LABEL_CLASS}>Állapot</span>
                <select
                  value={listState.status}
                  onChange={(event) => patchListState({ status: event.target.value as VineListStatus })}
                  className={SELECT_CLASS}
                >
                  <option value="active">Aktív</option>
                  <option value="ceased">Megszűnt</option>
                  <option value="all">Mind</option>
                </select>
              </label>
              <label className={FILTER_FIELD_CLASS}>
                <span className={FILTER_LABEL_CLASS}>Gyökérzet</span>
                <select
                  value={listState.rootType}
                  onChange={(event) => patchListState({ rootType: event.target.value as VineListRootType })}
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
                  value={listState.fruited}
                  onChange={(event) => patchListState({ fruited: event.target.value as VineListFruited })}
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
                  value={listState.tag}
                  onChange={(event) => patchListState({ tag: event.target.value })}
                  className={SELECT_CLASS}
                >
                  <option value="">Minden címke</option>
                  {tagSuggestions.map((tag) => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>

        {!loadingVines && !error && (
          <div className="flex items-center justify-between gap-2 px-1">
            <p className="text-xs text-vine-500 dark:text-vine-300">
              {visibleVines.length} tőke a {vines.length} felvittből
            </p>
            {serializeVineListState(listState) && (
              <button
                type="button"
                onClick={() => setListState({ ...DEFAULT_VINE_LIST_STATE })}
                className="text-xs font-medium text-vine-600 hover:text-vine-800 dark:text-vine-300 dark:hover:text-vine-100"
              >
                Alaphelyzet
              </button>
            )}
          </div>
        )}

        <VinesList
          vines={visibleVines}
          selectedVineId={routedSelectedVineId}
          loading={loadingVines}
          error={error}
          hasVines={vines.length > 0}
          onSelectVine={selectVine}
        />
      </div>
    </section>
  );
}
