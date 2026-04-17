import { chartColors } from '../constants/chartColors';
import { SensorChart, type SensorChartProps } from './SensorChart';

type TemperatureChartProps = Omit<SensorChartProps, 'title' | 'dataKey' | 'unit' | 'lineColor' | 'yAxisFormatter' | 'referenceAreaBounds'>;

export function TemperatureChart(props: TemperatureChartProps) {
  return (
    <SensorChart
      {...props}
      title="Hőmérséklet"
      dataKey="temperatureC"
      unit="°C"
      lineColor={chartColors.temperature.line}
      yAxisFormatter={(v) => `${v}°`}
      referenceAreaBounds={(st) => ({ min: st.temperatureMin, max: st.temperatureMax })}
    />
  );
}
