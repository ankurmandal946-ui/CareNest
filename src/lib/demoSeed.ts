import type {
  ActivityLog,
  Appointment,
  CareCircleProfile,
  CareTask,
  CircleMember,
  DemoCircleId,
  DemoInvitationRecord,
  Medication,
  MedicationLog,
  NotificationItem,
  UserRole,
} from '../types/carecircle';
import { formatDateKey, toLocalDateTimeInputValue } from './scheduleUtils';

export const DEMO_AVATARS = {
  elderly: '/src/assets/images/avatar_elderly_martha_1794728031452.jpg',
  family: '/src/assets/images/avatar_family_rohan_1794728030623.jpg',
  caregiver: '/src/assets/images/avatar_caregiver_priya_1794728030527.jpg',
  table: '/src/assets/images/care_routine_table_1794728030201.jpg',
};

export interface DemoActorInfo {
  uid: string;
  displayName: string;
  email: string;
  phone: string;
  relation: string;
  avatarUrl: string;
}

export interface DemoCircleSeedBundle {
  profile: CareCircleProfile;
  members: CircleMember[];
  medications: Medication[];
  logs: MedicationLog[];
  appointments: Appointment[];
  tasks: CareTask[];
  notifications: NotificationItem[];
  activityLogs: ActivityLog[];
  invitations: DemoInvitationRecord[];
}

export interface DemoProfileMeta {
  circleId: DemoCircleId;
  label: string;
  age: number;
  focusSummary: string;
  actors: Record<UserRole, DemoActorInfo>;
}

export const DEMO_PROFILES: Record<DemoCircleId, DemoProfileMeta> = {
  'demo-circle-sen': {
    circleId: 'demo-circle-sen',
    label: 'Martha Sen',
    age: 74,
    focusSummary: 'Cardiology & diabetes routine · 4 daily medicines · high adherence',
    actors: {
      elderly: {
        uid: 'demo-elderly-martha',
        displayName: 'Martha Sen',
        email: 'martha.sen.demo@carecircle.local',
        phone: '+1 (555) 234-8910',
        relation: 'Self (CareCircle Owner)',
        avatarUrl: DEMO_AVATARS.elderly,
      },
      family: {
        uid: 'demo-family-rohan',
        displayName: 'Rohan Sen',
        email: 'rohan.sen.demo@carecircle.local',
        phone: '+1 (555) 234-8911',
        relation: 'Son (Lives in Boston)',
        avatarUrl: DEMO_AVATARS.family,
      },
      caregiver: {
        uid: 'demo-caregiver-sarah',
        displayName: 'Sarah Nair',
        email: 'sarah.nair.demo@carecircle.local',
        phone: '+1 (555) 234-8912',
        relation: 'Home Care Nurse',
        avatarUrl: DEMO_AVATARS.caregiver,
      },
    },
  },
  'demo-circle-kapoor': {
    circleId: 'demo-circle-kapoor',
    label: 'Harish Kapoor',
    age: 79,
    focusSummary: 'Respiratory & post-knee recovery · overdue dose alert · active refill task',
    actors: {
      elderly: {
        uid: 'demo-elderly-harish',
        displayName: 'Harish Kapoor',
        email: 'harish.kapoor.demo@carecircle.local',
        phone: '+1 (555) 619-4420',
        relation: 'Self (CareCircle Owner)',
        avatarUrl: DEMO_AVATARS.table,
      },
      family: {
        uid: 'demo-family-meera',
        displayName: 'Meera Kapoor',
        email: 'meera.kapoor.demo@carecircle.local',
        phone: '+1 (555) 619-4421',
        relation: 'Daughter (Chicago)',
        avatarUrl: DEMO_AVATARS.family,
      },
      caregiver: {
        uid: 'demo-caregiver-david',
        displayName: 'David Chen',
        email: 'david.chen.demo@carecircle.local',
        phone: '+1 (555) 619-4422',
        relation: 'Rehab Care Aide',
        avatarUrl: DEMO_AVATARS.caregiver,
      },
    },
  },
};

