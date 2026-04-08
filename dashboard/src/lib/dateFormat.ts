import { format } from 'date-fns';
import { hu } from 'date-fns/locale';

type DateInput = string | number | Date;

function isDateOnlyString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toDate(value: DateInput): Date {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string' && isDateOnlyString(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date(value);
}

export function formatDateTime(value: DateInput): string {
  return format(toDate(value), 'yyyy.MM.dd. HH:mm', { locale: hu });
}

export function formatDate(value: DateInput): string {
  return format(toDate(value), 'yyyy.MM.dd.', { locale: hu });
}

export function formatTime(value: DateInput): string {
  return format(toDate(value), 'HH:mm', { locale: hu });
}

export function formatDateShort(value: DateInput): string {
  return format(toDate(value), 'MM.dd. HH:mm', { locale: hu });
}

export function formatMonthDay(value: DateInput): string {
  return format(toDate(value), 'MM.dd.', { locale: hu });
}

export function formatRelative(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins <= -1) return `${Math.abs(mins)} perc múlva`;
  if (mins < 1) return 'Most';
  if (mins < 60) return `${mins} perce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} órája`;
  const days = Math.floor(hours / 24);
  return `${days} napja`;
}
