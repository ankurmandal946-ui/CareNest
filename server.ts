import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import {
  computeScheduleForDate,
  computeWeeklyAdherence,
  formatDateKey,
} from './src/lib/scheduleUtils.ts';
import type {
  Appointment,
  CareTask,
  Medication,
  MedicationLog,
  UserRole,
} from './src/types/carecircle.ts';

interface FirebaseAppletConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId: string;
}

function loadFirebaseConfig(): FirebaseAppletConfig | null {
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) return null;
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as FirebaseAppletConfig;
  } catch (err) {
    console.error('Failed to read firebase-applet-config.json:', err);
    return null;
  }
}

const firebaseConfig = loadFirebaseConfig();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

interface VerifiedUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
}

async function verifyFirebaseIdToken(authHeader?: string): Promise<VerifiedUser | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken || !firebaseConfig?.apiKey) return null;

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      users?: Array<{
        localId: string;
        email?: string;
        emailVerified?: boolean;
        displayName?: string;
      }>;
    };
    const u = data.users?.[0];
    if (!u || !u.localId) return null;
    return {
      uid: u.localId,
      email: u.email || '',
      emailVerified: Boolean(u.emailVerified),
      displayName: u.displayName || u.email?.split('@')[0] || 'CareCircle User',
    };
  } catch {
    return null;
  }
}

function firestoreBaseUrl(): string {
  if (!firebaseConfig) throw new Error('Firebase is not configured');
  return `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents`;
}

type FsValue =
  | { stringValue: string }
  | { integerValue: string }
  | { booleanValue: boolean }
  | { timestampValue: string }
  | { nullValue: null }
  | { arrayValue: { values: FsValue[] } };

function toFsValue(val: unknown): FsValue {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') return { integerValue: String(Math.trunc(val)) };
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(toFsValue) } };
  return { stringValue: String(val) };
}

function fromFsValue(val: Record<string, unknown> | undefined): unknown {
  if (!val) return undefined;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('timestampValue' in val) return val.timestampValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) {
    const arr = val.arrayValue as { values?: Array<Record<string, unknown>> };
    return (arr.values || []).map(fromFsValue);
  }
  return undefined;
}

function fromFsDoc(doc: { name?: string; fields?: Record<string, Record<string, unknown>> }): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (doc.fields) {
    for (const [k, v] of Object.entries(doc.fields)) {
      out[k] = fromFsValue(v);
    }
  }
  return out;
}

async function fsGetDoc(docPath: string, idToken: string): Promise<Record<string, unknown> | null> {
  const url = `${firestoreBaseUrl()}/${docPath}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore read failed (${res.status}): ${errText}`);
  }
  const json = (await res.json()) as { name?: string; fields?: Record<string, Record<string, unknown>> };
  return fromFsDoc(json);
}

async function fsGetDocWithAccess(
  docPath: string,
  idToken: string
): Promise<{ status: 'ok'; data: Record<string, unknown> } | { status: 'not_found' } | { status: 'forbidden' }> {
  const url = `${firestoreBaseUrl()}/${docPath}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (res.status === 404) return { status: 'not_found' };
  if (res.status === 403 || res.status === 401) return { status: 'forbidden' };
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore read failed (${res.status}): ${errText}`);
  }
  const json = (await res.json()) as { name?: string; fields?: Record<string, Record<string, unknown>> };
  return { status: 'ok', data: fromFsDoc(json) };
}

async function fsListDocs(collectionPath: string, idToken: string, maxDocs = 300): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let pageToken = '';

  while (items.length < maxDocs) {
    const pageSize = Math.min(200, maxDocs - items.length);
    const qs = new URLSearchParams({ pageSize: String(pageSize) });
    if (pageToken) qs.set('pageToken', pageToken);
    const url = `${firestoreBaseUrl()}/${collectionPath}?${qs.toString()}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (res.status === 404) break;
    if (res.status === 403 || res.status === 401) {
      throw new Error(`PERMISSION_DENIED: Cannot read ${collectionPath}`);
    }
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Firestore list failed (${res.status}): ${errText}`);
    }
    const json = (await res.json()) as {
      documents?: Array<{ name?: string; fields?: Record<string, Record<string, unknown>> }>;
      nextPageToken?: string;
    };
    for (const docItem of json.documents || []) {
      const parsed = fromFsDoc(docItem);
      const docId = docItem.name ? docItem.name.split('/').pop() || '' : '';
      if (docId && !parsed.id) {
        parsed.id = docId;
      }
      items.push(parsed);
    }
    if (!json.nextPageToken) break;
    pageToken = json.nextPageToken;
  }

  return items;
}

async function fsCommit(writes: unknown[], idToken: string): Promise<void> {
  if (!firebaseConfig) throw new Error('Firebase is not configured');
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents:commit`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ writes }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore commit failed (${res.status}): ${errText}`);
  }
}

function docName(docPath: string): string {
  if (!firebaseConfig) throw new Error('Firebase is not configured');
  return `projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/${docPath}`;
}

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function generateInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  let part1 = '';
  let part2 = '';
  for (let i = 0; i < 4; i++) {
    part1 += alphabet[bytes[i] % alphabet.length];
    part2 += alphabet[bytes[i + 4] % alphabet.length];
  }
  return `CC-${part1}-${part2}`;
}

function normalizeInviteCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

type EmailProviderKind = 'resend' | 'sendgrid' | 'webhook' | 'simulated_demo';

interface EmailServiceConfig {
  configured: boolean;
  provider: EmailProviderKind;
  requestedProvider: 'auto' | 'resend' | 'sendgrid' | 'webhook';
  fromEmail: string;
  resendApiKey: string;
  sendgridApiKey: string;
  webhookUrl: string;
  webhookAuthHeader: string;
  schedulerConfigured: boolean;
  cronSecret: string;
  missingRequirements: string[];
}

function resolveEmailServiceConfig(): EmailServiceConfig {
  const rawReq = (process.env.EMAIL_PROVIDER || 'auto').trim().toLowerCase();
  const requestedProvider: EmailServiceConfig['requestedProvider'] =
    rawReq === 'resend' || rawReq === 'sendgrid' || rawReq === 'webhook' ? rawReq : 'auto';

  const resendApiKey = process.env.RESEND_API_KEY?.trim() || '';
  const sendgridApiKey = process.env.SENDGRID_API_KEY?.trim() || '';
  const webhookUrl = process.env.EMAIL_WEBHOOK_URL?.trim() || '';
  const webhookAuthHeader = process.env.EMAIL_WEBHOOK_AUTH_HEADER?.trim() || '';
  const fromEmail =
    process.env.EMAIL_FROM?.trim() ||
    process.env.RESEND_FROM_EMAIL?.trim() ||
    'CareCircle <onboarding@resend.dev>';
  const cronSecret = process.env.CRON_SECRET?.trim() || '';

  const hasValidWebhook = /^https?:\/\/.+/i.test(webhookUrl);

  let provider: EmailProviderKind = 'simulated_demo';
  if (requestedProvider === 'resend') {
    provider = resendApiKey ? 'resend' : 'simulated_demo';
  } else if (requestedProvider === 'sendgrid') {
    provider = sendgridApiKey ? 'sendgrid' : 'simulated_demo';
  } else if (requestedProvider === 'webhook') {
    provider = hasValidWebhook ? 'webhook' : 'simulated_demo';
  } else {
    if (resendApiKey) provider = 'resend';
    else if (sendgridApiKey) provider = 'sendgrid';
    else if (hasValidWebhook) provider = 'webhook';
  }

  const configured = provider !== 'simulated_demo';
  const schedulerConfigured = Boolean(cronSecret);
  const missingRequirements: string[] = [];

  if (!configured) {
    if (requestedProvider === 'resend') {
      missingRequirements.push('EMAIL_PROVIDER is set to "resend", but RESEND_API_KEY is missing.');
    } else if (requestedProvider === 'sendgrid') {
      missingRequirements.push('EMAIL_PROVIDER is set to "sendgrid", but SENDGRID_API_KEY is missing.');
    } else if (requestedProvider === 'webhook') {
      missingRequirements.push(
        'EMAIL_PROVIDER is set to "webhook", but a valid http(s) EMAIL_WEBHOOK_URL is missing.'
      );
    } else {
      missingRequirements.push(
        'No email provider credential configured. Set RESEND_API_KEY, SENDGRID_API_KEY, or EMAIL_WEBHOOK_URL (plus EMAIL_FROM) in server environment secrets.'
      );
    }
  }

  if (!schedulerConfigured) {
    missingRequirements.push(
      'CRON_SECRET is not set. Configure CRON_SECRET in server environment secrets before triggering POST /api/reminders/process from an external cron scheduler.'
    );
  }

  return {
    configured,
    provider,
    requestedProvider,
    fromEmail,
    resendApiKey,
    sendgridApiKey,
    webhookUrl,
    webhookAuthHeader,
    schedulerConfigured,
    cronSecret,
    missingRequirements,
  };
}