export const DEMO_USERS: Record<
  UserRole,
  { uid: string; displayName: string; email: string; relation: string; avatarUrl: string }
> = {
  elderly: DEMO_PROFILES['demo-circle-sen'].actors.elderly,
  family: DEMO_PROFILES['demo-circle-sen'].actors.family,
  caregiver: DEMO_PROFILES['demo-circle-sen'].actors.caregiver,
};

export function getDemoActor(circleId: DemoCircleId, role: UserRole): DemoActorInfo {
  return (DEMO_PROFILES[circleId] || DEMO_PROFILES['demo-circle-sen']).actors[role];
}

function buildMarthaSenSeed(): DemoCircleSeedBundle {
  const now = new Date();
  const todayKey = formatDateKey(now);

  const dayOffset = (offset: number) => {
    const d = new Date(now);
    d.setDate(now.getDate() + offset);
    return formatDateKey(d);
  };

  const isoOffsetHours = (hours: number) => {
    return new Date(now.getTime() + hours * 3600 * 1000).toISOString();
  };

  const localOffsetHours = (hours: number) => {
    return toLocalDateTimeInputValue(new Date(now.getTime() + hours * 3600 * 1000));
  };

  const profile: CareCircleProfile = {
    id: 'demo-circle-sen',
    ownerId: 'demo-elderly-martha',
    elderlyName: 'Martha Sen',
    elderlyAge: 74,
    bloodGroup: 'O+',
    allergies: 'Penicillin (mild rash)',
    careNotes: 'Prefers warm water with morning tablets; short 15-minute afternoon walk.',
    emergencyContactName: 'Rohan Sen (Son)',
    emergencyContactPhone: '+1 (555) 234-8910',
    emergencyContactRelation: 'Son',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  };

  const members: CircleMember[] = [
    {
      uid: 'demo-elderly-martha',
      displayName: 'Martha Sen',
      role: 'elderly',
      relation: 'Self (CareCircle Owner)',
      notifyEmail: 'martha.sen.demo@carecircle.local',
      emailOptIn: true,
      canEditMedications: true,
      canManageAppointments: true,
      canLogDoses: true,
      canManageMembers: true,
      inviteCodeHash: '',
      avatarUrl: DEMO_AVATARS.elderly,
      joinedAt: isoOffsetHours(-24 * 30),
    },
    {
      uid: 'demo-family-rohan',
      displayName: 'Rohan Sen',
      role: 'family',
      relation: 'Son (Lives in Boston)',
      notifyEmail: 'rohan.sen.demo@carecircle.local',
      emailOptIn: true,
      canEditMedications: false,
      canManageAppointments: true,
      canLogDoses: true,
      canManageMembers: false,
      inviteCodeHash: 'demo-hash-rohan',
      avatarUrl: DEMO_AVATARS.family,
      joinedAt: isoOffsetHours(-24 * 28),
    },
    {
      uid: 'demo-caregiver-sarah',
      displayName: 'Sarah Nair',
      role: 'caregiver',
      relation: 'Assigned Caregiver',
      notifyEmail: 'sarah.nair.demo@carecircle.local',
      emailOptIn: true,
      canEditMedications: true,
      canManageAppointments: true,
      canLogDoses: true,
      canManageMembers: false,
      inviteCodeHash: 'demo-hash-sarah',
      avatarUrl: DEMO_AVATARS.caregiver,
      joinedAt: isoOffsetHours(-24 * 20),
    },
  ];

  const medications: Medication[] = [
    {
      id: 'med-amlodipine',
      name: 'Amlodipine',
      dosage: '5 mg (1 tablet)',
      frequency: 'once_daily',
      times: ['08:00'],
      startDate: dayOffset(-30),
      endDate: '',
      instructions: 'Take with a full glass of water after breakfast.',
      prescribingDoctor: 'Dr. Kavita Rao',
      gracePeriodMinutes: 60,
      archived: false,
      createdBy: 'demo-elderly-martha',
    },
    {
      id: 'med-metformin',
      name: 'Metformin',
      dosage: '500 mg (1 tablet)',
      frequency: 'twice_daily',
      times: ['08:30', '20:00'],
      startDate: dayOffset(-30),
      endDate: '',
      instructions: 'Take immediately with morning and evening meals.',
      prescribingDoctor: 'Dr. Arvind Mehta',
      gracePeriodMinutes: 60,
      archived: false,
      createdBy: 'demo-caregiver-sarah',
    },
    {
      id: 'med-atorvastatin',
      name: 'Atorvastatin',
      dosage: '10 mg (1 tablet)',
      frequency: 'once_daily',
      times: ['21:30'],
      startDate: dayOffset(-25),
      endDate: '',
      instructions: 'Take at bedtime as prescribed.',
      prescribingDoctor: 'Dr. Kavita Rao',
      gracePeriodMinutes: 60,
      archived: false,
      createdBy: 'demo-elderly-martha',
    },
    {
      id: 'med-vitd3',
      name: 'Vitamin D3',
      dosage: '1000 IU (1 softgel)',
      frequency: 'once_daily',
      times: ['13:00'],
      startDate: dayOffset(-20),
      endDate: '',
      instructions: 'Take after lunch.',
      prescribingDoctor: 'Dr. Arvind Mehta',
      gracePeriodMinutes: 90,
      archived: false,
      createdBy: 'demo-caregiver-sarah',
    },
  ];

  const logs: MedicationLog[] = [
    {
      id: 'log-today-1',
      medicationId: 'med-amlodipine',
      medicationName: 'Amlodipine',
      dosage: '5 mg (1 tablet)',
      dateKey: todayKey,
      scheduledTime: '08:00',
      status: 'taken',
      recordedByUid: 'demo-elderly-martha',
      recordedByName: 'Martha Sen',
      recordedByRole: 'elderly',
      notes: 'Taken after oatmeal breakfast',
      recordedAt: `${todayKey}T08:12:00.000Z`,
    },
  ];

  for (let d = 1; d <= 6; d++) {
    const dk = dayOffset(-d);
    logs.push(
      {
        id: `log-aml-${d}`,
        medicationId: 'med-amlodipine',
        medicationName: 'Amlodipine',
        dosage: '5 mg (1 tablet)',
        dateKey: dk,
        scheduledTime: '08:00',
        status: 'taken',
        recordedByUid: 'demo-elderly-martha',
        recordedByName: 'Martha Sen',
        recordedByRole: 'elderly',
        notes: '',
        recordedAt: `${dk}T08:15:00.000Z`,
      },
      {
        id: `log-met-am-${d}`,
        medicationId: 'med-metformin',
        medicationName: 'Metformin',
        dosage: '500 mg (1 tablet)',
        dateKey: dk,
        scheduledTime: '08:30',
        status: 'taken',
        recordedByUid: 'demo-caregiver-sarah',
        recordedByName: 'Sarah Nair',
        recordedByRole: 'caregiver',
        notes: '',
        recordedAt: `${dk}T08:38:00.000Z`,
      },
      {
        id: `log-vitd-${d}`,
        medicationId: 'med-vitd3',
        medicationName: 'Vitamin D3',
        dosage: '1000 IU (1 softgel)',
        dateKey: dk,
        scheduledTime: '13:00',
        status: d === 3 ? 'skipped' : 'taken',
        recordedByUid: 'demo-elderly-martha',
        recordedByName: 'Martha Sen',
        recordedByRole: 'elderly',
        notes: d === 3 ? 'Light lunch, skipped supplement' : '',
        recordedAt: `${dk}T13:10:00.000Z`,
      },
      {
        id: `log-met-pm-${d}`,
        medicationId: 'med-metformin',
        medicationName: 'Metformin',
        dosage: '500 mg (1 tablet)',
        dateKey: dk,
        scheduledTime: '20:00',
        status: d === 2 || d === 5 ? 'missed' : 'taken',
        recordedByUid: d === 2 || d === 5 ? 'system' : 'demo-elderly-martha',
        recordedByName: d === 2 || d === 5 ? 'Reminder System' : 'Martha Sen',
        recordedByRole: d === 2 || d === 5 ? 'system' : 'elderly',
        notes: d === 2 || d === 5 ? 'Grace period expired' : '',
        recordedAt: `${dk}T21:05:00.000Z`,
      },
      {
        id: `log-ator-${d}`,
        medicationId: 'med-atorvastatin',
        medicationName: 'Atorvastatin',
        dosage: '10 mg (1 tablet)',
        dateKey: dk,
        scheduledTime: '21:30',
        status: 'taken',
        recordedByUid: 'demo-elderly-martha',
        recordedByName: 'Martha Sen',
        recordedByRole: 'elderly',
        notes: '',
        recordedAt: `${dk}T21:35:00.000Z`,
      }
    );
  }

  const appointments: Appointment[] = [
    {
      id: 'appt-cardio',
      doctorName: 'Dr. Kavita Rao',
      specialization: 'Cardiology',
      clinicName: 'Mercy Heart & Senior Wellness Clinic',
      dateTime: localOffsetHours(18),
      notes: 'Bring 7-day blood pressure notebook and medication list.',
      status: 'upcoming',
      reminderSent: false,
      createdBy: 'demo-family-rohan',
    },
    {
      id: 'appt-endo',
      doctorName: 'Dr. Arvind Mehta',
      specialization: 'Endocrinology',
      clinicName: 'Oakwood Medical Center, Suite 4B',
      dateTime: localOffsetHours(24 * 6),
      notes: 'Quarterly HbA1c lab follow-up.',
      status: 'upcoming',
      reminderSent: false,
      createdBy: 'demo-caregiver-sarah',
    },
    {
      id: 'appt-past',
      doctorName: 'Dr. Priya Deshmukh',
      specialization: 'Ophthalmology',
      clinicName: 'ClearView Eye Care',
      dateTime: localOffsetHours(-24 * 9),
      notes: 'Annual vision check completed; glasses prescription unchanged.',
      status: 'completed',
      reminderSent: true,
      createdBy: 'demo-elderly-martha',
    },
  ];

  const tasks: CareTask[] = [
    {
      id: 'task-1',
      title: 'Refill Metformin 500 mg prescription',
      notes: 'Pharmacy confirmed ready for pickup by Friday.',
      category: 'task',
      completed: false,
      completedBy: '',
      dueDate: dayOffset(2),
      createdBy: 'demo-family-rohan',
      createdByName: 'Rohan Sen',
      createdAt: isoOffsetHours(-18),
    },
    {
      id: 'task-2',
      title: 'Morning vitals & hydration check',
      notes: 'Blood pressure 124/78 mmHg. Drank 2 glasses of water and enjoyed breakfast.',
      category: 'care_log',
      completed: true,
      completedBy: 'Sarah Nair',
      dueDate: todayKey,
      createdBy: 'demo-caregiver-sarah',
      createdByName: 'Sarah Nair',
      createdAt: isoOffsetHours(-3),
    },
  ];

  const notifications: NotificationItem[] = [
    {
      id: 'notif-1',
      eventType: 'appointment_reminder',
      title: 'Upcoming Cardiology Visit',
      message: 'Dr. Kavita Rao appointment at Mercy Heart & Senior Wellness Clinic is coming up soon.',
      deliveryMode: 'simulated_demo',
      providerName: 'simulated',
      providerMessageId: '',
      emailTarget: 'martha.sen.demo@carecircle.local, rohan.sen.demo@carecircle.local',
      read: false,
      createdBy: 'demo-family-rohan',
      createdAt: isoOffsetHours(-4),
    },
    {
      id: 'notif-2',
      eventType: 'caregiver_update',
      title: 'Caregiver Morning Visit Logged',
      message: 'Sarah Nair recorded morning vitals and breakfast medication support.',
      deliveryMode: 'in_app',
      providerName: 'in_app',
      providerMessageId: '',
      emailTarget: '',
      read: true,
      createdBy: 'demo-caregiver-sarah',
      createdAt: isoOffsetHours(-3),
    },
  ];

  const activityLogs: ActivityLog[] = [
    {
      id: 'act-1',
      actorUid: 'demo-elderly-martha',
      actorName: 'Martha Sen',
      actorRole: 'elderly',
      action: 'Marked Dose Taken',
      targetName: 'Amlodipine 5 mg (08:00)',
      details: 'Recorded after oatmeal breakfast',
      createdAt: `${todayKey}T08:12:00.000Z`,
    },
    {
      id: 'act-2',
      actorUid: 'demo-caregiver-sarah',
      actorName: 'Sarah Nair',
      actorRole: 'caregiver',
      action: 'Logged Daily Care Note',
      targetName: 'Morning vitals & hydration check',
      details: 'BP 124/78 mmHg; routine steady',
      createdAt: isoOffsetHours(-3),
    },
    {
      id: 'act-3',
      actorUid: 'demo-family-rohan',
      actorName: 'Rohan Sen',
      actorRole: 'family',
      action: 'Scheduled Appointment',
      targetName: 'Dr. Kavita Rao (Cardiology)',
      details: 'Added note to bring BP notebook',
      createdAt: isoOffsetHours(-20),
    },
  ];

  return {
    profile,
    members,
    medications,
    logs,
    appointments,
    tasks,
    notifications,
    activityLogs,
    invitations: [
      {
        codeHash: 'a'.repeat(64),
        circleId: 'demo-circle-sen',
        elderlyName: 'Martha Sen',
        role: 'family',
        relation: 'Daughter (Priya)',
        canEditMedications: false,
        canManageAppointments: true,
        canLogDoses: true,
        canManageMembers: false,
        expiresAt: isoOffsetHours(36),
        usedAt: null,
        acceptedBy: null,
        acceptedByName: null,
        revokedAt: null,
        revokedBy: null,
        createdBy: 'demo-elderly-martha',
        createdByName: 'Martha Sen',
        createdAt: isoOffsetHours(-12),
      },
      {
        codeHash: 'demo-hash-sarah'.padEnd(64, '0'),
        circleId: 'demo-circle-sen',
        elderlyName: 'Martha Sen',
        role: 'caregiver',
        relation: 'Assigned Caregiver',
        canEditMedications: true,
        canManageAppointments: true,
        canLogDoses: true,
        canManageMembers: false,
        expiresAt: isoOffsetHours(-24 * 18),
        usedAt: isoOffsetHours(-24 * 20),
        acceptedBy: 'demo-caregiver-sarah',
        acceptedByName: 'Sarah Nair',
        revokedAt: null,
        revokedBy: null,
        createdBy: 'demo-elderly-martha',
        createdByName: 'Martha Sen',
        createdAt: isoOffsetHours(-24 * 21),
      },
    ],
  };
}

