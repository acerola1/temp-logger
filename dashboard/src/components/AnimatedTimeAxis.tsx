import { useEffect, useRef, useState } from 'react';
import { formatDateShort } from '../lib/dateFormat';
import { scaleX } from '../lib/chartTransform';
import { buildTimeTicks, type ChartTick } from '../lib/chartTicks';
import type { TimeRange } from '../types/sensor';

interface AnimatedTimeAxisProps {
  domain: [number, number];
  timeRange: TimeRange;
  isDark: boolean;
  plotLeft: number;
  plotWidth: number;
}

interface AxisTransition {
  fromDomain: [number, number];
  toDomain: [number, number];
  fromTimeRange: TimeRange;
  toTimeRange: TimeRange;
}

const ANIMATION_DURATION_MS = 420;

function sameDomain(a: [number, number], b: [number, number]): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function renderTicks(
  ticks: ChartTick[],
  color: string,
  getX: (tick: ChartTick) => number,
  opacity: number,
  keyPrefix: string,
) {
  return ticks.map((tick, index) => (
    <div
      key={`${keyPrefix}-${index}-${tick.value}`}
      className="absolute -translate-x-1/2 whitespace-nowrap text-[11px] leading-none pointer-events-none select-none"
      style={{
        left: `${getX(tick)}px`,
        top: 0,
        opacity,
        color,
      }}
    >
      {formatDateShort(tick.value)}
    </div>
  ));
}

export function AnimatedTimeAxis({
  domain,
  timeRange,
  isDark,
  plotLeft,
  plotWidth,
}: AnimatedTimeAxisProps) {
  const color = isDark ? '#b5ab8e' : '#6b7a3d';
  const previousRef = useRef<{ domain: [number, number]; timeRange: TimeRange } | null>(null);
  const frameRef = useRef<number | null>(null);
  const [transition, setTransition] = useState<AxisTransition | null>(null);
  const [progress, setProgress] = useState(1);

  const currentTicks = buildTimeTicks(domain, timeRange);

  useEffect(() => {
    const previous = previousRef.current;

    if (!previous) {
      previousRef.current = { domain, timeRange };
      return;
    }

    if (sameDomain(previous.domain, domain) && previous.timeRange === timeRange) {
      return;
    }

    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    const nextTransition = {
      fromDomain: previous.domain,
      toDomain: domain,
      fromTimeRange: previous.timeRange,
      toTimeRange: timeRange,
    };
    let kickoffFrameId: number | null = null;

    kickoffFrameId = window.requestAnimationFrame((startedAt) => {
      setProgress(0);
      setTransition(nextTransition);

      const tick = (now: number) => {
        const nextProgress = Math.min((now - startedAt) / ANIMATION_DURATION_MS, 1);
        setProgress(nextProgress);

        if (nextProgress < 1) {
          frameRef.current = window.requestAnimationFrame(tick);
          return;
        }

        frameRef.current = null;
        setTransition(null);
      };

      frameRef.current = window.requestAnimationFrame(tick);
    });

    previousRef.current = { domain, timeRange };

    return () => {
      if (kickoffFrameId !== null) {
        window.cancelAnimationFrame(kickoffFrameId);
      }
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [domain, timeRange]);

  if (plotWidth <= 0) {
    return null;
  }

  if (!transition) {
    return (
      <div className="absolute inset-x-0 bottom-0 h-4 overflow-hidden">
        {renderTicks(
          currentTicks,
          color,
          (tick) => plotLeft + tick.ratio * plotWidth,
          1,
          'steady',
        )}
      </div>
    );
  }

  const previousTicks = buildTimeTicks(transition.fromDomain, transition.fromTimeRange);
  const nextTicks = buildTimeTicks(transition.toDomain, transition.toTimeRange);
  const easedProgress = 1 - Math.pow(1 - progress, 3);
  const incomingOpacity = Math.max(0, (progress - 0.2) / 0.8);

  return (
    <div className="absolute inset-x-0 bottom-0 h-4 overflow-hidden">
      {renderTicks(
        previousTicks,
        color,
        (tick) => {
          const fromX = scaleX(tick.value, transition.fromDomain, plotLeft, plotWidth);
          const toX = scaleX(tick.value, transition.toDomain, plotLeft, plotWidth);
          return fromX + (toX - fromX) * easedProgress;
        },
        1 - easedProgress,
        'from',
      )}
      {renderTicks(
        nextTicks,
        color,
        (tick) => scaleX(tick.value, transition.toDomain, plotLeft, plotWidth),
        incomingOpacity,
        'to',
      )}
    </div>
  );
}
