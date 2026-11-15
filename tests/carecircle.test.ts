import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import test, { after, before } from 'node:test';
import {
  createAllDemoSeeds,
  createDemoSeedData,
  DEMO_PROFILES,
  getDemoActor,
} from '../src/lib/demoSeed.ts';
import {
  computeScheduleForDate,
  computeWeeklyAdherence,
  formatDateKey,
  formatRelativeMinutes,
  generateSmartInsights,
  matchesAuditCategory,
  toLocalDateTimeInputValue,
} from '../src/lib/scheduleUtils.ts';
import type { Medication, MedicationLog } from '../src/types/carecircle.ts';

const ROOT = process.cwd();
const FIREBASE_CONFIG = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'firebase-applet-config.json'), 'utf-8')
) as {
  projectId: string;
  firestoreDatabaseId: string;
  apiKey: string;
};

const BASE_URL = 'http://127.0.0.1:3000';
let serverProc: ChildProcess | null = null;
let startedServerHere = false;

async function isServerHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

const TSX_BIN = path.join(ROOT, 'node_modules', '.bin', 'tsx');

before(async () => {
  if (await isServerHealthy()) {
    return;
  }
  startedServerHere = true;
  serverProc = spawn(TSX_BIN, ['server.ts'], {
    cwd: ROOT,
    stdio: 'ignore',
    env: { ...process.env, NODE_ENV: 'production' },
  });

  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (await isServerHealthy()) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('Timed out waiting for CareCircle server on port 3000.');
});

after(() => {
  if (startedServerHere && serverProc && !serverProc.killed) {
    serverProc.kill('SIGTERM');
    setTimeout(() => {
      if (serverProc && serverProc.exitCode === null) {
        serverProc.kill('SIGKILL');
      }
    }, 300).unref();
  }
});

// ── 1. Schedule & Grace-Period Logic ──────────────────────────────────────

test('computeScheduleForDate respects grace period before promoting to missed', () => {
  const today = formatDateKey(new Date());
  const meds: Medication[] = [
    {
      id: 'med-test-1',
      name: 'Amlodipine',
      dosage: '5 mg',
      frequency: 'once_daily',
      times: ['08:00'],
      startDate: today,
      endDate: '',
      instructions: '',
      prescribingDoctor: '',
      gracePeriodMinutes: 60,
      archived: false,
      createdBy: 'uid-1',
    },
  ];

  // 08:30 (30m after 08:00, inside 60m grace window) -> pending
  const withinGrace = computeScheduleForDate(meds, [], today, 8 * 60 + 30);
  assert.equal(withinGrace.length, 1);
  assert.equal(withinGrace[0].status, 'pending');
  assert.equal(withinGrace[0].isPastGrace, false);
  assert.equal(formatRelativeMinutes(withinGrace[0].minutesUntil, 60).tone, 'grace');

  // 09:05 (65m after 08:00, past 60m grace window) -> missed
  const pastGrace = computeScheduleForDate(meds, [], today, 9 * 60 + 5);
  assert.equal(pastGrace.length, 1);
  assert.equal(pastGrace[0].status, 'missed');
  assert.equal(pastGrace[0].isPastGrace, true);
  assert.equal(formatRelativeMinutes(pastGrace[0].minutesUntil, 60).tone, 'overdue');

  // Explicit taken log overrides past grace
  const logs: MedicationLog[] = [
    {
      id: 'log-1',
      medicationId: 'med-test-1',
      medicationName: 'Amlodipine',
      dosage: '5 mg',
      dateKey: today,
      scheduledTime: '08:00',
      status: 'taken',
      recordedByUid: 'uid-1',
      recordedByName: 'Martha Sen',
      recordedByRole: 'elderly',
      notes: 'Taken on time',
      recordedAt: new Date().toISOString(),
    },
  ];
  const afterLog = computeScheduleForDate(meds, logs, today, 9 * 60 + 5);
  assert.equal(afterLog[0].status, 'taken');
  assert.equal(afterLog[0].log?.notes, 'Taken on time');
});

test('computeWeeklyAdherence and generateSmartInsights compute accurate stats on demo seed', () => {
  const seed = createDemoSeedData();
  const weekly = computeWeeklyAdherence(seed.medications, seed.logs, 12 * 60);
  assert.equal(weekly.days.length, 7);
  assert.ok(weekly.eligibleTotal > 0);
  assert.ok(weekly.ratePercent >= 0 && weekly.ratePercent <= 100);

  const insights = generateSmartInsights(seed.medications, seed.logs, seed.appointments);
  assert.ok(insights.length >= 1);
});

// ── 2. Firestore Blueprint & Security Rules Audit ─────────────────────────

