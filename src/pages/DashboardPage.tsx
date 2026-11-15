import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bell,
  BellRing,
  Bot,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  Clock,
  Copy,
  Edit3,
  MessageSquarePlus,
  PhoneCall,
  Pill,
  Plus,
  RotateCcw,
  SkipForward,
  Sparkles,
  Square,
  Stethoscope,
  Trash2,
  UserPlus,
  Users,
  Volume2,
  X,
  XCircle,
} from 'lucide-react';
import { useCareCircle } from '../context/CareCircleContext';
import { getGreeting, TRANSLATIONS } from '../lib/i18n';
import {
  computeScheduleForDate,
  computeWeeklyAdherence,
  formatDateKey,
  formatRelativeMinutes,
  formatTimeDisplay,
  formatTimestamp,
  speakText,
  toLocalDateTimeInputValue,
} from '../lib/scheduleUtils';
import { EmergencyModal } from '../components/EmergencyModal';
import type { Appointment, CareTask, MedicationFrequency, UserRole } from '../types/carecircle';

function formatAppointmentCountdown(dateTimeIso: string, nowMs: number): string {
  const targetMs = new Date(dateTimeIso).getTime();
  if (Number.isNaN(targetMs)) return '';
  const diffMins = Math.round((targetMs - nowMs) / 60000);
  if (diffMins <= 0) return 'Starting now / past';
  if (diffMins < 60) return `In ${diffMins}m`;
  const hours = Math.floor(diffMins / 60);
  if (hours < 24) return `In ${hours}h ${diffMins % 60}m`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `In ${days}d ${remHours}h` : `In ${days}d`;
}

