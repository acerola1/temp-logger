import type { TimeRange } from '../types/sensor';

export type DashboardView = 'monitor' | 'cuttings';

export interface MonitorUrlState {
  timeRange: TimeRange;
  selectedDeviceId: string | null;
  selectedSessionId: string | null | undefined;
}

function parseTimeRange(value: string | null): TimeRange {
  return value === '7d' || value === '30d' ? value : '24h';
}

export function getViewFromPath(pathname: string): DashboardView {
  return pathname === '/dugvanyok' || pathname.startsWith('/dugvanyok/')
    ? 'cuttings'
    : 'monitor';
}

export function getMonitorStateFromUrl(search: string): MonitorUrlState {
  const params = new URLSearchParams(search);
  const sessionParam = params.get('session');

  return {
    timeRange: parseTimeRange(params.get('range')),
    selectedDeviceId: params.get('device'),
    selectedSessionId:
      sessionParam === null ? undefined : sessionParam === 'all' ? null : sessionParam,
  };
}

export function buildMonitorUrl(state: MonitorUrlState): string {
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
