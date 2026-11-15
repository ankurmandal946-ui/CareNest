import React, { useEffect, useState } from 'react';
import { Eye, Languages, LogOut, Save, Shield, Volume2 } from 'lucide-react';
import { useCareCircle } from '../context/CareCircleContext';
import type { AppLanguage, FontScale, ThemeMode } from '../types/carecircle';

export const SettingsPage: React.FC = () => {
  const {
    mode,
    userAccount,
    userPrivate,
    activeCircle,
    permissions,
    language,
    theme,
    highContrast,
    fontScale,
    voiceEnabled,
    updatePreferences,
    updateNotificationPrefs,
    updateCareCircleProfile,
    logout,
    notifyToast,
  } = useCareCircle();

  const [displayName, setDisplayName] = useState(userAccount?.displayName || '');
  const [email, setEmail] = useState(userPrivate?.email || '');
  const [phone, setPhone] = useState(userPrivate?.phone || '');

  const [elderlyName, setElderlyName] = useState(activeCircle?.elderlyName || '');
  const [elderlyAge, setElderlyAge] = useState(String(activeCircle?.elderlyAge || 72));
  const [allergies, setAllergies] = useState(activeCircle?.allergies || '');
  const [careNotes, setCareNotes] = useState(activeCircle?.careNotes || '');
  const [emergencyName, setEmergencyName] = useState(activeCircle?.emergencyContactName || '');
  const [emergencyPhone, setEmergencyPhone] = useState(activeCircle?.emergencyContactPhone || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(userAccount?.displayName || '');
  }, [userAccount?.uid, userAccount?.displayName]);

  useEffect(() => {
    setEmail(userPrivate?.email || '');
    setPhone(userPrivate?.phone || '');
  }, [userPrivate?.uid, userPrivate?.email, userPrivate?.phone]);

  useEffect(() => {
    if (!activeCircle) return;
    setElderlyName(activeCircle.elderlyName || '');
    setElderlyAge(String(activeCircle.elderlyAge || 72));
    setAllergies(activeCircle.allergies || '');
    setCareNotes(activeCircle.careNotes || '');
    setEmergencyName(activeCircle.emergencyContactName || '');
    setEmergencyPhone(activeCircle.emergencyContactPhone || '');
  }, [
    activeCircle,
    activeCircle?.id,
    activeCircle?.elderlyName,
    activeCircle?.elderlyAge,
    activeCircle?.allergies,
    activeCircle?.careNotes,
    activeCircle?.emergencyContactName,
    activeCircle?.emergencyContactPhone,
  ]);

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      notifyToast('error', 'Display name cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      await updatePreferences({ displayName: displayName.trim() });
      await updateNotificationPrefs({ email: email.trim(), phone: phone.trim() }, { silent: true });
      notifyToast('success', 'Account settings saved.');
    } catch (err) {
      notifyToast('error', err instanceof Error ? err.message : 'Could not save account settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissions.isOwner) return;
    if (!elderlyName.trim() || !emergencyName.trim() || emergencyPhone.trim().length < 3) {
      notifyToast(
        'error',
        'Elderly name, emergency contact name, and emergency phone (min 3 chars) are required.'
      );
      return;
    }
    setSaving(true);
    try {
      await updateCareCircleProfile({
        elderlyName: elderlyName.trim(),
        elderlyAge: Number(elderlyAge) || 70,
        allergies: allergies.trim(),
        careNotes: careNotes.trim(),
        emergencyContactName: emergencyName.trim(),
        emergencyContactPhone: emergencyPhone.trim(),
      });
    } catch (err) {
      notifyToast('error', err instanceof Error ? err.message : 'Could not save CareCircle profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
            Profile, Accessibility &amp; Settings
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Customize readability, language, theme, emergency contact, and account details.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void logout()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign Out ({mode === 'demo' ? 'Exit Demo' : 'Logout'})
        </button>
      </div>

      {/* Accessibility & Localization Settings */}
      <section className="hc-surface rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-sky-700 dark:text-sky-400" aria-hidden="true" />
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            Accessibility &amp; Language Experience
          </h2>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
              <Languages className="h-3.5 w-3.5" aria-hidden="true" />
              Language
            </label>
            <select
              value={language}
              onChange={(e) => void updatePreferences({ language: e.target.value as AppLanguage })}
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी (Hindi)</option>
              <option value="bn">বাংলা (Bengali)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
              Text Size
            </label>
            <select
              value={fontScale}
              onChange={(e) => void updatePreferences({ fontScale: e.target.value as FontScale })}
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="normal">Normal (16px)</option>
              <option value="large">Large (18px)</option>
              <option value="xlarge">Extra Large (20px)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
              Color Theme
            </label>
            <select
              value={theme}
              onChange={(e) => void updatePreferences({ theme: e.target.value as ThemeMode })}
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="light">Calm Light Mode</option>
              <option value="dark">Midnight Dark Mode</option>
            </select>
          </div>

          <div className="flex flex-col justify-end gap-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700">
              <input
                type="checkbox"
                checked={highContrast}
                onChange={(e) => void updatePreferences({ highContrast: e.target.checked })}
                className="h-4 w-4 accent-sky-700"
              />
              High-Contrast Mode
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700">
              <input
                type="checkbox"
                checked={voiceEnabled}
                onChange={(e) => void updatePreferences({ voiceEnabled: e.target.checked })}
                className="h-4 w-4 accent-sky-700"
              />
              <Volume2 className="h-4 w-4" aria-hidden="true" />
              Voice Readback
            </label>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Account Details */}
        <form
          onSubmit={handleSaveAccount}
          className="hc-surface space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
        >
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            Your Account Details
          </h2>
          <div>
            <label className="block text-xs font-medium">Display Name</label>
            <input
              type="text"
              required
              maxLength={100}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block text-xs font-medium">Notification Email</label>
            <input
              type="email"
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block text-xs font-medium">Phone Number (Private)</label>
            <input
              type="tel"
              maxLength={32}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="hc-primary-btn inline-flex items-center gap-2 rounded-xl bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-800"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            Save Account
          </button>
        </form>

        {/* Elderly CareCircle Profile */}
        <form
          onSubmit={handleSaveProfile}
          className="hc-surface space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Elderly Care Profile &amp; Emergency Contact
            </h2>
            <Shield className="h-4 w-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium">Elderly Name</label>
              <input
                type="text"
                maxLength={100}
                disabled={!permissions.isOwner}
                value={elderlyName}
                onChange={(e) => setElderlyName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium">Age</label>
              <input
                type="number"
                min={1}
                max={130}
                disabled={!permissions.isOwner}
                value={elderlyAge}
                onChange={(e) => setElderlyAge(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium">Emergency Contact Name</label>
              <input
                type="text"
                maxLength={100}
                disabled={!permissions.isOwner}
                value={emergencyName}
                onChange={(e) => setEmergencyName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium">Emergency Phone</label>
              <input
                type="tel"
                maxLength={32}
                disabled={!permissions.isOwner}
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium">Allergies &amp; Care Notes</label>
            <textarea
              rows={2}
              maxLength={500}
              disabled={!permissions.isOwner}
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              placeholder="Allergies"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
            />
            <textarea
              rows={2}
              maxLength={1000}
              disabled={!permissions.isOwner}
              value={careNotes}
              onChange={(e) => setCareNotes(e.target.value)}
              placeholder="Daily care notes"
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          {permissions.isOwner ? (
            <button
              type="submit"
              disabled={saving}
              className="hc-primary-btn inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              Save Elderly Profile
            </button>
          ) : (
            <p className="text-xs text-slate-500">
              Only the Elderly CareCircle Owner can edit core profile and emergency contact details.
            </p>
          )}
        </form>
      </div>
    </div>
  );
};
