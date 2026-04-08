import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { formatDateTime } from '../lib/dateFormat';
import { buildSessionEventTimelinePoints } from '../lib/sessionEventTimeline';
import type { SessionEvent } from '../types/sensor';

interface EventTimelineRowProps {
  events: SessionEvent[];
  domain: [number, number];
  isDark: boolean;
  plotLeft: number;
  plotWidth: number;
  lineHeight: number;
  onEventSelect?: (event: SessionEvent) => void;
  canQuickCreateEvent?: boolean;
  onQuickCreateNow?: () => void;
  eventCountLabel?: string | null;
  onOpenEventList?: () => void;
  errorMessage?: string | null;
}

function scaleX(
  value: number,
  domain: [number, number],
  plotLeft: number,
  plotWidth: number,
): number {
  const span = domain[1] - domain[0];

  if (span <= 0 || plotWidth <= 0) {
    return plotLeft;
  }

  const ratio = (value - domain[0]) / span;
  return plotLeft + ratio * plotWidth;
}

export function EventTimelineRow({
  events,
  domain,
  isDark,
  plotLeft,
  plotWidth,
  lineHeight,
  onEventSelect,
  canQuickCreateEvent = false,
  onQuickCreateNow,
  eventCountLabel = null,
  onOpenEventList,
  errorMessage = null,
}: EventTimelineRowProps) {
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const timelinePoints = useMemo(
    () => buildSessionEventTimelinePoints(events, domain),
    [domain, events],
  );
  const quickCreateLeft = plotLeft + plotWidth + 16;
  const quickCreateRight = quickCreateLeft + 10;

  const hoveredEvent = timelinePoints.find((item) => item.event.id === hoveredEventId) ?? null;

  return (
    <div
      className="absolute inset-x-0 bottom-4 h-10"
      style={{
        pointerEvents:
          canQuickCreateEvent || timelinePoints.length > 0 || !!eventCountLabel || !!errorMessage
            ? 'auto'
            : 'none',
      }}
    >
      <div
        className="absolute h-px bg-vine-200 dark:bg-vine-700"
        style={{
          left: plotLeft,
          width: plotWidth,
          top: 8,
        }}
      />

      {canQuickCreateEvent && onQuickCreateNow && (
        <button
          type="button"
          onClick={onQuickCreateNow}
          className="absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[4px] border bg-white text-sky-700 shadow-sm transition-colors hover:bg-sky-50 dark:bg-vine-900 dark:text-sky-300 dark:hover:bg-vine-800"
          style={{ left: quickCreateLeft, top: 8 }}
          aria-label="Új esemény az aktuális időponthoz"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      )}

      {timelinePoints.map((item) => {
        const left = scaleX(item.recordedAtMs, domain, plotLeft, plotWidth);

        return (
          <div key={item.event.id}>
            <div
              className="absolute w-px -translate-x-1/2"
              style={{
                left,
                bottom: 14,
                height: lineHeight,
                backgroundColor: isDark ? '#7dd3fc' : '#93c5fd',
                opacity: 0.9,
              }}
            />
            <button
              type="button"
              onMouseEnter={() => setHoveredEventId(item.event.id)}
              onMouseLeave={() =>
                setHoveredEventId((current) => (current === item.event.id ? null : current))
              }
              onFocus={() => setHoveredEventId(item.event.id)}
              onBlur={() => setHoveredEventId((current) => (current === item.event.id ? null : current))}
              onClick={() => onEventSelect?.(item.event)}
              className="absolute z-10 flex h-[20px] w-[20px] -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[4px] border-2 border-white text-[10px] font-semibold leading-none shadow-sm transition-transform hover:scale-110 focus:scale-110 dark:border-vine-900"
              style={{
                left,
                top: 8,
                backgroundColor: '#ffffff',
                borderColor: isDark ? '#7dd3fc' : '#60a5fa',
                color: isDark ? '#7dd3fc' : '#2563eb',
              }}
              aria-label={item.event.title}
            >
              <span className="pointer-events-none select-none">{item.event.sequenceNumber}</span>
            </button>
          </div>
        );
      })}

      {hoveredEvent && (
        <div
          className="pointer-events-none absolute z-10 max-w-60 -translate-x-1/2 rounded-xl border px-3 py-2 text-left text-xs shadow-lg"
          style={{
            left: scaleX(hoveredEvent.recordedAtMs, domain, plotLeft, plotWidth),
            bottom: 26,
            backgroundColor: isDark ? '#2a3518' : '#fff',
            borderColor: isDark ? '#3a4820' : '#e8e3d6',
            color: isDark ? '#f4f1ea' : '#18211b',
          }}
        >
          <div className="font-semibold">{hoveredEvent.event.title}</div>
          <div className="mt-1 opacity-80">#{hoveredEvent.event.sequenceNumber}</div>
          {hoveredEvent.event.description && (
            <div className="mt-1 line-clamp-2 opacity-80">{hoveredEvent.event.description}</div>
          )}
          <div className="mt-1 opacity-70">{formatDateTime(hoveredEvent.event.occurredAt)}</div>
        </div>
      )}

      {(eventCountLabel || errorMessage) && (
        <div
          className="absolute bottom-[5px] flex min-h-4 items-end"
          style={{ right: `calc(100% - ${quickCreateRight}px)` }}
        >
          <div className="flex flex-col items-end gap-1 text-xs">
            {eventCountLabel && onOpenEventList && (
              <button
                type="button"
                onClick={onOpenEventList}
                className="text-sky-700 underline decoration-sky-300 underline-offset-2 transition-colors hover:text-sky-800 dark:text-sky-300 dark:decoration-sky-500 dark:hover:text-sky-200"
              >
                {eventCountLabel}
              </button>
            )}
            {errorMessage && <div className="text-red-600 dark:text-red-300">{errorMessage}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
