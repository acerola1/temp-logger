import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { indexSessionEvents } from '../lib/sessionEventSequence';
import { getErrorMessage } from '../lib/errorMessage';
import type { SessionEventInput } from '../types/events';
import type { Session, SessionEvent } from '../types/sensor';
import { SessionEventForm } from './SessionEventForm';
import { SessionEventList } from './SessionEventList';

interface SessionEventsDialogProps {
  deviceId: string;
  session: Session;
  events: SessionEvent[];
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  onClose: () => void;
  onCreateEvent: (input: SessionEventInput) => Promise<void>;
  onUpdateEvent: (eventId: string, input: SessionEventInput) => Promise<void>;
  onDeleteEvent: (eventId: string) => Promise<void>;
  createPending: boolean;
  updatePending: boolean;
  deletePending: boolean;
  createError: unknown;
  updateError: unknown;
  deleteError: unknown;
  onClearCreateError: () => void;
  onClearUpdateError: () => void;
  onClearDeleteError: () => void;
  onOpenEvent: (event: SessionEvent) => void;
  quickCreateRequest: { occurredAt: string; nonce: number } | null;
  onQuickCreateHandled: () => void;
}

export function SessionEventsDialog({
  deviceId,
  session,
  events,
  loading,
  error,
  isAdmin,
  onClose,
  onCreateEvent,
  onUpdateEvent,
  onDeleteEvent,
  createPending,
  updatePending,
  deletePending,
  createError,
  updateError,
  deleteError,
  onClearCreateError,
  onClearUpdateError,
  onClearDeleteError,
  onOpenEvent,
  quickCreateRequest,
  onQuickCreateHandled,
}: SessionEventsDialogProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editEventId, setEditEventId] = useState<string | null>(null);

  const sortedEvents = indexSessionEvents(events)
    .slice()
    .sort((l, r) => new Date(r.occurredAt).getTime() - new Date(l.occurredAt).getTime());

  useEffect(() => {
    queueMicrotask(() => {
      setShowCreateForm(false);
      setEditEventId(null);
    });
  }, [session.id]);

  useEffect(() => {
    if (!quickCreateRequest || !isAdmin) return;
    queueMicrotask(() => {
      setShowCreateForm(true);
    });
    onQuickCreateHandled();
  }, [isAdmin, onQuickCreateHandled, quickCreateRequest]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-vine-200 bg-white shadow-2xl dark:border-vine-700 dark:bg-vine-800">
        <div className="flex items-start justify-between gap-3 border-b border-vine-100 px-5 py-4 dark:border-vine-700">
          <div>
            <h2 className="text-lg font-semibold text-vine-900 dark:text-vine-50">Session események</h2>
            <p className="mt-1 text-sm text-vine-500 dark:text-vine-300">
              {session.name} · {events.length} esemény
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

        <div className="max-h-[calc(90vh-76px)] overflow-y-auto p-5">
          {isAdmin && (
            <div className="mb-4 flex items-center justify-between gap-3">
              <div />
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm((current) => !current);
                  onClearCreateError();
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-vine-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-vine-700"
              >
                {!showCreateForm && <Plus className="h-4 w-4" />}
                {showCreateForm ? 'Űrlap bezárása' : 'Új esemény'}
              </button>
            </div>
          )}

          {isAdmin && showCreateForm && (
            <div className="mb-4 rounded-2xl bg-vine-50/80 p-4 dark:bg-vine-900/40">
              <SessionEventForm
                key={quickCreateRequest?.nonce ?? 0}
                mode="create"
                deviceId={deviceId}
                sessionId={session.id}
                isPending={createPending}
                onSubmit={async (input) => {
                  await onCreateEvent(input);
                  setShowCreateForm(false);
                }}
                onCancel={() => {
                  setShowCreateForm(false);
                  onClearCreateError();
                }}
                defaultOccurredAt={quickCreateRequest?.occurredAt}
                submitError={
                  createError ? getErrorMessage(createError, 'Nem sikerült menteni az eseményt.') : null
                }
              />
            </div>
          )}

          <SessionEventList
            sortedEvents={sortedEvents}
            loading={loading}
            error={error}
            isAdmin={isAdmin}
            editEventId={editEventId}
            deviceId={deviceId}
            sessionId={session.id}
            onOpenEvent={onOpenEvent}
            onStartEdit={(eventItem) => setEditEventId(eventItem.id)}
            onCancelEdit={() => setEditEventId(null)}
            onUpdateEvent={onUpdateEvent}
            onDeleteEvent={onDeleteEvent}
            updatePending={updatePending}
            deletePending={deletePending}
            updateErrorMessage={
              updateError ? getErrorMessage(updateError, 'Nem sikerült menteni az eseményt.') : null
            }
            deleteErrorMessage={
              deleteError ? getErrorMessage(deleteError, 'Nem sikerült törölni az eseményt.') : null
            }
            onClearUpdateError={onClearUpdateError}
            onClearDeleteError={onClearDeleteError}
          />
        </div>
      </div>
    </div>
  );
}
