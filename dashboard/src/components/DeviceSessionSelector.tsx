import type { Device, Session } from '../types/sensor';

interface DeviceSessionSelectorProps {
  devices: Device[];
  sessions: Session[];
  selectedDeviceId: string | null;
  selectedSessionId: string | null;
  onChange: (deviceId: string, sessionId: string | null) => void;
}

// Encoded value format: "deviceId" = all sessions, "deviceId:sessionId" = specific session
function encode(deviceId: string, sessionId: string | null): string {
  return sessionId ? `${deviceId}:${sessionId}` : deviceId;
}

function decode(value: string): { deviceId: string; sessionId: string | null } {
  const colonIdx = value.indexOf(':');
  if (colonIdx === -1) return { deviceId: value, sessionId: null };
  return { deviceId: value.slice(0, colonIdx), sessionId: value.slice(colonIdx + 1) };
}

export function DeviceSessionSelector({
  devices,
  sessions,
  selectedDeviceId,
  selectedSessionId,
  onChange,
}: DeviceSessionSelectorProps) {
  if (devices.length === 0) return null;

  const sessionsByDevice = devices.reduce<Record<string, Session[]>>((acc, device) => {
    acc[device.id] = sessions
      .filter((s) => s.deviceId === device.id)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
    return acc;
  }, {});

  const effectiveDeviceId = selectedDeviceId ?? devices[0]?.id ?? '';
  const currentValue = encode(effectiveDeviceId, selectedSessionId);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const { deviceId, sessionId } = decode(e.target.value);
    onChange(deviceId, sessionId);
  }

  return (
    <div className="mb-4">
      <select
        value={currentValue}
        onChange={handleChange}
        className="text-sm bg-white/70 dark:bg-vine-800/70 backdrop-blur-sm border border-vine-200 dark:border-vine-700 rounded-lg px-3 py-1.5 text-vine-700 dark:text-vine-200 focus:outline-none focus:ring-2 focus:ring-vine-400"
      >
        {devices.map((device) => {
          const deviceSessions = sessionsByDevice[device.id] ?? [];
          return (
            <optgroup key={device.id} label={device.name}>
              <option value={encode(device.id, null)}>Összes mérés</option>
              {deviceSessions.map((s) => (
                <option key={s.id} value={encode(device.id, s.id)}>
                  {s.name}
                  {s.status === 'active' ? ' (aktív)' : ''}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>
    </div>
  );
}
