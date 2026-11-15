export type UserRole = 'elderly' | 'family' | 'caregiver';
export type AppLanguage = 'en' | 'hi' | 'bn';
export type ThemeMode = 'light' | 'dark';
export type FontScale = 'normal' | 'large' | 'xlarge';
export type DemoCircleId = 'demo-circle-sen' | 'demo-circle-kapoor';

export type AppPage =
  | 'landing'
  | 'auth'
  | 'onboarding'
  | 'dashboard'
  | 'medications'
  | 'tracker'
  | 'appointments'
  | 'members'
  | 'assistant'
  | 'analytics'
  | 'notifications'
  | 'settings';

export type DoseStatus = 'taken' | 'missed' | 'skipped' | 'pending';
export type MedicationFrequency =
  | 'once_daily'
  | 'twice_daily'
  | 'three_times_daily'
  | 'four_times_daily'
  | 'custom';

export interface UserAccount {
  uid: string;
  displayName: string;
  preferredRole: UserRole;
  activeCircleId: string;
  language: AppLanguage;
  theme: ThemeMode;
  highContrast: boolean;
  fontScale: FontScale;
  voiceEnabled: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserPrivateInfo {
  uid: string;
  email: string;
  phone: string;
  notifyUpcomingDose: boolean;
  notifyMissedDose: boolean;
  notifyAppointment: boolean;
  notifyCaregiverUpdates: boolean;
  emailAlertsEnabled: boolean;
  updatedAt?: unknown;
}

export interface UserCircleIndex {
  circleId: string;
  elderlyName: string;
  role: UserRole;
  joinedAt?: unknown;
}

export interface CareCircleProfile {
  id: string;
  ownerId: string;
  elderlyName: string;
  elderlyAge: number;
  bloodGroup: string;
  allergies: string;
  careNotes: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  timezone: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CircleMember {
  uid: string;
  displayName: string;
  role: UserRole;
  relation: string;
  notifyEmail: string;
  emailOptIn?: boolean;
  canEditMedications: boolean;
  canManageAppointments: boolean;
  canLogDoses: boolean;
  canManageMembers?: boolean;
  inviteCodeHash: string;
  avatarUrl?: string;
  joinedAt?: string | unknown;
  updatedAt?: string | unknown;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: MedicationFrequency;
  times: string[];
  startDate: string;
  endDate: string;
  instructions: string;
  prescribingDoctor: string;
  gracePeriodMinutes: number;
  archived: boolean;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface MedicationLog {
  id: string;
  medicationId: string;
  medicationName: string;
  dosage: string;
  dateKey: string;
  scheduledTime: string;
  status: 'taken' | 'missed' | 'skipped';
  recordedByUid: string;
  recordedByName: string;
  recordedByRole: UserRole | 'system';
  notes: string;
  recordedAt: string | unknown;
  createdAt?: unknown;
}

export interface Appointment {
  id: string;
  doctorName: string;
  specialization: string;
  clinicName: string;
  dateTime: string;
  notes: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  reminderSent: boolean;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CareTask {
  id: string;
  title: string;
  notes: string;
  category: 'task' | 'care_log' | 'assistance_alert';
  completed: boolean;
  completedBy: string;
  dueDate: string;
  createdBy: string;
  createdByName: string;
  createdAt: string | unknown;
  updatedAt?: unknown;
}

export interface NotificationItem {
  id: string;
  eventType:
    | 'upcoming_dose'
    | 'missed_dose'
    | 'appointment_reminder'
    | 'appointment_change'
    | 'caregiver_update'
    | 'test_email';
  title: string;
  message: string;
  deliveryMode: 'real_email' | 'simulated_demo' | 'in_app';
  providerName?: string;
  providerMessageId?: string;
  emailTarget: string;
  read: boolean;
  createdBy: string;
  createdAt: string | unknown;
}

export interface EmailProviderStatus {
  configured: boolean;
  provider: 'resend' | 'sendgrid' | 'webhook' | 'simulated_demo';
  requestedProvider?: 'auto' | 'resend' | 'sendgrid' | 'webhook';
  fromEmail: string;
  schedulerConfigured: boolean;
  cronEndpoint: string;
  cronHeader: string;
  supportedProviders: string[];
  missingRequirements: string[];
}

export interface ActivityLog {
  id: string;
  actorUid: string;
  actorName: string;
  actorRole: UserRole | 'system';
  action: string;
  targetName: string;
  details: string;
  createdAt: string | unknown;
}

export interface CareCircleInvitation {
  codeHash: string;
  circleId: string;
  elderlyName: string;
  role: UserRole;
  relation: string;
  canEditMedications: boolean;
  canManageAppointments: boolean;
  canLogDoses: boolean;
  canManageMembers?: boolean;
  expiresAt: string | unknown;
  usedAt: string | unknown | null;
  acceptedBy: string | null;
  acceptedByName?: string | null;
  revokedAt?: string | unknown | null;
  revokedBy?: string | null;
  createdBy: string;
  createdByName?: string;
  createdAt?: string | unknown;
}

export type DemoInvitationRecord = CareCircleInvitation;

export interface ScheduledDoseSlot {
  medication: Medication;
  dateKey: string;
  scheduledTime: string;
  status: DoseStatus;
  log?: MedicationLog;
  isPastGrace: boolean;
  minutesUntil: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  streaming?: boolean;
  error?: boolean;
  retryPrompt?: string;
}
