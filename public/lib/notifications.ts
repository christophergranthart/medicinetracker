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

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playTone(tone: SoundToneId, volume: number = 0.6): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const vol = Math.max(0, Math.min(1, volume));

  const tones: Record<SoundToneId, { freqs: number[]; duration: number; gap: number; type: OscillatorType }> = {
    gentle_chime: { freqs: [880, 1108.73, 1318.51], duration: 0.4, gap: 0.12, type: 'sine' },
    digital_alarm: { freqs: [1000, 1000, 1000], duration: 0.15, gap: 0.08, type: 'square' },
    bell_notification: { freqs: [659.25, 987.77], duration: 0.5, gap: 0.15, type: 'triangle' },
    crisp_beep: { freqs: [1200], duration: 0.12, gap: 0, type: 'sine' },
  };

  const cfg = tones[tone];
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

export function playSelectedTone(): void {
  const settings = getNotifSettings();
  if (!settings.enabled) return;
  playTone(settings.tone, settings.volume);
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
