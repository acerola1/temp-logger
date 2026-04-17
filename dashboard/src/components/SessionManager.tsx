import { useEffect, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { X, Plus, Archive } from 'lucide-react';
import { sessionCreateSchema } from '../lib/schemas';
import { getErrorMessage } from '../lib/errorMessage';
import type { Session, SessionType } from '../types/sensor';
import type { SessionCreateValues } from '../types/forms';

interface SessionManagerProps {
  sessions: Session[];
  deviceName: string | null;
  sessionTypes: SessionType[];
  defaultSessionTypeId: string | null;
  creating: boolean;
  archiving: boolean;
  onClose: () => void;
  onCreateSession: (name: string, sessionTypeId: string) => Promise<void>;
  onArchiveSession: (id: string) => Promise<void>;
  createError: unknown;
  archiveError: unknown;
  onClearCreateError: () => void;
  onClearArchiveError: () => void;
}

export function SessionManager({
  sessions,
  deviceName,
  sessionTypes,
  defaultSessionTypeId,
  creating,
  archiving,
  onClose,
  onCreateSession,
  onArchiveSession,
  createError,
  archiveError,
  onClearCreateError,
  onClearArchiveError,
}: SessionManagerProps) {
  const activeSession = sessions.find((s) => s.status === 'active');
  const fallbackSessionTypeId = useMemo(
    () => defaultSessionTypeId ?? sessionTypes[0]?.id ?? '',
    [defaultSessionTypeId, sessionTypes],
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isValid },
  } = useForm<SessionCreateValues>({
    resolver: zodResolver(sessionCreateSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      sessionTypeId: fallbackSessionTypeId,
    },
  });

  useEffect(() => {
    setValue('sessionTypeId', fallbackSessionTypeId);
  }, [fallbackSessionTypeId, setValue]);

  const handleCreate = async (values: SessionCreateValues) => {
    if (activeSession) {
      return;
    }
    onClearCreateError();
    await onCreateSession(values.name.trim(), values.sessionTypeId);
    reset({ name: '', sessionTypeId: values.sessionTypeId });
  };

  const handleArchive = async (id: string) => {
    onClearArchiveError();
    await onArchiveSession(id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-vine-200 bg-white shadow-2xl dark:border-vine-700 dark:bg-vine-800">
        <div className="flex items-center justify-between border-b border-vine-100 px-5 py-4 dark:border-vine-700">
          <h2 className="text-lg font-semibold text-vine-900 dark:text-vine-50">Session kezelés</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 transition-colors hover:bg-vine-100 dark:hover:bg-vine-700"
          >
            <X className="h-5 w-5 text-vine-500" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-vine-700 dark:text-vine-200">
              Új session létrehozása
            </label>
            <p className="mb-2 text-xs text-vine-500 dark:text-vine-300">
              A session ehhez a szenzorhoz jön létre:{' '}
              <span className="font-semibold text-vine-700 dark:text-vine-100">
                {deviceName ?? 'ismeretlen eszköz'}
              </span>
            </p>
            {activeSession && (
              <p className="mb-2 text-xs text-amber-600 dark:text-amber-400">
                Aktív session: &ldquo;{activeSession.name}&rdquo; &mdash; előbb zárd le, ha újat szeretnél.
              </p>
            )}
            <form onSubmit={handleSubmit(handleCreate)} className="space-y-2">
              <select
                {...register('sessionTypeId')}
                disabled={!!activeSession || creating}
                className="w-full rounded-lg border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 focus:outline-none focus:ring-2 focus:ring-vine-400 disabled:opacity-50 dark:border-vine-600 dark:bg-vine-900 dark:text-vine-50"
              >
                <option value="" disabled>
                  Válassz session típust
                </option>
                {sessionTypes.map((sessionType) => (
                  <option key={sessionType.id} value={sessionType.id}>
                    {sessionType.name}
                  </option>
                ))}
              </select>

              <div className="flex gap-2">
                <input
                  type="text"
                  {...register('name')}
                  placeholder="pl. 2026 tavasz"
                  disabled={!!activeSession || creating}
                  className="flex-1 rounded-lg border border-vine-200 bg-white px-3 py-2 text-sm text-vine-900 placeholder:text-vine-300 focus:outline-none focus:ring-2 focus:ring-vine-400 disabled:opacity-50 dark:border-vine-600 dark:bg-vine-900 dark:text-vine-50"
                />
                <button
                  type="submit"
                  disabled={!isValid || !!activeSession || creating}
                  className="flex items-center gap-1 rounded-lg bg-vine-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-vine-700 disabled:opacity-50 disabled:hover:bg-vine-600"
                >
                  <Plus className="h-4 w-4" />
                  Létrehozás
                </button>
              </div>

              {(errors.name?.message || errors.sessionTypeId?.message) && (
                <p className="text-xs text-red-600 dark:text-red-300">
                  {errors.name?.message ?? errors.sessionTypeId?.message}
                </p>
              )}

              {Boolean(createError) && (
                <p className="text-xs text-red-600 dark:text-red-300">
                  {getErrorMessage(createError, 'Nem sikerült létrehozni a sessiont.')}
                </p>
              )}
            </form>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-vine-700 dark:text-vine-200">Session-ök</h3>
            {sessions.length === 0 ? (
              <p className="text-sm text-vine-400">Még nincs session.</p>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-y-auto">
                {sessions.map((session) => (
                  <li
                    key={session.id}
                    className="flex items-center justify-between rounded-lg border border-vine-100 bg-vine-50 px-3 py-2 dark:border-vine-700 dark:bg-vine-900/50"
                  >
                    <div>
                      <p className="text-sm font-medium text-vine-900 dark:text-vine-50">{session.name}</p>
                      <p className="text-xs text-vine-400">
                        {new Date(session.startDate).toLocaleDateString('hu-HU')}
                        {session.endDate && ` – ${new Date(session.endDate).toLocaleDateString('hu-HU')}`}
                        {session.status === 'active' && (
                          <span className="ml-2 font-medium text-green-600 dark:text-green-400">aktív</span>
                        )}
                      </p>
                    </div>
                    {session.status === 'active' && (
                      <button
                        onClick={() => void handleArchive(session.id)}
                        disabled={archiving}
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-vine-600 transition-colors hover:bg-vine-100 disabled:opacity-50 dark:text-vine-300 dark:hover:bg-vine-700"
                        title="Session lezárása"
                      >
                        <Archive className="h-3.5 w-3.5" />
                        Lezárás
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {Boolean(archiveError) && (
            <p className="text-xs text-red-600 dark:text-red-300">
              {getErrorMessage(archiveError, 'Nem sikerült lezárni a sessiont.')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
