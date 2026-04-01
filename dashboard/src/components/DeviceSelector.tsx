import { Cpu } from 'lucide-react';
import type { Device } from '../types/sensor';

interface DeviceSelectorProps {
  devices: Device[];
  selectedId: string | null;
  onChange: (id: string) => void;
}

export function DeviceSelector({ devices, selectedId, onChange }: DeviceSelectorProps) {
  if (devices.length === 0) return null;

  return (
    <div className="flex items-center gap-2 mb-4">
      <Cpu className="w-4 h-4 text-vine-400" />
      <select
        value={selectedId ?? devices[0]?.id ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm bg-white/70 dark:bg-vine-800/70 backdrop-blur-sm border border-vine-200 dark:border-vine-700 rounded-lg px-3 py-1.5 text-vine-700 dark:text-vine-200 focus:outline-none focus:ring-2 focus:ring-vine-400"
      >
        {devices.map((device) => (
          <option key={device.id} value={device.id}>
            {device.name}
          </option>
        ))}
      </select>
    </div>
  );
}
