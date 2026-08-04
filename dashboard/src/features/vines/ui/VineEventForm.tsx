import { useEffect, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { ImagePlus, Loader2 } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
// A `photos` almoduljait közvetlenül importáljuk, nem az indexen át: az űrlap
// így nem húzza be a feltöltő hook Firebase-szingletonját.
import {
  DEFAULT_MAX_SELECTED_PHOTOS,
  appendSelectedPhotos,
  releaseSelectedPhotos,
  removeSelectedPhotoAt,
  selectedPhotoFiles,
  type SelectedPhoto,
} from '../../photos/photoSelection';
import { PhotoPickerButtons } from '../../photos/ui/PhotoPickerButtons';
import { PhotoPreviewList } from '../../photos/ui/PhotoPreviewList';
import {
  VINE_EVENT_TYPE_LABEL,
  getVineEventTargetError,
  vineEventFormSchema,
  type VineEventFormValues,
} from '../forms';
import {
  VINE_EVENT_TYPES,
  type Vine,
} from '../model';
import { VineTargetPickerDialog } from './VineTargetPickerDialog';

const INPUT_CLASS =
  'w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none transition-colors focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50';
const FIELD_LABEL_CLASS = 'text-xs font-medium text-vine-700 dark:text-vine-200';
// Ennyi sorszám fér el az összefoglaló sorban, a többi darabszámként jelenik meg.
const SUMMARY_SERIAL_LIMIT = 8;

function summarizeTargets(
  targetVines: readonly Vine[],
  selectedTargetIds: readonly string[],
): string | null {
  const selectedIds = new Set(selectedTargetIds);
  const serials = targetVines
    .filter((vine) => selectedIds.has(vine.id))
    .map((vine) => `#${vine.serialNumber}`);

  if (serials.length === 0) return null;
  if (serials.length <= SUMMARY_SERIAL_LIMIT) return serials.join(', ');
  return `${serials.slice(0, SUMMARY_SERIAL_LIMIT).join(', ')} +${serials.length - SUMMARY_SERIAL_LIMIT}`;
}

interface VineEventFormProps {
  mode: 'add' | 'edit';
  defaultValues: VineEventFormValues;
  targetVines?: readonly Vine[];
  tagSuggestions?: readonly string[];
  initialTargetVineId?: string;
  isPending: boolean;
  uploadProgress: number | null;
  submitError: string | null;
  onSubmit: (
    values: VineEventFormValues,
    targetVineIds: string[],
    photos: File[],
  ) => Promise<void>;
  onCancel: () => void;
}

export function VineEventForm({
  mode,
  defaultValues,
  targetVines = [],
  tagSuggestions = [],
  initialTargetVineId,
  isPending,
  uploadProgress,
  submitError,
  onSubmit,
  onCancel,
}: VineEventFormProps) {
  const [targetVineIds, setTargetVineIds] = useState<string[]>(
    initialTargetVineId ? [initialTargetVineId] : [],
  );
  const [isTargetPickerOpen, setIsTargetPickerOpen] = useState(false);
  const [photos, setPhotos] = useState<readonly SelectedPhoto[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  // A lecsatoláskori felszabadításhoz kell az aktuális lista effekten kívül is.
  const photosRef = useRef<readonly SelectedPhoto[]>([]);
  const [targetError, setTargetError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<VineEventFormValues>({
    resolver: zodResolver(vineEventFormSchema),
    defaultValues,
  });
  const selectedType = useWatch({ control, name: 'type' });
  const selectableIds = useMemo(() => new Set(targetVines.map((vine) => vine.id)), [targetVines]);
  const selectedTargetIds = targetVineIds.filter((vineId) => selectableIds.has(vineId));
  // A dialógus nélkül is látszódjon, *mely* tőkék a célok. Sorszámmal, mert az
  // rövid; sok kijelölésnél a maradék már csak számként jelenik meg.
  const selectedTargetSummary = summarizeTargets(targetVines, selectedTargetIds);

  // A kiválasztás elhagyása után nem maradhat felszabadítatlan objectURL.
  useEffect(() => () => releaseSelectedPhotos(photosRef.current), []);

  const applyPhotos = (next: readonly SelectedPhoto[]) => {
    photosRef.current = next;
    setPhotos(next);
  };

  const addPhotos = (files: File[]) => {
    const selection = appendSelectedPhotos(photos, files);
    applyPhotos(selection.photos);
    setPhotoError(selection.error);
  };

  const removePhoto = (index: number) => {
    applyPhotos(removeSelectedPhotoAt(photos, index));
    setPhotoError(null);
  };

  const submit = handleSubmit(async (values) => {
    const targets = mode === 'add' ? selectedTargetIds : [];
    const error = mode === 'add' ? getVineEventTargetError(targets.length) : null;
    if (error) {
      setTargetError(error);
      return;
    }

    setTargetError(null);
    await onSubmit(values, targets, selectedPhotoFiles(photos));
  });

  return (
    <form
      aria-label={mode === 'add' ? 'Új tőkeesemény' : 'Tőkeesemény szerkesztése'}
      onSubmit={(event) => void submit(event)}
      className={mode === 'add'
        ? 'rounded-2xl border border-vine-200 bg-vine-50/80 p-4 dark:border-vine-700 dark:bg-vine-800/40'
        : 'space-y-3'}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className={FIELD_LABEL_CLASS}>Típus</span>
          <select {...register('type')} disabled={isPending} className={INPUT_CLASS}>
            {VINE_EVENT_TYPES.map((type) => (
              <option key={type} value={type}>{VINE_EVENT_TYPE_LABEL[type]}</option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className={FIELD_LABEL_CLASS}>Időpont</span>
          <input type="datetime-local" {...register('occurredAt')} disabled={isPending} className={INPUT_CLASS} />
          {errors.occurredAt && <span className="text-xs text-red-600 dark:text-red-300">{errors.occurredAt.message}</span>}
        </label>

        <label className="space-y-1">
          <span className={FIELD_LABEL_CLASS}>Cím</span>
          <input
            {...register('title')}
            disabled={isPending}
            placeholder={`Üresen hagyva: ${VINE_EVENT_TYPE_LABEL[selectedType]}`}
            className={INPUT_CLASS}
          />
        </label>

        <label className="space-y-1">
          <span className={FIELD_LABEL_CLASS}>Jegyzet</span>
          <input {...register('notes')} disabled={isPending} placeholder="pl. két csapra metszve" className={INPUT_CLASS} />
        </label>
      </div>

      {mode === 'add' && (
        <>
          <div className="mt-3 space-y-2">
            <span className={`block ${FIELD_LABEL_CLASS}`}>Fotók</span>
            <PhotoPickerButtons onSelect={addPhotos} disabled={isPending} />
            <PhotoPreviewList photos={photos} onRemove={removePhoto} disabled={isPending} />
            <span className="inline-flex items-center gap-1 text-xs text-vine-500 dark:text-vine-400">
              <ImagePlus className="h-3.5 w-3.5" />
              {photos.length > 0
                ? `${photos.length}/${DEFAULT_MAX_SELECTED_PHOTOS} fotó kiválasztva`
                : `Legfeljebb ${DEFAULT_MAX_SELECTED_PHOTOS} fotó választható ki.`}
            </span>
            {photoError && (
              <p role="alert" className="text-xs text-red-600 dark:text-red-300">
                {photoError}
              </p>
            )}
          </div>

          {selectedType === 'ceased' && (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              A megszűnés esemény a kiválasztott tőkéket megszűnt állapotba teszi. Az állapot később kézzel visszaállítható.
            </p>
          )}

          <div className="mt-3 space-y-2">
            <span className={`block ${FIELD_LABEL_CLASS}`}>Érintett tőkék</span>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-vine-200 bg-white px-3 py-2 dark:border-vine-700 dark:bg-vine-900">
              <div className="min-w-0">
                <p className="text-sm text-vine-800 dark:text-vine-100">
                  {selectedTargetIds.length} tőke kiválasztva
                </p>
                {selectedTargetSummary && (
                  <p className="truncate text-xs text-vine-500 dark:text-vine-300">
                    {selectedTargetSummary}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsTargetPickerOpen(true)}
                disabled={isPending}
                className="shrink-0 rounded-lg border border-vine-200 bg-white px-2.5 py-1.5 text-xs font-medium text-vine-700 transition-colors hover:bg-vine-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
              >
                Kiválasztás…
              </button>
            </div>
          </div>

          {/* A dialógus portálon, az űrlapon kívül jelenik meg: a DOM-ban
              belülre rendelt overlay érvénytelen beágyazott formot és véletlen
              submitot adna. */}
          {isTargetPickerOpen && (
            <VineTargetPickerDialog
              vines={targetVines}
              tagSuggestions={tagSuggestions}
              selectedVineIds={selectedTargetIds}
              onCancel={() => setIsTargetPickerOpen(false)}
              onConfirm={(vineIds) => {
                setTargetVineIds(vineIds);
                setTargetError(null);
                setIsTargetPickerOpen(false);
              }}
            />
          )}
        </>
      )}

      {uploadProgress !== null && (
        <div className="mt-3 space-y-1" role="status">
          <div className="flex justify-between text-xs text-vine-600 dark:text-vine-300">
            <span>Fotók feltöltése</span><span>{uploadProgress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-vine-200 dark:bg-vine-700">
            <div role="progressbar" aria-label="Fotók feltöltése" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadProgress} className="h-full bg-vine-600 transition-[width]" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}

      {(targetError || submitError) && (
        <div role="alert" className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {targetError ?? submitError}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="submit" disabled={isPending} className="inline-flex items-center gap-2 rounded-xl bg-vine-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-vine-700 disabled:cursor-not-allowed disabled:opacity-70">
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === 'add' ? `Esemény mentése (${selectedTargetIds.length})` : 'Mentés'}
        </button>
        <button type="button" onClick={onCancel} disabled={isPending} className="rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-700 transition-colors hover:bg-vine-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800">Mégse</button>
        {mode === 'add' && <span className="text-xs text-vine-500 dark:text-vine-300">Tőkénként külön példány jön létre.</span>}
      </div>
    </form>
  );
}