test('firestore.rules covers all blueprint collections and enforces ABAC invariants', () => {
  const rulesText = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf-8');
  const blueprint = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'firebase-blueprint.json'), 'utf-8')
  ) as { firestore: Record<string, unknown> };

  // Global catch-all deny present
  assert.match(rulesText, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;/);

  // Every blueprint path has a corresponding match rule in firestore.rules
  const expectedMatchers = [
    { label: '/users/{userId}', pattern: 'match /users/{userId}' },
    { label: '/users/{userId}/private/{docId}', pattern: 'match /private/{docId}' },
    { label: '/users/{userId}/circles/{circleId}', pattern: 'match /circles/{circleId}' },
    { label: '/invitations/{codeHash}', pattern: 'match /invitations/{codeHash}' },
    { label: '/careCircles/{circleId}', pattern: 'match /careCircles/{circleId}' },
    { label: '/careCircles/{circleId}/members/{memberId}', pattern: 'match /members/{memberId}' },
    {
      label: '/careCircles/{circleId}/invitations/{codeHash}',
      pattern: 'allow list: if isSignedIn() && isCircleOrganizer(circleId)',
    },
    { label: '/careCircles/{circleId}/medications/{medId}', pattern: 'match /medications/{medId}' },
    { label: '/careCircles/{circleId}/medicationLogs/{logId}', pattern: 'match /medicationLogs/{logId}' },
    { label: '/careCircles/{circleId}/appointments/{apptId}', pattern: 'match /appointments/{apptId}' },
    { label: '/careCircles/{circleId}/careTasks/{taskId}', pattern: 'match /careTasks/{taskId}' },
    { label: '/careCircles/{circleId}/notifications/{notifId}', pattern: 'match /notifications/{notifId}' },
    { label: '/careCircles/{circleId}/activityLogs/{logId}', pattern: 'match /activityLogs/{logId}' },
  ];
  assert.equal(Object.keys(blueprint.firestore).length, expectedMatchers.length);
  for (const m of expectedMatchers) {
    assert.ok(rulesText.includes(m.pattern), `Missing rule pattern for ${m.label}: ${m.pattern}`);
  }
  assert.equal(
    rulesText.split('match /invitations/{codeHash}').length - 1,
    2,
    'Expected both top-level /invitations and circle-scoped /careCircles/{circleId}/invitations matchers'
  );

  // No blanket signed-in list queries
  assert.equal(/allow list:\s*if isSignedIn\(\)\s*;/.test(rulesText), false);

  // Atomic invite join supports activityLogs creation via existsAfter & rejects revoked/expired invites
  assert.ok(rulesText.includes('existsAfter(memberPath(circleId, request.auth.uid))'));
  assert.ok(rulesText.includes("incoming().role in ['elderly', 'family', 'caregiver']"));
  assert.ok(rulesText.includes('isCircleOrganizer(circleId)'));
  assert.ok(rulesText.includes('revokedAt == null'));
  assert.ok(rulesText.includes('resource.data.circleId == circleId'));

  // Granular RBAC & PII/terminal locks enforced
  assert.ok(rulesText.includes('canEditMedications(circleId)'));
  assert.ok(rulesText.includes('canManageAppointments(circleId)'));
  assert.ok(rulesText.includes('canLogDoses(circleId)'));
  assert.ok(rulesText.includes("existing().status != 'cancelled'"));
  assert.ok(rulesText.includes("incoming().diff(existing()).affectedKeys().hasOnly(['read'])"));
  assert.ok(rulesText.includes('(isCircleOwner(circleId) || existing().createdBy == request.auth.uid)'));
});

// ── 3. Live Cloud Firestore Unauthenticated Rejection Checks ──────────────

