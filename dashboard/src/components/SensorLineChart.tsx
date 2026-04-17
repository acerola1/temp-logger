import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceArea,
} from 'recharts';
import { chartHeight, chartMargin, chartYAxisWidth } from '../constants/chartLayout';
import type { TimeSeriesPoint } from '../lib/chartSeries';
import type { SessionType } from '../types/sensor';

interface SensorLineChartProps {
  data: TimeSeriesPoint[];
  dataKey: keyof TimeSeriesPoint;
  timeDomain: [number, number];
  gridColor: string;
  lineColor: string;
  isDark: boolean;
  sessionType: SessionType | null;
  bounds: { min: number; max: number } | null;
  unit: string;
  yAxisFormatter: (v: number) => string;
  onClick: (state: unknown) => void;
  onMouseMove: (state: unknown) => void;
  onMouseLeave: () => void;
}

export function SensorLineChart({
  data,
  dataKey,
  timeDomain,
  gridColor,
  lineColor,
  isDark,
  sessionType,
  bounds,
  unit,
  yAxisFormatter,
  onClick,
  onMouseMove,
  onMouseLeave,
}: SensorLineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <LineChart data={data} margin={chartMargin} onClick={onClick} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
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
  );
}