function buildHarishKapoorSeed(): DemoCircleSeedBundle {
  const now = new Date();
  const todayKey = formatDateKey(now);

  const dayOffset = (offset: number) => {
    const d = new Date(now);
    d.setDate(now.getDate() + offset);
    return formatDateKey(d);
  };

  const isoOffsetHours = (hours: number) => {
    return new Date(now.getTime() + hours * 3600 * 1000).toISOString();
  };

  const localOffsetHours = (hours: number) => {
    return toLocalDateTimeInputValue(new Date(now.getTime() + hours * 3600 * 1000));
  };

  const profile: CareCircleProfile = {
    id: 'demo-circle-kapoor',
    ownerId: 'demo-elderly-harish',
    elderlyName: 'Harish Kapoor',
    elderlyAge: 79,
    bloodGroup: 'B+',
    allergies: 'Sulfa drugs',
    careNotes: 'Recovering from right knee replacement; uses walker indoors and spacer with evening inhaler.',
    emergencyContactName: 'Meera Kapoor (Daughter)',
    emergencyContactPhone: '+1 (555) 619-4421',
    emergencyContactRelation: 'Daughter',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  };

  const members: CircleMember[] = [
    {
      uid: 'demo-elderly-harish',
      displayName: 'Harish Kapoor',
      role: 'elderly',
      relation: 'Self (CareCircle Owner)',
      notifyEmail: 'harish.kapoor.demo@carecircle.local',
      emailOptIn: true,
      canEditMedications: true,
      canManageAppointments: true,
      canLogDoses: true,
      canManageMembers: true,
      inviteCodeHash: '',
      avatarUrl: DEMO_AVATARS.table,
      joinedAt: isoOffsetHours(-24 * 18),
    },
    {
      uid: 'demo-family-meera',
      displayName: 'Meera Kapoor',
      role: 'family',
      relation: 'Daughter (Organizer)',
      notifyEmail: 'meera.kapoor.demo@carecircle.local',
      emailOptIn: true,
      canEditMedications: true,
      canManageAppointments: true,
      canLogDoses: true,
      canManageMembers: true,
      inviteCodeHash: 'demo-hash-meera',
      avatarUrl: DEMO_AVATARS.family,
      joinedAt: isoOffsetHours(-24 * 17),
    },
    {
      uid: 'demo-caregiver-david',
      displayName: 'David Chen',
      role: 'caregiver',
      relation: 'Rehab Care Aide',
      notifyEmail: 'david.chen.demo@carecircle.local',
      emailOptIn: true,
      canEditMedications: false,
      canManageAppointments: true,
      canLogDoses: true,
      canManageMembers: false,
      inviteCodeHash: 'demo-hash-david',
      avatarUrl: DEMO_AVATARS.caregiver,
      joinedAt: isoOffsetHours(-24 * 14),
    },
  ];

  const medications: Medication[] = [
    {
      id: 'med-hk-tiotropium',
      name: 'Tiotropium Inhaler',
      dosage: '18 mcg (1 inhalation)',
      frequency: 'once_daily',
      times: ['07:30'],
      startDate: dayOffset(-20),
      endDate: '',
      instructions: 'Rinse mouth gently after inhalation.',
      prescribingDoctor: 'Dr. Nina Patel',
      gracePeriodMinutes: 45,
      archived: false,
      createdBy: 'demo-elderly-harish',
    },
    {
      id: 'med-hk-apixaban',
      name: 'Apixaban',
      dosage: '2.5 mg (1 tablet)',
      frequency: 'twice_daily',
      times: ['09:00', '21:00'],
      startDate: dayOffset(-15),
      endDate: dayOffset(21),
      instructions: 'Post-surgery blood thinner; do not double doses.',
      prescribingDoctor: 'Dr. Vikram Malhotra',
      gracePeriodMinutes: 30,
      archived: false,
      createdBy: 'demo-family-meera',
    },
    {
      id: 'med-hk-calcium',
      name: 'Calcium + Vitamin D',
      dosage: '500 mg (1 tablet)',
      frequency: 'once_daily',
      times: ['13:30'],
      startDate: dayOffset(-20),
      endDate: '',
      instructions: 'Take after lunch with full glass of water.',
      prescribingDoctor: 'Dr. Vikram Malhotra',
      gracePeriodMinutes: 60,
      archived: false,
      createdBy: 'demo-elderly-harish',
    },
  ];

  const logs: MedicationLog[] = [
    {
      id: 'log-hk-today-inhaler',
      medicationId: 'med-hk-tiotropium',
      medicationName: 'Tiotropium Inhaler',
      dosage: '18 mcg (1 inhalation)',
      dateKey: todayKey,
      scheduledTime: '07:30',
      status: 'taken',
      recordedByUid: 'demo-caregiver-david',
      recordedByName: 'David Chen',
      recordedByRole: 'caregiver',
      notes: 'Breathing clear before morning PT stretch',
      recordedAt: `${todayKey}T07:40:00.000Z`,
    },
  ];

  for (let d = 1; d <= 6; d++) {
    const dk = dayOffset(-d);
    logs.push(
      {
        id: `log-hk-tio-${d}`,
        medicationId: 'med-hk-tiotropium',
        medicationName: 'Tiotropium Inhaler',
        dosage: '18 mcg (1 inhalation)',
        dateKey: dk,
        scheduledTime: '07:30',
        status: 'taken',
        recordedByUid: 'demo-elderly-harish',
        recordedByName: 'Harish Kapoor',
        recordedByRole: 'elderly',
        notes: '',
        recordedAt: `${dk}T07:38:00.000Z`,
      },
      {
        id: `log-hk-apix-am-${d}`,
        medicationId: 'med-hk-apixaban',
        medicationName: 'Apixaban',
        dosage: '2.5 mg (1 tablet)',
        dateKey: dk,
        scheduledTime: '09:00',
        status: d === 1 ? 'missed' : 'taken',
        recordedByUid: d === 1 ? 'system' : 'demo-caregiver-david',
        recordedByName: d === 1 ? 'Reminder System' : 'David Chen',
        recordedByRole: d === 1 ? 'system' : 'caregiver',
        notes: d === 1 ? 'Missed morning window before rehab session' : '',
        recordedAt: `${dk}T09:12:00.000Z`,
      },
      {
        id: `log-hk-apix-pm-${d}`,
        medicationId: 'med-hk-apixaban',
        medicationName: 'Apixaban',
        dosage: '2.5 mg (1 tablet)',
        dateKey: dk,
        scheduledTime: '21:00',
        status: d === 4 ? 'missed' : 'taken',
        recordedByUid: d === 4 ? 'system' : 'demo-family-meera',
        recordedByName: d === 4 ? 'Reminder System' : 'Meera Kapoor',
        recordedByRole: d === 4 ? 'system' : 'family',
        notes: d === 4 ? 'Grace period expired' : 'Confirmed by evening video call',
        recordedAt: `${dk}T21:14:00.000Z`,
      },
      {
        id: `log-hk-cal-${d}`,
        medicationId: 'med-hk-calcium',
        medicationName: 'Calcium + Vitamin D',
        dosage: '500 mg (1 tablet)',
        dateKey: dk,
        scheduledTime: '13:30',
        status: 'taken',
        recordedByUid: 'demo-elderly-harish',
        recordedByName: 'Harish Kapoor',
        recordedByRole: 'elderly',
        notes: '',
        recordedAt: `${dk}T13:45:00.000Z`,
      }
    );
  }

  const appointments: Appointment[] = [
    {
      id: 'appt-hk-ortho',
      doctorName: 'Dr. Vikram Malhotra',
      specialization: 'Orthopedic Surgery',
      clinicName: 'Northside Joint & Rehab Institute',
      dateTime: localOffsetHours(12),
      notes: 'Week-3 knee flexion evaluation and stitch check.',
      status: 'upcoming',
      reminderSent: false,
      createdBy: 'demo-family-meera',
    },
    {
      id: 'appt-hk-pulmo',
      doctorName: 'Dr. Nina Patel',
      specialization: 'Pulmonology',
      clinicName: 'Lakeside Respiratory Center',
      dateTime: localOffsetHours(24 * 4),
      notes: 'Bring peak-flow log and inhaler spacer.',
      status: 'upcoming',
      reminderSent: false,
      createdBy: 'demo-elderly-harish',
    },
  ];

  const tasks: CareTask[] = [
    {
      id: 'task-hk-1',
      title: 'Check knee swelling & ice pack after afternoon walk',
      notes: 'Mild stiffness reported after stairs yesterday; notify family if swelling increases.',
      category: 'assistance_alert',
      completed: false,
      completedBy: '',
      dueDate: todayKey,
      createdBy: 'demo-caregiver-david',
      createdByName: 'David Chen',
      createdAt: isoOffsetHours(-2),
    },
    {
      id: 'task-hk-2',
      title: 'Order walker rubber grip tips',
      notes: 'Replacement pair ordered for Friday delivery.',
      category: 'task',
      completed: false,
      completedBy: '',
      dueDate: dayOffset(1),
      createdBy: 'demo-family-meera',
      createdByName: 'Meera Kapoor',
      createdAt: isoOffsetHours(-10),
    },
  ];

  const notifications: NotificationItem[] = [
    {
      id: 'notif-hk-1',
      eventType: 'caregiver_update',
      title: 'Caregiver Assistance Alert: Knee Check Requested',
      message: 'David Chen noted mild knee stiffness after stair practice; monitor evening ice pack.',
      deliveryMode: 'simulated_demo',
      providerName: 'simulated',
      providerMessageId: '',
      emailTarget: 'harish.kapoor.demo@carecircle.local, meera.kapoor.demo@carecircle.local',
      read: false,
      createdBy: 'demo-caregiver-david',
      createdAt: isoOffsetHours(-2),
    },
    {
      id: 'notif-hk-2',
      eventType: 'appointment_reminder',
      title: 'Orthopedics Follow-Up Tomorrow',
      message: 'Dr. Vikram Malhotra appointment at Northside Joint & Rehab Institute within 24h.',
      deliveryMode: 'simulated_demo',
      providerName: 'simulated',
      providerMessageId: '',
      emailTarget: 'harish.kapoor.demo@carecircle.local, meera.kapoor.demo@carecircle.local',
      read: false,
      createdBy: 'demo-family-meera',
      createdAt: isoOffsetHours(-5),
    },
  ];

  const activityLogs: ActivityLog[] = [
    {
      id: 'act-hk-1',
      actorUid: 'demo-caregiver-david',
      actorName: 'David Chen',
      actorRole: 'caregiver',
      action: 'Sent Family Alert',
      targetName: 'Check knee swelling & ice pack after afternoon walk',
      details: 'Requested evening swelling check before dinner',
      createdAt: isoOffsetHours(-2),
    },
    {
      id: 'act-hk-2',
      actorUid: 'demo-caregiver-david',
      actorName: 'David Chen',
      actorRole: 'caregiver',
      action: 'Marked Dose Taken',
      targetName: 'Tiotropium Inhaler (07:30)',
      details: 'Breathing clear before morning PT stretch',
      createdAt: `${todayKey}T07:40:00.000Z`,
    },
    {
      id: 'act-hk-3',
      actorUid: 'demo-family-meera',
      actorName: 'Meera Kapoor',
      actorRole: 'family',
      action: 'Scheduled Appointment',
      targetName: 'Dr. Vikram Malhotra (Orthopedic Surgery)',
      details: 'Week-3 knee flexion evaluation',
      createdAt: isoOffsetHours(-16),
    },
  ];

  return {
    profile,
    members,
    medications,
    logs,
    appointments,
    tasks,
    notifications,
    activityLogs,
    invitations: [
      {
        codeHash: 'b'.repeat(64),
        circleId: 'demo-circle-kapoor',
        elderlyName: 'Harish Kapoor',
        role: 'caregiver',
        relation: 'Evening Nurse (Backup)',
        canEditMedications: false,
        canManageAppointments: true,
        canLogDoses: true,
        canManageMembers: false,
        expiresAt: isoOffsetHours(24),
        usedAt: null,
        acceptedBy: null,
        acceptedByName: null,
        revokedAt: null,
        revokedBy: null,
        createdBy: 'demo-family-meera',
        createdByName: 'Meera Kapoor',
        createdAt: isoOffsetHours(-6),
      },
    ],
  };
}

export function createDemoSeedData(circleId: DemoCircleId = 'demo-circle-sen'): DemoCircleSeedBundle {
  return circleId === 'demo-circle-kapoor' ? buildHarishKapoorSeed() : buildMarthaSenSeed();
}

export function createAllDemoSeeds(): Record<DemoCircleId, DemoCircleSeedBundle> {
  return {
    'demo-circle-sen': buildMarthaSenSeed(),
    'demo-circle-kapoor': buildHarishKapoorSeed(),
  };
}
