import { useEffect, useState } from 'react';
import { Thermometer, Droplets, Clock, Cpu } from 'lucide-react';
import { StatCard } from './StatCard';
import { formatDateTime, formatRelative } from '../lib/dateFormat';
import type { SensorReading } from '../types/sensor';

interface SummaryCardsProps {
  latest: SensorReading | null;
  stats: {
    minTemp: number;
    maxTemp: number;
    avgTemp: number;
    minHumidity: number;
    maxHumidity: number;
    avgHumidity: number;
  };
}

export function SummaryCards({ latest, stats }: SummaryCardsProps) {
  const [now, setNow] = useState(() => Date.now());
  const latestRecordedAt = latest?.recordedAt;

  useEffect(() => {
    if (!latestRecordedAt) {
      return;
    }

    let intervalId: number | undefined;
    const updateNow = () => setNow(Date.now());
    const nextMinuteInMs = 60000 - (Date.now() % 60000);

    const timeoutId = window.setTimeout(() => {
      updateNow();
      intervalId = window.setInterval(updateNow, 60000);
    }, nextMinuteInMs);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [latestRecordedAt]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      <StatCard
        label="Hőmérséklet"
        value={latest ? latest.temperatureC.toFixed(1) : '—'}
        unit="°C"
        icon={<Thermometer className="w-4 h-4" />}
        subtext={`Min: ${stats.minTemp}°C / Max: ${stats.maxTemp}°C`}
      />
      <StatCard
        label="Páratartalom"
        value={latest ? latest.humidity.toFixed(1) : '—'}
        unit="%"
        icon={<Droplets className="w-4 h-4" />}
        subtext={`Min: ${stats.minHumidity}% / Max: ${stats.maxHumidity}%`}
      />
      <StatCard
        label="Utolsó frissítés"
        value={latestRecordedAt ? formatRelative(latestRecordedAt, now) : '—'}
        icon={<Clock className="w-4 h-4" />}
        subtext={latestRecordedAt ? formatDateTime(latestRecordedAt) : undefined}
      />
      <StatCard
        label="Eszköz"
        value={latest?.deviceId ?? '—'}
        icon={<Cpu className="w-4 h-4" />}
      />
    </div>
  );
}
