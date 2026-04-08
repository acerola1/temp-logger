import { X } from 'lucide-react';
import { formatDateTime } from '../lib/dateFormat';
import type { SessionEvent } from '../types/sensor';

interface SessionEventDialogProps {
  event: SessionEvent;
  onClose: () => void;
}

export function SessionEventDialog({ event, onClose }: SessionEventDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-vine-200 bg-white shadow-2xl dark:border-vine-700 dark:bg-vine-800">
        <div className="flex items-start justify-between gap-3 border-b border-vine-100 px-5 py-4 dark:border-vine-700">
          <div>
            <h2 className="text-lg font-semibold text-vine-900 dark:text-vine-50">{event.title}</h2>
            <p className="mt-1 text-sm text-vine-500 dark:text-vine-300">
              {formatDateTime(event.occurredAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 transition-colors hover:bg-vine-100 dark:hover:bg-vine-700"
          >
            <X className="h-5 w-5 text-vine-500" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {event.description && (
            <div className="rounded-xl bg-vine-50 px-4 py-3 text-sm text-vine-700 dark:bg-vine-900/50 dark:text-vine-100">
              {event.description}
            </div>
          )}

          {event.imageUrl && (
            <a href={event.imageUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl border border-vine-200 dark:border-vine-700">
              <img src={event.imageUrl} alt={event.title} className="max-h-[420px] w-full object-cover" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
