import { useState } from 'react';
import { Header } from './components/Header';
import { SummaryCards } from './components/SummaryCards';
import { TimeRangeSelector } from './components/TimeRangeSelector';
import { TemperatureChart } from './components/TemperatureChart';
import { HumidityChart } from './components/HumidityChart';
import { ReadingsTable } from './components/ReadingsTable';
import { useTheme } from './hooks/useTheme';
import { useReadings } from './hooks/useReadings';
import { useFirestoreReadings } from './hooks/useFirestoreReadings';
import type { TimeRange } from './types/sensor';
import { Loader2 } from 'lucide-react';

export default function App() {
  const { theme, toggle } = useTheme();
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const { readings: allReadings, loading, error } = useFirestoreReadings();
  const { readings, latest, stats } = useReadings(allReadings, timeRange);
  const isDark = theme === 'dark';

  return (
    <div className="min-h-dvh bg-vine-50 dark:bg-vine-900 transition-colors">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <Header theme={theme} onToggleTheme={toggle} />
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />

        {loading && (
          <div className="flex items-center justify-center py-20 text-vine-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Adatok betöltése...
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 mb-6 text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <SummaryCards latest={latest} stats={stats} />
            <TemperatureChart readings={readings} timeRange={timeRange} isDark={isDark} />
            <HumidityChart readings={readings} timeRange={timeRange} isDark={isDark} />
            <ReadingsTable readings={readings} />
          </>
        )}
      </div>
    </div>
  );
}
