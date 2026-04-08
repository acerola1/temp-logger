import type { SessionEvent } from '../types/sensor';

export interface IndexedSessionEvent extends SessionEvent {
  sequenceNumber: number;
}

export function indexSessionEvents(events: SessionEvent[]): IndexedSessionEvent[] {
  const ordered = events
    .slice()
    .sort((left, right) => {
      const timeDiff = new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime();
      if (timeDiff !== 0) {
        return timeDiff;
      }

      const createdDiff = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      if (createdDiff !== 0) {
        return createdDiff;
      }

      return left.id.localeCompare(right.id);
    });

  const sequenceMap = new Map<string, number>();
  ordered.forEach((event, index) => {
    sequenceMap.set(event.id, index + 1);
  });

  return events.map((event) => ({
    ...event,
    sequenceNumber: sequenceMap.get(event.id) ?? 0,
  }));
}
