import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { deleteDoc, doc } from 'firebase/firestore';
import { SummaryCards } from './SummaryCards';
import { TimeRangeSelector } from './TimeRangeSelector';
import { TemperatureChart } from './TemperatureChart';
import { HumidityChart } from './HumidityChart';
import { ReadingsTable } from './ReadingsTable';
import { DeviceSessionSelector } from './DeviceSessionSelector';
import { SessionManager } from './SessionManager';
import { SessionEventsDialog } from './SessionEventsDialog';
import { SessionEventDialog } from './SessionEventDialog';
import { useReadings } from '../hooks/useReadings';
import { useAllSessions } from '../hooks/useAllSessions';
import { useDevices } from '../hooks/useDevices';
import { useSessionTypes } from '../hooks/useSessionTypes';
import { useReadingsQuery } from '../hooks/queries/useReadingsQuery';
import { useSessionEventsQuery } from '../hooks/queries/useSessionEventsQuery';
import { useSessionsQuery } from '../hooks/queries/useSessionsQuery';
import { db } from '../lib/firebase';
import { formatDateTime, toDateTimeLocalValue } from '../lib/dateFormat';
import {
  buildMonitorUrl,
  getMonitorStateFromUrl,
  getViewFromPath,
  type MonitorUrlState,
} from '../lib/dashboardRouting';
import type { SessionEvent, TimeRange } from '../types/sensor';

interface MonitorPageProps {
  theme: 'light' | 'dark';
  isAdmin: boolean;
}

