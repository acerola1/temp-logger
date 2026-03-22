import { format } from 'date-fns';
import { hu } from 'date-fns/locale';

export function formatDateTime(iso: string): string {
  return format(new Date(iso), 'yyyy.MM.dd. HH:mm', { locale: hu });
}

export function formatTime(iso: string): string {
  return format(new Date(iso), 'HH:mm', { locale: hu });
}

export function formatDateShort(iso: string): string {
  return format(new Date(iso), 'MM.dd. HH:mm', { locale: hu });
}

export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Most';
  if (mins < 60) return `${mins} perce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} órája`;
  const days = Math.floor(hours / 24);
  return `${days} napja`;
}
