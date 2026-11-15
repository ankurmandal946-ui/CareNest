import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Loader2,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  ShieldCheck,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useCareCircle } from '../context/CareCircleContext';
import {
  computeScheduleForDate,
  computeWeeklyAdherence,
  getCurrentMinutesOfDay,
  getTodayDateKey,
  isSpeechRecognitionSupported,
  speakText,
  stopSpeaking,
} from '../lib/scheduleUtils';
import type { AppLanguage, ChatMessage } from '../types/carecircle';

interface AssistantLocaleStrings {
  title: string;
  subtitlePrefix: string;
  subtitleSuffix: string;
  safetyTitle: string;
  safetyBody: string;
  todayLabel: string;
  pendingLabel: string;
  adherenceLabel: string;
  appointmentsLabel: string;
  privacyNote: string;
  welcome: string;
  quickPrompts: string[];
  youLabel: string;
  assistantLabel: string;
  loadingLabel: string;
  listenLabel: string;
  stopLabel: string;
  clearChatLabel: string;
  retryLabel: string;
  sendLabel: string;
  placeholder: string;
  listeningPlaceholder: string;
  voiceUnsupported: string;
  emptyReplyFallback: string;
}

const ASSISTANT_I18N: Record<AppLanguage, AssistantLocaleStrings> = {
  en: {
    title: 'AI Care Assistant',
    subtitlePrefix: 'Ask questions about',
    subtitleSuffix: 'authorized medications, appointments, weekly adherence, or CareCircle features.',
    safetyTitle: 'Safety & Privacy Boundary:',
    safetyBody:
      'Uses only this CareCircle’s authorized records. Never diagnoses conditions, prescribes medicines, invents data, or recommends dosage changes. Always consult a qualified doctor for medical decisions.',
    todayLabel: 'Today’s doses',
    pendingLabel: 'pending',
    adherenceLabel: '7-day adherence',
    appointmentsLabel: 'Upcoming visits',
    privacyNote: 'Scoped to active CareCircle only',
    welcome:
      'Hello! I am the CareCircle AI Care Assistant. I can summarize weekly medication adherence, explain today’s recorded schedule, and list upcoming doctor appointments using only your CareCircle’s authorized records.',
    quickPrompts: [
      'Give me a summary of medication adherence this week.',
      'Which medicines are scheduled for today?',
      'Which doses are still pending or missed?',
      'When is the next doctor appointment?',
      'How do I invite a family member or caregiver?',
    ],
    youLabel: 'You',
    assistantLabel: 'CareCircle Assistant',
    loadingLabel: 'Reviewing authorized CareCircle records...',
    listenLabel: 'Listen',
    stopLabel: 'Stop',
    clearChatLabel: 'Clear Chat',
    retryLabel: 'Retry',
    sendLabel: 'Send',
    placeholder: 'Ask about today’s medicines, weekly adherence, or upcoming visits...',
    listeningPlaceholder: 'Listening... speak your question clearly',
    voiceUnsupported: 'Voice recognition is not supported in this browser.',
    emptyReplyFallback: 'I could not complete that request right now.',
  },
  hi: {
    title: 'एआई देखभाल सहायक',
    subtitlePrefix: 'अपने अधिकृत CareCircle रिकॉर्ड के आधार पर',
    subtitleSuffix: 'की दवाइयों, अपॉइंटमेंट और साप्ताहिक पालन के बारे में पूछें।',
    safetyTitle: 'सुरक्षा और गोपनीयता सीमा:',
    safetyBody:
      'यह केवल इस CareCircle के अधिकृत रिकॉर्ड का उपयोग करता है। यह कभी बीमारी का निदान नहीं करता, दवा नहीं लिखता, और खुराक बदलने की सलाह नहीं देता। चिकित्सीय सलाह के लिए हमेशा डॉक्टर से संपर्क करें।',
    todayLabel: 'आज की खुराक',
    pendingLabel: 'बाकी',
    adherenceLabel: '7-दिन पालन',
    appointmentsLabel: 'आगामी अपॉइंटमेंट',
    privacyNote: 'केवल सक्रिय CareCircle तक सीमित',
    welcome:
      'नमस्कार! मैं CareCircle एआई देखभाल सहायक हूँ। मैं आपके अधिकृत CareCircle रिकॉर्ड से साप्ताहिक दवा पालन का सारांश, आज की दवा सूची और आगामी डॉक्टर अपॉइंटमेंट की जानकारी आसान शब्दों में दे सकता हूँ।',
    quickPrompts: [
      'इस सप्ताह दवा पालन का सारांश बताइए।',
      'आज कौन-कौन सी दवाइयाँ लेनी हैं?',
      'आज की कौन सी खुराक अभी बाकी है?',
      'अगला डॉक्टर अपॉइंटमेंट कब है?',
      'परिवार या देखभालकर्ता को CareCircle में कैसे जोड़ें?',
    ],
    youLabel: 'आप',
    assistantLabel: 'CareCircle सहायक',
    loadingLabel: 'अधिकृत CareCircle रिकॉर्ड देख रहे हैं...',
    listenLabel: 'सुनें',
    stopLabel: 'रोकें',
    clearChatLabel: 'चैट साफ़ करें',
    retryLabel: 'पुनः प्रयास करें',
    sendLabel: 'भेजें',
    placeholder: 'आज की दवाइयों, साप्ताहिक पालन या अपॉइंटमेंट के बारे में पूछें...',
    listeningPlaceholder: 'सुन रहे हैं... कृपया अपना प्रश्न बोलें',
    voiceUnsupported: 'इस ब्राउज़र में वॉइस इनपुट उपलब्ध नहीं है।',
    emptyReplyFallback: 'अभी यह अनुरोध पूरा नहीं हो सका।',
  },
  bn: {
    title: 'এআই যত্ন সহায়ক',
    subtitlePrefix: 'আপনার অনুমোদিত CareCircle তথ্যের ওপর ভিত্তি করে',
    subtitleSuffix: '-এর ওষুধের সময়সূচি, অ্যাপয়েন্টমেন্ট ও সাপ্তাহিক সারাংশ সম্পর্কে জিজ্ঞাসা করুন।',
    safetyTitle: 'নিরাপত্তা ও গোপনীয়তার সীমা:',
    safetyBody:
      'শুধুমাত্র এই CareCircle-এর অনুমোদিত তথ্য ব্যবহার করে। এটি কখনো রোগ নির্ণয় করে না, ওষুধ প্রেসক্রাইব করে না, বা ডোজ পরিবর্তনের পরামর্শ দেয় না। চিকিৎসা সংক্রান্ত সিদ্ধান্তের জন্য সর্বদা চিকিৎসকের পরামর্শ নিন।',
    todayLabel: 'আজকের ডোজ',
    pendingLabel: 'বাকি',
    adherenceLabel: '৭-দিনের হার',
    appointmentsLabel: 'আসন্ন ভিজিট',
    privacyNote: 'শুধুমাত্র সক্রিয় CareCircle-এ সীমাবদ্ধ',
    welcome:
      'নমস্কার! আমি CareCircle এআই যত্ন সহায়ক। আপনার অনুমোদিত CareCircle তথ্য থেকে আমি সাপ্তাহিক ওষুধ খাওয়ার সারাংশ, আজকের ওষুধের তালিকা এবং আসন্ন ডাক্তারের অ্যাপয়েন্টমেন্ট সহজ বাংলায় জানাতে পারি।',
    quickPrompts: [
      'এই সপ্তাহে ওষুধ খাওয়ার হারের সারাংশ দিন।',
      'আজ কোন কোন ওষুধের সময় নির্ধারিত আছে?',
      'আজকের কোন ডোজগুলো এখনো বাকি আছে?',
      'পরবর্তী ডাক্তারের অ্যাপয়েন্টমেন্ট কবে?',
      'পরিবারের সদস্য বা কেয়ারগিভারকে কীভাবে আমন্ত্রণ জানাব?',
    ],
    youLabel: 'আপনি',
    assistantLabel: 'CareCircle সহায়ক',
    loadingLabel: 'অনুমোদিত CareCircle তথ্য দেখা হচ্ছে...',
    listenLabel: 'শুনুন',
    stopLabel: 'থামান',
    clearChatLabel: 'চ্যাট মুছুন',
    retryLabel: 'আবার চেষ্টা করুন',
    sendLabel: 'পাঠান',
    placeholder: 'আজকের ওষুধ, সাপ্তাহিক সারাংশ বা অ্যাপয়েন্টমেন্ট সম্পর্কে লিখুন...',
    listeningPlaceholder: 'শোনা হচ্ছে... আপনার প্রশ্নটি বলুন',
    voiceUnsupported: 'এই ব্রাউজারে ভয়েস ইনপুট সমর্থিত নয়।',
    emptyReplyFallback: 'এই মুহূর্তে অনুরোধটি সম্পন্ন করা যায়নি।',
  },
};

