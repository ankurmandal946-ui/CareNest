import React from 'react';
import { X } from 'lucide-react';
import { AppShell } from './components/AppShell';
import { CareCircleProvider, useCareCircle } from './context/CareCircleContext';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { AssistantPage } from './pages/AssistantPage';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { LandingPage } from './pages/LandingPage';
import { MedicationsPage } from './pages/MedicationsPage';
import { MembersPage } from './pages/MembersPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { SettingsPage } from './pages/SettingsPage';
import { TrackerPage } from './pages/TrackerPage';

const CareCircleRouter: React.FC = () => {
  const { mode, authReady, currentPage, activeCircle, userCircles, toasts, dismissToast } =
    useCareCircle();

  let content: React.ReactNode;

  if (!authReady) {
    content = (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <p className="font-display text-2xl font-bold text-sky-700 dark:text-sky-400">CareCircle</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Loading your care workspace...</p>
        </div>
      </div>
    );
  } else if (mode === 'none') {
    content = currentPage === 'auth' ? <AuthPage /> : <LandingPage />;
  } else if (currentPage === 'onboarding' || (mode === 'firebase' && userCircles.length === 0)) {
    content = <OnboardingPage />;
  } else if (mode === 'firebase' && !activeCircle) {
    content = (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <p className="font-display text-2xl font-bold text-sky-700 dark:text-sky-400">CareCircle</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Loading CareCircle profile...</p>
        </div>
      </div>
    );
  } else {
    const inner = (() => {
      switch (currentPage) {
        case 'medications':
          return <MedicationsPage />;
        case 'tracker':
          return <TrackerPage />;
        case 'appointments':
          return <AppointmentsPage />;
        case 'members':
          return <MembersPage />;
        case 'assistant':
          return <AssistantPage />;
        case 'analytics':
          return <AnalyticsPage />;
        case 'notifications':
          return <NotificationsPage />;
        case 'settings':
          return <SettingsPage />;
        case 'dashboard':
        default:
          return <DashboardPage />;
      }
    })();

    content = <AppShell>{inner}</AppShell>;
  }

  return (
    <>
      {content}
      {/* Toast Notifications */}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${
              toast.type === 'error'
                ? 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100'
                : toast.type === 'success'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100'
                : 'border-sky-300 bg-white text-slate-900 dark:border-sky-800 dark:bg-slate-900 dark:text-slate-100'
            }`}
          >
            <span>{toast.text}</span>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="shrink-0 opacity-70 hover:opacity-100"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
};

class CareCircleErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error?.message || 'An unexpected interface error occurred.',
    };
  }

  override componentDidCatch(error: Error) {
    console.error('CareCircle UI error boundary caught:', error);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
          <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-7 shadow-sm dark:border-rose-900 dark:bg-slate-900">
            <p className="font-display text-lg font-bold text-sky-700 dark:text-sky-400">CareCircle</p>
            <h1 className="mt-2 font-display text-2xl font-bold text-slate-900 dark:text-white">
              Something interrupted this view
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-800 transition-colors"
            >
              Reload CareCircle
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <CareCircleErrorBoundary>
      <CareCircleProvider>
        <CareCircleRouter />
      </CareCircleProvider>
    </CareCircleErrorBoundary>
  );
}
