import React, { useState } from 'react';
import { ArrowLeft, HeartHandshake, ShieldCheck, Stethoscope, Users } from 'lucide-react';
import { useCareCircle } from '../context/CareCircleContext';
import { DEMO_PROFILES, getDemoActor } from '../lib/demoSeed';
import type { DemoCircleId, UserRole } from '../types/carecircle';

export const AuthPage: React.FC = () => {
  const { signInWithGoogle, enterDemoSandbox, setCurrentPage } = useCareCircle();
  const [selectedCircle, setSelectedCircle] = useState<DemoCircleId>('demo-circle-sen');

  const profileMeta = DEMO_PROFILES[selectedCircle];

  const roles: Array<{
    role: UserRole;
    subtitle: string;
    detail: string;
    icon: React.ReactNode;
  }> = [
    {
      role: 'elderly',
      subtitle: 'Elderly User / Owner',
      detail: 'Simplified large-card daily routine, full privacy control, voice assistance & invites.',
      icon: <HeartHandshake className="h-5 w-5 text-sky-700 dark:text-sky-400" aria-hidden="true" />,
    },
    {
      role: 'family',
      subtitle: profileMeta.actors.family.relation,
      detail: 'Monitors adherence remotely, receives missed-dose alerts, coordinates appointments.',
      icon: <Users className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />,
    },
    {
      role: 'caregiver',
      subtitle: profileMeta.actors.caregiver.relation,
      detail: 'Updates permitted schedules, records doses, logs daily vitals & alerts family.',
      icon: <Stethoscope className="h-5 w-5 text-sky-700 dark:text-sky-400" aria-hidden="true" />,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-4xl">
        <button
          type="button"
          onClick={() => setCurrentPage('landing')}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to CareCircle Home
        </button>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Google Sign-In Column */}
          <div className="rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900 lg:col-span-5">
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              Sign in to CareCircle
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Sign in or register with your verified Google account to persist your CareCircle securely in Cloud Firestore.
            </p>

            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl bg-sky-700 px-5 py-3.5 text-base font-semibold text-white hover:bg-sky-800 transition-colors"
            >
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              Continue with Google
            </button>

            <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                New Elderly Users will be guided through a simple 1-page setup. Family members and caregivers can enter an invitation passcode right after signing in.
              </p>
            </div>
          </div>

          {/* Instant 1-Click Demo Sandbox Column */}
          <div className="rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900 lg:col-span-7">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Instant Demo Sandbox
            </h2>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">
              Choose a fictional elderly profile below and launch with one click—no real personal health data required. Switch roles or reset anytime inside the app.
            </p>

            {/* Fictional Elderly Profile Selector */}
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {(['demo-circle-sen', 'demo-circle-kapoor'] as DemoCircleId[]).map((cid) => {
                const meta = DEMO_PROFILES[cid];
                const selected = selectedCircle === cid;
                return (
                  <button
                    key={cid}
                    type="button"
                    onClick={() => setSelectedCircle(cid)}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      selected
                        ? 'border-sky-600 bg-sky-50/80 dark:border-sky-400 dark:bg-sky-950/40'
                        : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white">{meta.label}</span>
                      <span className="font-mono text-xs text-sky-700 dark:text-sky-400">Age {meta.age}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{meta.focusSummary}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 space-y-3">
              {roles.map((item) => {
                const actor = getDemoActor(selectedCircle, item.role);
                return (
                  <button
                    key={`${selectedCircle}-${item.role}`}
                    type="button"
                    onClick={() => enterDemoSandbox(item.role, selectedCircle)}
                    className="flex w-full items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-left hover:border-sky-500 hover:bg-sky-50/60 dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-sky-500 dark:hover:bg-slate-800/80 transition-colors"
                  >
                    <img
                      src={actor.avatarUrl}
                      alt={actor.displayName}
                      referrerPolicy="no-referrer"
                      className="h-12 w-12 rounded-full object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.icon}
                        <span className="font-semibold text-slate-900 dark:text-white">{actor.displayName}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">· {item.subtitle}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{item.detail}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
