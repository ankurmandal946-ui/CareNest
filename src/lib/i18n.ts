import type { AppLanguage } from '../types/carecircle';

export interface TranslationDictionary {
  brandName: string;
  tagline: string;
  nav: {
    dashboard: string;
    tracker: string;
    medications: string;
    appointments: string;
    members: string;
    assistant: string;
    analytics: string;
    notifications: string;
    settings: string;
    logout: string;
  };
  actions: {
    markTaken: string;
    skipDose: string;
    addMedicine: string;
    addAppointment: string;
    runReminderCheck: string;
    emergencyCall: string;
    highContrast: string;
    readAloud: string;
    speakQuestion: string;
    inviteMember: string;
    joinCircle: string;
  };
  status: {
    taken: string;
    pending: string;
    missed: string;
    skipped: string;
    upcoming: string;
  };
  greetings: {
    morning: string;
    afternoon: string;
    evening: string;
  };
  elderlyRoutine: {
    title: string;
    subtitle: string;
    nextDoseLabel: string;
    noPending: string;
    todayProgress: string;
  };
}

export const TRANSLATIONS: Record<AppLanguage, TranslationDictionary> = {
  en: {
    brandName: 'CareCircle',
    tagline: 'Together for Better Elderly Care',
    nav: {
      dashboard: 'Dashboard',
      tracker: 'Daily Tracker',
      medications: 'Medications',
      appointments: 'Appointments',
      members: 'CareCircle',
      assistant: 'AI Assistant',
      analytics: 'Reports',
      notifications: 'Notifications',
      settings: 'Settings',
      logout: 'Sign Out',
    },
    actions: {
      markTaken: 'Mark Taken',
      skipDose: 'Skip',
      addMedicine: 'Add Medicine',
      addAppointment: 'Add Appointment',
      runReminderCheck: 'Run Reminder Check',
      emergencyCall: 'Emergency Contact',
      highContrast: 'High Contrast',
      readAloud: 'Read Aloud',
      speakQuestion: 'Speak',
      inviteMember: 'Generate Invite Code',
      joinCircle: 'Join with Code',
    },
    status: {
      taken: 'Taken',
      pending: 'Pending',
      missed: 'Missed',
      skipped: 'Skipped',
      upcoming: 'Upcoming',
    },
    greetings: {
      morning: 'Good morning',
      afternoon: 'Good afternoon',
      evening: 'Good evening',
    },
    elderlyRoutine: {
      title: 'Today’s Care Routine',
      subtitle: 'Tap large buttons below to record your medicines clearly.',
      nextDoseLabel: 'Next Medicine Due',
      noPending: 'All scheduled medicines for now have been recorded.',
      todayProgress: 'Today’s Progress',
    },
  },
  hi: {
    brandName: 'CareCircle',
    tagline: 'बुजुर्गों की बेहतर देखभाल के लिए साथ',
    nav: {
      dashboard: 'डैशबोर्ड',
      tracker: 'दैनिक ट्रैकर',
      medications: 'दवाइयाँ',
      appointments: 'अपॉइंटमेंट',
      members: 'केयरसर्कल',
      assistant: 'एआई सहायक',
      analytics: 'रिपोर्ट',
      notifications: 'सूचनाएँ',
      settings: 'सेटिंग्स',
      logout: 'साइन आउट',
    },
    actions: {
      markTaken: 'ली गई लिखें',
      skipDose: 'छोड़ें',
      addMedicine: 'दवा जोड़ें',
      addAppointment: 'अपॉइंटमेंट जोड़ें',
      runReminderCheck: 'रिमाइंडर जाँचें',
      emergencyCall: 'आपातकालीन संपर्क',
      highContrast: 'हाई कॉन्ट्रास्ट',
      readAloud: 'सुनें',
      speakQuestion: 'बोलें',
      inviteMember: 'आमंत्रण कोड बनाएँ',
      joinCircle: 'कोड से जुड़ें',
    },
    status: {
      taken: 'ली गई',
      pending: 'बाकी',
      missed: 'छूट गई',
      skipped: 'स्किप की गई',
      upcoming: 'आगामी',
    },
    greetings: {
      morning: 'सुप्रभात',
      afternoon: 'नमस्कार',
      evening: 'शुभ संध्या',
    },
    elderlyRoutine: {
      title: 'आज की देखभाल दिनचर्या',
      subtitle: 'अपनी दवाइयों को दर्ज करने के लिए नीचे बड़े बटन दबाएँ।',
      nextDoseLabel: 'अगली दवा का समय',
      noPending: 'अभी तक की सभी निर्धारित दवाइयाँ दर्ज हो चुकी हैं।',
      todayProgress: 'आज की प्रगति',
    },
  },
  bn: {
    brandName: 'CareCircle',
    tagline: 'বয়স্কদের উন্নত যত্নে একসাথে',
    nav: {
      dashboard: 'ড্যাশবোর্ড',
      tracker: 'দৈনিক ট্র্যাকার',
      medications: 'ওষুধপত্র',
      appointments: 'অ্যাপয়েন্টমেন্ট',
      members: 'কেয়ারসার্কেল',
      assistant: 'এআই সহায়ক',
      analytics: 'রিপোর্ট',
      notifications: 'বিজ্ঞপ্তি',
      settings: 'সেটিংস',
      logout: 'সাইন আউট',
    },
    actions: {
      markTaken: 'খাওয়া হয়েছে',
      skipDose: 'বাদ দিন',
      addMedicine: 'ওষুধ যোগ করুন',
      addAppointment: 'অ্যাপয়েন্টমেন্ট যোগ',
      runReminderCheck: 'রিমাইন্ডার পরীক্ষা',
      emergencyCall: 'জরুরি যোগাযোগ',
      highContrast: 'হাই কনট্রাস্ট',
      readAloud: 'শুনুন',
      speakQuestion: 'বলুন',
      inviteMember: 'আমন্ত্রণ কোড তৈরি',
      joinCircle: 'কোড দিয়ে যোগ দিন',
    },
    status: {
      taken: 'খাওয়া হয়েছে',
      pending: 'বাকি আছে',
      missed: 'বাদ পড়েছে',
      skipped: 'এড়ানো হয়েছে',
      upcoming: 'আসন্ন',
    },
    greetings: {
      morning: 'সুপ্রভাত',
      afternoon: 'শুভ অপরাহ্ন',
      evening: 'শুভ সন্ধ্যা',
    },
    elderlyRoutine: {
      title: 'আজকের যত্নের রুটিন',
      subtitle: 'আপনার ওষুধ নথিভুক্ত করতে নিচের বড় বোতামগুলি চাপুন।',
      nextDoseLabel: 'পরবর্তী ওষুধের সময়',
      noPending: 'এখন পর্যন্ত নির্ধারিত সব ওষুধ নথিভুক্ত হয়েছে।',
      todayProgress: 'আজকের অগ্রগতি',
    },
  },
};

export function getGreeting(lang: AppLanguage): string {
  const hour = new Date().getHours();
  const dict = TRANSLATIONS[lang];
  if (hour < 12) return dict.greetings.morning;
  if (hour < 17) return dict.greetings.afternoon;
  return dict.greetings.evening;
}
