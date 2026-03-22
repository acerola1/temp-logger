import { Thermometer, Droplets, Clock, Cpu } from 'lucide-react';
import { StatCard } from './StatCard';
import { formatRelative } from '../lib/dateFormat';
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
        value={latest ? formatRelative(latest.recordedAt) : '—'}
        icon={<Clock className="w-4 h-4" />}
      />
      <StatCard
        label="Eszköz"
        value={latest?.deviceId ?? '—'}
        icon={<Cpu className="w-4 h-4" />}
      />
    </div>
  );
}
