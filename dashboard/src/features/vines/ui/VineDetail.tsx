import { useMemo, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { formatDate, formatDateTime } from '../../../lib/dateFormat';
import type { VineFormValues } from '../forms';
import type { Vine, VinePlantingDate } from '../model';
import { VineForm, type VineCuttingOption } from './VineForm';
import {
  ROOT_TYPE_PRESENTATION,
  statusBadgeClass,
  statusLabel,
  tagBadgeClass,
} from './vinePresentation';

interface VineDetailProps {
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
  mutationError: string | null;
  onClose: () => void;
  onEdit: (vineId: string, values: VineFormValues) => Promise<void>;
  onOpenCutting: (cuttingId: string) => void;
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
  mutationError,
  onClose,
  onEdit,
  onOpenCutting,
}: VineDetailProps) {
  const [editMode, setEditMode] = useState(false);

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
                  onClick={() => setEditMode((current) => !current)}
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
                onCancel={() => setEditMode(false)}
                className="rounded-2xl border border-vine-200 bg-vine-50/80 p-4 dark:border-vine-700 dark:bg-vine-800/40"
                submitError={mutationError}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
