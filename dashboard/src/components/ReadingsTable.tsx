import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { formatDateTime } from '../lib/dateFormat';
import type { SensorReading } from '../types/sensor';

interface ReadingsTableProps {
  readings: SensorReading[];
  isAdmin: boolean;
  onDeleteReading: (id: string) => Promise<void>;
}

export function ReadingsTable({ readings, isAdmin, onDeleteReading }: ReadingsTableProps) {
  const recent = readings.slice(-20).reverse();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Biztosan törlöd ezt a mérést?')) return;

    setDeletingId(id);
    try {
      await onDeleteReading(id);
    } catch (error) {
      console.error('Delete reading failed:', error);
      window.alert('Nem sikerült törölni a mérést.');
    } finally {
      setDeletingId(null);
    }
  };

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
              {isAdmin && (
                <th className="text-right py-2 px-2 font-medium text-vine-400 dark:text-vine-300">
                  Művelet
                </th>
              )}
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
                {isAdmin && (
                  <td className="py-2 px-2 text-right">
                    <button
                      onClick={() => handleDelete(r.id)}
                      disabled={deletingId === r.id}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                      title="Mérés törlése"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {deletingId === r.id ? 'Törlés...' : 'Törlés'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
