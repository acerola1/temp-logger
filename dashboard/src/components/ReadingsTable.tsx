import { formatDateTime } from '../lib/dateFormat';
import type { SensorReading } from '../types/sensor';

interface ReadingsTableProps {
  readings: SensorReading[];
}

export function ReadingsTable({ readings }: ReadingsTableProps) {
  const recent = readings.slice(-20).reverse();

  return (
    <div className="bg-white/70 dark:bg-vine-800/70 backdrop-blur-sm rounded-2xl border border-vine-200 dark:border-vine-700 p-4 shadow-sm">
      <h2 className="text-base font-semibold text-vine-900 dark:text-vine-50 mb-3">
        Utolsó mérések
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-vine-200 dark:border-vine-700">
              <th className="text-left py-2 px-2 font-medium text-vine-400 dark:text-vine-300">
                Időpont
              </th>
              <th className="text-left py-2 px-2 font-medium text-vine-400 dark:text-vine-300">
                Eszköz
              </th>
              <th className="text-right py-2 px-2 font-medium text-vine-400 dark:text-vine-300">
                Hőm.
              </th>
              <th className="text-right py-2 px-2 font-medium text-vine-400 dark:text-vine-300">
                Párat.
              </th>
            </tr>
          </thead>
          <tbody>
            {recent.map((r) => (
              <tr
                key={r.id}
                className="border-b border-vine-100 dark:border-vine-700/50 last:border-0"
              >
                <td className="py-2 px-2 text-vine-600 dark:text-vine-200">
                  {formatDateTime(r.recordedAt)}
                </td>
                <td className="py-2 px-2 text-vine-600 dark:text-vine-200">{r.deviceId}</td>
                <td className="py-2 px-2 text-right font-mono text-vine-900 dark:text-vine-50">
                  {r.temperatureC.toFixed(1)}°C
                </td>
                <td className="py-2 px-2 text-right font-mono text-vine-900 dark:text-vine-50">
                  {r.humidity.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
