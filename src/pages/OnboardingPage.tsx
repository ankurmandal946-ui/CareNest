import React, { useState } from 'react';
import { KeyRound, UserPlus } from 'lucide-react';
import { useCareCircle } from '../context/CareCircleContext';
import type { AppLanguage, FontScale, UserRole } from '../types/carecircle';

export const OnboardingPage: React.FC = () => {
  const {
    firebaseUser,
    userAccount,
    createCareCircle,
    redeemInvitation,
    logout,
    notifyToast,
    language: currentLang,
    highContrast: currentContrast,
    fontScale: currentScale,
  } = useCareCircle();

  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [submitting, setSubmitting] = useState(false);

  // Create CareCircle form
  const [creatorRole, setCreatorRole] = useState<UserRole>(
    userAccount?.preferredRole || 'elderly'
  );
  const [elderlyName, setElderlyName] = useState(
    userAccount?.displayName || firebaseUser?.displayName || ''
  );
  const [elderlyAge, setElderlyAge] = useState('72');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [allergies, setAllergies] = useState('');
  const [careNotes, setCareNotes] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [emergencyContactRelation, setEmergencyContactRelation] = useState('Daughter / Son');
  const [language, setLanguage] = useState<AppLanguage>(currentLang);
  const [highContrast, setHighContrast] = useState(currentContrast);
  const [fontScale, setFontScale] = useState<FontScale>(currentScale);

  // Join with Invite form
  const [inviteCode, setInviteCode] = useState('');
  const [joinDisplayName, setJoinDisplayName] = useState(
    userAccount?.displayName || firebaseUser?.displayName || ''
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!elderlyName.trim() || !emergencyContactName.trim() || !emergencyContactPhone.trim()) {
      notifyToast('error', 'Please fill in your name and emergency contact details.');
      return;
    }
    setSubmitting(true);
    try {
      await createCareCircle({
        creatorRole,
        elderlyName,
        elderlyAge: Number(elderlyAge) || 70,
        bloodGroup,
        allergies,
        careNotes,
        emergencyContactName,
        emergencyContactPhone,
        emergencyContactRelation,
        language,
        highContrast,
        fontScale,
      });
    } catch (err) {
      notifyToast('error', err instanceof Error ? err.message : 'Failed to create CareCircle.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      notifyToast('error', 'Please enter your CareCircle invitation code.');
      return;
    }
    setSubmitting(true);
    try {
      await redeemInvitation(inviteCode, joinDisplayName);
    } catch (err) {
      notifyToast('error', err instanceof Error ? err.message : 'Could not join CareCircle.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-display text-lg font-bold text-sky-700 dark:text-sky-400">CareCircle</p>
            <h1 className="mt-1 font-display text-3xl font-bold text-slate-900 dark:text-white">
              Welcome! Let’s set up your access
            </h1>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Sign Out
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="mt-6 flex gap-2 rounded-xl bg-slate-200/70 p-1 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setTab('create')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${
              tab === 'create'
                ? 'bg-white text-sky-800 shadow-sm dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Create a CareCircle Profile
          </button>
          <button
            type="button"
            onClick={() => setTab('join')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${
              tab === 'join'
                ? 'bg-white text-sky-800 shadow-sm dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            I have a CareCircle Invitation Code
          </button>
        </div>

        {tab === 'create' ? (
          <form
            onSubmit={handleCreate}
            className="mt-6 space-y-6 rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900"
          >
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Your Role in This CareCircle *
              </label>
              <select
                value={creatorRole}
                onChange={(e) => setCreatorRole(e.target.value as UserRole)}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 focus:border-sky-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                <option value="elderly">Elderly Person (Managing My Own Care)</option>
                <option value="family">Family Member (Setting Up for My Loved One)</option>
                <option value="caregiver">Caregiver (Coordinating Care)</option>
              </select>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                As CareCircle creator, you can invite elderly members, family members, and caregivers with scoped permissions.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Elderly Person’s Full Name *
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={elderlyName}
                  onChange={(e) => setElderlyName(e.target.value)}
                  placeholder="e.g., Martha Sen"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 focus:border-sky-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Age *</label>
                  <input
                    type="number"
                    min={1}
                    max={130}
                    required
                    value={elderlyAge}
                    onChange={(e) => setElderlyAge(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 focus:border-sky-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Blood Group</label>
                  <input
                    type="text"
                    maxLength={16}
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    placeholder="O+"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 focus:border-sky-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Emergency Contact Name *
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={emergencyContactName}
                  onChange={(e) => setEmergencyContactName(e.target.value)}
                  placeholder="e.g., Rohan Sen"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Emergency Phone *
                </label>
                <input
                  type="tel"
                  required
                  maxLength={32}
                  value={emergencyContactPhone}
                  onChange={(e) => setEmergencyContactPhone(e.target.value)}
                  placeholder="+1 555 234 8910"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Relationship</label>
                <input
                  type="text"
                  maxLength={64}
                  value={emergencyContactRelation}
                  onChange={(e) => setEmergencyContactRelation(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Known Allergies</label>
                <input
                  type="text"
                  maxLength={500}
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  placeholder="e.g., Penicillin (optional)"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Daily Care Notes</label>
                <input
                  type="text"
                  maxLength={1000}
                  value={careNotes}
                  onChange={(e) => setCareNotes(e.target.value)}
                  placeholder="e.g., Take morning tablets with warm water"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            </div>

            {/* Accessibility Defaults */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Accessibility Preferences</p>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Language</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as AppLanguage)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                  >
                    <option value="en">English</option>
                    <option value="hi">हिन्दी (Hindi)</option>
                    <option value="bn">বাংলা (Bengali)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Text Size</label>
                  <select
                    value={fontScale}
                    onChange={(e) => setFontScale(e.target.value as FontScale)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                  >
                    <option value="normal">Normal</option>
                    <option value="large">Large (Recommended)</option>
                    <option value="xlarge">Extra Large</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900">
                    <input
                      type="checkbox"
                      checked={highContrast}
                      onChange={(e) => setHighContrast(e.target.checked)}
                      className="h-4 w-4 accent-sky-700"
                    />
                    High-Contrast Mode
                  </label>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-sky-700 px-6 py-4 text-base font-semibold text-white hover:bg-sky-800 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Creating CareCircle...' : 'Create My CareCircle'}
            </button>
          </form>
        ) : (
          <form
            onSubmit={handleJoin}
            className="mt-6 space-y-5 rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900"
          >
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Your Name *</label>
              <input
                type="text"
                required
                maxLength={100}
                value={joinDisplayName}
                onChange={(e) => setJoinDisplayName(e.target.value)}
                placeholder="e.g., Rohan Sen"
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Single-Use Invitation Passcode *
              </label>
              <input
                type="text"
                required
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="CC-XXXX-XXXX"
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono text-lg tracking-wider uppercase dark:border-slate-700 dark:bg-slate-950"
              />
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Works for invited elderly users, family members, and caregivers. Passcodes are verified on the server against their SHA-256 hash, inherit your scoped role permissions, expire automatically, and become invalid once redeemed or revoked.
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-emerald-700 px-6 py-4 text-base font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Verifying Invitation...' : 'Join CareCircle'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
