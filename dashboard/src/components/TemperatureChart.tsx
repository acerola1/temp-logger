import { useState, useRef } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
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
import { sampleReadingsForChart } from '../lib/chartSampling';
import { getTimeDomain } from '../lib/chartTime';
import { useElementWidth } from '../hooks/useElementWidth';
import type { SensorReading, SessionEvent, SessionType, TimeRange } from '../types/sensor';
import { Plus, X } from 'lucide-react';

interface TemperatureChartProps {
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

interface PinnedTooltipPoint {
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

export function TemperatureChart({
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
}: TemperatureChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [pinnedPoint, setPinnedPoint] = useState<PinnedTooltipPoint | null>(null);
  const chartWidth = useElementWidth(chartRef);
  const filteredReadings = sampleReadingsForChart(readings, timeRange);
  const data = buildChartSeries(filteredReadings);
  const timeDomain = timeDomainOverride ?? getTimeDomain(data.map((point) => point.recordedAtMs));

  const gridColor = isDark ? chartColors.gridDark : chartColors.grid;
  const plotWidth = Math.max(0, chartWidth - chartYAxisWidth - chartMargin.right);
  const eventLineHeight = chartHeight - chartMargin.top - chartMargin.bottom;

  const handleChartClick = (state: unknown) => {
    const nextState = state as {
      activeLabel?: number;
      activePayload?: Array<{ payload?: { recordedAtMs?: number; temperatureC?: number | null } }>;
    };
    const payload = nextState.activePayload?.[0]?.payload;
    const maybeRecordedAtMs =
      typeof payload?.recordedAtMs === 'number'
        ? payload.recordedAtMs
        : typeof nextState.activeLabel === 'number'
          ? nextState.activeLabel
          : null;

    if (maybeRecordedAtMs === null) {
      setPinnedPoint(null);
      return;
    }

    const point = data.find(
      (item) => item.recordedAtMs === maybeRecordedAtMs && typeof item.temperatureC === 'number',
    );
    if (!point || typeof point.temperatureC !== 'number') {
      setPinnedPoint(null);
      return;
    }
    const recordedAtMs = point.recordedAtMs;
    const value = point.temperatureC;

    setPinnedPoint((current) =>
      current?.recordedAtMs === recordedAtMs
        ? null
        : {
            recordedAtMs,
            value,
          },
    );
  };

  return (
    <div className="bg-white/70 dark:bg-vine-800/70 backdrop-blur-sm rounded-2xl border border-vine-200 dark:border-vine-700 p-4 shadow-sm mb-4">
      <h2 className="mb-3 text-base font-semibold text-vine-900 dark:text-vine-50">Hőmérséklet</h2>
      <div ref={chartRef} className="relative">
        <ResponsiveContainer width="100%" height={chartHeight}>
          <LineChart data={data} margin={chartMargin} onClick={handleChartClick}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          {sessionType && (
            <ReferenceArea
              y1={sessionType.temperatureMin}
              y2={sessionType.temperatureMax}
              ifOverflow="extendDomain"
              fill={chartColors.temperature.line}
              fillOpacity={0.08}
              label={{
                value: `${sessionType.name} (${sessionType.temperatureMin}-${sessionType.temperatureMax}°C)`,
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
            tickFormatter={(v: number) => `${v}°`}
            tick={{ fontSize: 11, fill: isDark ? '#b5ab8e' : '#6b7a3d' }}
            stroke={gridColor}
            width={chartYAxisWidth}
          />
          <Tooltip
            active={pinnedPoint ? false : undefined}
            contentStyle={{
              backgroundColor: isDark ? '#2a3518' : '#fff',
              border: `1px solid ${isDark ? '#3a4820' : '#e8e3d6'}`,
              borderRadius: '12px',
              fontSize: 13,
              color: isDark ? '#f4f1ea' : '#18211b',
            }}
            labelFormatter={(label) => formatDateShort(Number(label))}
            formatter={(value) => [`${Number(value).toFixed(1)}°C`, 'Hőmérséklet']}
          />
          <Line
            type="monotone"
            dataKey="temperatureC"
            stroke={chartColors.temperature.line}
            strokeWidth={2}
            isAnimationActive={true}
            animationDuration={450}
            dot={false}
            activeDot={{ r: 4, fill: chartColors.temperature.line }}
          />
          </LineChart>
        </ResponsiveContainer>
        {pinnedPoint && (
          <div
            className="absolute z-20 max-w-64 -translate-x-1/2 rounded-xl border px-3 py-2 text-left text-xs shadow-lg"
            style={{
              left: scaleX(pinnedPoint.recordedAtMs, timeDomain, chartYAxisWidth, plotWidth),
              top: chartMargin.top + 8,
              transform: 'translate(-50%, -100%)',
              backgroundColor: isDark ? '#2a3518' : '#fff',
              borderColor: isDark ? '#3a4820' : '#e8e3d6',
              color: isDark ? '#f4f1ea' : '#18211b',
            }}
          >
            <button
              type="button"
              onClick={() => setPinnedPoint(null)}
              className="absolute right-1 top-1 rounded p-0.5 opacity-70 transition-opacity hover:opacity-100"
              aria-label="Kijelölés bezárása"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <div className="pr-4 opacity-80">{formatDateShort(pinnedPoint.recordedAtMs)}</div>
            <div className="mt-1">{pinnedPoint.value.toFixed(1)}°C</div>
            {canQuickCreateEvent && onQuickCreateAt && (
              <button
                type="button"
                onClick={() => onQuickCreateAt(new Date(pinnedPoint.recordedAtMs).toISOString())}
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
