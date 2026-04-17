import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceArea,
} from 'recharts';
import {
  chartHeight,
  chartMargin,
  chartYAxisWidth,
} from '../constants/chartLayout';
import { chartColors } from '../constants/chartColors';
import { AnimatedTimeAxis } from './AnimatedTimeAxis';
import { EventTimelineRow } from './EventTimelineRow';
import { formatDateShort } from '../lib/dateFormat';
import { buildChartSeries, type TimeSeriesPoint } from '../lib/chartSeries';
import { sampleReadingsForChart } from '../lib/chartSampling';
import { getTimeDomain } from '../lib/chartTime';
import { useElementWidth } from '../hooks/useElementWidth';
import type { SensorReading, SessionEvent, SessionType, TimeRange } from '../types/sensor';
import { Plus, X } from 'lucide-react';

export interface SensorChartProps {
  title: string;
  dataKey: keyof TimeSeriesPoint;
  unit: string;
  lineColor: string;
  yAxisFormatter: (v: number) => string;
  referenceAreaBounds?: (sessionType: SessionType) => { min: number; max: number };
  readings: SensorReading[];
  events: SessionEvent[];
  timeRange: TimeRange;
  isDark: boolean;
  sessionType: SessionType | null;
  timeDomainOverride?: [number, number];
  onEventSelect?: (event: SessionEvent) => void;
  canQuickCreateEvent?: boolean;
  onQuickCreateNow?: () => void;
  onQuickCreateAt?: (occurredAtIso: string) => void;
  eventCountLabel?: string | null;
  onOpenEventList?: () => void;
  eventErrorMessage?: string | null;
}

interface TooltipPoint {
  recordedAtMs: number;
  value: number;
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

export function SensorChart({
  title,
  dataKey,
  unit,
  lineColor,
  yAxisFormatter,
  referenceAreaBounds,
  readings,
  events,
  timeRange,
  isDark,
  sessionType,
  timeDomainOverride,
  onEventSelect,
  canQuickCreateEvent = false,
  onQuickCreateNow,
  onQuickCreateAt,
  eventCountLabel = null,
  onOpenEventList,
  eventErrorMessage = null,
}: SensorChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pinnedPoint, setPinnedPoint] = useState<TooltipPoint | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<TooltipPoint | null>(null);
  const tooltipCurrentX = useRef(0);
  const tooltipTargetX = useRef(0);
  const tooltipVelocityX = useRef(0);
  const tooltipCurrentY = useRef(0);
  const tooltipTargetY = useRef(0);
  const tooltipVelocityY = useRef(0);
  const tooltipRafId = useRef(0);
  const chartWidth = useElementWidth(chartRef);
  const filteredReadings = sampleReadingsForChart(readings, timeRange);
  const data = buildChartSeries(filteredReadings);
  const timeDomain = timeDomainOverride ?? getTimeDomain(data.map((point) => point.recordedAtMs));

  const gridColor = isDark ? chartColors.gridDark : chartColors.grid;
  const plotWidth = Math.max(0, chartWidth - chartYAxisWidth - chartMargin.right);
  const eventLineHeight = chartHeight - chartMargin.top - chartMargin.bottom;

  const extractPoint = (state: unknown): TooltipPoint | null => {
    const s = state as {
      activeLabel?: number;
      activePayload?: Array<{ payload?: TimeSeriesPoint }>;
    };
    const payload = s.activePayload?.[0]?.payload;
    const ms =
      typeof payload?.recordedAtMs === 'number'
        ? payload.recordedAtMs
        : typeof s.activeLabel === 'number'
          ? s.activeLabel
          : null;
    if (ms === null) return null;
    const point = data.find(
      (item) => item.recordedAtMs === ms && typeof item[dataKey] === 'number',
    );
    if (!point) return null;
    const value = point[dataKey];
    if (typeof value !== 'number') return null;
    return { recordedAtMs: point.recordedAtMs, value };
  };

