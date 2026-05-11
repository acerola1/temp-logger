import { Droplet, Handshake, Skull, TreePine, type LucideIcon } from 'lucide-react';
import type {
  Cutting,
  CuttingEventType,
  CuttingPhoto,
  CuttingStatus,
} from '../types/cutting';

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
    case 'lost':
      return 'Elpusztult';
    case 'archived':
      return 'Archivált';
    default:
      return 'Aktív';
  }
}

export function statusBadgeClass(value: CuttingStatus) {
  switch (value) {
    case 'lost':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200';
    case 'archived':
      return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100';
    default:
      return 'bg-vine-100 text-vine-800 dark:bg-vine-800 dark:text-vine-100';
  }
}

export function eventTypeLabel(value: CuttingEventType): string {
  switch (value) {
    case 'handover':
      return 'Átadás';
    case 'planting_out':
      return 'Kiültetés';
    case 'perished':
      return 'Elpusztulás';
    default:
      return 'Öntözés';
  }
}

export const EVENT_TYPE_ICON: Record<CuttingEventType, LucideIcon> = {
  watering: Droplet,
  handover: Handshake,
  planting_out: TreePine,
  perished: Skull,
};

export function eventTypeStatusOnArchive(
  value: CuttingEventType,
): CuttingStatus | null {
  switch (value) {
    case 'handover':
    case 'planting_out':
      return 'archived';
    case 'perished':
      return 'lost';
    default:
      return null;
  }
}

export function eventTypeMarkerClasses(value: CuttingEventType): {
  dot: string;
  icon: string;
} {
  switch (value) {
    case 'handover':
      return {
        dot: 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950',
        icon: 'text-indigo-500 dark:text-indigo-400',
      };
    case 'planting_out':
      return {
        dot: 'border-teal-500 bg-teal-50 dark:border-teal-400 dark:bg-teal-950',
        icon: 'text-teal-500 dark:text-teal-400',
      };
    case 'perished':
      return {
        dot: 'border-red-500 bg-red-50 dark:border-red-400 dark:bg-red-950',
        icon: 'text-red-500 dark:text-red-400',
      };
    default:
      return {
        dot: 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950',
        icon: 'text-blue-500 dark:text-blue-400',
      };
  }
}

const CATEGORY_BADGE_PALETTE: readonly string[] = [
  'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
  'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
  'bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-200',
  'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200',
  'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-200',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
];

export function categoryBadgeClass(value: string): string {
  const normalized = value.trim().toLocaleLowerCase('hu');
  let hash = 5381;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % CATEGORY_BADGE_PALETTE.length;
  return CATEGORY_BADGE_PALETTE[index];
}

export function parseCategoriesInput(value: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of value.split(',')) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLocaleLowerCase('hu');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

export function formatCategoriesInput(values: string[]): string {
  return values.join(', ');
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
