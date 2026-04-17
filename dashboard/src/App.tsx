import { useEffect, useState } from 'react';
import { AuthProvider } from './lib/auth';
import { Header } from './components/Header';
import { CuttingsPage } from './components/CuttingsPage';
import { MonitorPage } from './components/MonitorPage';
import { useTheme } from './hooks/useTheme';
import { useIsAdmin } from './hooks/useIsAdmin';
import { getViewFromPath, type DashboardView } from './lib/dashboardRouting';

function Dashboard() {
  const { theme, toggle } = useTheme();
  const { isAdmin } = useIsAdmin();
  const [currentView, setCurrentView] = useState<DashboardView>(() =>
    getViewFromPath(window.location.pathname),
  );
  const [lastMonitorSearch, setLastMonitorSearch] = useState(() =>
    getViewFromPath(window.location.pathname) === 'monitor' ? window.location.search : '',
  );

  useEffect(() => {
    const handlePopState = () => {
      const nextView = getViewFromPath(window.location.pathname);
      setCurrentView(nextView);
      if (nextView === 'monitor') {
        setLastMonitorSearch(window.location.search);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToView = (view: DashboardView) => {
    if (view === 'monitor') {
      const nextPath = `/${lastMonitorSearch}`;
      if (window.location.pathname + window.location.search !== nextPath) {
        window.history.pushState({}, '', nextPath);
      }
    } else {
      setLastMonitorSearch(window.location.search);
      if (window.location.pathname !== '/dugvanyok') {
        window.history.pushState({}, '', '/dugvanyok');
      }
    }

    setCurrentView(view);
  };

  return (
    <div className="min-h-dvh bg-vine-50 dark:bg-vine-900 transition-colors">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <Header
          theme={theme}
          isAdmin={isAdmin}
          onToggleTheme={toggle}
          canManageSessions={currentView === 'monitor'}
          onOpenSessionManager={() => window.dispatchEvent(new Event('dashboard:open-session-manager'))}
        />

        <div className="mb-6 border-b border-vine-200 dark:border-vine-700 flex gap-6">
          <button
            onClick={() => navigateToView('monitor')}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              currentView === 'monitor'
                ? 'border-vine-600 text-vine-700 dark:border-vine-400 dark:text-vine-200'
                : 'border-transparent text-vine-500 hover:text-vine-700 dark:text-vine-400 dark:hover:text-vine-200'
            }`}
          >
            Monitor
          </button>
          <button
            onClick={() => navigateToView('cuttings')}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              currentView === 'cuttings'
                ? 'border-vine-600 text-vine-700 dark:border-vine-400 dark:text-vine-200'
                : 'border-transparent text-vine-500 hover:text-vine-700 dark:text-vine-400 dark:hover:text-vine-200'
            }`}
          >
            Dugványok
          </button>
        </div>

        {currentView === 'monitor' ? (
          <MonitorPage theme={theme} isAdmin={isAdmin} />
        ) : (
          <CuttingsPage isAdmin={isAdmin} />
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Dashboard />
    </AuthProvider>
  );
}
