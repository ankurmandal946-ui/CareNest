import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  List,
  MapPin,
  Plus,
  X,
  XCircle,
} from 'lucide-react';
import { useCareCircle } from '../context/CareCircleContext';
import { toLocalDateTimeInputValue } from '../lib/scheduleUtils';
import type { Appointment } from '../types/carecircle';

export const AppointmentsPage: React.FC = () => {
  const { appointments, permissions, saveAppointment, updateAppointmentStatus, notifyToast } =
    useCareCircle();

  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'completed' | 'cancelled'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Calendar state
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  // Form state
  const [doctorName, setDoctorName] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!modalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalOpen]);

  const openAdd = (prefillDate?: string) => {
    setEditingAppt(null);
    setDoctorName('');
    setSpecialization('');
    setClinicName('');
    setDateTime(prefillDate ? `${prefillDate}T10:00` : toLocalDateTimeInputValue(new Date(Date.now() + 86400000)));
    setNotes('');
    setModalOpen(true);
  };

  const openEdit = (appt: Appointment) => {
    setEditingAppt(appt);
    setDoctorName(appt.doctorName);
    setSpecialization(appt.specialization || '');
    setClinicName(appt.clinicName);
    setDateTime(appt.dateTime.slice(0, 16));
    setNotes(appt.notes || '');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorName.trim() || !clinicName.trim() || !dateTime) {
      notifyToast('error', 'Doctor name, clinic/hospital, and date/time are required.');
      return;
    }
    setSubmitting(true);
    try {
      await saveAppointment(
        {
          doctorName: doctorName.trim(),
          specialization: specialization.trim(),
          clinicName: clinicName.trim(),
          dateTime,
          notes: notes.trim(),
          status: editingAppt?.status || 'upcoming',
        },
        editingAppt?.id
      );
      setModalOpen(false);
    } catch (err) {
      notifyToast('error', err instanceof Error ? err.message : 'Could not save appointment.');
    } finally {
      setSubmitting(false);
    }
  };

  const sortedAppointments = useMemo(() => {
    return appointments
      .filter((a) => statusFilter === 'all' || a.status === statusFilter)
      .sort((a, b) => a.dateTime.localeCompare(b.dateTime));
  }, [appointments, statusFilter]);

  // Build calendar grid days
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: Array<{ day: number | null; dateKey: string | null }> = [];
    for (let i = 0; i < firstWeekday; i++) {
      cells.push({ day: null, dateKey: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, dateKey: key });
    }
    return cells;
  }, [calendarMonth]);

  const apptsByDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const appt of sortedAppointments) {
      const key = appt.dateTime.slice(0, 10);
      const arr = map.get(key) || [];
      arr.push(appt);
      map.set(key, arr);
    }
    return map;
  }, [sortedAppointments]);

  const displayedForSelectedDay = selectedDayKey ? apptsByDay.get(selectedDayKey) || [] : sortedAppointments;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
            Doctor Appointments
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Track upcoming consultations, clinic locations, and previous visit notes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg bg-slate-200/70 p-1 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => {
                setViewMode('calendar');
                setSelectedDayKey(null);
              }}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold ${
                viewMode === 'calendar'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <CalendarIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Calendar
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('list');
                setSelectedDayKey(null);
              }}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <List className="h-3.5 w-3.5" aria-hidden="true" />
              List
            </button>
          </div>

          {permissions.canManageAppointments && (
            <button
              type="button"
              onClick={() => openAdd(selectedDayKey || undefined)}
              className="hc-primary-btn inline-flex items-center gap-2 rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Appointment
            </button>
          )}
        </div>
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <section className="hc-surface rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              {calendarMonth.toLocaleDateString([], { month: 'long', year: 'numeric' })}
            </h2>
            <div className="flex items-center gap-2">
              {selectedDayKey && (
                <button
                  type="button"
                  onClick={() => setSelectedDayKey(null)}
                  className="text-xs font-semibold text-sky-700 hover:underline dark:text-sky-400"
                >
                  Show All Dates
                </button>
              )}
              <button
                type="button"
                aria-label="Previous month"
                onClick={() =>
                  setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))
                }
                className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() =>
                  setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))
                }
                className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-1.5">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {calendarDays.map((cell, i) => {
              if (!cell.day || !cell.dateKey) {
                return <div key={i} className="min-h-[54px] rounded-xl bg-slate-50/40 dark:bg-slate-950/30 sm:h-20" />;
              }
              const dayAppts = apptsByDay.get(cell.dateKey) || [];
              const isSelected = selectedDayKey === cell.dateKey;
              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  aria-label={`${cell.dateKey}, ${dayAppts.length} appointment${dayAppts.length === 1 ? '' : 's'}`}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedDayKey(isSelected ? null : cell.dateKey)}
                  className={`flex min-h-[54px] flex-col items-start justify-between rounded-xl border p-1.5 text-left transition-colors sm:h-20 sm:p-2 ${
                    isSelected
                      ? 'border-sky-600 bg-sky-50 dark:border-sky-400 dark:bg-sky-950/50'
                      : 'border-slate-200 hover:border-sky-400 dark:border-slate-800'
                  }`}
                >
                  <span className="font-mono text-xs font-semibold tabular-nums">{cell.day}</span>
                  {dayAppts.length > 0 && (
                    <>
                      <span className="flex items-center gap-1 sm:hidden">
                        <span className="h-2 w-2 rounded-full bg-sky-700 dark:bg-sky-400" aria-hidden="true" />
                        <span className="font-mono text-[10px] font-bold text-sky-800 dark:text-sky-300 tabular-nums">
                          {dayAppts.length}
                        </span>
                      </span>
                      <span className="hidden w-full truncate rounded bg-sky-700 px-1.5 py-0.5 text-[11px] font-medium text-white sm:block">
                        {dayAppts[0].doctorName}
                        {dayAppts.length > 1 ? ` +${dayAppts.length - 1}` : ''}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* List Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl bg-slate-200/70 p-1 dark:bg-slate-900">
          {(['all', 'upcoming', 'completed', 'cancelled'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${
                statusFilter === st
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
        {selectedDayKey && (
          <p className="text-sm font-medium text-sky-700 dark:text-sky-400">
            Showing appointments on {selectedDayKey}
          </p>
        )}
      </div>

      {/* Appointments List */}
      <div className="space-y-4">
        {displayedForSelectedDay.length === 0 ? (
          <div className="hc-surface rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            No appointments found for the selected view.
          </div>
        ) : (
          displayedForSelectedDay.map((appt) => (
            <article
              key={appt.id}
              className="hc-surface flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <span className="font-mono text-sky-700 dark:text-sky-400 tabular-nums">
                    {new Date(appt.dateTime).toLocaleString([], {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span className="text-slate-400" aria-hidden="true">·</span>
                  <span
                    className={`uppercase ${
                      appt.status === 'upcoming'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : appt.status === 'cancelled'
                        ? 'text-rose-700 dark:text-rose-400'
                        : 'text-slate-500'
                    }`}
                  >
                    {appt.status}
                  </span>
                </div>

                <h2 className="mt-1.5 font-display text-xl font-bold text-slate-900 dark:text-white">
                  {appt.doctorName}
                  {appt.specialization ? (
                    <span className="ml-2 text-base font-normal text-slate-500 dark:text-slate-400">
                      ({appt.specialization})
                    </span>
                  ) : null}
                </h2>

                <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                  <MapPin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  {appt.clinicName}
                </p>

                {appt.notes && (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{appt.notes}</p>
                )}
              </div>

              {permissions.canManageAppointments && appt.status !== 'cancelled' && (
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(appt)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                    Edit
                  </button>
                  {appt.status === 'upcoming' && (
                    <>
                      <button
                        type="button"
                        onClick={() => void updateAppointmentStatus(appt.id, 'completed')}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-400"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Complete
                      </button>
                      <button
                        type="button"
                        onClick={() => void updateAppointmentStatus(appt.id, 'cancelled')}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400"
                      >
                        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        Cancel Visit
                      </button>
                    </>
                  )}
                </div>
              )}
            </article>
          ))
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="appointment-modal-title"
        >
          <div className="hc-surface max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h2 id="appointment-modal-title" className="font-display text-xl font-bold">
                {editingAppt ? 'Edit Appointment' : 'Schedule Doctor Appointment'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close modal"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium">Doctor Name *</label>
                  <input
                    type="text"
                    required
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    placeholder="e.g., Dr. Kavita Rao"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Specialization</label>
                  <input
                    type="text"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    placeholder="e.g., Cardiology"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium">Hospital / Clinic Name *</label>
                <input
                  type="text"
                  required
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  placeholder="e.g., Mercy Senior Wellness Clinic"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Date &amp; Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={dateTime}
                  onChange={(e) => setDateTime(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Appointment Notes</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Questions for the doctor, fasting instructions, or lab reports to bring..."
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="hc-primary-btn rounded-xl bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
