import { Eye, Scissors, SprayCan, Trash2, type LucideIcon } from 'lucide-react';
import { formatDate } from '../lib/dateFormat';
import type {
  VineEventType,
  VinePlantedAt,
  VineRootstockType,
  VineStatus,
} from '../types/vine';
import type { VineFormValues } from '../types/forms';

export function getVinePath(vineId: string | null): string {
  return vineId ? `/tokek/${vineId}` : '/tokek';
}

export function getVineIdFromPath(pathname: string): string | null {
  if (!pathname.startsWith('/tokek/')) {
    return null;
  }

  const vineId = pathname.slice('/tokek/'.length).split('/')[0];
  return vineId || null;
}

export function rootstockTypeLabel(value: VineRootstockType): string {
  switch (value) {
    case 'grafted':
      return 'Oltott';
    case 'own_rooted':
      return 'Saját gyökerű';
    default:
      return 'Ismeretlen gyökérzet';
  }
}

export function rootstockBadgeClass(value: VineRootstockType): string {
  switch (value) {
    case 'grafted':
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200';
    case 'own_rooted':
      return 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200';
    default:
      return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100';
  }
}

export function vineStatusLabel(value: VineStatus): string {
  return value === 'removed' ? 'Megszűnt' : 'Aktív';
}

export function vineStatusBadgeClass(value: VineStatus): string {
  return value === 'removed'
    ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
    : 'bg-vine-100 text-vine-800 dark:bg-vine-800 dark:text-vine-100';
}

export function vineEventTypeLabel(value: VineEventType): string {
  switch (value) {
    case 'pruning':
      return 'Metszés';
    case 'spraying':
      return 'Permetezés';
    case 'removal':
      return 'Megszűnés';
    default:
      return 'Megfigyelés';
  }
}

export const VINE_EVENT_TYPE_OPTIONS: VineEventType[] = [
  'observation',
  'pruning',
  'spraying',
  'removal',
];

export const VINE_EVENT_TYPE_ICON: Record<VineEventType, LucideIcon> = {
  observation: Eye,
  pruning: Scissors,
  spraying: SprayCan,
  removal: Trash2,
};

export function vineEventMarkerClasses(value: VineEventType): { dot: string; icon: string } {
  switch (value) {
    case 'pruning':
      return {
        dot: 'border-amber-500 bg-amber-50 dark:border-amber-400 dark:bg-amber-950',
        icon: 'text-amber-500 dark:text-amber-400',
      };
    case 'spraying':
      return {
        dot: 'border-sky-500 bg-sky-50 dark:border-sky-400 dark:bg-sky-950',
        icon: 'text-sky-500 dark:text-sky-400',
      };
    case 'removal':
      return {
        dot: 'border-red-500 bg-red-50 dark:border-red-400 dark:bg-red-950',
        icon: 'text-red-500 dark:text-red-400',
      };
    default:
      return {
        dot: 'border-vine-500 bg-vine-50 dark:border-vine-400 dark:bg-vine-950',
        icon: 'text-vine-600 dark:text-vine-300',
      };
  }
}

export function formatPlantedAt(value: VinePlantedAt): string {
  switch (value.precision) {
    case 'date':
      return formatDate(value.date);
    case 'year':
      return `${value.year}.`;
    default:
      return 'Ismeretlen';
  }
}

// Rendezéshez: az ismeretlen telepítési idő a lista végére kerül.
export function plantedAtSortValue(value: VinePlantedAt): number {
  switch (value.precision) {
    case 'date':
      return new Date(value.date).getTime();
    case 'year':
      return new Date(value.year, 0, 1).getTime();
    default:
      return Number.NEGATIVE_INFINITY;
  }
}

const TAG_BADGE_PALETTE: readonly string[] = [
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

export function vineTagBadgeClass(value: string): string {
  const normalized = value.trim().toLocaleLowerCase('hu');
  let hash = 5381;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(i)) | 0;
  }
  return TAG_BADGE_PALETTE[Math.abs(hash) % TAG_BADGE_PALETTE.length];
}

export function parseTagsInput(value: string): string[] {
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

export function formatTagsInput(values: string[]): string {
  return values.join(', ');
}

export function toPlantedAt(values: VineFormValues): VinePlantedAt {
  if (values.plantedAtPrecision === 'date') {
    return { precision: 'date', date: values.plantedAtDate };
  }
  if (values.plantedAtPrecision === 'year') {
    return { precision: 'year', year: Number(values.plantedAtYear.trim()) };
  }
  return { precision: 'unknown' };
}

export function fromPlantedAt(value: VinePlantedAt): {
  plantedAtPrecision: VineFormValues['plantedAtPrecision'];
  plantedAtDate: string;
  plantedAtYear: string;
} {
  switch (value.precision) {
    case 'date':
      return {
        plantedAtPrecision: 'date',
        plantedAtDate: value.date,
        plantedAtYear: String(new Date(value.date).getFullYear()),
      };
    case 'year':
      return {
        plantedAtPrecision: 'year',
        plantedAtDate: '',
        plantedAtYear: String(value.year),
      };
    default:
      return { plantedAtPrecision: 'unknown', plantedAtDate: '', plantedAtYear: '' };
  }
}
