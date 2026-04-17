import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CalendarDays, Sprout } from 'lucide-react';
import { formatDateTime, formatDate } from '../lib/dateFormat';
import type { Cutting } from '../types/cutting';

export type TimelineItemType = 'planted' | 'event' | 'photo';

export interface TimelineSelection {
  type: TimelineItemType;
  /** The original entity id (event id or photo id). null for 'planted'. */
  entityId: string | null;
}

interface TimelineItem {
  id: string;
  type: TimelineItemType;
  entityId: string | null;
  dateMs: number;
  title: string;
  subtitle: string;
}

const TYPE_LABELS: Record<TimelineItemType, string> = {
  planted: 'Ültetés',
  event: 'Esemény',
  photo: 'Fotó',
};

const MARKER_ICONS: Record<TimelineItemType, typeof Sprout> = {
  planted: Sprout,
  event: CalendarDays,
  photo: Camera,
};

const MARKER_CLASSES: Record<TimelineItemType, { dot: string; icon: string; legendDot: string }> = {
  planted: {
    dot: 'border-green-500 bg-green-50 dark:border-green-400 dark:bg-green-950',
    icon: 'text-green-500 dark:text-green-400',
    legendDot: 'border-green-500 bg-green-50 dark:border-green-400 dark:bg-green-950',
  },
  event: {
    dot: 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950',
    icon: 'text-blue-500 dark:text-blue-400',
    legendDot: 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950',
  },
  photo: {
    dot: 'border-amber-500 bg-amber-50 dark:border-amber-400 dark:bg-amber-950',
    icon: 'text-amber-500 dark:text-amber-400',
    legendDot: 'border-amber-500 bg-amber-50 dark:border-amber-400 dark:bg-amber-950',
  },
};

const SELECTED_RING: Record<TimelineItemType, string> = {
  planted: 'ring-green-400 dark:ring-green-500',
  event: 'ring-blue-400 dark:ring-blue-500',
  photo: 'ring-amber-400 dark:ring-amber-500',
};

function buildTimelineItems(cutting: Cutting): TimelineItem[] {
  const items: TimelineItem[] = [];

  items.push({
    id: '__planted__',
    type: 'planted',
    entityId: null,
    dateMs: new Date(cutting.plantedAt).getTime(),
    title: 'Ültetés',
    subtitle: formatDate(cutting.plantedAt),
  });

  for (const event of cutting.events) {
    items.push({
      id: `event-${event.id}`,
      type: 'event',
      entityId: event.id,
      dateMs: new Date(event.occurredAt).getTime(),
      title: event.title || 'Esemény',
      subtitle: event.notes
        ? `${formatDateTime(event.occurredAt)} — ${event.notes}`
        : formatDateTime(event.occurredAt),
    });
  }

  for (const photo of cutting.photos) {
    const photoDate = photo.capturedAt ?? photo.uploadedAt;
    items.push({
      id: `photo-${photo.id}`,
      type: 'photo',
      entityId: photo.id,
      dateMs: new Date(photoDate).getTime(),
      title: photo.caption || 'Fotó feltöltve',
      subtitle: formatDateTime(photoDate),
    });
  }

  return items.sort((a, b) => a.dateMs - b.dateMs);
}

interface WeekMark {
  weekNumber: number;
  ms: number;
}

interface DayMark {
  ms: number;
}

interface MarkerLayout {
  offsetY: number;
}

function buildWeekMarks(startMs: number, endMs: number): WeekMark[] {
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  const marks: WeekMark[] = [];
  let weekStart = startMs;
  let weekNumber = 0;

  while (weekStart <= endMs) {
    marks.push({ weekNumber, ms: weekStart });
    weekNumber += 1;
    weekStart += oneWeek;
  }

  return marks;
}

