import type { Cutting, CuttingPhoto, CuttingStatus } from '../types/cutting';

export function toDateInputValue(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().slice(0, 10);
}

export function getCuttingPath(cuttingId: string | null): string {
  return cuttingId ? `/dugvanyok/${cuttingId}` : '/dugvanyok';
}

export function getCuttingIdFromPath(pathname: string): string | null {
  if (!pathname.startsWith('/dugvanyok/')) {
    return null;
  }

  const cuttingId = pathname.slice('/dugvanyok/'.length).split('/')[0];
  return cuttingId || null;
}

export function plantTypeLabel(value: Cutting['plantType']) {
  return value === 'graft' ? 'Oltvány' : 'Dugvány';
}

export function statusLabel(value: CuttingStatus) {
  switch (value) {
    case 'rooted':
      return 'Begyökeresedett';
    case 'lost':
      return 'Elveszett';
    case 'archived':
      return 'Archivált';
    default:
      return 'Aktív';
  }
}

export function statusBadgeClass(value: CuttingStatus) {
  switch (value) {
    case 'rooted':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
    case 'lost':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200';
    case 'archived':
      return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100';
    default:
      return 'bg-vine-100 text-vine-800 dark:bg-vine-800 dark:text-vine-100';
  }
}

export function toCuttingPhotos(
  uploads: Array<{ storagePath: string; downloadUrl: string; width: number; height: number }>,
): CuttingPhoto[] {
  const now = new Date().toISOString();

  return uploads.map((item) => {
    const fileName = item.storagePath.split('/').at(-1) ?? '';
    const photoId = fileName.split('.')[0] ?? crypto.randomUUID();

    return {
      id: photoId,
      storagePath: item.storagePath,
      downloadUrl: item.downloadUrl,
      capturedAt: now,
      uploadedAt: now,
      width: item.width,
      height: item.height,
      caption: '',
    } satisfies CuttingPhoto;
  });
}
