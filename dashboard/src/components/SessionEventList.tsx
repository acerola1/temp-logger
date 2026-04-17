import { useState } from 'react';
import { deleteObject, ref } from 'firebase/storage';
import { CalendarClock, Loader2, Pencil, Trash2 } from 'lucide-react';
import { storage } from '../lib/firebase';
import { formatDateTime } from '../lib/dateFormat';
import type { IndexedSessionEvent } from '../lib/sessionEventSequence';
import { getErrorMessage } from '../lib/errorMessage';
import type { SessionEventInput } from '../types/events';
import type { SessionEvent } from '../types/sensor';
import { SessionEventForm } from './SessionEventForm';

interface SessionEventListProps {
  sortedEvents: IndexedSessionEvent[];
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  editEventId: string | null;
  deviceId: string;
  sessionId: string;
  onOpenEvent: (event: SessionEvent) => void;
  onStartEdit: (event: SessionEvent) => void;
  onCancelEdit: () => void;
  onUpdateEvent: (eventId: string, input: SessionEventInput) => Promise<void>;
  onDeleteEvent: (eventId: string) => Promise<void>;
  updatePending: boolean;
  deletePending: boolean;
  updateErrorMessage: string | null;
  deleteErrorMessage: string | null;
  onClearUpdateError: () => void;
  onClearDeleteError: () => void;
}

export function SessionEventList({
  sortedEvents,
  loading,
  error,
  isAdmin,
  editEventId,
  deviceId,
  sessionId,
  onOpenEvent,
  onStartEdit,
  onCancelEdit,
  onUpdateEvent,
  onDeleteEvent,
  updatePending,
  deletePending,
  updateErrorMessage,
  deleteErrorMessage,
  onClearUpdateError,
  onClearDeleteError,
}: SessionEventListProps) {
  const [storageActionError, setStorageActionError] = useState<string | null>(null);

  const handleDelete = async (eventItem: IndexedSessionEvent) => {
    const confirmed = window.confirm('Biztosan törlöd ezt a session eseményt?');
    if (!confirmed) return;

    setStorageActionError(null);
    onClearDeleteError();

    try {
      if (eventItem.imageStoragePath) {
        await deleteObject(ref(storage, eventItem.imageStoragePath));
      }
      await onDeleteEvent(eventItem.id);
      if (editEventId === eventItem.id) {
        onCancelEdit();
      }
    } catch (err) {
      console.error('Session event delete error:', err);
      setStorageActionError(getErrorMessage(err, 'Nem sikerült törölni az eseményt.'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center text-sm text-vine-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Session események betöltése...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
        {error}
      </div>
    );
  }

  if (sortedEvents.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-vine-300 px-4 py-6 text-sm text-vine-500 dark:border-vine-700 dark:text-vine-300">
        Ehhez a sessionhöz még nincs esemény.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {(storageActionError || deleteErrorMessage) && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {storageActionError ?? deleteErrorMessage}
        </div>
      )}

      {sortedEvents.map((eventItem) => {
        const isEditing = editEventId === eventItem.id;

        return (
          <div
            key={eventItem.id}
            className="rounded-2xl border border-vine-200 bg-vine-50/70 px-4 py-3 dark:border-vine-700 dark:bg-vine-900/40"
          >
            {isEditing ? (
              <SessionEventForm
                mode="edit"
                deviceId={deviceId}
                sessionId={sessionId}
                event={eventItem}
                isPending={updatePending}
                onSubmit={(input) => onUpdateEvent(eventItem.id, input)}
                onCancel={() => {
                  onCancelEdit();
                  onClearUpdateError();
                }}
                submitError={isEditing ? updateErrorMessage : null}
              />
            ) : (
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <button
                  type="button"
                  onClick={() => onOpenEvent(eventItem)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-2 text-vine-900 dark:text-vine-50">
                    <CalendarClock className="h-4 w-4 text-vine-500" />
                    <span className="font-medium">
                      #{eventItem.sequenceNumber} {eventItem.title}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-vine-500 dark:text-vine-300">
                    {formatDateTime(eventItem.occurredAt)}
                  </p>
                  {eventItem.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-vine-600 dark:text-vine-200">
                      {eventItem.description}
                    </p>
                  )}
                </button>

                {isAdmin && (
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onStartEdit(eventItem);
                        onClearUpdateError();
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-vine-200 bg-white px-2.5 py-1.5 text-xs font-medium text-vine-700 transition-colors hover:bg-vine-100 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Szerkesztés
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(eventItem)}
                      disabled={deletePending}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-red-900 dark:bg-vine-900 dark:text-red-300 dark:hover:bg-red-950/30"
                    >
                      {deletePending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Törlés
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