function startOfDayMs(dateMs: number): number {
  const date = new Date(dateMs);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function buildDayMarks(startMs: number, endMs: number): DayMark[] {
  const oneDay = 24 * 60 * 60 * 1000;
  const marks: DayMark[] = [];
  let dayStart = startOfDayMs(startMs);

  while (dayStart <= endMs) {
    marks.push({ ms: dayStart });
    dayStart += oneDay;
  }

  return marks;
}

interface CuttingTimelineProps {
  cutting: Cutting;
  onActiveItemChange?: (selection: TimelineSelection | null) => void;
}

export function CuttingTimeline({ cutting, onActiveItemChange }: CuttingTimelineProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => buildTimelineItems(cutting), [cutting]);

  const { startMs, endMs } = useMemo(() => {
    const plantedMs = new Date(cutting.plantedAt).getTime();
    const nowMs = Date.now();
    const allDates = items.map((item) => item.dateMs);
    const minMs = Math.min(plantedMs, ...allDates);
    const maxMs = Math.max(nowMs, ...allDates);
    const padding = (maxMs - minMs) * 0.03 || 24 * 60 * 60 * 1000;
    return { startMs: minMs - padding, endMs: maxMs + padding };
  }, [cutting.plantedAt, items]);

  const totalSpan = endMs - startMs;
  const safeSpan = totalSpan === 0 ? 1 : totalSpan;

  const weekMarks = useMemo(
    () => buildWeekMarks(new Date(cutting.plantedAt).getTime(), endMs),
    [cutting.plantedAt, endMs],
  );
  const dayMarks = useMemo(() => buildDayMarks(startMs, endMs), [startMs, endMs]);

  const toPercent = (ms: number) => ((ms - startMs) / safeSpan) * 100;
  const isMobileWidth = containerWidth > 0 && containerWidth < 640;
  const timelineHeightPx = isMobileWidth ? 88 : 104;
  const markerDiameter = 28;
  const preferredVerticalStepPx = markerDiameter + 2;

  const markerLayout = useMemo(() => {
    const width = containerWidth || 640;
    const collisionDistancePx = markerDiameter + 4;
    const availableHalfHeight = Math.max(0, timelineHeightPx / 2 - markerDiameter / 2);

    const placed: Array<{ x: number; level: number }> = [];
    const rawLevels = new Map<string, number>();
    let maxAbsLevel = 0;

    for (const item of items) {
      const x = ((item.dateMs - startMs) / safeSpan) * width;
      const blockedLevels = new Set<number>();

      for (let i = placed.length - 1; i >= 0; i -= 1) {
        const prev = placed[i];
        if (x - prev.x > collisionDistancePx) {
          break;
        }
        if (Math.abs(x - prev.x) < collisionDistancePx) {
          blockedLevels.add(prev.level);
        }
      }

      let selectedLevel = 0;
      if (blockedLevels.has(0)) {
        let distance = 1;
        while (true) {
          if (!blockedLevels.has(-distance)) {
            selectedLevel = -distance;
            break;
          }
          if (!blockedLevels.has(distance)) {
            selectedLevel = distance;
            break;
          }
          distance += 1;
        }
      }

      placed.push({ x, level: selectedLevel });
      rawLevels.set(item.id, selectedLevel);
      maxAbsLevel = Math.max(maxAbsLevel, Math.abs(selectedLevel));
    }

    const verticalStepPx =
      maxAbsLevel === 0
        ? 0
        : Math.min(preferredVerticalStepPx, availableHalfHeight / maxAbsLevel);

    const layout = new Map<string, MarkerLayout>();
    for (const item of items) {
      const level = rawLevels.get(item.id) ?? 0;
      layout.set(item.id, { offsetY: level * verticalStepPx });
    }

    return layout;
  }, [containerWidth, items, markerDiameter, preferredVerticalStepPx, safeSpan, startMs, timelineHeightPx]);

  const activeItem = items.find((item) => item.id === activeId) ?? null;

  // Notify parent whenever the active item changes
  useEffect(() => {
    if (!activeId) {
      onActiveItemChange?.(null);
      return;
    }
    const item = items.find((i) => i.id === activeId);
    if (item) {
      onActiveItemChange?.({ type: item.type, entityId: item.entityId });
    }
  }, [activeId, items, onActiveItemChange]);

  // Close tooltip when tapping outside (mobile)
  useEffect(() => {
    if (!activeId) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveId(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [activeId]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const updateWidth = () => setContainerWidth(element.clientWidth);
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  const handleMarkerClick = useCallback(
    (item: TimelineItem) => {
      if (activeId === item.id) {
        setActiveId(null);
        return;
      }
      setActiveId(item.id);
    },
    [activeId],
  );

  if (items.length === 0) return null;

  const skipFactor = weekMarks.length > 20 ? 4 : weekMarks.length > 10 ? 2 : 1;

  return (
    <section className="space-y-2">
      <div className="text-sm font-medium text-vine-700 dark:text-vine-200">Idővonal</div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-vine-600 dark:text-vine-300">
        {(['planted', 'event', 'photo'] as const).map((type) => {
          const Icon = MARKER_ICONS[type];
          const classes = MARKER_CLASSES[type];
          return (
            <span key={type} className="inline-flex items-center gap-1">
              <span
                className={`inline-flex h-4 w-4 items-center justify-center rounded-full border ${classes.legendDot}`}
              >
                <Icon className={`h-2.5 w-2.5 ${classes.icon}`} />
              </span>
              {TYPE_LABELS[type]}
            </span>
          );
        })}
      </div>

      {/* Timeline container */}
      <div
        ref={containerRef}
        className="relative rounded-2xl border border-vine-200 bg-vine-50/60 px-4 dark:border-vine-700 dark:bg-vine-800/40"
        style={{ height: `${timelineHeightPx}px` }}
      >
        {/* Day vertical lines */}
        {dayMarks.map((mark) => {
          const left = toPercent(mark.ms);
          if (left < 0 || left > 100) return null;
          return (
            <div
              key={`day-${mark.ms}`}
              className="absolute top-0 bottom-0 w-px bg-vine-300/25 dark:bg-vine-500/15"
              style={{ left: `${left}%` }}
            />
          );
        })}

        {/* Week vertical lines */}
        {weekMarks.map((mark) => {
          const left = toPercent(mark.ms);
          if (left < 0 || left > 100) return null;
          const showLabel = mark.weekNumber % skipFactor === 0;
          return (
            <div
              key={mark.weekNumber}
              className="absolute top-0 bottom-0"
              style={{ left: `${left}%` }}
            >
              <div className="absolute top-0 h-full w-[2px] -translate-x-1/2 bg-vine-400/70 dark:bg-vine-400/60" />
              {showLabel && (
                <div className="absolute bottom-1 -translate-x-1/2 select-none whitespace-nowrap rounded bg-vine-100/80 px-1 text-[10px] font-semibold text-vine-700 dark:bg-vine-900/75 dark:text-vine-200">
                  {mark.weekNumber === 0 ? 'Ültetés' : `${mark.weekNumber}. hét`}
                </div>
              )}
            </div>
          );
        })}

        {/* Horizontal axis line */}
        <div
          className="absolute left-4 right-4 h-0.5 rounded-full bg-vine-300 dark:bg-vine-600"
          style={{ top: '50%' }}
        />

        {/* "Today" indicator */}
        {(() => {
          const todayLeft = toPercent(Date.now());
          if (todayLeft < 0 || todayLeft > 100) return null;
          return (
            <div
              className="absolute -translate-x-1/2"
              style={{ left: `${todayLeft}%`, top: 6 }}
            >
              <div className="select-none whitespace-nowrap text-[10px] font-semibold text-green-600 dark:text-green-400">
                Ma
              </div>
              <div
                className="absolute left-1/2 top-3.5 w-px -translate-x-1/2 bg-green-600/20 dark:bg-green-400/30"
                style={{ height: 'calc(100% + 8px)' }}
              />
            </div>
          );
        })()}

        {/* Event markers */}
        {items.map((item) => {
          const left = toPercent(item.dateMs);
          if (left < 0 || left > 100) return null;
          const classes = MARKER_CLASSES[item.type];
          const Icon = MARKER_ICONS[item.type];
          const isActive = activeId === item.id;
          const offsetY = markerLayout.get(item.id)?.offsetY ?? 0;

          return (
            <div
              key={item.id}
              className="absolute"
              style={{
                left: `${left}%`,
                top: `calc(50% + ${offsetY}px)`,
                transform: `translate(-50%, -50%) scale(${isActive ? 1.25 : 1})`,
                transition: 'transform 150ms ease-out',
                zIndex: isActive ? 20 : 10,
              }}
              onMouseEnter={() => setActiveId(item.id)}
              onMouseLeave={() => setActiveId((cur) => (cur === item.id ? null : cur))}
            >
              <button
                type="button"
                onClick={() => handleMarkerClick(item)}
                className={`flex h-7 w-7 items-center justify-center rounded-full border-2 shadow-sm transition-shadow ${classes.dot} ${isActive ? `ring-2 ${SELECTED_RING[item.type]}` : ''}`}
                aria-label={item.title}
              >
                <Icon className={`h-3.5 w-3.5 ${classes.icon}`} />
              </button>
            </div>
          );
        })}

        {/* Tooltip */}
        {activeItem && (
          <div
            className="pointer-events-none absolute z-30 max-w-64 -translate-x-1/2 rounded-xl border border-vine-200 bg-white px-3 py-2 text-left text-xs shadow-lg dark:border-vine-700 dark:bg-vine-900 dark:text-vine-50"
            style={{
              left: `clamp(6rem, ${toPercent(activeItem.dateMs)}%, calc(100% - 6rem))`,
              bottom: '100%',
              marginBottom: 4,
            }}
          >
            <div className="font-semibold">{activeItem.title}</div>
            <div className="mt-0.5 text-vine-500 dark:text-vine-300">{activeItem.subtitle}</div>
          </div>
        )}
      </div>
    </section>
  );
}
