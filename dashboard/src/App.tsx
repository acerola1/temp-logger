import { useEffect, useMemo, useState } from 'react';
import { deleteDoc, doc } from 'firebase/firestore';
import { AuthProvider } from './lib/auth';
import { Header } from './components/Header';
import { SummaryCards } from './components/SummaryCards';
import { TimeRangeSelector } from './components/TimeRangeSelector';
import { TemperatureChart } from './components/TemperatureChart';
import { HumidityChart } from './components/HumidityChart';
import { ReadingsTable } from './components/ReadingsTable';
import { DeviceSessionSelector } from './components/DeviceSessionSelector';
import { SessionManager } from './components/SessionManager';
import { SessionEventsDialog } from './components/SessionEventsDialog';
import { SessionEventDialog } from './components/SessionEventDialog';
import { CuttingsPage } from './components/CuttingsPage';
import { useTheme } from './hooks/useTheme';
import { useReadings } from './hooks/useReadings';
import { useFirestoreReadings } from './hooks/useFirestoreReadings';
import { useIsAdmin } from './hooks/useIsAdmin';
import { useSessions } from './hooks/useSessions';
import { useAllSessions } from './hooks/useAllSessions';
import { useSessionEvents } from './hooks/useSessionEvents';
import { useDevices } from './hooks/useDevices';
import { useSessionTypes } from './hooks/useSessionTypes';
import { db } from './lib/firebase';
import { formatDateTime, toDateTimeLocalValue } from './lib/dateFormat';
import type { SessionEvent, TimeRange } from './types/sensor';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

type DashboardView = 'monitor' | 'cuttings';

interface MonitorUrlState {
  timeRange: TimeRange;
  selectedDeviceId: string | null;
  selectedSessionId: string | null | undefined;
}

interface QuickCreateEventRequest {
  occurredAt: string;
  nonce: number;
}

function getViewFromPath(pathname: string): DashboardView {
  return pathname === '/dugvanyok' || pathname.startsWith('/dugvanyok/')
    ? 'cuttings'
    : 'monitor';
}

function parseTimeRange(value: string | null): TimeRange {
  return value === '7d' || value === '30d' ? value : '24h';
}

function getMonitorStateFromUrl(search: string): MonitorUrlState {
  const params = new URLSearchParams(search);
  const sessionParam = params.get('session');

  return {
    timeRange: parseTimeRange(params.get('range')),
    selectedDeviceId: params.get('device'),
    selectedSessionId:
      sessionParam === null ? undefined : sessionParam === 'all' ? null : sessionParam,
  };
}

function buildMonitorUrl(state: MonitorUrlState): string {
  const params = new URLSearchParams();

  if (state.timeRange !== '24h') {
    params.set('range', state.timeRange);
  }

  if (state.selectedDeviceId) {
    params.set('device', state.selectedDeviceId);
  }

  if (state.selectedSessionId === null) {
    params.set('session', 'all');
  } else if (typeof state.selectedSessionId === 'string' && state.selectedSessionId.length > 0) {
    params.set('session', state.selectedSessionId);
  }

  const query = params.toString();
  return query.length > 0 ? `/?${query}` : '/';
}

function getRangeDurationMs(range: TimeRange): number {
  switch (range) {
    case '7d':
      return 7 * 24 * 60 * 60 * 1000;
    case '30d':
      return 30 * 24 * 60 * 60 * 1000;
    default:
      return 24 * 60 * 60 * 1000;
  }
}

