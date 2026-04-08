import { useEffect, useState } from 'react';
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
import { CuttingsPage } from './components/CuttingsPage';
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
type DashboardView = 'monitor' | 'cuttings';

interface MonitorUrlState {
  dataSourceMode: DataSourceMode;
  timeRange: TimeRange;
  selectedDeviceId: string | null;
  selectedSessionId: string | null | undefined;
}

function getViewFromPath(pathname: string): DashboardView {
  return pathname === '/dugvanyok' || pathname.startsWith('/dugvanyok/')
    ? 'cuttings'
    : 'monitor';
}

function parseTimeRange(value: string | null): TimeRange {
  return value === '7d' || value === '30d' ? value : '24h';
}

function parseDataSourceMode(value: string | null): DataSourceMode {
  return value === 'legacy' ? 'legacy' : 'devices';
}

function getMonitorStateFromUrl(search: string): MonitorUrlState {
  const params = new URLSearchParams(search);
  const sessionParam = params.get('session');

  return {
    dataSourceMode: parseDataSourceMode(params.get('source')),
    timeRange: parseTimeRange(params.get('range')),
    selectedDeviceId: params.get('device'),
    selectedSessionId:
      sessionParam === null ? undefined : sessionParam === 'all' ? null : sessionParam,
  };
}

function buildMonitorUrl(state: MonitorUrlState): string {
  const params = new URLSearchParams();

  if (state.dataSourceMode !== 'devices') {
    params.set('source', state.dataSourceMode);
  }

  if (state.timeRange !== '24h') {
    params.set('range', state.timeRange);
  }

  if (state.dataSourceMode === 'devices' && state.selectedDeviceId) {
    params.set('device', state.selectedDeviceId);
  }

  if (state.dataSourceMode === 'devices') {
    if (state.selectedSessionId === null) {
      params.set('session', 'all');
    } else if (typeof state.selectedSessionId === 'string' && state.selectedSessionId.length > 0) {
      params.set('session', state.selectedSessionId);
    }
  }

  const query = params.toString();
  return query.length > 0 ? `/?${query}` : '/';
}

