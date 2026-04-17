import { useRef } from 'react';
import { chartHeight, chartMargin, chartYAxisWidth } from '../constants/chartLayout';
import { chartColors } from '../constants/chartColors';
import { AnimatedTimeAxis } from './AnimatedTimeAxis';
import { EventTimelineRow } from './EventTimelineRow';
import { SensorLineChart } from './SensorLineChart';
import { buildChartSeries, type TimeSeriesPoint } from '../lib/chartSeries';
import { sampleReadingsForChart } from '../lib/chartSampling';
import { getTimeDomain } from '../lib/chartTime';
import { useElementWidth } from '../hooks/useElementWidth';
import { useChartTooltip } from '../hooks/useChartTooltip';
import { ChartTooltipOverlay } from './ChartTooltipOverlay';
import type { SensorReading, SessionEvent, SessionType, TimeRange } from '../types/sensor';

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
  const chartWidth = useElementWidth(chartRef);
  const filteredReadings = sampleReadingsForChart(readings, timeRange);
  const data = buildChartSeries(filteredReadings);
  const timeDomain = timeDomainOverride ?? getTimeDomain(data.map((point) => point.recordedAtMs));

  const gridColor = isDark ? chartColors.gridDark : chartColors.grid;
  const plotWidth = Math.max(0, chartWidth - chartYAxisWidth - chartMargin.right);
  const eventLineHeight = chartHeight - chartMargin.top - chartMargin.bottom;

  const {
    tooltipRef,
    activeTooltip,
    isPinned,
    setPinnedPoint,
    handleMouseMove,
    handleMouseLeave,
    handleChartClick,
  } = useChartTooltip({ data, dataKey, timeDomain, plotWidth, chartRef });

  const bounds = sessionType && referenceAreaBounds ? referenceAreaBounds(sessionType) : null;

  return (
    <div className="bg-white/70 dark:bg-vine-800/70 backdrop-blur-sm rounded-2xl border border-vine-200 dark:border-vine-700 p-4 shadow-sm mb-4">
      <h2 className="mb-3 text-base font-semibold text-vine-900 dark:text-vine-50">{title}</h2>
      <div ref={chartRef} className="relative [&_*]:outline-none">
        <SensorLineChart
          data={data}
          dataKey={dataKey}
          timeDomain={timeDomain}
          gridColor={gridColor}
          lineColor={lineColor}
          isDark={isDark}
          sessionType={sessionType}
          bounds={bounds}
          unit={unit}
          yAxisFormatter={yAxisFormatter}
          onClick={handleChartClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
        <ChartTooltipOverlay
          tooltipRef={tooltipRef}
          activeTooltip={activeTooltip}
          isPinned={isPinned}
          isDark={isDark}
          lineColor={lineColor}
          title={title}
          unit={unit}
          canQuickCreateEvent={canQuickCreateEvent}
          onQuickCreateAt={onQuickCreateAt}
          onDismiss={() => setPinnedPoint(null)}
        />
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