function toValidTimeMs(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function getLatestReadingMs(readings: { recordedAt: string }[]): number | null {
  let latest: number | null = null;
  for (const reading of readings) {
    const next = toValidTimeMs(reading.recordedAt);
    if (next === null) {
      continue;
    }
    if (latest === null || next > latest) {
      latest = next;
    }
  }
  return latest;
}

function getOldestReadingMs(readings: { recordedAt: string }[]): number | null {
  let oldest: number | null = null;
  for (const reading of readings) {
    const next = toValidTimeMs(reading.recordedAt);
    if (next === null) {
      continue;
    }
    if (oldest === null || next < oldest) {
      oldest = next;
    }
  }
  return oldest;
}

function Dashboard() {
  const { theme, toggle } = useTheme();
  const initialMonitorState = getMonitorStateFromUrl(window.location.search);
  const [timeRange, setTimeRange] = useState<TimeRange>(initialMonitorState.timeRange);
  const [sessionManagerOpen, setSessionManagerOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<SessionEvent | null>(null);
  const [sessionEventsDialogOpen, setSessionEventsDialogOpen] = useState(false);
  const [quickCreateEventRequest, setQuickCreateEventRequest] = useState<QuickCreateEventRequest | null>(null);
  const [archivedPageOffset, setArchivedPageOffset] = useState(0);
  const [currentView, setCurrentView] = useState<DashboardView>(() =>
    getViewFromPath(window.location.pathname),
  );
  const { data: devices, loading: devicesLoading, error: devicesError } = useDevices();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(
    initialMonitorState.selectedDeviceId,
  );
  const { sessions: allSessions } = useAllSessions(devices);
  const firstActiveSessionInList = useMemo(() => {
    for (const device of devices) {
      const deviceSessions = allSessions
        .filter((session) => session.deviceId === device.id)
        .sort((a, b) => b.startDate.localeCompare(a.startDate));
      const active = deviceSessions.find((session) => session.status === 'active');
      if (active) {
        return { deviceId: device.id, sessionId: active.id };
      }
    }
    return null;
  }, [allSessions, devices]);
  const effectiveDeviceId =
    selectedDeviceId ?? firstActiveSessionInList?.deviceId ?? devices[0]?.id ?? null;
  const { sessions, activeSession, createSession, archiveSession } = useSessions(effectiveDeviceId);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null | undefined>(
    initialMonitorState.selectedSessionId,
  );

  // `undefined` means no explicit user choice yet, so default to the active session.
  // `null` means the user explicitly chose "Összes mérés".
  const effectiveSessionId =
    selectedSessionId === undefined
      ? sessions.find((session) => session.status === 'active')?.id ?? null
      : selectedSessionId;

  const { readings: allReadings, loading, error } = useFirestoreReadings(
    effectiveDeviceId,
    effectiveSessionId,
  );
  const currentSourceReadings = allReadings;
  const currentLoading = devicesLoading || loading;
  const currentError = devicesError || error;
  const rangeDurationMs = getRangeDurationMs(timeRange);
  const selectedSession = sessions.find((s) => s.id === effectiveSessionId);
  const isSessionPagingView = currentView === 'monitor' && typeof effectiveSessionId === 'string';
  const latestReadingMs = getLatestReadingMs(currentSourceReadings);
  const sessionReferenceEndMs =
    selectedSession?.status === 'archived'
      ? selectedSession?.endDate
        ? (toValidTimeMs(selectedSession.endDate) ?? latestReadingMs)
        : latestReadingMs
      : latestReadingMs ?? Date.now();
  const pagedWindowEndMs =
    isSessionPagingView && sessionReferenceEndMs !== null && Number.isFinite(sessionReferenceEndMs)
      ? sessionReferenceEndMs - archivedPageOffset * rangeDurationMs
      : null;
  const { readings, latest, stats } = useReadings(currentSourceReadings, timeRange, {
    windowEndMs: pagedWindowEndMs,
  });
  const { data: sessionTypes } = useSessionTypes();
  const {
    data: sessionEvents,
    loading: sessionEventsLoading,
    error: sessionEventsError,
    createEvent,
    updateEvent,
    deleteEvent,
  } = useSessionEvents(
    effectiveDeviceId,
    effectiveSessionId,
  );
  const { isAdmin } = useIsAdmin();
  const isDark = theme === 'dark';

  const selectedDevice = devices.find((device) => device.id === effectiveDeviceId) ?? null;
  const selectedSessionType =
    sessionTypes.find((type) => type.id === selectedSession?.sessionTypeId) ??
    sessionTypes.find((type) => type.id === activeSession?.sessionTypeId) ??
    null;

  const handleDeleteReading = async (readingId: string) => {
    if (!isAdmin) {
      throw new Error('Csak admin törölhet mérést.');
    }

    if (!effectiveDeviceId) {
      throw new Error('Nincs kiválasztott eszköz a mérés törléséhez.');
    }

    await deleteDoc(doc(db, 'devices', effectiveDeviceId, 'readings', readingId));
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentView(getViewFromPath(window.location.pathname));

      if (getViewFromPath(window.location.pathname) === 'monitor') {
        const nextMonitorState = getMonitorStateFromUrl(window.location.search);
        setTimeRange(nextMonitorState.timeRange);
        setSelectedDeviceId(nextMonitorState.selectedDeviceId);
        setSelectedSessionId(nextMonitorState.selectedSessionId);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    setSelectedEvent(null);
    setSessionEventsDialogOpen(false);
    setQuickCreateEventRequest(null);
  }, [effectiveDeviceId, effectiveSessionId]);

  useEffect(() => {
    setArchivedPageOffset(0);
  }, [currentView, effectiveDeviceId, effectiveSessionId, timeRange]);

  const handleQuickCreateEventNow = () => {
    setSessionEventsDialogOpen(true);
    setQuickCreateEventRequest({
      occurredAt: toDateTimeLocalValue(),
      nonce: Date.now(),
    });
  };

  const handleQuickCreateEventAt = (occurredAtIso: string) => {
    const parsed = new Date(occurredAtIso);
    setSessionEventsDialogOpen(true);
    setQuickCreateEventRequest({
      occurredAt: toDateTimeLocalValue(Number.isNaN(parsed.getTime()) ? new Date() : parsed),
      nonce: Date.now(),
    });
  };

  const handleCloseSessionEventsDialog = () => {
    setSessionEventsDialogOpen(false);
    setQuickCreateEventRequest(null);
  };

  const oldestReadingMs = getOldestReadingMs(currentSourceReadings);
  const pagedWindowStartMs =
    pagedWindowEndMs !== null ? pagedWindowEndMs - rangeDurationMs : null;
  const hasOlderArchivedPage =
    isSessionPagingView &&
    oldestReadingMs !== null &&
    pagedWindowStartMs !== null &&
    Number.isFinite(oldestReadingMs) &&
    oldestReadingMs < pagedWindowStartMs;
  const hasNewerArchivedPage = isSessionPagingView && archivedPageOffset > 0;
  const effectiveWindowEndMs =
    pagedWindowEndMs !== null && Number.isFinite(pagedWindowEndMs) ? pagedWindowEndMs : Date.now();
  const effectiveWindowDomain: [number, number] = [
    effectiveWindowEndMs - rangeDurationMs,
    effectiveWindowEndMs,
  ];

  const pushMonitorUrl = (nextState: Partial<MonitorUrlState>) => {
    const url = buildMonitorUrl({
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
        : buildMonitorUrl({ timeRange, selectedDeviceId, selectedSessionId });
    if (window.location.pathname + window.location.search !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setCurrentView(view);
  };

  useEffect(() => {
    if (
      currentView !== 'monitor' ||
      selectedDeviceId !== null ||
      !effectiveDeviceId
    ) {
      return;
    }

    const nextUrl = buildMonitorUrl({
      timeRange,
      selectedDeviceId: effectiveDeviceId,
      selectedSessionId,
    });

    if (window.location.pathname + window.location.search !== nextUrl) {
      window.history.replaceState({}, '', nextUrl);
    }
  }, [currentView, effectiveDeviceId, selectedDeviceId, selectedSessionId, timeRange]);

  return (
    <div className="min-h-dvh bg-vine-50 dark:bg-vine-900 transition-colors">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <Header
          theme={theme}
          isAdmin={isAdmin}
          onToggleTheme={toggle}
          onOpenSessionManager={() => setSessionManagerOpen(true)}
        />

        <div className="mb-6 border-b border-vine-200 dark:border-vine-700 flex gap-6">
          <button
            onClick={() => navigateToView('monitor')}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              currentView === 'monitor'
                ? 'border-vine-600 text-vine-700 dark:border-vine-400 dark:text-vine-200'
                : 'border-transparent text-vine-500 hover:text-vine-700 dark:text-vine-400 dark:hover:text-vine-200'
            }`}
          >
            Monitor
          </button>
          <button
            onClick={() => navigateToView('cuttings')}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              currentView === 'cuttings'
                ? 'border-vine-600 text-vine-700 dark:border-vine-400 dark:text-vine-200'
                : 'border-transparent text-vine-500 hover:text-vine-700 dark:text-vine-400 dark:hover:text-vine-200'
            }`}
          >
            Dugványok
          </button>
        </div>

        {currentView === 'cuttings' && <CuttingsPage isAdmin={isAdmin} />}

        {currentView === 'monitor' && !devicesLoading && devices.length > 0 && (
          <DeviceSessionSelector
            devices={devices}
            sessions={allSessions}
            selectedDeviceId={effectiveDeviceId}
            selectedSessionId={selectedSessionId === undefined ? effectiveSessionId : selectedSessionId}
            onChange={(deviceId, sessionId) => {
              setSelectedDeviceId(deviceId);
              setSelectedSessionId(sessionId);
              pushMonitorUrl({ selectedDeviceId: deviceId, selectedSessionId: sessionId });
            }}
          />
        )}

        {currentView === 'monitor' && selectedSessionType && (
          <div className="mb-4 text-sm text-vine-500 dark:text-vine-400">
            {selectedSessionType.name}
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

        {currentView === 'monitor' && isSessionPagingView && pagedWindowEndMs !== null && (
          <div className="-mt-4 mb-6 flex flex-wrap items-center gap-2 text-sm text-vine-600 dark:text-vine-300">
            <button
              type="button"
              onClick={() => setArchivedPageOffset((current) => current + 1)}
              disabled={!hasOlderArchivedPage}
              className="inline-flex items-center gap-1 rounded-lg border border-vine-200 bg-white px-2.5 py-1.5 transition-colors hover:bg-vine-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-vine-700 dark:bg-vine-900 dark:hover:bg-vine-800"
            >
              <ChevronLeft className="h-4 w-4" />
              Régebbi
            </button>
            <button
              type="button"
              onClick={() => setArchivedPageOffset((current) => Math.max(0, current - 1))}
              disabled={!hasNewerArchivedPage}
              className="inline-flex items-center gap-1 rounded-lg border border-vine-200 bg-white px-2.5 py-1.5 transition-colors hover:bg-vine-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-vine-700 dark:bg-vine-900 dark:hover:bg-vine-800"
            >
              Újabb
              <ChevronRight className="h-4 w-4" />
            </button>
            <span>
              Ablak: {formatDateTime(pagedWindowStartMs ?? pagedWindowEndMs)} -{' '}
              {formatDateTime(pagedWindowEndMs)}
            </span>
          </div>
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
          !!effectiveDeviceId && (
          <>
            <SummaryCards latest={latest} stats={stats} />
            <TemperatureChart
              readings={readings}
              events={sessionEvents}
              timeRange={timeRange}
              isDark={isDark}
              sessionType={selectedSessionType}
              timeDomainOverride={effectiveWindowDomain}
              onEventSelect={setSelectedEvent}
              canQuickCreateEvent={isAdmin && !!selectedSession}
              onQuickCreateNow={handleQuickCreateEventNow}
              onQuickCreateAt={handleQuickCreateEventAt}
              eventCountLabel={selectedSession ? `${sessionEvents.length} esemény` : null}
              onOpenEventList={
                selectedSession
                  ? () => {
                      setQuickCreateEventRequest(null);
                      setSessionEventsDialogOpen(true);
                    }
                  : undefined
              }
            />
            <HumidityChart
              readings={readings}
              events={sessionEvents}
              timeRange={timeRange}
              isDark={isDark}
              sessionType={selectedSessionType}
              timeDomainOverride={effectiveWindowDomain}
              onEventSelect={setSelectedEvent}
              canQuickCreateEvent={isAdmin && !!selectedSession}
              onQuickCreateNow={handleQuickCreateEventNow}
              onQuickCreateAt={handleQuickCreateEventAt}
              eventCountLabel={selectedSession ? `${sessionEvents.length} esemény` : null}
              onOpenEventList={
                selectedSession
                  ? () => {
                      setQuickCreateEventRequest(null);
                      setSessionEventsDialogOpen(true);
                    }
                  : undefined
              }
              eventErrorMessage={selectedSession ? sessionEventsError : null}
            />
            <ReadingsTable
              readings={readings}
              isAdmin={isAdmin}
              onDeleteReading={handleDeleteReading}
            />
          </>
        )}

        {currentView === 'monitor' && sessionManagerOpen && (
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

        {sessionEventsDialogOpen && selectedSession && effectiveDeviceId && (
          <SessionEventsDialog
            deviceId={effectiveDeviceId}
            session={selectedSession}
            events={sessionEvents}
            loading={sessionEventsLoading}
            error={sessionEventsError}
            isAdmin={isAdmin}
            onClose={handleCloseSessionEventsDialog}
            onCreateEvent={createEvent}
            onUpdateEvent={updateEvent}
            onDeleteEvent={deleteEvent}
            onOpenEvent={setSelectedEvent}
            quickCreateRequest={quickCreateEventRequest}
            onQuickCreateHandled={() => setQuickCreateEventRequest(null)}
          />
        )}

        {selectedEvent && <SessionEventDialog event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
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
