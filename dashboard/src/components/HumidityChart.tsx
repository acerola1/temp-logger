import { useRef } from 'react';
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
import { chartMargin, chartYAxisWidth } from '../constants/chartLayout';
import { AnimatedTimeAxis } from './AnimatedTimeAxis';
import { formatDateShort } from '../lib/dateFormat';
import { buildChartSeries } from '../lib/chartSeries';
import { getTimeDomain } from '../lib/chartTime';
import { useElementWidth } from '../hooks/useElementWidth';
import type { SensorReading, TimeRange } from '../types/sensor';

interface HumidityChartProps {
  readings: SensorReading[];
  timeRange: TimeRange;
  isDark: boolean;
}

export function HumidityChart({ readings, timeRange, isDark }: HumidityChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartWidth = useElementWidth(chartRef);
  const filteredReadings =
    timeRange === '30d'
      ? readings.filter((_, i) => i % 4 === 0)
      : timeRange === '7d'
        ? readings.filter((_, i) => i % 2 === 0)
        : readings;
  const data = buildChartSeries(filteredReadings);
  const timeDomain = getTimeDomain(data.map((point) => point.recordedAtMs));

  const gridColor = isDark ? chartColors.gridDark : chartColors.grid;
  const plotWidth = Math.max(0, chartWidth - chartYAxisWidth - chartMargin.right);

  return (
    <div className="bg-white/70 dark:bg-vine-800/70 backdrop-blur-sm rounded-2xl border border-vine-200 dark:border-vine-700 p-4 shadow-sm mb-4">
      <h2 className="text-base font-semibold text-vine-900 dark:text-vine-50 mb-3">
        Páratartalom
      </h2>
      <div ref={chartRef} className="relative">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={chartMargin}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <ReferenceArea
            y1={85}
            y2={95}
            ifOverflow="extendDomain"
            fill={chartColors.humidity.line}
            fillOpacity={0.08}
            label={{ value: 'Kalluszosítási cél (85-95%)', position: 'insideTopRight', fontSize: 11, fill: isDark ? '#d4cdb8' : '#6b7a3d' }}
          />
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
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? '#2a3518' : '#fff',
              border: `1px solid ${isDark ? '#3a4820' : '#e8e3d6'}`,
              borderRadius: '12px',
              fontSize: 13,
              color: isDark ? '#f4f1ea' : '#18211b',
            }}
            labelFormatter={(label) => formatDateShort(Number(label))}
            formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Páratartalom']}
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
