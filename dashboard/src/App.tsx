import { useState } from 'react';
import { deleteDoc, doc } from 'firebase/firestore';
import { AuthProvider } from './lib/auth';
import { Header } from './components/Header';
import { SummaryCards } from './components/SummaryCards';
import { TimeRangeSelector } from './components/TimeRangeSelector';
import { TemperatureChart } from './components/TemperatureChart';
import { HumidityChart } from './components/HumidityChart';
import { ReadingsTable } from './components/ReadingsTable';
import { SessionSelector } from './components/SessionSelector';
import { SessionManager } from './components/SessionManager';
import { useTheme } from './hooks/useTheme';
import { useReadings } from './hooks/useReadings';
import { useFirestoreReadings } from './hooks/useFirestoreReadings';
import { useIsAdmin } from './hooks/useIsAdmin';
import { useSessions } from './hooks/useSessions';
import { db } from './lib/firebase';
import type { TimeRange } from './types/sensor';
import { Loader2 } from 'lucide-react';

function Dashboard() {
  const { theme, toggle } = useTheme();
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [sessionManagerOpen, setSessionManagerOpen] = useState(false);

  const { sessions, activeSession, loading: sessionsLoading, createSession, archiveSession } = useSessions();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null | undefined>(undefined);

  // `undefined` means no explicit user choice yet, so default to the active session.
  // `null` means the user explicitly chose "Összes mérés".
  const effectiveSessionId =
    selectedSessionId === undefined ? activeSession?.id ?? null : selectedSessionId;

  const { readings: allReadings, loading, error } = useFirestoreReadings(effectiveSessionId);
  const { readings, latest, stats } = useReadings(allReadings, timeRange);
  const { isAdmin } = useIsAdmin();
  const isDark = theme === 'dark';

  const selectedSession = sessions.find((s) => s.id === effectiveSessionId);

  const handleDeleteReading = async (readingId: string) => {
    await deleteDoc(doc(db, 'sensorReadings', readingId));
  };

  return (
    <div className="min-h-dvh bg-vine-50 dark:bg-vine-900 transition-colors">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <Header
          theme={theme}
          isAdmin={isAdmin}
          onToggleTheme={toggle}
          onOpenSessionManager={() => setSessionManagerOpen(true)}
        />

        {!sessionsLoading && sessions.length > 0 && (
          <SessionSelector
            sessions={sessions}
            selectedId={selectedSessionId === undefined ? effectiveSessionId : selectedSessionId}
            onChange={setSelectedSessionId}
          />
        )}

        {selectedSession && (
          <div className="mb-4 text-sm text-vine-500 dark:text-vine-400">
            {selectedSession.name}
            {selectedSession.status === 'archived' && ' (archivált)'}
          </div>
        )}

        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />

        {loading && (
          <div className="flex items-center justify-center py-20 text-vine-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Adatok betöltése...
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 mb-6 text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <SummaryCards latest={latest} stats={stats} />
            <TemperatureChart readings={readings} timeRange={timeRange} isDark={isDark} />
            <HumidityChart readings={readings} timeRange={timeRange} isDark={isDark} />
            <ReadingsTable
              readings={readings}
              isAdmin={isAdmin}
              onDeleteReading={handleDeleteReading}
            />
          </>
        )}

        {sessionManagerOpen && (
          <SessionManager
            sessions={sessions}
            onClose={() => setSessionManagerOpen(false)}
            onCreateSession={createSession}
            onArchiveSession={archiveSession}
          />
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Dashboard />
    </AuthProvider>
  );
}
