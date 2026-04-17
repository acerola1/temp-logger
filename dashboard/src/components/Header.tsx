import { useState } from 'react';
import { Moon, Sun, Grape, LogIn, LogOut, Settings } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface HeaderProps {
  theme: 'light' | 'dark';
  isAdmin: boolean;
  canManageSessions?: boolean;
  onToggleTheme: () => void;
  onOpenSessionManager: () => void;
}

export function Header({
  theme,
  isAdmin,
  canManageSessions = true,
  onToggleTheme,
  onOpenSessionManager,
}: HeaderProps) {
  const { user, signInWithGoogle, signInWithTestAdmin, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const isEmulatorMode = import.meta.env.VITE_USE_EMULATORS === 'true';

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
      <div className="flex items-center gap-2">
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

        {!user ? (
          <>
            {isEmulatorMode && (
              <button
                onClick={signInWithTestAdmin}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-vine-600 text-white border border-vine-700 hover:bg-vine-700 transition-colors text-sm"
              >
                <LogIn className="w-4 h-4" />
                <span className="hidden sm:inline">Teszt admin belépés</span>
                <span className="sm:hidden">Teszt admin</span>
              </button>
            )}
            <button
              onClick={signInWithGoogle}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/70 dark:bg-vine-800/70 backdrop-blur-sm border border-vine-200 dark:border-vine-700 hover:bg-vine-100 dark:hover:bg-vine-700 transition-colors text-sm text-vine-700 dark:text-vine-200"
            >
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline">Belépés</span>
            </button>
          </>
        ) : (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-white/70 dark:bg-vine-800/70 backdrop-blur-sm border border-vine-200 dark:border-vine-700 hover:bg-vine-100 dark:hover:bg-vine-700 transition-colors"
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt=""
                  className="w-7 h-7 rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-vine-300 dark:bg-vine-600 flex items-center justify-center text-sm font-medium text-vine-700 dark:text-vine-100">
                  {user.displayName?.[0] ?? 'U'}
                </div>
              )}
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 w-48 bg-white dark:bg-vine-800 rounded-xl border border-vine-200 dark:border-vine-700 shadow-lg overflow-hidden">
                  <div className="px-3 py-2 border-b border-vine-100 dark:border-vine-700">
                    <p className="text-sm font-medium text-vine-900 dark:text-vine-50 truncate">
                      {user.displayName}
                    </p>
                    <p className="text-xs text-vine-400 truncate">{user.email}</p>
                  </div>
                  {isAdmin && canManageSessions && (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onOpenSessionManager();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-vine-700 dark:text-vine-200 hover:bg-vine-50 dark:hover:bg-vine-700 transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      Session kezelés
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      signOut();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-vine-700 dark:text-vine-200 hover:bg-vine-50 dark:hover:bg-vine-700 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Kijelentkezés
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