function isCronSecretAuthorized(req: express.Request, expectedSecret: string): boolean {
  if (!expectedSecret) return false;
  const headerVal = req.headers['x-cron-secret'];
  const rawHeader = Array.isArray(headerVal) ? headerVal[0] : headerVal;
  let candidate = (rawHeader || '').trim();
  if (!candidate && typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer ')) {
    candidate = req.headers.authorization.slice('Bearer '.length).trim();
  }
  if (!candidate) return false;
  const digestA = crypto.createHash('sha256').update(candidate).digest();
  const digestB = crypto.createHash('sha256').update(expectedSecret).digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

function parseFromHeader(fromHeader: string): { email: string; name?: string } {
  const match = fromHeader.match(/^\s*([^<>]+?)\s*<([^<>@\s]+@[^<>@\s]+\.[^<>@\s]+)>\s*$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { email: fromHeader.trim() };
}

function normalizeEmailList(emails: string[] | undefined): string[] {
  if (!Array.isArray(emails)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of emails) {
    const clean = String(raw || '').trim();
    if (!clean || clean.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= 25) break;
  }
  return out;
}

interface EmailDispatchResult {
  delivered: boolean;
  mode: 'real_email' | 'simulated_demo' | 'in_app';
  providerName: string;
  providerMessageId: string;
  emailTarget: string;
  deliveredRecipients: string[];
  failedRecipients: string[];
  note: string;
}

async function deliverSingleEmail(
  cfg: EmailServiceConfig,
  params: { to: string; subject: string; text: string; html: string; eventType: string }
): Promise<{ ok: boolean; messageId: string; error?: string }> {
  if (cfg.provider === 'resend') {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: cfg.fromEmail,
        to: [params.to],
        subject: params.subject,
        text: params.text,
        html: params.html,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, messageId: '', error: `Resend HTTP ${res.status}: ${errText.slice(0, 140)}` };
    }
    const json = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, messageId: json.id ? String(json.id) : 'resend-accepted' };
  }

  if (cfg.provider === 'sendgrid') {
    const fromParsed = parseFromHeader(cfg.fromEmail);
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.sendgridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: params.to }], subject: params.subject }],
        from: fromParsed.name ? { email: fromParsed.email, name: fromParsed.name } : { email: fromParsed.email },
        content: [
          { type: 'text/plain', value: params.text },
          { type: 'text/html', value: params.html },
        ],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, messageId: '', error: `SendGrid HTTP ${res.status}: ${errText.slice(0, 140)}` };
    }
    const msgId = res.headers.get('x-message-id') || 'sendgrid-accepted';
    return { ok: true, messageId: msgId };
  }

  if (cfg.provider === 'webhook') {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (cfg.webhookAuthHeader) {
      headers.Authorization = cfg.webhookAuthHeader;
    }
    const res = await fetch(cfg.webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        source: 'CareCircle',
        eventType: params.eventType,
        from: cfg.fromEmail,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, messageId: '', error: `Webhook HTTP ${res.status}: ${errText.slice(0, 140)}` };
    }
    const json = (await res.json().catch(() => ({}))) as {
      accepted?: boolean;
      delivered?: boolean;
      ok?: boolean;
      id?: string;
      messageId?: string;
    };
    if (json.accepted === false || json.delivered === false || json.ok === false) {
      return { ok: false, messageId: '', error: 'Webhook reported delivered/accepted = false' };
    }
    return {
      ok: true,
      messageId: String(json.messageId || json.id || 'webhook-accepted'),
    };
  }

  return { ok: false, messageId: '', error: 'No email provider configured' };
}

