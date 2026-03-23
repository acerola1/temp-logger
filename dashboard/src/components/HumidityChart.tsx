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
import { formatDateShort } from '../lib/dateFormat';
import type { SensorReading, TimeRange } from '../types/sensor';

interface HumidityChartProps {
  readings: SensorReading[];
  timeRange: TimeRange;
  isDark: boolean;
}

export function HumidityChart({ readings, timeRange, isDark }: HumidityChartProps) {
  const data =
    timeRange === '30d'
      ? readings.filter((_, i) => i % 4 === 0)
      : timeRange === '7d'
        ? readings.filter((_, i) => i % 2 === 0)
        : readings;

  const gridColor = isDark ? chartColors.gridDark : chartColors.grid;

  return (
    <div className="bg-white/70 dark:bg-vine-800/70 backdrop-blur-sm rounded-2xl border border-vine-200 dark:border-vine-700 p-4 shadow-sm mb-4">
      <h2 className="text-base font-semibold text-vine-900 dark:text-vine-50 mb-3">
        Páratartalom
      </h2>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <ReferenceArea
            y1={85}
            y2={95}
            fill={chartColors.humidity.line}
            fillOpacity={0.08}
            label={{ value: 'Kalluszosítási cél (85-95%)', position: 'insideTopRight', fontSize: 11, fill: isDark ? '#d4cdb8' : '#6b7a3d' }}
          />
          <XAxis
            dataKey="recordedAt"
            tickFormatter={formatDateShort}
            tick={{ fontSize: 11, fill: isDark ? '#b5ab8e' : '#6b7a3d' }}
            stroke={gridColor}
            interval="preserveStartEnd"
            minTickGap={60}
          />
          <YAxis
            domain={['auto', 'auto']}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 11, fill: isDark ? '#b5ab8e' : '#6b7a3d' }}
            stroke={gridColor}
            width={45}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? '#2a3518' : '#fff',
              border: `1px solid ${isDark ? '#3a4820' : '#e8e3d6'}`,
              borderRadius: '12px',
              fontSize: 13,
              color: isDark ? '#f4f1ea' : '#18211b',
            }}
            labelFormatter={(label) => formatDateShort(String(label))}
            formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Páratartalom']}
          />
          <Line
            type="monotone"
            dataKey="humidity"
            stroke={chartColors.humidity.line}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: chartColors.humidity.line }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