  const handleMouseMove = (state: unknown) => {
    if (pinnedPoint) return;
    setHoveredPoint(extractPoint(state));
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      if (pinnedPoint) return;
      const rect = el.getBoundingClientRect();
      const y = e.clientY - rect.top;
      tooltipTargetY.current = Math.max(chartMargin.top, Math.min(y, chartHeight));
    };
    el.addEventListener('mousemove', handler);
    return () => el.removeEventListener('mousemove', handler);
  }, [pinnedPoint]);

  const handleChartClick = (state: unknown) => {
    const point = extractPoint(state);
    if (!point) {
      setPinnedPoint(null);
      return;
    }
    setPinnedPoint((current) =>
      current?.recordedAtMs === point.recordedAtMs ? null : point,
    );
  };

  useEffect(() => {
    if (!pinnedPoint) return;
    const handler = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setPinnedPoint(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pinnedPoint]);

  const activeTooltip = pinnedPoint ?? hoveredPoint;
  const isPinned = pinnedPoint !== null;

  const animateTooltip = useCallback(() => {
    // Spring-damper physics
    // stiffness: how hard the spring pulls toward target
    // damping: friction that prevents oscillation (1 = critically damped)
    const stiffness = 0.012;
    const damping = 0.85;

    const dx = tooltipTargetX.current - tooltipCurrentX.current;
    const dy = tooltipTargetY.current - tooltipCurrentY.current;

    tooltipVelocityX.current = (tooltipVelocityX.current + dx * stiffness) * damping;
    tooltipVelocityY.current = (tooltipVelocityY.current + dy * stiffness) * damping;

    tooltipCurrentX.current += tooltipVelocityX.current;
    tooltipCurrentY.current += tooltipVelocityY.current;

    const settled =
      Math.abs(dx) < 0.3 && Math.abs(dy) < 0.3 &&
      Math.abs(tooltipVelocityX.current) < 0.1 && Math.abs(tooltipVelocityY.current) < 0.1;

    if (settled) {
      tooltipCurrentX.current = tooltipTargetX.current;
      tooltipCurrentY.current = tooltipTargetY.current;
      tooltipVelocityX.current = 0;
      tooltipVelocityY.current = 0;
      if (tooltipRef.current) {
        tooltipRef.current.style.transform = `translate(${tooltipCurrentX.current}px, ${tooltipCurrentY.current}px) translate(-50%, -100%)`;
      }
      tooltipRafId.current = 0;
      return;
    }

    if (tooltipRef.current) {
      tooltipRef.current.style.transform = `translate(${tooltipCurrentX.current}px, ${tooltipCurrentY.current}px) translate(-50%, -100%)`;
    }
    tooltipRafId.current = requestAnimationFrame(animateTooltip);
  }, []);

  useEffect(() => {
    if (!activeTooltip) {
      cancelAnimationFrame(tooltipRafId.current);
      tooltipRafId.current = 0;
      return;
    }
    const targetX = scaleX(activeTooltip.recordedAtMs, timeDomain, chartYAxisWidth, plotWidth);
    tooltipTargetX.current = targetX;
    if (isPinned) {
      tooltipTargetY.current = tooltipCurrentY.current;
    }
    if (!tooltipRafId.current) {
      tooltipRafId.current = requestAnimationFrame(animateTooltip);
    }
  }, [activeTooltip, timeDomain, plotWidth, isPinned, animateTooltip]);

  useEffect(() => {
    return () => cancelAnimationFrame(tooltipRafId.current);
  }, []);

  const bounds = sessionType && referenceAreaBounds ? referenceAreaBounds(sessionType) : null;

  return (
    <div className="bg-white/70 dark:bg-vine-800/70 backdrop-blur-sm rounded-2xl border border-vine-200 dark:border-vine-700 p-4 shadow-sm mb-4">
      <h2 className="mb-3 text-base font-semibold text-vine-900 dark:text-vine-50">{title}</h2>
      <div ref={chartRef} className="relative [&_*]:outline-none">
        <ResponsiveContainer width="100%" height={chartHeight}>
          <LineChart
            data={data}
            margin={chartMargin}
            onClick={handleChartClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          {bounds && sessionType && (
            <ReferenceArea
              y1={bounds.min}
              y2={bounds.max}
              ifOverflow="extendDomain"
              fill={lineColor}
              fillOpacity={0.08}
              label={{
                value: `${sessionType.name} (${bounds.min}-${bounds.max}${unit})`,
                position: 'insideTopRight',
                fontSize: 11,
                fill: isDark ? '#d4cdb8' : '#6b7a3d',
              }}
            />
          )}
          <XAxis
            dataKey="recordedAtMs"
            type="number"
            scale="time"
            domain={timeDomain}
            tick={false}
            stroke={gridColor}
            interval="preserveStartEnd"
            minTickGap={60}
          />
          <YAxis
            domain={['auto', 'auto']}
            tickFormatter={yAxisFormatter}
            tick={{ fontSize: 11, fill: isDark ? '#b5ab8e' : '#6b7a3d' }}
            stroke={gridColor}
            width={chartYAxisWidth}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={lineColor}
            strokeWidth={2}
            isAnimationActive={true}
            animationDuration={450}
            dot={false}
            activeDot={{ r: 4, fill: lineColor }}
          />
          </LineChart>
        </ResponsiveContainer>
        <div
          ref={tooltipRef}
          className="absolute z-20 max-w-64 rounded-xl border px-3 py-2.5 text-left text-[13px] shadow-lg"
          style={{
            left: 0,
            top: 0,
            transform: `translate(${tooltipCurrentX.current}px, ${tooltipCurrentY.current}px) translate(-50%, -100%)`,
            backgroundColor: isDark ? '#2a3518' : '#fff',
            borderColor: isDark ? '#3a4820' : '#e8e3d6',
            color: isDark ? '#f4f1ea' : '#18211b',
            visibility: activeTooltip ? 'visible' : 'hidden',
            pointerEvents: isPinned ? 'auto' : 'none',
          }}
        >
          {isPinned && (
            <button
              type="button"
              onClick={() => setPinnedPoint(null)}
              className="absolute right-1 top-1 rounded p-0.5 opacity-70 transition-opacity hover:opacity-100"
              aria-label="Kijelölés bezárása"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {activeTooltip && (
            <>
              <div className={isPinned ? 'pr-4' : ''}>{formatDateShort(activeTooltip.recordedAtMs)}</div>
              <hr className="my-1.5 border-current opacity-15" />
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: lineColor }} />
                <span>{title} : {activeTooltip.value.toFixed(1)}{unit}</span>
              </div>
              {isPinned && canQuickCreateEvent && onQuickCreateAt && (
                <button
                  type="button"
                  onClick={() => onQuickCreateAt(new Date(activeTooltip.recordedAtMs).toISOString())}
                  className="mt-2 inline-flex items-center gap-1 rounded-md border border-sky-300 bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-700 transition-colors hover:bg-sky-100 dark:border-sky-700 dark:bg-vine-700 dark:text-sky-200 dark:hover:bg-vine-600"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Új esemény
                </button>
              )}
            </>
          )}
        </div>
        <EventTimelineRow
          events={events}
          domain={timeDomain}
          isDark={isDark}
          plotLeft={chartYAxisWidth}
          plotWidth={plotWidth}
          lineHeight={eventLineHeight}
          onEventSelect={onEventSelect}
          canQuickCreateEvent={canQuickCreateEvent}
          onQuickCreateNow={onQuickCreateNow}
          eventCountLabel={eventCountLabel}
          onOpenEventList={onOpenEventList}
          errorMessage={eventErrorMessage}
        />
        <AnimatedTimeAxis
          domain={timeDomain}
          timeRange={timeRange}
          isDark={isDark}
          plotLeft={chartYAxisWidth}
          plotWidth={plotWidth}
        />
      </div>
    </div>
  );
}
