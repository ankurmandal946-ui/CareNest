import type {
  ActivityLog,
  AppLanguage,
  Appointment,
  Medication,
  MedicationLog,
  ScheduledDoseSlot,
} from '../types/carecircle';

export function formatDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayDateKey(): string {
  return formatDateKey(new Date());
}

export function toLocalDateTimeInputValue(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function getCurrentMinutesOfDay(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export function parseTimeMinutes(timeStr: string): number {
  const [hh, mm] = timeStr.split(':').map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return 0;
  return hh * 60 + mm;
}

export function formatTimeDisplay(timeStr: string): string {
  const [hh, mm] = timeStr.split(':').map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return timeStr;
  const period = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${period}`;
}

export function formatTimestamp(ts: unknown): string {
  if (!ts) return 'Just now';
  if (typeof ts === 'string') {
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? ts : d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
    const d = (ts as { toDate: () => Date }).toDate();
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  return 'Just now';
}

export function getTimestampMs(ts: unknown): number {
  if (!ts) return 0;
  if (typeof ts === 'string') {
    const ms = new Date(ts).getTime();
    return Number.isNaN(ms) ? 0 : ms;
  }
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
    return (ts as { toDate: () => Date }).toDate().getTime();
  }
  return 0;
}

export function computeScheduleForDate(
  medications: Medication[],
  logs: MedicationLog[],
  dateKey: string,
  nowMinutes: number = getCurrentMinutesOfDay()
): ScheduledDoseSlot[] {
  const todayKey = getTodayDateKey();
  const isPastDay = dateKey < todayKey;
  const isFutureDay = dateKey > todayKey;

  const logBySlot = new Map<string, MedicationLog>();
  for (const log of logs) {
    if (log.dateKey === dateKey) {
      logBySlot.set(`${log.medicationId}__${log.scheduledTime}`, log);
    }
  }

  const slots: ScheduledDoseSlot[] = [];

  for (const med of medications) {
    if (med.archived) continue;
    if (med.startDate > dateKey) continue;
    if (med.endDate && med.endDate < dateKey) continue;

    for (const scheduledTime of med.times) {
      const schedMins = parseTimeMinutes(scheduledTime);
      const existingLog = logBySlot.get(`${med.id}__${scheduledTime}`);
      const grace = Math.max(5, med.gracePeriodMinutes || 60);

      const isPastGrace =
        isPastDay || (!isFutureDay && nowMinutes > schedMins + grace);

      let status: ScheduledDoseSlot['status'] = 'pending';
      if (existingLog) {
        status = existingLog.status;
      } else if (isPastGrace) {
        // Respect grace period: only treat as missed once grace window has elapsed
        status = 'missed';
      }

      slots.push({
        medication: med,
        dateKey,
        scheduledTime,
        status,
        log: existingLog,
        isPastGrace,
        minutesUntil: isPastDay ? -1440 : isFutureDay ? 1440 : schedMins - nowMinutes,
      });
    }
  }

  slots.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
  return slots;
}

export function formatRelativeMinutes(
  minutesUntil: number,
  gracePeriodMinutes: number = 60
): { label: string; tone: 'upcoming' | 'due' | 'grace' | 'overdue' } {
  if (minutesUntil > 60) {
    const h = Math.floor(minutesUntil / 60);
    const m = minutesUntil % 60;
    return { label: m > 0 ? `Due in ${h}h ${m}m` : `Due in ${h}h`, tone: 'upcoming' };
  }
  if (minutesUntil > 0) {
    return { label: `Due in ${minutesUntil}m`, tone: 'upcoming' };
  }
  if (minutesUntil === 0) {
    return { label: 'Due now', tone: 'due' };
  }
  const elapsed = Math.abs(minutesUntil);
  if (elapsed <= gracePeriodMinutes) {
    const remaining = gracePeriodMinutes - elapsed;
    return { label: `Grace window · ${remaining}m left`, tone: 'grace' };
  }
  return { label: `Overdue by ${elapsed - gracePeriodMinutes}m`, tone: 'overdue' };
}

export interface DailyAdherencePoint {
  dateKey: string;
  label: string;
  taken: number;
  missed: number;
  skipped: number;
  pending: number;
  eligibleTotal: number;
}

export function computeWeeklyAdherence(
  medications: Medication[],
  logs: MedicationLog[],
  nowMinutes: number = getCurrentMinutesOfDay()
): {
  days: DailyAdherencePoint[];
  taken: number;
  missed: number;
  skipped: number;
  eligibleTotal: number;
  ratePercent: number;
} {
  const today = new Date();
  const days: DailyAdherencePoint[] = [];

  let totalTaken = 0;
  let totalMissed = 0;
  let totalSkipped = 0;
  let totalEligible = 0;

  for (let offset = 6; offset >= 0; offset--) {
    const d = new Date(today);
    d.setDate(today.getDate() - offset);
    const dk = formatDateKey(d);
    const slots = computeScheduleForDate(medications, logs, dk, nowMinutes);

    let taken = 0;
    let missed = 0;
    let skipped = 0;
    let pending = 0;

    for (const slot of slots) {
      if (slot.status === 'taken') taken++;
      else if (slot.status === 'missed') missed++;
      else if (slot.status === 'skipped') skipped++;
      else pending++;
    }

    // Eligible scheduled doses exclude future/pending doses still within schedule/grace window
    const eligibleTotal = taken + missed + skipped;
    totalTaken += taken;
    totalMissed += missed;
    totalSkipped += skipped;
    totalEligible += eligibleTotal;

    days.push({
      dateKey: dk,
      label: d.toLocaleDateString([], { weekday: 'short' }),
      taken,
      missed,
      skipped,
      pending,
      eligibleTotal,
    });
  }

  const ratePercent =
    totalEligible > 0 ? Math.round((totalTaken / totalEligible) * 100) : 100;

  return {
    days,
    taken: totalTaken,
    missed: totalMissed,
    skipped: totalSkipped,
    eligibleTotal: totalEligible,
    ratePercent,
  };
}

export interface CareInsight {
  id: string;
  severity: 'info' | 'attention' | 'positive';
  title: string;
  detail: string;
}

export function generateSmartInsights(
  medications: Medication[],
  logs: MedicationLog[],
  appointments: Appointment[]
): CareInsight[] {
  const insights: CareInsight[] = [];
  const weekly = computeWeeklyAdherence(medications, logs);

  // Check missed dose patterns by time of day
  const missedSlots = weekly.days.flatMap((day) => {
    const slots = computeScheduleForDate(medications, logs, day.dateKey);
    return slots.filter((s) => s.status === 'missed');
  });

  if (missedSlots.length > 0) {
    const eveningMissed = missedSlots.filter((s) => parseTimeMinutes(s.scheduledTime) >= 18 * 60);
    const morningMissed = missedSlots.filter((s) => parseTimeMinutes(s.scheduledTime) < 12 * 60);
    if (eveningMissed.length >= 2) {
      insights.push({
        id: 'insight-evening-missed',
        severity: 'attention',
        title: 'Recurring evening missed doses recorded',
        detail: `${eveningMissed.length} evening scheduled doses were missed over the past 7 days. Consider enabling an extra family reminder or checking with the caregiver.`,
      });
    } else if (morningMissed.length >= 2) {
      insights.push({
        id: 'insight-morning-missed',
        severity: 'attention',
        title: 'Morning schedule pattern noticed',
        detail: `${morningMissed.length} morning doses were missed this week. Reviewing meal-time alignment with the prescribing doctor may help.`,
      });
    } else {
      insights.push({
        id: 'insight-single-missed',
        severity: 'info',
        title: `${missedSlots.length} missed dose${missedSlots.length > 1 ? 's' : ''} in past 7 days`,
        detail: 'Missed doses are recorded only after the configured grace period expires.',
      });
    }
  } else if (weekly.eligibleTotal > 0) {
    insights.push({
      id: 'insight-zero-missed',
      severity: 'positive',
      title: 'Zero missed doses over the past 7 days',
      detail: `${weekly.taken} of ${weekly.eligibleTotal} eligible scheduled doses were logged as taken.`,
    });
  }

  // Upcoming appointments within 72 hours
  const now = Date.now();
  const soonAppts = appointments.filter((a) => {
    if (a.status !== 'upcoming') return false;
    const diffHours = (new Date(a.dateTime).getTime() - now) / (1000 * 60 * 60);
    return diffHours > 0 && diffHours <= 72;
  });

  for (const appt of soonAppts) {
    insights.push({
      id: `insight-appt-${appt.id}`,
      severity: 'info',
      title: `Appointment approaching: ${appt.doctorName}`,
      detail: `Scheduled for ${new Date(appt.dateTime).toLocaleString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })} at ${appt.clinicName}.`,
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: 'insight-baseline',
      severity: 'info',
      title: 'Care routine on track',
      detail: 'Continue logging daily doses and upcoming doctor visits to generate weekly adherence insights.',
    });
  }

  return insights;
}

export function speakText(text: string, lang: AppLanguage = 'en'): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang === 'hi' ? 'hi-IN' : lang === 'bn' ? 'bn-IN' : 'en-US';
  utterance.rate = 0.92;
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export type AuditCategoryFilter = 'all' | 'medications' | 'collaboration' | 'appointments' | 'tasks';

export function matchesAuditCategory(act: ActivityLog, category: AuditCategoryFilter): boolean {
  if (category === 'all') return true;
  const action = act.action.toLowerCase();
  if (category === 'medications') {
    return (
      action.includes('dose') ||
      action.includes('medicine') ||
      action.includes('sample') ||
      action.includes('schedule')
    );
  }
  if (category === 'collaboration') {
    return (
      action.includes('invite') ||
      action.includes('invitation') ||
      action.includes('member') ||
      action.includes('permission') ||
      action.includes('joined') ||
      action.includes('profile')
    );
  }
  if (category === 'appointments') {
    return action.includes('appointment');
  }
  if (category === 'tasks') {
    return (
      action.includes('task') ||
      action.includes('care') ||
      action.includes('note') ||
      action.includes('alert')
    );
  }
  return true;
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition
  );
}
