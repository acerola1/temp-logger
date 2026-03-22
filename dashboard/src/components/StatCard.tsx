import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  icon: ReactNode;
  subtext?: string;
}

export function StatCard({ label, value, unit, icon, subtext }: StatCardProps) {
  return (
    <div className="bg-white/70 dark:bg-vine-800/70 backdrop-blur-sm rounded-2xl border border-vine-200 dark:border-vine-700 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2 text-vine-400 dark:text-vine-300">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-vine-900 dark:text-vine-50">{value}</span>
        {unit && <span className="text-sm text-vine-400 dark:text-vine-300">{unit}</span>}
      </div>
      {subtext && (
        <p className="text-xs text-vine-400 dark:text-vine-300 mt-1">{subtext}</p>
      )}
    </div>
  );
}
