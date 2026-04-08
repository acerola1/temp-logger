import type { SessionEvent } from '../types/sensor';

export interface SessionEventTimelinePoint {
  recordedAtMs: number;
  event: SessionEvent;
}

export function buildSessionEventTimelinePoints(
  events: SessionEvent[],
  timeDomain: [number, number],
): SessionEventTimelinePoint[] {
  const [minTime, maxTime] = timeDomain;

  return events
    .map((event) => ({
      recordedAtMs: new Date(event.occurredAt).getTime(),
      event,
    }))
    .filter(
      (item) =>
        Number.isFinite(item.recordedAtMs) &&
        item.recordedAtMs >= minTime &&
        item.recordedAtMs <= maxTime,
    )
    .sort((left, right) => left.recordedAtMs - right.recordedAtMs);
}