interface QuickCreateEventRequest {
  occurredAt: string;
  nonce: number;
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

export function MonitorPage({ theme, isAdmin }: MonitorPageProps) {
  const initialMonitorState = getMonitorStateFromUrl(window.location.search);
  const [timeRange, setTimeRange] = useState<TimeRange>(initialMonitorState.timeRange);
  const [sessionManagerOpen, setSessionManagerOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<SessionEvent | null>(null);
  const [sessionEventsDialogOpen, setSessionEventsDialogOpen] = useState(false);
  const [quickCreateEventRequest, setQuickCreateEventRequest] =
    useState<QuickCreateEventRequest | null>(null);
  const [archivedPageOffset, setArchivedPageOffset] = useState(0);
  const { data: devices, loading: devicesLoading, error: devicesError } = useDevices();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(
    initialMonitorState.selectedDeviceId,
  );
  const { sessions: allSessions } = useAllSessions(devices);
  const firstActiveSessionInList = (() => {
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
  })();
  const effectiveDeviceId =
    selectedDeviceId ?? firstActiveSessionInList?.deviceId ?? devices[0]?.id ?? null;
  const {
    sessions,
    activeSession,
    isCreating: creatingSession,
    isArchiving: archivingSession,
    createSession,
    archiveSession,
    createSessionError,
    archiveSessionError,
    resetCreateSessionError,
    resetArchiveSessionError,
  } = useSessionsQuery(effectiveDeviceId);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null | undefined>(
    initialMonitorState.selectedSessionId,
  );

  const effectiveSessionId =
    selectedSessionId === undefined
      ? sessions.find((session) => session.status === 'active')?.id ?? null
      : selectedSessionId;

  const { readings: allReadings, loading, error } = useReadingsQuery(
    effectiveDeviceId,
    effectiveSessionId,
  );
  const currentSourceReadings = allReadings;
  const currentLoading = devicesLoading || loading;
  const currentError = devicesError || error;
  const rangeDurationMs = getRangeDurationMs(timeRange);
  const selectedSession = sessions.find((s) => s.id === effectiveSessionId);
  const isSessionPagingView = typeof effectiveSessionId === 'string';
  const latestReadingMs = getLatestReadingMs(currentSourceReadings);
  const fallbackWindowEndMs =
    latestReadingMs ??
    toValidTimeMs(selectedSession?.endDate) ??
    toValidTimeMs(selectedSession?.startDate) ??
    rangeDurationMs;
  const sessionReferenceEndMs =
    selectedSession?.status === 'archived'
      ? selectedSession?.endDate
        ? (toValidTimeMs(selectedSession.endDate) ?? latestReadingMs)
        : latestReadingMs
      : fallbackWindowEndMs;
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
    isCreating: sessionEventCreating,
    isUpdating: sessionEventUpdating,
    isDeleting: sessionEventDeleting,
    createEvent,
    updateEvent,
    deleteEvent,
    createError: sessionEventCreateError,
    updateError: sessionEventUpdateError,
    deleteError: sessionEventDeleteError,
    resetCreateError: resetSessionEventCreateError,
    resetUpdateError: resetSessionEventUpdateError,
    resetDeleteError: resetSessionEventDeleteError,
  } = useSessionEventsQuery(effectiveDeviceId, effectiveSessionId);
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
      if (getViewFromPath(window.location.pathname) !== 'monitor') {
        return;
      }

      const nextMonitorState = getMonitorStateFromUrl(window.location.search);
      setTimeRange(nextMonitorState.timeRange);
      setSelectedDeviceId(nextMonitorState.selectedDeviceId);
      setSelectedSessionId(nextMonitorState.selectedSessionId);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const openManager = () => setSessionManagerOpen(true);
    window.addEventListener('dashboard:open-session-manager', openManager);
    return () => window.removeEventListener('dashboard:open-session-manager', openManager);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      setSelectedEvent(null);
      setSessionEventsDialogOpen(false);
      setQuickCreateEventRequest(null);
    });
  }, [effectiveDeviceId, effectiveSessionId]);

  useEffect(() => {
    queueMicrotask(() => {
      setArchivedPageOffset(0);
    });
  }, [effectiveDeviceId, effectiveSessionId, timeRange]);

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
    pagedWindowEndMs !== null && Number.isFinite(pagedWindowEndMs)
      ? pagedWindowEndMs
      : fallbackWindowEndMs;
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

  useEffect(() => {
    if (selectedDeviceId !== null || !effectiveDeviceId) {
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
  }, [effectiveDeviceId, selectedDeviceId, selectedSessionId, timeRange]);

  return (
    <>
      {!devicesLoading && devices.length > 0 && (
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

      {selectedSessionType && (
        <div className="mb-4 text-sm text-vine-500 dark:text-vine-400">{selectedSessionType.name}</div>
      )}

      <TimeRangeSelector
        value={timeRange}
        onChange={(range) => {
          setTimeRange(range);
          pushMonitorUrl({ timeRange: range });
        }}
      />

      {isSessionPagingView && pagedWindowEndMs !== null && (
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

      {!currentLoading && !currentError && !!effectiveDeviceId && (
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
          <ReadingsTable readings={readings} isAdmin={isAdmin} onDeleteReading={handleDeleteReading} />
        </>
      )}

      {sessionManagerOpen && (
        <SessionManager
          sessions={sessions}
          deviceName={selectedDevice?.name ?? effectiveDeviceId}
          sessionTypes={sessionTypes}
          defaultSessionTypeId={selectedSessionType?.id ?? sessionTypes[0]?.id ?? null}
          onClose={() => setSessionManagerOpen(false)}
          onCreateSession={(name, sessionTypeId) => createSession(name, sessionTypeId)}
          onArchiveSession={archiveSession}
          creating={creatingSession}
          archiving={archivingSession}
          createError={createSessionError}
          archiveError={archiveSessionError}
          onClearCreateError={resetCreateSessionError}
          onClearArchiveError={resetArchiveSessionError}
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
          createPending={sessionEventCreating}
          updatePending={sessionEventUpdating}
          deletePending={sessionEventDeleting}
          createError={sessionEventCreateError}
          updateError={sessionEventUpdateError}
          deleteError={sessionEventDeleteError}
          onClearCreateError={resetSessionEventCreateError}
          onClearUpdateError={resetSessionEventUpdateError}
          onClearDeleteError={resetSessionEventDeleteError}
          onOpenEvent={setSelectedEvent}
          quickCreateRequest={quickCreateEventRequest}
          onQuickCreateHandled={() => setQuickCreateEventRequest(null)}
        />
      )}

      {selectedEvent && <SessionEventDialog event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
    </>
  );
}