test('Live Cloud Firestore database rejects all unauthenticated reads & writes with 403', async () => {
  const fsDocsBase = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/${FIREBASE_CONFIG.firestoreDatabaseId}/documents`;
  const sampleHash = 'a'.repeat(64);

  const readTargets = [
    `${fsDocsBase}/users/test_uid`,
    `${fsDocsBase}/users/test_uid/private/info`,
    `${fsDocsBase}/users/test_uid/circles/circle_1`,
    `${fsDocsBase}/invitations/${sampleHash}`,
    `${fsDocsBase}/careCircles/circle_1`,
    `${fsDocsBase}/careCircles/circle_1/members/test_uid`,
    `${fsDocsBase}/careCircles/circle_1/invitations/${sampleHash}`,
    `${fsDocsBase}/careCircles/circle_1/medications/med_1`,
    `${fsDocsBase}/careCircles/circle_1/medicationLogs/log_1`,
    `${fsDocsBase}/careCircles/circle_1/appointments/appt_1`,
    `${fsDocsBase}/careCircles/circle_1/careTasks/task_1`,
    `${fsDocsBase}/careCircles/circle_1/notifications/notif_1`,
    `${fsDocsBase}/careCircles/circle_1/activityLogs/act_1`,
  ];

  for (const url of readTargets) {
    const res = await fetch(url);
    assert.equal(res.status, 403, `Expected 403 PERMISSION_DENIED for unauth GET ${url}, got ${res.status}`);
  }

  // Unauthenticated write attempts across CareCircle profile, members, invitations, and medicationLogs
  const writeTargets = [
    {
      url: `${fsDocsBase}/careCircles?documentId=unauth_circle_test`,
      body: { fields: { id: { stringValue: 'unauth_circle_test' }, ownerId: { stringValue: 'attacker' } } },
    },
    {
      url: `${fsDocsBase}/careCircles/circle_1/members?documentId=attacker_uid`,
      body: { fields: { uid: { stringValue: 'attacker_uid' }, role: { stringValue: 'family' } } },
    },
    {
      url: `${fsDocsBase}/invitations?documentId=${sampleHash}`,
      body: { fields: { codeHash: { stringValue: sampleHash }, circleId: { stringValue: 'circle_1' } } },
    },
    {
      url: `${fsDocsBase}/careCircles/circle_1/medicationLogs?documentId=unauth_log_1`,
      body: { fields: { id: { stringValue: 'unauth_log_1' }, status: { stringValue: 'taken' } } },
    },
  ];

  for (const target of writeTargets) {
    const writeRes = await fetch(target.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(target.body),
    });
    assert.equal(writeRes.status, 403, `Expected 403 on unauth POST ${target.url}, got ${writeRes.status}`);
  }
});

// ── 4. Demo Seed & Express API & Authorization Integration Tests ──────────

test('Demo seed grants family members dose logging by default and includes invitation records', () => {
  const seed = createDemoSeedData();
  const familyMember = seed.members.find((m) => m.role === 'family');
  assert.ok(familyMember, 'Expected seeded family member');
  assert.equal(familyMember.canLogDoses, true);
  assert.ok(seed.invitations.length >= 2);
  assert.ok(seed.invitations.some((inv) => inv.usedAt === null && inv.revokedAt === null));
});

test('API health and email provider status respond accurately without leaking secrets', async () => {
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  assert.equal(healthRes.status, 200);
  const health = (await healthRes.json()) as { status: string; firebaseConfigured: boolean };
  assert.equal(health.status, 'ok');
  assert.equal(health.firebaseConfigured, true);

  const emailRes = await fetch(`${BASE_URL}/api/email/status`);
  assert.equal(emailRes.status, 200);
  const emailJson = (await emailRes.json()) as {
    configured: boolean;
    provider: string;
    schedulerConfigured: boolean;
    cronEndpoint: string;
    supportedProviders: string[];
    missingRequirements: string[];
  };
  assert.ok(
    ['resend', 'sendgrid', 'webhook', 'simulated_demo'].includes(emailJson.provider),
    `Unexpected email provider: ${emailJson.provider}`
  );
  assert.equal(typeof emailJson.schedulerConfigured, 'boolean');
  assert.equal(emailJson.cronEndpoint, '/api/reminders/process');
  assert.ok(Array.isArray(emailJson.missingRequirements));
  assert.ok(emailJson.supportedProviders.includes('resend'));
  assert.ok(emailJson.supportedProviders.includes('sendgrid'));
  assert.ok(emailJson.supportedProviders.includes('webhook'));
  const serialized = JSON.stringify(emailJson);
  assert.equal(serialized.includes('resendApiKey'), false);
  assert.equal(serialized.includes('sendgridApiKey'), false);
  assert.equal(serialized.includes('cronSecret'), false);
  assert.equal(serialized.includes('webhookAuthHeader'), false);
});

test('Invitation API supports all 3 roles, enforces auth/revocation, and hashes passcodes via SHA-256', async () => {
  // Missing auth or spoofed Bearer token in live mode -> 401
  const unauthCreate = await fetch(`${BASE_URL}/api/invitations/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer fake.invalid.token' },
    body: JSON.stringify({ circleId: 'c1', role: 'family', demoMode: false }),
  });
  assert.equal(unauthCreate.status, 401);

  // Invalid role -> 400
  const badCreate = await fetch(`${BASE_URL}/api/invitations/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ circleId: 'c1', role: 'admin', demoMode: true }),
  });
  assert.equal(badCreate.status, 400);

  // Create invitations for all 3 valid roles (elderly, family, caregiver)
  for (const role of ['elderly', 'family', 'caregiver'] as const) {
    const res = await fetch(`${BASE_URL}/api/invitations/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        circleId: 'demo-circle-sen',
        elderlyName: 'Martha Sen',
        role,
        expiresHours: 24,
        demoMode: true,
      }),
    });
    assert.equal(res.status, 200, `Expected 200 for role=${role}`);
    const data = (await res.json()) as {
      code: string;
      codeHash: string;
      role: string;
      canLogDoses: boolean;
      canEditMedications: boolean;
      expiresAt: string;
    };
    assert.equal(data.role, role);
    assert.equal(data.canLogDoses, true, `${role} should allow dose logging by default`);
    if (role === 'family') {
      assert.equal(data.canEditMedications, false);
    }
    assert.ok(new Date(data.expiresAt).getTime() > Date.now());
  }

  // Valid demo create -> SHA-256 hash matches code
  const okCreate = await fetch(`${BASE_URL}/api/invitations/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      circleId: 'demo-circle-sen',
      elderlyName: 'Martha Sen',
      role: 'caregiver',
      relation: 'Nurse',
      demoMode: true,
    }),
  });
  assert.equal(okCreate.status, 200);
  const created = (await okCreate.json()) as { code: string; codeHash: string };
  const expectedHash = crypto
    .createHash('sha256')
    .update(created.code.trim().toUpperCase())
    .digest('hex');
  assert.equal(created.codeHash, expectedHash);

  // Revoke malformed codeHash -> 400
  const badRevoke = await fetch(`${BASE_URL}/api/invitations/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ circleId: 'demo-circle-sen', codeHash: 'not-a-sha256', demoMode: true }),
  });
  assert.equal(badRevoke.status, 400);

  // Revoke in live mode with spoofed/missing token -> 401
  const unauthRevoke = await fetch(`${BASE_URL}/api/invitations/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer spoofed_token' },
    body: JSON.stringify({ circleId: 'c1', codeHash: created.codeHash, demoMode: false }),
  });
  assert.equal(unauthRevoke.status, 401);

  // Valid demo revoke -> 200
  const okRevoke = await fetch(`${BASE_URL}/api/invitations/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ circleId: 'demo-circle-sen', codeHash: created.codeHash, demoMode: true }),
  });
  assert.equal(okRevoke.status, 200);
  const revoked = (await okRevoke.json()) as { codeHash: string; status: string };
  assert.equal(revoked.codeHash, created.codeHash);
  assert.equal(revoked.status, 'revoked');

  // Redeem missing auth in live mode -> 401
  const unauthRedeem = await fetch(`${BASE_URL}/api/invitations/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: created.code, demoMode: false }),
  });
  assert.equal(unauthRedeem.status, 401);

  // Redeem in demo mode -> returns identical hash
  const okRedeem = await fetch(`${BASE_URL}/api/invitations/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: ` ${created.code.toLowerCase()} `, demoMode: true }),
  });
  assert.equal(okRedeem.status, 200);
  const redeemed = (await okRedeem.json()) as { codeHash: string };
  assert.equal(redeemed.codeHash, expectedHash);
});

