import { useState } from 'react';
import { AuthProvider } from './lib/auth';
import { Header } from './components/Header';
import { SummaryCards } from './components/SummaryCards';
import { TimeRangeSelector } from './components/TimeRangeSelector';
import { TemperatureChart } from './components/TemperatureChart';
import { HumidityChart } from './components/HumidityChart';
import { ReadingsTable } from './components/ReadingsTable';
import { DeviceSelector } from './components/DeviceSelector';
import { SessionSelector } from './components/SessionSelector';
import { SessionManager } from './components/SessionManager';
import { useTheme } from './hooks/useTheme';
import { useReadings } from './hooks/useReadings';
import { useFirestoreReadings } from './hooks/useFirestoreReadings';
import { useLegacyReadings } from './hooks/useLegacyReadings';
import { useIsAdmin } from './hooks/useIsAdmin';
import { useSessions } from './hooks/useSessions';
import { useDevices } from './hooks/useDevices';
import { useSessionTypes } from './hooks/useSessionTypes';
import type { TimeRange } from './types/sensor';
import { Loader2 } from 'lucide-react';

type DataSourceMode = 'devices' | 'legacy';

function Dashboard() {
  const { theme, toggle } = useTheme();
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [sessionManagerOpen, setSessionManagerOpen] = useState(false);
  const [dataSourceMode, setDataSourceMode] = useState<DataSourceMode>('devices');
  const { data: devices, loading: devicesLoading, error: devicesError } = useDevices();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  const effectiveDeviceId = selectedDeviceId ?? devices[0]?.id ?? null;
  const { sessions, activeSession, loading: sessionsLoading, createSession, archiveSession } =
    useSessions(effectiveDeviceId);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null | undefined>(undefined);

  // `undefined` means no explicit user choice yet, so default to the active session.
  // `null` means the user explicitly chose "Összes mérés".
  const effectiveSessionId =
    selectedSessionId === undefined ? activeSession?.id ?? null : selectedSessionId;

  const { readings: allReadings, loading, error } = useFirestoreReadings(
    effectiveDeviceId,
    effectiveSessionId,
  );
  const {
    readings: legacyReadings,
    loading: legacyLoading,
    error: legacyError,
  } = useLegacyReadings();
  const currentSourceReadings = dataSourceMode === 'legacy' ? legacyReadings : allReadings;
  const currentLoading =
    dataSourceMode === 'legacy' ? legacyLoading : devicesLoading || loading;
  const currentError = dataSourceMode === 'legacy' ? legacyError : devicesError || error;
  const { readings, latest, stats } = useReadings(currentSourceReadings, timeRange);
  const { data: sessionTypes } = useSessionTypes();
  const { isAdmin } = useIsAdmin();
  const isDark = theme === 'dark';

  const selectedSession = sessions.find((s) => s.id === effectiveSessionId);
  const selectedDevice = devices.find((device) => device.id === effectiveDeviceId) ?? null;
  const activeSessionType = sessionTypes.find((type) => type.id === activeSession?.sessionTypeId) ?? null;

  const handleDeleteReading = async (_readingId: string) => {
    window.alert('Az új struktúrában a törlés még nincs bekötve.');
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

        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setDataSourceMode('devices')}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              dataSourceMode === 'devices'
                ? 'bg-vine-600 text-white'
                : 'bg-white/70 text-vine-700 border border-vine-200 dark:bg-vine-800/70 dark:text-vine-200 dark:border-vine-700'
            }`}
          >
            Új adatok
          </button>
          <button
            onClick={() => setDataSourceMode('legacy')}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              dataSourceMode === 'legacy'
                ? 'bg-vine-600 text-white'
                : 'bg-white/70 text-vine-700 border border-vine-200 dark:bg-vine-800/70 dark:text-vine-200 dark:border-vine-700'
            }`}
          >
            Régi adatok
          </button>
        </div>

        {dataSourceMode === 'devices' && !devicesLoading && devices.length > 0 && (
          <DeviceSelector
            devices={devices}
            selectedId={effectiveDeviceId}
            onChange={(deviceId) => {
              setSelectedDeviceId(deviceId);
              setSelectedSessionId(undefined);
            }}
          />
        )}

        {dataSourceMode === 'devices' && !sessionsLoading && sessions.length > 0 && (
          <SessionSelector
            sessions={sessions}
            selectedId={selectedSessionId === undefined ? effectiveSessionId : selectedSessionId}
            onChange={setSelectedSessionId}
          />
        )}

        {dataSourceMode === 'devices' && selectedDevice && (
          <div className="mb-2 text-sm text-vine-600 dark:text-vine-300">{selectedDevice.name}</div>
        )}

        {dataSourceMode === 'devices' && selectedSession && (
          <div className="mb-4 text-sm text-vine-500 dark:text-vine-400">
            {selectedSession.name}
            {selectedSession.status === 'archived' && ' (archivált)'}
            {activeSessionType && ` · ${activeSessionType.name}`}
          </div>
        )}

        {dataSourceMode === 'legacy' && (
          <div className="mb-4 text-sm text-vine-500 dark:text-vine-400">
            Régi `sensorReadings` adatfolyam. Átmeneti nézet a migráció idejére.
          </div>
        )}

        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />

        {currentLoading && (
          <div className="flex items-center justify-center py-20 text-vine-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Adatok betöltése...
          </div>
        )}

        {currentError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 mb-6 text-red-700 dark:text-red-300">
            {currentError}
          </div>
        )}

        {!currentLoading &&
          !currentError &&
          ((dataSourceMode === 'devices' && effectiveDeviceId) || dataSourceMode === 'legacy') && (
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

        {dataSourceMode === 'devices' && sessionManagerOpen && (
          <SessionManager
            sessions={sessions}
            onClose={() => setSessionManagerOpen(false)}
            onCreateSession={(name) => createSession(name, activeSessionType?.id ?? 'callusing')}
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
