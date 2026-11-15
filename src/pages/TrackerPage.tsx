import React, { useMemo, useState } from 'react';
import { Check, Clock, History, SkipForward, Volume2, XCircle } from 'lucide-react';
import { useCareCircle } from '../context/CareCircleContext';
import {
  computeScheduleForDate,
  formatTimeDisplay,
  formatTimestamp,
  getTimestampMs,
  getTodayDateKey,
  speakText,
} from '../lib/scheduleUtils';
import type { DoseStatus } from '../types/carecircle';

export const TrackerPage: React.FC = () => {
  const { medications, medicationLogs, permissions, language, recordDose, revertDoseLog } =
    useCareCircle();

  const [selectedDate, setSelectedDate] = useState(getTodayDateKey());
  const [statusFilter, setStatusFilter] = useState<'all' | DoseStatus>('all');
  const [noteInput, setNoteInput] = useState('');
  const [activeNoteSlot, setActiveNoteSlot] = useState<string | null>(null);

  const daySlots = useMemo(
    () => computeScheduleForDate(medications, medicationLogs, selectedDate),
    [medications, medicationLogs, selectedDate]
  );

  const filteredSlots = useMemo(() => {
    if (statusFilter === 'all') return daySlots;
    return daySlots.filter((s) => s.status === statusFilter);
  }, [daySlots, statusFilter]);

  const sortedHistory = useMemo(
    () =>
      [...medicationLogs].sort(
        (a, b) => getTimestampMs(b.recordedAt) - getTimestampMs(a.recordedAt)
      ),
    [medicationLogs]
  );

  const handleSpeakDay = () => {
    const pending = daySlots.filter((s) => s.status === 'pending');
    if (pending.length === 0) {
      speakText(`All doses for ${selectedDate} have been handled.`, language);
    } else {
      const list = pending
        .map((p) => `${p.medication.name} at ${formatTimeDisplay(p.scheduledTime)}`)
        .join(', ');
      speakText(`Pending doses for ${selectedDate}: ${list}.`, language);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
            Daily Medication Tracker
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Log doses as Taken, Missed (only after grace period), or Skipped with actor &amp; time verification.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            aria-label="Select tracker date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-mono dark:border-slate-700 dark:bg-slate-900"
          />
          <button
            type="button"
            onClick={handleSpeakDay}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <Volume2 className="h-4 w-4" aria-hidden="true" />
            Read Pending
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-200/70 p-1 dark:bg-slate-900">
        {(['all', 'pending', 'taken', 'missed', 'skipped'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setStatusFilter(f)}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold capitalize transition-colors ${
              statusFilter === f
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Daily Dose Cards */}
      <section className="space-y-3">
        {filteredSlots.length === 0 ? (
          <div className="hc-surface rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            No scheduled doses match this date and filter.
          </div>
        ) : (
          filteredSlots.map((slot) => {
            const slotKey = `${slot.medication.id}_${slot.scheduledTime}`;
            return (
              <div
                key={slotKey}
                className="hc-surface rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-base font-bold text-sky-700 dark:text-sky-400 tabular-nums">
                        {formatTimeDisplay(slot.scheduledTime)}
                      </span>
                      <span className="text-slate-400" aria-hidden="true">·</span>
                      <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                        {slot.medication.name}
                      </h2>
                      <span className="text-sm text-slate-600 dark:text-slate-300">
                        {slot.medication.dosage}
                      </span>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span
                        className={`font-semibold uppercase ${
                          slot.status === 'taken'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : slot.status === 'missed'
                            ? 'text-rose-700 dark:text-rose-400'
                            : slot.status === 'skipped'
                            ? 'text-slate-600 dark:text-slate-300'
                            : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {slot.status}
                      </span>
                      <span aria-hidden="true">·</span>
                      {slot.log ? (
                        <span>
                          Recorded by {slot.log.recordedByName} ({slot.log.recordedByRole}) at{' '}
                          {formatTimestamp(slot.log.recordedAt)}
                          {slot.log.notes ? ` — "${slot.log.notes}"` : ''}
                        </span>
                      ) : (
                        <span>
                          Grace period: {slot.medication.gracePeriodMinutes} mins{' '}
                          {slot.isPastGrace ? '(Grace expired)' : '(Within schedule window)'}
                        </span>
                      )}
                    </div>
                  </div>

                  {permissions.canLogDoses && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          void recordDose({
                            medication: slot.medication,
                            dateKey: selectedDate,
                            scheduledTime: slot.scheduledTime,
                            status: 'taken',
                            notes: activeNoteSlot === slotKey ? noteInput : '',
                          })
                        }
                        className="hc-primary-btn inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
                      >
                        <Check className="h-4 w-4" aria-hidden="true" />
                        Taken
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void recordDose({
                            medication: slot.medication,
                            dateKey: selectedDate,
                            scheduledTime: slot.scheduledTime,
                            status: 'skipped',
                            notes: activeNoteSlot === slotKey ? noteInput : '',
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
                      >
                        <SkipForward className="h-4 w-4" aria-hidden="true" />
                        Skipped
                      </button>
                      {slot.isPastGrace && (
                        <button
                          type="button"
                          onClick={() =>
                            void recordDose({
                              medication: slot.medication,
                              dateKey: selectedDate,
                              scheduledTime: slot.scheduledTime,
                              status: 'missed',
                              notes: activeNoteSlot === slotKey ? noteInput : '',
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 px-3.5 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400"
                        >
                          <XCircle className="h-4 w-4" aria-hidden="true" />
                          Missed
                        </button>
                      )}
                      {slot.log && (
                        <button
                          type="button"
                          onClick={() =>
                            void revertDoseLog(slot.medication.id, selectedDate, slot.scheduledTime)
                          }
                          className="rounded-xl border border-slate-300 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          Undo
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveNoteSlot(activeNoteSlot === slotKey ? null : slotKey);
                          setNoteInput('');
                        }}
                        className="rounded-xl px-2.5 py-2 text-xs font-medium text-sky-700 hover:underline dark:text-sky-400"
                      >
                        {activeNoteSlot === slotKey ? 'Hide Note' : '+ Note'}
                      </button>
                    </div>
                  )}
                </div>

                {activeNoteSlot === slotKey && (
                  <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <input
                      type="text"
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      placeholder="Optional note (e.g., taken after lunch)..."
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>

      {/* Complete Historical Audit Table */}
      <section className="hc-surface rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-sky-700 dark:text-sky-400" aria-hidden="true" />
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            Medication Administration History
          </h2>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="py-2.5 pr-4">Date &amp; Slot</th>
                <th className="py-2.5 pr-4">Medicine</th>
                <th className="py-2.5 pr-4">Status</th>
                <th className="py-2.5 pr-4">Recorded By</th>
                <th className="py-2.5">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sortedHistory.slice(0, 25).map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 pr-4 font-mono text-xs tabular-nums whitespace-nowrap">
                    {log.dateKey} · {formatTimeDisplay(log.scheduledTime)}
                  </td>
                  <td className="py-2.5 pr-4 font-medium text-slate-900 dark:text-white">
                    {log.medicationName} <span className="text-slate-500">{log.dosage}</span>
                  </td>
                  <td className="py-2.5 pr-4 capitalize font-semibold">
                    <span
                      className={
                        log.status === 'taken'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : log.status === 'missed'
                          ? 'text-rose-700 dark:text-rose-400'
                          : 'text-slate-500'
                      }
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-xs text-slate-600 dark:text-slate-300">
                    {log.recordedByName} ({log.recordedByRole}) · {formatTimestamp(log.recordedAt)}
                  </td>
                  <td className="py-2.5 text-xs text-slate-500 dark:text-slate-400">
                    {log.notes || '—'}
                  </td>
                </tr>
              ))}
              {sortedHistory.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500">
                    <Clock className="mx-auto mb-2 h-5 w-5 text-slate-400" aria-hidden="true" />
                    No dose records logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
