import React, { useMemo, useState } from 'react';
import { Activity, Info, Lightbulb, Search } from 'lucide-react';
import { useCareCircle } from '../context/CareCircleContext';
import {
  computeWeeklyAdherence,
  formatTimestamp,
  generateSmartInsights,
  matchesAuditCategory,
  type AuditCategoryFilter,
} from '../lib/scheduleUtils';

type AuditRoleFilter = 'all' | 'elderly' | 'family' | 'caregiver' | 'system';

export const AnalyticsPage: React.FC = () => {
  const { medications, medicationLogs, appointments, activityLogs } = useCareCircle();
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(null);
  const [roleFilter, setRoleFilter] = useState<AuditRoleFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<AuditCategoryFilter>('all');
  const [auditSearch, setAuditSearch] = useState('');

  const weekly = useMemo(
    () => computeWeeklyAdherence(medications, medicationLogs),
    [medications, medicationLogs]
  );

  const insights = useMemo(
    () => generateSmartInsights(medications, medicationLogs, appointments),
    [medications, medicationLogs, appointments]
  );

  const maxDayTotal = useMemo(
    () => Math.max(1, ...weekly.days.map((d) => d.taken + d.missed + d.skipped)),
    [weekly.days]
  );

  const filteredActivityLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return activityLogs.filter((act) => {
      if (roleFilter !== 'all' && act.actorRole !== roleFilter) return false;
      if (!matchesAuditCategory(act, categoryFilter)) return false;
      if (q) {
        const hay = `${act.actorName} ${act.actorRole} ${act.action} ${act.targetName} ${act.details}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [activityLogs, roleFilter, categoryFilter, auditSearch]);

  const activeDay = selectedDayIdx !== null ? weekly.days[selectedDayIdx] : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
          Reports, Adherence &amp; Activity Timeline
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Transparent adherence calculation across eligible scheduled doses, weekly charts, informational care insights, and audit logs.
        </p>
      </div>

      {/* Summary KPIs */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="hc-surface rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">7-Day Adherence Rate</p>
          <p className="mt-2 font-mono text-3xl font-bold text-sky-700 dark:text-sky-400 tabular-nums">
            {weekly.ratePercent}%
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {weekly.taken} taken / {weekly.eligibleTotal} eligible
          </p>
        </div>
        <div className="hc-surface rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Taken Doses (7d)</p>
          <p className="mt-2 font-mono text-3xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {weekly.taken}
          </p>
        </div>
        <div className="hc-surface rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Missed Doses (7d)</p>
          <p className="mt-2 font-mono text-3xl font-bold text-rose-700 dark:text-rose-400 tabular-nums">
            {weekly.missed}
          </p>
        </div>
        <div className="hc-surface rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Skipped Doses (7d)</p>
          <p className="mt-2 font-mono text-3xl font-bold text-slate-700 dark:text-slate-300 tabular-nums">
            {weekly.skipped}
          </p>
        </div>
      </section>

      {/* Weekly Adherence Bar Chart (SVG + Accessible Breakdown) */}
      <section className="hc-surface rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Weekly Medication Adherence Chart
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select any day bar to inspect exact counts. Future doses still within their grace window are excluded from missed calculations.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <span className="text-emerald-700 dark:text-emerald-400">■ Taken</span>
            <span className="text-rose-700 dark:text-rose-400">■ Missed</span>
            <span className="text-slate-500 dark:text-slate-400">■ Skipped</span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-7 items-end gap-1 sm:gap-3 h-48 pt-4">
          {weekly.days.map((day, idx) => {
            const total = day.taken + day.missed + day.skipped;
            const takenH = (day.taken / maxDayTotal) * 140;
            const missedH = (day.missed / maxDayTotal) * 140;
            const skippedH = (day.skipped / maxDayTotal) * 140;
            const isSelected = selectedDayIdx === idx;

            return (
              <button
                key={day.dateKey}
                type="button"
                onClick={() => setSelectedDayIdx(isSelected ? null : idx)}
                className={`flex flex-col items-center justify-end gap-2 rounded-xl p-1 sm:p-2 transition-colors ${
                  isSelected
                    ? 'bg-sky-50 ring-2 ring-sky-600 dark:bg-sky-950/50'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex w-full max-w-[36px] flex-col-reverse overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                  {day.taken > 0 && (
                    <div
                      style={{ height: `${Math.max(8, takenH)}px` }}
                      className="w-full bg-emerald-600 dark:bg-emerald-500"
                      title={`Taken: ${day.taken}`}
                    />
                  )}
                  {day.skipped > 0 && (
                    <div
                      style={{ height: `${Math.max(6, skippedH)}px` }}
                      className="w-full bg-slate-400 dark:bg-slate-500"
                      title={`Skipped: ${day.skipped}`}
                    />
                  )}
                  {day.missed > 0 && (
                    <div
                      style={{ height: `${Math.max(8, missedH)}px` }}
                      className="w-full bg-rose-600 dark:bg-rose-500"
                      title={`Missed: ${day.missed}`}
                    />
                  )}
                  {total === 0 && <div className="h-2 w-full bg-slate-200 dark:bg-slate-700" />}
                </div>
                <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {day.label}
                </span>
              </button>
            );
          })}
        </div>

        {activeDay && (
          <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-slate-200 pt-4 text-sm dark:border-slate-800">
            <span className="font-mono font-semibold">{activeDay.dateKey}</span>
            <span className="text-emerald-700 dark:text-emerald-400">Taken: {activeDay.taken}</span>
            <span className="text-rose-700 dark:text-rose-400">Missed: {activeDay.missed}</span>
            <span className="text-slate-600 dark:text-slate-400">Skipped: {activeDay.skipped}</span>
            <span className="text-amber-700 dark:text-amber-400">Pending: {activeDay.pending}</span>
          </div>
        )}
      </section>

      {/* Smart Care Insights */}
      <section className="hc-surface rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            Smart Care Insights
          </h2>
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
          Informational summaries derived solely from recorded CareCircle logs (not clinical predictions).
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {insights.map((ins) => (
            <div
              key={ins.id}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
            >
              <p
                className={`text-xs font-semibold uppercase ${
                  ins.severity === 'attention'
                    ? 'text-amber-700 dark:text-amber-400'
                    : ins.severity === 'positive'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-sky-700 dark:text-sky-400'
                }`}
              >
                {ins.severity}
              </p>
              <h3 className="mt-1 font-semibold text-slate-900 dark:text-white">{ins.title}</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{ins.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Filterable CareCircle Activity & Audit Timeline */}
      <section className="hc-surface rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-sky-700 dark:text-sky-400" aria-hidden="true" />
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              CareCircle Activity &amp; Audit Timeline ({filteredActivityLogs.length})
            </h2>
          </div>
          {(roleFilter !== 'all' || categoryFilter !== 'all' || auditSearch.trim()) && (
            <button
              type="button"
              onClick={() => {
                setRoleFilter('all');
                setCategoryFilter('all');
                setAuditSearch('');
              }}
              className="text-xs font-semibold text-sky-700 hover:underline dark:text-sky-400 self-start sm:self-auto"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Audit Filter Controls */}
        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter audit logs by role">
            {(
              [
                { key: 'all', label: 'All Roles' },
                { key: 'elderly', label: 'Elderly' },
                { key: 'family', label: 'Family' },
                { key: 'caregiver', label: 'Caregiver' },
                { key: 'system', label: 'System' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={roleFilter === tab.key}
                onClick={() => setRoleFilter(tab.key)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  roleFilter === tab.key
                    ? 'border-sky-600 bg-sky-50 text-sky-800 dark:border-sky-500 dark:bg-sky-950/50 dark:text-sky-300'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              aria-label="Filter audit logs by action category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as AuditCategoryFilter)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="all">All Categories</option>
              <option value="medications">Medications &amp; Doses</option>
              <option value="collaboration">Invitations &amp; Members</option>
              <option value="appointments">Appointments</option>
              <option value="tasks">Care Tasks &amp; Alerts</option>
            </select>

            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Search actor, medicine, action..."
                className="w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950 sm:w-56"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
          {filteredActivityLogs.map((act) => (
            <div
              key={act.id}
              className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center"
            >
              <div>
                <p className="text-sm text-slate-900 dark:text-white">
                  <span className="font-semibold">{act.actorName}</span>{' '}
                  <span className="text-xs capitalize text-slate-500">({act.actorRole})</span> ·{' '}
                  <span className="font-medium text-sky-800 dark:text-sky-300">{act.action}</span> —{' '}
                  <span className="font-semibold">{act.targetName}</span>
                </p>
                {act.details && (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{act.details}</p>
                )}
              </div>
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                {formatTimestamp(act.createdAt)}
              </span>
            </div>
          ))}
          {filteredActivityLogs.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-500">
              {activityLogs.length === 0
                ? 'No activity recorded yet.'
                : 'No activity entries match the selected filters.'}
            </p>
          )}
        </div>
      </section>
    </div>
  );
};
