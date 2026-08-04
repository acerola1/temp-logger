import type { ReactNode } from 'react';
import type {
  VineListFruited,
  VineListRootType,
  VineListSort,
  VineListState,
  VineListStatus,
} from '../listState';

const SELECT_CLASS =
  'h-9 w-full rounded-lg border border-vine-200 bg-white px-2.5 text-sm text-vine-900 outline-none focus:border-vine-400 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50 dark:focus:border-vine-500';
const FILTER_FIELD_CLASS = 'grid gap-1';
const FILTER_LABEL_CLASS =
  'text-[10px] font-semibold uppercase tracking-[0.14em] text-vine-500 dark:text-vine-300';

interface VineListFiltersProps {
  state: VineListState;
  tagSuggestions: readonly string[];
  onPatch: (patch: Partial<VineListState>) => void;
  onReset: () => void;
  resetVisible: boolean;
  /** A panel alatti sor bal oldala, jellemzően a találatszám. */
  summary?: ReactNode;
}

// A tőkelista szűrőpanelje. Nem csak a lap használja: a többtőkés
// eseményrögzítés célválasztója ugyanezt a panelt kapja, ugyanarra a
// `VineListState` alakra.
export function VineListFilters({
  state,
  tagSuggestions,
  onPatch,
  onReset,
  resetVisible,
  summary,
}: VineListFiltersProps) {
  return (
    <>
      <div className="rounded-2xl border border-vine-200 bg-white/80 p-2.5 dark:border-vine-700 dark:bg-vine-900/50">
        <div className="grid gap-2">
          <label>
            <span className="sr-only">Keresés</span>
            <input
              type="search"
              value={state.query}
              onChange={(event) => onPatch({ query: event.target.value })}
              placeholder="Fajta, # sorszám vagy terület"
              className="h-9 w-full rounded-lg border border-vine-200 bg-white px-2.5 text-sm text-vine-900 outline-none placeholder:text-vine-400 focus:border-vine-400 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50 dark:placeholder:text-vine-400 dark:focus:border-vine-500"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className={FILTER_FIELD_CLASS}>
              <span className={FILTER_LABEL_CLASS}>Rendezés</span>
              <select value={state.sort} onChange={(event) => onPatch({ sort: event.target.value as VineListSort })} className={SELECT_CLASS}>
                <option value="updated_desc">Módosítva</option>
                <option value="planting_desc">Telepítve</option>
                <option value="variety_asc">Fajta neve</option>
              </select>
            </label>
            <label className={FILTER_FIELD_CLASS}>
              <span className={FILTER_LABEL_CLASS}>Állapot</span>
              <select value={state.status} onChange={(event) => onPatch({ status: event.target.value as VineListStatus })} className={SELECT_CLASS}>
                <option value="active">Aktív</option>
                <option value="ceased">Megszűnt</option>
                <option value="all">Mind</option>
              </select>
            </label>
            <label className={FILTER_FIELD_CLASS}>
              <span className={FILTER_LABEL_CLASS}>Gyökérzet</span>
              <select value={state.rootType} onChange={(event) => onPatch({ rootType: event.target.value as VineListRootType })} className={SELECT_CLASS}>
                <option value="all">Mind</option>
                <option value="grafted">Oltott</option>
                <option value="own_rooted">Saját gyökerű</option>
                <option value="unknown">Ismeretlen</option>
              </select>
            </label>
            <label className={FILTER_FIELD_CLASS}>
              <span className={FILTER_LABEL_CLASS}>Termés</span>
              <select value={state.fruited} onChange={(event) => onPatch({ fruited: event.target.value as VineListFruited })} className={SELECT_CLASS}>
                <option value="all">Mind</option>
                <option value="yes">Termett már</option>
                <option value="no">Még nem</option>
              </select>
            </label>
            <label className={`col-span-2 ${FILTER_FIELD_CLASS}`}>
              <span className={FILTER_LABEL_CLASS}>Címke</span>
              <select value={state.tag} onChange={(event) => onPatch({ tag: event.target.value })} className={SELECT_CLASS}>
                <option value="">Minden címke</option>
                {tagSuggestions.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
              </select>
            </label>
          </div>
        </div>
      </div>

      {(summary || resetVisible) && (
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="text-xs text-vine-500 dark:text-vine-300">{summary}</p>
          {resetVisible && (
            <button type="button" onClick={onReset} className="text-xs font-medium text-vine-600 hover:text-vine-800 dark:text-vine-300 dark:hover:text-vine-100">
              Alaphelyzet
            </button>
          )}
        </div>
      )}
    </>
  );
}
