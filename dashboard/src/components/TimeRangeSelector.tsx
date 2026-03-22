import type { TimeRange } from '../types/sensor';

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

const options: { value: TimeRange; label: string }[] = [
  { value: '24h', label: '24 óra' },
  { value: '7d', label: '7 nap' },
  { value: '30d', label: '30 nap' },
];

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="inline-flex rounded-xl bg-white/70 dark:bg-vine-800/70 backdrop-blur-sm border border-vine-200 dark:border-vine-700 p-1 mb-6">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            value === opt.value
              ? 'bg-accent text-white shadow-sm'
              : 'text-vine-600 dark:text-vine-300 hover:text-vine-900 dark:hover:text-vine-50'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
