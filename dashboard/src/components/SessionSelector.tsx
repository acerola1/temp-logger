import { CalendarDays } from 'lucide-react';
import type { Session } from '../types/sensor';

interface SessionSelectorProps {
  sessions: Session[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
}

export function SessionSelector({ sessions, selectedId, onChange }: SessionSelectorProps) {
  if (sessions.length === 0) return null;

  return (
    <div className="flex items-center gap-2 mb-4">
      <CalendarDays className="w-4 h-4 text-vine-400" />
      <select
        value={selectedId ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="text-sm bg-white/70 dark:bg-vine-800/70 backdrop-blur-sm border border-vine-200 dark:border-vine-700 rounded-lg px-3 py-1.5 text-vine-700 dark:text-vine-200 focus:outline-none focus:ring-2 focus:ring-vine-400"
      >
        <option value="">Összes mérés</option>
        {sessions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} {s.status === 'active' ? '(aktív)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