test('Reminder processing covers all 4 alert categories, enforces auth, and deduplicates repeat alerts', async () => {
  const unauthReminders = await fetch(`${BASE_URL}/api/reminders/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer forged_jwt' },
    body: JSON.stringify({ circleId: 'unrelated_circle', demoMode: false }),
  });
  assert.equal(unauthReminders.status, 401);

  const today = formatDateKey(new Date());
  const soonIso = new Date(Date.now() + 2 * 3600 * 1000).toISOString();

  const payload = {
    demoMode: true,
    elderlyName: 'Martha Sen',
    recipientEmails: ['family@example.com', 'FAMILY@example.com', 'caregiver@example.com'],
    dateKey: today,
    nowMinutes: 10 * 60 + 15, // 10:15 AM
    medications: [
      {
        id: 'med-missed',
        name: 'Amlodipine',
        dosage: '5 mg',
        times: ['08:00'], // 135m ago > 60m grace -> missed
        startDate: today,
        gracePeriodMinutes: 60,
        archived: false,
      },
      {
        id: 'med-grace',
        name: 'Metformin',
        dosage: '500 mg',
        times: ['09:45'], // 30m ago <= 60m grace -> NOT missed
        startDate: today,
        gracePeriodMinutes: 60,
        archived: false,
      },
      {
        id: 'med-upcoming',
        name: 'Vitamin D3',
        dosage: '1000 IU',
        times: ['10:45'], // 30m ahead <= 45m -> upcoming
        startDate: today,
        gracePeriodMinutes: 60,
        archived: false,
      },
    ],
    logs: [],
    appointments: [
      {
        id: 'appt-soon',
        doctorName: 'Dr. Kavita Rao',
        clinicName: 'Mercy Clinic',
        dateTime: soonIso,
        status: 'upcoming',
        reminderSent: false,
      },
    ],
    openCareAlerts: [
      {
        id: 'task-urgent-1',
        title: 'Refill Amlodipine Prescription',
        notes: 'Only 2 tablets left in organizer',
        createdByName: 'Priya Nair',
      },
    ],
  };

  const res = await fetch(`${BASE_URL}/api/reminders/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    triggeredBy: string;
    recipientCount: number;
    newlyMissed: Array<{ medicationId: string }>;
    upcomingDoses: Array<{ medicationId: string }>;
    appointmentReminders: string[];
    notifications: Array<{ eventType: string; deliveryMode: string; dedupeKey: string; delivered: boolean }>;
  };

  assert.equal(body.triggeredBy, 'demo');
  assert.equal(body.recipientCount, 2, 'Duplicate recipient emails must be deduplicated case-insensitively');
  assert.deepEqual(
    body.newlyMissed.map((m) => m.medicationId),
    ['med-missed']
  );
  assert.deepEqual(
    body.upcomingDoses.map((u) => u.medicationId),
    ['med-upcoming']
  );
  assert.deepEqual(body.appointmentReminders, ['appt-soon']);
  assert.deepEqual(
    body.notifications.map((n) => n.eventType).sort(),
    ['appointment_reminder', 'caregiver_update', 'missed_dose', 'upcoming_dose']
  );
  assert.ok(
    body.notifications.every((n) => n.deliveryMode !== 'real_email' && n.delivered === false),
    'demoMode must never dispatch or claim real emails'
  );

  // Deduplication check: passing emitted dedupeKeys suppresses duplicate notifications
  const dedupeRes = await fetch(`${BASE_URL}/api/reminders/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      alreadyNotifiedKeys: body.notifications.map((n) => n.dedupeKey),
    }),
  });
  assert.equal(dedupeRes.status, 200);
  const dedupeBody = (await dedupeRes.json()) as { notifications: unknown[] };
  assert.equal(dedupeBody.notifications.length, 0);
});

test('Notification test & dispatch endpoints enforce validation, auth, and truthful simulated fallback', async () => {
  const unauthTestEmail = await fetch(`${BASE_URL}/api/notifications/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer invalid_token' },
    body: JSON.stringify({ recipientEmail: 'a@b.com', demoMode: false }),
  });
  assert.equal(unauthTestEmail.status, 401);

  const invalidEmailRes = await fetch(`${BASE_URL}/api/notifications/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipientEmail: 'not-an-email', demoMode: true }),
  });
  assert.equal(invalidEmailRes.status, 400);

  const demoTestRes = await fetch(`${BASE_URL}/api/notifications/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipientEmail: 'rohan@example.com', elderlyName: 'Martha Sen', demoMode: true }),
  });
  assert.equal(demoTestRes.status, 200);
  const demoTest = (await demoTestRes.json()) as {
    deliveryMode: string;
    delivered: boolean;
    emailTarget: string;
  };
  assert.equal(demoTest.deliveryMode, 'simulated_demo');
  assert.equal(demoTest.delivered, false);
  assert.equal(demoTest.emailTarget, 'rohan@example.com');

  const unauthDispatch = await fetch(`${BASE_URL}/api/notifications/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer forged' },
    body: JSON.stringify({
      circleId: 'circle-1',
      eventType: 'caregiver_update',
      title: 'Blood pressure checked',
      message: '122/78 recorded',
      demoMode: false,
    }),
  });
  assert.equal(unauthDispatch.status, 401);

  const badTypeDispatch = await fetch(`${BASE_URL}/api/notifications/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventType: 'unknown_event',
      title: 'Test',
      message: 'Body',
      demoMode: true,
    }),
  });
  assert.equal(badTypeDispatch.status, 400);

  const inAppDispatch = await fetch(`${BASE_URL}/api/notifications/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventType: 'caregiver_update',
      title: 'Caregiver Assistance Alert',
      message: 'Pick up pharmacy refill before 6 PM.',
      recipientEmails: ['rohan@example.com', 'priya@example.com'],
      emailEnabled: false,
      demoMode: true,
    }),
  });
  assert.equal(inAppDispatch.status, 200);
  const inAppBody = (await inAppDispatch.json()) as { deliveryMode: string; delivered: boolean };
  assert.equal(inAppBody.deliveryMode, 'in_app');
  assert.equal(inAppBody.delivered, false);

  const badAi = await fetch(`${BASE_URL}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: '   ', demoMode: true }),
  });
  assert.equal(badAi.status, 400);

  // Live mode must strictly reject forged/missing Bearer tokens BEFORE checking GEMINI_API_KEY
  const unauthAi = await fetch(`${BASE_URL}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer invalid_token' },
    body: JSON.stringify({ message: 'Hello', circleId: 'unrelated_circle_99', demoMode: false }),
  });
  assert.equal(unauthAi.status, 401);

  const noHeaderAi = await fetch(`${BASE_URL}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Hello', circleId: 'unrelated_circle_99', demoMode: false }),
  });
  assert.equal(noHeaderAi.status, 401);

  // Demo mode call either succeeds (200) if GEMINI_API_KEY is injected or returns clean 503 setup message
  const demoAi = await fetch(`${BASE_URL}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Give me a short summary of today.',
      language: 'hi',
      demoMode: true,
      contextSnapshot: { elderlyName: 'Martha Sen', medications: [], todaySchedule: [], weeklyAdherence: { taken: 0, missed: 0, skipped: 0, eligibleTotal: 0, ratePercent: 100 }, upcomingAppointments: [], recentCareNotes: [] },
    }),
  });
  assert.ok(demoAi.status === 200 || demoAi.status === 503, `Expected 200 or 503, got ${demoAi.status}`);
  const demoAiJson = (await demoAi.json()) as { reply?: string; error?: string; groundedSource?: string };
  if (demoAi.status === 200) {
    assert.ok(demoAiJson.reply && demoAiJson.reply.length > 0);
    assert.equal(demoAiJson.groundedSource, 'demo');
  } else {
    assert.match(demoAiJson.error || '', /GEMINI_API_KEY|high demand|temporarily/i);
  }
});

test('Gemini AI integration keeps keys server-side, enforces Firestore grounding, and localizes EN/HI/BN UI', () => {
  const serverSrc = fs.readFileSync(path.join(ROOT, 'server.ts'), 'utf-8');
  const assistantSrc = fs.readFileSync(path.join(ROOT, 'src/pages/AssistantPage.tsx'), 'utf-8');
  const metadataJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'metadata.json'), 'utf-8')) as {
    majorCapabilities?: string[];
  };

  // Server uses @google/genai SDK cleanly with required telemetry header, valid model, and server-side Firestore grounding
  assert.ok(serverSrc.includes("'User-Agent': 'aistudio-build'"));
  assert.ok(serverSrc.includes("model: 'gemini-4-hydrogen'"));
  assert.ok(serverSrc.includes('ThinkingLevel.LOW'));
  assert.ok(serverSrc.includes('ai.models.generateContentStream'));
  assert.ok(serverSrc.includes('buildServerAiContext'));
  assert.ok(serverSrc.includes('NEVER diagnose any disease'));
  assert.ok(serverSrc.includes('NEVER prescribe medications'));
  assert.ok(serverSrc.includes('NEVER invent medication records'));
  assert.ok(metadataJson.majorCapabilities?.includes('MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API'));

  // Client never touches @google/genai or GEMINI_API_KEY and includes inline EN/HI/BN switcher + Retry + Clear Chat
  assert.equal(assistantSrc.includes('@google/genai'), false);
  assert.equal(assistantSrc.includes('GEMINI_API_KEY'), false);
  assert.ok(assistantSrc.includes('English'));
  assert.ok(assistantSrc.includes('हिन्दी'));
  assert.ok(assistantSrc.includes('বাংলা'));
  assert.ok(assistantSrc.includes('Clear Chat'));
  assert.ok(assistantSrc.includes('Retry'));
});

async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

test('Configured webhook provider & CRON_SECRET confirm real deliveries and truthfully downgrade rejected deliveries', async () => {
  let webhookMode: 'accept' | 'reject_500' | 'reject_body' = 'accept';
  const receivedPayloads: Array<{ to: string; eventType: string; subject: string; auth?: string }> = [];

  const webhookServer = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const parsed = JSON.parse(Buffer.concat(chunks).toString('utf-8')) as {
        to: string;
        eventType: string;
        subject: string;
      };
      receivedPayloads.push({
        to: parsed.to,
        eventType: parsed.eventType,
        subject: parsed.subject,
        auth: req.headers.authorization,
      });

      if (webhookMode === 'reject_500') {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'SMTP upstream outage' }));
        return;
      }
      if (webhookMode === 'reject_body') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ accepted: false, error: 'Recipient bounced' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: `wh_msg_${receivedPayloads.length}` }));
    });
  });

  await new Promise<void>((resolve) => webhookServer.listen(0, '127.0.0.1', resolve));
  const whAddr = webhookServer.address();
  const whPort = typeof whAddr === 'object' && whAddr ? whAddr.port : 0;

  const testPort = await getAvailablePort();
  const cronSecret = 'test-cron-secret-value-9988';
  const webhookAuth = 'Bearer wh-token-secret-77';

  const isolatedProc = spawn(TSX_BIN, ['server.ts'], {
    cwd: ROOT,
    stdio: 'ignore',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(testPort),
      EMAIL_PROVIDER: 'webhook',
      EMAIL_FROM: 'CareCircle Alerts <alerts@carecircle.test>',
      EMAIL_WEBHOOK_URL: `http://127.0.0.1:${whPort}/send`,
      EMAIL_WEBHOOK_AUTH_HEADER: webhookAuth,
      CRON_SECRET: cronSecret,
    },
  });

  const testBaseUrl = `http://127.0.0.1:${testPort}`;

  try {
    const deadline = Date.now() + 20_000;
    let ready = false;
    while (Date.now() < deadline) {
      try {
        const ping = await fetch(`${testBaseUrl}/api/health`);
        if (ping.ok) {
          ready = true;
          break;
        }
      } catch {
        // retry until listening
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    assert.ok(ready, 'Ephemeral configured test server failed to start');

    // 1. /api/email/status confirms readiness without exposing CRON_SECRET or webhookAuth
    const statusRes = await fetch(`${testBaseUrl}/api/email/status`);
    assert.equal(statusRes.status, 200);
    const statusJson = (await statusRes.json()) as {
      configured: boolean;
      provider: string;
      schedulerConfigured: boolean;
      fromEmail: string;
      missingRequirements: string[];
    };
    assert.equal(statusJson.configured, true);
    assert.equal(statusJson.provider, 'webhook');
    assert.equal(statusJson.schedulerConfigured, true);
    assert.equal(statusJson.fromEmail, 'CareCircle Alerts <alerts@carecircle.test>');
    assert.equal(statusJson.missingRequirements.length, 0);
    const rawStatus = JSON.stringify(statusJson);
    assert.equal(rawStatus.includes(cronSecret), false);
    assert.equal(rawStatus.includes(webhookAuth), false);

    // 2. Wrong x-cron-secret in live mode -> 401
    const wrongCronRes = await fetch(`${testBaseUrl}/api/reminders/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': 'wrong-secret',
      },
      body: JSON.stringify({ demoMode: false }),
    });
    assert.equal(wrongCronRes.status, 401);

    // 3. Valid x-cron-secret with accepting webhook -> confirmed real_email across all 4 categories
    const today = formatDateKey(new Date());
    const soonIso = new Date(Date.now() + 90 * 60 * 1000).toISOString();
    const cronPayload = {
      demoMode: false,
      elderlyName: 'Martha Sen',
      recipientEmails: ['rohan@example.com', 'priya@example.com'],
      dateKey: today,
      nowMinutes: 10 * 60 + 15,
      medications: [
        {
          id: 'med-1',
          name: 'Amlodipine',
          dosage: '5 mg',
          times: ['08:00', '10:30'],
          startDate: today,
          gracePeriodMinutes: 60,
          archived: false,
        },
      ],
      logs: [],
      appointments: [
        {
          id: 'appt-1',
          doctorName: 'Dr. Kavita Rao',
          clinicName: 'Mercy Clinic',
          dateTime: soonIso,
          status: 'upcoming',
          reminderSent: false,
        },
      ],
      openCareAlerts: [
        {
          id: 'task-1',
          title: 'Blood pressure cuff battery low',
          notes: 'Replace AA batteries',
          createdByName: 'Priya Nair',
        },
      ],
    };

    const okCronRes = await fetch(`${testBaseUrl}/api/reminders/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret,
      },
      body: JSON.stringify(cronPayload),
    });
    assert.equal(okCronRes.status, 200);
    const okCronBody = (await okCronRes.json()) as {
      triggeredBy: string;
      notifications: Array<{
        eventType: string;
        deliveryMode: string;
        providerName: string;
        providerMessageId: string;
        delivered: boolean;
      }>;
    };

    assert.equal(okCronBody.triggeredBy, 'cron');
    assert.equal(okCronBody.notifications.length, 4);
    for (const notif of okCronBody.notifications) {
      assert.equal(notif.deliveryMode, 'real_email');
      assert.equal(notif.providerName, 'webhook');
      assert.equal(notif.delivered, true);
      assert.match(notif.providerMessageId, /^wh_msg_/);
    }
    // 4 event notifications x 2 unique recipients = 8 webhook calls
    assert.equal(receivedPayloads.length, 8);
    assert.ok(receivedPayloads.every((p) => p.auth === webhookAuth));

    // 4. Truthfulness check: if webhook returns HTTP 500, NEVER claim real_email or delivered=true
    webhookMode = 'reject_500';
    const fail500Res = await fetch(`${testBaseUrl}/api/reminders/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cronSecret}`,
      },
      body: JSON.stringify(cronPayload),
    });
    assert.equal(fail500Res.status, 200);
    const fail500Body = (await fail500Res.json()) as {
      notifications: Array<{ deliveryMode: string; delivered: boolean; note: string }>;
    };
    assert.equal(fail500Body.notifications.length, 4);
    for (const notif of fail500Body.notifications) {
      assert.equal(notif.delivered, false);
      assert.equal(notif.deliveryMode, 'simulated_demo');
      assert.match(notif.note, /HTTP 500/);
    }

    // 5. Truthfulness check: if webhook returns HTTP 200 with { accepted: false }, NEVER claim sent
    webhookMode = 'reject_body';
    const failBodyRes = await fetch(`${testBaseUrl}/api/reminders/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret,
      },
      body: JSON.stringify(cronPayload),
    });
    assert.equal(failBodyRes.status, 200);
    const failBody = (await failBodyRes.json()) as {
      notifications: Array<{ deliveryMode: string; delivered: boolean; note: string }>;
    };
    for (const notif of failBody.notifications) {
      assert.equal(notif.delivered, false);
      assert.equal(notif.deliveryMode, 'simulated_demo');
    }
  } finally {
    isolatedProc.kill('SIGTERM');
    await new Promise<void>((resolve) => webhookServer.close(() => resolve()));
  }
});

// ── 5. Multi-Profile Demo Mode, Local Schedule Utils & Audit Fixes ────────

test('Multi-profile demo mode isolates Martha Sen & Harish Kapoor circles and supports clean resets', () => {
  assert.equal(Object.keys(DEMO_PROFILES).length, 2);
  const allSeeds = createAllDemoSeeds();
  const sen = allSeeds['demo-circle-sen'];
  const kapoor = allSeeds['demo-circle-kapoor'];

  assert.equal(sen.profile.elderlyName, 'Martha Sen');
  assert.equal(sen.profile.elderlyAge, 74);
  assert.equal(kapoor.profile.elderlyName, 'Harish Kapoor');
  assert.equal(kapoor.profile.elderlyAge, 79);

  // Distinct circle IDs, member UIDs, medications, and open notifications/tasks
  assert.notEqual(sen.profile.id, kapoor.profile.id);
  const senUids = new Set(sen.members.map((m) => m.uid));
  for (const m of kapoor.members) {
    assert.equal(senUids.has(m.uid), false, `Expected isolated UIDs between circles, collided on ${m.uid}`);
  }
  const senMedIds = new Set(sen.medications.map((m) => m.id));
  for (const med of kapoor.medications) {
    assert.equal(senMedIds.has(med.id), false, `Expected unique medication IDs, collided on ${med.id}`);
  }

  // Pending unrevoked invitations exist on both circles for judge testing
  assert.ok(sen.invitations.some((inv) => inv.usedAt === null && inv.revokedAt === null));
  assert.ok(kapoor.invitations.some((inv) => inv.usedAt === null && inv.revokedAt === null));

  // Mutating an existing seed bundle must NOT pollute subsequent fresh resets
  sen.medications.push({
    id: 'mutated-med',
    name: 'Temp',
    dosage: '1 mg',
    frequency: 'once_daily',
    times: ['12:00'],
    startDate: '2026-01-01',
    endDate: '',
    instructions: '',
    prescribingDoctor: '',
    gracePeriodMinutes: 60,
    archived: false,
    createdBy: 'test',
  });
  const freshSen = createDemoSeedData('demo-circle-sen');
  assert.equal(freshSen.medications.some((m) => m.id === 'mutated-med'), false);

  // Role actors exist cleanly for all 3 personas across both profiles
  for (const circleId of ['demo-circle-sen', 'demo-circle-kapoor'] as const) {
    const elderly = getDemoActor(circleId, 'elderly');
    const family = getDemoActor(circleId, 'family');
    const caregiver = getDemoActor(circleId, 'caregiver');
    assert.equal(elderly.uid, DEMO_PROFILES[circleId].actors.elderly.uid);
    assert.equal(family.uid, DEMO_PROFILES[circleId].actors.family.uid);
    assert.equal(caregiver.uid, DEMO_PROFILES[circleId].actors.caregiver.uid);
    assert.notEqual(elderly.uid, family.uid);
    assert.notEqual(family.uid, caregiver.uid);
  }
});

test('toLocalDateTimeInputValue and matchesAuditCategory behave consistently without UTC drift', () => {
  const localSample = new Date(2026, 4, 15, 9, 5);
  assert.equal(toLocalDateTimeInputValue(localSample), '2026-05-15T09:05');

  const mkAct = (action: string) => ({
    id: 'act-1',
    actorUid: 'u1',
    actorName: 'Tester',
    actorRole: 'family' as const,
    action,
    targetName: 'Target',
    details: 'Details',
    createdAt: '2026-05-15T09:05:00.000Z',
  });

  assert.equal(matchesAuditCategory(mkAct('Logged Dose Taken'), 'medications'), true);
  assert.equal(matchesAuditCategory(mkAct('Added Medicine'), 'medications'), true);
  assert.equal(matchesAuditCategory(mkAct('Created CareCircle Invitation'), 'collaboration'), true);
  assert.equal(matchesAuditCategory(mkAct('Updated Member Permissions'), 'collaboration'), true);
  assert.equal(matchesAuditCategory(mkAct('Scheduled Appointment'), 'appointments'), true);
  assert.equal(matchesAuditCategory(mkAct('Added Care Note'), 'tasks'), true);
  assert.equal(matchesAuditCategory(mkAct('Added Care Note'), 'all'), true);
  assert.equal(matchesAuditCategory(mkAct('Logged Dose Taken'), 'appointments'), false);
});

test('Audit regression checks verify ErrorBoundary, local datetime inputs, filter sync, AI reset, and AAA contrast', () => {
  const appSrc = fs.readFileSync(path.join(ROOT, 'src/App.tsx'), 'utf-8');
  const appShellSrc = fs.readFileSync(path.join(ROOT, 'src/components/AppShell.tsx'), 'utf-8');
  const dashboardSrc = fs.readFileSync(path.join(ROOT, 'src/pages/DashboardPage.tsx'), 'utf-8');
  const apptsSrc = fs.readFileSync(path.join(ROOT, 'src/pages/AppointmentsPage.tsx'), 'utf-8');
  const assistantSrc = fs.readFileSync(path.join(ROOT, 'src/pages/AssistantPage.tsx'), 'utf-8');
  const cssSrc = fs.readFileSync(path.join(ROOT, 'src/index.css'), 'utf-8');

  assert.ok(appSrc.includes('CareCircleErrorBoundary'), 'App.tsx must wrap provider with ErrorBoundary');
  assert.ok(appShellSrc.includes('resetDemoSandbox'), 'AppShell must expose 1-click demo reset');
  assert.ok(appShellSrc.includes('switchDemoCircle'), 'AppShell must expose multi-profile switcher');

  assert.equal(
    dashboardSrc.includes('.toISOString().slice(0, 16)'),
    false,
    'DashboardPage must use toLocalDateTimeInputValue instead of UTC toISOString slice'
  );
  assert.equal(
    apptsSrc.includes('.toISOString().slice(0, 16)'),
    false,
    'AppointmentsPage must use toLocalDateTimeInputValue instead of UTC toISOString slice'
  );
  assert.ok(
    apptsSrc.includes('for (const appt of sortedAppointments)'),
    'AppointmentsPage calendar grid must derive from status-filtered sortedAppointments'
  );
  assert.ok(
    assistantSrc.includes('}, [activeCircle?.id]);'),
    'AssistantPage must reset chat thread when switching active CareCircle'
  );
  assert.ok(
    cssSrc.includes('html.high-contrast input'),
    'index.css must override input/control colors cleanly in light + high-contrast mode'
  );
});


