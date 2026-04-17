import { useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { deleteObject, ref } from 'firebase/storage';
import { Camera, ImagePlus, Loader2, X } from 'lucide-react';
import { storage } from '../lib/firebase';
import { toDateTimeLocalValue } from '../lib/dateFormat';
import { usePhotoPicker } from '../hooks/usePhotoPicker';
import { usePhotoUpload } from '../hooks/usePhotoUpload';
import { sessionEventSchema, type SessionEventValues } from '../lib/schemas';
import type { SessionEvent } from '../types/sensor';

export interface SessionEventInput {
  title: string;
  description: string;
  occurredAt: string;
  imageUrl?: string | null;
  imageStoragePath?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
}

interface SessionEventFormProps {
  mode: 'create' | 'edit';
  deviceId: string;
  sessionId: string;
  event?: SessionEvent | null;
  isPending: boolean;
  onSubmit: (input: SessionEventInput) => Promise<void>;
  onCancel?: () => void;
  defaultOccurredAt?: string;
}

function makeCreateDefaults(occurredAt?: string): SessionEventValues {
  return { title: '', description: '', occurredAt: occurredAt ?? toDateTimeLocalValue() };
}

function makeEditDefaults(event: SessionEvent): SessionEventValues {
  return {
    title: event.title,
    description: event.description,
    occurredAt: toDateTimeLocalValue(event.occurredAt),
  };
}

export function SessionEventForm({
  mode,
  deviceId,
  sessionId,
  event,
  isPending,
  onSubmit,
  onCancel,
  defaultOccurredAt,
}: SessionEventFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { isMobileDevice, openPicker } = usePhotoPicker();
  const { upload: uploadPhotos, uploading: uploadingPhoto, error: photoUploadError } = usePhotoUpload();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SessionEventValues>({
    resolver: zodResolver(sessionEventSchema),
    defaultValues: mode === 'edit' && event ? makeEditDefaults(event) : makeCreateDefaults(defaultOccurredAt),
  });

  const handleCreate = async (values: SessionEventValues) => {
    setSubmitError(null);
    let uploadedImage: { imageUrl: string; imageStoragePath: string; imageWidth: number; imageHeight: number } | null =
      null;

    try {
      if (selectedFile) {
        const tempId = crypto.randomUUID();
        const [uploaded] = await uploadPhotos({
          files: [selectedFile],
          storagePathPrefix: `sessions/${deviceId}/${sessionId}/events`,
          buildStoragePath: ({ extension }) => `${tempId}.${extension}`,
        });
        uploadedImage = uploaded
          ? { imageUrl: uploaded.downloadUrl, imageStoragePath: uploaded.storagePath, imageWidth: uploaded.width, imageHeight: uploaded.height }
          : null;
      }

      await onSubmit({
        title: values.title.trim(),
        description: values.description.trim(),
        occurredAt: new Date(values.occurredAt).toISOString(),
        ...uploadedImage,
      });

      reset(makeCreateDefaults());
      setSelectedFile(null);
    } catch (err) {
      console.error('Session event create error:', err);
      setSubmitError(err instanceof Error ? err.message : 'Nem sikerült menteni az eseményt.');
    }
  };

  const handleEdit = async (values: SessionEventValues) => {
    if (!event) return;
    setSubmitError(null);

    let nextImageUrl = event.imageUrl;
    let nextImageStoragePath = event.imageStoragePath;
    let nextImageWidth = event.imageWidth;
    let nextImageHeight = event.imageHeight;

    try {
      if ((removeImage || selectedFile) && event.imageStoragePath) {
        await deleteObject(ref(storage, event.imageStoragePath));
        nextImageUrl = null;
        nextImageStoragePath = null;
        nextImageWidth = null;
        nextImageHeight = null;
      }

      if (selectedFile) {
        const [uploaded] = await uploadPhotos({
          files: [selectedFile],
          storagePathPrefix: `sessions/${deviceId}/${sessionId}/events`,
          buildStoragePath: ({ extension }) => `${event.id}.${extension}`,
        });
        nextImageUrl = uploaded?.downloadUrl ?? null;
        nextImageStoragePath = uploaded?.storagePath ?? null;
        nextImageWidth = uploaded?.width ?? null;
        nextImageHeight = uploaded?.height ?? null;
      }

      await onSubmit({
        title: values.title.trim(),
        description: values.description.trim(),
        occurredAt: new Date(values.occurredAt).toISOString(),
        imageUrl: nextImageUrl,
        imageStoragePath: nextImageStoragePath,
        imageWidth: nextImageWidth,
        imageHeight: nextImageHeight,
      });
    } catch (err) {
      console.error('Session event update error:', err);
      setSubmitError(err instanceof Error ? err.message : 'Nem sikerült menteni az eseményt.');
    }
  };

  const onFormSubmit = handleSubmit((values) => {
    if (mode === 'create') void handleCreate(values);
    else void handleEdit(values);
  });

  const formError =
    (errors.title?.message as string | undefined) ||
    (errors.occurredAt?.message as string | undefined) ||
    photoUploadError ||
    submitError;

  return (
    <form onSubmit={onFormSubmit} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
        <label className="space-y-1">
          <span className="text-xs font-medium text-vine-700 dark:text-vine-200">Időpont</span>
          <input
            type="datetime-local"
            {...register('occurredAt')}
            className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-vine-700 dark:text-vine-200">Cím</span>
          <input
            {...register('title')}
            placeholder={mode === 'create' ? 'pl. Átrakva a másik sátorba' : undefined}
            className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-vine-700 dark:text-vine-200">Leírás</span>
        <textarea
          {...register('description')}
          rows={3}
          className="w-full rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 outline-none focus:border-vine-500 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
        />
      </label>

      <div className="space-y-1">
        <span className="text-xs font-medium text-vine-700 dark:text-vine-200">Kép</span>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
          />
          {isMobileDevice ? (
            <>
              <button
                type="button"
                onClick={() => openPicker(fileRef, 'camera')}
                disabled={isPending || uploadingPhoto}
                className="inline-flex items-center gap-2 rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-700 transition-colors hover:bg-vine-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
              >
                <Camera className="h-4 w-4" />
                Fotózás
              </button>
              <button
                type="button"
                onClick={() => openPicker(fileRef, 'gallery')}
                disabled={isPending || uploadingPhoto}
                className="inline-flex items-center gap-2 rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-700 transition-colors hover:bg-vine-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
              >
                <ImagePlus className="h-4 w-4" />
                Galéria
              </button>
            </>
          ) : (
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-700 transition-colors hover:bg-vine-100 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800">
              <ImagePlus className="h-4 w-4" />
              {mode === 'edit' ? 'Kép cseréje' : 'Kép kiválasztása'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
            </label>
          )}
          {selectedFile && (
            <span className="text-xs text-vine-500 dark:text-vine-300">{selectedFile.name}</span>
          )}
          {mode === 'edit' && event?.imageUrl && (
            <button
              type="button"
              onClick={() => setRemoveImage((v) => !v)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
                removeImage
                  ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300'
                  : 'border-vine-200 bg-white text-vine-700 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100'
              }`}
            >
              <X className="h-4 w-4" />
              {removeImage ? 'Képtörlés visszavonása' : 'Kép törlése'}
            </button>
          )}
        </div>
      </div>

      {formError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {formError}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={isPending || uploadingPhoto}
          className="inline-flex items-center gap-2 rounded-xl bg-vine-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-vine-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {(isPending || uploadingPhoto) && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === 'create' ? 'Esemény mentése' : 'Mentés'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-vine-200 bg-white px-4 py-2 text-sm text-vine-700 transition-colors hover:bg-vine-100 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
          >
            Mégse
          </button>
        )}
      </div>
    </form>
  );
}
