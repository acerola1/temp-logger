import { useMemo, useState } from 'react';
import { Dialog } from '../../../components/Dialog';
import { getVineEventTargetError } from '../forms';
import {
  DEFAULT_VINE_LIST_STATE,
  selectVisibleVines,
  serializeVineListState,
  type VineListState,
} from '../listState';
import type { Vine } from '../model';
import { VineCard } from './VineCard';
import { VineListFilters } from './VineListFilters';

const HEADER_BUTTON_CLASS =
  'rounded-lg border border-vine-200 bg-white px-2 py-1 text-vine-700 transition-colors hover:bg-vine-50 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800';

interface VineTargetPickerDialogProps {
  vines: readonly Vine[];
  tagSuggestions: readonly string[];
  /** A dialógus megnyitásakor érvényes kijelölés; a draft ebből indul. */
  selectedVineIds: readonly string[];
  onCancel: () => void;
  onConfirm: (vineIds: string[]) => void;
}

// A többtőkés eseményrögzítés célválasztója: a tőkelista teljes szűrés- és
// rendezéskészlete, checkboxos sorokkal.
//
// A szűrők szándékosan `DEFAULT_VINE_LIST_STATE`-ből indulnak, nem a lap
// szűrőiből: ugyanaz a gomb mindig ugyanazt a kezdőállapotot hozza fel. A
// kijelölés draft, és csak a `Kész` commitál — a `Mégse` így ingyen visszaáll.
export function VineTargetPickerDialog({
  vines,
  tagSuggestions,
  selectedVineIds,
  onCancel,
  onConfirm,
}: VineTargetPickerDialogProps) {
  const [listState, setListState] = useState<VineListState>({ ...DEFAULT_VINE_LIST_STATE });
  const [draftIds, setDraftIds] = useState<readonly string[]>(selectedVineIds);
  const [onlySelected, setOnlySelected] = useState(false);

  const draftSet = useMemo(() => new Set(draftIds), [draftIds]);
  const filteredVines = useMemo(() => selectVisibleVines(vines, listState), [listState, vines]);
  // A „csak a kiválasztottak" a szűrőktől független halmazt mutat, de a
  // rendezést megtartja: a sorrend ne ugorjon a pipa be- és kikapcsolásával.
  const selectedVines = useMemo(
    () =>
      selectVisibleVines(
        vines.filter((vine) => draftSet.has(vine.id)),
        { ...DEFAULT_VINE_LIST_STATE, status: 'all', sort: listState.sort },
      ),
    [draftSet, listState.sort, vines],
  );
  const rows = onlySelected ? selectedVines : filteredVines;
  const targetError = getVineEventTargetError(draftIds.length);

  const toggleVine = (vineId: string) => {
    setDraftIds((current) =>
      current.includes(vineId) ? current.filter((id) => id !== vineId) : [...current, vineId],
    );
  };

  // A `Mind` az épp szűrt halmazt jelöli ki, és a szűrésen kívüli meglévő
  // kijelölést nem dobja el — enélkül a szűrésnek nem lenne értelme itt.
  const selectFiltered = () => {
    setDraftIds((current) => {
      const next = new Set(current);
      for (const vine of filteredVines) next.add(vine.id);
      return [...next];
    });
  };

  return (
    <Dialog
      label="Érintett tőkék kiválasztása"
      onClose={onCancel}
      className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-xl flex-col gap-2 rounded-3xl border border-vine-200 bg-white p-4 shadow-xl sm:max-h-[calc(100vh-3rem)] dark:border-vine-700 dark:bg-vine-900"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-vine-900 dark:text-vine-50">Érintett tőkék</h2>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-vine-600 dark:text-vine-300">{draftIds.length} kiválasztva</span>
          <button type="button" onClick={selectFiltered} className={HEADER_BUTTON_CLASS}>Mind</button>
          <button type="button" onClick={() => setDraftIds([])} className={HEADER_BUTTON_CLASS}>Törlés</button>
        </div>
      </div>

      <VineListFilters
        state={listState}
        tagSuggestions={tagSuggestions}
        onPatch={(patch) => setListState((current) => ({ ...current, ...patch }))}
        onReset={() => setListState({ ...DEFAULT_VINE_LIST_STATE })}
        resetVisible={serializeVineListState(listState) !== ''}
        summary={`${rows.length} találat`}
      />

      <label className="flex items-center gap-2 px-1 text-xs text-vine-600 dark:text-vine-300">
        <input
          type="checkbox"
          checked={onlySelected}
          onChange={(event) => setOnlySelected(event.target.checked)}
          className="h-4 w-4 rounded border-vine-300 text-vine-600 focus:ring-vine-500"
        />
        Csak a kiválasztottak
      </label>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-2xl border border-vine-200 bg-white p-2 dark:border-vine-700 dark:bg-vine-900">
        {rows.length === 0 ? (
          <p role="status" className="px-2 py-4 text-sm text-vine-500 dark:text-vine-300">
            {onlySelected ? 'Nincs kiválasztott tőke.' : 'Nincs találat a megadott szűrőkkel.'}
          </p>
        ) : (
          rows.map((vine) => (
            <label
              key={vine.id}
              data-testid="vine-target-row"
              className="flex cursor-pointer items-center gap-3 rounded-3xl border border-vine-200 bg-white/80 p-3 transition-colors hover:bg-vine-50 dark:border-vine-700 dark:bg-vine-900/40 dark:hover:bg-vine-800/70"
            >
              <input
                type="checkbox"
                checked={draftSet.has(vine.id)}
                onChange={() => toggleVine(vine.id)}
                aria-label={`#${vine.serialNumber} - ${vine.variety}`}
                className="h-4 w-4 shrink-0 rounded border-vine-300 text-vine-600 focus:ring-vine-500"
              />
              <div className="min-w-0 flex-1">
                <VineCard vine={vine} />
              </div>
            </label>
          ))
        )}
      </div>

      {targetError && (
        <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {targetError}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-700 transition-colors hover:bg-vine-50 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
        >
          Mégse
        </button>
        <button
          type="button"
          onClick={() => onConfirm([...draftIds])}
          disabled={targetError !== null}
          className="rounded-xl bg-vine-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-vine-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          Kész
        </button>
      </div>
    </Dialog>
  );
}