function Dashboard() {
  const { theme, toggle } = useTheme();
  const initialMonitorState = getMonitorStateFromUrl(window.location.search);
  const [timeRange, setTimeRange] = useState<TimeRange>(initialMonitorState.timeRange);
  const [sessionManagerOpen, setSessionManagerOpen] = useState(false);
  const [currentView, setCurrentView] = useState<DashboardView>(() =>
    getViewFromPath(window.location.pathname),
  );
  const [dataSourceMode, setDataSourceMode] = useState<DataSourceMode>(
    initialMonitorState.dataSourceMode,
  );
  const { data: devices, loading: devicesLoading, error: devicesError } = useDevices();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(
    initialMonitorState.selectedDeviceId,
  );

  const effectiveDeviceId = selectedDeviceId ?? devices[0]?.id ?? null;
  const { sessions, activeSession, loading: sessionsLoading, createSession, archiveSession } =
    useSessions(effectiveDeviceId);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null | undefined>(
    initialMonitorState.selectedSessionId,
  );

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
  const callusingSessionType = sessionTypes.find((type) => type.id === 'callusing') ?? null;
  const selectedSessionType =
    dataSourceMode === 'legacy'
      ? callusingSessionType
      : sessionTypes.find((type) => type.id === selectedSession?.sessionTypeId) ??
        sessionTypes.find((type) => type.id === activeSession?.sessionTypeId) ??
        null;

  const handleDeleteReading = async (_readingId: string) => {
    window.alert('Az új struktúrában a törlés még nincs bekötve.');
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentView(getViewFromPath(window.location.pathname));

      if (getViewFromPath(window.location.pathname) === 'monitor') {
        const nextMonitorState = getMonitorStateFromUrl(window.location.search);
        setDataSourceMode(nextMonitorState.dataSourceMode);
        setTimeRange(nextMonitorState.timeRange);
        setSelectedDeviceId(nextMonitorState.selectedDeviceId);
        setSelectedSessionId(nextMonitorState.selectedSessionId);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const pushMonitorUrl = (nextState: Partial<MonitorUrlState>) => {
    const url = buildMonitorUrl({
      dataSourceMode,
      timeRange,
      selectedDeviceId,
      selectedSessionId,
      ...nextState,
    });

    if (window.location.pathname + window.location.search !== url) {
      window.history.pushState({}, '', url);
    }
  };

  const navigateToView = (view: DashboardView) => {
    const nextPath =
      view === 'cuttings'
        ? '/dugvanyok'
        : buildMonitorUrl({ dataSourceMode, timeRange, selectedDeviceId, selectedSessionId });
    if (window.location.pathname + window.location.search !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setCurrentView(view);
  };

  useEffect(() => {
    if (
      currentView !== 'monitor' ||
      dataSourceMode !== 'devices' ||
      selectedDeviceId !== null ||
      !effectiveDeviceId
    ) {
      return;
    }

    const nextUrl = buildMonitorUrl({
      dataSourceMode,
      timeRange,
      selectedDeviceId: effectiveDeviceId,
      selectedSessionId,
    });

    if (window.location.pathname + window.location.search !== nextUrl) {
      window.history.replaceState({}, '', nextUrl);
    }
  }, [currentView, dataSourceMode, effectiveDeviceId, selectedDeviceId, selectedSessionId, timeRange]);

  return (
    <div className="min-h-dvh bg-vine-50 dark:bg-vine-900 transition-colors">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <Header
          theme={theme}
          isAdmin={isAdmin}
          onToggleTheme={toggle}
          onOpenSessionManager={() => setSessionManagerOpen(true)}
        />

        <div className="mb-6 flex items-center gap-2">
          <button
            onClick={() => navigateToView('monitor')}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              currentView === 'monitor'
                ? 'bg-vine-600 text-white'
                : 'bg-white/70 text-vine-700 border border-vine-200 dark:bg-vine-800/70 dark:text-vine-200 dark:border-vine-700'
            }`}
          >
            Monitor
          </button>
          <button
            onClick={() => navigateToView('cuttings')}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              currentView === 'cuttings'
                ? 'bg-vine-600 text-white'
                : 'bg-white/70 text-vine-700 border border-vine-200 dark:bg-vine-800/70 dark:text-vine-200 dark:border-vine-700'
            }`}
          >
            Dugványok
          </button>
        </div>

        {currentView === 'cuttings' && <CuttingsPage isAdmin={isAdmin} />}

        {currentView === 'monitor' && (
          <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => {
              setDataSourceMode('devices');
              pushMonitorUrl({ dataSourceMode: 'devices' });
            }}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              dataSourceMode === 'devices'
                ? 'bg-vine-600 text-white'
                : 'bg-white/70 text-vine-700 border border-vine-200 dark:bg-vine-800/70 dark:text-vine-200 dark:border-vine-700'
            }`}
          >
            Új adatok
          </button>
          <button
            onClick={() => {
              setDataSourceMode('legacy');
              pushMonitorUrl({
                dataSourceMode: 'legacy',
                selectedSessionId: undefined,
              });
            }}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              dataSourceMode === 'legacy'
                ? 'bg-vine-600 text-white'
                : 'bg-white/70 text-vine-700 border border-vine-200 dark:bg-vine-800/70 dark:text-vine-200 dark:border-vine-700'
            }`}
          >
            Régi adatok
          </button>
          </div>
        )}

        {currentView === 'monitor' && dataSourceMode === 'devices' && !devicesLoading && devices.length > 0 && (
          <DeviceSelector
            devices={devices}
            selectedId={effectiveDeviceId}
            onChange={(deviceId) => {
              setSelectedDeviceId(deviceId);
              setSelectedSessionId(undefined);
              pushMonitorUrl({
                selectedDeviceId: deviceId,
                selectedSessionId: undefined,
              });
            }}
          />
        )}

        {currentView === 'monitor' && dataSourceMode === 'devices' && !sessionsLoading && sessions.length > 0 && (
          <SessionSelector
            sessions={sessions}
            selectedId={selectedSessionId === undefined ? effectiveSessionId : selectedSessionId}
            onChange={(sessionId) => {
              setSelectedSessionId(sessionId);
              pushMonitorUrl({ selectedSessionId: sessionId });
            }}
          />
        )}

        {currentView === 'monitor' && dataSourceMode === 'devices' && selectedDevice && (
          <div className="mb-2 text-sm text-vine-600 dark:text-vine-300">{selectedDevice.name}</div>
        )}

        {currentView === 'monitor' && dataSourceMode === 'devices' && selectedSession && (
          <div className="mb-4 text-sm text-vine-500 dark:text-vine-400">
            {selectedSession.name}
            {selectedSession.status === 'archived' && ' (archivált)'}
            {selectedSessionType && ` · ${selectedSessionType.name}`}
          </div>
        )}

        {currentView === 'monitor' && dataSourceMode === 'legacy' && (
          <div className="mb-4 text-sm text-vine-500 dark:text-vine-400">
            Régi `sensorReadings` adatfolyam. Átmeneti nézet a migráció idejére.
            {selectedSessionType && ` · ${selectedSessionType.name}`}
          </div>
        )}

        {currentView === 'monitor' && (
          <TimeRangeSelector
            value={timeRange}
            onChange={(range) => {
              setTimeRange(range);
              pushMonitorUrl({ timeRange: range });
            }}
          />
        )}

        {currentView === 'monitor' && currentLoading && (
          <div className="flex items-center justify-center py-20 text-vine-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Adatok betöltése...
          </div>
        )}

        {currentView === 'monitor' && currentError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 mb-6 text-red-700 dark:text-red-300">
            {currentError}
          </div>
        )}

        {currentView === 'monitor' &&
          !currentLoading &&
          !currentError &&
          ((dataSourceMode === 'devices' && effectiveDeviceId) || dataSourceMode === 'legacy') && (
          <>
            <SummaryCards latest={latest} stats={stats} />
            <TemperatureChart
              readings={readings}
              timeRange={timeRange}
              isDark={isDark}
              sessionType={selectedSessionType}
            />
            <HumidityChart
              readings={readings}
              timeRange={timeRange}
              isDark={isDark}
              sessionType={selectedSessionType}
            />
            <ReadingsTable
              readings={readings}
              isAdmin={isAdmin}
              onDeleteReading={handleDeleteReading}
            />
          </>
        )}

        {currentView === 'monitor' && dataSourceMode === 'devices' && sessionManagerOpen && (
          <SessionManager
            sessions={sessions}
            deviceName={selectedDevice?.name ?? effectiveDeviceId}
            sessionTypes={sessionTypes}
            defaultSessionTypeId={selectedSessionType?.id ?? sessionTypes[0]?.id ?? null}
            onClose={() => setSessionManagerOpen(false)}
            onCreateSession={(name, sessionTypeId) => createSession(name, sessionTypeId)}
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
