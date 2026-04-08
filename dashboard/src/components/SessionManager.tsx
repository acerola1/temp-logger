import { useEffect, useState } from 'react';
import { X, Plus, Archive } from 'lucide-react';
import type { Session, SessionType } from '../types/sensor';

interface SessionManagerProps {
  sessions: Session[];
  deviceName: string | null;
  sessionTypes: SessionType[];
  defaultSessionTypeId: string | null;
  onClose: () => void;
  onCreateSession: (name: string, sessionTypeId: string) => Promise<void>;
  onArchiveSession: (id: string) => Promise<void>;
}

export function SessionManager({
  sessions,
  deviceName,
  sessionTypes,
  defaultSessionTypeId,
  onClose,
  onCreateSession,
  onArchiveSession,
}: SessionManagerProps) {
  const [newName, setNewName] = useState('');
  const [newSessionTypeId, setNewSessionTypeId] = useState<string>(defaultSessionTypeId ?? '');
  const [creating, setCreating] = useState(false);
  const [archiving, setArchiving] = useState<string | null>(null);

  const activeSession = sessions.find((s) => s.status === 'active');

  useEffect(() => {
    setNewSessionTypeId(defaultSessionTypeId ?? sessionTypes[0]?.id ?? '');
  }, [defaultSessionTypeId, sessionTypes]);

  const handleCreate = async () => {
    if (!newName.trim() || !newSessionTypeId) return;
    setCreating(true);
    try {
      await onCreateSession(newName.trim(), newSessionTypeId);
      setNewName('');
    } finally {
      setCreating(false);
    }
  };

  const handleArchive = async (id: string) => {
    setArchiving(id);
    try {
      await onArchiveSession(id);
    } finally {
      setArchiving(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-vine-800 rounded-2xl border border-vine-200 dark:border-vine-700 shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-vine-100 dark:border-vine-700">
          <h2 className="text-lg font-semibold text-vine-900 dark:text-vine-50">
            Session kezelés
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-vine-100 dark:hover:bg-vine-700 transition-colors"
          >
            <X className="w-5 h-5 text-vine-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Create new session */}
          <div>
            <label className="block text-sm font-medium text-vine-700 dark:text-vine-200 mb-1.5">
              Új session létrehozása
            </label>
            <p className="text-xs text-vine-500 dark:text-vine-300 mb-2">
              A session ehhez a szenzorhoz jön létre:{' '}
              <span className="font-semibold text-vine-700 dark:text-vine-100">
                {deviceName ?? 'ismeretlen eszköz'}
              </span>
            </p>
            {activeSession && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
                Aktív session: &ldquo;{activeSession.name}&rdquo; &mdash; előbb zárd le, ha újat szeretnél.
              </p>
            )}
            <div className="space-y-2">
              <select
                value={newSessionTypeId}
                onChange={(event) => setNewSessionTypeId(event.target.value)}
                disabled={!!activeSession || creating}
                className="w-full px-3 py-2 rounded-lg border border-vine-200 dark:border-vine-600 bg-white dark:bg-vine-900 text-vine-900 dark:text-vine-50 text-sm disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-vine-400"
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
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="pl. 2026 tavasz"
                disabled={!!activeSession || creating}
                className="flex-1 px-3 py-2 rounded-lg border border-vine-200 dark:border-vine-600 bg-white dark:bg-vine-900 text-vine-900 dark:text-vine-50 text-sm placeholder:text-vine-300 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-vine-400"
              />
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || !newSessionTypeId || !!activeSession || creating}
                className="flex items-center gap-1 px-3 py-2 rounded-lg bg-vine-600 text-white text-sm font-medium hover:bg-vine-700 disabled:opacity-50 disabled:hover:bg-vine-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Létrehozás
              </button>
              </div>
            </div>
          </div>

          {/* Session list */}
          <div>
            <h3 className="text-sm font-medium text-vine-700 dark:text-vine-200 mb-2">
              Session-ök
            </h3>
            {sessions.length === 0 ? (
              <p className="text-sm text-vine-400">Még nincs session.</p>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {sessions.map((session) => (
                  <li
                    key={session.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-vine-50 dark:bg-vine-900/50 border border-vine-100 dark:border-vine-700"
                  >
                    <div>
                      <p className="text-sm font-medium text-vine-900 dark:text-vine-50">
                        {session.name}
                      </p>
                      <p className="text-xs text-vine-400">
                        {new Date(session.startDate).toLocaleDateString('hu-HU')}
                        {session.endDate && ` – ${new Date(session.endDate).toLocaleDateString('hu-HU')}`}
                        {session.status === 'active' && (
                          <span className="ml-2 text-green-600 dark:text-green-400 font-medium">aktív</span>
                        )}
                      </p>
                    </div>
                    {session.status === 'active' && (
                      <button
                        onClick={() => handleArchive(session.id)}
                        disabled={archiving === session.id}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-vine-600 dark:text-vine-300 hover:bg-vine-100 dark:hover:bg-vine-700 transition-colors disabled:opacity-50"
                        title="Session lezárása"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        Lezárás
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
