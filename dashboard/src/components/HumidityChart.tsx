import { chartColors } from '../constants/chartColors';
import { SensorChart, type SensorChartProps } from './SensorChart';

type HumidityChartProps = Omit<SensorChartProps, 'title' | 'dataKey' | 'unit' | 'lineColor' | 'yAxisFormatter' | 'referenceAreaBounds'>;

export function HumidityChart(props: HumidityChartProps) {
  return (
    <SensorChart
      {...props}
      title="Páratartalom"
      dataKey="humidity"
      unit="%"
      lineColor={chartColors.humidity.line}
      yAxisFormatter={(v) => `${v}%`}
      referenceAreaBounds={(st) => ({ min: st.humidityMin, max: st.humidityMax })}
    />
  );
}
