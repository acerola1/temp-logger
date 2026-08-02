import { Eye, Scissors, SprayCan, Trash2, type LucideIcon } from 'lucide-react';
import type { VineEventType, VineRootType, VineStatus } from '../model';

export const ROOT_TYPE_PRESENTATION: Record<
  VineRootType,
  { label: string; badgeClass: string }
> = {
  grafted: {
    label: 'Oltott',
    badgeClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
  },
  own_rooted: {
    label: 'Saját gyökerű',
    badgeClass: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200',
  },
  unknown: {
    label: 'Ismeretlen gyökérzet',
    badgeClass: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100',
  },
};

export function statusLabel(value: VineStatus): string {
  return value === 'ceased' ? 'Megszűnt' : 'Aktív';
}

export function statusBadgeClass(value: VineStatus): string {
  return value === 'ceased'
    ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
    : 'bg-vine-100 text-vine-800 dark:bg-vine-800 dark:text-vine-100';
}

export const VINE_EVENT_PRESENTATION: Record<
  VineEventType,
  { label: string; icon: LucideIcon; markerClass: string; iconClass: string }
> = {
  observation: {
    label: 'Megfigyelés',
    icon: Eye,
    markerClass: 'border-vine-500 bg-vine-50 dark:border-vine-400 dark:bg-vine-950',
    iconClass: 'text-vine-600 dark:text-vine-300',
  },
  pruning: {
    label: 'Metszés',
    icon: Scissors,
    markerClass: 'border-amber-500 bg-amber-50 dark:border-amber-400 dark:bg-amber-950',
    iconClass: 'text-amber-500 dark:text-amber-400',
  },
  spraying: {
    label: 'Permetezés',
    icon: SprayCan,
    markerClass: 'border-sky-500 bg-sky-50 dark:border-sky-400 dark:bg-sky-950',
    iconClass: 'text-sky-500 dark:text-sky-400',
  },
  ceased: {
    label: 'Megszűnés',
    icon: Trash2,
    markerClass: 'border-red-500 bg-red-50 dark:border-red-400 dark:bg-red-950',
    iconClass: 'text-red-500 dark:text-red-400',
  },
};

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

export function tagBadgeClass(value: string): string {
  const normalized = value.trim().toLocaleLowerCase('hu');
  let hash = 5381;

  for (let index = 0; index < normalized.length; index += 1) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(index)) | 0;
  }

  return TAG_BADGE_PALETTE[Math.abs(hash) % TAG_BADGE_PALETTE.length];
}
