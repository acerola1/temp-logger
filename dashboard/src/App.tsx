import { useState } from 'react';
import { Header } from './components/Header';
import { SummaryCards } from './components/SummaryCards';
import { TimeRangeSelector } from './components/TimeRangeSelector';
import { TemperatureChart } from './components/TemperatureChart';
import { HumidityChart } from './components/HumidityChart';
import { ReadingsTable } from './components/ReadingsTable';
import { useTheme } from './hooks/useTheme';
import { useReadings } from './hooks/useReadings';
import { mockReadings } from './data/mockReadings';
import type { TimeRange } from './types/sensor';

export default function App() {
  const { theme, toggle } = useTheme();
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const { readings, latest, stats } = useReadings(mockReadings, timeRange);
  const isDark = theme === 'dark';

  return (
    <div className="min-h-dvh bg-vine-50 dark:bg-vine-900 transition-colors">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <Header theme={theme} onToggleTheme={toggle} />
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        <SummaryCards latest={latest} stats={stats} />
        <TemperatureChart readings={readings} timeRange={timeRange} isDark={isDark} />
        <HumidityChart readings={readings} timeRange={timeRange} isDark={isDark} />
        <ReadingsTable readings={readings} />
      </div>
    </div>
  );
}
