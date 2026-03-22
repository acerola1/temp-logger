import { Moon, Sun, Grape } from 'lucide-react';

interface HeaderProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export function Header({ theme, onToggleTheme }: HeaderProps) {
  return (
    <header className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <Grape className="w-8 h-8 text-vine-500" />
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-vine-900 dark:text-vine-50">
            Szőlő Oltványtermesztés Monitor
          </h1>
          <p className="text-sm text-vine-400 dark:text-vine-300">
            Hőmérséklet & páratartalom figyelés
          </p>
        </div>
      </div>
      <button
        onClick={onToggleTheme}
        className="p-2 rounded-xl bg-white/70 dark:bg-vine-800/70 backdrop-blur-sm border border-vine-200 dark:border-vine-700 hover:bg-vine-100 dark:hover:bg-vine-700 transition-colors"
        aria-label="Téma váltás"
      >
        {theme === 'light' ? (
          <Moon className="w-5 h-5 text-vine-600" />
        ) : (
          <Sun className="w-5 h-5 text-vine-200" />
        )}
      </button>
    </header>
  );
}
