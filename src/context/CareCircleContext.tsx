import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  testFirestoreConnection,
} from '../lib/firebase';
import {
  createAllDemoSeeds,
  createDemoSeedData,
  DEMO_PROFILES,
  getDemoActor,
  type DemoCircleSeedBundle,
} from '../lib/demoSeed';
import { getTimestampMs, getTodayDateKey } from '../lib/scheduleUtils';
import type {
  ActivityLog,
  AppLanguage,
  AppPage,
  Appointment,
  CareCircleInvitation,
  CareCircleProfile,
  CareTask,
  CircleMember,
  DemoCircleId,
  DemoInvitationRecord,
  EmailProviderStatus,
  FontScale,
  Medication,
  MedicationLog,
  NotificationItem,
  ThemeMode,
  UserAccount,
  UserCircleIndex,
  UserPrivateInfo,
  UserRole,
} from '../types/carecircle';

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

interface Permissions {
  role: UserRole;
  isOwner: boolean;
  canEditMedications: boolean;
  canManageAppointments: boolean;
  canLogDoses: boolean;
  canManageMembers: boolean;
}

interface CareCircleContextValue {
  mode: 'none' | 'demo' | 'firebase';
  authReady: boolean;
  firebaseUser: FirebaseUser | null;
  currentPage: AppPage;
  setCurrentPage: (page: AppPage) => void;
  userAccount: UserAccount | null;
  userPrivate: UserPrivateInfo | null;
  userCircles: UserCircleIndex[];
  activeCircle: CareCircleProfile | null;
  members: CircleMember[];
  invitations: CareCircleInvitation[];
  medications: Medication[];
  medicationLogs: MedicationLog[];
  appointments: Appointment[];
  careTasks: CareTask[];
  notifications: NotificationItem[];
  activityLogs: ActivityLog[];
  permissions: Permissions;
  firestoreSynced: boolean;
  emailProviderStatus: EmailProviderStatus;
  refreshEmailStatus: () => Promise<void>;
  toasts: ToastMessage[];
  dismissToast: (id: string) => void;
  notifyToast: (type: ToastMessage['type'], text: string) => void;

  // Accessibility & UI Preferences
  language: AppLanguage;
  theme: ThemeMode;
  highContrast: boolean;
  fontScale: FontScale;
  voiceEnabled: boolean;
  updatePreferences: (patch: Partial<{
    language: AppLanguage;
    theme: ThemeMode;
    highContrast: boolean;
    fontScale: FontScale;
    voiceEnabled: boolean;
    displayName: string;
  }>) => Promise<void>;
  updateNotificationPrefs: (
    patch: Partial<{
      email: string;
      phone: string;
      notifyUpcomingDose: boolean;
      notifyMissedDose: boolean;
      notifyAppointment: boolean;
      notifyCaregiverUpdates: boolean;
      emailAlertsEnabled: boolean;
    }>,
    options?: { silent?: boolean }
  ) => Promise<void>;

  // Auth & Sandbox
  demoCircleId: DemoCircleId;
  signInWithGoogle: () => Promise<void>;
  enterDemoSandbox: (role?: UserRole, circleId?: DemoCircleId) => void;
  switchDemoRole: (role: UserRole) => void;
  switchDemoCircle: (circleId: DemoCircleId) => void;
  resetDemoSandbox: () => void;
  logout: () => Promise<void>;
  switchActiveCircle: (circleId: string) => Promise<void>;

  // Onboarding & CareCircle Profile
  createCareCircle: (input: {
    creatorRole?: UserRole;
    elderlyName: string;
    elderlyAge: number;
    bloodGroup: string;
    allergies: string;
    careNotes: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
    emergencyContactRelation: string;
    language: AppLanguage;
    highContrast: boolean;
    fontScale: FontScale;
  }) => Promise<void>;
  updateCareCircleProfile: (patch: Partial<CareCircleProfile>) => Promise<void>;

  // Invitations & Members
  createInvitation: (input: {
    role: UserRole;
    relation: string;
    canEditMedications: boolean;
    canManageAppointments: boolean;
    canLogDoses: boolean;
    canManageMembers?: boolean;
    expiresHours: number;
  }) => Promise<{ code: string; expiresAt: string }>;
  revokeInvitation: (codeHash: string) => Promise<void>;
  redeemInvitation: (code: string, displayName?: string) => Promise<void>;
  updateMemberPermissions: (
    memberUid: string,
    patch: Partial<Pick<CircleMember, 'canEditMedications' | 'canManageAppointments' | 'canLogDoses' | 'canManageMembers' | 'relation'>>
  ) => Promise<void>;
  removeMember: (memberUid: string) => Promise<void>;

  // Medications & Logs
  saveMedication: (input: Omit<Medication, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>, existingId?: string) => Promise<void>;
  archiveMedication: (medId: string, archived: boolean) => Promise<void>;
  deleteMedication: (medId: string) => Promise<void>;
  recordDose: (input: {
    medication: Medication;
    dateKey: string;
    scheduledTime: string;
    status: 'taken' | 'missed' | 'skipped';
    notes?: string;
  }) => Promise<void>;
  revertDoseLog: (medicationId: string, dateKey: string, scheduledTime: string) => Promise<void>;
  loadSampleSchedule: () => Promise<void>;

  // Appointments
  saveAppointment: (input: Omit<Appointment, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'reminderSent'>, existingId?: string) => Promise<void>;
  updateAppointmentStatus: (apptId: string, status: Appointment['status']) => Promise<void>;
  deleteAppointment: (apptId: string) => Promise<void>;

  // Care Tasks & Family Collaboration
  addCareTask: (input: { title: string; notes: string; category: CareTask['category']; dueDate: string }) => Promise<void>;
  toggleCareTask: (taskId: string) => Promise<void>;
  deleteCareTask: (taskId: string) => Promise<void>;

