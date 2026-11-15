import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  Mail,
  Play,
  RefreshCw,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { useCareCircle } from '../context/CareCircleContext';
import { formatTimestamp } from '../lib/scheduleUtils';
import type { NotificationItem } from '../types/carecircle';

type EventFilter =
  | 'all'
  | 'upcoming_dose'
  | 'missed_dose'
  | 'appointment'
  | 'caregiver_update'
  | 'test_email';

type DeliveryFilter = 'all' | 'real_email' | 'simulated_demo' | 'in_app';

function formatEventLabel(eventType: NotificationItem['eventType']): string {
  switch (eventType) {
    case 'upcoming_dose':
      return 'UPCOMING DOSE';
    case 'missed_dose':
      return 'MISSED DOSE';
    case 'appointment_reminder':
      return 'APPOINTMENT REMINDER';
    case 'appointment_change':
      return 'APPOINTMENT UPDATE';
    case 'caregiver_update':
      return 'CAREGIVER ALERT';
    case 'test_email':
      return 'TEST EMAIL';
  }
}

export const NotificationsPage: React.FC = () => {
  const {
    notifications,
    members,
    userPrivate,
    emailProviderStatus,
    refreshEmailStatus,
    updateNotificationPrefs,
    sendTestNotification,
    runReminderCheck,
    markNotificationRead,
    markAllNotificationsRead,
    notifyToast,
  } = useCareCircle();

  const [testEmail, setTestEmail] = useState(userPrivate?.email || '');
  const [sendingTest, setSendingTest] = useState(false);
  const [runningCheck, setRunningCheck] = useState(false);
  const [refreshingStatus, setRefreshingStatus] = useState(false);

  const [eventFilter, setEventFilter] = useState<EventFilter>('all');
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const [lastTestResult, setLastTestResult] = useState<{
    delivered: boolean;
    deliveryMode: NotificationItem['deliveryMode'];
    providerName: string;
    providerMessageId: string;
    note: string;
    target: string;
  } | null>(null);

  const [lastRunSummary, setLastRunSummary] = useState<{
    missedCount: number;
    upcomingCount: number;
    apptCount: number;
    deliveredEmails: number;
    simulatedEmails: number;
    checkedAt: string;
  } | null>(null);

  useEffect(() => {
    if (userPrivate?.email) {
      setTestEmail(userPrivate.email);
    }
  }, [userPrivate?.uid, userPrivate?.email]);

  const optedInMemberEmails = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    const add = (raw?: string) => {
      const clean = (raw || '').trim();
      if (!clean || !clean.includes('@')) return;
      const key = clean.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      list.push(clean);
    };

    for (const m of members) {
      if (m.uid === userPrivate?.uid) {
        if (userPrivate?.emailAlertsEnabled === false) continue;
        add(userPrivate?.email || m.notifyEmail);
        continue;
      }
      if (m.emailOptIn === false) continue;
      add(m.notifyEmail);
    }
    if (userPrivate?.emailAlertsEnabled !== false) {
      add(userPrivate?.email);
    }
    return list;
  }, [members, userPrivate?.uid, userPrivate?.emailAlertsEnabled, userPrivate?.email]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (unreadOnly && n.read) return false;
      if (deliveryFilter !== 'all' && n.deliveryMode !== deliveryFilter) return false;
      if (eventFilter === 'appointment') {
        return n.eventType === 'appointment_reminder' || n.eventType === 'appointment_change';
      }
      if (eventFilter !== 'all' && n.eventType !== eventFilter) return false;
      return true;
    });
  }, [notifications, unreadOnly, deliveryFilter, eventFilter]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const handleTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingTest(true);
    try {
      const result = await sendTestNotification(testEmail);
      setLastTestResult({ ...result, target: testEmail.trim() });
    } catch (err) {
      notifyToast('error', err instanceof Error ? err.message : 'Test notification failed.');
    } finally {
      setSendingTest(false);
    }
  };

  const handleRunReminderCheck = async () => {
    setRunningCheck(true);
    try {
      const summary = await runReminderCheck();
      setLastRunSummary({ ...summary, checkedAt: new Date().toLocaleTimeString() });
    } catch (err) {
      notifyToast('error', err instanceof Error ? err.message : 'Reminder check failed.');
    } finally {
      setRunningCheck(false);
    }
  };

  const handleRefreshStatus = async () => {
    setRefreshingStatus(true);
    try {
      await refreshEmailStatus();
    } finally {
      setRefreshingStatus(false);
    }
  };

  const fullyConfigured = emailProviderStatus.configured && emailProviderStatus.schedulerConfigured;
  const providerDisplay =
    emailProviderStatus.provider === 'resend'
      ? 'Resend API'
      : emailProviderStatus.provider === 'sendgrid'
      ? 'SendGrid API'
      : emailProviderStatus.provider === 'webhook'
      ? 'Custom Email Webhook'
      : 'Simulated Mode (Unconfigured)';

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
            Smart Reminders &amp; Notifications
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Manage medication reminders, missed-dose escalations, appointment alerts, caregiver updates, and server email delivery.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={refreshingStatus}
            onClick={() => void handleRefreshStatus()}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${refreshingStatus ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh Status
          </button>

          <button
            type="button"
            disabled={runningCheck}
            onClick={() => void handleRunReminderCheck()}
            className="hc-primary-btn inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            {runningCheck ? 'Processing Reminders...' : 'Run Reminder Check'}
          </button>
        </div>
      </div>

      {/* Email Provider & Scheduler Readiness Banner */}
      <section
        className={`hc-surface rounded-2xl border p-5 ${
          fullyConfigured
            ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30'
            : 'border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30'
        }`}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            {fullyConfigured ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
            )}
            <div className="space-y-1.5">
              <h2 className="font-semibold text-slate-900 dark:text-white">
                {emailProviderStatus.configured
                  ? `Live Email Adapter Connected (${providerDisplay})`
                  : 'Simulated Notification Mode Active — Setup Required for Real Emails'}
              </h2>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-700 dark:text-slate-300">
                <span>Provider: <strong className="font-mono">{providerDisplay}</strong></span>
                <span aria-hidden="true">·</span>
                <span>Sender: <strong className="font-mono">{emailProviderStatus.fromEmail}</strong></span>
                <span aria-hidden="true">·</span>
                <span>
                  Scheduled Cron:{' '}
                  <strong className="font-mono">
                    {emailProviderStatus.schedulerConfigured
                      ? 'CRON_SECRET Configured'
                      : 'CRON_SECRET Missing (Manual Check Active)'}
                  </strong>
                </span>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {emailProviderStatus.configured
                  ? 'Notifications are marked as Confirmed Email only after the configured server-side email provider confirms delivery. All API keys remain strictly on the backend.'
                  : 'No external email credentials are configured in server environment secrets. Notifications are recorded honestly as Simulated Mode in the history log below and are never falsely claimed as sent.'}
              </p>
            </div>
          </div>

          <div className="shrink-0 rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300">
            <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
              <CalendarClock className="h-3.5 w-3.5 text-sky-700 dark:text-sky-400" aria-hidden="true" />
              Scheduled Execution Endpoint
            </div>
            <p className="mt-1 font-mono">POST {emailProviderStatus.cronEndpoint}</p>
            <p className="mt-0.5 text-slate-500 dark:text-slate-400">
              Header: <code className="font-mono">{emailProviderStatus.cronHeader}: &lt;CRON_SECRET&gt;</code>
            </p>
          </div>
        </div>

        {emailProviderStatus.missingRequirements.length > 0 && (
          <div className="mt-4 border-t border-amber-200/80 pt-3 dark:border-amber-900/70">
            <p className="text-xs font-semibold text-slate-900 dark:text-white">
              Setup Requirements (Configure in Server Environment Variables):
            </p>
            <ul className="mt-1.5 space-y-1 text-xs text-slate-700 dark:text-slate-300">
              {emailProviderStatus.missingRequirements.map((req, idx) => (
                <li key={idx} className="font-mono">
                  {idx + 1}. {req}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {lastRunSummary && (
        <section className="hc-surface rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-slate-700 dark:text-slate-300">
              <ShieldCheck className="h-4 w-4 text-sky-700 dark:text-sky-400" aria-hidden="true" />
              <span className="font-semibold text-slate-900 dark:text-white">Latest Reminder Sweep</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{lastRunSummary.checkedAt}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{lastRunSummary.missedCount} missed (post-grace)</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{lastRunSummary.upcomingCount} upcoming doses</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{lastRunSummary.apptCount} appointments</span>
            </div>
            <span className="font-mono text-xs text-slate-600 tabular-nums dark:text-slate-400">
              {lastRunSummary.deliveredEmails > 0
                ? `${lastRunSummary.deliveredEmails} confirmed email(s)`
                : `${lastRunSummary.simulatedEmails} simulated`}
            </span>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Preferences & Test Email */}
        <div className="space-y-6 lg:col-span-5">
          <section className="hc-surface rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Notification Preferences &amp; Routing
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Choose which clinical &amp; caregiver events trigger notifications and opt into CareCircle email delivery.
            </p>
            <div className="mt-4 space-y-3 text-sm">
              {[
                { key: 'notifyUpcomingDose', label: 'Upcoming medication reminders (45m window)' },
                { key: 'notifyMissedDose', label: 'Missed dose alerts (after grace period)' },
                { key: 'notifyAppointment', label: 'Upcoming doctor appointments (24h window)' },
                { key: 'notifyCaregiverUpdates', label: 'Important caregiver alerts & dose updates' },
                { key: 'emailAlertsEnabled', label: 'Receive CareCircle email alerts' },
              ].map((pref) => {
                const checked = Boolean(userPrivate?.[pref.key as keyof typeof userPrivate]);
                return (
                  <label key={pref.key} className="flex cursor-pointer items-center justify-between gap-3 py-1">
                    <span className="text-slate-700 dark:text-slate-300">{pref.label}</span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        void updateNotificationPrefs({ [pref.key]: e.target.checked })
                      }
                      className="h-4 w-4 accent-sky-700"
                    />
                  </label>
                );
              })}
            </div>

            <div className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
              <div className="font-semibold text-slate-800 dark:text-slate-200">
                Opted-In Circle Recipients ({optedInMemberEmails.length})
              </div>
              <p className="mt-1 font-mono break-all">
                {optedInMemberEmails.length > 0
                  ? optedInMemberEmails.join(', ')
                  : 'No members currently opted into email alerts (logging In-App only).'}
              </p>
            </div>
          </section>

          <section className="hc-surface rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Send Test Email
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Verify server email provider credentials or confirm fallback simulation behavior.
            </p>
            <form onSubmit={handleTestEmail} className="mt-3 space-y-3">
              <input
                type="email"
                required
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="recipient@example.com"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              <button
                type="submit"
                disabled={sendingTest}
                className="hc-primary-btn inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                {sendingTest ? 'Dispatching...' : 'Send Test Email'}
              </button>
            </form>

            {lastTestResult && (
              <div
                className={`mt-4 rounded-xl border p-3 text-xs ${
                  lastTestResult.delivered
                    ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'
                    : 'border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200'
                }`}
              >
                <div className="font-semibold">
                  {lastTestResult.delivered
                    ? `Confirmed Sent via ${lastTestResult.providerName.toUpperCase()}`
                    : 'Simulated Mode — Not Sent Externally'}
                </div>
                <p className="mt-1">{lastTestResult.note}</p>
                {lastTestResult.providerMessageId && (
                  <p className="mt-1 font-mono">Confirmation Ref: {lastTestResult.providerMessageId}</p>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Filterable Notification History Log */}
        <section className="hc-surface rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-sky-700 dark:text-sky-400" aria-hidden="true" />
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Notification History (<span className="font-mono tabular-nums">{filteredNotifications.length}</span>)
              </h2>
              {unreadCount > 0 && (
                <span className="font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
                  · {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllNotificationsRead()}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                Mark All Read
              </button>
            )}
          </div>

          {/* Interactive Filters */}
          <div className="mt-4 space-y-2.5 border-b border-slate-100 pb-4 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by notification category">
              {(
                [
                  { id: 'all', label: 'All Types' },
                  { id: 'upcoming_dose', label: 'Upcoming Dose' },
                  { id: 'missed_dose', label: 'Missed Dose' },
                  { id: 'appointment', label: 'Appointments' },
                  { id: 'caregiver_update', label: 'Caregiver Alerts' },
                  { id: 'test_email', label: 'Test Emails' },
                ] as Array<{ id: EventFilter; label: string }>
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setEventFilter(tab.id)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    eventFilter === tab.id
                      ? 'bg-sky-700 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by delivery mode">
                {(
                  [
                    { id: 'all', label: 'All Delivery' },
                    { id: 'real_email', label: 'Confirmed Email' },
                    { id: 'simulated_demo', label: 'Simulated Mode' },
                    { id: 'in_app', label: 'In-App' },
                  ] as Array<{ id: DeliveryFilter; label: string }>
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setDeliveryFilter(tab.id)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      deliveryFilter === tab.id
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                        : 'border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={unreadOnly}
                  onChange={(e) => setUnreadOnly(e.target.checked)}
                  className="h-3.5 w-3.5 accent-sky-700"
                />
                Unread only
              </label>
            </div>
          </div>

          <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
            {filteredNotifications.map((n) => (
              <div key={n.id} className="flex items-start justify-between gap-4 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                      {formatEventLabel(n.eventType)}
                    </span>
                    <span className="text-slate-400" aria-hidden="true">·</span>
                    <span
                      className={`font-mono font-semibold ${
                        n.deliveryMode === 'real_email'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : n.deliveryMode === 'simulated_demo'
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-sky-700 dark:text-sky-400'
                      }`}
                    >
                      {n.deliveryMode === 'real_email'
                        ? `CONFIRMED EMAIL (${(n.providerName || 'EMAIL').toUpperCase()})`
                        : n.deliveryMode === 'simulated_demo'
                        ? 'SIMULATED MODE (NOT SENT)'
                        : 'IN-APP ALERT'}
                    </span>
                    {n.providerMessageId && (
                      <>
                        <span className="text-slate-400" aria-hidden="true">·</span>
                        <span className="font-mono text-slate-500 dark:text-slate-400">
                          Ref: {n.providerMessageId}
                        </span>
                      </>
                    )}
                    <span className="text-slate-400" aria-hidden="true">·</span>
                    <span className="font-mono text-slate-500 tabular-nums dark:text-slate-400">
                      {formatTimestamp(n.createdAt)}
                    </span>
                  </div>
                  <h3 className="mt-1 font-semibold text-slate-900 dark:text-white">{n.title}</h3>
                  <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{n.message}</p>
                  {n.emailTarget && (
                    <p className="mt-1 font-mono text-xs text-slate-500 break-all dark:text-slate-400">
                      Target: {n.emailTarget}
                    </p>
                  )}
                </div>

                {!n.read && (
                  <button
                    type="button"
                    onClick={() => void markNotificationRead(n.id)}
                    className="inline-flex min-h-[36px] sm:min-h-0 shrink-0 items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 whitespace-nowrap"
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    Read
                  </button>
                )}
              </div>
            ))}

            {filteredNotifications.length === 0 && (
              <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                <Clock className="mx-auto mb-2 h-6 w-6 text-slate-400" aria-hidden="true" />
                {notifications.length === 0 ? (
                  <p>
                    No notifications recorded yet. Click &ldquo;Run Reminder Check&rdquo; or &ldquo;Send Test Email&rdquo;.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p>No notifications match the active filter selection.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setEventFilter('all');
                        setDeliveryFilter('all');
                        setUnreadOnly(false);
                      }}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Reset Filters
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
