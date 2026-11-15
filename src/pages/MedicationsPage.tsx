import React, { useEffect, useState } from 'react';
import { Archive, Edit3, Pill, Plus, ShieldAlert, Trash2, X } from 'lucide-react';
import { useCareCircle } from '../context/CareCircleContext';
import { formatTimeDisplay, getTodayDateKey } from '../lib/scheduleUtils';
import type { Medication, MedicationFrequency } from '../types/carecircle';

export const MedicationsPage: React.FC = () => {
  const { medications, permissions, saveMedication, archiveMedication, deleteMedication, notifyToast } =
    useCareCircle();

  const [showArchived, setShowArchived] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Medication | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState<MedicationFrequency>('once_daily');
  const [times, setTimes] = useState<string[]>(['08:00']);
  const [startDate, setStartDate] = useState(getTodayDateKey());
  const [endDate, setEndDate] = useState('');
  const [instructions, setInstructions] = useState('');
  const [prescribingDoctor, setPrescribingDoctor] = useState('');
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState('60');

  useEffect(() => {
    if (!modalOpen && !confirmDelete) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModalOpen(false);
        setConfirmDelete(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalOpen, confirmDelete]);

  const openAdd = () => {
    setEditingMed(null);
    setName('');
    setDosage('');
    setFrequency('once_daily');
    setTimes(['08:00']);
    setStartDate(getTodayDateKey());
    setEndDate('');
    setInstructions('');
    setPrescribingDoctor('');
    setGracePeriodMinutes('60');
    setModalOpen(true);
  };

  const openEdit = (med: Medication) => {
    setEditingMed(med);
    setName(med.name);
    setDosage(med.dosage);
    setFrequency(med.frequency);
    setTimes(med.times.length > 0 ? [...med.times] : ['08:00']);
    setStartDate(med.startDate);
    setEndDate(med.endDate || '');
    setInstructions(med.instructions || '');
    setPrescribingDoctor(med.prescribingDoctor || '');
    setGracePeriodMinutes(String(med.gracePeriodMinutes || 60));
    setModalOpen(true);
  };

  const handleFrequencyChange = (freq: MedicationFrequency) => {
    setFrequency(freq);
    if (freq === 'once_daily') setTimes(['08:00']);
    else if (freq === 'twice_daily') setTimes(['08:00', '20:00']);
    else if (freq === 'three_times_daily') setTimes(['08:00', '14:00', '20:00']);
    else if (freq === 'four_times_daily') setTimes(['08:00', '12:00', '16:00', '20:00']);
  };

  const handleTimeChange = (idx: number, val: string) => {
    setTimes((prev) => prev.map((t, i) => (i === idx ? val : t)));
  };

  const handleAddTimeSlot = () => {
    if (times.length >= 8) return;
    setTimes((prev) => [...prev, '12:00']);
  };

  const handleRemoveTimeSlot = (idx: number) => {
    if (times.length <= 1) return;
    setTimes((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !dosage.trim() || times.length === 0) {
      notifyToast('error', 'Medicine name, exact prescribed dosage, and at least one time are required.');
      return;
    }
    setSubmitting(true);
    try {
      await saveMedication(
        {
          name: name.trim(),
          dosage: dosage.trim(),
          frequency,
          times,
          startDate,
          endDate,
          instructions: instructions.trim(),
          prescribingDoctor: prescribingDoctor.trim(),
          gracePeriodMinutes: Math.min(Math.max(Number(gracePeriodMinutes) || 60, 5), 720),
          archived: editingMed?.archived ?? false,
        },
        editingMed?.id
      );
      setModalOpen(false);
    } catch (err) {
      notifyToast('error', err instanceof Error ? err.message : 'Could not save medication.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredMeds = medications.filter((m) => (showArchived ? m.archived : !m.archived));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
            Medication Management
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Store prescribed medicines, exact dosages, scheduled times, and grace periods.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg bg-slate-200/70 p-1 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setShowArchived(false)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                !showArchived
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Active ({medications.filter((m) => !m.archived).length})
            </button>
            <button
              type="button"
              onClick={() => setShowArchived(true)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                showArchived
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Archived ({medications.filter((m) => m.archived).length})
            </button>
          </div>

          {permissions.canEditMedications && (
            <button
              type="button"
              onClick={openAdd}
              className="hc-primary-btn inline-flex items-center gap-2 rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 transition-colors"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Medicine
            </button>
          )}
        </div>
      </div>

      {/* Clinical Integrity Notice */}
      <div className="hc-surface flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50/70 p-4 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-sky-700 dark:text-sky-400" aria-hidden="true" />
        <p>
          Always enter dosages exactly as written on the prescription label. CareCircle never recommends new medicines or alters prescribed dosages.
          {!permissions.canEditMedications &&
            ' Your current role has view-only access to medication definitions.'}
        </p>
      </div>

      {/* Medications Grid */}
      {filteredMeds.length === 0 ? (
        <div className="hc-surface rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
          <Pill className="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
          <h2 className="mt-3 font-display text-lg font-semibold text-slate-900 dark:text-white">
            {showArchived ? 'No archived medicines' : 'No active medicines yet'}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {showArchived
              ? 'Archived prescriptions will appear here.'
              : 'Add prescribed daily medicines to begin tracking schedules and reminders.'}
          </p>
          {!showArchived && permissions.canEditMedications && (
            <button
              type="button"
              onClick={openAdd}
              className="mt-4 rounded-xl bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-800"
            >
              Add First Medicine
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredMeds.map((med) => (
            <article
              key={med.id}
              className="hc-surface flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                      {med.name}
                    </h2>
                    <p className="mt-0.5 text-base font-medium text-sky-700 dark:text-sky-400">
                      {med.dosage}
                    </p>
                  </div>
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    Grace: {med.gracePeriodMinutes}m
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-700 dark:text-slate-300">
                  <span className="font-semibold">Schedule:</span>
                  <span className="font-mono tabular-nums">
                    {med.times.map(formatTimeDisplay).join(' · ')}
                  </span>
                </div>

                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Dates: {med.startDate} {med.endDate ? `to ${med.endDate}` : '(Ongoing)'}
                  {med.prescribingDoctor ? ` · Prescribed by ${med.prescribingDoctor}` : ''}
                </p>

                {med.instructions && (
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                    {med.instructions}
                  </p>
                )}
              </div>

              {permissions.canEditMedications && (
                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => openEdit(med)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void archiveMedication(med.id, !med.archived)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                    {med.archived ? 'Restore' : 'Archive'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(med)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/50"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Delete
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {/* Add / Edit Medicine Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="medication-modal-title"
        >
          <div className="hc-surface max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h2 id="medication-modal-title" className="font-display text-xl font-bold text-slate-900 dark:text-white">
                {editingMed ? `Edit ${editingMed.name}` : 'Add Prescribed Medicine'}
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
                  <label className="block text-sm font-medium">Medicine Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Metformin"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Exact Prescribed Dosage *</label>
                  <input
                    type="text"
                    required
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    placeholder="e.g., 500 mg (1 tablet)"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium">Frequency *</label>
                  <select
                    value={frequency}
                    onChange={(e) => handleFrequencyChange(e.target.value as MedicationFrequency)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="once_daily">Once Daily</option>
                    <option value="twice_daily">Twice Daily</option>
                    <option value="three_times_daily">Three Times Daily</option>
                    <option value="four_times_daily">Four Times Daily</option>
                    <option value="custom">Custom Times</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium">Grace Period (minutes)</label>
                  <input
                    type="number"
                    min={5}
                    max={720}
                    value={gracePeriodMinutes}
                    onChange={(e) => setGracePeriodMinutes(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium">Scheduled Times *</label>
                  <button
                    type="button"
                    onClick={handleAddTimeSlot}
                    className="text-xs font-semibold text-sky-700 hover:underline dark:text-sky-400"
                  >
                    + Add Time
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {times.map((t, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <input
                        type="time"
                        required
                        value={t}
                        onChange={(e) => handleTimeChange(idx, e.target.value)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-950"
                      />
                      {times.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTimeSlot(idx)}
                          aria-label="Remove time slot"
                          className="rounded-lg p-1.5 text-slate-500 hover:text-rose-600"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">End Date (Optional)</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium">Prescribing Doctor (Optional)</label>
                <input
                  type="text"
                  value={prescribingDoctor}
                  onChange={(e) => setPrescribingDoctor(e.target.value)}
                  placeholder="e.g., Dr. Kavita Rao"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Administration Instructions</label>
                <textarea
                  rows={2}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="e.g., Take after breakfast with warm water"
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
                  {submitting ? 'Saving...' : editingMed ? 'Save Changes' : 'Save Medicine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-med-title"
        >
          <div className="hc-surface max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 id="delete-med-title" className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Confirm Delete Medicine
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Are you sure you want to permanently delete <strong>{confirmDelete.name}</strong> ({confirmDelete.dosage})? If you want to keep past history, consider archiving instead.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await deleteMedication(confirmDelete.id);
                  setConfirmDelete(null);
                }}
                className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
