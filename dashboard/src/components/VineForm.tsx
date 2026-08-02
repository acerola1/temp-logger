import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { vineFormSchema } from '../lib/schemas';
import type { VineFormValues } from '../types/forms';

export interface VineCuttingOption {
  id: string;
  label: string;
}

interface VineFormProps {
  serialNumber: number;
  defaultValues: VineFormValues;
  knownVarieties: string[];
  knownRootstockVarieties: string[];
  knownTags: string[];
  cuttingOptions: VineCuttingOption[];
  isPending: boolean;
  submitLabel: string;
  helperText?: string;
  onSubmit: (values: VineFormValues) => Promise<void>;
  onCancel?: () => void;
  className?: string;
  submitError?: string | null;
}

const INPUT_CLASS =
  'w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none transition-colors focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50';
const LABEL_CLASS = 'text-sm font-medium text-vine-700 dark:text-vine-200';

export function VineForm({
  serialNumber,
  defaultValues,
  knownVarieties,
  knownRootstockVarieties,
  knownTags,
  cuttingOptions,
  isPending,
  submitLabel,
  helperText,
  onSubmit,
  onCancel,
  className,
  submitError,
}: VineFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<VineFormValues>({
    resolver: zodResolver(vineFormSchema),
    defaultValues,
  });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const plantedAtPrecision = watch('plantedAtPrecision');
  const rootstockType = watch('rootstockType');

  const firstError =
    errors.variety?.message ??
    errors.areaDescription?.message ??
    errors.plantedAtDate?.message ??
    errors.plantedAtYear?.message ??
    submitError ??
    null;

  const handleFormSubmit = async (values: VineFormValues) => {
    try {
      await onSubmit(values);
      reset(defaultValues);
    } catch (error) {
      console.error('Vine form submit error:', error);
    }
  };

  return (
    <form
      onSubmit={handleSubmit((values) => void handleFormSubmit(values))}
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
            list="known-vine-varieties"
            {...register('variety')}
            className={INPUT_CLASS}
            placeholder="pl. Kékfrankos vagy Ismeretlen"
          />
        </label>

        <label className="space-y-1">
          <span className={LABEL_CLASS}>Gyökérzet típusa</span>
          <select {...register('rootstockType')} className={INPUT_CLASS}>
            <option value="grafted">Oltott</option>
            <option value="own_rooted">Saját gyökerű</option>
            <option value="unknown">Ismeretlen</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className={LABEL_CLASS}>Alanyfajta</span>
          <input
            list="known-vine-rootstock-varieties"
            {...register('rootstockVariety')}
            className={INPUT_CLASS}
            placeholder="pl. Teleki 5C"
            disabled={rootstockType !== 'grafted'}
          />
          <span className="text-xs text-vine-500 dark:text-vine-400">
            {rootstockType === 'grafted'
              ? 'Opcionális, ha ismert.'
              : 'Csak oltott tőkénél tölthető ki.'}
          </span>
        </label>

        <label className="space-y-1">
          <span className={LABEL_CLASS}>Telepítési idő</span>
          <select {...register('plantedAtPrecision')} className={INPUT_CLASS}>
            <option value="date">Pontos dátum</option>
            <option value="year">Csak év</option>
            <option value="unknown">Ismeretlen</option>
          </select>
        </label>

        <div className="space-y-1">
          <span className={LABEL_CLASS}>
            {plantedAtPrecision === 'year' ? 'Telepítés éve' : 'Telepítés dátuma'}
          </span>
          {plantedAtPrecision === 'unknown' ? (
            <div className="rounded-xl border border-dashed border-vine-300 px-3 py-2 text-sm text-vine-500 dark:border-vine-700 dark:text-vine-300">
              Nem ismert
            </div>
          ) : plantedAtPrecision === 'year' ? (
            <input
              type="number"
              inputMode="numeric"
              min={1900}
              max={2100}
              {...register('plantedAtYear')}
              className={INPUT_CLASS}
              placeholder="pl. 1998"
            />
          ) : (
            <input type="date" {...register('plantedAtDate')} className={INPUT_CLASS} />
          )}
        </div>

        <label className="space-y-1">
          <span className={LABEL_CLASS}>Állapot</span>
          <select {...register('status')} className={INPUT_CLASS}>
            <option value="active">Aktív</option>
            <option value="removed">Megszűnt</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className={LABEL_CLASS}>Eredeti dugvány</span>
          <select {...register('sourceCuttingId')} className={INPUT_CLASS}>
            <option value="">Nincs megadva</option>
            {cuttingOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-vine-500 dark:text-vine-400">
            Csak hivatkozás, adatot nem másol át.
          </span>
        </label>
      </div>

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
          list="known-vine-tags"
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
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {firstError}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
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
            className="rounded-xl border border-vine-200 bg-white px-4 py-2 text-sm text-vine-700 transition-colors hover:bg-vine-50 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
          >
            Mégse
          </button>
        )}
        {helperText && <span className="text-xs text-vine-500 dark:text-vine-400">{helperText}</span>}
      </div>

      <datalist id="known-vine-varieties">
        {knownVarieties.map((variety) => (
          <option key={variety} value={variety} />
        ))}
      </datalist>
      <datalist id="known-vine-rootstock-varieties">
        {knownRootstockVarieties.map((variety) => (
          <option key={variety} value={variety} />
        ))}
      </datalist>
      <datalist id="known-vine-tags">
        {knownTags.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
    </form>
  );
}