export const DashboardPage: React.FC = () => {
  const {
    mode,
    currentPage,
    userAccount,
    activeCircle,
    members,
    medications,
    medicationLogs,
    appointments,
    careTasks,
    notifications,
    activityLogs,
    permissions,
    firestoreSynced,
    language,
    recordDose,
    revertDoseLog,
    loadSampleSchedule,
    saveMedication,
    saveAppointment,
    updateAppointmentStatus,
    setCurrentPage,
    addCareTask,
    toggleCareTask,
    deleteCareTask,
    markNotificationRead,
    markAllNotificationsRead,
    createInvitation,
    runReminderCheck,
    notifyToast,
  } = useCareCircle();

  const t = TRANSLATIONS[language];
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());
  const [showFullFamilyView, setShowFullFamilyView] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [runningCheck, setRunningCheck] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);

  // Dashboard interactive filters & inline dose notes
  const [scheduleFilter, setScheduleFilter] = useState<'all' | 'pending' | 'taken' | 'missed'>('all');
  const [taskFilter, setTaskFilter] = useState<'all' | 'open' | 'alerts'>('all');
  const [openNoteSlotKey, setOpenNoteSlotKey] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  // Caregiver Notify Family Modal
  const [caregiverAlertOpen, setCaregiverAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  // Quick Inline Task Composer
  const [taskTitle, setTaskTitle] = useState('');
  const [taskNotes, setTaskNotes] = useState('');
  const [taskCategory, setTaskCategory] = useState<CareTask['category']>('task');
  const [postingTask, setPostingTask] = useState(false);

  // Quick Add Medicine Modal
  const [quickMedOpen, setQuickMedOpen] = useState(false);
  const [medName, setMedName] = useState('');
  const [medDosage, setMedDosage] = useState('');
  const [medFrequency, setMedFrequency] = useState<MedicationFrequency>('once_daily');
  const [medTime, setMedTime] = useState('08:00');
  const [medInstructions, setMedInstructions] = useState('');
  const [savingMed, setSavingMed] = useState(false);

  // Quick Schedule / Edit Appointment Modal
  const [quickApptOpen, setQuickApptOpen] = useState(false);
  const [editingApptId, setEditingApptId] = useState<string | null>(null);
  const [apptDoctor, setApptDoctor] = useState('');
  const [apptSpec, setApptSpec] = useState('');
  const [apptClinic, setApptClinic] = useState('');
  const [apptDateTime, setApptDateTime] = useState(() =>
    toLocalDateTimeInputValue(new Date(Date.now() + 86400000))
  );
  const [apptNotes, setApptNotes] = useState('');
  const [savingAppt, setSavingAppt] = useState(false);

  // Quick Invite Modal (Owner or Organizer)
  const [quickInviteOpen, setQuickInviteOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<UserRole>('family');
  const [inviteRelation, setInviteRelation] = useState('Daughter');
  const [inviteCanLogDoses, setInviteCanLogDoses] = useState(true);
  const [inviteCanEditMeds, setInviteCanEditMeds] = useState(false);
  const [inviteCanManageAppts, setInviteCanManageAppts] = useState(true);
  const [inviteCanManageMembers, setInviteCanManageMembers] = useState(false);
  const [inviteExpiresHours, setInviteExpiresHours] = useState('48');
  const [generatedInvite, setGeneratedInvite] = useState<{ code: string; expiresAt: string } | null>(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);

  // Live 30-second clock ticker + tab visibility refresh
  useEffect(() => {
    const tick = () => setNowTimestamp(Date.now());
    const intervalId = window.setInterval(tick, 30_000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!caregiverAlertOpen && !quickMedOpen && !quickApptOpen && !quickInviteOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCaregiverAlertOpen(false);
        setQuickMedOpen(false);
        setQuickApptOpen(false);
        setEditingApptId(null);
        setQuickInviteOpen(false);
        setGeneratedInvite(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [caregiverAlertOpen, quickMedOpen, quickApptOpen, quickInviteOpen]);

  const nowDate = useMemo(() => new Date(nowTimestamp), [nowTimestamp]);
  const todayKey = useMemo(() => formatDateKey(nowDate), [nowDate]);
  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();

  const todaySlots = useMemo(
    () => computeScheduleForDate(medications, medicationLogs, todayKey, nowMinutes),
    [medications, medicationLogs, todayKey, nowMinutes]
  );

  const takenCount = todaySlots.filter((s) => s.status === 'taken').length;
  const skippedCount = todaySlots.filter((s) => s.status === 'skipped').length;
  const pendingSlots = todaySlots.filter((s) => s.status === 'pending');
  const missedSlots = todaySlots.filter((s) => s.status === 'missed');

  const nextDue = useMemo(() => {
    const withinGrace = pendingSlots.filter(
      (s) => s.minutesUntil >= -s.medication.gracePeriodMinutes
    );
    return withinGrace[0] || pendingSlots[0] || null;
  }, [pendingSlots]);

  const filteredTodaySlots = useMemo(() => {
    if (scheduleFilter === 'all') return todaySlots;
    return todaySlots.filter((s) => s.status === scheduleFilter);
  }, [todaySlots, scheduleFilter]);

  const filteredCareTasks = useMemo(() => {
    if (taskFilter === 'open') return careTasks.filter((task) => !task.completed);
    if (taskFilter === 'alerts') return careTasks.filter((task) => task.category === 'assistance_alert');
    return careTasks;
  }, [careTasks, taskFilter]);

  const weekly = useMemo(
    () => computeWeeklyAdherence(medications, medicationLogs, nowMinutes),
    [medications, medicationLogs, nowMinutes]
  );

  const upcomingAppointments = useMemo(
    () =>
      appointments
        .filter((a) => a.status === 'upcoming')
        .sort((a, b) => a.dateTime.localeCompare(b.dateTime)),
    [appointments]
  );

  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.read),
    [notifications]
  );

  // Automatic post-grace missed-dose evaluation while dashboard is open
  const autoCheckedSlotsRef = useRef<Set<string>>(new Set());
  const circleScopeKey = activeCircle?.id || 'demo';
  useEffect(() => {
    if (currentPage !== 'dashboard') return;
    if (!permissions.canLogDoses) return;
    if (mode === 'firebase' && !firestoreSynced) return;
    if (medications.length === 0) return;

    const unloggedPastGrace = todaySlots.filter((s) => s.isPastGrace && !s.log);
    if (unloggedPastGrace.length === 0) return;

    const newKeys = unloggedPastGrace
      .map((s) => `${circleScopeKey}_${todayKey}_${s.medication.id}_${s.scheduledTime}`)
      .filter((k) => !autoCheckedSlotsRef.current.has(k));

    if (newKeys.length === 0) return;
    for (const k of newKeys) {
      autoCheckedSlotsRef.current.add(k);
    }

    void runReminderCheck({ silent: true }).catch(() => {
      // Allow retry if transient failure occurs
      for (const k of newKeys) {
        autoCheckedSlotsRef.current.delete(k);
      }
    });
  }, [
    currentPage,
    permissions.canLogDoses,
    mode,
    firestoreSynced,
    medications.length,
    todaySlots,
    circleScopeKey,
    todayKey,
    runReminderCheck,
  ]);

  const handleReadRoutine = () => {
    const nextPart = nextDue
      ? `Your next medicine is ${nextDue.medication.name}, ${nextDue.medication.dosage}, scheduled at ${formatTimeDisplay(nextDue.scheduledTime)}.`
      : t.elderlyRoutine.noPending;
    const summary = `${getGreeting(language)}, ${activeCircle?.elderlyName || userAccount?.displayName || ''}. Today you have taken ${takenCount} of ${todaySlots.length} scheduled medicines. ${nextPart}`;
    speakText(summary, language);
  };

  const handleRunCheck = async () => {
    setRunningCheck(true);
    try {
      await runReminderCheck();
    } catch (err) {
      notifyToast('error', err instanceof Error ? err.message : 'Reminder check failed.');
    } finally {
      setRunningCheck(false);
    }
  };

  const handleLoadSample = async () => {
    setLoadingSample(true);
    try {
      await loadSampleSchedule();
    } catch (err) {
      notifyToast('error', err instanceof Error ? err.message : 'Failed to load sample schedule.');
    } finally {
      setLoadingSample(false);
    }
  };

  const handleSendCaregiverAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertMessage.trim()) return;
    try {
      await addCareTask({
        title: 'Caregiver requested family assistance',
        notes: alertMessage.trim(),
        category: 'assistance_alert',
        dueDate: todayKey,
      });
      setAlertMessage('');
      setCaregiverAlertOpen(false);
    } catch (err) {
      notifyToast('error', err instanceof Error ? err.message : 'Could not send family alert.');
    }
  };

  const handleAddDashboardTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    setPostingTask(true);
    try {
      await addCareTask({
        title: taskTitle.trim(),
        notes: taskNotes.trim(),
        category: taskCategory,
        dueDate: todayKey,
      });
      setTaskTitle('');
      setTaskNotes('');
    } catch (err) {
      notifyToast('error', err instanceof Error ? err.message : 'Could not save care task.');
    } finally {
      setPostingTask(false);
    }
  };

  const handleQuickSaveMed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medName.trim() || !medDosage.trim() || !medTime) {
      notifyToast('error', 'Medicine name, exact dosage, and time are required.');
      return;
    }
    setSavingMed(true);
    try {
      const rawTimes =
        medFrequency === 'twice_daily'
          ? [medTime, '20:00']
          : medFrequency === 'three_times_daily'
          ? [medTime, '14:00', '20:00']
          : [medTime];
      const times = Array.from(new Set(rawTimes)).sort();
      await saveMedication({
        name: medName.trim(),
        dosage: medDosage.trim(),
        frequency: medFrequency,
        times,
        startDate: todayKey,
        endDate: '',
        instructions: medInstructions.trim(),
        prescribingDoctor: '',
        gracePeriodMinutes: 60,
        archived: false,
      });
      setMedName('');
      setMedDosage('');
      setMedInstructions('');
      setQuickMedOpen(false);
    } catch (err) {
      notifyToast('error', err instanceof Error ? err.message : 'Could not save medication.');
    } finally {
      setSavingMed(false);
    }
  };

  const openNewApptModal = () => {
    setEditingApptId(null);
    setApptDoctor('');
    setApptSpec('');
    setApptClinic('');
    setApptDateTime(toLocalDateTimeInputValue(new Date(Date.now() + 86400000)));
    setApptNotes('');
    setQuickApptOpen(true);
  };

  const openEditApptModal = (appt: Appointment) => {
    setEditingApptId(appt.id);
    setApptDoctor(appt.doctorName);
    setApptSpec(appt.specialization || '');
    setApptClinic(appt.clinicName);
    setApptDateTime(appt.dateTime.slice(0, 16));
    setApptNotes(appt.notes || '');
    setQuickApptOpen(true);
  };

  const handleQuickSaveAppt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apptDoctor.trim() || !apptClinic.trim() || !apptDateTime) {
      notifyToast('error', 'Doctor name, clinic name, and date/time are required.');
      return;
    }
    setSavingAppt(true);
    try {
      await saveAppointment(
        {
          doctorName: apptDoctor.trim(),
          specialization: apptSpec.trim(),
          clinicName: apptClinic.trim(),
          dateTime: apptDateTime,
          notes: apptNotes.trim(),
          status: 'upcoming',
        },
        editingApptId || undefined
      );
      setEditingApptId(null);
      setApptDoctor('');
      setApptSpec('');
      setApptClinic('');
      setApptNotes('');
      setQuickApptOpen(false);
    } catch (err) {
      notifyToast('error', err instanceof Error ? err.message : 'Could not save appointment.');
    } finally {
      setSavingAppt(false);
    }
  };

  const handleQuickInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneratingInvite(true);
    try {
      const defaultRelation =
        inviteRole === 'elderly'
          ? 'Elderly Loved One'
          : inviteRole === 'caregiver'
          ? 'Caregiver'
          : 'Family Member';
      const res = await createInvitation({
        role: inviteRole,
        relation: inviteRelation.trim() || defaultRelation,
        canEditMedications: inviteCanEditMeds,
        canManageAppointments: inviteCanManageAppts,
        canLogDoses: inviteCanLogDoses,
        canManageMembers: permissions.isOwner ? inviteCanManageMembers : false,
        expiresHours: Number(inviteExpiresHours) || 48,
      });
      setGeneratedInvite(res);
    } catch (err) {
      notifyToast('error', err instanceof Error ? err.message : 'Failed to generate invitation');
    } finally {
      setGeneratingInvite(false);
    }
  };

  const isCircleEmpty = medications.length === 0 && appointments.length === 0;
  const isSimplifiedElderly = permissions.role === 'elderly' && !showFullFamilyView;
  const openCareTasks = careTasks.filter((task) => !task.completed);
  const currentUid = userAccount?.uid || '';

  const quickStartPanel = isCircleEmpty ? (
    <section className="hc-surface rounded-2xl border border-sky-200 bg-sky-50/50 p-6 dark:border-sky-900 dark:bg-sky-950/20">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            Your CareCircle is connected and ready
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {permissions.canEditMedications || permissions.canManageAppointments
              ? 'Add your first prescription or doctor visit below, or load a starter sample schedule into Cloud Firestore to test tracking right away.'
              : 'No medicines or appointments have been scheduled by the CareCircle owner yet. You can still share care notes and alerts below.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5 shrink-0">
          {permissions.canEditMedications && (
            <button
              type="button"
              onClick={() => setQuickMedOpen(true)}
              className="hc-primary-btn inline-flex items-center gap-1.5 rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 whitespace-nowrap"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t.actions.addMedicine}
            </button>
          )}
          {permissions.canManageAppointments && (
            <button
              type="button"
              onClick={openNewApptModal}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 whitespace-nowrap"
            >
              <Calendar className="h-4 w-4" aria-hidden="true" />
              {t.actions.addAppointment}
            </button>
          )}
          {permissions.canEditMedications && permissions.canManageAppointments && (
            <button
              type="button"
              disabled={loadingSample}
              onClick={() => void handleLoadSample()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 whitespace-nowrap"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {loadingSample ? 'Loading Sample...' : 'Load Sample Schedule'}
            </button>
          )}
        </div>
      </div>
    </section>
  ) : null;

  const modalsBlock = (
    <>
      {/* Caregiver Notify Family Modal */}
      {caregiverAlertOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="caregiver-alert-title"
        >
          <form
            onSubmit={handleSendCaregiverAlert}
            className="hc-surface max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
          >
            <h2 id="caregiver-alert-title" className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Notify Family Members
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Send an immediate assistance or care update to {activeCircle?.elderlyName}’s family.
            </p>
            <textarea
              required
              rows={3}
              value={alertMessage}
              onChange={(e) => setAlertMessage(e.target.value)}
              placeholder="e.g., Afternoon blood pressure slightly elevated; please check in before dinner."
              className="mt-4 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCaregiverAlertOpen(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800"
              >
                Send Alert
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Quick Add Medicine Modal */}
      {quickMedOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-med-title"
        >
          <div className="hc-surface max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h2 id="quick-med-title" className="font-display text-xl font-bold text-slate-900 dark:text-white">
                Quick Add Prescribed Medicine
              </h2>
              <button
                type="button"
                onClick={() => setQuickMedOpen(false)}
                aria-label="Close modal"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={handleQuickSaveMed} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium">Medicine Name *</label>
                <input
                  type="text"
                  required
                  value={medName}
                  onChange={(e) => setMedName(e.target.value)}
                  placeholder="e.g., Amlodipine"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium">Exact Prescribed Dosage *</label>
                <input
                  type="text"
                  required
                  value={medDosage}
                  onChange={(e) => setMedDosage(e.target.value)}
                  placeholder="e.g., 5 mg (1 tablet)"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium">Frequency</label>
                  <select
                    value={medFrequency}
                    onChange={(e) => setMedFrequency(e.target.value as MedicationFrequency)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="once_daily">Once Daily</option>
                    <option value="twice_daily">Twice Daily</option>
                    <option value="three_times_daily">3x Daily</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium">First Dose Time *</label>
                  <input
                    type="time"
                    required
                    value={medTime}
                    onChange={(e) => setMedTime(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium">Instructions (Optional)</label>
                <input
                  type="text"
                  value={medInstructions}
                  onChange={(e) => setMedInstructions(e.target.value)}
                  placeholder="e.g., After breakfast with water"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setQuickMedOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingMed}
                  className="hc-primary-btn rounded-xl bg-sky-700 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
                >
                  {savingMed ? 'Saving...' : 'Save Medicine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Schedule / Edit Appointment Modal */}
      {quickApptOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-appt-title"
        >
          <div className="hc-surface max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h2 id="quick-appt-title" className="font-display text-xl font-bold text-slate-900 dark:text-white">
                {editingApptId ? 'Edit Doctor Visit' : 'Schedule Doctor Visit'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setQuickApptOpen(false);
                  setEditingApptId(null);
                }}
                aria-label="Close modal"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={handleQuickSaveAppt} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium">Doctor Name *</label>
                  <input
                    type="text"
                    required
                    value={apptDoctor}
                    onChange={(e) => setApptDoctor(e.target.value)}
                    placeholder="Dr. Kavita Rao"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium">Specialization</label>
                  <input
                    type="text"
                    value={apptSpec}
                    onChange={(e) => setApptSpec(e.target.value)}
                    placeholder="Cardiology"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium">Clinic / Hospital *</label>
                <input
                  type="text"
                  required
                  value={apptClinic}
                  onChange={(e) => setApptClinic(e.target.value)}
                  placeholder="Mercy Wellness Clinic"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium">Date &amp; Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={apptDateTime}
                  onChange={(e) => setApptDateTime(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium">Notes (Optional)</label>
                <input
                  type="text"
                  value={apptNotes}
                  onChange={(e) => setApptNotes(e.target.value)}
                  placeholder="Bring blood pressure logbook"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setQuickApptOpen(false);
                    setEditingApptId(null);
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAppt}
                  className="hc-primary-btn rounded-xl bg-sky-700 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
                >
                  {savingAppt ? 'Saving...' : editingApptId ? 'Update Appointment' : 'Save Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Invite Member Modal */}
      {quickInviteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-invite-title"
        >
          <div className="hc-surface max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-sky-700 dark:text-sky-400" aria-hidden="true" />
                <h2 id="quick-invite-title" className="font-display text-xl font-bold text-slate-900 dark:text-white">
                  Invite to CareCircle
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setQuickInviteOpen(false);
                  setGeneratedInvite(null);
                }}
                aria-label="Close modal"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={handleQuickInvite} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => {
                      const r = e.target.value as UserRole;
                      setInviteRole(r);
                      if (r === 'elderly') {
                        setInviteRelation('Elderly Loved One');
                        setInviteCanEditMeds(true);
                        setInviteCanLogDoses(true);
                        setInviteCanManageAppts(true);
                        setInviteCanManageMembers(false);
                      } else if (r === 'caregiver') {
                        setInviteRelation('Home Care Nurse');
                        setInviteCanEditMeds(true);
                        setInviteCanLogDoses(true);
                        setInviteCanManageAppts(true);
                        setInviteCanManageMembers(false);
                      } else {
                        setInviteRelation('Daughter');
                        setInviteCanEditMeds(false);
                        setInviteCanLogDoses(true);
                        setInviteCanManageAppts(true);
                        setInviteCanManageMembers(false);
                      }
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="elderly">Elderly User</option>
                    <option value="family">Family Member</option>
                    <option value="caregiver">Caregiver</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium">Expires After</label>
                  <select
                    value={inviteExpiresHours}
                    onChange={(e) => setInviteExpiresHours(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="1">1 Hour (Urgent)</option>
                    <option value="24">24 Hours</option>
                    <option value="48">48 Hours</option>
                    <option value="168">7 Days</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium">Relationship / Title</label>
                <input
                  type="text"
                  value={inviteRelation}
                  onChange={(e) => setInviteRelation(e.target.value)}
                  placeholder="e.g., Mother, Daughter, Visiting Nurse"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div className="space-y-1.5 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inviteCanLogDoses}
                    onChange={(e) => setInviteCanLogDoses(e.target.checked)}
                    className="accent-sky-700"
                  />
                  Allow recording medication doses
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inviteCanEditMeds}
                    onChange={(e) => setInviteCanEditMeds(e.target.checked)}
                    className="accent-sky-700"
                  />
                  Allow adding/editing medications
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inviteCanManageAppts}
                    onChange={(e) => setInviteCanManageAppts(e.target.checked)}
                    className="accent-sky-700"
                  />
                  Allow managing doctor appointments
                </label>
                {permissions.isOwner && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inviteCanManageMembers}
                      onChange={(e) => setInviteCanManageMembers(e.target.checked)}
                      className="accent-sky-700"
                    />
                    Allow inviting &amp; managing members (Organizer)
                  </label>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setQuickInviteOpen(false);
                    setGeneratedInvite(null);
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={generatingInvite}
                  className="hc-primary-btn rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
                >
                  {generatingInvite ? 'Generating...' : 'Generate Passcode'}
                </button>
              </div>
              {generatedInvite && (
                <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 dark:border-emerald-900 dark:bg-emerald-950/40">
                  <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-300">
                    Single-use passcode (stored as SHA-256 hash):
                  </p>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <code className="font-mono text-base font-bold tracking-wider text-emerald-950 dark:text-emerald-100">
                      {generatedInvite.code}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(generatedInvite.code);
                        notifyToast('info', 'Passcode copied to clipboard.');
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-800"
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      Copy
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      <EmergencyModal open={emergencyOpen} onClose={() => setEmergencyOpen(false)} />
    </>
  );

  if (isSimplifiedElderly) {
    return (
      <div className="space-y-6">
        {/* Elderly Welcome Header */}
        <section className="hc-surface rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-base font-medium text-sky-700 dark:text-sky-400">
                {getGreeting(language)}, {activeCircle?.elderlyName || userAccount?.displayName}
                <span className="mx-2 text-slate-400" aria-hidden="true">·</span>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  {mode === 'firebase' ? (firestoreSynced ? 'Firestore Live' : 'Syncing...') : 'Demo Sandbox'}
                </span>
              </p>
              <h1 className="mt-1 font-display text-3xl font-bold text-slate-900 dark:text-white">
                {t.elderlyRoutine.title}
              </h1>
              <p className="mt-1.5 text-base text-slate-600 dark:text-slate-300">
                {t.elderlyRoutine.subtitle}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleReadRoutine}
                className="hc-primary-btn inline-flex items-center gap-2 rounded-xl bg-sky-700 px-5 py-3.5 text-base font-semibold text-white hover:bg-sky-800 transition-colors whitespace-nowrap"
              >
                <Volume2 className="h-5 w-5" aria-hidden="true" />
                {t.actions.readAloud}
              </button>
              <button
                type="button"
                onClick={() => setEmergencyOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-5 py-3.5 text-base font-semibold text-rose-800 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200 transition-colors whitespace-nowrap"
              >
                <PhoneCall className="h-5 w-5" aria-hidden="true" />
                {t.actions.emergencyCall}
              </button>
            </div>
          </div>

          {/* Clear Large Progress Strip */}
          <div className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-200 pt-6 dark:border-slate-800 sm:grid-cols-3">
            <div className="hc-surface rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">{t.status.taken}</p>
              <p className="mt-1 font-mono text-3xl font-bold text-emerald-900 dark:text-emerald-200 tabular-nums">
                {takenCount}
              </p>
            </div>
            <div className="hc-surface rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900 dark:bg-amber-950/30">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">{t.status.pending}</p>
              <p className="mt-1 font-mono text-3xl font-bold text-amber-900 dark:text-amber-200 tabular-nums">
                {pendingSlots.length}
              </p>
            </div>
            <div className="hc-surface rounded-xl border border-rose-200 bg-rose-50/70 p-4 dark:border-rose-900 dark:bg-rose-950/30">
              <p className="text-sm font-medium text-rose-800 dark:text-rose-300">{t.status.missed}</p>
              <p className="mt-1 font-mono text-3xl font-bold text-rose-900 dark:text-rose-200 tabular-nums">
                {missedSlots.length}
              </p>
            </div>
          </div>
        </section>

        {quickStartPanel}

        {/* Unread Alerts or Missed Dose Notice */}
        {(missedSlots.length > 0 || unreadNotifications.length > 0) && (
          <section className="hc-surface space-y-3 rounded-2xl border border-amber-300 bg-amber-50/60 p-5 dark:border-amber-900 dark:bg-amber-950/30">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <Bell className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
                <div>
                  <h2 className="font-semibold text-slate-900 dark:text-white">
                    {missedSlots.length > 0
                      ? `${missedSlots.length} missed dose${missedSlots.length > 1 ? 's' : ''} past grace period`
                      : `${unreadNotifications.length} unread CareCircle alert${unreadNotifications.length > 1 ? 's' : ''}`}
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-300">
                    {unreadNotifications[0]?.title ||
                      missedSlots.map((m) => `${m.medication.name} (${formatTimeDisplay(m.scheduledTime)})`).join(', ')}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                {unreadNotifications[0] && (
                  <button
                    type="button"
                    onClick={() => void markNotificationRead(unreadNotifications[0].id)}
                    className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    Mark Read
                  </button>
                )}
                {unreadNotifications.length > 1 && (
                  <button
                    type="button"
                    onClick={() => void markAllNotificationsRead()}
                    className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    Mark All Read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCurrentPage('notifications')}
                  className="text-sm font-semibold text-sky-700 hover:underline dark:text-sky-400 px-2 py-1.5"
                >
                  View Alerts
                </button>
              </div>
            </div>
            {missedSlots.length > 0 && permissions.canLogDoses && (
              <div className="space-y-2 border-t border-amber-200 pt-3 dark:border-amber-900">
                {missedSlots.map((slot) => (
                  <div
                    key={`${slot.medication.id}_${slot.scheduledTime}`}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span className="font-medium text-slate-900 dark:text-white">
                      {slot.medication.name} ·{' '}
                      <span className="font-mono">{formatTimeDisplay(slot.scheduledTime)}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void recordDose({
                            medication: slot.medication,
                            dateKey: todayKey,
                            scheduledTime: slot.scheduledTime,
                            status: 'taken',
                            notes: 'Recorded late from Routine alert',
                          })
                        }
                        className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800"
                      >
                        {t.actions.markTaken}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void recordDose({
                            medication: slot.medication,
                            dateKey: todayKey,
                            scheduledTime: slot.scheduledTime,
                            status: 'skipped',
                          })
                        }
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      >
                        {t.actions.skipDose}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Next Medicine Due Spotlight */}
        {nextDue && (
          <section className="hc-surface rounded-2xl border-2 border-sky-600 bg-sky-50/60 p-6 dark:border-sky-500 dark:bg-sky-950/30 sm:p-8">
            {(() => {
              const countdown = formatRelativeMinutes(
                nextDue.minutesUntil,
                nextDue.medication.gracePeriodMinutes
              );
              return (
                <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
                  <div>
                    <p className="text-sm font-semibold text-sky-800 dark:text-sky-300">
                      {t.elderlyRoutine.nextDoseLabel} ·{' '}
                      <span className="font-mono tabular-nums">
                        {formatTimeDisplay(nextDue.scheduledTime)}
                      </span>{' '}
                      ·{' '}
                      <span className="font-mono tabular-nums text-amber-800 dark:text-amber-300">
                        {countdown.label}
                      </span>
                    </p>
                    <h2 className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                      {nextDue.medication.name} — {nextDue.medication.dosage}
                    </h2>
                    {nextDue.medication.instructions && (
                      <p className="mt-2 text-base text-slate-700 dark:text-slate-300">
                        {nextDue.medication.instructions}
                      </p>
                    )}
                  </div>
                  {permissions.canLogDoses ? (
                    <div className="flex flex-wrap gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          void recordDose({
                            medication: nextDue.medication,
                            dateKey: todayKey,
                            scheduledTime: nextDue.scheduledTime,
                            status: 'taken',
                          })
                        }
                        className="hc-primary-btn inline-flex min-h-[52px] items-center gap-2 rounded-xl bg-emerald-700 px-7 py-3.5 text-lg font-bold text-white hover:bg-emerald-800 transition-colors"
                      >
                        <Check className="h-6 w-6" aria-hidden="true" />
                        {t.actions.markTaken}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void recordDose({
                            medication: nextDue.medication,
                            dateKey: todayKey,
                            scheduledTime: nextDue.scheduledTime,
                            status: 'skipped',
                          })
                        }
                        className="inline-flex min-h-[52px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3.5 text-base font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <SkipForward className="h-5 w-5" aria-hidden="true" />
                        {t.actions.skipDose}
                      </button>
                    </div>
                  ) : (
                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      View-only schedule
                    </span>
                  )}
                </div>
              );
            })()}
          </section>
        )}

        {/* Simplified Large Medication Cards */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              All Medicines Today
            </h2>
            <div className="flex items-center gap-4">
              {permissions.canEditMedications && (
                <button
                  type="button"
                  onClick={() => setQuickMedOpen(true)}
                  className="text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  + {t.actions.addMedicine}
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowFullFamilyView(true)}
                className="text-sm font-semibold text-sky-700 hover:underline dark:text-sky-400"
              >
                Show Full Overview
              </button>
            </div>
          </div>

          {todaySlots.length === 0 ? (
            <div className="hc-surface rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
              <p className="text-base text-slate-600 dark:text-slate-300">
                No medicines scheduled for today yet.
              </p>
              {permissions.canEditMedications && (
                <button
                  type="button"
                  onClick={() => setQuickMedOpen(true)}
                  className="mt-4 rounded-xl bg-sky-700 px-5 py-3 text-base font-semibold text-white hover:bg-sky-800"
                >
                  {t.actions.addMedicine}
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {todaySlots.map((slot) => {
                const isDone = slot.status === 'taken';
                const countdown = formatRelativeMinutes(
                  slot.minutesUntil,
                  slot.medication.gracePeriodMinutes
                );
                return (
                  <div
                    key={`${slot.medication.id}_${slot.scheduledTime}`}
                    className="hc-surface flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-mono text-base font-semibold text-sky-700 dark:text-sky-400 tabular-nums">
                          {formatTimeDisplay(slot.scheduledTime)}
                          {!slot.log && (
                            <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
                              · {countdown.label}
                            </span>
                          )}
                        </span>
                        <span
                          className={`font-semibold ${
                            slot.status === 'taken'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : slot.status === 'missed'
                              ? 'text-rose-700 dark:text-rose-400'
                              : slot.status === 'skipped'
                              ? 'text-slate-500 dark:text-slate-400'
                              : 'text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {slot.status === 'taken'
                            ? t.status.taken
                            : slot.status === 'missed'
                            ? t.status.missed
                            : slot.status === 'skipped'
                            ? t.status.skipped
                            : t.status.pending}
                        </span>
                      </div>

                      <h3 className="mt-2 font-display text-2xl font-bold text-slate-900 dark:text-white">
                        {slot.medication.name}
                      </h3>
                      <p className="mt-1 text-base font-medium text-slate-700 dark:text-slate-300">
                        {slot.medication.dosage}
                      </p>
                      {slot.medication.instructions && (
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                          {slot.medication.instructions}
                        </p>
                      )}
                      {slot.log && (
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          Recorded by {slot.log.recordedByName}{' '}
                          <span className="capitalize">({slot.log.recordedByRole})</span> ·{' '}
                          {formatTimestamp(slot.log.recordedAt)}
                        </p>
                      )}
                    </div>

                    {permissions.canLogDoses ? (
                      <div className="mt-5 flex flex-wrap gap-2.5">
                        <button
                          type="button"
                          onClick={() =>
                            void recordDose({
                              medication: slot.medication,
                              dateKey: todayKey,
                              scheduledTime: slot.scheduledTime,
                              status: 'taken',
                            })
                          }
                          className={`flex-1 min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-bold transition-colors ${
                            isDone
                              ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-200'
                              : 'hc-primary-btn bg-emerald-700 text-white hover:bg-emerald-800'
                          }`}
                        >
                          <Check className="h-5 w-5" aria-hidden="true" />
                          {t.actions.markTaken}
                        </button>
                        {slot.status !== 'skipped' && (
                          <button
                            type="button"
                            onClick={() =>
                              void recordDose({
                                medication: slot.medication,
                                dateKey: todayKey,
                                scheduledTime: slot.scheduledTime,
                                status: 'skipped',
                              })
                            }
                            className="min-h-[48px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 px-4 py-3 text-base font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                          >
                            {t.actions.skipDose}
                          </button>
                        )}
                        {slot.log && (
                          <button
                            type="button"
                            onClick={() =>
                              void revertDoseLog(slot.medication.id, todayKey, slot.scheduledTime)
                            }
                            className="min-h-[48px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                          >
                            <RotateCcw className="h-4 w-4" aria-hidden="true" />
                            Undo
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="mt-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                        View-only dose slot
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Simple Footer Cards (2x2): Next Doctor Visit + Care Tasks + Recent Activity + AI Helper */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="hc-surface rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Next Doctor Appointment
              </h2>
              <div className="flex items-center gap-3">
                {upcomingAppointments[0] && permissions.canManageAppointments && (
                  <button
                    type="button"
                    onClick={() => void updateAppointmentStatus(upcomingAppointments[0].id, 'completed')}
                    className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    Mark Done
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCurrentPage('appointments')}
                  className="text-sm font-semibold text-sky-700 hover:underline dark:text-sky-400"
                >
                  View Calendar
                </button>
              </div>
            </div>
            {upcomingAppointments[0] ? (
              <div className="mt-3">
                <p className="text-lg font-semibold text-slate-900 dark:text-white">
                  {upcomingAppointments[0].doctorName}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {upcomingAppointments[0].specialization ? `${upcomingAppointments[0].specialization} · ` : ''}
                  {upcomingAppointments[0].clinicName}
                </p>
                <p className="mt-2 font-mono text-sm font-semibold text-sky-700 dark:text-sky-400 tabular-nums">
                  {new Date(upcomingAppointments[0].dateTime).toLocaleString([], {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  · {formatAppointmentCountdown(upcomingAppointments[0].dateTime, nowTimestamp)}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No upcoming appointments scheduled.</p>
            )}
          </div>

          <div className="hc-surface rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Care Tasks ({openCareTasks.length})
              </h2>
              <button
                type="button"
                onClick={() => setCurrentPage('members')}
                className="text-sm font-semibold text-sky-700 hover:underline dark:text-sky-400"
              >
                All Tasks
              </button>
            </div>
            <form onSubmit={handleAddDashboardTask} className="mt-3 flex gap-2">
              <input
                type="text"
                required
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Add a care note or task..."
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              <button
                type="submit"
                disabled={postingTask}
                className="hc-primary-btn inline-flex items-center gap-1 rounded-xl bg-sky-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                {postingTask ? 'Saving' : 'Add'}
              </button>
            </form>
            <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
              {careTasks.slice(0, 3).map((task) => {
                const canDelete = permissions.isOwner || task.createdBy === currentUid;
                return (
                  <div key={task.id} className="flex items-start justify-between gap-2.5 py-2 last:pb-0">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => void toggleCareTask(task.id)}
                        aria-label="Toggle care task"
                        className="mt-0.5 text-sky-700 dark:text-sky-400 shrink-0"
                      >
                        {task.completed ? (
                          <CheckSquare className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <p
                          className={`text-sm font-medium ${
                            task.completed ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {task.title}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{task.createdByName}</p>
                      </div>
                    </div>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => void deleteCareTask(task.id)}
                        aria-label="Delete care task"
                        className="rounded-lg p-1 text-slate-400 hover:text-rose-600 shrink-0"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                );
              })}
              {careTasks.length === 0 && (
                <p className="pt-2 text-sm text-slate-500">No shared care tasks or notes yet.</p>
              )}
            </div>
          </div>

          <div className="hc-surface rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Recent CareCircle Activity
              </h2>
              <button
                type="button"
                onClick={() => setCurrentPage('analytics')}
                className="text-sm font-semibold text-sky-700 hover:underline dark:text-sky-400"
              >
                Full Timeline
              </button>
            </div>
            <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
              {activityLogs.slice(0, 4).map((act) => (
                <div key={act.id} className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                  <p className="min-w-0 truncate text-sm text-slate-700 dark:text-slate-300">
                    <span className="font-semibold text-slate-900 dark:text-white">{act.actorName}</span>{' '}
                    <span className="text-xs capitalize text-slate-500 dark:text-slate-400">
                      ({act.actorRole})
                    </span>{' '}
                    · {act.action}: {act.targetName}
                  </p>
                  <span className="shrink-0 font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {formatTimestamp(act.createdAt)}
                  </span>
                </div>
              ))}
              {activityLogs.length === 0 && (
                <p className="text-sm text-slate-500">
                  No CareCircle updates recorded yet.
                </p>
              )}
            </div>
          </div>

          <div className="hc-surface rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Need help understanding your schedule?
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Ask the AI Care Assistant by typing or speaking in English, Hindi, or Bengali.
            </p>
            <button
              type="button"
              onClick={() => setCurrentPage('assistant')}
              className="hc-primary-btn mt-4 inline-flex items-center gap-2 rounded-xl bg-sky-700 px-5 py-3 text-base font-semibold text-white hover:bg-sky-800 transition-colors"
            >
              <Bot className="h-5 w-5" aria-hidden="true" />
              Open AI Care Assistant
            </button>
          </div>
        </div>

        {modalsBlock}
      </div>
    );
  }

  // Collaborative Full Care Dashboard (Family Member, Caregiver, or Elderly Full Overview)
  return (
    <div className="space-y-6">
      {/* Header & Role Actions */}
      <section className="hc-surface rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <p className="text-sm font-medium text-sky-700 dark:text-sky-400">
              {getGreeting(language)}, {userAccount?.displayName} · Monitoring {activeCircle?.elderlyName}
              <span className="mx-2 text-slate-400" aria-hidden="true">·</span>
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                {mode === 'firebase' ? (firestoreSynced ? 'Cloud Firestore Live' : 'Syncing...') : 'Demo Sandbox'}
              </span>
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
              CareCircle Overview
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Role: <span className="font-semibold capitalize">{permissions.role}</span> ·{' '}
              {permissions.canEditMedications ? 'Can edit schedules' : 'Read-only schedule'} ·{' '}
              {permissions.canLogDoses ? 'Can log doses' : 'View-only logs'} ·{' '}
              {permissions.canManageAppointments ? 'Can manage visits' : 'View-only visits'}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {permissions.role === 'elderly' && (
              <button
                type="button"
                onClick={() => setShowFullFamilyView(false)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                Switch to Simplified Routine
              </button>
            )}
            {permissions.role === 'caregiver' && (
              <button
                type="button"
                onClick={() => setCaregiverAlertOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200 whitespace-nowrap"
              >
                <BellRing className="h-4 w-4" aria-hidden="true" />
                Notify Family
              </button>
            )}
            <button
              type="button"
              disabled={runningCheck}
              onClick={() => void handleRunCheck()}
              className="hc-primary-btn inline-flex items-center gap-2 rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-50 whitespace-nowrap"
            >
              <Clock className="h-4 w-4" aria-hidden="true" />
              {runningCheck ? 'Checking...' : t.actions.runReminderCheck}
            </button>
            <button
              type="button"
              onClick={() => setEmergencyOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-800 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200 whitespace-nowrap"
            >
              <PhoneCall className="h-4 w-4" aria-hidden="true" />
              Emergency
            </button>
          </div>
        </div>
      </section>

      {quickStartPanel}

      {/* Missed Medication & Active Alerts Banner */}
      {(missedSlots.length > 0 || unreadNotifications.length > 0) && (
        <section className="hc-surface space-y-3 rounded-2xl border border-rose-300 bg-rose-50/80 p-5 dark:border-rose-900 dark:bg-rose-950/40">
          {missedSlots.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-400" aria-hidden="true" />
                <div>
                  <h2 className="font-semibold text-rose-900 dark:text-rose-200">
                    Missed Medication Alert ({missedSlots.length} overdue past grace period)
                  </h2>
                  <p className="mt-0.5 text-xs text-rose-800 dark:text-rose-300">
                    Take action below or inspect the full schedule.
                  </p>
                </div>
              </div>
              <div className="space-y-2 pl-8">
                {missedSlots.map((slot) => {
                  const countdown = formatRelativeMinutes(
                    slot.minutesUntil,
                    slot.medication.gracePeriodMinutes
                  );
                  return (
                    <div
                      key={`${slot.medication.id}_${slot.scheduledTime}`}
                      className="flex flex-col justify-between gap-2 rounded-xl border border-rose-200 bg-white/80 px-3.5 py-2.5 dark:border-rose-900/70 dark:bg-slate-900/70 sm:flex-row sm:items-center"
                    >
                      <div className="text-sm">
                        <span className="font-mono font-semibold text-rose-800 dark:text-rose-300 tabular-nums">
                          {formatTimeDisplay(slot.scheduledTime)}
                        </span>
                        <span className="mx-1.5 text-slate-400" aria-hidden="true">·</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {slot.medication.name}
                        </span>
                        <span className="ml-1.5 text-xs text-slate-600 dark:text-slate-400">
                          {slot.medication.dosage} · {countdown.label}
                        </span>
                      </div>
                      {permissions.canLogDoses && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              void recordDose({
                                medication: slot.medication,
                                dateKey: todayKey,
                                scheduledTime: slot.scheduledTime,
                                status: 'taken',
                                notes: 'Recorded late from Dashboard alert',
                              })
                            }
                            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap"
                          >
                            Mark Taken
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void recordDose({
                                medication: slot.medication,
                                dateKey: todayKey,
                                scheduledTime: slot.scheduledTime,
                                status: 'skipped',
                                notes: 'Skipped from Dashboard alert',
                              })
                            }
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 whitespace-nowrap"
                          >
                            Skip
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {unreadNotifications.length > 0 && (
            <div
              className={`space-y-2.5 ${
                missedSlots.length > 0 ? 'border-t border-rose-200 pt-3 dark:border-rose-900' : ''
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <Bell className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
                  <h2 className="font-semibold text-slate-900 dark:text-white">
                    Unread CareCircle Alerts ({unreadNotifications.length})
                  </h2>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {unreadNotifications.length > 1 && (
                    <button
                      type="button"
                      onClick={() => void markAllNotificationsRead()}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 whitespace-nowrap"
                    >
                      Mark All Read
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setCurrentPage('notifications')}
                    className="text-xs font-semibold text-sky-700 hover:underline dark:text-sky-400 whitespace-nowrap"
                  >
                    All Alerts
                  </button>
                </div>
              </div>
              <div className="space-y-1.5 pl-7">
                {unreadNotifications.slice(0, 3).map((notif) => (
                  <div
                    key={notif.id}
                    className="flex flex-col justify-between gap-2 rounded-xl border border-amber-200/70 bg-white/75 px-3.5 py-2 dark:border-amber-900/50 dark:bg-slate-900/60 sm:flex-row sm:items-center"
                  >
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      <span className="font-semibold text-slate-900 dark:text-white">{notif.title}</span> —{' '}
                      {notif.message}
                    </p>
                    <button
                      type="button"
                      onClick={() => void markNotificationRead(notif.id)}
                      className="shrink-0 self-start rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:self-auto whitespace-nowrap"
                    >
                      Mark Read
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* KPI Strip */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="hc-surface rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Taken Today</p>
          <p className="mt-2 font-mono text-3xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {takenCount} / {todaySlots.length}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {skippedCount > 0 ? `${skippedCount} skipped today` : 'Scheduled slots completed'}
          </p>
        </div>
        <div className="hc-surface rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Pending &amp; Missed</p>
          <p className="mt-2 font-mono text-3xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">
            {pendingSlots.length}
            <span className="mx-1.5 text-lg text-slate-400">/</span>
            <span className="text-rose-700 dark:text-rose-400">{missedSlots.length}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Pending within grace · Missed overdue
          </p>
        </div>
        <div className="hc-surface rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">7-Day Adherence</p>
          <p className="mt-2 font-mono text-3xl font-bold text-sky-700 dark:text-sky-400 tabular-nums">
            {weekly.ratePercent}%
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {weekly.taken} of {weekly.eligibleTotal} eligible doses
          </p>
        </div>
        <div className="hc-surface rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Next Reminder</p>
          {nextDue ? (
            (() => {
              const countdown = formatRelativeMinutes(
                nextDue.minutesUntil,
                nextDue.medication.gracePeriodMinutes
              );
              return (
                <>
                  <p className="mt-2 font-mono text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                    {formatTimeDisplay(nextDue.scheduledTime)}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-600 dark:text-slate-400">
                    {nextDue.medication.name} ·{' '}
                    <span className="font-mono font-semibold text-sky-700 dark:text-sky-400 tabular-nums">
                      {countdown.label}
                    </span>
                  </p>
                </>
              );
            })()
          ) : (
            <p className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              All clear for now
            </p>
          )}
        </div>
      </section>

      {/* Main 2-Column Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Today's Medication Schedule + Care Tasks */}
        <div className="space-y-6 lg:col-span-7">
          <section className="hc-surface rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Pill className="h-5 w-5 text-sky-700 dark:text-sky-400" aria-hidden="true" />
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Today’s Medication Schedule
                </h2>
              </div>
              <div className="flex items-center gap-3">
                {permissions.canEditMedications && (
                  <button
                    type="button"
                    onClick={() => setQuickMedOpen(true)}
                    className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400 whitespace-nowrap"
                  >
                    + Add Medicine
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCurrentPage('tracker')}
                  className="text-sm font-semibold text-sky-700 hover:underline dark:text-sky-400 whitespace-nowrap"
                >
                  Open Tracker
                </button>
              </div>
            </div>

            {todaySlots.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter medication schedule">
                {(
                  [
                    { key: 'all', label: `All (${todaySlots.length})` },
                    { key: 'pending', label: `Pending (${pendingSlots.length})` },
                    { key: 'taken', label: `Taken (${takenCount})` },
                    { key: 'missed', label: `Missed (${missedSlots.length})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={scheduleFilter === tab.key}
                    onClick={() => setScheduleFilter(tab.key)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                      scheduleFilter === tab.key
                        ? 'border-sky-600 bg-sky-50 text-sky-800 dark:border-sky-500 dark:bg-sky-950/50 dark:text-sky-300'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
              {filteredTodaySlots.map((slot) => {
                const slotKey = `${slot.medication.id}_${slot.scheduledTime}`;
                const countdown = formatRelativeMinutes(
                  slot.minutesUntil,
                  slot.medication.gracePeriodMinutes
                );
                const noteOpen = openNoteSlotKey === slotKey;
                const draftNote = noteDrafts[slotKey] || '';
                const clearSlotNote = () => {
                  setOpenNoteSlotKey((prev) => (prev === slotKey ? null : prev));
                  setNoteDrafts((prev) => {
                    const next = { ...prev };
                    delete next[slotKey];
                    return next;
                  });
                };

                return (
                  <div key={slotKey} className="py-3.5">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                            {formatTimeDisplay(slot.scheduledTime)}
                          </span>
                          <span aria-hidden="true" className="text-slate-400">·</span>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {slot.medication.name}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400">
                            {slot.medication.dosage}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {slot.log ? (
                            <>
                              <span
                                className={`font-semibold uppercase ${
                                  slot.status === 'taken'
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : slot.status === 'missed'
                                    ? 'text-rose-700 dark:text-rose-400'
                                    : 'text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                {slot.status}
                              </span>{' '}
                              by {slot.log.recordedByName}{' '}
                              <span className="capitalize">({slot.log.recordedByRole})</span> ·{' '}
                              {formatTimestamp(slot.log.recordedAt)}
                              {slot.log.notes ? ` · "${slot.log.notes}"` : ''}
                            </>
                          ) : slot.status === 'missed' ? (
                            <span className="font-medium text-rose-700 dark:text-rose-400">
                              Missed ({countdown.label})
                            </span>
                          ) : (
                            <span className="font-mono tabular-nums text-amber-700 dark:text-amber-400">
                              {countdown.label} · grace {slot.medication.gracePeriodMinutes}m
                            </span>
                          )}
                        </p>
                      </div>

                      {permissions.canLogDoses ? (
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {slot.status !== 'taken' && (
                            <button
                              type="button"
                              onClick={() =>
                                setOpenNoteSlotKey((prev) => (prev === slotKey ? null : slotKey))
                              }
                              title="Add optional dose note"
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 whitespace-nowrap"
                            >
                              <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" />
                              Note
                            </button>
                          )}
                          {slot.status !== 'taken' && (
                            <button
                              type="button"
                              onClick={() => {
                                void recordDose({
                                  medication: slot.medication,
                                  dateKey: todayKey,
                                  scheduledTime: slot.scheduledTime,
                                  status: 'taken',
                                  notes: draftNote.trim() || undefined,
                                });
                                clearSlotNote();
                              }}
                              className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap"
                            >
                              Mark Taken
                            </button>
                          )}
                          {slot.status !== 'skipped' && slot.status !== 'taken' && (
                            <button
                              type="button"
                              onClick={() => {
                                void recordDose({
                                  medication: slot.medication,
                                  dateKey: todayKey,
                                  scheduledTime: slot.scheduledTime,
                                  status: 'skipped',
                                  notes: draftNote.trim() || undefined,
                                });
                                clearSlotNote();
                              }}
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 whitespace-nowrap"
                            >
                              Skip
                            </button>
                          )}
                          {slot.log && (
                            <button
                              type="button"
                              onClick={() =>
                                void revertDoseLog(slot.medication.id, todayKey, slot.scheduledTime)
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 whitespace-nowrap"
                            >
                              <RotateCcw className="h-3 w-3" aria-hidden="true" />
                              Undo
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                          View-only
                        </span>
                      )}
                    </div>
                    {noteOpen && permissions.canLogDoses && (
                      <div className="mt-2.5 flex items-center gap-2">
                        <input
                          type="text"
                          value={draftNote}
                          onChange={(e) =>
                            setNoteDrafts((prev) => ({ ...prev, [slotKey]: e.target.value }))
                          }
                          placeholder="Optional dose note (e.g., took after light snack)..."
                          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                        />
                        <button
                          type="button"
                          onClick={clearSlotNote}
                          className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredTodaySlots.length === 0 && (
                <p className="py-6 text-sm text-slate-500">
                  {todaySlots.length === 0
                    ? 'No active medications scheduled for today.'
                    : `No ${scheduleFilter} doses for today.`}
                </p>
              )}
            </div>
          </section>

          {/* Interactive Care Tasks & Daily Care Reports */}
          <section className="hc-surface rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Care Tasks &amp; Daily Reports ({openCareTasks.length} open)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setCurrentPage('members')}
                className="text-sm font-semibold text-sky-700 hover:underline dark:text-sky-400 whitespace-nowrap"
              >
                Collaboration Space
              </button>
            </div>

            <form onSubmit={handleAddDashboardTask} className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-12">
              <select
                aria-label="Care item category"
                value={taskCategory}
                onChange={(e) => setTaskCategory(e.target.value as CareTask['category'])}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-950 sm:col-span-3"
              >
                <option value="task">Shared Task</option>
                <option value="care_log">Care Report</option>
                <option value="assistance_alert">Assistance Alert</option>
              </select>
              <input
                type="text"
                required
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Add care task or daily update..."
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 sm:col-span-4"
              />
              <input
                type="text"
                value={taskNotes}
                onChange={(e) => setTaskNotes(e.target.value)}
                placeholder="Optional note..."
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 sm:col-span-3"
              />
              <button
                type="submit"
                disabled={postingTask}
                className="hc-primary-btn inline-flex items-center justify-center gap-1 rounded-xl bg-sky-700 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-50 sm:col-span-2 whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                {postingTask ? 'Saving' : 'Post'}
              </button>
            </form>

            {careTasks.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter care tasks">
                {(
                  [
                    { key: 'all', label: `All (${careTasks.length})` },
                    { key: 'open', label: `Open (${openCareTasks.length})` },
                    {
                      key: 'alerts',
                      label: `Alerts (${careTasks.filter((item) => item.category === 'assistance_alert').length})`,
                    },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={taskFilter === tab.key}
                    onClick={() => setTaskFilter(tab.key)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                      taskFilter === tab.key
                        ? 'border-sky-600 bg-sky-50 text-sky-800 dark:border-sky-500 dark:bg-sky-950/50 dark:text-sky-300'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              {filteredCareTasks.slice(0, 5).map((task) => {
                const canDelete = permissions.isOwner || task.createdBy === currentUid;
                return (
                  <div key={task.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => void toggleCareTask(task.id)}
                        aria-label="Toggle task completion"
                        className="mt-0.5 text-sky-700 dark:text-sky-400"
                      >
                        {task.completed ? (
                          <CheckSquare className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                      <div>
                        <p
                          className={`text-sm font-semibold ${
                            task.completed
                              ? 'line-through text-slate-400'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {task.title}
                          {task.category === 'assistance_alert' && (
                            <span className="ml-2 text-xs font-semibold text-rose-700 dark:text-rose-400">
                              · Assistance Alert
                            </span>
                          )}
                          {task.category === 'care_log' && (
                            <span className="ml-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                              · Care Report
                            </span>
                          )}
                        </p>
                        {task.notes && (
                          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{task.notes}</p>
                        )}
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {task.createdByName} · {formatTimestamp(task.createdAt)}
                        </p>
                      </div>
                    </div>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => void deleteCareTask(task.id)}
                        aria-label="Delete care task"
                        className="rounded-lg p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                );
              })}
              {filteredCareTasks.length === 0 && (
                <p className="py-5 text-sm text-slate-500">
                  {careTasks.length === 0
                    ? 'No shared care tasks or daily reports posted yet.'
                    : `No items match the "${taskFilter}" filter.`}
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Upcoming Appointments + CareCircle Members */}
        <div className="space-y-6 lg:col-span-5">
          <section className="hc-surface rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-sky-700 dark:text-sky-400" aria-hidden="true" />
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Upcoming Appointments
                </h2>
              </div>
              <div className="flex items-center gap-3">
                {permissions.canManageAppointments && (
                  <button
                    type="button"
                    onClick={openNewApptModal}
                    className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400 whitespace-nowrap"
                  >
                    + Schedule
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCurrentPage('appointments')}
                  className="text-sm font-semibold text-sky-700 hover:underline dark:text-sky-400 whitespace-nowrap"
                >
                  All Visits
                </button>
              </div>
            </div>
            <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              {upcomingAppointments.slice(0, 3).map((appt) => (
                <div
                  key={appt.id}
                  className="flex flex-col justify-between gap-2.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white">{appt.doctorName}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {appt.specialization ? `${appt.specialization} · ` : ''}
                      {appt.clinicName}
                    </p>
                    <p className="mt-1 font-mono text-xs font-semibold text-sky-700 dark:text-sky-400 tabular-nums">
                      {new Date(appt.dateTime).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      · {formatAppointmentCountdown(appt.dateTime, nowTimestamp)}
                    </p>
                  </div>
                  {permissions.canManageAppointments && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditApptModal(appt)}
                        title="Edit appointment"
                        aria-label={`Edit ${appt.doctorName}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 whitespace-nowrap"
                      >
                        <Edit3 className="h-3 w-3" aria-hidden="true" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void updateAppointmentStatus(appt.id, 'completed')}
                        title="Mark appointment completed"
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-400 whitespace-nowrap"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Done
                      </button>
                      <button
                        type="button"
                        onClick={() => void updateAppointmentStatus(appt.id, 'cancelled')}
                        title="Cancel appointment"
                        aria-label={`Cancel ${appt.doctorName}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 whitespace-nowrap"
                      >
                        <XCircle className="h-3 w-3" aria-hidden="true" />
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {upcomingAppointments.length === 0 && (
                <p className="text-sm text-slate-500">No upcoming doctor appointments.</p>
              )}
            </div>
          </section>

          <section className="hc-surface rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  CareCircle Members ({members.length})
                </h2>
              </div>
              <div className="flex items-center gap-3">
                {permissions.canManageMembers && (
                  <button
                    type="button"
                    onClick={() => {
                      setGeneratedInvite(null);
                      setQuickInviteOpen(true);
                    }}
                    className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400 whitespace-nowrap"
                  >
                    + Invite
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCurrentPage('members')}
                  className="text-sm font-semibold text-sky-700 hover:underline dark:text-sky-400 whitespace-nowrap"
                >
                  {permissions.canManageMembers ? 'Manage / Invite' : 'View'}
                </button>
              </div>
            </div>
            <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              {members.map((m) => (
                <div key={m.uid} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {m.displayName}
                    </p>
                    <span className="text-xs font-medium capitalize text-sky-700 dark:text-sky-400 shrink-0">
                      {m.role}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                    {m.relation || m.role} · {m.canLogDoses ? 'Logs doses' : 'View logs'} ·{' '}
                    {m.canEditMedications ? 'Edits meds' : 'View meds'}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Recent Healthcare Activity */}
      <section className="hc-surface rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-sky-700 dark:text-sky-400" aria-hidden="true" />
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Recent CareCircle Activity
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setCurrentPage('analytics')}
            className="text-sm font-semibold text-sky-700 hover:underline dark:text-sky-400 whitespace-nowrap"
          >
            Full Timeline &amp; Reports
          </button>
        </div>
        <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
          {activityLogs.slice(0, 6).map((act) => (
            <div key={act.id} className="flex flex-col justify-between gap-1 py-2.5 sm:flex-row sm:items-center">
              <div className="text-sm">
                <span className="font-semibold text-slate-900 dark:text-white">{act.actorName}</span>{' '}
                <span className="text-xs capitalize text-slate-500 dark:text-slate-400">
                  ({act.actorRole})
                </span>
                <span className="mx-1.5 text-slate-400" aria-hidden="true">·</span>
                <span className="text-slate-700 dark:text-slate-300">{act.action}:</span>{' '}
                <span className="font-medium text-slate-900 dark:text-white">{act.targetName}</span>
              </div>
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {formatTimestamp(act.createdAt)}
              </span>
            </div>
          ))}
          {activityLogs.length === 0 && (
            <p className="py-4 text-sm text-slate-500">
              No CareCircle activity logged yet. Dose recordings, visits, and care notes appear here in real time.
            </p>
          )}
        </div>
      </section>

      {modalsBlock}
    </div>
  );
};
