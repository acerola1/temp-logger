import { useEffect, useId } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { vineFormSchema, type VineFormValues } from '../forms';

export interface VineCuttingOption {
  id: string;
  label: string;
}

interface VineFormProps {
  serialNumber: number;
  defaultValues: VineFormValues;
  knownVarieties: readonly string[];
  knownRootstockVarieties: readonly string[];
  knownLocations: readonly string[];
  knownTags: readonly string[];
  cuttingOptions: readonly VineCuttingOption[];
  cuttingOptionsLoading?: boolean;
  cuttingOptionsError?: string | null;
  isPending: boolean;
  submitLabel: string;
  helperText?: string;
  onSubmit: (values: VineFormValues) => Promise<void>;
  onCancel?: () => void;
  className?: string;
  submitError?: string | null;
}

const INPUT_CLASS =
  'w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none transition-colors focus:border-vine-500 disabled:cursor-not-allowed disabled:bg-vine-100 disabled:text-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50 dark:disabled:bg-vine-800 dark:disabled:text-vine-400';
const LABEL_CLASS = 'text-sm font-medium text-vine-700 dark:text-vine-200';

export function VineForm({
  serialNumber,
  defaultValues,
  knownVarieties,
  knownRootstockVarieties,
  knownLocations,
  knownTags,
  cuttingOptions,
  cuttingOptionsLoading = false,
  cuttingOptionsError,
  isPending,
  submitLabel,
  helperText,
  onSubmit,
  onCancel,
  className,
  submitError,
}: VineFormProps) {
  const datalistId = useId();
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<VineFormValues>({
    resolver: zodResolver(vineFormSchema),
    defaultValues,
  });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const plantingDatePrecision = useWatch({ control, name: 'plantingDatePrecision' });
  const rootType = useWatch({ control, name: 'rootType' });
  const firstError =
    errors.variety?.message ??
    errors.location?.message ??
    errors.areaDescription?.message ??
    errors.plantingDate?.message ??
    errors.plantingYear?.message ??
    submitError ??
    null;

  const submit = async (values: VineFormValues) => {
    try {
      await onSubmit(values);
      reset(defaultValues);
    } catch (error) {
      console.error('Vine form submit error:', error);
    }
  };

  return (
    <form
      aria-label={serialNumber ? `Szőlőtőke #${serialNumber} űrlap` : 'Szőlőtőke űrlap'}
      onSubmit={handleSubmit((values) => void submit(values))}
      className={
        className ??
        'rounded-3xl border border-vine-200 bg-white/80 p-5 shadow-sm dark:border-vine-700 dark:bg-vine-800/60'
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <span className={LABEL_CLASS}>Sorszám</span>
          <div className="rounded-xl border border-vine-200 bg-vine-50 px-3 py-2 text-sm font-semibold text-vine-900 dark:border-vine-700 dark:bg-vine-800 dark:text-vine-50">
            #{serialNumber}
          </div>
          <span className="text-xs text-vine-500 dark:text-vine-400">
            Automatikus, nem szerkeszthető.
          </span>
        </div>

        <label className="space-y-1">
          <span className={LABEL_CLASS}>Fajta</span>
          <input
            list={`${datalistId}-varieties`}
            {...register('variety')}
            className={INPUT_CLASS}
            placeholder="pl. Kékfrankos vagy Ismeretlen"
          />
        </label>

        <label className="space-y-1">
          <span className={LABEL_CLASS}>Gyökérzet típusa</span>
          <select {...register('rootType')} className={INPUT_CLASS}>
            <option value="grafted">Oltott</option>
            <option value="own_rooted">Saját gyökerű</option>
            <option value="unknown">Ismeretlen</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className={LABEL_CLASS}>Alanyfajta</span>
          <input
            list={`${datalistId}-rootstocks`}
            {...register('rootstockVariety')}
            className={INPUT_CLASS}
            placeholder="pl. Teleki 5C"
            disabled={rootType !== 'grafted'}
          />
          <span className="text-xs text-vine-500 dark:text-vine-400">
            {rootType === 'grafted'
              ? 'Opcionális, ha ismert.'
              : 'Csak oltott tőkénél tölthető ki.'}
          </span>
        </label>

        <label className="space-y-1">
          <span className={LABEL_CLASS}>Telepítési idő</span>
          <select {...register('plantingDatePrecision')} className={INPUT_CLASS}>
            <option value="date">Pontos dátum</option>
            <option value="year">Csak év</option>
            <option value="unknown">Ismeretlen</option>
          </select>
        </label>

        <div className="space-y-1">
          <span className={LABEL_CLASS}>
            {plantingDatePrecision === 'year' ? 'Telepítés éve' : 'Telepítés dátuma'}
          </span>
          {plantingDatePrecision === 'unknown' ? (
            <div className="rounded-xl border border-dashed border-vine-300 px-3 py-2 text-sm text-vine-500 dark:border-vine-700 dark:text-vine-300">
              Nem ismert
            </div>
          ) : plantingDatePrecision === 'year' ? (
            <input
              type="number"
              inputMode="numeric"
              min={1000}
              max={9999}
              {...register('plantingYear')}
              className={INPUT_CLASS}
              placeholder="pl. 1998"
            />
          ) : (
            <input type="date" {...register('plantingDate')} className={INPUT_CLASS} />
          )}
        </div>

        <label className="space-y-1">
          <span className={LABEL_CLASS}>Állapot</span>
          <select {...register('status')} className={INPUT_CLASS}>
            <option value="active">Aktív</option>
            <option value="ceased">Megszűnt</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className={LABEL_CLASS}>Eredeti dugvány</span>
          <select
            {...register('sourceCuttingId')}
            className={INPUT_CLASS}
            disabled={cuttingOptionsLoading}
          >
            <option value="">Nincs megadva</option>
            {cuttingOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-vine-500 dark:text-vine-400">
            {cuttingOptionsLoading
              ? 'Dugványok betöltése…'
              : cuttingOptionsError ?? 'Csak hivatkozás, adatot nem másol át.'}
          </span>
        </label>
      </div>

      <label className="mt-4 block space-y-1">
        <span className={LABEL_CLASS}>Helyszín</span>
        <input
          list={`${datalistId}-locations`}
          {...register('location')}
          className={INPUT_CLASS}
          placeholder="pl. Erkély vagy Telek"
          autoComplete="off"
        />
        <span className="text-xs text-vine-500 dark:text-vine-400">
          Válassz egy korábbit, vagy írj be új helyszínt.
        </span>
      </label>

      <label className="mt-4 block space-y-1">
        <span className={LABEL_CLASS}>Területleírás</span>
        <input
          {...register('areaDescription')}
          className={INPUT_CLASS}
          placeholder="pl. ház mögötti sor, a kaputól az első tőke"
        />
      </label>

      <label className="mt-4 block space-y-1">
        <span className={LABEL_CLASS}>Címkék</span>
        <input
          list={`${datalistId}-tags`}
          {...register('tags')}
          className={INPUT_CLASS}
          placeholder="pl. pergola, öreg tőke"
        />
        <span className="text-xs text-vine-500 dark:text-vine-400">
          Vesszővel elválasztva több is megadható.
        </span>
      </label>

      <label className="mt-4 flex items-center gap-2">
        <input
          type="checkbox"
          {...register('hasFruited')}
          className="h-4 w-4 rounded border-vine-300 text-vine-600 focus:ring-vine-500"
        />
        <span className={LABEL_CLASS}>Termett már</span>
      </label>

      <label className="mt-4 block space-y-1">
        <span className={LABEL_CLASS}>Általános jegyzet</span>
        <textarea
          {...register('notes')}
          rows={3}
          className={INPUT_CLASS}
          placeholder="Tartós háttérinformáció, ami nem egy adott eseményhez tartozik"
        />
      </label>

      {firstError && (
        <div role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {firstError}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-vine-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-vine-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-xl border border-vine-200 bg-white px-4 py-2 text-sm text-vine-700 transition-colors hover:bg-vine-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
          >
            Mégse
          </button>
        )}
        {helperText && <span className="text-xs text-vine-500 dark:text-vine-400">{helperText}</span>}
      </div>

      <datalist id={`${datalistId}-varieties`}>
        {knownVarieties.map((variety) => <option key={variety} value={variety} />)}
      </datalist>
      <datalist id={`${datalistId}-rootstocks`}>
        {knownRootstockVarieties.map((variety) => <option key={variety} value={variety} />)}
      </datalist>
      <datalist id={`${datalistId}-locations`}>
        {knownLocations.map((location) => <option key={location} value={location} />)}
      </datalist>
      <datalist id={`${datalistId}-tags`}>
        {knownTags.map((tag) => <option key={tag} value={tag} />)}
      </datalist>
    </form>
  );
}