async function sendEmailViaAdapter(params: {
  recipients: string[];
  subject: string;
  text: string;
  html?: string;
  eventType: string;
  allowReal: boolean;
  emailEnabled: boolean;
}): Promise<EmailDispatchResult> {
  const cfg = resolveEmailServiceConfig();
  const recipients = normalizeEmailList(params.recipients);
  const emailTarget = recipients.join(', ').slice(0, 254);

  if (!params.emailEnabled) {
    return {
      delivered: false,
      mode: 'in_app',
      providerName: 'in_app',
      providerMessageId: '',
      emailTarget: '',
      deliveredRecipients: [],
      failedRecipients: [],
      note: 'Email delivery disabled in preferences; recorded as In-App Alert.',
    };
  }

  if (recipients.length === 0) {
    return {
      delivered: false,
      mode: 'in_app',
      providerName: 'in_app',
      providerMessageId: '',
      emailTarget: '',
      deliveredRecipients: [],
      failedRecipients: [],
      note: 'No opted-in CareCircle member email addresses found; recorded as In-App Alert.',
    };
  }

  if (!params.allowReal) {
    return {
      delivered: false,
      mode: 'simulated_demo',
      providerName: 'simulated',
      providerMessageId: '',
      emailTarget,
      deliveredRecipients: [],
      failedRecipients: recipients,
      note: 'Demo Sandbox active: email simulated locally and NOT sent externally.',
    };
  }

  if (!cfg.configured) {
    return {
      delivered: false,
      mode: 'simulated_demo',
      providerName: 'simulated',
      providerMessageId: '',
      emailTarget,
      deliveredRecipients: [],
      failedRecipients: recipients,
      note: 'Email credentials not configured on server; recorded in Simulated Notification Mode (no email sent).',
    };
  }

  const html = params.html || `<p>${params.text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')}</p>`;
  const deliveredRecipients: string[] = [];
  const failedRecipients: string[] = [];
  const confirmedIds: string[] = [];
  const errors: string[] = [];

  for (const to of recipients) {
    try {
      const outcome = await deliverSingleEmail(cfg, {
        to,
        subject: params.subject,
        text: params.text,
        html,
        eventType: params.eventType,
      });
      if (outcome.ok) {
        deliveredRecipients.push(to);
        if (outcome.messageId) confirmedIds.push(outcome.messageId);
      } else {
        failedRecipients.push(to);
        if (outcome.error) errors.push(outcome.error);
      }
    } catch (err) {
      failedRecipients.push(to);
      errors.push(err instanceof Error ? err.message : 'Network error');
    }
  }

  const anyDelivered = deliveredRecipients.length > 0;
  const providerMessageId = (confirmedIds[0] || '').slice(0, 200);

  if (anyDelivered) {
    const partialSuffix =
      failedRecipients.length > 0
        ? ` (${failedRecipients.length} failed: ${errors[0] || 'rejected'})`
        : '';
    return {
      delivered: true,
      mode: 'real_email',
      providerName: cfg.provider,
      providerMessageId,
      emailTarget: deliveredRecipients.join(', ').slice(0, 254),
      deliveredRecipients,
      failedRecipients,
      note: `Confirmed by ${cfg.provider} for ${deliveredRecipients.length}/${recipients.length} recipient(s)${providerMessageId ? ` (Ref: ${providerMessageId})` : ''}${partialSuffix}.`,
    };
  }

  return {
    delivered: false,
    mode: 'simulated_demo',
    providerName: cfg.provider,
    providerMessageId: '',
    emailTarget,
    deliveredRecipients: [],
    failedRecipients,
    note: `Provider (${cfg.provider}) failed to confirm delivery (${errors[0] || 'unknown error'}). Logged locally without claiming email delivery.`,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // ── Health & Email Provider Status ───────────────────────────────────
  app.get('/api/health', (_req, res) => {
    const cfg = resolveEmailServiceConfig();
    res.json({
      status: 'ok',
      firebaseConfigured: Boolean(firebaseConfig),
      emailProvider: cfg.provider,
      schedulerConfigured: cfg.schedulerConfigured,
      aiConfigured: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  app.get('/api/email/status', (_req, res) => {
    const cfg = resolveEmailServiceConfig();
    res.json({
      configured: cfg.configured,
      provider: cfg.provider,
      requestedProvider: cfg.requestedProvider,
      fromEmail: cfg.configured ? cfg.fromEmail : 'Simulated Notification Mode (No Sender Configured)',
      schedulerConfigured: cfg.schedulerConfigured,
      cronEndpoint: '/api/reminders/process',
      cronHeader: 'x-cron-secret',
      supportedProviders: ['resend', 'sendgrid', 'webhook'],
      missingRequirements: cfg.missingRequirements,
    });
  });

  // ── Secure Invitation Creation (SHA-256 hashed on server) ────────────
  app.post('/api/invitations/create', async (req, res) => {
    try {
      const {
        circleId,
        elderlyName,
        role,
        relation,
        canEditMedications,
        canManageAppointments,
        canLogDoses,
        canManageMembers,
        expiresHours,
        demoMode,
      } = req.body as {
        circleId?: string;
        elderlyName?: string;
        role?: 'elderly' | 'family' | 'caregiver';
        relation?: string;
        canEditMedications?: boolean;
        canManageAppointments?: boolean;
        canLogDoses?: boolean;
        canManageMembers?: boolean;
        expiresHours?: number;
        demoMode?: boolean;
      };

      if (!circleId || !/^[a-zA-Z0-9_-]{1,128}$/.test(circleId) || !role || !['elderly', 'family', 'caregiver'].includes(role)) {
        res.status(400).json({ error: 'Valid circleId and role (elderly, family, or caregiver) are required.' });
        return;
      }

      const defaultRelation =
        role === 'elderly'
          ? 'Elderly Care Recipient'
          : role === 'caregiver'
          ? 'Caregiver'
          : 'Family Member';
      const resolvedRelation = (relation || defaultRelation).trim().slice(0, 64) || defaultRelation;

      // Role-appropriate defaults: family logs doses & manages appts by default; elderly & caregiver get care defaults
      const resolvedCanLogDoses = canLogDoses !== undefined ? Boolean(canLogDoses) : true;
      const resolvedCanManageAppts = canManageAppointments !== undefined ? Boolean(canManageAppointments) : true;
      const resolvedCanEditMeds =
        canEditMedications !== undefined
          ? Boolean(canEditMedications)
          : role === 'elderly' || role === 'caregiver';
      const resolvedCanManageMembers = Boolean(canManageMembers);

      const hours = Math.min(Math.max(Number(expiresHours || 48), 1), 168);
      const code = generateInviteCode();
      const codeHash = sha256Hex(normalizeInviteCode(code));
      const expiresAt = new Date(Date.now() + hours * 3600 * 1000);

      if (demoMode) {
        res.json({
          code,
          codeHash,
          circleId,
          role,
          relation: resolvedRelation,
          canEditMedications: resolvedCanEditMeds,
          canManageAppointments: resolvedCanManageAppts,
          canLogDoses: resolvedCanLogDoses,
          canManageMembers: resolvedCanManageMembers,
          expiresAt: expiresAt.toISOString(),
          mode: 'demo',
        });
        return;
      }

      const authHeader = req.headers.authorization;
      const user = await verifyFirebaseIdToken(authHeader);
      if (!user || !user.emailVerified) {
        res.status(401).json({ error: 'Verified authentication is required to create an invitation.' });
        return;
      }

      const idToken = authHeader!.slice('Bearer '.length).trim();
      const circle = await fsGetDoc(`careCircles/${circleId}`, idToken);
      if (!circle) {
        res.status(404).json({ error: 'CareCircle not found or access denied.' });
        return;
      }

      const requesterMember = await fsGetDoc(`careCircles/${circleId}/members/${user.uid}`, idToken);
      const isOwner = circle.ownerId === user.uid;
      const isOrganizer = isOwner || requesterMember?.canManageMembers === true;

      if (!isOrganizer) {
        res.status(403).json({
          error: 'Only the CareCircle owner or an authorized organizer can generate invitations.',
        });
        return;
      }

      if (resolvedCanManageMembers && !isOwner) {
        res.status(403).json({
          error: 'Only the CareCircle owner can delegate organizer invitation rights.',
        });
        return;
      }

      const resolvedElderlyName = String(elderlyName || circle.elderlyName || 'CareCircle Member').slice(0, 100);
      const actorName = String(requesterMember?.displayName || user.displayName || 'CareCircle Organizer').slice(0, 100);
      const actorRole = String(requesterMember?.role || (isOwner ? 'elderly' : 'family'));
      const inviteDocPath = `invitations/${codeHash}`;
      const circleInviteDocPath = `careCircles/${circleId}/invitations/${codeHash}`;
      const activityId = `act_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const activityPath = `careCircles/${circleId}/activityLogs/${activityId}`;

      const inviteFields = {
        codeHash: toFsValue(codeHash),
        circleId: toFsValue(circleId),
        elderlyName: toFsValue(resolvedElderlyName),
        role: toFsValue(role),
        relation: toFsValue(resolvedRelation),
        canEditMedications: toFsValue(resolvedCanEditMeds),
        canManageAppointments: toFsValue(resolvedCanManageAppts),
        canLogDoses: toFsValue(resolvedCanLogDoses),
        canManageMembers: toFsValue(resolvedCanManageMembers),
        createdBy: toFsValue(user.uid),
        createdByName: toFsValue(actorName),
        expiresAt: toFsValue(expiresAt),
        usedAt: toFsValue(null),
        acceptedBy: toFsValue(null),
        acceptedByName: toFsValue(null),
        revokedAt: toFsValue(null),
        revokedBy: toFsValue(null),
      };

      await fsCommit(
        [
          {
            update: {
              name: docName(inviteDocPath),
              fields: inviteFields,
            },
            currentDocument: { exists: false },
            updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
          },
          {
            update: {
              name: docName(circleInviteDocPath),
              fields: inviteFields,
            },
            currentDocument: { exists: false },
            updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
          },
          {
            update: {
              name: docName(activityPath),
              fields: {
                id: toFsValue(activityId),
                actorUid: toFsValue(user.uid),
                actorName: toFsValue(actorName),
                actorRole: toFsValue(actorRole),
                action: toFsValue('Created CareCircle Invitation'),
                targetName: toFsValue(`${role} (${resolvedRelation})`),
                details: toFsValue(
                  `Expires in ${hours}h · ${resolvedCanLogDoses ? 'Log Doses' : 'View Logs'}${
                    resolvedCanEditMeds ? ' · Edit Meds' : ''
                  }${resolvedCanManageMembers ? ' · Organizer' : ''}`
                ),
              },
            },
            currentDocument: { exists: false },
            updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
          },
        ],
        idToken
      );

      res.json({
        code,
        codeHash,
        circleId,
        role,
        relation: resolvedRelation,
        canEditMedications: resolvedCanEditMeds,
        canManageAppointments: resolvedCanManageAppts,
        canLogDoses: resolvedCanLogDoses,
        canManageMembers: resolvedCanManageMembers,
        expiresAt: expiresAt.toISOString(),
        mode: 'firestore',
      });
    } catch (err) {
      console.error('Invitation creation error:', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create invitation.' });
    }
  });

  // ── Revoke Pending Invitation ─────────────────────────────────────────
  app.post('/api/invitations/revoke', async (req, res) => {
    try {
      const { circleId, codeHash, demoMode } = req.body as {
        circleId?: string;
        codeHash?: string;
        demoMode?: boolean;
      };

      if (
        !circleId ||
        !/^[a-zA-Z0-9_-]{1,128}$/.test(circleId) ||
        !codeHash ||
        !/^[a-f0-9]{64}$/.test(codeHash)
      ) {
        res.status(400).json({ error: 'Valid circleId and SHA-256 codeHash are required.' });
        return;
      }

      if (demoMode) {
        res.json({
          codeHash,
          revokedAt: new Date().toISOString(),
          status: 'revoked',
          mode: 'demo',
        });
        return;
      }

      const authHeader = req.headers.authorization;
      const user = await verifyFirebaseIdToken(authHeader);
      if (!user || !user.emailVerified) {
        res.status(401).json({ error: 'Verified authentication is required to revoke an invitation.' });
        return;
      }

      const idToken = authHeader!.slice('Bearer '.length).trim();
      const circle = await fsGetDoc(`careCircles/${circleId}`, idToken);
      if (!circle) {
        res.status(404).json({ error: 'CareCircle not found or access denied.' });
        return;
      }

      const requesterMember = await fsGetDoc(`careCircles/${circleId}/members/${user.uid}`, idToken);
      const isOwner = circle.ownerId === user.uid;
      const isOrganizer = isOwner || requesterMember?.canManageMembers === true;

      if (!isOrganizer) {
        res.status(403).json({
          error: 'Only the CareCircle owner or an authorized organizer can revoke invitations.',
        });
        return;
      }

      const invite = await fsGetDoc(`invitations/${codeHash}`, idToken);
      if (!invite) {
        res.status(404).json({ error: 'Invitation record not found.' });
        return;
      }
      if (invite.circleId !== circleId) {
        res.status(403).json({ error: 'Cannot revoke an invitation belonging to another CareCircle.' });
        return;
      }
      if (invite.usedAt !== null && invite.usedAt !== undefined) {
        res.status(410).json({ error: 'This invitation has already been redeemed and cannot be revoked.' });
        return;
      }
      if (invite.revokedAt !== null && invite.revokedAt !== undefined) {
        res.status(410).json({ error: 'This invitation has already been revoked.' });
        return;
      }

      const circleInvite = await fsGetDoc(`careCircles/${circleId}/invitations/${codeHash}`, idToken);
      const actorName = String(requesterMember?.displayName || user.displayName || 'Organizer').slice(0, 100);
      const actorRole = String(requesterMember?.role || (isOwner ? 'elderly' : 'family'));
      const activityId = `act_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

      const writes: unknown[] = [
        {
          update: {
            name: docName(`invitations/${codeHash}`),
            fields: {
              revokedBy: toFsValue(user.uid),
            },
          },
          updateMask: {
            fieldPaths: ['revokedBy'],
          },
          currentDocument: { exists: true },
          updateTransforms: [{ fieldPath: 'revokedAt', setToServerValue: 'REQUEST_TIME' }],
        },
        {
          update: {
            name: docName(`careCircles/${circleId}/activityLogs/${activityId}`),
            fields: {
              id: toFsValue(activityId),
              actorUid: toFsValue(user.uid),
              actorName: toFsValue(actorName),
              actorRole: toFsValue(actorRole),
              action: toFsValue('Revoked CareCircle Invitation'),
              targetName: toFsValue(`${String(invite.role)} (${String(invite.relation || 'Member')})`),
              details: toFsValue(`Pending passcode cancelled by ${actorName}`),
            },
          },
          currentDocument: { exists: false },
          updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
        },
      ];

      if (circleInvite) {
        writes.splice(1, 0, {
          update: {
            name: docName(`careCircles/${circleId}/invitations/${codeHash}`),
            fields: {
              revokedBy: toFsValue(user.uid),
            },
          },
          updateMask: {
            fieldPaths: ['revokedBy'],
          },
          currentDocument: { exists: true },
          updateTransforms: [{ fieldPath: 'revokedAt', setToServerValue: 'REQUEST_TIME' }],
        });
      }

      await fsCommit(writes, idToken);

      res.json({
        codeHash,
        status: 'revoked',
        mode: 'firestore',
      });
    } catch (err) {
      console.error('Invitation revocation error:', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to revoke invitation.' });
    }
  });

  // ── Secure Invitation Redemption (Single-Use Atomic Batch) ───────────
  app.post('/api/invitations/redeem', async (req, res) => {
    try {
      const { code, displayName, demoMode } = req.body as {
        code?: string;
        displayName?: string;
        demoMode?: boolean;
      };

      if (!code || !code.trim()) {
        res.status(400).json({ error: 'Invitation passcode is required.' });
        return;
      }

      const normalized = normalizeInviteCode(code);
      const codeHash = sha256Hex(normalized);

      if (demoMode) {
        res.json({
          codeHash,
          status: 'verified_demo',
        });
        return;
      }

      const authHeader = req.headers.authorization;
      const user = await verifyFirebaseIdToken(authHeader);
      if (!user || !user.emailVerified) {
        res.status(401).json({ error: 'Verified Google account required to join a CareCircle.' });
        return;
      }

      const idToken = authHeader!.slice('Bearer '.length).trim();
      const invite = await fsGetDoc(`invitations/${codeHash}`, idToken);

      if (!invite) {
        res.status(404).json({ error: 'Invitation code is invalid or no longer exists.' });
        return;
      }

      if (invite.revokedAt !== null && invite.revokedAt !== undefined) {
        res.status(410).json({
          error: 'This invitation code was revoked by the CareCircle organizer and can no longer be used.',
        });
        return;
      }

      if (invite.usedAt !== null && invite.usedAt !== undefined) {
        res.status(410).json({ error: 'This invitation code has already been accepted and cannot be reused.' });
        return;
      }

      const expiresAtStr = String(invite.expiresAt || '');
      if (!expiresAtStr || new Date(expiresAtStr).getTime() <= Date.now()) {
        res.status(410).json({ error: 'This invitation code has expired. Please ask for a fresh invitation.' });
        return;
      }

      const circleId = String(invite.circleId);
      const existingMember = await fsGetDoc(`careCircles/${circleId}/members/${user.uid}`, idToken);
      if (existingMember) {
        res.status(409).json({ error: 'You are already an authorized member of this CareCircle.' });
        return;
      }

      const role = String(invite.role) as 'elderly' | 'family' | 'caregiver';
      const defaultRelation =
        role === 'elderly'
          ? 'Elderly Care Recipient'
          : role === 'caregiver'
          ? 'Caregiver'
          : 'Family Member';
      const relation = String(invite.relation || defaultRelation);
      const elderlyName = String(invite.elderlyName || 'CareCircle');
      const resolvedName = (displayName || user.displayName).trim().slice(0, 100) || 'Member';
      const activityId = `act_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const circleInvite = await fsGetDoc(`careCircles/${circleId}/invitations/${codeHash}`, idToken);

      const writes: unknown[] = [
        {
          update: {
            name: docName(`invitations/${codeHash}`),
            fields: {
              acceptedBy: toFsValue(user.uid),
              acceptedByName: toFsValue(resolvedName),
            },
          },
          updateMask: {
            fieldPaths: ['acceptedBy', 'acceptedByName'],
          },
          currentDocument: { exists: true },
          updateTransforms: [{ fieldPath: 'usedAt', setToServerValue: 'REQUEST_TIME' }],
        },
        {
          update: {
            name: docName(`careCircles/${circleId}/members/${user.uid}`),
            fields: {
              uid: toFsValue(user.uid),
              displayName: toFsValue(resolvedName),
              role: toFsValue(role),
              relation: toFsValue(relation),
              notifyEmail: toFsValue(user.email.slice(0, 254)),
              emailOptIn: toFsValue(true),
              canEditMedications: toFsValue(Boolean(invite.canEditMedications)),
              canManageAppointments: toFsValue(Boolean(invite.canManageAppointments)),
              canLogDoses: toFsValue(Boolean(invite.canLogDoses)),
              canManageMembers: toFsValue(Boolean(invite.canManageMembers)),
              inviteCodeHash: toFsValue(codeHash),
            },
          },
          currentDocument: { exists: false },
          updateTransforms: [
            { fieldPath: 'joinedAt', setToServerValue: 'REQUEST_TIME' },
            { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
          ],
        },
        {
          update: {
            name: docName(`users/${user.uid}/circles/${circleId}`),
            fields: {
              circleId: toFsValue(circleId),
              elderlyName: toFsValue(elderlyName),
              role: toFsValue(role),
            },
          },
          updateTransforms: [{ fieldPath: 'joinedAt', setToServerValue: 'REQUEST_TIME' }],
        },
        {
          update: {
            name: docName(`careCircles/${circleId}/activityLogs/${activityId}`),
            fields: {
              id: toFsValue(activityId),
              actorUid: toFsValue(user.uid),
              actorName: toFsValue(resolvedName),
              actorRole: toFsValue(role),
              action: toFsValue('Joined CareCircle'),
              targetName: toFsValue(elderlyName),
              details: toFsValue(`${resolvedName} joined as ${role} (${relation})`),
            },
          },
          currentDocument: { exists: false },
          updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
        },
      ];

      if (circleInvite) {
        writes.splice(1, 0, {
          update: {
            name: docName(`careCircles/${circleId}/invitations/${codeHash}`),
            fields: {
              acceptedBy: toFsValue(user.uid),
              acceptedByName: toFsValue(resolvedName),
            },
          },
          updateMask: {
            fieldPaths: ['acceptedBy', 'acceptedByName'],
          },
          currentDocument: { exists: true },
          updateTransforms: [{ fieldPath: 'usedAt', setToServerValue: 'REQUEST_TIME' }],
        });
      }

      await fsCommit(writes, idToken);

      res.json({
        circleId,
        elderlyName,
        role,
        relation,
        joined: true,
      });
    } catch (err) {
      console.error('Invitation redemption error:', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to redeem invitation.' });
    }
  });

  // ── Test Email Endpoint ──────────────────────────────────────────────
  app.post('/api/notifications/test', async (req, res) => {
    try {
      const { recipientEmail, elderlyName, demoMode } = req.body as {
        recipientEmail?: string;
        elderlyName?: string;
        demoMode?: boolean;
      };

      if (!demoMode) {
        const user = await verifyFirebaseIdToken(req.headers.authorization);
        if (!user) {
          res.status(401).json({ error: 'Authentication required to send test notifications.' });
          return;
        }
      }

      const validRecipients = normalizeEmailList(recipientEmail ? [recipientEmail] : []);
      if (validRecipients.length === 0) {
        res.status(400).json({ error: 'A valid recipient email address is required.' });
        return;
      }

      const targetEmail = validRecipients[0];
      const subject = `CareCircle Reminder Test — ${elderlyName || 'Care Network'}`;
      const text = `Hello from CareCircle.\n\nThis is a test notification verifying email delivery for ${elderlyName || 'your CareCircle'}.\n\nTogether for Better Elderly Care.`;

      const emailResult = await sendEmailViaAdapter({
        recipients: [targetEmail],
        subject,
        text,
        eventType: 'test_email',
        allowReal: !demoMode,
        emailEnabled: true,
      });

      res.json({
        eventType: 'test_email',
        title: 'Test Notification Check',
        message: `${emailResult.note} Target: ${targetEmail}`,
        deliveryMode: emailResult.mode,
        providerName: emailResult.providerName,
        providerMessageId: emailResult.providerMessageId,
        emailTarget: emailResult.emailTarget || targetEmail,
        delivered: emailResult.delivered,
        deliveredRecipients: emailResult.deliveredRecipients,
        failedRecipients: emailResult.failedRecipients,
        note: emailResult.note,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Test notification failed.' });
    }
  });

  // ── Immediate Notification Dispatch (Caregiver Alerts & Updates) ─────
  app.post('/api/notifications/dispatch', async (req, res) => {
    try {
      const {
        circleId,
        elderlyName,
        eventType,
        title,
        message,
        recipientEmails,
        emailEnabled,
        demoMode,
      } = req.body as {
        circleId?: string;
        elderlyName?: string;
        eventType?:
          | 'upcoming_dose'
          | 'missed_dose'
          | 'appointment_reminder'
          | 'appointment_change'
          | 'caregiver_update';
        title?: string;
        message?: string;
        recipientEmails?: string[];
        emailEnabled?: boolean;
        demoMode?: boolean;
      };

      const allowedTypes = new Set([
        'upcoming_dose',
        'missed_dose',
        'appointment_reminder',
        'appointment_change',
        'caregiver_update',
      ]);
      if (!eventType || !allowedTypes.has(eventType)) {
        res.status(400).json({ error: 'Valid notification eventType is required.' });
        return;
      }
      if (!title?.trim() || !message?.trim()) {
        res.status(400).json({ error: 'Notification title and message are required.' });
        return;
      }

      if (!demoMode) {
        const authHeader = req.headers.authorization;
        const user = await verifyFirebaseIdToken(authHeader);
        if (!user) {
          res.status(401).json({ error: 'Authentication required to dispatch notifications.' });
          return;
        }
        if (circleId) {
          const idToken = authHeader!.slice('Bearer '.length).trim();
          const circle = await fsGetDoc(`careCircles/${circleId}`, idToken);
          const member = await fsGetDoc(`careCircles/${circleId}/members/${user.uid}`, idToken);
          if (!circle && !member) {
            res.status(403).json({ error: 'Unauthorized: You do not belong to this CareCircle.' });
            return;
          }
        }
      }

      const cleanTitle = title.trim().slice(0, 160);
      const cleanMessage = message.trim().slice(0, 500);
      const result = await sendEmailViaAdapter({
        recipients: recipientEmails || [],
        subject: `[CareCircle] ${cleanTitle} — ${elderlyName || 'Care Network'}`,
        text: `${cleanTitle}\n\n${cleanMessage}\n\nCareCircle: ${elderlyName || 'Care Network'}`,
        eventType,
        allowReal: !demoMode,
        emailEnabled: emailEnabled !== false,
      });

      res.json({
        eventType,
        title: cleanTitle,
        message: result.delivered || result.mode === 'simulated_demo'
          ? `${cleanMessage} (${result.note})`.slice(0, 600)
          : cleanMessage,
        deliveryMode: result.mode,
        providerName: result.providerName,
        providerMessageId: result.providerMessageId,
        emailTarget: result.emailTarget,
        delivered: result.delivered,
        deliveredRecipients: result.deliveredRecipients,
        failedRecipients: result.failedRecipients,
        note: result.note,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Notification dispatch failed.' });
    }
  });

  // ── Reminder Processing Endpoint (Cron + Manual Trigger) ─────────────
  app.post('/api/reminders/process', async (req, res) => {
    try {
      const cfg = resolveEmailServiceConfig();
      const isCronAuthorized = isCronSecretAuthorized(req, cfg.cronSecret);

      const {
        circleId,
        demoMode,
        elderlyName,
        recipientEmails,
        preferences,
        alreadyNotifiedKeys,
        dateKey,
        nowMinutes,
        medications,
        logs,
        appointments,
        openCareAlerts,
      } = req.body as {
        circleId?: string;
        demoMode?: boolean;
        elderlyName?: string;
        recipientEmails?: string[];
        preferences?: {
          notifyUpcomingDose?: boolean;
          notifyMissedDose?: boolean;
          notifyAppointment?: boolean;
          notifyCaregiverUpdates?: boolean;
          emailAlertsEnabled?: boolean;
        };
        alreadyNotifiedKeys?: string[];
        dateKey?: string;
        nowMinutes?: number;
        medications?: Array<{
          id: string;
          name: string;
          dosage: string;
          times: string[];
          startDate: string;
          endDate?: string;
          gracePeriodMinutes: number;
          archived: boolean;
        }>;
        logs?: Array<{
          medicationId: string;
          dateKey: string;
          scheduledTime: string;
          status: 'taken' | 'missed' | 'skipped';
        }>;
        appointments?: Array<{
          id: string;
          doctorName: string;
          clinicName: string;
          dateTime: string;
          status: string;
          reminderSent: boolean;
        }>;
        openCareAlerts?: Array<{
          id: string;
          title: string;
          notes?: string;
          createdByName?: string;
        }>;
      };

      if (!demoMode && !isCronAuthorized) {
        const authHeader = req.headers.authorization;
        const user = await verifyFirebaseIdToken(authHeader);
        if (!user) {
          res.status(401).json({ error: 'Authentication or valid CRON_SECRET required.' });
          return;
        }
        if (circleId) {
          const idToken = authHeader!.slice('Bearer '.length).trim();
          const circle = await fsGetDoc(`careCircles/${circleId}`, idToken);
          const member = await fsGetDoc(`careCircles/${circleId}/members/${user.uid}`, idToken);
          if (!circle && !member) {
            res.status(403).json({ error: 'Unauthorized: You do not belong to this CareCircle.' });
            return;
          }
        }
      }

      const today = dateKey || new Date().toISOString().slice(0, 10);
      const currentMins =
        typeof nowMinutes === 'number'
          ? nowMinutes
          : new Date().getHours() * 60 + new Date().getMinutes();

      const dedupeSet = new Set(alreadyNotifiedKeys || []);
      const logSet = new Set(
        (logs || [])
          .filter((l) => l.dateKey === today)
          .map((l) => `${l.medicationId}__${l.scheduledTime}`)
      );

      const newlyMissed: Array<{
        medicationId: string;
        medicationName: string;
        dosage: string;
        scheduledTime: string;
        gracePeriodMinutes: number;
      }> = [];

      const upcomingDoses: Array<{
        medicationId: string;
        medicationName: string;
        dosage: string;
        scheduledTime: string;
        minutesUntil: number;
      }> = [];

      for (const med of medications || []) {
        if (med.archived) continue;
        if (med.startDate > today) continue;
        if (med.endDate && med.endDate < today) continue;

        const grace = Math.max(5, Number(med.gracePeriodMinutes || 60));

        for (const timeStr of med.times || []) {
          const [hh, mm] = timeStr.split(':').map(Number);
          if (Number.isNaN(hh) || Number.isNaN(mm)) continue;
          const schedMins = hh * 60 + mm;
          const key = `${med.id}__${timeStr}`;
          if (logSet.has(key)) continue;

          if (currentMins > schedMins + grace) {
            newlyMissed.push({
              medicationId: med.id,
              medicationName: med.name,
              dosage: med.dosage,
              scheduledTime: timeStr,
              gracePeriodMinutes: grace,
            });
          } else if (schedMins >= currentMins && schedMins - currentMins <= 45) {
            upcomingDoses.push({
              medicationId: med.id,
              medicationName: med.name,
              dosage: med.dosage,
              scheduledTime: timeStr,
              minutesUntil: schedMins - currentMins,
            });
          }
        }
      }

      const nowMs = Date.now();
      const appointmentReminders = (appointments || []).filter((appt) => {
        if (appt.status !== 'upcoming' || appt.reminderSent) return false;
        const apptMs = new Date(appt.dateTime).getTime();
        const diffHours = (apptMs - nowMs) / (1000 * 60 * 60);
        return diffHours > 0 && diffHours <= 24;
      });

      const notificationsToRecord: Array<{
        eventType: 'missed_dose' | 'upcoming_dose' | 'appointment_reminder' | 'caregiver_update';
        title: string;
        message: string;
        deliveryMode: 'real_email' | 'simulated_demo' | 'in_app';
        providerName: string;
        providerMessageId: string;
        emailTarget: string;
        delivered: boolean;
        note: string;
        dedupeKey: string;
      }> = [];

      const optedInEmails = normalizeEmailList(recipientEmails);
      const emailEnabled = preferences?.emailAlertsEnabled !== false;
      const allowReal = !demoMode;

      // 1. Missed Medication Alerts
      if (preferences?.notifyMissedDose !== false) {
        for (const m of newlyMissed) {
          const title = `Missed Dose Alert: ${m.medicationName} (${m.scheduledTime})`;
          const dedupeKey = `missed_dose:${m.medicationId}:${today}:${m.scheduledTime}`;
          if (dedupeSet.has(dedupeKey) || dedupeSet.has(title)) continue;

          const baseMessage = `${elderlyName || 'Patient'} has not logged ${m.medicationName} (${m.dosage}) scheduled at ${m.scheduledTime} after the ${m.gracePeriodMinutes}-minute grace period.`;
          const dispatch = await sendEmailViaAdapter({
            recipients: optedInEmails,
            subject: `[CareCircle Missed Dose] ${title}`,
            text: baseMessage,
            eventType: 'missed_dose',
            allowReal,
            emailEnabled,
          });

          notificationsToRecord.push({
            eventType: 'missed_dose',
            title,
            message: `${baseMessage} (${dispatch.note})`.slice(0, 600),
            deliveryMode: dispatch.mode,
            providerName: dispatch.providerName,
            providerMessageId: dispatch.providerMessageId,
            emailTarget: dispatch.emailTarget,
            delivered: dispatch.delivered,
            note: dispatch.note,
            dedupeKey,
          });
        }
      }

      // 2. Upcoming Medication Reminders
      if (preferences?.notifyUpcomingDose !== false) {
        for (const u of upcomingDoses) {
          const title = `Upcoming Dose: ${u.medicationName} at ${u.scheduledTime}`;
          const dedupeKey = `upcoming_dose:${u.medicationId}:${today}:${u.scheduledTime}`;
          if (dedupeSet.has(dedupeKey) || dedupeSet.has(title)) continue;

          const baseMessage = `${u.medicationName} (${u.dosage}) for ${elderlyName || 'Patient'} is due in ${u.minutesUntil} minute(s) at ${u.scheduledTime}.`;
          const dispatch = await sendEmailViaAdapter({
            recipients: optedInEmails,
            subject: `[CareCircle Dose Reminder] ${title}`,
            text: baseMessage,
            eventType: 'upcoming_dose',
            allowReal,
            emailEnabled,
          });

          notificationsToRecord.push({
            eventType: 'upcoming_dose',
            title,
            message: `${baseMessage} (${dispatch.note})`.slice(0, 600),
            deliveryMode: dispatch.mode,
            providerName: dispatch.providerName,
            providerMessageId: dispatch.providerMessageId,
            emailTarget: dispatch.emailTarget,
            delivered: dispatch.delivered,
            note: dispatch.note,
            dedupeKey,
          });
        }
      }

      // 3. Upcoming Doctor Appointment Reminders
      if (preferences?.notifyAppointment !== false) {
        for (const a of appointmentReminders) {
          const title = `Upcoming Appointment: ${a.doctorName}`;
          const dedupeKey = `appointment_reminder:${a.id}`;
          if (dedupeSet.has(dedupeKey) || dedupeSet.has(title)) continue;

          const baseMessage = `Reminder for ${elderlyName || 'Patient'}: Visit with ${a.doctorName} at ${a.clinicName} on ${new Date(a.dateTime).toLocaleString()}.`;
          const dispatch = await sendEmailViaAdapter({
            recipients: optedInEmails,
            subject: `[CareCircle Appointment] ${title}`,
            text: baseMessage,
            eventType: 'appointment_reminder',
            allowReal,
            emailEnabled,
          });

          notificationsToRecord.push({
            eventType: 'appointment_reminder',
            title,
            message: `${baseMessage} (${dispatch.note})`.slice(0, 600),
            deliveryMode: dispatch.mode,
            providerName: dispatch.providerName,
            providerMessageId: dispatch.providerMessageId,
            emailTarget: dispatch.emailTarget,
            delivered: dispatch.delivered,
            note: dispatch.note,
            dedupeKey,
          });
        }
      }

      // 4. Open Caregiver Assistance Alerts Digest
      if (preferences?.notifyCaregiverUpdates !== false && Array.isArray(openCareAlerts) && openCareAlerts.length > 0) {
        for (const alert of openCareAlerts.slice(0, 3)) {
          const title = `Caregiver Alert Follow-Up: ${alert.title}`.slice(0, 160);
          const dedupeKey = `caregiver_update:${alert.id}:${today}`;
          if (dedupeSet.has(dedupeKey) || dedupeSet.has(title)) continue;

          const baseMessage = `Open caregiver assistance request from ${alert.createdByName || 'Caregiver'} for ${elderlyName || 'Patient'}: ${alert.notes || alert.title}.`;
          const dispatch = await sendEmailViaAdapter({
            recipients: optedInEmails,
            subject: `[CareCircle Caregiver Alert] ${alert.title}`,
            text: baseMessage,
            eventType: 'caregiver_update',
            allowReal,
            emailEnabled,
          });

          notificationsToRecord.push({
            eventType: 'caregiver_update',
            title,
            message: `${baseMessage} (${dispatch.note})`.slice(0, 600),
            deliveryMode: dispatch.mode,
            providerName: dispatch.providerName,
            providerMessageId: dispatch.providerMessageId,
            emailTarget: dispatch.emailTarget,
            delivered: dispatch.delivered,
            note: dispatch.note,
            dedupeKey,
          });
        }
      }

      res.json({
        processedAt: new Date().toISOString(),
        dateKey: today,
        triggeredBy: isCronAuthorized ? 'cron' : demoMode ? 'demo' : 'user',
        provider: cfg.provider,
        providerConfigured: cfg.configured,
        recipientCount: optedInEmails.length,
        newlyMissed,
        upcomingDoses,
        appointmentReminders: appointmentReminders.map((a) => a.id),
        notifications: notificationsToRecord,
      });
    } catch (err) {
      console.error('Reminder processing error:', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to process reminders.' });
    }
  });

  // ── Gemini AI Care Assistant Proxy (Server-Grounded + SSE Streaming) ──
  interface AuthorizedAiContext {
    userRole: string;
    userName: string;
    elderlyName: string;
    elderlyAge?: number;
    bloodGroup?: string;
    allergies?: string;
    careNotes?: string;
    dateKey: string;
    medications: Array<{
      name: string;
      dosage: string;
      frequency: string;
      times: string[];
      instructions?: string;
      prescribingDoctor?: string;
      gracePeriodMinutes: number;
    }>;
    todaySchedule: Array<{
      medicationName: string;
      dosage: string;
      scheduledTime: string;
      status: 'taken' | 'missed' | 'skipped' | 'pending';
      recordedByName?: string;
    }>;
    weeklyAdherence: {
      taken: number;
      missed: number;
      skipped: number;
      eligibleTotal: number;
      ratePercent: number;
      days: Array<{
        dateKey: string;
        label: string;
        taken: number;
        missed: number;
        skipped: number;
      }>;
    };
    upcomingAppointments: Array<{
      doctorName: string;
      specialization?: string;
      clinicName: string;
      dateTime: string;
      notes?: string;
    }>;
    recentCareNotes: Array<{
      title: string;
      category: string;
      completed: boolean;
      createdByName: string;
    }>;
  }

  function formatGeminiError(err: unknown): { status: number; message: string } {
    const raw = err instanceof Error ? err.message : String(err || 'AI Care Assistant failed.');
    if (/API_KEY_INVALID|PERMISSION_DENIED|403|401/i.test(raw)) {
      return {
        status: 502,
        message: 'AI assistant credentials could not be verified. Please check the Gemini API key in Settings > Secrets.',
      };
    }
    if (/RESOURCE_EXHAUSTED|429|quota/i.test(raw)) {
      return {
        status: 429,
        message: 'AI Care Assistant is temporarily busy due to rate limits. Please wait a moment and tap Retry.',
      };
    }
    if (/UNAVAILABLE|503|high demand|overloaded|try again later/i.test(raw)) {
      return {
        status: 503,
        message: 'The AI Care Assistant is temporarily experiencing high demand. Please wait a few seconds and tap Retry.',
      };
    }
    if (/NOT_FOUND|404/i.test(raw)) {
      return {
        status: 502,
        message: 'The configured Gemini model could not be reached right now. Please try again shortly.',
      };
    }
    return { status: 500, message: raw };
  }

  async function buildServerAiContext(params: {
    circleId: string;
    user: VerifiedUser;
    idToken: string;
    dateKey: string;
    nowMinutes: number;
  }): Promise<
    | { ok: true; context: AuthorizedAiContext }
    | { ok: false; status: number; error: string }
  > {
    const { circleId, user, idToken, dateKey, nowMinutes } = params;

    const [circleRes, memberRes] = await Promise.all([
      fsGetDocWithAccess(`careCircles/${circleId}`, idToken),
      fsGetDocWithAccess(`careCircles/${circleId}/members/${user.uid}`, idToken),
    ]);

    if (circleRes.status === 'forbidden' && memberRes.status !== 'ok') {
      return {
        ok: false,
        status: 403,
        error: 'Unauthorized: You do not belong to this CareCircle.',
      };
    }
    if (circleRes.status === 'not_found') {
      return {
        ok: false,
        status: 404,
        error: 'CareCircle profile was not found.',
      };
    }
    if (circleRes.status !== 'ok') {
      return {
        ok: false,
        status: 403,
        error: 'Unauthorized: Access to this CareCircle was denied.',
      };
    }

    const circleData = circleRes.data;
    const isOwner = String(circleData.ownerId || '') === user.uid;
    const memberData = memberRes.status === 'ok' ? memberRes.data : null;

    if (!isOwner && !memberData) {
      return {
        ok: false,
        status: 403,
        error: 'Unauthorized: You do not belong to this CareCircle.',
      };
    }

    const [rawMeds, rawLogs, rawAppts, rawTasks] = await Promise.all([
      fsListDocs(`careCircles/${circleId}/medications`, idToken, 150),
      fsListDocs(`careCircles/${circleId}/medicationLogs`, idToken, 350),
      fsListDocs(`careCircles/${circleId}/appointments`, idToken, 150),
      fsListDocs(`careCircles/${circleId}/careTasks`, idToken, 100),
    ]);

    const medications: Medication[] = rawMeds.map((m) => ({
      id: String(m.id || ''),
      name: String(m.name || ''),
      dosage: String(m.dosage || ''),
      frequency: (String(m.frequency || 'once_daily') as Medication['frequency']),
      times: Array.isArray(m.times) ? m.times.map((t) => String(t)) : [],
      startDate: String(m.startDate || dateKey),
      endDate: String(m.endDate || ''),
      instructions: String(m.instructions || ''),
      prescribingDoctor: String(m.prescribingDoctor || ''),
      gracePeriodMinutes: Number(m.gracePeriodMinutes || 60),
      archived: Boolean(m.archived),
      createdBy: String(m.createdBy || ''),
    }));

    const logs: MedicationLog[] = rawLogs.map((l) => ({
      id: String(l.id || ''),
      medicationId: String(l.medicationId || ''),
      medicationName: String(l.medicationName || ''),
      dosage: String(l.dosage || ''),
      dateKey: String(l.dateKey || ''),
      scheduledTime: String(l.scheduledTime || ''),
      status: (String(l.status || 'taken') as MedicationLog['status']),
      recordedByUid: String(l.recordedByUid || ''),
      recordedByName: String(l.recordedByName || ''),
      recordedByRole: (String(l.recordedByRole || 'family') as MedicationLog['recordedByRole']),
      notes: String(l.notes || ''),
      recordedAt: String(l.recordedAt || ''),
    }));

    const appointments: Appointment[] = rawAppts
      .map((a) => ({
        id: String(a.id || ''),
        doctorName: String(a.doctorName || ''),
        specialization: String(a.specialization || ''),
        clinicName: String(a.clinicName || ''),
        dateTime: String(a.dateTime || ''),
        notes: String(a.notes || ''),
        status: (String(a.status || 'upcoming') as Appointment['status']),
        reminderSent: Boolean(a.reminderSent),
        createdBy: String(a.createdBy || ''),
      }))
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

    const careTasks: CareTask[] = rawTasks.map((t) => ({
      id: String(t.id || ''),
      title: String(t.title || ''),
      notes: String(t.notes || ''),
      category: (String(t.category || 'task') as CareTask['category']),
      completed: Boolean(t.completed),
      completedBy: String(t.completedBy || ''),
      dueDate: String(t.dueDate || ''),
      createdBy: String(t.createdBy || ''),
      createdByName: String(t.createdByName || ''),
      createdAt: String(t.createdAt || ''),
    }));

    const todaySchedule = computeScheduleForDate(medications, logs, dateKey, nowMinutes);
    const weekly = computeWeeklyAdherence(medications, logs, nowMinutes);

    const role = (memberData?.role as UserRole | undefined) || (isOwner ? 'family' : 'family');
    const displayName = String(memberData?.displayName || user.displayName || 'CareCircle User');

    return {
      ok: true,
      context: {
        userRole: role,
        userName: displayName,
        elderlyName: String(circleData.elderlyName || 'Patient'),
        elderlyAge: typeof circleData.elderlyAge === 'number' ? circleData.elderlyAge : undefined,
        bloodGroup: String(circleData.bloodGroup || ''),
        allergies: String(circleData.allergies || 'None recorded'),
        careNotes: String(circleData.careNotes || ''),
        dateKey,
        medications: medications
          .filter((m) => !m.archived)
          .map((m) => ({
            name: m.name,
            dosage: m.dosage,
            frequency: m.frequency,
            times: m.times,
            instructions: m.instructions,
            prescribingDoctor: m.prescribingDoctor,
            gracePeriodMinutes: m.gracePeriodMinutes,
          })),
        todaySchedule: todaySchedule.map((s) => ({
          medicationName: s.medication.name,
          dosage: s.medication.dosage,
          scheduledTime: s.scheduledTime,
          status: s.status,
          recordedByName: s.log?.recordedByName,
        })),
        weeklyAdherence: {
          taken: weekly.taken,
          missed: weekly.missed,
          skipped: weekly.skipped,
          eligibleTotal: weekly.eligibleTotal,
          ratePercent: weekly.ratePercent,
          days: weekly.days.map((d) => ({
            dateKey: d.dateKey,
            label: d.label,
            taken: d.taken,
            missed: d.missed,
            skipped: d.skipped,
          })),
        },
        upcomingAppointments: appointments
          .filter((a) => a.status === 'upcoming')
          .map((a) => ({
            doctorName: a.doctorName,
            specialization: a.specialization,
            clinicName: a.clinicName,
            dateTime: a.dateTime,
            notes: a.notes,
          })),
        recentCareNotes: careTasks.slice(0, 8).map((t) => ({
          title: t.title,
          category: t.category,
          completed: t.completed,
          createdByName: t.createdByName,
        })),
      },
    };
  }

  app.post('/api/ai/chat', async (req, res) => {
    try {
      const {
        message,
        history,
        circleId,
        language,
        dateKey,
        nowMinutes,
        contextSnapshot,
        demoMode,
        stream,
      } = req.body as {
        message?: string;
        history?: Array<{ role: 'user' | 'assistant'; content: string }>;
        circleId?: string;
        language?: 'en' | 'hi' | 'bn';
        dateKey?: string;
        nowMinutes?: number;
        contextSnapshot?: AuthorizedAiContext;
        demoMode?: boolean;
        stream?: boolean;
      };

      if (!message || !message.trim()) {
        res.status(400).json({ error: 'Message prompt is required.' });
        return;
      }

      const resolvedLang: 'en' | 'hi' | 'bn' =
        language === 'hi' || language === 'bn' ? language : 'en';
      const resolvedDateKey =
        typeof dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)
          ? dateKey
          : formatDateKey(new Date());
      const resolvedNowMinutes =
        typeof nowMinutes === 'number' && Number.isFinite(nowMinutes) && nowMinutes >= 0 && nowMinutes < 1440
          ? Math.trunc(nowMinutes)
          : new Date().getHours() * 60 + new Date().getMinutes();

      let groundedContext: AuthorizedAiContext | Record<string, unknown> = {};
      let groundedSource: 'firestore' | 'demo' = 'demo';

      // Strict server-side authorization and Firestore grounding for live Firebase users
      if (!demoMode) {
        const authHeader = req.headers.authorization;
        const user = await verifyFirebaseIdToken(authHeader);
        if (!user) {
          res.status(401).json({ error: 'Authentication required to access the AI Care Assistant.' });
          return;
        }
        const cleanCircleId = typeof circleId === 'string' ? circleId.trim() : '';
        if (!cleanCircleId || !/^[a-zA-Z0-9_-]{1,128}$/.test(cleanCircleId)) {
          res.status(400).json({ error: 'A valid CareCircle ID is required.' });
          return;
        }

        const idToken = authHeader!.slice('Bearer '.length).trim();
        const serverCtx = await buildServerAiContext({
          circleId: cleanCircleId,
          user,
          idToken,
          dateKey: resolvedDateKey,
          nowMinutes: resolvedNowMinutes,
        });
        if (!serverCtx.ok) {
          res.status(serverCtx.status).json({ error: serverCtx.error });
          return;
        }
        groundedContext = serverCtx.context;
        groundedSource = 'firestore';
      } else {
        groundedContext = contextSnapshot || {};
        groundedSource = 'demo';
      }

      if (!process.env.GEMINI_API_KEY) {
        res.status(503).json({
          error: 'GEMINI_API_KEY is not configured in environment secrets.',
        });
        return;
      }

      const langInstruction =
        resolvedLang === 'hi'
          ? 'Respond in simple, warm, respectful Hindi (Devanagari script), keeping medicine and doctor names accurate and easy to read for seniors.'
          : resolvedLang === 'bn'
          ? 'Respond in simple, warm, respectful Bengali (বাংলা script), keeping medicine and doctor names accurate and easy to read for seniors.'
          : 'Respond in simple, warm, reassuring English suitable for older adults and family caregivers.';

      const systemInstruction = `You are the CareCircle AI Care Assistant ("Together for Better Elderly Care").
${langInstruction}

CRITICAL MEDICAL SAFETY & PRIVACY RULES (STRICTLY ENFORCED):
1. NEVER diagnose any disease, illness, symptom, or medical condition.
2. NEVER prescribe medications, treatments, home remedies, or recommend starting, stopping, skipping, or changing any medication dosage or schedule.
3. NEVER invent medication records, dose logs, lab values, allergies, or doctor appointments not explicitly present in the Authorized CareCircle Context below. If information is missing or empty, clearly state that it is not recorded in CareCircle.
4. Only use data belonging to the current Authorized CareCircle Context below. Never speculate about or reference any other CareCircle.
5. For any clinical question, new symptom, side effect, or dosage adjustment question, warmly advise consulting the prescribing doctor or a qualified healthcare professional.
6. Clearly distinguish between:
   - Recorded CareCircle Information (facts directly from the authorized profile, today's schedule, 7-day adherence summary, and upcoming appointments below)
   - General App Guidance (how to use CareCircle features)

AUTHORIZED CARECIRCLE CONTEXT (${groundedSource === 'firestore' ? 'VERIFIED SERVER FIRESTORE RECORDS' : 'DEMO SANDBOX RECORDS'}):
${JSON.stringify(groundedContext, null, 2)}

How to help with CareCircle app questions:
- Inviting family, elderly users, or caregivers: Go to "CareCircle" (Members), select the role and permissions, generate a time-limited invite code, and share the single-use passcode.
- Recording doses: Open "Daily Tracker" or "Dashboard" and tap "Mark Taken" or "Skip". Missed doses are flagged automatically only after the configured grace period expires.
- Notifications & Accessibility: Users can manage email reminders in "Notifications" and toggle High-Contrast Mode, Large/Extra-Large Text, Dark/Light Theme, Voice Readback, and English/Hindi/Bengali in Settings or the toolbar.

Keep responses concise (under ~220 words unless a full weekly summary is asked), organized in short readable sentences or simple bullets.`;

      const cleanHistory = Array.isArray(history)
        ? history
            .filter((t) => t && (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string' && t.content.trim())
            .slice(-8)
            .map((turn) => ({
              role: turn.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: turn.content.slice(0, 2000) }],
            }))
        : [];

      const contents = [
        ...cleanHistory,
        {
          role: 'user',
          parts: [{ text: message.trim().slice(0, 2000) }],
        },
      ];

      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders?.();

        const sendEvent = (event: string, data: unknown) => {
          res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        };

        sendEvent('meta', {
          groundedSource,
          language: resolvedLang,
          elderlyName: (groundedContext as { elderlyName?: string }).elderlyName || 'Patient',
        });

        try {
          const streamResp = await ai.models.generateContentStream({
            model: 'gemini-4-hydrogen',
            contents,
            config: {
              systemInstruction,
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            },
          });

          let fullText = '';
          for await (const chunk of streamResp) {
            const delta = chunk.text || '';
            if (delta) {
              fullText += delta;
              sendEvent('chunk', { text: delta });
            }
          }

          if (!fullText.trim()) {
            fullText = 'I could not generate a response right now. Please try again.';
            sendEvent('chunk', { text: fullText });
          }

          sendEvent('done', { reply: fullText, groundedSource });
          res.end();
        } catch (streamErr) {
          console.error('Gemini AI Care Assistant stream error:', streamErr);
          const mapped = formatGeminiError(streamErr);
          sendEvent('error', { error: mapped.message });
          res.end();
        }
        return;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      res.json({
        reply: response.text || 'I could not generate a response right now. Please try again.',
        groundedSource,
      });
    } catch (err) {
      console.error('Gemini AI Care Assistant error:', err);
      const mapped = formatGeminiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // ── Vite Middleware (Dev) or Static Assets (Prod) ────────────────────
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`CareCircle server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