const LANGUAGE_OPTIONS: Array<{ id: AppLanguage; label: string }> = [
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'हिन्दी' },
  { id: 'bn', label: 'বাংলা' },
];

export const AssistantPage: React.FC = () => {
  const {
    mode,
    firebaseUser,
    userAccount,
    activeCircle,
    medications,
    medicationLogs,
    appointments,
    careTasks,
    permissions,
    language,
    updatePreferences,
    notifyToast,
  } = useCareCircle();

  const copy = ASSISTANT_I18N[language];

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      content: ASSISTANT_I18N[language].welcome,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const recognitionRef = useRef<unknown>(null);
  const abortRef = useRef<AbortController | null>(null);
  const threadContainerRef = useRef<HTMLDivElement | null>(null);

  const speechSupported = useMemo(() => isSpeechRecognitionSupported(), []);

  // Live grounded metrics displayed above the chat
  const groundedMetrics = useMemo(() => {
    const todayKey = getTodayDateKey();
    const todaySlots = computeScheduleForDate(medications, medicationLogs, todayKey);
    const takenToday = todaySlots.filter((s) => s.status === 'taken').length;
    const pendingToday = todaySlots.filter((s) => s.status === 'pending').length;
    const missedToday = todaySlots.filter((s) => s.status === 'missed').length;
    const weekly = computeWeeklyAdherence(medications, medicationLogs);
    const upcomingAppts = appointments.filter((a) => a.status === 'upcoming').length;
    return {
      takenToday,
      totalToday: todaySlots.length,
      pendingToday,
      missedToday,
      ratePercent: weekly.ratePercent,
      upcomingAppts,
    };
  }, [medications, medicationLogs, appointments]);

  // Keep pristine welcome greeting synced when switching language before asking questions
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === 'welcome') {
        return [{ ...prev[0], content: ASSISTANT_I18N[language].welcome }];
      }
      return prev;
    });
  }, [language]);

  // Auto-scroll chat thread while streaming or adding turns
  useEffect(() => {
    const el = threadContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, loading]);

  // Reset chat thread cleanly if user switches to a different CareCircle / demo profile
  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    stopSpeaking();
    setSpeakingId(null);
    setLoading(false);
    setInput('');
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: ASSISTANT_I18N[language].welcome,
        timestamp: new Date().toISOString(),
      },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCircle?.id]);

  // Cleanup active stream / speech on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      stopSpeaking();
    };
  }, []);

  const handleLanguageChange = (nextLang: AppLanguage) => {
    if (nextLang === language) return;
    stopSpeaking();
    setSpeakingId(null);
    void updatePreferences({ language: nextLang });
  };

  const handleClearChat = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    stopSpeaking();
    setSpeakingId(null);
    setLoading(false);
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: copy.welcome,
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const sendMessage = async (textToSend: string, retryMessageId?: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || loading) return;

    const nowIso = new Date().toISOString();
    const botMsgId = `a_${Date.now()}`;

    const historySnapshot = messages
      .filter((m) => !m.error && !m.streaming && m.id !== retryMessageId)
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content }));

    if (retryMessageId) {
      setMessages((prev) =>
        prev
          .filter((m) => m.id !== retryMessageId)
          .concat({
            id: botMsgId,
            role: 'assistant',
            content: '',
            timestamp: nowIso,
            streaming: true,
          })
      );
    } else {
      const userMsg: ChatMessage = {
        id: `u_${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: nowIso,
      };
      const placeholderBot: ChatMessage = {
        id: botMsgId,
        role: 'assistant',
        content: '',
        timestamp: nowIso,
        streaming: true,
      };
      setMessages((prev) => [...prev, userMsg, placeholderBot]);
      setInput('');
    }

    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const todayKey = getTodayDateKey();
      const nowMinutes = getCurrentMinutesOfDay();

      // Demo mode uses local sandbox seed; live Firebase mode grounds strictly from server Firestore
      const demoSnapshot =
        mode === 'demo'
          ? {
              userRole: permissions.role,
              userName: userAccount?.displayName || 'CareCircle User',
              elderlyName: activeCircle?.elderlyName || 'Patient',
              elderlyAge: activeCircle?.elderlyAge,
              allergies: activeCircle?.allergies || 'None recorded',
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
              todaySchedule: computeScheduleForDate(medications, medicationLogs, todayKey, nowMinutes).map(
                (s) => ({
                  medicationName: s.medication.name,
                  dosage: s.medication.dosage,
                  scheduledTime: s.scheduledTime,
                  status: s.status,
                  recordedByName: s.log?.recordedByName,
                })
              ),
              weeklyAdherence: computeWeeklyAdherence(medications, medicationLogs, nowMinutes),
              upcomingAppointments: appointments
                .filter((a) => a.status === 'upcoming')
                .map((a) => ({
                  doctorName: a.doctorName,
                  specialization: a.specialization,
                  clinicName: a.clinicName,
                  dateTime: a.dateTime,
                  notes: a.notes,
                })),
              recentCareNotes: careTasks.slice(0, 6).map((t) => ({
                title: t.title,
                category: t.category,
                completed: t.completed,
                createdByName: t.createdByName,
              })),
            }
          : undefined;

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (mode === 'firebase' && firebaseUser) {
        headers.Authorization = `Bearer ${await firebaseUser.getIdToken()}`;
      }

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          message: trimmed,
          history: historySnapshot,
          circleId: activeCircle?.id,
          language,
          dateKey: todayKey,
          nowMinutes,
          ...(demoSnapshot ? { contextSnapshot: demoSnapshot } : {}),
          demoMode: mode === 'demo',
          stream: true,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('text/event-stream') || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { reply?: string; error?: string };
        if (!res.ok) {
          throw new Error(data.error || copy.emptyReplyFallback);
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botMsgId
              ? { ...m, content: data.reply || copy.emptyReplyFallback, streaming: false }
              : m
          )
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assembled = '';
      let streamError: string | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split('\n\n');
        buffer = frames.pop() || '';

        for (const frame of frames) {
          const lines = frame.split('\n');
          let eventName = 'message';
          let dataRaw = '';
          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              dataRaw += line.slice(5).trim();
            }
          }
          if (!dataRaw) continue;
          const payload = JSON.parse(dataRaw) as { text?: string; reply?: string; error?: string };

          if (eventName === 'chunk' && payload.text) {
            assembled += payload.text;
            setMessages((prev) =>
              prev.map((m) => (m.id === botMsgId ? { ...m, content: assembled } : m))
            );
          } else if (eventName === 'done') {
            const finalText = payload.reply || assembled || copy.emptyReplyFallback;
            assembled = finalText;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === botMsgId ? { ...m, content: finalText, streaming: false } : m
              )
            );
          } else if (eventName === 'error') {
            streamError = payload.error || copy.emptyReplyFallback;
          }
        }
      }

      if (streamError) {
        throw new Error(streamError);
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMsgId
            ? { ...m, content: assembled || m.content || copy.emptyReplyFallback, streaming: false }
            : m
        )
      );
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') {
        setMessages((prev) => prev.filter((m) => m.id !== botMsgId));
        return;
      }
      const msg = err instanceof Error ? err.message : copy.emptyReplyFallback;
      notifyToast('error', msg);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMsgId
            ? {
                ...m,
                content: `${copy.emptyReplyFallback} ${msg}`,
                streaming: false,
                error: true,
                retryPrompt: trimmed,
              }
            : m
        )
      );
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  };

  const toggleVoiceInput = () => {
    if (!speechSupported) {
      notifyToast('info', copy.voiceUnsupported);
      return;
    }

    if (listening && recognitionRef.current) {
      (recognitionRef.current as { stop: () => void }).stop();
      setListening(false);
      return;
    }

    const SpeechRec =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

    if (!SpeechRec) return;

    const recognition = new (SpeechRec as new () => {
      lang: string;
      interimResults: boolean;
      maxAlternatives: number;
      onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
      onerror: () => void;
      onend: () => void;
      start: () => void;
      stop: () => void;
    })();

    recognition.lang = language === 'hi' ? 'hi-IN' : language === 'bn' ? 'bn-IN' : 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript || '';
      if (transcript) {
        setInput(transcript);
      }
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  const handleToggleSpeak = (msg: ChatMessage) => {
    if (speakingId === msg.id) {
      stopSpeaking();
      setSpeakingId(null);
    } else {
      const started = speakText(msg.content, language);
      if (started) setSpeakingId(msg.id);
      else notifyToast('info', 'Text-to-speech is unavailable in this browser.');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header + Inline Language & Reset Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
            {copy.title}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {copy.subtitlePrefix} {activeCircle?.elderlyName || 'Patient'} {copy.subtitleSuffix}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Assistant language"
            className="hc-surface inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900"
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleLanguageChange(opt.id)}
                className={`whitespace-nowrap shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  language === opt.id
                    ? 'hc-primary-btn bg-sky-700 text-white shadow-sm'
                    : 'text-slate-700 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleClearChat}
            disabled={messages.length <= 1 && !loading}
            className="hc-surface inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            {copy.clearChatLabel}
          </button>
        </div>
      </div>

      {/* Grounded Authorized Context Strip */}
      <div className="hc-surface flex flex-wrap items-center justify-between gap-x-5 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>
            {copy.todayLabel}:{' '}
            <strong className="font-mono tabular-nums text-slate-900 dark:text-white">
              {groundedMetrics.takenToday}/{groundedMetrics.totalToday}
            </strong>{' '}
            {groundedMetrics.pendingToday > 0 && (
              <span className="text-slate-500 dark:text-slate-400">
                (<span className="font-mono tabular-nums">{groundedMetrics.pendingToday}</span>{' '}
                {copy.pendingLabel})
              </span>
            )}
          </span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
            ·
          </span>
          <span>
            {copy.adherenceLabel}:{' '}
            <strong className="font-mono tabular-nums text-slate-900 dark:text-white">
              {groundedMetrics.ratePercent}%
            </strong>
          </span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
            ·
          </span>
          <span>
            {copy.appointmentsLabel}:{' '}
            <strong className="font-mono tabular-nums text-slate-900 dark:text-white">
              {groundedMetrics.upcomingAppts}
            </strong>
          </span>
        </div>
        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
          {copy.privacyNote}
        </span>
      </div>

      {/* Medical Safety Guardrail Banner */}
      <div className="hc-surface flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
        <p>
          <strong>{copy.safetyTitle}</strong> {copy.safetyBody}
        </p>
      </div>

      {/* Quick Prompts */}
      <div className="flex flex-wrap gap-2">
        {copy.quickPrompts.map((q) => (
          <button
            key={q}
            type="button"
            disabled={loading}
            onClick={() => void sendMessage(q)}
            className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-left text-xs font-medium text-slate-700 hover:border-sky-500 hover:bg-sky-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Chat Thread */}
      <div className="hc-surface flex flex-col rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div
          ref={threadContainerRef}
          className="max-h-[460px] min-h-[300px] space-y-4 overflow-y-auto p-5"
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'hc-primary-btn bg-sky-700 text-white'
                    : msg.error
                    ? 'border border-rose-300 bg-rose-50/80 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
                    : 'border border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100'
                }`}
              >
                <div className="flex items-center justify-between gap-4 pb-1 text-xs opacity-80">
                  <span className="flex items-center gap-1.5 font-semibold">
                    {msg.role === 'assistant' && (
                      msg.error ? (
                        <AlertCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                      ) : (
                        <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                      )
                    )}
                    {msg.role === 'user' ? copy.youLabel : copy.assistantLabel}
                  </span>

                  {msg.role === 'assistant' && !msg.streaming && !msg.error && msg.content && (
                    <button
                      type="button"
                      onClick={() => handleToggleSpeak(msg)}
                      aria-label={speakingId === msg.id ? copy.stopLabel : copy.listenLabel}
                      className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 hover:underline"
                    >
                      {speakingId === msg.id ? (
                        <>
                          <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />
                          {copy.stopLabel}
                        </>
                      ) : (
                        <>
                          <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                          {copy.listenLabel}
                        </>
                      )}
                    </button>
                  )}
                </div>

                {msg.streaming && !msg.content ? (
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <Loader2 className="h-4 w-4 animate-spin text-sky-700 dark:text-sky-400" aria-hidden="true" />
                    <span>{copy.loadingLabel}</span>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">
                    {msg.content}
                    {msg.streaming && (
                      <span
                        aria-hidden="true"
                        className="ml-1 inline-block h-4 w-1.5 align-middle bg-sky-700 dark:bg-sky-400"
                      />
                    )}
                  </div>
                )}

                {msg.error && msg.retryPrompt && (
                  <div className="mt-3">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void sendMessage(msg.retryPrompt!, msg.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200 dark:hover:bg-rose-900"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      {copy.retryLabel}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage(input);
          }}
          className="flex items-center gap-2 border-t border-slate-200 p-4 dark:border-slate-800"
        >
          {speechSupported && (
            <button
              type="button"
              onClick={toggleVoiceInput}
              aria-label={listening ? 'Stop voice input' : 'Start voice input'}
              className={`rounded-xl border px-3.5 py-3 transition-colors ${
                listening
                  ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              {listening ? <MicOff className="h-5 w-5" aria-hidden="true" /> : <Mic className="h-5 w-5" aria-hidden="true" />}
            </button>
          )}

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={listening ? copy.listeningPlaceholder : copy.placeholder}
            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 focus:border-sky-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />

          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="hc-primary-btn inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">{copy.sendLabel}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
