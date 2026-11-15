import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Ban,
  BellRing,
  CheckSquare,
  Clock,
  Copy,
  KeyRound,
  Plus,
  ShieldCheck,
  Square,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { useCareCircle } from '../context/CareCircleContext';
import { formatTimestamp, getTimestampMs, getTodayDateKey } from '../lib/scheduleUtils';
import type { CareCircleInvitation, CareTask, UserRole } from '../types/carecircle';

function formatInviteExpiryCountdown(expiresAt: CareCircleInvitation['expiresAt'], nowMs: number): string {
  const expMs = getTimestampMs(expiresAt);
  if (!expMs) return 'Unknown expiry';
  const diffMs = expMs - nowMs;
  if (diffMs <= 0) return 'Expired';
  const totalMins = Math.floor(diffMs / 60000);
  if (totalMins < 1) return '<1m left';
  if (totalMins < 60) return `${totalMins}m left`;
  const totalHours = Math.floor(totalMins / 60);
  const remMins = totalMins % 60;
  if (totalHours < 24) return `${totalHours}h ${remMins}m left`;
  const days = Math.floor(totalHours / 24);
  const remHours = totalHours % 24;
  return remHours > 0 ? `${days}d ${remHours}h left` : `${days}d left`;
}

function getRoleLabel(role: UserRole): string {
  if (role === 'elderly') return 'Elderly User';
  if (role === 'caregiver') return 'Caregiver';
  return 'Family Member';
}

