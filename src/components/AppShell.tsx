import React, { useState } from 'react';
import {
  Activity,
  Bell,
  Bot,
  Calendar,
  CheckCircle2,
  Eye,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PhoneCall,
  Pill,
  RotateCcw,
  Settings,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { useCareCircle } from '../context/CareCircleContext';
import { DEMO_PROFILES, getDemoActor } from '../lib/demoSeed';
import { TRANSLATIONS } from '../lib/i18n';
import type { AppLanguage, AppPage, DemoCircleId, UserRole } from '../types/carecircle';
import { EmergencyModal } from './EmergencyModal';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    mode,
    demoCircleId,
    currentPage,
    setCurrentPage,
    userAccount,
    activeCircle,
    userCircles,
    switchActiveCircle,
    permissions,
    language,
    theme,
    highContrast,
    updatePreferences,
    switchDemoRole,
    switchDemoCircle,
    resetDemoSandbox,
    logout,
    notifications,
  } = useCareCircle();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const t = TRANSLATIONS[language];
  const unreadCount = notifications.filter((n) => !n.read).length;

  const navItems: Array<{ id: AppPage; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: 'dashboard', label: t.nav.dashboard, icon: <LayoutDashboard className="h-5 w-5" aria-hidden="true" /> },
    { id: 'tracker', label: t.nav.tracker, icon: <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> },
    { id: 'medications', label: t.nav.medications, icon: <Pill className="h-5 w-5" aria-hidden="true" /> },
    { id: 'appointments', label: t.nav.appointments, icon: <Calendar className="h-5 w-5" aria-hidden="true" /> },
    { id: 'members', label: t.nav.members, icon: <Users className="h-5 w-5" aria-hidden="true" /> },
    { id: 'assistant', label: t.nav.assistant, icon: <Bot className="h-5 w-5" aria-hidden="true" /> },
    { id: 'analytics', label: t.nav.analytics, icon: <Activity className="h-5 w-5" aria-hidden="true" /> },
    {
      id: 'notifications',
      label: t.nav.notifications,
      icon: <Bell className="h-5 w-5" aria-hidden="true" />,
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    { id: 'settings', label: t.nav.settings, icon: <Settings className="h-5 w-5" aria-hidden="true" /> },
  ];

  const handleNav = (id: AppPage) => {
    setCurrentPage(id);
    setMobileNavOpen(false);
  };

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between p-4">
      <div>
        <div className="px-3 py-2">
          <button
            type="button"
            onClick={() => handleNav('dashboard')}
            className="font-display text-xl font-bold tracking-tight text-sky-800 dark:text-sky-400"
          >
            CareCircle
          </button>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
            {activeCircle ? activeCircle.elderlyName : t.tagline}
          </p>
        </div>

        {/* Multi-circle switcher for Firebase users belonging to >1 circle */}
        {mode === 'firebase' && userCircles.length > 1 && (
          <div className="mt-3 px-2">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
              Active CareCircle
            </label>
            <select
              value={activeCircle?.id || ''}
              onChange={(e) => void switchActiveCircle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              {userCircles.map((c) => (
                <option key={c.circleId} value={c.circleId}>
                  {c.elderlyName} ({c.role})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Demo Sandbox Multi-Profile, Persona Switcher & Reset */}
        {mode === 'demo' && (
          <div className="hc-surface mt-3 space-y-2.5 rounded-xl border border-sky-200 bg-sky-50/70 p-3 dark:border-sky-900 dark:bg-sky-950/40">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-900 dark:text-sky-300">
                Demo CareCircle Profile
              </p>
              <div className="mt-1.5 grid grid-cols-2 gap-1">
                {(['demo-circle-sen', 'demo-circle-kapoor'] as DemoCircleId[]).map((cid) => {
                  const meta = DEMO_PROFILES[cid];
                  const isActive = demoCircleId === cid;
                  return (
                    <button
                      key={cid}
                      type="button"
                      onClick={() => switchDemoCircle(cid)}
                      className={`rounded-lg px-2 py-1.5 text-left text-xs font-semibold transition-colors ${
                        isActive
                          ? 'hc-primary-btn bg-sky-700 text-white'
                          : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="block truncate">{meta.label}</span>
                      <span className="block font-mono text-[10px] opacity-80">Age {meta.age}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-900 dark:text-sky-300">
                Demo Role
              </p>
              <div className="mt-1.5 grid grid-cols-3 gap-1">
                {(['elderly', 'family', 'caregiver'] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => switchDemoRole(r)}
                    className={`rounded-lg px-2 py-1.5 text-xs font-semibold capitalize transition-colors ${
                      permissions.role === r
                        ? 'hc-primary-btn bg-sky-700 text-white'
                        : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-sky-200/70 pt-2 dark:border-sky-900/70">
              <p className="min-w-0 truncate text-xs text-slate-600 dark:text-slate-300">
                {getDemoActor(demoCircleId, permissions.role).displayName}
              </p>
              <button
                type="button"
                onClick={resetDemoSandbox}
                title="Reset all demo sample data to initial state"
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-sky-300 bg-white px-2 py-1 text-[11px] font-semibold text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:bg-slate-900 dark:text-sky-300 dark:hover:bg-slate-800"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                Reset
              </button>
            </div>
          </div>
        )}

        <nav className="mt-5 space-y-1" aria-label="Main navigation">
          {navItems.map((item) => {
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-medium transition-colors ${
                  active
                    ? 'hc-primary-btn bg-sky-700 text-white'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/80'
                }`}
              >
                <span className="flex items-center gap-3 whitespace-nowrap">
                  {item.icon}
                  <span>{item.label}</span>
                </span>
                {item.badge !== undefined && (
                  <span className="font-mono text-xs font-semibold tabular-nums">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
        {activeCircle && (
          <button
            type="button"
            onClick={() => setEmergencyOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200 dark:hover:bg-rose-900/60 transition-colors"
          >
            <PhoneCall className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t.actions.emergencyCall}</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => void logout()}
          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span>{t.nav.logout}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hc-surface fixed inset-y-0 left-0 z-20 hidden w-64 overflow-y-auto border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:block">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="hc-surface relative z-10 flex h-full w-72 max-w-[85vw] flex-col overflow-y-auto bg-white dark:bg-slate-900">
            <div className="flex justify-end p-3 pb-0">
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close menu"
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1">{sidebarContent}</div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="lg:pl-64">
        {/* Top Workspace Bar */}
        <header className="hc-surface sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open navigation menu"
                className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 lg:hidden"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>
              <div className="min-w-0 truncate text-sm">
                <span className="font-semibold text-slate-900 dark:text-white">
                  {userAccount?.displayName || 'CareCircle'}
                </span>
                <span className="mx-2 text-slate-400" aria-hidden="true">·</span>
                <span className="capitalize text-slate-600 dark:text-slate-400">
                  {permissions.role}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Language Switcher */}
              <select
                aria-label="Language"
                value={language}
                onChange={(e) => void updatePreferences({ language: e.target.value as AppLanguage })}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                <option value="en">EN</option>
                <option value="hi">हिन्दी</option>
                <option value="bn">বাংলা</option>
              </select>

              {/* High Contrast Toggle */}
              <button
                type="button"
                onClick={() => void updatePreferences({ highContrast: !highContrast })}
                aria-pressed={highContrast}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  highContrast
                    ? 'border-yellow-400 bg-black text-yellow-300'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{t.actions.highContrast}</span>
              </button>

              {/* Light / Dark Toggle */}
              <button
                type="button"
                onClick={() => void updatePreferences({ theme: theme === 'dark' ? 'light' : 'dark' })}
                aria-label="Toggle dark mode"
                className="rounded-lg border border-slate-300 bg-white p-1.5 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>

      <EmergencyModal open={emergencyOpen} onClose={() => setEmergencyOpen(false)} />
    </div>
  );
};
