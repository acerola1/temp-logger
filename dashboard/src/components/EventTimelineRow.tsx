import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import {
  eventMarkerCenterY,
  eventTimelineRowBottom,
  eventTimelineRowHeight,
} from '../constants/chartLayout';
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

interface TimelineTransitionState {
  fromPoints: ReturnType<typeof buildSessionEventTimelinePoints>;
  fromDomain: [number, number];
  toPoints: ReturnType<typeof buildSessionEventTimelinePoints>;
  toDomain: [number, number];
  direction: 'forward' | 'backward';
}

const EVENT_TRANSITION_MS = 420;

function arePointsEqual(
  left: ReturnType<typeof buildSessionEventTimelinePoints>,
  right: ReturnType<typeof buildSessionEventTimelinePoints>,
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index].event.id !== right[index].event.id) {
      return false;
    }
    if (left[index].recordedAtMs !== right[index].recordedAtMs) {
      return false;
    }
  }

  return true;
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
  const previousRef = useRef<{
    domain: [number, number];
    points: ReturnType<typeof buildSessionEventTimelinePoints>;
  } | null>(null);
  const [transition, setTransition] = useState<TimelineTransitionState | null>(null);
  const [transitionActive, setTransitionActive] = useState(false);
  const timelinePoints = useMemo(
    () => buildSessionEventTimelinePoints(events, domain),
    [domain, events],
  );
  const quickCreateLeft = plotLeft + plotWidth + 16;
  const quickCreateRight = quickCreateLeft + 10;

  const hoveredEvent = timelinePoints.find((item) => item.event.id === hoveredEventId) ?? null;

  useEffect(() => {
    const previous = previousRef.current;

    if (!previous) {
      previousRef.current = {
        domain,
        points: timelinePoints,
      };
      return;
    }

    const domainChanged = previous.domain[0] !== domain[0] || previous.domain[1] !== domain[1];
    const pointsChanged = !arePointsEqual(previous.points, timelinePoints);

    if (!domainChanged && !pointsChanged) {
      return;
    }

    const direction = domain[0] >= previous.domain[0] ? 'forward' : 'backward';
    const nextTransition: TimelineTransitionState = {
      fromPoints: previous.points,
      fromDomain: previous.domain,
      toPoints: timelinePoints,
      toDomain: domain,
      direction,
    };

    setTransition(nextTransition);
    setTransitionActive(false);

    const rafId = window.requestAnimationFrame(() => {
      setTransitionActive(true);
    });

    const timeoutId = window.setTimeout(() => {
      setTransition(null);
      setTransitionActive(false);
    }, EVENT_TRANSITION_MS);

    previousRef.current = {
      domain,
      points: timelinePoints,
    };

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };
  }, [domain, timelinePoints]);

  const renderPoints = (
    points: ReturnType<typeof buildSessionEventTimelinePoints>,
    activeDomain: [number, number],
    interactive: boolean,
  ) =>
    points.map((item) => {
      const left = scaleX(item.recordedAtMs, activeDomain, plotLeft, plotWidth);

      return (
        <div key={item.event.id}>
          <div
            className="absolute w-px -translate-x-1/2"
            style={{
              left,
              bottom: eventTimelineRowHeight - eventMarkerCenterY,
              height: lineHeight,
              backgroundColor: isDark ? '#67e8f9' : '#93c5fd',
              opacity: isDark ? 0.65 : 0.9,
            }}
          />
          <button
            type="button"
            onMouseEnter={() => interactive && setHoveredEventId(item.event.id)}
            onMouseLeave={() =>
              interactive && setHoveredEventId((current) => (current === item.event.id ? null : current))
            }
            onFocus={() => interactive && setHoveredEventId(item.event.id)}
            onBlur={() =>
              interactive && setHoveredEventId((current) => (current === item.event.id ? null : current))
            }
            onClick={() => interactive && onEventSelect?.(item.event)}
            className="absolute z-10 flex h-[20px] w-[20px] -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[4px] border-2 border-white text-[10px] font-semibold leading-none shadow-sm transition-transform hover:scale-110 focus:scale-110 dark:border-vine-950"
            style={{
              left,
              top: eventMarkerCenterY,
              backgroundColor: isDark ? '#22301a' : '#ffffff',
              borderColor: isDark ? '#67e8f9' : '#60a5fa',
              color: isDark ? '#a5f3fc' : '#2563eb',
            }}
            aria-label={item.event.title}
          >
            <span className="pointer-events-none select-none">{item.event.sequenceNumber}</span>
          </button>
        </div>
      );
    });

  return (
    <div
      className="absolute inset-x-0"
      style={{
        bottom: eventTimelineRowBottom,
        height: eventTimelineRowHeight,
        pointerEvents:
          canQuickCreateEvent || timelinePoints.length > 0 || !!eventCountLabel || !!errorMessage
            ? 'auto'
            : 'none',
      }}
    >
      <div
        className="absolute h-px bg-vine-200 transition-[left,width] duration-500 ease-out dark:bg-vine-700"
        style={{
          left: plotLeft,
          width: plotWidth,
          top: eventMarkerCenterY,
          opacity: isDark ? 0.7 : 1,
        }}
      />

      {canQuickCreateEvent && onQuickCreateNow && (
        <button
          type="button"
          onClick={onQuickCreateNow}
          className="absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[4px] border bg-white text-sky-700 shadow-sm transition-[left,background-color] duration-500 ease-out hover:bg-sky-50 dark:bg-vine-800 dark:text-sky-200 dark:hover:bg-vine-700"
          style={{ left: quickCreateLeft, top: eventMarkerCenterY }}
          aria-label="Új esemény az aktuális időponthoz"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      )}

      {transition ? (
        <>
          <div
            className="absolute inset-0"
            style={{
              pointerEvents: 'none',
              transform:
                transition.direction === 'forward'
                  ? `translateX(${transitionActive ? -24 : 0}px)`
                  : `translateX(${transitionActive ? 24 : 0}px)`,
              opacity: transitionActive ? 0 : 1,
              transition: `transform ${EVENT_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${EVENT_TRANSITION_MS}ms ease-out`,
            }}
          >
            {renderPoints(transition.fromPoints, transition.fromDomain, false)}
          </div>
          <div
            className="absolute inset-0"
            style={{
              transform:
                transition.direction === 'forward'
                  ? `translateX(${transitionActive ? 0 : 24}px)`
                  : `translateX(${transitionActive ? 0 : -24}px)`,
              opacity: transitionActive ? 1 : 0,
              transition: `transform ${EVENT_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${EVENT_TRANSITION_MS}ms ease-out`,
            }}
          >
            {renderPoints(transition.toPoints, transition.toDomain, true)}
          </div>
        </>
      ) : (
        renderPoints(timelinePoints, domain, true)
      )}

      {hoveredEvent && (
        <div
          className="pointer-events-none absolute z-10 max-w-60 -translate-x-1/2 rounded-xl border px-3 py-2 text-left text-xs shadow-lg transition-[left] duration-500 ease-out"
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
          className="absolute flex min-h-4 items-end"
          style={{
            right: `calc(100% - ${quickCreateRight}px)`,
            bottom: 0,
          }}
        >
          <div className="flex flex-col items-end gap-1 text-xs">
            {eventCountLabel && onOpenEventList && (
              <button
                type="button"
                onClick={onOpenEventList}
                className="font-medium text-sky-700 underline decoration-sky-300 underline-offset-2 transition-colors hover:text-sky-800 dark:text-sky-200 dark:decoration-sky-400 dark:hover:text-cyan-100"
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
