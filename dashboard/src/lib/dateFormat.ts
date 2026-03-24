import { format } from 'date-fns';
import { hu } from 'date-fns/locale';

type DateInput = string | number | Date;

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatDateTime(value: DateInput): string {
  return format(toDate(value), 'yyyy.MM.dd. HH:mm', { locale: hu });
}

export function formatTime(value: DateInput): string {
  return format(toDate(value), 'HH:mm', { locale: hu });
}

export function formatDateShort(value: DateInput): string {
  return format(toDate(value), 'MM.dd. HH:mm', { locale: hu });
}

export function formatRelative(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Most';
  if (mins < 60) return `${mins} perce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} órája`;
  const days = Math.floor(hours / 24);
  return `${days} napja`;
}