  // Notifications & Reminders
  sendTestNotification: (email: string) => Promise<{
    delivered: boolean;
    deliveryMode: NotificationItem['deliveryMode'];
    providerName: string;
    providerMessageId: string;
    note: string;
  }>;
  runReminderCheck: (options?: { silent?: boolean }) => Promise<{
    missedCount: number;
    upcomingCount: number;
    apptCount: number;
    deliveredEmails: number;
    simulatedEmails: number;
  }>;
  markNotificationRead: (notifId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
}

const CareCircleContext = createContext<CareCircleContextValue | null>(null);

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function clientSha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text.trim().toUpperCase().replace(/\s+/g, ''));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const CareCircleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<'none' | 'demo' | 'firebase'>('none');
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [currentPage, setCurrentPage] = useState<AppPage>('landing');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [emailProviderStatus, setEmailProviderStatus] = useState<EmailProviderStatus>({
    configured: false,
    provider: 'simulated_demo',
    requestedProvider: 'auto',
    fromEmail: 'Simulated Notification Mode (No Sender Configured)',
    schedulerConfigured: false,
    cronEndpoint: '/api/reminders/process',
    cronHeader: 'x-cron-secret',
    supportedProviders: ['resend', 'sendgrid', 'webhook'],
    missingRequirements: [],
  });

  // Accessibility & UI state (persisted locally + synced to Firestore when logged in)
  const [language, setLanguage] = useState<AppLanguage>('en');
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [highContrast, setHighContrast] = useState(false);
  const [fontScale, setFontScale] = useState<FontScale>('normal');
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  // Active account & CareCircle state
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [userPrivate, setUserPrivate] = useState<UserPrivateInfo | null>(null);
  const [userCircles, setUserCircles] = useState<UserCircleIndex[]>([]);
  const [activeCircle, setActiveCircle] = useState<CareCircleProfile | null>(null);
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [circleInvitations, setCircleInvitations] = useState<CareCircleInvitation[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [medicationLogs, setMedicationLogs] = useState<MedicationLog[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [careTasks, setCareTasks] = useState<CareTask[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [firestoreSynced, setFirestoreSynced] = useState(false);

  // Demo Sandbox persistent in-session multi-profile store
  const [demoRole, setDemoRole] = useState<UserRole>('elderly');
  const [demoCircleId, setDemoCircleId] = useState<DemoCircleId>('demo-circle-sen');
  const [demoInvitations, setDemoInvitations] = useState<DemoInvitationRecord[]>([]);
  const demoStoreRef = useRef<Record<DemoCircleId, DemoCircleSeedBundle>>(createAllDemoSeeds());

  const notifyToast = useCallback((type: ToastMessage['type'], text: string) => {
    const id = makeId('toast');
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Apply DOM classes for theme, high contrast, and font scale
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');

    if (highContrast) root.classList.add('high-contrast');
    else root.classList.remove('high-contrast');

    root.classList.remove('font-large', 'font-xlarge');
    if (fontScale === 'large') root.classList.add('font-large');
    if (fontScale === 'xlarge') root.classList.add('font-xlarge');
  }, [theme, highContrast, fontScale]);

  const refreshEmailStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/email/status');
      if (r.ok) {
        const data = (await r.json()) as EmailProviderStatus;
        if (data) setEmailProviderStatus(data);
      }
    } catch {
      // Non-fatal background check
    }
  }, []);

  // Fetch server email status + test Firestore connection on boot
  useEffect(() => {
    void testFirestoreConnection();
    void refreshEmailStatus();
  }, [refreshEmailStatus]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        setMode('firebase');
        try {
          const userRef = doc(db, 'users', fbUser.uid);
          const snap = await getDoc(userRef);
          if (!snap.exists()) {
            const newAccount: UserAccount = {
              uid: fbUser.uid,
              displayName: (fbUser.displayName || fbUser.email?.split('@')[0] || 'CareCircle Member').slice(0, 100),
              preferredRole: 'elderly',
              activeCircleId: '',
              language: 'en',
              theme: 'light',
              highContrast: false,
              fontScale: 'normal',
              voiceEnabled: true,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };
            await setDoc(userRef, newAccount);
          }

          const privRef = doc(db, 'users', fbUser.uid, 'private', 'info');
          const privSnap = await getDoc(privRef);
          if (!privSnap.exists()) {
            const newPriv: UserPrivateInfo = {
              uid: fbUser.uid,
              email: (fbUser.email || '').slice(0, 254),
              phone: '',
              notifyUpcomingDose: true,
              notifyMissedDose: true,
              notifyAppointment: true,
              notifyCaregiverUpdates: true,
              emailAlertsEnabled: true,
              updatedAt: serverTimestamp(),
            };
            await setDoc(privRef, newPriv);
          }
        } catch (err) {
          console.error('User profile bootstrap failed:', err);
        }
      } else {
        setMode((prev) => (prev === 'demo' ? 'demo' : 'none'));
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Listen to user doc, private doc, and user's CareCircles index when in firebase mode
  useEffect(() => {
    if (mode !== 'firebase' || !firebaseUser) return;
    const uid = firebaseUser.uid;

    const unsubUser = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as UserAccount;
          setUserAccount(data);
          setLanguage(data.language);
          setTheme(data.theme);
          setHighContrast(data.highContrast);
          setFontScale(data.fontScale);
          setVoiceEnabled(data.voiceEnabled);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users/${uid}`)
    );

    const unsubPriv = onSnapshot(
      doc(db, 'users', uid, 'private', 'info'),
      (snap) => {
        if (snap.exists()) {
          setUserPrivate(snap.data() as UserPrivateInfo);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users/${uid}/private/info`)
    );

    const unsubCircles = onSnapshot(
      collection(db, 'users', uid, 'circles'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as UserCircleIndex);
        setUserCircles(list);
        setCurrentPage((prev) => {
          if (prev === 'landing' || prev === 'auth') {
            return list.length === 0 ? 'onboarding' : 'dashboard';
          }
          return prev;
        });
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/circles`)
    );

    return () => {
      unsubUser();
      unsubPriv();
      unsubCircles();
    };
  }, [mode, firebaseUser]);

  // Resolve activeCircleId
  const activeCircleId = useMemo(() => {
    if (mode === 'demo') return activeCircle?.id || 'demo-circle-sen';
    if (mode !== 'firebase') return '';
    if (userAccount?.activeCircleId && userCircles.some((c) => c.circleId === userAccount.activeCircleId)) {
      return userAccount.activeCircleId;
    }
    return userCircles[0]?.circleId || '';
  }, [mode, activeCircle?.id, userAccount?.activeCircleId, userCircles]);

  // Listen to all subcollections of the active CareCircle in Firebase mode
  useEffect(() => {
    if (mode !== 'firebase' || !firebaseUser || !activeCircleId) {
      setFirestoreSynced(false);
      if (mode === 'firebase' && !activeCircleId) {
        setActiveCircle(null);
        setMembers([]);
        setMedications([]);
        setMedicationLogs([]);
        setAppointments([]);
        setCareTasks([]);
        setNotifications([]);
        setActivityLogs([]);
      }
      return;
    }

    const base = `careCircles/${activeCircleId}`;
    let revokedHandled = false;
    const syncedParts = new Set<string>();
    const markSyncedPart = (part: string) => {
      syncedParts.add(part);
      if (syncedParts.size >= 8) {
        setFirestoreSynced(true);
      }
    };
    setFirestoreSynced(false);

    const cleanupStaleCircleMembership = async () => {
      if (revokedHandled) return;
      revokedHandled = true;
      setFirestoreSynced(false);
      try {
        await deleteDoc(doc(db, 'users', firebaseUser.uid, 'circles', activeCircleId));
        await updateDoc(doc(db, 'users', firebaseUser.uid), {
          activeCircleId: '',
          updatedAt: serverTimestamp(),
        });
        notifyToast('error', 'Your access to this CareCircle was removed or is no longer active.');
      } catch {
        // Ignore secondary cleanup error
      }
    };

    const handleSubListenerError = (err: unknown, op: OperationType, path: string) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('permission') || msg.includes('Missing or insufficient permissions')) {
        void cleanupStaleCircleMembership();
      }
      handleFirestoreError(err, op, path);
    };

    const unsubCircle = onSnapshot(
      doc(db, 'careCircles', activeCircleId),
      (snap) => {
        if (!snap.exists()) {
          setActiveCircle(null);
          setFirestoreSynced(false);
          void cleanupStaleCircleMembership();
          return;
        }
        setActiveCircle(snap.data() as CareCircleProfile);
        markSyncedPart('circle');
      },
      (err) => handleSubListenerError(err, OperationType.GET, base)
    );

    const unsubMembers = onSnapshot(
      collection(db, base, 'members'),
      (snap) => {
        setMembers(snap.docs.map((d) => d.data() as CircleMember));
        markSyncedPart('members');
      },
      (err) => handleSubListenerError(err, OperationType.LIST, `${base}/members`)
    );

    const unsubMeds = onSnapshot(
      collection(db, base, 'medications'),
      (snap) => {
        setMedications(snap.docs.map((d) => d.data() as Medication));
        markSyncedPart('meds');
      },
      (err) => handleSubListenerError(err, OperationType.LIST, `${base}/medications`)
    );

    const unsubLogs = onSnapshot(
      collection(db, base, 'medicationLogs'),
      (snap) => {
        setMedicationLogs(snap.docs.map((d) => d.data() as MedicationLog));
        markSyncedPart('logs');
      },
      (err) => handleSubListenerError(err, OperationType.LIST, `${base}/medicationLogs`)
    );

    const unsubAppts = onSnapshot(
      collection(db, base, 'appointments'),
      (snap) => {
        setAppointments(snap.docs.map((d) => d.data() as Appointment));
        markSyncedPart('appts');
      },
      (err) => handleSubListenerError(err, OperationType.LIST, `${base}/appointments`)
    );

    const unsubTasks = onSnapshot(
      collection(db, base, 'careTasks'),
      (snap) => {
        setCareTasks(
          snap.docs
            .map((d) => d.data() as CareTask)
            .sort((a, b) => getTimestampMs(b.createdAt) - getTimestampMs(a.createdAt))
        );
        markSyncedPart('tasks');
      },
      (err) => handleSubListenerError(err, OperationType.LIST, `${base}/careTasks`)
    );

    const unsubNotifs = onSnapshot(
      collection(db, base, 'notifications'),
      (snap) => {
        setNotifications(
          snap.docs
            .map((d) => d.data() as NotificationItem)
            .sort((a, b) => getTimestampMs(b.createdAt) - getTimestampMs(a.createdAt))
        );
        markSyncedPart('notifs');
      },
      (err) => handleSubListenerError(err, OperationType.LIST, `${base}/notifications`)
    );

    const unsubActivity = onSnapshot(
      collection(db, base, 'activityLogs'),
      (snap) => {
        setActivityLogs(
          snap.docs
            .map((d) => d.data() as ActivityLog)
            .sort((a, b) => getTimestampMs(b.createdAt) - getTimestampMs(a.createdAt))
        );
        markSyncedPart('activity');
      },
      (err) => handleSubListenerError(err, OperationType.LIST, `${base}/activityLogs`)
    );

    return () => {
      unsubCircle();
      unsubMembers();
      unsubMeds();
      unsubLogs();
      unsubAppts();
      unsubTasks();
      unsubNotifs();
      unsubActivity();
    };
  }, [mode, firebaseUser, activeCircleId, notifyToast]);

  // Demo Sandbox bootstrap & multi-profile helpers
  const applyDemoBundleAndActor = useCallback(
    (
      circleId: DemoCircleId,
      role: UserRole,
      bundle: DemoCircleSeedBundle | null
    ) => {
      const demoActor = getDemoActor(circleId, role);
      setDemoCircleId(circleId);
      setDemoRole(role);
      setUserAccount({
        uid: demoActor.uid,
        displayName: demoActor.displayName,
        preferredRole: role,
        activeCircleId: circleId,
        language: 'en',
        theme: 'light',
        highContrast: false,
        fontScale: role === 'elderly' ? 'large' : 'normal',
        voiceEnabled: true,
      });
      setUserPrivate({
        uid: demoActor.uid,
        email: demoActor.email,
        phone: demoActor.phone,
        notifyUpcomingDose: true,
        notifyMissedDose: true,
        notifyAppointment: true,
        notifyCaregiverUpdates: true,
        emailAlertsEnabled: true,
      });
      setUserCircles([
        { circleId: 'demo-circle-sen', elderlyName: DEMO_PROFILES['demo-circle-sen'].label, role },
        { circleId: 'demo-circle-kapoor', elderlyName: DEMO_PROFILES['demo-circle-kapoor'].label, role },
      ]);

      if (bundle) {
        setActiveCircle(bundle.profile);
        setMembers(bundle.members);
        setMedications(bundle.medications);
        setMedicationLogs(bundle.logs);
        setAppointments(bundle.appointments);
        setCareTasks(bundle.tasks);
        setNotifications(bundle.notifications);
        setActivityLogs(bundle.activityLogs);
        setDemoInvitations(bundle.invitations);
      }
    },
    []
  );

  const enterDemoSandbox = useCallback(
    (role: UserRole = 'elderly', circleId: DemoCircleId = 'demo-circle-sen') => {
      const freshSeeds = createAllDemoSeeds();
      demoStoreRef.current = freshSeeds;
      setMode('demo');
      applyDemoBundleAndActor(circleId, role, freshSeeds[circleId]);
      setLanguage('en');
      setTheme('light');
      setHighContrast(false);
      setFontScale(role === 'elderly' ? 'large' : 'normal');
      setVoiceEnabled(true);
      setCurrentPage('dashboard');
      const actor = getDemoActor(circleId, role);
      notifyToast(
        'info',
        `Entered Demo Sandbox as ${actor.displayName} (${role}) · ${DEMO_PROFILES[circleId].label}'s CareCircle.`
      );
    },
    [applyDemoBundleAndActor, notifyToast]
  );

  const switchDemoRole = useCallback(
    (role: UserRole) => {
      if (mode !== 'demo') return;
      applyDemoBundleAndActor(demoCircleId, role, null);
      setFontScale(role === 'elderly' ? 'large' : 'normal');
      setCurrentPage('dashboard');
      const actor = getDemoActor(demoCircleId, role);
      notifyToast('info', `Switched Demo Persona to ${actor.displayName} (${role}).`);
    },
    [mode, demoCircleId, applyDemoBundleAndActor, notifyToast]
  );

  const switchDemoCircle = useCallback(
    (nextCircleId: DemoCircleId) => {
      if (mode !== 'demo' || nextCircleId === demoCircleId) return;
      if (activeCircle) {
        demoStoreRef.current[demoCircleId] = {
          profile: activeCircle,
          members,
          medications,
          logs: medicationLogs,
          appointments,
          tasks: careTasks,
          notifications,
          activityLogs,
          invitations: demoInvitations,
        };
      }
      const nextBundle = demoStoreRef.current[nextCircleId] || createDemoSeedData(nextCircleId);
      demoStoreRef.current[nextCircleId] = nextBundle;
      applyDemoBundleAndActor(nextCircleId, demoRole, nextBundle);
      notifyToast(
        'info',
        `Switched Demo Profile to ${DEMO_PROFILES[nextCircleId].label} (Age ${DEMO_PROFILES[nextCircleId].age}).`
      );
    },
    [
      mode,
      demoCircleId,
      activeCircle,
      members,
      medications,
      medicationLogs,
      appointments,
      careTasks,
      notifications,
      activityLogs,
      demoInvitations,
      demoRole,
      applyDemoBundleAndActor,
      notifyToast,
    ]
  );

  const resetDemoSandbox = useCallback(() => {
    if (mode !== 'demo') return;
    const freshSeeds = createAllDemoSeeds();
    demoStoreRef.current = freshSeeds;
    applyDemoBundleAndActor(demoCircleId, demoRole, freshSeeds[demoCircleId]);
    setLanguage('en');
    setTheme('light');
    setHighContrast(false);
    setFontScale(demoRole === 'elderly' ? 'large' : 'normal');
    setVoiceEnabled(true);
    notifyToast('success', 'Demo Sandbox reset to fresh sample data for all elderly profiles.');
  }, [mode, demoCircleId, demoRole, applyDemoBundleAndActor, notifyToast]);

  const signInWithGoogle = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      notifyToast('success', 'Signed in with Google.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google Sign-In failed.';
      notifyToast('error', msg);
    }
  }, [notifyToast]);

  const logout = useCallback(async () => {
    if (mode === 'firebase') {
      await signOut(auth);
    }
    setMode('none');
    setUserAccount(null);
    setUserPrivate(null);
    setUserCircles([]);
    setActiveCircle(null);
    setMembers([]);
    setMedications([]);
    setMedicationLogs([]);
    setAppointments([]);
    setCareTasks([]);
    setNotifications([]);
    setActivityLogs([]);
    setCurrentPage('landing');
    notifyToast('info', 'Signed out safely.');
  }, [mode, notifyToast]);

  // Compute current permissions
  const demoActor = useMemo(() => getDemoActor(demoCircleId, demoRole), [demoCircleId, demoRole]);
  const currentUid = mode === 'demo' ? demoActor.uid : firebaseUser?.uid || '';
  const activeMember = useMemo(
    () => members.find((m) => m.uid === currentUid) || null,
    [members, currentUid]
  );

  const permissions: Permissions = useMemo(() => {
    if (mode === 'demo') {
      const m = members.find((mem) => mem.uid === demoActor.uid);
      const isOwner = demoRole === 'elderly';
      return {
        role: demoRole,
        isOwner,
        canEditMedications: isOwner || Boolean(m?.canEditMedications),
        canManageAppointments: isOwner || Boolean(m?.canManageAppointments),
        canLogDoses: isOwner || Boolean(m?.canLogDoses),
        canManageMembers: isOwner || Boolean(m?.canManageMembers),
      };
    }
    const isOwner = Boolean(activeCircle && activeCircle.ownerId === currentUid);
    const indexRole = userCircles.find((c) => c.circleId === activeCircleId)?.role;
    const role: UserRole = activeMember?.role || indexRole || (isOwner ? 'elderly' : 'family');
    return {
      role,
      isOwner,
      canEditMedications: isOwner || Boolean(activeMember?.canEditMedications),
      canManageAppointments: isOwner || Boolean(activeMember?.canManageAppointments),
      canLogDoses: isOwner || Boolean(activeMember?.canLogDoses),
      canManageMembers: isOwner || Boolean(activeMember?.canManageMembers),
    };
  }, [mode, demoActor.uid, demoRole, members, activeCircle, currentUid, activeMember, userCircles, activeCircleId]);

  // Listen to circle-scoped invitations metadata strictly when user is Owner or Organizer
  useEffect(() => {
    if (mode !== 'firebase' || !firebaseUser || !activeCircleId || !permissions.canManageMembers) {
      setCircleInvitations([]);
      return;
    }

    const path = `careCircles/${activeCircleId}/invitations`;
    const unsubInvites = onSnapshot(
      query(
        collection(db, 'careCircles', activeCircleId, 'invitations'),
        where('circleId', '==', activeCircleId)
      ),
      (snap) => {
        setCircleInvitations(
          snap.docs
            .map((d) => d.data() as CareCircleInvitation)
            .sort((a, b) => getTimestampMs(b.createdAt) - getTimestampMs(a.createdAt))
        );
      },
      (err) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes('permission')) {
          handleFirestoreError(err, OperationType.LIST, path);
        }
      }
    );

    return () => unsubInvites();
  }, [mode, firebaseUser, activeCircleId, permissions.canManageMembers]);

  const invitations = mode === 'demo' ? demoInvitations : circleInvitations;

  // Helper to record CareCircle Activity Log
  const logActivity = useCallback(
    async (action: string, targetName: string, details: string) => {
      const actorName = userAccount?.displayName || 'User';
      const actorRole = permissions.role;
      const id = makeId('act');

      if (mode === 'demo') {
        setActivityLogs((prev) => [
          {
            id,
            actorUid: currentUid,
            actorName,
            actorRole,
            action,
            targetName,
            details,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
        return;
      }

      if (mode === 'firebase' && activeCircleId && currentUid) {
        const path = `careCircles/${activeCircleId}/activityLogs/${id}`;
        try {
          await setDoc(doc(db, 'careCircles', activeCircleId, 'activityLogs', id), {
            id,
            actorUid: currentUid,
            actorName: actorName.slice(0, 100),
            actorRole,
            action: action.slice(0, 80),
            targetName: targetName.slice(0, 160),
            details: details.slice(0, 400),
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      }
    },
    [mode, activeCircleId, currentUid, userAccount?.displayName, permissions.role]
  );

  // Update Preferences
  const updatePreferences = useCallback(
    async (
      patch: Partial<{
        language: AppLanguage;
        theme: ThemeMode;
        highContrast: boolean;
        fontScale: FontScale;
        voiceEnabled: boolean;
        displayName: string;
      }>
    ) => {
      const sanitizedPatch = { ...patch };
      if (sanitizedPatch.displayName !== undefined) {
        const trimmedName = sanitizedPatch.displayName.trim().slice(0, 100);
        if (!trimmedName) {
          throw new Error('Display name cannot be empty.');
        }
        sanitizedPatch.displayName = trimmedName;
      }

      if (sanitizedPatch.language !== undefined) setLanguage(sanitizedPatch.language);
      if (sanitizedPatch.theme !== undefined) setTheme(sanitizedPatch.theme);
      if (sanitizedPatch.highContrast !== undefined) setHighContrast(sanitizedPatch.highContrast);
      if (sanitizedPatch.fontScale !== undefined) setFontScale(sanitizedPatch.fontScale);
      if (sanitizedPatch.voiceEnabled !== undefined) setVoiceEnabled(sanitizedPatch.voiceEnabled);

      if (mode === 'demo') {
        setUserAccount((prev) => (prev ? { ...prev, ...sanitizedPatch } : prev));
        return;
      }
      if (mode === 'firebase' && firebaseUser) {
        const path = `users/${firebaseUser.uid}`;
        try {
          await updateDoc(doc(db, 'users', firebaseUser.uid), {
            ...sanitizedPatch,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      }
    },
    [mode, firebaseUser]
  );

  const updateNotificationPrefs = useCallback(
    async (
      patch: Partial<{
        email: string;
        phone: string;
        notifyUpcomingDose: boolean;
        notifyMissedDose: boolean;
        notifyAppointment: boolean;
        notifyCaregiverUpdates: boolean;
        emailAlertsEnabled: boolean;
      }>,
      options?: { silent?: boolean }
    ) => {
      const sanitizedPatch = { ...patch };
      if (sanitizedPatch.email !== undefined) {
        sanitizedPatch.email = sanitizedPatch.email.trim().slice(0, 254);
      }
      if (sanitizedPatch.phone !== undefined) {
        sanitizedPatch.phone = sanitizedPatch.phone.trim().slice(0, 32);
      }

      if (mode === 'demo') {
        setUserPrivate((prev) => (prev ? { ...prev, ...sanitizedPatch } : prev));
        if (sanitizedPatch.email !== undefined || sanitizedPatch.emailAlertsEnabled !== undefined) {
          setMembers((prev) =>
            prev.map((m) =>
              m.uid === currentUid
                ? {
                    ...m,
                    notifyEmail: sanitizedPatch.email !== undefined ? sanitizedPatch.email : m.notifyEmail,
                    emailOptIn:
                      sanitizedPatch.emailAlertsEnabled !== undefined
                        ? sanitizedPatch.emailAlertsEnabled
                        : m.emailOptIn,
                  }
                : m
            )
          );
        }
        if (!options?.silent) {
          notifyToast('success', 'Notification preferences saved.');
        }
        return;
      }
      if (mode === 'firebase' && firebaseUser) {
        const path = `users/${firebaseUser.uid}/private/info`;
        try {
          await updateDoc(doc(db, 'users', firebaseUser.uid, 'private', 'info'), {
            ...sanitizedPatch,
            updatedAt: serverTimestamp(),
          });
          if (
            activeCircleId &&
            activeMember &&
            (sanitizedPatch.email !== undefined || sanitizedPatch.emailAlertsEnabled !== undefined)
          ) {
            const memberUpdate: Record<string, unknown> = { updatedAt: serverTimestamp() };
            if (sanitizedPatch.email !== undefined) memberUpdate.notifyEmail = sanitizedPatch.email;
            if (sanitizedPatch.emailAlertsEnabled !== undefined) {
              memberUpdate.emailOptIn = sanitizedPatch.emailAlertsEnabled;
            }
            await updateDoc(doc(db, 'careCircles', activeCircleId, 'members', firebaseUser.uid), memberUpdate);
          }
          if (!options?.silent) {
            notifyToast('success', 'Notification preferences saved.');
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      }
    },
    [mode, firebaseUser, currentUid, activeCircleId, activeMember, notifyToast]
  );

  const switchActiveCircle = useCallback(
    async (circleId: string) => {
      if (mode === 'demo') {
        if (circleId === 'demo-circle-sen' || circleId === 'demo-circle-kapoor') {
          switchDemoCircle(circleId);
        }
        return;
      }
      if (mode !== 'firebase' || !firebaseUser) return;
      try {
        await updateDoc(doc(db, 'users', firebaseUser.uid), {
          activeCircleId: circleId,
          updatedAt: serverTimestamp(),
        });
        notifyToast('info', 'Switched CareCircle.');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${firebaseUser.uid}`);
      }
    },
    [mode, firebaseUser, switchDemoCircle, notifyToast]
  );

  // Onboarding: Create Elderly CareCircle atomically
  const createCareCircle = useCallback(
    async (input: {
      creatorRole?: UserRole;
      elderlyName: string;
      elderlyAge: number;
      bloodGroup: string;
      allergies: string;
      careNotes: string;
      emergencyContactName: string;
      emergencyContactPhone: string;
      emergencyContactRelation: string;
      language: AppLanguage;
      highContrast: boolean;
      fontScale: FontScale;
    }) => {
      if (mode === 'demo') {
        setActiveCircle((prev) =>
          prev
            ? {
                ...prev,
                elderlyName: input.elderlyName,
                elderlyAge: input.elderlyAge,
                bloodGroup: input.bloodGroup,
                allergies: input.allergies,
                careNotes: input.careNotes,
                emergencyContactName: input.emergencyContactName,
                emergencyContactPhone: input.emergencyContactPhone,
                emergencyContactRelation: input.emergencyContactRelation,
              }
            : null
        );
        await updatePreferences({
          language: input.language,
          highContrast: input.highContrast,
          fontScale: input.fontScale,
          displayName: input.elderlyName,
        });
        setCurrentPage('dashboard');
        notifyToast('success', 'CareCircle profile updated.');
        return;
      }

      if (mode !== 'firebase' || !firebaseUser) return;
      const circleId = makeId('circle');
      const uid = firebaseUser.uid;
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const creatorRole: UserRole = input.creatorRole || 'elderly';
      const creatorDisplayName = (
        creatorRole === 'elderly'
          ? input.elderlyName
          : userAccount?.displayName || firebaseUser.displayName || input.elderlyName
      )
        .trim()
        .slice(0, 100);
      const creatorRelation =
        creatorRole === 'elderly'
          ? 'Self (CareCircle Owner)'
          : creatorRole === 'caregiver'
          ? 'Primary Caregiver Organizer'
          : 'Family Organizer';

      try {
        const batch = writeBatch(db);
        batch.set(doc(db, 'careCircles', circleId), {
          id: circleId,
          ownerId: uid,
          elderlyName: input.elderlyName.trim().slice(0, 100),
          elderlyAge: Math.min(Math.max(Math.trunc(input.elderlyAge), 1), 130),
          bloodGroup: input.bloodGroup.trim().slice(0, 16),
          allergies: input.allergies.trim().slice(0, 500),
          careNotes: input.careNotes.trim().slice(0, 1000),
          emergencyContactName: input.emergencyContactName.trim().slice(0, 100),
          emergencyContactPhone: input.emergencyContactPhone.trim().slice(0, 32),
          emergencyContactRelation: input.emergencyContactRelation.trim().slice(0, 64),
          timezone: tz.slice(0, 64),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        batch.set(doc(db, 'careCircles', circleId, 'members', uid), {
          uid,
          displayName: creatorDisplayName,
          role: creatorRole,
          relation: creatorRelation,
          notifyEmail: (firebaseUser.email || '').slice(0, 254),
          emailOptIn: true,
          canEditMedications: true,
          canManageAppointments: true,
          canLogDoses: true,
          canManageMembers: true,
          inviteCodeHash: '',
          joinedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        batch.set(doc(db, 'users', uid, 'circles', circleId), {
          circleId,
          elderlyName: input.elderlyName.trim().slice(0, 100),
          role: creatorRole,
          joinedAt: serverTimestamp(),
        });

        batch.update(doc(db, 'users', uid), {
          displayName: creatorDisplayName,
          preferredRole: creatorRole,
          activeCircleId: circleId,
          language: input.language,
          highContrast: input.highContrast,
          fontScale: input.fontScale,
          updatedAt: serverTimestamp(),
        });

        await batch.commit();
        setCurrentPage('dashboard');
        notifyToast('success', 'Your CareCircle has been created.');
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `careCircles/${circleId}`);
      }
    },
    [mode, firebaseUser, userAccount?.displayName, updatePreferences, notifyToast]
  );

  const updateCareCircleProfile = useCallback(
    async (patch: Partial<CareCircleProfile>) => {
      if (!activeCircle) return;
      if (mode === 'demo') {
        setActiveCircle((prev) => (prev ? { ...prev, ...patch } : prev));
        await logActivity('Updated Profile', activeCircle.elderlyName, 'Modified CareCircle profile details');
        notifyToast('success', 'CareCircle profile updated.');
        return;
      }
      if (mode === 'firebase' && activeCircleId) {
        const path = `careCircles/${activeCircleId}`;
        try {
          const cleanPatch: Partial<CareCircleProfile> = { ...patch };
          if (cleanPatch.elderlyName !== undefined) {
            cleanPatch.elderlyName = cleanPatch.elderlyName.trim().slice(0, 100);
          }
          if (cleanPatch.elderlyAge !== undefined) {
            cleanPatch.elderlyAge = Math.min(Math.max(Math.trunc(cleanPatch.elderlyAge), 1), 130);
          }
          await updateDoc(doc(db, 'careCircles', activeCircleId), {
            ...cleanPatch,
            updatedAt: serverTimestamp(),
          });
          if (cleanPatch.elderlyName && currentUid) {
            await updateDoc(doc(db, 'users', currentUid, 'circles', activeCircleId), {
              elderlyName: cleanPatch.elderlyName,
            });
          }
          await logActivity('Updated Profile', cleanPatch.elderlyName || activeCircle.elderlyName, 'Modified CareCircle profile details');
          notifyToast('success', 'CareCircle profile updated.');
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      }
    },
    [activeCircle, mode, activeCircleId, currentUid, logActivity, notifyToast]
  );

  // Create Hashed Invitation via Backend
  const createInvitation = useCallback(
    async (input: {
      role: UserRole;
      relation: string;
      canEditMedications: boolean;
      canManageAppointments: boolean;
      canLogDoses: boolean;
      canManageMembers?: boolean;
      expiresHours: number;
    }): Promise<{ code: string; expiresAt: string }> => {
      if (!permissions.canManageMembers) {
        throw new Error('Only the CareCircle owner or an authorized organizer can generate invitations.');
      }
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (mode === 'firebase' && firebaseUser) {
        headers.Authorization = `Bearer ${await firebaseUser.getIdToken()}`;
      }

      const res = await fetch('/api/invitations/create', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          circleId: activeCircleId,
          elderlyName: activeCircle?.elderlyName || 'CareCircle',
          ...input,
          demoMode: mode === 'demo',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to generate invitation');

      if (mode === 'demo') {
        const creatorName = userAccount?.displayName || 'Organizer';
        setDemoInvitations((prev) => [
          {
            codeHash: json.codeHash,
            circleId: activeCircleId,
            elderlyName: activeCircle?.elderlyName || DEMO_PROFILES[demoCircleId].label,
            role: input.role,
            relation: json.relation || input.relation,
            canEditMedications: Boolean(json.canEditMedications ?? input.canEditMedications),
            canManageAppointments: Boolean(json.canManageAppointments ?? input.canManageAppointments),
            canLogDoses: Boolean(json.canLogDoses ?? input.canLogDoses),
            canManageMembers: Boolean(json.canManageMembers ?? input.canManageMembers),
            expiresAt: json.expiresAt,
            usedAt: null,
            acceptedBy: null,
            acceptedByName: null,
            revokedAt: null,
            revokedBy: null,
            createdBy: currentUid,
            createdByName: creatorName,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
        await logActivity(
          'Created CareCircle Invitation',
          `${input.role} (${input.relation})`,
          `Expires in ${input.expiresHours}h`
        );
      }

      notifyToast('success', 'Single-use invitation passcode generated.');
      return { code: json.code, expiresAt: json.expiresAt };
    },
    [
      permissions.canManageMembers,
      mode,
      firebaseUser,
      activeCircleId,
      activeCircle?.elderlyName,
      userAccount?.displayName,
      currentUid,
      logActivity,
      notifyToast,
    ]
  );

  // Revoke Pending Invitation
  const revokeInvitation = useCallback(
    async (codeHash: string) => {
      if (!permissions.canManageMembers) {
        notifyToast('error', 'Only the CareCircle owner or an organizer can revoke invitations.');
        return;
      }

      if (mode === 'demo') {
        const target = demoInvitations.find((inv) => inv.codeHash === codeHash);
        if (!target || target.usedAt || target.revokedAt) return;
        setDemoInvitations((prev) =>
          prev.map((inv) =>
            inv.codeHash === codeHash
              ? { ...inv, revokedAt: new Date().toISOString(), revokedBy: currentUid }
              : inv
          )
        );
        await logActivity(
          'Revoked CareCircle Invitation',
          `${target.role} (${target.relation || 'Member'})`,
          'Pending passcode cancelled'
        );
        notifyToast('info', 'Invitation passcode revoked.');
        return;
      }

      if (mode !== 'firebase' || !firebaseUser || !activeCircleId) return;
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch('/api/invitations/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          circleId: activeCircleId,
          codeHash,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to revoke invitation.');
      notifyToast('info', 'Invitation passcode revoked.');
    },
    [permissions.canManageMembers, mode, demoInvitations, currentUid, firebaseUser, activeCircleId, logActivity, notifyToast]
  );

  const redeemInvitation = useCallback(
    async (code: string, displayName?: string) => {
      if (mode === 'demo') {
        const hash = await clientSha256(code);
        const found = demoInvitations.find((inv) => inv.codeHash === hash);
        if (!found) throw new Error('Invitation code is invalid in this Demo Sandbox session.');
        if (found.revokedAt) throw new Error('This invitation code has been revoked by the CareCircle organizer.');
        if (found.usedAt) throw new Error('This invitation code has already been used.');
        if (new Date(String(found.expiresAt)).getTime() <= Date.now()) {
          throw new Error('This invitation code has expired.');
        }

        const newMemberUid = makeId(`demo-${found.role}`);
        const newName = (displayName || `New ${found.role}`).trim();
        setDemoInvitations((prev) =>
          prev.map((inv) =>
            inv.codeHash === hash
              ? {
                  ...inv,
                  usedAt: new Date().toISOString(),
                  acceptedBy: newMemberUid,
                  acceptedByName: newName,
                }
              : inv
          )
        );
        setMembers((prev) => [
          ...prev,
          {
            uid: newMemberUid,
            displayName: newName,
            role: found.role,
            relation: found.relation || found.role,
            notifyEmail: `${newName.toLowerCase().replace(/\s+/g, '.')}@carecircle.local`,
            canEditMedications: found.canEditMedications,
            canManageAppointments: found.canManageAppointments,
            canLogDoses: found.canLogDoses,
            canManageMembers: Boolean(found.canManageMembers),
            inviteCodeHash: hash,
            joinedAt: new Date().toISOString(),
          },
        ]);
        await logActivity('Joined via Invite', newName, `Accepted single-use ${found.role} invitation`);
        notifyToast('success', `${newName} joined the CareCircle!`);
        return;
      }

      if (mode !== 'firebase' || !firebaseUser) {
        throw new Error('Please sign in with Google first.');
      }

      const idToken = await firebaseUser.getIdToken();
      const res = await fetch('/api/invitations/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ code, displayName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not redeem invitation code.');

      try {
        await updateDoc(doc(db, 'users', firebaseUser.uid), {
          activeCircleId: json.circleId,
          preferredRole: json.role,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${firebaseUser.uid}`);
      }
      setCurrentPage('dashboard');
      notifyToast('success', `Joined ${json.elderlyName}'s CareCircle as ${json.role}!`);
    },
    [mode, demoInvitations, firebaseUser, logActivity, notifyToast]
  );

  const updateMemberPermissions = useCallback(
    async (
      memberUid: string,
      patch: Partial<
        Pick<
          CircleMember,
          'canEditMedications' | 'canManageAppointments' | 'canLogDoses' | 'canManageMembers' | 'relation'
        >
      >
    ) => {
      if (!permissions.canManageMembers) {
        notifyToast('error', 'Only the CareCircle owner or organizer can modify member permissions.');
        return;
      }
      if (patch.canManageMembers !== undefined && !permissions.isOwner) {
        notifyToast('error', 'Only the CareCircle owner can delegate organizer status.');
        return;
      }
      const targetMember = members.find((m) => m.uid === memberUid);
      if (activeCircle?.ownerId === memberUid && !permissions.isOwner) {
        notifyToast('error', 'Cannot modify CareCircle owner permissions.');
        return;
      }
      if (mode === 'demo') {
        setMembers((prev) => prev.map((m) => (m.uid === memberUid ? { ...m, ...patch } : m)));
        await logActivity(
          'Updated Permissions',
          targetMember?.displayName || memberUid,
          'Adjusted CareCircle member permissions'
        );
        notifyToast('success', 'Member permissions updated.');
        return;
      }
      if (mode === 'firebase' && activeCircleId) {
        const path = `careCircles/${activeCircleId}/members/${memberUid}`;
        try {
          await updateDoc(doc(db, 'careCircles', activeCircleId, 'members', memberUid), {
            ...patch,
            updatedAt: serverTimestamp(),
          });
          await logActivity(
            'Updated Permissions',
            targetMember?.displayName || memberUid,
            'Adjusted CareCircle member permissions'
          );
          notifyToast('success', 'Member permissions updated.');
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      }
    },
    [permissions.canManageMembers, permissions.isOwner, members, activeCircle?.ownerId, mode, activeCircleId, logActivity, notifyToast]
  );

  const removeMember = useCallback(
    async (memberUid: string) => {
      if (!permissions.canManageMembers) {
        notifyToast('error', 'Only the CareCircle owner or organizer can remove members.');
        return;
      }
      if (activeCircle?.ownerId === memberUid || memberUid === currentUid) {
        notifyToast('error', 'The CareCircle owner cannot be removed.');
        return;
      }
      const target = members.find((m) => m.uid === memberUid);
      if (mode === 'demo') {
        setMembers((prev) => prev.filter((m) => m.uid !== memberUid));
        await logActivity('Removed Member', target?.displayName || memberUid, 'Revoked CareCircle access');
        notifyToast('info', 'Member removed from CareCircle.');
        return;
      }
      if (mode === 'firebase' && activeCircleId) {
        const path = `careCircles/${activeCircleId}/members/${memberUid}`;
        try {
          await deleteDoc(doc(db, 'careCircles', activeCircleId, 'members', memberUid));
          await logActivity('Removed Member', target?.displayName || memberUid, 'Revoked CareCircle access');
          notifyToast('info', 'Member removed from CareCircle.');
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, path);
        }
      }
    },
    [permissions.canManageMembers, activeCircle?.ownerId, currentUid, mode, members, activeCircleId, logActivity, notifyToast]
  );

  // Medications CRUD
  const saveMedication = useCallback(
    async (
      input: Omit<Medication, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>,
      existingId?: string
    ) => {
      if (!permissions.canEditMedications) {
        notifyToast('error', 'Your role does not have permission to edit medications.');
        return;
      }
      const medId = existingId || makeId('med');
      const cleanPayload = {
        id: medId,
        name: input.name.trim().slice(0, 120),
        dosage: input.dosage.trim().slice(0, 80),
        frequency: input.frequency,
        times: input.times.slice(0, 8),
        startDate: input.startDate.slice(0, 20),
        endDate: (input.endDate || '').slice(0, 20),
        instructions: (input.instructions || '').trim().slice(0, 400),
        prescribingDoctor: (input.prescribingDoctor || '').trim().slice(0, 120),
        gracePeriodMinutes: Math.min(Math.max(Math.trunc(input.gracePeriodMinutes || 60), 5), 720),
        archived: Boolean(input.archived),
      };

      if (mode === 'demo') {
        if (existingId) {
          setMedications((prev) => prev.map((m) => (m.id === existingId ? { ...m, ...cleanPayload } : m)));
          await logActivity('Edited Medicine', cleanPayload.name, `${cleanPayload.dosage} at ${cleanPayload.times.join(', ')}`);
          notifyToast('success', `${cleanPayload.name} updated.`);
        } else {
          setMedications((prev) => [...prev, { ...cleanPayload, createdBy: currentUid }]);
          await logActivity('Added Medicine', cleanPayload.name, `${cleanPayload.dosage} at ${cleanPayload.times.join(', ')}`);
          notifyToast('success', `${cleanPayload.name} added to schedule.`);
        }
        return;
      }

      if (mode === 'firebase' && activeCircleId && currentUid) {
        const path = `careCircles/${activeCircleId}/medications/${medId}`;
        try {
          if (existingId) {
            await updateDoc(doc(db, 'careCircles', activeCircleId, 'medications', medId), {
              name: cleanPayload.name,
              dosage: cleanPayload.dosage,
              frequency: cleanPayload.frequency,
              times: cleanPayload.times,
              startDate: cleanPayload.startDate,
              endDate: cleanPayload.endDate,
              instructions: cleanPayload.instructions,
              prescribingDoctor: cleanPayload.prescribingDoctor,
              gracePeriodMinutes: cleanPayload.gracePeriodMinutes,
              archived: cleanPayload.archived,
              updatedAt: serverTimestamp(),
            });
            await logActivity('Edited Medicine', cleanPayload.name, `${cleanPayload.dosage}`);
            notifyToast('success', `${cleanPayload.name} updated.`);
          } else {
            await setDoc(doc(db, 'careCircles', activeCircleId, 'medications', medId), {
              ...cleanPayload,
              createdBy: currentUid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            await logActivity('Added Medicine', cleanPayload.name, `${cleanPayload.dosage}`);
            notifyToast('success', `${cleanPayload.name} added to schedule.`);
          }
        } catch (err) {
          handleFirestoreError(err, existingId ? OperationType.UPDATE : OperationType.CREATE, path);
        }
      }
    },
    [permissions.canEditMedications, mode, currentUid, activeCircleId, logActivity, notifyToast]
  );

  const archiveMedication = useCallback(
    async (medId: string, archived: boolean) => {
      if (!permissions.canEditMedications) {
        notifyToast('error', 'Your role does not have permission to archive medications.');
        return;
      }
      const med = medications.find((m) => m.id === medId);
      if (mode === 'demo') {
        setMedications((prev) => prev.map((m) => (m.id === medId ? { ...m, archived } : m)));
        await logActivity(archived ? 'Archived Medicine' : 'Restored Medicine', med?.name || medId, '');
        notifyToast('info', `${med?.name || 'Medicine'} ${archived ? 'archived' : 'restored'}.`);
        return;
      }
      if (mode === 'firebase' && activeCircleId) {
        const path = `careCircles/${activeCircleId}/medications/${medId}`;
        try {
          await updateDoc(doc(db, 'careCircles', activeCircleId, 'medications', medId), {
            archived,
            updatedAt: serverTimestamp(),
          });
          await logActivity(archived ? 'Archived Medicine' : 'Restored Medicine', med?.name || medId, '');
          notifyToast('info', `${med?.name || 'Medicine'} ${archived ? 'archived' : 'restored'}.`);
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      }
    },
    [permissions.canEditMedications, medications, mode, activeCircleId, logActivity, notifyToast]
  );

  const deleteMedication = useCallback(
    async (medId: string) => {
      if (!permissions.canEditMedications) {
        notifyToast('error', 'Your role does not have permission to delete medications.');
        return;
      }
      const med = medications.find((m) => m.id === medId);
      if (mode === 'demo') {
        setMedications((prev) => prev.filter((m) => m.id !== medId));
        await logActivity('Deleted Medicine', med?.name || medId, 'Removed from active medication list');
        notifyToast('info', `${med?.name || 'Medicine'} deleted.`);
        return;
      }
      if (mode === 'firebase' && activeCircleId) {
        const path = `careCircles/${activeCircleId}/medications/${medId}`;
        try {
          await deleteDoc(doc(db, 'careCircles', activeCircleId, 'medications', medId));
          await logActivity('Deleted Medicine', med?.name || medId, 'Removed from active medication list');
          notifyToast('info', `${med?.name || 'Medicine'} deleted.`);
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, path);
        }
      }
    },
    [permissions.canEditMedications, medications, mode, activeCircleId, logActivity, notifyToast]
  );

  // Record Dose (Taken / Missed / Skipped)
  const recordDose = useCallback(
    async (input: {
      medication: Medication;
      dateKey: string;
      scheduledTime: string;
      status: 'taken' | 'missed' | 'skipped';
      notes?: string;
    }) => {
      if (!permissions.canLogDoses) {
        notifyToast('error', 'Your role has view-only medication log access.');
        return;
      }
      const actorName = userAccount?.displayName || 'CareCircle Member';
      const actorRole = permissions.role;
      const resolveOptedInRecipients = (): string[] => {
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
          if (m.uid === currentUid) {
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
      };

      const existing = medicationLogs.find(
        (l) =>
          l.medicationId === input.medication.id &&
          l.dateKey === input.dateKey &&
          l.scheduledTime === input.scheduledTime
      );
      const logId = existing?.id || `log_${input.medication.id}_${input.dateKey}_${input.scheduledTime.replace(':', '')}`;

      if (mode === 'demo') {
        const record: MedicationLog = {
          id: logId,
          medicationId: input.medication.id,
          medicationName: input.medication.name,
          dosage: input.medication.dosage,
          dateKey: input.dateKey,
          scheduledTime: input.scheduledTime,
          status: input.status,
          recordedByUid: currentUid,
          recordedByName: actorName,
          recordedByRole: actorRole,
          notes: (input.notes || '').slice(0, 300),
          recordedAt: new Date().toISOString(),
        };
        setMedicationLogs((prev) =>
          existing ? prev.map((l) => (l.id === logId ? record : l)) : [record, ...prev]
        );
        if (
          input.status === 'taken' &&
          (actorRole === 'family' || actorRole === 'caregiver') &&
          userPrivate?.notifyCaregiverUpdates !== false
        ) {
          const recipients = resolveOptedInRecipients();
          const emailEnabled = userPrivate?.emailAlertsEnabled !== false;
          setNotifications((prev) => [
            {
              id: makeId('notif'),
              eventType: 'caregiver_update',
              title: `${input.medication.name} marked Taken by ${actorName}`,
              message: `${actorName} (${actorRole}) confirmed the ${input.scheduledTime} dose of ${input.medication.name} (${input.medication.dosage}).`,
              deliveryMode: emailEnabled && recipients.length > 0 ? 'simulated_demo' : 'in_app',
              providerName: emailEnabled && recipients.length > 0 ? 'simulated' : 'in_app',
              providerMessageId: '',
              emailTarget: emailEnabled ? recipients.join(', ').slice(0, 254) : '',
              read: false,
              createdBy: currentUid,
              createdAt: new Date().toISOString(),
            },
            ...prev,
          ]);
        }
        await logActivity(
          `Marked Dose ${input.status.toUpperCase()}`,
          `${input.medication.name} (${input.scheduledTime})`,
          `Recorded by ${actorName} (${actorRole})`
        );
        notifyToast('success', `${input.medication.name} marked as ${input.status}.`);
        return;
      }

      if (mode === 'firebase' && activeCircleId && currentUid) {
        const path = `careCircles/${activeCircleId}/medicationLogs/${logId}`;
        try {
          if (existing) {
            await updateDoc(doc(db, 'careCircles', activeCircleId, 'medicationLogs', logId), {
              status: input.status,
              notes: (input.notes || '').slice(0, 300),
              recordedByUid: currentUid,
              recordedByName: actorName.slice(0, 100),
              recordedByRole: actorRole,
              recordedAt: serverTimestamp(),
            });
          } else {
            await setDoc(doc(db, 'careCircles', activeCircleId, 'medicationLogs', logId), {
              id: logId,
              medicationId: input.medication.id,
              medicationName: input.medication.name.slice(0, 120),
              dosage: input.medication.dosage.slice(0, 80),
              dateKey: input.dateKey,
              scheduledTime: input.scheduledTime,
              status: input.status,
              recordedByUid: currentUid,
              recordedByName: actorName.slice(0, 100),
              recordedByRole: actorRole,
              notes: (input.notes || '').slice(0, 300),
              recordedAt: serverTimestamp(),
              createdAt: serverTimestamp(),
            });
          }
          if (
            input.status === 'taken' &&
            (actorRole === 'family' || actorRole === 'caregiver') &&
            userPrivate?.notifyCaregiverUpdates !== false
          ) {
            const notifTitle = `${input.medication.name.slice(0, 80)} marked Taken by ${actorName.slice(0, 40)}`;
            const notifBody = `${actorName} (${actorRole}) confirmed the ${input.scheduledTime} dose of ${input.medication.name} (${input.medication.dosage}).`;
            const recipients = resolveOptedInRecipients();
            let deliveryMode: NotificationItem['deliveryMode'] = 'in_app';
            let providerName = 'in_app';
            let providerMessageId = '';
            let emailTarget = '';
            let finalMessage = notifBody;

            if (userPrivate?.emailAlertsEnabled !== false && recipients.length > 0 && firebaseUser) {
              try {
                const token = await firebaseUser.getIdToken();
                const res = await fetch('/api/notifications/dispatch', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    circleId: activeCircleId,
                    elderlyName: activeCircle?.elderlyName || 'CareCircle',
                    eventType: 'caregiver_update',
                    title: notifTitle,
                    message: notifBody,
                    recipientEmails: recipients,
                    emailEnabled: true,
                    demoMode: false,
                  }),
                });
                if (res.ok) {
                  const dispatched = (await res.json()) as {
                    deliveryMode: NotificationItem['deliveryMode'];
                    providerName?: string;
                    providerMessageId?: string;
                    emailTarget?: string;
                    message?: string;
                  };
                  deliveryMode = dispatched.deliveryMode;
                  providerName = dispatched.providerName || 'in_app';
                  providerMessageId = dispatched.providerMessageId || '';
                  emailTarget = dispatched.emailTarget || '';
                  finalMessage = dispatched.message || notifBody;
                } else {
                  deliveryMode = 'simulated_demo';
                  providerName = 'simulated';
                }
              } catch {
                deliveryMode = 'simulated_demo';
                providerName = 'simulated';
              }
            }

            const notifId = makeId('notif');
            await setDoc(doc(db, 'careCircles', activeCircleId, 'notifications', notifId), {
              id: notifId,
              eventType: 'caregiver_update',
              title: notifTitle.slice(0, 160),
              message: finalMessage.slice(0, 600),
              deliveryMode,
              providerName: providerName.slice(0, 32),
              providerMessageId: providerMessageId.slice(0, 200),
              emailTarget: emailTarget.slice(0, 254),
              read: false,
              createdBy: currentUid,
              createdAt: serverTimestamp(),
            });
          }
          await logActivity(
            `Marked Dose ${input.status.toUpperCase()}`,
            `${input.medication.name} (${input.scheduledTime})`,
            `Recorded by ${actorName} (${actorRole})`
          );
          notifyToast('success', `${input.medication.name} marked as ${input.status}.`);
        } catch (err) {
          handleFirestoreError(err, existing ? OperationType.UPDATE : OperationType.CREATE, path);
        }
      }
    },
    [
      permissions.canLogDoses,
      permissions.role,
      userAccount?.displayName,
      members,
      userPrivate?.email,
      userPrivate?.emailAlertsEnabled,
      userPrivate?.notifyCaregiverUpdates,
      medicationLogs,
      mode,
      currentUid,
      activeCircleId,
      activeCircle?.elderlyName,
      firebaseUser,
      logActivity,
      notifyToast,
    ]
  );

  // Revert / Undo a Dose Log back to Pending
  const revertDoseLog = useCallback(
    async (medicationId: string, dateKey: string, scheduledTime: string) => {
      if (!permissions.canLogDoses) {
        notifyToast('error', 'Your role has view-only medication log access.');
        return;
      }
      const existing = medicationLogs.find(
        (l) =>
          l.medicationId === medicationId &&
          l.dateKey === dateKey &&
          l.scheduledTime === scheduledTime
      );
      if (!existing) return;

      if (mode === 'demo') {
        setMedicationLogs((prev) => prev.filter((l) => l.id !== existing.id));
        await logActivity(
          'Reverted Dose Status',
          `${existing.medicationName} (${scheduledTime})`,
          'Restored dose slot to pending'
        );
        notifyToast('info', `${existing.medicationName} restored to pending.`);
        return;
      }

      if (mode === 'firebase' && activeCircleId) {
        const path = `careCircles/${activeCircleId}/medicationLogs/${existing.id}`;
        try {
          await deleteDoc(doc(db, 'careCircles', activeCircleId, 'medicationLogs', existing.id));
          await logActivity(
            'Reverted Dose Status',
            `${existing.medicationName} (${scheduledTime})`,
            'Restored dose slot to pending'
          );
          notifyToast('info', `${existing.medicationName} restored to pending.`);
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, path);
        }
      }
    },
    [permissions.canLogDoses, medicationLogs, mode, activeCircleId, logActivity, notifyToast]
  );

  // Load Starter Sample Schedule into Empty Circle (Permission-Gated)
  const loadSampleSchedule = useCallback(async () => {
    if (!permissions.canEditMedications || !permissions.canManageAppointments) {
      notifyToast('error', 'Only members authorized to edit medicines and appointments can load sample data.');
      return;
    }
    if (medications.length > 0 || appointments.length > 0) {
      notifyToast('info', 'This CareCircle already has scheduled items.');
      return;
    }

    const seed = createDemoSeedData(mode === 'demo' ? demoCircleId : 'demo-circle-sen');
    const actorName = userAccount?.displayName || activeCircle?.elderlyName || 'Owner';

    if (mode === 'demo') {
      setMedications(seed.medications);
      setAppointments(seed.appointments.filter((a) => a.status === 'upcoming'));
      setCareTasks(seed.tasks);
      await logActivity('Loaded Sample Schedule', activeCircle?.elderlyName || 'CareCircle', 'Populated starter routine');
      notifyToast('success', 'Starter schedule loaded.');
      return;
    }

    if (mode === 'firebase' && activeCircleId && currentUid) {
      const base = `careCircles/${activeCircleId}`;
      try {
        const batch = writeBatch(db);

        for (const med of seed.medications) {
          const medId = makeId('med');
          batch.set(doc(db, 'careCircles', activeCircleId, 'medications', medId), {
            id: medId,
            name: med.name.slice(0, 120),
            dosage: med.dosage.slice(0, 80),
            frequency: med.frequency,
            times: med.times.slice(0, 8),
            startDate: med.startDate.slice(0, 20),
            endDate: (med.endDate || '').slice(0, 20),
            instructions: (med.instructions || '').slice(0, 400),
            prescribingDoctor: (med.prescribingDoctor || '').slice(0, 120),
            gracePeriodMinutes: med.gracePeriodMinutes,
            archived: false,
            createdBy: currentUid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        for (const appt of seed.appointments.filter((a) => a.status === 'upcoming')) {
          const apptId = makeId('appt');
          batch.set(doc(db, 'careCircles', activeCircleId, 'appointments', apptId), {
            id: apptId,
            doctorName: appt.doctorName.slice(0, 120),
            specialization: (appt.specialization || '').slice(0, 100),
            clinicName: appt.clinicName.slice(0, 160),
            dateTime: appt.dateTime.slice(0, 40),
            notes: (appt.notes || '').slice(0, 500),
            status: 'upcoming',
            reminderSent: false,
            createdBy: currentUid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        for (const task of seed.tasks) {
          const taskId = makeId('task');
          batch.set(doc(db, 'careCircles', activeCircleId, 'careTasks', taskId), {
            id: taskId,
            title: task.title.slice(0, 160),
            notes: task.notes.slice(0, 500),
            category: task.category,
            completed: task.completed,
            completedBy: task.completed ? actorName.slice(0, 100) : '',
            dueDate: task.dueDate.slice(0, 40),
            createdBy: currentUid,
            createdByName: actorName.slice(0, 100),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        const actId = makeId('act');
        batch.set(doc(db, 'careCircles', activeCircleId, 'activityLogs', actId), {
          id: actId,
          actorUid: currentUid,
          actorName: actorName.slice(0, 100),
          actorRole: permissions.role,
          action: 'Loaded Sample Schedule',
          targetName: (activeCircle?.elderlyName || 'CareCircle').slice(0, 160),
          details: 'Added 4 starter medicines, 2 appointments, and 2 care tasks',
          createdAt: serverTimestamp(),
        });

        await batch.commit();
        notifyToast('success', 'Starter CareCircle schedule saved to Cloud Firestore.');
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `${base}/medications`);
      }
    }
  }, [
    permissions.canEditMedications,
    permissions.canManageAppointments,
    permissions.role,
    medications.length,
    appointments.length,
    userAccount?.displayName,
    activeCircle?.elderlyName,
    mode,
    demoCircleId,
    activeCircleId,
    currentUid,
    logActivity,
    notifyToast,
  ]);

  // Appointments CRUD
  const saveAppointment = useCallback(
    async (
      input: Omit<Appointment, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'reminderSent'>,
      existingId?: string
    ) => {
      if (!permissions.canManageAppointments) {
        notifyToast('error', 'Your role does not have permission to manage appointments.');
        return;
      }
      const apptId = existingId || makeId('appt');
      const clean = {
        id: apptId,
        doctorName: input.doctorName.trim().slice(0, 120),
        specialization: (input.specialization || '').trim().slice(0, 100),
        clinicName: input.clinicName.trim().slice(0, 160),
        dateTime: input.dateTime.slice(0, 40),
        notes: (input.notes || '').trim().slice(0, 500),
        status: input.status || 'upcoming',
        reminderSent: false,
      };

      if (mode === 'demo') {
        if (existingId) {
          setAppointments((prev) => prev.map((a) => (a.id === existingId ? { ...a, ...clean } : a)));
          await logActivity('Updated Appointment', clean.doctorName, `${clean.clinicName} on ${clean.dateTime}`);
          notifyToast('success', `Appointment with ${clean.doctorName} updated.`);
        } else {
          setAppointments((prev) => [{ ...clean, createdBy: currentUid }, ...prev]);
          await logActivity('Scheduled Appointment', clean.doctorName, `${clean.clinicName} on ${clean.dateTime}`);
          notifyToast('success', `Appointment with ${clean.doctorName} scheduled.`);
        }
        return;
      }

      if (mode === 'firebase' && activeCircleId && currentUid) {
        const path = `careCircles/${activeCircleId}/appointments/${apptId}`;
        try {
          if (existingId) {
            await updateDoc(doc(db, 'careCircles', activeCircleId, 'appointments', apptId), {
              doctorName: clean.doctorName,
              specialization: clean.specialization,
              clinicName: clean.clinicName,
              dateTime: clean.dateTime,
              notes: clean.notes,
              status: clean.status,
              reminderSent: clean.reminderSent,
              updatedAt: serverTimestamp(),
            });
            await logActivity('Updated Appointment', clean.doctorName, clean.clinicName);
            notifyToast('success', `Appointment with ${clean.doctorName} updated.`);
          } else {
            await setDoc(doc(db, 'careCircles', activeCircleId, 'appointments', apptId), {
              ...clean,
              createdBy: currentUid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            await logActivity('Scheduled Appointment', clean.doctorName, clean.clinicName);
            notifyToast('success', `Appointment with ${clean.doctorName} scheduled.`);
          }
        } catch (err) {
          handleFirestoreError(err, existingId ? OperationType.UPDATE : OperationType.CREATE, path);
        }
      }
    },
    [permissions.canManageAppointments, mode, currentUid, activeCircleId, logActivity, notifyToast]
  );

  const updateAppointmentStatus = useCallback(
    async (apptId: string, status: Appointment['status']) => {
      if (!permissions.canManageAppointments) {
        notifyToast('error', 'Your role does not have permission to update appointments.');
        return;
      }
      const appt = appointments.find((a) => a.id === apptId);
      if (mode === 'demo') {
        setAppointments((prev) => prev.map((a) => (a.id === apptId ? { ...a, status } : a)));
        await logActivity(`Appointment ${status}`, appt?.doctorName || apptId, '');
        notifyToast('info', `Appointment marked ${status}.`);
        return;
      }
      if (mode === 'firebase' && activeCircleId) {
        const path = `careCircles/${activeCircleId}/appointments/${apptId}`;
        try {
          await updateDoc(doc(db, 'careCircles', activeCircleId, 'appointments', apptId), {
            status,
            updatedAt: serverTimestamp(),
          });
          await logActivity(`Appointment ${status}`, appt?.doctorName || apptId, '');
          notifyToast('info', `Appointment marked ${status}.`);
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      }
    },
    [permissions.canManageAppointments, appointments, mode, activeCircleId, logActivity, notifyToast]
  );

  const deleteAppointment = useCallback(
    async (apptId: string) => {
      if (!permissions.canManageAppointments) {
        notifyToast('error', 'Your role does not have permission to delete appointments.');
        return;
      }
      const appt = appointments.find((a) => a.id === apptId);
      if (mode === 'demo') {
        setAppointments((prev) => prev.filter((a) => a.id !== apptId));
        await logActivity('Deleted Appointment', appt?.doctorName || apptId, '');
        notifyToast('info', 'Appointment removed.');
        return;
      }
      if (mode === 'firebase' && activeCircleId) {
        const path = `careCircles/${activeCircleId}/appointments/${apptId}`;
        try {
          await deleteDoc(doc(db, 'careCircles', activeCircleId, 'appointments', apptId));
          await logActivity('Deleted Appointment', appt?.doctorName || apptId, '');
          notifyToast('info', 'Appointment removed.');
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, path);
        }
      }
    },
    [permissions.canManageAppointments, appointments, mode, activeCircleId, logActivity, notifyToast]
  );

  const resolveOptedInRecipients = useCallback((): string[] => {
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
      if (m.uid === currentUid) {
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
  }, [members, currentUid, userPrivate?.emailAlertsEnabled, userPrivate?.email]);

  const dispatchBackendNotification = useCallback(
    async (params: {
      eventType:
        | 'upcoming_dose'
        | 'missed_dose'
        | 'appointment_reminder'
        | 'appointment_change'
        | 'caregiver_update';
      title: string;
      message: string;
      emailEnabled: boolean;
    }): Promise<{
      title: string;
      message: string;
      deliveryMode: NotificationItem['deliveryMode'];
      providerName: string;
      providerMessageId: string;
      emailTarget: string;
      delivered: boolean;
      note: string;
    }> => {
      const recipients = resolveOptedInRecipients();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (mode === 'firebase' && firebaseUser) {
        headers.Authorization = `Bearer ${await firebaseUser.getIdToken()}`;
      }

      try {
        const res = await fetch('/api/notifications/dispatch', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            circleId: activeCircleId,
            elderlyName: activeCircle?.elderlyName || 'CareCircle',
            eventType: params.eventType,
            title: params.title,
            message: params.message,
            recipientEmails: recipients,
            emailEnabled: params.emailEnabled,
            demoMode: mode === 'demo',
          }),
        });
        const json = await res.json();
        if (res.ok) {
          return {
            title: String(json.title || params.title),
            message: String(json.message || params.message),
            deliveryMode: json.deliveryMode,
            providerName: String(json.providerName || 'simulated'),
            providerMessageId: String(json.providerMessageId || ''),
            emailTarget: String(json.emailTarget || ''),
            delivered: Boolean(json.delivered),
            note: String(json.note || ''),
          };
        }
      } catch {
        // Fall through cleanly without claiming real delivery
      }

      return {
        title: params.title,
        message: `${params.message} (Backend email check unavailable; logged locally without sending external email.)`,
        deliveryMode: params.emailEnabled && recipients.length > 0 ? 'simulated_demo' : 'in_app',
        providerName: params.emailEnabled && recipients.length > 0 ? 'simulated' : 'in_app',
        providerMessageId: '',
        emailTarget: params.emailEnabled ? recipients.join(', ').slice(0, 254) : '',
        delivered: false,
        note: 'Backend dispatch unreachable; no external email sent.',
      };
    },
    [resolveOptedInRecipients, mode, firebaseUser, activeCircleId, activeCircle?.elderlyName]
  );

  // Care Tasks & Daily Care Notes
  const addCareTask = useCallback(
    async (input: { title: string; notes: string; category: CareTask['category']; dueDate: string }) => {
      const taskId = makeId('task');
      const actorName = userAccount?.displayName || 'Member';
      const cleanTitle = input.title.trim().slice(0, 160);
      const cleanNotes = input.notes.trim().slice(0, 500);

      if (mode === 'demo') {
        const newTask: CareTask = {
          id: taskId,
          title: cleanTitle,
          notes: cleanNotes,
          category: input.category,
          completed: input.category === 'care_log',
          completedBy: input.category === 'care_log' ? actorName : '',
          dueDate: input.dueDate,
          createdBy: currentUid,
          createdByName: actorName,
          createdAt: new Date().toISOString(),
        };
        setCareTasks((prev) => [newTask, ...prev]);

        if (input.category === 'assistance_alert' && userPrivate?.notifyCaregiverUpdates !== false) {
          const dispatched = await dispatchBackendNotification({
            eventType: 'caregiver_update',
            title: `Caregiver Assistance Alert: ${cleanTitle}`,
            message: `${actorName} reported: ${cleanNotes || cleanTitle}`,
            emailEnabled: userPrivate?.emailAlertsEnabled !== false,
          });
          setNotifications((prev) => [
            {
              id: makeId('notif'),
              eventType: 'caregiver_update',
              title: dispatched.title,
              message: dispatched.message,
              deliveryMode: dispatched.deliveryMode,
              providerName: dispatched.providerName,
              providerMessageId: dispatched.providerMessageId,
              emailTarget: dispatched.emailTarget,
              read: false,
              createdBy: currentUid,
              createdAt: new Date().toISOString(),
            },
            ...prev,
          ]);
        }

        await logActivity(
          input.category === 'assistance_alert' ? 'Sent Family Alert' : 'Added Care Update',
          newTask.title,
          newTask.notes
        );
        notifyToast('success', input.category === 'assistance_alert' ? 'Family alert logged (Demo Mode).' : 'Care update saved.');
        return;
      }

      if (mode === 'firebase' && activeCircleId && currentUid) {
        const path = `careCircles/${activeCircleId}/careTasks/${taskId}`;
        try {
          await setDoc(doc(db, 'careCircles', activeCircleId, 'careTasks', taskId), {
            id: taskId,
            title: cleanTitle,
            notes: cleanNotes,
            category: input.category,
            completed: input.category === 'care_log',
            completedBy: input.category === 'care_log' ? actorName.slice(0, 100) : '',
            dueDate: input.dueDate.slice(0, 40),
            createdBy: currentUid,
            createdByName: actorName.slice(0, 100),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          if (input.category === 'assistance_alert' && userPrivate?.notifyCaregiverUpdates !== false) {
            const dispatched = await dispatchBackendNotification({
              eventType: 'caregiver_update',
              title: `Assistance Alert: ${cleanTitle.slice(0, 120)}`,
              message: `${actorName}: ${cleanNotes || cleanTitle}`,
              emailEnabled: userPrivate?.emailAlertsEnabled !== false,
            });
            const notifId = makeId('notif');
            await setDoc(doc(db, 'careCircles', activeCircleId, 'notifications', notifId), {
              id: notifId,
              eventType: 'caregiver_update',
              title: dispatched.title.slice(0, 160),
              message: dispatched.message.slice(0, 600),
              deliveryMode: dispatched.deliveryMode,
              providerName: dispatched.providerName.slice(0, 32),
              providerMessageId: dispatched.providerMessageId.slice(0, 200),
              emailTarget: dispatched.emailTarget.slice(0, 254),
              read: false,
              createdBy: currentUid,
              createdAt: serverTimestamp(),
            });
            notifyToast(
              'success',
              dispatched.delivered
                ? `Caregiver alert confirmed via ${dispatched.providerName}.`
                : 'Caregiver alert logged in Simulated / In-App Mode (no external email sent).'
            );
          } else {
            notifyToast('success', 'Care update saved.');
          }

          await logActivity('Added Care Update', cleanTitle, cleanNotes);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      }
    },
    [
      mode,
      currentUid,
      userAccount?.displayName,
      userPrivate?.notifyCaregiverUpdates,
      userPrivate?.emailAlertsEnabled,
      activeCircleId,
      dispatchBackendNotification,
      logActivity,
      notifyToast,
    ]
  );

  const toggleCareTask = useCallback(
    async (taskId: string) => {
      const task = careTasks.find((t) => t.id === taskId);
      if (!task) return;
      const nextDone = !task.completed;
      const completedBy = nextDone ? userAccount?.displayName || 'Member' : '';

      if (mode === 'demo') {
        setCareTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, completed: nextDone, completedBy } : t))
        );
        return;
      }

      if (mode === 'firebase' && activeCircleId) {
        const path = `careCircles/${activeCircleId}/careTasks/${taskId}`;
        try {
          await updateDoc(doc(db, 'careCircles', activeCircleId, 'careTasks', taskId), {
            completed: nextDone,
            completedBy: completedBy.slice(0, 100),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      }
    },
    [careTasks, mode, activeCircleId, userAccount?.displayName]
  );

  const deleteCareTask = useCallback(
    async (taskId: string) => {
      if (mode === 'demo') {
        setCareTasks((prev) => prev.filter((t) => t.id !== taskId));
        return;
      }
      if (mode === 'firebase' && activeCircleId) {
        const path = `careCircles/${activeCircleId}/careTasks/${taskId}`;
        try {
          await deleteDoc(doc(db, 'careCircles', activeCircleId, 'careTasks', taskId));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, path);
        }
      }
    },
    [mode, activeCircleId]
  );

  // Notifications & Reminder Check
  const sendTestNotification = useCallback(
    async (email: string) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (mode === 'firebase' && firebaseUser) {
        headers.Authorization = `Bearer ${await firebaseUser.getIdToken()}`;
      }

      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          recipientEmail: email,
          elderlyName: activeCircle?.elderlyName || 'CareCircle',
          demoMode: mode === 'demo',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to send test notification');

      const notifId = makeId('notif');
      if (mode === 'demo') {
        setNotifications((prev) => [
          {
            id: notifId,
            eventType: 'test_email',
            title: json.title,
            message: json.message,
            deliveryMode: json.deliveryMode,
            providerName: json.providerName || 'simulated',
            providerMessageId: json.providerMessageId || '',
            emailTarget: json.emailTarget || '',
            read: false,
            createdBy: currentUid,
            createdAt: json.timestamp,
          },
          ...prev,
        ]);
      } else if (mode === 'firebase' && activeCircleId && currentUid) {
        const path = `careCircles/${activeCircleId}/notifications/${notifId}`;
        try {
          await setDoc(doc(db, 'careCircles', activeCircleId, 'notifications', notifId), {
            id: notifId,
            eventType: 'test_email',
            title: String(json.title).slice(0, 160),
            message: String(json.message).slice(0, 600),
            deliveryMode: json.deliveryMode,
            providerName: String(json.providerName || 'simulated').slice(0, 32),
            providerMessageId: String(json.providerMessageId || '').slice(0, 200),
            emailTarget: String(json.emailTarget || '').slice(0, 254),
            read: false,
            createdBy: currentUid,
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      }

      notifyToast(
        json.delivered ? 'success' : 'info',
        json.delivered
          ? `Confirmed: Test email sent via ${json.providerName}${json.providerMessageId ? ` (Ref: ${json.providerMessageId})` : ''}.`
          : `Simulated Mode: Test notification logged locally — no email was sent externally.`
      );

      return {
        delivered: Boolean(json.delivered),
        deliveryMode: json.deliveryMode as NotificationItem['deliveryMode'],
        providerName: String(json.providerName || 'simulated'),
        providerMessageId: String(json.providerMessageId || ''),
        note: String(json.note || json.message || ''),
      };
    },
    [mode, firebaseUser, activeCircle?.elderlyName, currentUid, activeCircleId, notifyToast]
  );

  const runReminderCheck = useCallback(
    async (options?: { silent?: boolean }): Promise<{
      missedCount: number;
      upcomingCount: number;
      apptCount: number;
      deliveredEmails: number;
      simulatedEmails: number;
    }> => {
      const todayKey = getTodayDateKey();
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (mode === 'firebase' && firebaseUser) {
        headers.Authorization = `Bearer ${await firebaseUser.getIdToken()}`;
      }

      const recipientEmails = resolveOptedInRecipients();
      const existingNotifTitlesToday = Array.from(
        new Set(
          notifications
            .filter((n) => {
              const ms = getTimestampMs(n.createdAt);
              if (!ms) return true;
              const d = new Date(ms);
              const dk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              return dk === todayKey;
            })
            .map((n) => n.title)
        )
      );

      const openCareAlerts = careTasks
        .filter((t) => !t.completed && t.category === 'assistance_alert')
        .map((t) => ({
          id: t.id,
          title: t.title,
          notes: t.notes,
          createdByName: t.createdByName,
        }));

      const res = await fetch('/api/reminders/process', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          circleId: activeCircleId || undefined,
          demoMode: mode === 'demo',
          elderlyName: activeCircle?.elderlyName || 'Patient',
          recipientEmails,
          alreadyNotifiedKeys: existingNotifTitlesToday,
          preferences: {
            notifyUpcomingDose: userPrivate?.notifyUpcomingDose ?? true,
            notifyMissedDose: userPrivate?.notifyMissedDose ?? true,
            notifyAppointment: userPrivate?.notifyAppointment ?? true,
            notifyCaregiverUpdates: userPrivate?.notifyCaregiverUpdates ?? true,
            emailAlertsEnabled: userPrivate?.emailAlertsEnabled ?? true,
          },
          dateKey: todayKey,
          nowMinutes,
          medications: medications.map((m) => ({
            id: m.id,
            name: m.name,
            dosage: m.dosage,
            times: m.times,
            startDate: m.startDate,
            endDate: m.endDate,
            gracePeriodMinutes: m.gracePeriodMinutes,
            archived: m.archived,
          })),
          logs: medicationLogs.map((l) => ({
            medicationId: l.medicationId,
            dateKey: l.dateKey,
            scheduledTime: l.scheduledTime,
            status: l.status,
          })),
          appointments: appointments.map((a) => ({
            id: a.id,
            doctorName: a.doctorName,
            clinicName: a.clinicName,
            dateTime: a.dateTime,
            status: a.status,
            reminderSent: a.reminderSent,
          })),
          openCareAlerts,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Reminder check failed');

      const newlyMissed = (json.newlyMissed || []) as Array<{
        medicationId: string;
        medicationName: string;
        dosage: string;
        scheduledTime: string;
        gracePeriodMinutes: number;
      }>;

      const appointmentReminderIds = (json.appointmentReminders || []) as string[];
      const existingTitleSet = new Set(existingNotifTitlesToday);

      const generatedNotifs = ((json.notifications || []) as Array<{
        eventType: NotificationItem['eventType'];
        title: string;
        message: string;
        deliveryMode: NotificationItem['deliveryMode'];
        providerName?: string;
        providerMessageId?: string;
        emailTarget: string;
        delivered?: boolean;
      }>).filter((n) => !existingTitleSet.has(n.title));

      // Persist newly missed dose logs (after grace period), appointment reminderSent flags, and notifications
      if (mode === 'demo') {
        if (newlyMissed.length > 0 && permissions.canLogDoses) {
          const missedLogs: MedicationLog[] = newlyMissed.map((m) => ({
            id: `log_${m.medicationId}_${todayKey}_${m.scheduledTime.replace(':', '')}`,
            medicationId: m.medicationId,
            medicationName: m.medicationName,
            dosage: m.dosage,
            dateKey: todayKey,
            scheduledTime: m.scheduledTime,
            status: 'missed',
            recordedByUid: 'system',
            recordedByName: 'Reminder Engine',
            recordedByRole: 'system',
            notes: `Auto-recorded after ${m.gracePeriodMinutes}m grace period`,
            recordedAt: new Date().toISOString(),
          }));
          setMedicationLogs((prev) => [...missedLogs, ...prev]);
        }

        if (appointmentReminderIds.length > 0) {
          const idSet = new Set(appointmentReminderIds);
          setAppointments((prev) =>
            prev.map((a) => (idSet.has(a.id) ? { ...a, reminderSent: true } : a))
          );
        }

        if (generatedNotifs.length > 0) {
          const items: NotificationItem[] = generatedNotifs.map((n) => ({
            id: makeId('notif'),
            eventType: n.eventType,
            title: n.title,
            message: n.message,
            deliveryMode: n.deliveryMode,
            providerName: n.providerName || 'simulated',
            providerMessageId: n.providerMessageId || '',
            emailTarget: n.emailTarget,
            read: false,
            createdBy: currentUid || 'system',
            createdAt: new Date().toISOString(),
          }));
          setNotifications((prev) => [...items, ...prev]);
        }
      } else if (mode === 'firebase' && activeCircleId && currentUid) {
        try {
          if (permissions.canLogDoses) {
            for (const m of newlyMissed) {
              const logId = `log_${m.medicationId}_${todayKey}_${m.scheduledTime.replace(':', '')}`;
              const logRef = doc(db, 'careCircles', activeCircleId, 'medicationLogs', logId);
              const existingSnap = await getDoc(logRef);
              if (!existingSnap.exists()) {
                await setDoc(logRef, {
                  id: logId,
                  medicationId: m.medicationId,
                  medicationName: m.medicationName.slice(0, 120),
                  dosage: m.dosage.slice(0, 80),
                  dateKey: todayKey,
                  scheduledTime: m.scheduledTime,
                  status: 'missed',
                  recordedByUid: currentUid,
                  recordedByName: `${userAccount?.displayName || 'System'} (Reminder Check)`.slice(0, 100),
                  recordedByRole: 'system',
                  notes: `Recorded after ${m.gracePeriodMinutes}m grace period`,
                  recordedAt: serverTimestamp(),
                  createdAt: serverTimestamp(),
                });
              }
            }
          }
          if (permissions.canManageAppointments) {
            for (const apptId of appointmentReminderIds) {
              await updateDoc(doc(db, 'careCircles', activeCircleId, 'appointments', apptId), {
                reminderSent: true,
                updatedAt: serverTimestamp(),
              });
            }
          }
          for (const n of generatedNotifs) {
            const notifId = makeId('notif');
            await setDoc(doc(db, 'careCircles', activeCircleId, 'notifications', notifId), {
              id: notifId,
              eventType: n.eventType,
              title: n.title.slice(0, 160),
              message: n.message.slice(0, 600),
              deliveryMode: n.deliveryMode,
              providerName: String(n.providerName || 'simulated').slice(0, 32),
              providerMessageId: String(n.providerMessageId || '').slice(0, 200),
              emailTarget: n.emailTarget.slice(0, 254),
              read: false,
              createdBy: currentUid,
              createdAt: serverTimestamp(),
            });
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `careCircles/${activeCircleId}/notifications`);
        }
      }

      const missedCount = newlyMissed.length;
      const upcomingCount = (json.upcomingDoses || []).length;
      const apptCount = appointmentReminderIds.length;
      const deliveredEmails = generatedNotifs.filter((n) => n.deliveryMode === 'real_email').length;
      const simulatedEmails = generatedNotifs.filter((n) => n.deliveryMode === 'simulated_demo').length;

      if (!options?.silent || missedCount > 0 || apptCount > 0 || deliveredEmails > 0) {
        const deliveryDetail =
          deliveredEmails > 0
            ? `${deliveredEmails} confirmed email(s) sent`
            : simulatedEmails > 0
            ? `${simulatedEmails} simulated (setup required)`
            : 'no new email alerts needed';
        notifyToast(
          missedCount > 0 ? 'error' : 'info',
          `Reminder check: ${missedCount} missed (post-grace), ${upcomingCount} upcoming doses, ${apptCount} appointment alerts — ${deliveryDetail}.`
        );
      }

      return { missedCount, upcomingCount, apptCount, deliveredEmails, simulatedEmails };
    },
    [
      mode,
      firebaseUser,
      resolveOptedInRecipients,
      userPrivate,
      activeCircle?.elderlyName,
      medications,
      medicationLogs,
      appointments,
      careTasks,
      notifications,
      currentUid,
      activeCircleId,
      permissions.canLogDoses,
      permissions.canManageAppointments,
      userAccount?.displayName,
      notifyToast,
    ]
  );

  const markNotificationRead = useCallback(
    async (notifId: string) => {
      if (mode === 'demo') {
        setNotifications((prev) => prev.map((n) => (n.id === notifId ? { ...n, read: true } : n)));
        return;
      }
      if (mode === 'firebase' && activeCircleId) {
        const path = `careCircles/${activeCircleId}/notifications/${notifId}`;
        try {
          await updateDoc(doc(db, 'careCircles', activeCircleId, 'notifications', notifId), {
            read: true,
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      }
    },
    [mode, activeCircleId]
  );

  const markAllNotificationsRead = useCallback(async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    if (mode === 'demo') {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      notifyToast('info', 'All alerts marked as read.');
      return;
    }
    if (mode === 'firebase' && activeCircleId) {
      const path = `careCircles/${activeCircleId}/notifications`;
      try {
        const batch = writeBatch(db);
        for (const id of unreadIds) {
          batch.update(doc(db, 'careCircles', activeCircleId, 'notifications', id), {
            read: true,
          });
        }
        await batch.commit();
        notifyToast('info', 'All alerts marked as read.');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    }
  }, [notifications, mode, activeCircleId, notifyToast]);

  const value: CareCircleContextValue = {
    mode,
    authReady,
    firebaseUser,
    currentPage,
    setCurrentPage,
    userAccount,
    userPrivate,
    userCircles,
    activeCircle,
    members,
    invitations,
    medications,
    medicationLogs,
    appointments,
    careTasks,
    notifications,
    activityLogs,
    permissions,
    firestoreSynced,
    emailProviderStatus,
    refreshEmailStatus,
    toasts,
    dismissToast,
    notifyToast,
    language,
    theme,
    highContrast,
    fontScale,
    voiceEnabled,
    updatePreferences,
    updateNotificationPrefs,
    demoCircleId,
    signInWithGoogle,
    enterDemoSandbox,
    switchDemoRole,
    switchDemoCircle,
    resetDemoSandbox,
    logout,
    switchActiveCircle,
    createCareCircle,
    updateCareCircleProfile,
    createInvitation,
    revokeInvitation,
    redeemInvitation,
    updateMemberPermissions,
    removeMember,
    saveMedication,
    archiveMedication,
    deleteMedication,
    recordDose,
    revertDoseLog,
    loadSampleSchedule,
    saveAppointment,
    updateAppointmentStatus,
    deleteAppointment,
    addCareTask,
    toggleCareTask,
    deleteCareTask,
    sendTestNotification,
    runReminderCheck,
    markNotificationRead,
    markAllNotificationsRead,
  };

  return <CareCircleContext.Provider value={value}>{children}</CareCircleContext.Provider>;
};

export function useCareCircle(): CareCircleContextValue {
  const ctx = useContext(CareCircleContext);
  if (!ctx) throw new Error('useCareCircle must be used inside CareCircleProvider');
  return ctx;
}
