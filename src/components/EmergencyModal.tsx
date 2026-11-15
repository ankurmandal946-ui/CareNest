import React, { useEffect } from 'react';
import { AlertTriangle, PhoneCall, X } from 'lucide-react';
import { useCareCircle } from '../context/CareCircleContext';

interface EmergencyModalProps {
  open: boolean;
  onClose: () => void;
}

export const EmergencyModal: React.FC<EmergencyModalProps> = ({ open, onClose }) => {
  const { activeCircle, notifyToast } = useCareCircle();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || !activeCircle) return null;

  const phoneClean = activeCircle.emergencyContactPhone.replace(/[^+\d]/g, '');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="emergency-title"
    >
      <div className="hc-surface max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-rose-300 bg-white p-6 shadow-xl dark:border-rose-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 text-rose-700 dark:text-rose-400">
            <AlertTriangle className="h-6 w-6 shrink-0" aria-hidden="true" />
            <h2 id="emergency-title" className="font-display text-xl font-bold">
              Confirm Emergency Call
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close emergency dialog"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <p className="mt-4 text-base text-slate-700 dark:text-slate-300">
          Are you sure you want to contact your designated emergency person now?
        </p>

        <div className="hc-surface mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {activeCircle.emergencyContactName}
          </p>
          <p className="mt-1 font-mono text-lg font-bold text-rose-700 dark:text-rose-400 tabular-nums">
            {activeCircle.emergencyContactPhone}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Relationship: {activeCircle.emergencyContactRelation || 'Emergency Contact'}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <a
            href={`tel:${phoneClean}`}
            onClick={() => {
              notifyToast('info', `Initiating call to ${activeCircle.emergencyContactName}...`);
              onClose();
            }}
            className="hc-primary-btn inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-700 px-5 py-3.5 text-base font-semibold text-white hover:bg-rose-800 transition-colors"
          >
            <PhoneCall className="h-5 w-5" aria-hidden="true" />
            Call Now
          </a>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-300 px-5 py-3.5 text-base font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
