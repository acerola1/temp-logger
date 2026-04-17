import { useState, useRef, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceArea,
} from 'recharts';
import { chartColors } from '../constants/chartColors';
import {
  chartHeight,
  chartMargin,
  chartYAxisWidth,
} from '../constants/chartLayout';
import { AnimatedTimeAxis } from './AnimatedTimeAxis';
import { EventTimelineRow } from './EventTimelineRow';
import { formatDateShort } from '../lib/dateFormat';
import { buildChartSeries } from '../lib/chartSeries';
import { getTimeDomain } from '../lib/chartTime';
import { useElementWidth } from '../hooks/useElementWidth';
import type { SensorReading, SessionEvent, SessionType, TimeRange } from '../types/sensor';
import { Plus, X } from 'lucide-react';

interface HumidityChartProps {
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

export function HumidityChart({
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
}: HumidityChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [pinnedPoint, setPinnedPoint] = useState<TooltipPoint | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<TooltipPoint | null>(null);
  const chartWidth = useElementWidth(chartRef);
  const filteredReadings =
    timeRange === '30d'
      ? readings.filter((_, i) => i % 4 === 0)
      : timeRange === '7d'
        ? readings.filter((_, i) => i % 2 === 0)
        : readings;
  const data = buildChartSeries(filteredReadings);
  const timeDomain = timeDomainOverride ?? getTimeDomain(data.map((point) => point.recordedAtMs));

  const gridColor = isDark ? chartColors.gridDark : chartColors.grid;
  const plotWidth = Math.max(0, chartWidth - chartYAxisWidth - chartMargin.right);
  const eventLineHeight = chartHeight - chartMargin.top - chartMargin.bottom;

  const extractPoint = (state: unknown): TooltipPoint | null => {
    const s = state as {
      activeLabel?: number;
      activePayload?: Array<{ payload?: { recordedAtMs?: number; humidity?: number | null } }>;
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
      (item) => item.recordedAtMs === ms && typeof item.humidity === 'number',
    );
    if (!point || typeof point.humidity !== 'number') return null;
    return { recordedAtMs: point.recordedAtMs, value: point.humidity };
  };

  const handleMouseMove = (state: unknown) => {
    if (pinnedPoint) return;
    setHoveredPoint(extractPoint(state));
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

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

  const tooltipRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="bg-white/70 dark:bg-vine-800/70 backdrop-blur-sm rounded-2xl border border-vine-200 dark:border-vine-700 p-4 shadow-sm mb-4">
      <h2 className="mb-3 text-base font-semibold text-vine-900 dark:text-vine-50">Páratartalom</h2>
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
          {sessionType && (
            <ReferenceArea
              y1={sessionType.humidityMin}
              y2={sessionType.humidityMax}
              ifOverflow="extendDomain"
              fill={chartColors.humidity.line}
              fillOpacity={0.08}
              label={{
                value: `${sessionType.name} (${sessionType.humidityMin}-${sessionType.humidityMax}%)`,
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
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 11, fill: isDark ? '#b5ab8e' : '#6b7a3d' }}
            stroke={gridColor}
            width={chartYAxisWidth}
          />
          <Line
            type="monotone"
            dataKey="humidity"
            stroke={chartColors.humidity.line}
            strokeWidth={2}
            isAnimationActive={true}
            animationDuration={450}
            dot={false}
            activeDot={{ r: 4, fill: chartColors.humidity.line }}
          />
          </LineChart>
        </ResponsiveContainer>
        {activeTooltip && (
          <div
            ref={tooltipRef}
            className="pointer-events-none absolute z-20 max-w-64 -translate-x-1/2 rounded-xl border px-3 py-2.5 text-left text-[13px] shadow-lg transition-opacity"
            style={{
              left: scaleX(activeTooltip.recordedAtMs, timeDomain, chartYAxisWidth, plotWidth),
              top: chartMargin.top + 8,
              transform: 'translate(-50%, -100%)',
              backgroundColor: isDark ? '#2a3518' : '#fff',
              borderColor: isDark ? '#3a4820' : '#e8e3d6',
              color: isDark ? '#f4f1ea' : '#18211b',
              ...(isPinned ? { pointerEvents: 'auto' as const } : {}),
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
            <div className={isPinned ? 'pr-4' : ''}>{formatDateShort(activeTooltip.recordedAtMs)}</div>
            <hr className="my-1.5 border-current opacity-15" />
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chartColors.humidity.line }} />
              <span>Páratartalom : {activeTooltip.value.toFixed(1)}%</span>
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
          </div>
        )}
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
