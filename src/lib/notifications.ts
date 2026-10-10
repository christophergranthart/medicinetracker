export type SoundToneId = 'gentle_chime' | 'digital_alarm' | 'bell_notification' | 'crisp_beep';

export interface SoundTone {
  id: SoundToneId;
  label: string;
  description: string;
}

export const SOUND_TONES: SoundTone[] = [
  { id: 'gentle_chime', label: 'Gentle Chime', description: 'Soft, melodic bell' },
  { id: 'digital_alarm', label: 'Digital Alarm', description: 'Classic alarm beep' },
  { id: 'bell_notification', label: 'Bell Notification', description: 'Pleasant bell ring' },
  { id: 'crisp_beep', label: 'Crisp Beep', description: 'Short, clear beep' },
];

const STORAGE_KEY = 'medtracker-notif-settings';

export interface NotifSettings {
  enabled: boolean;
  pushEnabled: boolean;
  tone: SoundToneId;
  volume: number;
}

const DEFAULT_SETTINGS: NotifSettings = {
  enabled: true,
  pushEnabled: false,
  tone: 'gentle_chime',
  volume: 0.6,
};

export function getNotifSettings(): NotifSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveNotifSettings(settings: NotifSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

let audioCtx: AudioContext | null = null;
let unlocked = false;

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
    null
  );
}

function getAudioContext(): AudioContext | null {
  const Ctx = getAudioContextConstructor();
  if (!Ctx) return null;
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  return audioCtx;
}

// Resume AudioContext synchronously — must be called inside a user-gesture handler.
async function resumeAudioContext(): Promise<AudioContext | null> {
  const ctx = getAudioContext();
  if (!ctx) return null;
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      // ignore
    }
  }
  return ctx;
}

// Global unlock: on the very first user interaction, warm up the AudioContext so
// subsequent playback (including notification sounds) is allowed on Android Chrome.
function installAudioUnlockListener() {
  if (typeof window === 'undefined' || unlocked) return;

  const unlock = async () => {
    if (unlocked) return;
    unlocked = true;
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      try { await ctx.resume(); } catch { /* ignore */ }
    }
    window.removeEventListener('touchstart', unlock, true);
    window.removeEventListener('touchend', unlock, true);
    window.removeEventListener('click', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };

  window.addEventListener('touchstart', unlock, { capture: true, passive: true });
  window.addEventListener('touchend', unlock, { capture: true, passive: true });
  window.addEventListener('click', unlock, { capture: true, passive: true });
  window.addEventListener('keydown', unlock, { capture: true, passive: true });
}

installAudioUnlockListener();

const TONE_CONFIGS: Record<SoundToneId, { freqs: number[]; duration: number; gap: number; type: OscillatorType }> = {
  gentle_chime:     { freqs: [880, 1108.73, 1318.51], duration: 0.4,  gap: 0.12, type: 'sine'     },
  digital_alarm:    { freqs: [1000, 1000, 1000],       duration: 0.15, gap: 0.08, type: 'square'   },
  bell_notification:{ freqs: [659.25, 987.77],         duration: 0.5,  gap: 0.15, type: 'triangle' },
  crisp_beep:       { freqs: [1200],                   duration: 0.12, gap: 0,    type: 'sine'     },
};

function scheduleTone(ctx: AudioContext, tone: SoundToneId, volume: number) {
  const cfg = TONE_CONFIGS[tone];
  const vol = Math.max(0, Math.min(1, volume));
  const now = ctx.currentTime;
  let offset = 0;

  for (const freq of cfg.freqs) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = cfg.type;
    osc.frequency.value = freq;

    const start = now + offset;
    const end = start + cfg.duration;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(vol, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, end);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(end);

    offset += cfg.duration + cfg.gap;
  }
}

// Call this directly inside a click handler to guarantee Android Chrome allows audio.
export async function playTone(tone: SoundToneId, volume: number = 0.6): Promise<void> {
  const ctx = await resumeAudioContext();
  if (!ctx) return;
  scheduleTone(ctx, tone, volume);
}

export async function playSelectedTone(): Promise<void> {
  const settings = getNotifSettings();
  if (!settings.enabled) return;
  await playTone(settings.tone, settings.volume);
}

export async function requestPushPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export function getPushPermissionStatus(): NotificationPermission | 'unsupported' {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

export function sendLocalNotification(title: string, body: string): void {
  const settings = getNotifSettings();
  if (!settings.pushEnabled) return;
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: '/icon-192.png', badge: '/icon-192.png' });
  } catch {
    // ignore
  }
}