export const MembersPage: React.FC = () => {
  const {
    activeCircle,
    userAccount,
    members,
    invitations,
    careTasks,
    activityLogs,
    permissions,
    setCurrentPage,
    createInvitation,
    revokeInvitation,
    redeemInvitation,
    updateMemberPermissions,
    removeMember,
    addCareTask,
    toggleCareTask,
    deleteCareTask,
    notifyToast,
  } = useCareCircle();

  // Live 30s ticker for invitation expiry countdowns
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Invitation generator state (family defaults to canLogDoses = true)
  const [inviteRole, setInviteRole] = useState<UserRole>('family');
  const [inviteRelation, setInviteRelation] = useState('Daughter');
  const [canLogDoses, setCanLogDoses] = useState(true);
  const [canEditMeds, setCanEditMeds] = useState(false);
  const [canManageAppts, setCanManageAppts] = useState(true);
  const [canManageMembers, setCanManageMembers] = useState(false);
  const [expiresHours, setExpiresHours] = useState('48');
  const [generatedCode, setGeneratedCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [revokingHash, setRevokingHash] = useState<string | null>(null);

  // Redeem code state
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemName, setRedeemName] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  // Family & Caregiver Collaboration state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskNotes, setTaskNotes] = useState('');
  const [taskCategory, setTaskCategory] = useState<CareTask['category']>('task');
  const [postingTask, setPostingTask] = useState(false);

  const sortedInvitations = useMemo(
    () => [...invitations].sort((a, b) => getTimestampMs(b.createdAt) - getTimestampMs(a.createdAt)),
    [invitations]
  );

  const pendingInvitationsCount = useMemo(
    () =>
      sortedInvitations.filter(
        (inv) => !inv.usedAt && !inv.revokedAt && getTimestampMs(inv.expiresAt) > nowMs
      ).length,
    [sortedInvitations, nowMs]
  );

  const accessAuditLogs = useMemo(
    () =>
      activityLogs
        .filter((act) => {
          const text = act.action.toLowerCase();
          return (
            text.includes('invite') ||
            text.includes('invitation') ||
            text.includes('member') ||
            text.includes('permission') ||
            text.includes('dose') ||
            text.includes('joined')
          );
        })
        .slice(0, 8),
    [activityLogs]
  );

  const handleRoleSelectChange = (r: UserRole) => {
    setInviteRole(r);
    if (r === 'elderly') {
      setInviteRelation('Elderly Loved One');
      setCanLogDoses(true);
      setCanEditMeds(true);
      setCanManageAppts(true);
      setCanManageMembers(false);
    } else if (r === 'caregiver') {
      setInviteRelation('Home Care Nurse');
      setCanLogDoses(true);
      setCanEditMeds(true);
      setCanManageAppts(true);
      setCanManageMembers(false);
    } else {
      setInviteRelation('Daughter');
      setCanLogDoses(true);
      setCanEditMeds(false);
      setCanManageAppts(true);
      setCanManageMembers(false);
    }
  };

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
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
        canEditMedications: canEditMeds,
        canManageAppointments: canManageAppts,
        canLogDoses,
        canManageMembers: permissions.isOwner ? canManageMembers : false,
        expiresHours: Number(expiresHours) || 48,
      });
      setGeneratedCode(res);
    } catch (err) {
      notifyToast('error', err instanceof Error ? err.message : 'Failed to generate invite');
    } finally {
      setGenerating(false);
    }
  };

  const handleRevokeInvite = async (codeHash: string) => {
    setRevokingHash(codeHash);
    try {
      await revokeInvitation(codeHash);
    } catch (err) {
      notifyToast('error', err instanceof Error ? err.message : 'Failed to revoke invitation');
    } finally {
      setRevokingHash(null);
    }
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!redeemCode.trim()) return;
    setRedeeming(true);
    try {
      await redeemInvitation(redeemCode, redeemName);
      setRedeemCode('');
      setRedeemName('');
    } catch (err) {
      notifyToast('error', err instanceof Error ? err.message : 'Failed to redeem invitation');
    } finally {
      setRedeeming(false);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    setPostingTask(true);
    try {
      await addCareTask({
        title: taskTitle,
        notes: taskNotes,
        category: taskCategory,
        dueDate: getTodayDateKey(),
      });
      setTaskTitle('');
      setTaskNotes('');
    } catch (err) {
      notifyToast('error', err instanceof Error ? err.message : 'Could not post care update.');
    } finally {
      setPostingTask(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
          CareCircle Members &amp; Collaboration
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Manage who has access to {activeCircle?.elderlyName}’s healthcare data, issue hashed single-use invitations with expiry timers, and track collaborative actions.
        </p>
      </div>

      {/* Members Directory */}
      <section className="hc-surface rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            Authorized CareCircle Members ({members.length})
          </h2>
        </div>

        <div className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
          {members.map((m) => {
            const isCircleRootOwner = m.uid === activeCircle?.ownerId;
            const isCurrentUser = m.uid === userAccount?.uid;
            const canEditThisMember =
              permissions.canManageMembers && !isCircleRootOwner && !isCurrentUser;

            return (
              <div
                key={m.uid}
                className="flex flex-col justify-between gap-4 py-4 lg:flex-row lg:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-white">{m.displayName}</span>
                    <span className="text-xs font-medium capitalize text-sky-700 dark:text-sky-400">
                      · {getRoleLabel(m.role)}
                    </span>
                    {m.relation && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">· {m.relation}</span>
                    )}
                    {isCircleRootOwner ? (
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        · Owner
                      </span>
                    ) : m.canManageMembers ? (
                      <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                        · Organizer
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Permissions: {m.canLogDoses ? 'Log Doses' : 'View Logs'} ·{' '}
                    {m.canEditMedications ? 'Edit Medicines' : 'View Medicines'} ·{' '}
                    {m.canManageAppointments ? 'Manage Appointments' : 'View Appointments'}
                    {m.canManageMembers ? ' · Invite & Manage Members' : ''}
                  </p>
                </div>

                {canEditThisMember && (
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={m.canLogDoses}
                        onChange={(e) =>
                          void updateMemberPermissions(m.uid, { canLogDoses: e.target.checked })
                        }
                        className="accent-sky-700"
                      />
                      Log Doses
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={m.canEditMedications}
                        onChange={(e) =>
                          void updateMemberPermissions(m.uid, { canEditMedications: e.target.checked })
                        }
                        className="accent-sky-700"
                      />
                      Edit Meds
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={m.canManageAppointments}
                        onChange={(e) =>
                          void updateMemberPermissions(m.uid, {
                            canManageAppointments: e.target.checked,
                          })
                        }
                        className="accent-sky-700"
                      />
                      Manage Appts
                    </label>
                    {permissions.isOwner && (
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(m.canManageMembers)}
                          onChange={(e) =>
                            void updateMemberPermissions(m.uid, {
                              canManageMembers: e.target.checked,
                            })
                          }
                          className="accent-sky-700"
                        />
                        Organizer
                      </label>
                    )}
                    <button
                      type="button"
                      onClick={() => void removeMember(m.uid)}
                      className="inline-flex min-h-[38px] sm:min-h-0 items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Remove
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Invitations Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Generate Invite (Owner or Organizer) */}
        <section className="hc-surface rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-sky-700 dark:text-sky-400" aria-hidden="true" />
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Invite Elderly User, Family, or Caregiver
            </h2>
          </div>

          {!permissions.canManageMembers ? (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              Only the CareCircle owner or an authorized organizer can generate invitation passcodes.
            </p>
          ) : (
            <form onSubmit={handleGenerateInvite} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium">Member Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => handleRoleSelectChange(e.target.value as UserRole)}
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
                    value={expiresHours}
                    onChange={(e) => setExpiresHours(e.target.value)}
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

              <div className="space-y-2 text-sm">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Scoped Permissions</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canLogDoses}
                    onChange={(e) => setCanLogDoses(e.target.checked)}
                    className="accent-sky-700"
                  />
                  Allow recording medication doses
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canEditMeds}
                    onChange={(e) => setCanEditMeds(e.target.checked)}
                    className="accent-sky-700"
                  />
                  Allow adding/editing medication schedules
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canManageAppts}
                    onChange={(e) => setCanManageAppts(e.target.checked)}
                    className="accent-sky-700"
                  />
                  Allow managing doctor appointments
                </label>
                {permissions.isOwner && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={canManageMembers}
                      onChange={(e) => setCanManageMembers(e.target.checked)}
                      className="accent-sky-700"
                    />
                    Allow inviting &amp; managing members (Organizer)
                  </label>
                )}
              </div>

              <button
                type="submit"
                disabled={generating}
                className="hc-primary-btn w-full rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
              >
                {generating ? 'Generating Hashed Passcode...' : 'Generate Single-Use Invite Code'}
              </button>

              {generatedCode && (
                <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
                  <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-300">
                    Share this one-time passcode (stored only as SHA-256 hash on server):
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <code className="font-mono text-lg font-bold tracking-wider text-emerald-950 dark:text-emerald-100">
                      {generatedCode.code}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(generatedCode.code);
                        notifyToast('info', 'Passcode copied to clipboard.');
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      Copy
                    </button>
                  </div>
                  <p className="mt-1 font-mono text-xs text-emerald-800 dark:text-emerald-400 tabular-nums">
                    Expires: {new Date(generatedCode.expiresAt).toLocaleString()}
                  </p>
                </div>
              )}
            </form>
          )}
        </section>

        {/* Redeem Invite Code */}
        <section className="hc-surface rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Join a CareCircle with Passcode
            </h2>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Redeem a single-use invitation code for an elderly user, family member, or caregiver.
          </p>

          <form onSubmit={handleRedeem} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-medium">Member Name</label>
              <input
                type="text"
                value={redeemName}
                onChange={(e) => setRedeemName(e.target.value)}
                placeholder="e.g., Ananya Sen"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium">Invitation Code *</label>
              <input
                type="text"
                required
                value={redeemCode}
                onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                placeholder="CC-XXXX-XXXX"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-base uppercase dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <button
              type="submit"
              disabled={redeeming}
              className="w-full rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {redeeming ? 'Validating Code...' : 'Redeem & Join CareCircle'}
            </button>
          </form>
        </section>
      </div>

      {/* Issued & Pending Invitations List (Owner & Organizers only) */}
      {permissions.canManageMembers && (
        <section className="hc-surface rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-sky-700 dark:text-sky-400" aria-hidden="true" />
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Issued &amp; Pending Invitations ({pendingInvitationsCount} active)
              </h2>
            </div>
            <span className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              Live expiry countdown · SHA-256 verified
            </span>
          </div>

          <div className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
            {sortedInvitations.map((inv) => {
              const expMs = getTimestampMs(inv.expiresAt);
              const isRevoked = Boolean(inv.revokedAt);
              const isUsed = Boolean(inv.usedAt);
              const isExpired = !isUsed && !isRevoked && expMs > 0 && expMs <= nowMs;
              const isActive = !isUsed && !isRevoked && !isExpired;
              const countdownText = formatInviteExpiryCountdown(inv.expiresAt, nowMs);

              const scopedPerms = [
                inv.canLogDoses ? 'Log Doses' : 'View Logs',
                inv.canEditMedications ? 'Edit Meds' : 'View Meds',
                inv.canManageAppointments ? 'Manage Appts' : 'View Appts',
                inv.canManageMembers ? 'Organizer' : null,
              ]
                .filter(Boolean)
                .join(' · ');

              return (
                <div
                  key={inv.codeHash}
                  className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {getRoleLabel(inv.role)}
                      </span>
                      {inv.relation && (
                        <span className="text-slate-600 dark:text-slate-300">· {inv.relation}</span>
                      )}
                      <span className="text-slate-400" aria-hidden="true">·</span>
                      {isRevoked ? (
                        <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                          Revoked
                        </span>
                      ) : isUsed ? (
                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          Accepted by {inv.acceptedByName || inv.acceptedBy || 'Member'}
                        </span>
                      ) : isExpired ? (
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Expired
                        </span>
                      ) : (
                        <span className="font-mono text-xs font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
                          Pending · {countdownText}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Permissions: {scopedPerms}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      Hash {inv.codeHash.slice(0, 10)}… · Issued by {inv.createdByName || 'Organizer'} ·{' '}
                      {formatTimestamp(inv.createdAt)}
                    </p>
                  </div>

                  {isActive && (
                    <button
                      type="button"
                      disabled={revokingHash === inv.codeHash}
                      onClick={() => void handleRevokeInvite(inv.codeHash)}
                      className="inline-flex min-h-[38px] sm:min-h-0 items-center gap-1.5 self-start rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:text-rose-400 sm:self-auto whitespace-nowrap"
                    >
                      <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                      {revokingHash === inv.codeHash ? 'Revoking...' : 'Revoke Passcode'}
                    </button>
                  )}
                </div>
              );
            })}

            {sortedInvitations.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-500">
                No invitations issued for this CareCircle yet. Generate a single-use passcode above to invite elderly members, family, or caregivers.
              </p>
            )}
          </div>
        </section>
      )}

      {/* Family & Caregiver Collaboration Space */}
      <section className="hc-surface rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Family &amp; Caregiver Collaboration Space
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Coordinate pharmacy refills, record daily care observations, or alert family members.
            </p>
          </div>
        </div>

        <form onSubmit={handleAddTask} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-12">
          <select
            aria-label="Update type"
            value={taskCategory}
            onChange={(e) => setTaskCategory(e.target.value as CareTask['category'])}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 sm:col-span-3"
          >
            <option value="task">Shared Care Task</option>
            <option value="care_log">Daily Care Report</option>
            <option value="assistance_alert">Assistance Alert</option>
          </select>
          <input
            type="text"
            required
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            placeholder="Task or care report title..."
            className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 sm:col-span-4"
          />
          <input
            type="text"
            value={taskNotes}
            onChange={(e) => setTaskNotes(e.target.value)}
            placeholder="Details (optional)..."
            className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 sm:col-span-3"
          />
          <button
            type="submit"
            disabled={postingTask}
            className="hc-primary-btn inline-flex items-center justify-center gap-1.5 rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-50 sm:col-span-2"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {postingTask ? 'Posting...' : 'Post'}
          </button>
        </form>

        <div className="mt-5 divide-y divide-slate-100 dark:divide-slate-800">
          {careTasks.map((task) => (
            <div key={task.id} className="flex items-start justify-between gap-4 py-3.5">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => void toggleCareTask(task.id)}
                  aria-label="Toggle task completion"
                  className="mt-0.5 text-sky-700 dark:text-sky-400"
                >
                  {task.completed ? (
                    <CheckSquare className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
                  ) : (
                    <Square className="h-5 w-5" />
                  )}
                </button>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`font-semibold ${
                        task.completed ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {task.title}
                    </span>
                    {task.category === 'assistance_alert' && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 dark:text-rose-400">
                        <BellRing className="h-3.5 w-3.5" aria-hidden="true" />
                        Assistance Alert
                      </span>
                    )}
                    {task.category === 'care_log' && (
                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        · Care Report
                      </span>
                    )}
                  </div>
                  {task.notes && (
                    <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{task.notes}</p>
                  )}
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Posted by {task.createdByName} · {formatTimestamp(task.createdAt)}
                    {task.completed && task.completedBy ? ` · Completed by ${task.completedBy}` : ''}
                  </p>
                </div>
              </div>
              {(permissions.isOwner || task.createdBy === userAccount?.uid) && (
                <button
                  type="button"
                  onClick={() => void deleteCareTask(task.id)}
                  aria-label="Delete task"
                  className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
          {careTasks.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-500">
              No shared care tasks or daily reports posted yet.
            </p>
          )}
        </div>
      </section>

      {/* Recent Collaboration & Access Audit History */}
      <section className="hc-surface rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-sky-700 dark:text-sky-400" aria-hidden="true" />
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Recent Collaboration &amp; Access Audit History
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setCurrentPage('analytics')}
            className="text-sm font-semibold text-sky-700 hover:underline dark:text-sky-400"
          >
            Filterable Audit Feed
          </button>
        </div>

        <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
          {accessAuditLogs.map((act) => (
            <div
              key={act.id}
              className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center"
            >
              <div>
                <p className="text-sm text-slate-900 dark:text-white">
                  <span className="font-semibold">{act.actorName}</span>{' '}
                  <span className="text-xs capitalize text-slate-500">({act.actorRole})</span> ·{' '}
                  <span className="font-medium text-sky-800 dark:text-sky-300">{act.action}</span> —{' '}
                  <span className="font-semibold">{act.targetName}</span>
                </p>
                {act.details && (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{act.details}</p>
                )}
              </div>
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                {formatTimestamp(act.createdAt)}
              </span>
            </div>
          ))}
          {accessAuditLogs.length === 0 && (
            <p className="py-5 text-center text-sm text-slate-500">
              No collaboration or dose audit activity recorded yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

