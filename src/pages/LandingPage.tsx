import React from 'react';
import {
  ArrowRight,
  BellRing,
  CalendarCheck,
  Eye,
  HeartHandshake,
  Languages,
  Pill,
  ShieldCheck,
  Sparkles,
  Users,
  Volume2,
} from 'lucide-react';
import { useCareCircle } from '../context/CareCircleContext';

export const LandingPage: React.FC = () => {
  const { setCurrentPage, enterDemoSandbox, theme, updatePreferences } = useCareCircle();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Three-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-6 py-4">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="font-display text-xl font-bold tracking-tight text-sky-800 dark:text-sky-400 whitespace-nowrap shrink-0"
          >
            CareCircle
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#problem" className="hover:text-sky-700 dark:hover:text-sky-300 transition-colors whitespace-nowrap shrink-0">
              Why CareCircle
            </a>
            <a href="#features" className="hover:text-sky-700 dark:hover:text-sky-300 transition-colors whitespace-nowrap shrink-0">
              Capabilities
            </a>
            <a href="#how-it-works" className="hover:text-sky-700 dark:hover:text-sky-300 transition-colors whitespace-nowrap shrink-0">
              How It Works
            </a>
            <a href="#accessibility" className="hover:text-sky-700 dark:hover:text-sky-300 transition-colors whitespace-nowrap shrink-0">
              Accessibility
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setCurrentPage('auth')}
              className="rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 transition-colors whitespace-nowrap shrink-0"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        {/* Hero Section */}
        <section className="mx-auto max-w-6xl px-6 py-14 lg:py-20">
          <div className="grid grid-cols-1 items-stretch gap-10 lg:grid-cols-12">
            <div className="flex flex-col justify-center lg:col-span-6">
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                Together for Better Elderly Care
              </p>
              <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl [text-wrap:balance]">
                Independent living for seniors, shared peace of mind for families.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-300 sm:text-lg">
                CareCircle connects elderly individuals, remote family members, and caregivers around
                daily medication routines, doctor appointments, and clear health reminders while keeping
                the senior in full control of their privacy.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => enterDemoSandbox('elderly')}
                  className="inline-flex items-center gap-2 rounded-xl bg-sky-700 px-6 py-3.5 text-base font-semibold text-white hover:bg-sky-800 transition-colors whitespace-nowrap shrink-0"
                >
                  Launch Interactive Demo
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage('auth')}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-base font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                >
                  Sign In with Google
                </button>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                <span>Role-Based Access Control</span>
                <span aria-hidden="true">·</span>
                <span>English, Hindi &amp; Bengali</span>
                <span aria-hidden="true">·</span>
                <span>High-Contrast &amp; Voice Ready</span>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative h-full min-h-[300px] overflow-hidden rounded-2xl border border-slate-200 bg-sky-50 dark:border-slate-800 dark:bg-slate-900">
                <img
                  src="/src/assets/images/hero_carecircle_home_1794728030156.jpg"
                  alt="Senior woman and her daughter smiling together while reviewing daily medication care on a tablet"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-950/40 to-transparent p-6 text-white">
                  <p className="text-sm font-medium">
                    Built for dignity at home — clear large-button routines for seniors and instant adherence visibility for loved ones.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 4-Column Quantitative Summary Strip */}
          <div className="mt-12 grid grid-cols-1 gap-4 border-t border-slate-200 pt-8 dark:border-slate-800 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="font-mono text-2xl font-bold text-sky-700 dark:text-sky-400 tabular-nums">3 Roles</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Elderly Owner, Family Member, and Assigned Caregiver</p>
            </div>
            <div>
              <p className="font-mono text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">60m Grace</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Configurable dose window before missed-dose alerts fire</p>
            </div>
            <div>
              <p className="font-mono text-2xl font-bold text-sky-700 dark:text-sky-400 tabular-nums">SHA-256</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Server-hashed, expiring, single-use CareCircle invites</p>
            </div>
            <div>
              <p className="font-mono text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">3 Languages</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Instant switching across English, Hindi, and Bengali</p>
            </div>
          </div>
        </section>

        {/* Problem & Solution Section */}
        <section id="problem" className="border-y border-slate-200 bg-white py-16 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 dark:border-slate-800 dark:bg-slate-950">
                <p className="text-xs font-semibold tracking-wide text-amber-700 dark:text-amber-400">The Challenge</p>
                <h2 className="mt-2 font-display text-2xl font-bold text-slate-900 dark:text-white">
                  Daily care breaks down across distance and small screens.
                </h2>
                <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-300">
                  An elderly parent living alone often manages three or more prescriptions at different hours.
                  Adult children in another city cannot easily tell whether morning tablets were taken or a cardiology visit was rescheduled,
                  while visiting caregivers lack a shared logbook.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-sky-50/60 p-8 dark:border-slate-800 dark:bg-slate-950">
                <p className="text-xs font-semibold tracking-wide text-sky-700 dark:text-sky-400">The CareCircle Solution</p>
                <h2 className="mt-2 font-display text-2xl font-bold text-slate-900 dark:text-white">
                  One trusted circle where the senior stays in charge.
                </h2>
                <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-300">
                  Elderly users see large, calm routine cards with one-tap Taken or Skip buttons.
                  They decide who enters their CareCircle via single-use hashed passcodes and exactly what each family member or caregiver can view or update.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Core Capabilities Bento Grid */}
        <section id="features" className="mx-auto max-w-6xl px-6 py-16">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Everything needed for organized daily care
            </h2>
            <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
              Designed to replace scattered paper notes, missed phone check-ins, and cluttered reminder apps.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-7 dark:border-slate-800 dark:bg-slate-900 md:col-span-2">
              <Pill className="h-6 w-6 text-sky-700 dark:text-sky-400" aria-hidden="true" />
              <h3 className="mt-4 font-display text-xl font-semibold text-slate-900 dark:text-white">
                Grace-Period Medication Tracking &amp; Audit History
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Record exact prescribed dosages, frequency, start/end dates, and instructions. Every Taken, Missed, or Skipped action records who logged it and when. Doses are never flagged missed until their configured grace period expires.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-7 dark:border-slate-800 dark:bg-slate-900">
              <ShieldCheck className="h-6 w-6 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
              <h3 className="mt-4 font-display text-xl font-semibold text-slate-900 dark:text-white">
                Hashed Invites &amp; RBAC
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Single-use passcodes are stored only as SHA-256 hashes, expire automatically, and enforce strict backend and Firestore permission rules.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-7 dark:border-slate-800 dark:bg-slate-900">
              <CalendarCheck className="h-6 w-6 text-sky-700 dark:text-sky-400" aria-hidden="true" />
              <h3 className="mt-4 font-display text-xl font-semibold text-slate-900 dark:text-white">
                Appointment Calendar
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Switch between monthly calendar and list views for cardiology, endocrinology, and follow-up visits with doctor notes and reminders.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-7 dark:border-slate-800 dark:bg-slate-900">
              <BellRing className="h-6 w-6 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
              <h3 className="mt-4 font-display text-xl font-semibold text-slate-900 dark:text-white">
                Smart Email &amp; In-App Alerts
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Automated reminder checks via Resend, SendGrid, or Webhook adapters—plus transparent Demonstration Mode logging when external email keys are absent.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-7 dark:border-slate-800 dark:bg-slate-900">
              <Sparkles className="h-6 w-6 text-sky-700 dark:text-sky-400" aria-hidden="true" />
              <h3 className="mt-4 font-display text-xl font-semibold text-slate-900 dark:text-white">
                Medically Safe AI Assistant
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Summarizes today’s schedule, weekly adherence, and upcoming visits using authorized records only—never diagnosing or altering prescriptions.
              </p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="border-y border-slate-200 bg-white py-16 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              How CareCircle Works
            </h2>
            <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3">
              <div>
                <p className="font-mono text-sm font-semibold text-sky-700 dark:text-sky-400">01. Create &amp; Configure</p>
                <h3 className="mt-2 font-display text-xl font-semibold text-slate-900 dark:text-white">
                  Set up the elderly profile
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  Add prescribed medications, scheduled times, grace periods, emergency contacts, and preferred language in minutes.
                </p>
              </div>
              <div>
                <p className="font-mono text-sm font-semibold text-sky-700 dark:text-sky-400">02. Invite with Control</p>
                <h3 className="mt-2 font-display text-xl font-semibold text-slate-900 dark:text-white">
                  Share a single-use passcode
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  Generate an expiring invitation for a daughter, son, or nurse with exact permissions for viewing, logging, or editing.
                </p>
              </div>
              <div>
                <p className="font-mono text-sm font-semibold text-sky-700 dark:text-sky-400">03. Track &amp; Coordinate</p>
                <h3 className="mt-2 font-display text-xl font-semibold text-slate-900 dark:text-white">
                  Stay aligned every day
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  One-tap dose confirmations update the family timeline immediately, while missed-dose checks and care notes keep everyone informed.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Accessibility Section */}
        <section id="accessibility" className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900">
                <img
                  src="/src/assets/images/care_routine_table_1794728030201.jpg"
                  alt="Caregiver and elderly gentleman organizing weekly medication calmly at a sunlit kitchen table"
                  referrerPolicy="no-referrer"
                  className="aspect-[4/3] w-full object-cover"
                />
              </div>
            </div>

            <div className="lg:col-span-7">
              <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white [text-wrap:balance]">
                Accessibility engineered for seniors, not added as an afterthought
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-300">
                Elderly users greet each day with a simplified large-card routine view—free of tiny links or dense charts—paired with assistive tools right at hand.
              </p>

              <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <Eye className="mt-0.5 h-5 w-5 shrink-0 text-sky-700 dark:text-sky-400" aria-hidden="true" />
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">High-Contrast &amp; Font Scaling</h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      Instant toggle for pure high-contrast AAA surfaces, dark mode, and Normal / Large / Extra Large typography.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Volume2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">Voice Readback &amp; Speech Input</h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      Listen to today’s schedule or ask the AI Care Assistant hands-free where browser speech is supported.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Languages className="mt-0.5 h-5 w-5 shrink-0 text-sky-700 dark:text-sky-400" aria-hidden="true" />
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">English, Hindi &amp; Bengali</h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      Switch interface labels and AI Care Assistant responses seamlessly across three languages.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Users className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">One-Tap Emergency Shortcut</h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      Designated family emergency contact is always reachable with a safe confirmation step.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Band */}
        <section className="mx-auto max-w-6xl px-6 pb-16">
          <div className="rounded-2xl border border-sky-200 bg-sky-900 p-10 text-white dark:border-sky-800">
            <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2 text-sky-200 text-sm font-medium">
                  <HeartHandshake className="h-5 w-5" aria-hidden="true" />
                  <span>Explore CareCircle in seconds</span>
                </div>
                <h2 className="mt-2 font-display text-3xl font-bold [text-wrap:balance]">
                  Try all three user roles in our interactive Demo Sandbox or sign in with Google.
                </h2>
              </div>
              <div className="flex flex-wrap gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => enterDemoSandbox('elderly')}
                  className="rounded-xl bg-white px-6 py-3.5 text-base font-semibold text-sky-900 hover:bg-sky-50 transition-colors whitespace-nowrap"
                >
                  Open Demo Sandbox
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage('auth')}
                  className="rounded-xl border border-sky-400 px-6 py-3.5 text-base font-semibold text-white hover:bg-sky-800 transition-colors whitespace-nowrap"
                >
                  Sign In / Register
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 sm:flex-row sm:items-center">
          <div>
            <span className="font-display text-base font-bold text-slate-900 dark:text-white">CareCircle</span>
            <span className="ml-3 text-sm text-slate-500 dark:text-slate-400">
              Together for Better Elderly Care · Demo uses synthetic sample data only
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <button
              type="button"
              onClick={() => void updatePreferences({ theme: theme === 'dark' ? 'light' : 'dark' })}
              className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              {theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
