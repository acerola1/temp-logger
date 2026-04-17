import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Camera, ImagePlus, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { usePhotoPicker } from '../hooks/usePhotoPicker';
import { cuttingFormSchema, type CuttingFormValues } from '../lib/schemas';

interface CuttingFormProps {
  serialNumber: number;
  defaultValues: CuttingFormValues;
  knownVarieties: string[];
  isPending: boolean;
  submitLabel: string;
  helperText?: string;
  showPhotoUpload: boolean;
  onSubmit: (values: CuttingFormValues, files: FileList | null) => Promise<void>;
  onCancel?: () => void;
  className?: string;
}

export function CuttingForm({
  serialNumber,
  defaultValues,
  knownVarieties,
  isPending,
  submitLabel,
  helperText,
  showPhotoUpload,
  onSubmit,
  onCancel,
  className,
}: CuttingFormProps) {
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isMobileDevice, openPicker } = usePhotoPicker();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CuttingFormValues>({
    resolver: zodResolver(cuttingFormSchema),
    defaultValues,
  });

  useEffect(() => {
    reset(defaultValues);
    setSelectedFiles(null);
    setSubmitError(null);
  }, [defaultValues, reset]);

  const handleFormSubmit = async (values: CuttingFormValues) => {
    setSubmitError(null);

    try {
      await onSubmit(values, showPhotoUpload ? selectedFiles : null);
      reset(defaultValues);
      setSelectedFiles(null);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Nem sikerült menteni a dugványt.');
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
          <span className="text-sm font-medium text-vine-700 dark:text-vine-200">Sorszám</span>
          <div className="rounded-xl border border-vine-200 bg-vine-50 px-3 py-2 text-sm font-semibold text-vine-900 dark:border-vine-700 dark:bg-vine-800 dark:text-vine-50">
            #{serialNumber}
          </div>
        </div>

        <label className="space-y-1">
          <span className="text-sm font-medium text-vine-700 dark:text-vine-200">Fajta</span>
          <input
            list="known-grape-varieties"
            {...register('variety')}
            className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none transition-colors focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
            placeholder="pl. Kékfrankos"
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-vine-700 dark:text-vine-200">Típus</span>
          <select
            {...register('plantType')}
            className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none transition-colors focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
          >
            <option value="cutting">Dugvány</option>
            <option value="graft">Oltvány</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-vine-700 dark:text-vine-200">Ültetés dátuma</span>
          <input
            type="date"
            {...register('plantedAt')}
            className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none transition-colors focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-vine-700 dark:text-vine-200">Állapot</span>
          <select
            {...register('status')}
            className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none transition-colors focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
          >
            <option value="active">Aktív</option>
            <option value="rooted">Begyökeresedett</option>
            <option value="lost">Elveszett</option>
            <option value="archived">Archivált</option>
          </select>
        </label>
      </div>

      <label className="mt-4 block space-y-1">
        <span className="text-sm font-medium text-vine-700 dark:text-vine-200">Jegyzet</span>
        <textarea
          {...register('notes')}
          rows={3}
          className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none transition-colors focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
          placeholder="Rövid megjegyzés a dugvány állapotáról"
        />
      </label>

      {showPhotoUpload && (
        <label className="mt-4 block space-y-1">
          <span className="text-sm font-medium text-vine-700 dark:text-vine-200">Képek</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => setSelectedFiles(event.target.files)}
            className="hidden"
          />
          {isMobileDevice ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openPicker(fileInputRef, 'camera')}
                className="inline-flex items-center gap-2 rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-700 transition-colors hover:bg-vine-50 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
              >
                <Camera className="h-4 w-4" />
                Kamera
              </button>
              <button
                type="button"
                onClick={() => openPicker(fileInputRef, 'gallery')}
                className="inline-flex items-center gap-2 rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-700 transition-colors hover:bg-vine-50 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
              >
                <ImagePlus className="h-4 w-4" />
                Galéria
              </button>
            </div>
          ) : (
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => setSelectedFiles(event.target.files)}
              className="block w-full text-sm text-vine-700 dark:text-vine-200"
            />
          )}
          {selectedFiles && selectedFiles.length > 0 && (
            <p className="text-xs text-vine-500 dark:text-vine-400">{selectedFiles.length} kép kiválasztva</p>
          )}
          <p className="text-xs text-vine-500 dark:text-vine-400">
            A képek a kliensen 1000 px hosszabbik oldalra lesznek átméretezve.
          </p>
        </label>
      )}

      {(errors.variety?.message || errors.plantedAt?.message || submitError) && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {errors.variety?.message ?? errors.plantedAt?.message ?? submitError}
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

      <datalist id="known-grape-varieties">
        {knownVarieties.map((variety) => (
          <option key={variety} value={variety} />
        ))}
      </datalist>
    </form>
  );
}
