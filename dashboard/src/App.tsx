import { useEffect, useState } from 'react';
import { AuthProvider } from './lib/auth';
import { Header } from './components/Header';
import { CuttingsPage } from './components/CuttingsPage';
import { MonitorPage } from './components/MonitorPage';
import { VinesPage } from './features/vines';
import { useTheme } from './hooks/useTheme';
import { useIsAdmin } from './hooks/useIsAdmin';
import { getViewFromPath, type DashboardView } from './lib/dashboardRouting';

const VIEW_PATHS: Record<Exclude<DashboardView, 'monitor'>, string> = {
  cuttings: '/dugvanyok',
  vines: '/tokek',
};

const VIEW_TABS: Array<{ view: DashboardView; label: string }> = [
  { view: 'monitor', label: 'Monitor' },
  { view: 'cuttings', label: 'Dugványok' },
  { view: 'vines', label: 'Tőkék' },
];

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
    let didNavigate = false;

    if (view === 'monitor') {
      const nextPath = `/${lastMonitorSearch}`;
      if (window.location.pathname + window.location.search !== nextPath) {
        window.history.pushState({}, '', nextPath);
        didNavigate = true;
      }
    } else {
      // A monitor query stringjét csak onnan jövet mentjük el, különben egy másik
      // nézet szűrői kerülnének vissza a monitorra.
      if (currentView === 'monitor') {
        setLastMonitorSearch(window.location.search);
      }

      const nextPath = VIEW_PATHS[view];
      if (window.location.pathname !== nextPath) {
        window.history.pushState({}, '', nextPath);
        didNavigate = true;
      }
    }

    setCurrentView(view);
    if (didNavigate) {
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
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
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.view}
              onClick={() => navigateToView(tab.view)}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                currentView === tab.view
                  ? 'border-vine-600 text-vine-700 dark:border-vine-400 dark:text-vine-200'
                  : 'border-transparent text-vine-500 hover:text-vine-700 dark:text-vine-400 dark:hover:text-vine-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {currentView === 'monitor' && <MonitorPage theme={theme} isAdmin={isAdmin} />}
        {currentView === 'cuttings' && <CuttingsPage isAdmin={isAdmin} />}
        {currentView === 'vines' && <VinesPage isAdmin={isAdmin} />}
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
