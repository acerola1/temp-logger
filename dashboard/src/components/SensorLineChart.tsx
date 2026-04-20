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

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfLocalDay(timestampMs: number): number {
  const date = new Date(timestampMs);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function buildDayBands(timeDomain: [number, number]) {
  const [domainStart, domainEnd] = timeDomain;
  if (!Number.isFinite(domainStart) || !Number.isFinite(domainEnd) || domainEnd <= domainStart) {
    return [];
  }

  const bands: Array<{ x1: number; x2: number; key: string; isAlternate: boolean }> = [];
  let dayStart = startOfLocalDay(domainStart);
  let dayIndex = 0;

  while (dayStart < domainEnd) {
    const dayEnd = dayStart + DAY_MS;
    const x1 = Math.max(dayStart, domainStart);
    const x2 = Math.min(dayEnd, domainEnd);

    if (x2 > x1) {
      bands.push({
        x1,
        x2,
        key: `day-band-${dayStart}`,
        isAlternate: dayIndex % 2 === 1,
      });
    }

    dayStart = dayEnd;
    dayIndex += 1;
  }

  return bands;
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
  const dayBands = buildDayBands(timeDomain);
  const primaryDayFill = isDark ? '#1f2937' : '#ffffff';
  const alternateDayFill = isDark ? '#273449' : '#f3f4f6';

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <LineChart data={data} margin={chartMargin} onClick={onClick} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
        {dayBands.map((band) => (
          <ReferenceArea
            key={band.key}
            x1={band.x1}
            x2={band.x2}
            ifOverflow="extendDomain"
            fill={band.isAlternate ? alternateDayFill : primaryDayFill}
            fillOpacity={0.3}
            strokeOpacity={0}
          />
        ))}
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
