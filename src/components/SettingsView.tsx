import { useState, useEffect, useCallback } from 'react';
import {
  Settings as SettingsIcon,
  Bell,
  BellOff,
  Volume2,
  Play,
  HeartPulse,
  Info,
  Check,
  X,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import {
  SOUND_TONES,
  getNotifSettings,
  saveNotifSettings,
  playTone,
  requestPushPermission,
  getPushPermissionStatus,
  type NotifSettings,
  type SoundToneId,
} from '@/lib/notifications';

interface SettingsViewProps {
  onSignOut: () => void;
}

export function SettingsView({ onSignOut }: SettingsViewProps) {
  const [settings, setSettings] = useState<NotifSettings>(getNotifSettings());
  const [pushStatus, setPushStatus] = useState<NotificationPermission | 'unsupported'>(getPushPermissionStatus());
  const [requestingPush, setRequestingPush] = useState(false);
  const [previewingTone, setPreviewingTone] = useState<SoundToneId | null>(null);

  useEffect(() => {
    setSettings(getNotifSettings());
    setPushStatus(getPushPermissionStatus());
  }, []);

  const updateSettings = useCallback((updates: Partial<NotifSettings>) => {
    const next = { ...settings, ...updates };
    setSettings(next);
    saveNotifSettings(next);
  }, [settings]);

  const handleEnableNotifications = async () => {
    if (pushStatus === 'unsupported') return;
    setRequestingPush(true);
    const result = await requestPushPermission();
    setPushStatus(result);
    if (result === 'granted') {
      updateSettings({ pushEnabled: true });
    } else {
      updateSettings({ pushEnabled: false });
    }
    setRequestingPush(false);
  };

  const handlePreview = async (toneId: SoundToneId) => {
    setPreviewingTone(toneId);
    await playTone(toneId, settings.volume);
    setTimeout(() => setPreviewingTone(null), 600);
  };

  const pushGranted = pushStatus === 'granted';
  const pushDenied = pushStatus === 'denied';
  const pushUnsupported = pushStatus === 'unsupported';

  return (
    <div className="max-w-2xl mx-auto px-4 pt-5 pb-28 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-gradient-to-br from-med-50 to-teal-50 rounded-xl flex items-center justify-center">
          <SettingsIcon className="w-5 h-5 text-med-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Settings</h1>
          <p className="text-slate-500 text-xs">Configure reminders and app preferences</p>
        </div>
      </div>

      {/* Audio & Reminders Section */}
      <div className="card p-4 animate-slide-up">
        <div className="flex items-center gap-2 mb-4">
          <Volume2 className="w-4 h-4 text-med-600" />
          <h2 className="text-sm font-bold text-slate-700">Audio &amp; Reminders</h2>
        </div>

        {/* Sound enabled toggle */}
        <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
          <div>
            <p className="text-sm font-medium text-slate-700">Audio Reminders</p>
            <p className="text-xs text-slate-400 mt-0.5">Play a chime on dose check-in</p>
          </div>
          <ToggleSwitch
            checked={settings.enabled}
            onChange={() => updateSettings({ enabled: !settings.enabled })}
          />
        </div>

        {/* Tone selection */}
        <div className="py-3 border-b border-slate-100">
          <p className="text-sm font-medium text-slate-700 mb-2">Reminder Tone</p>
          <div className="space-y-2">
            {SOUND_TONES.map((tone) => (
              <div
                key={tone.id}
                className={`flex items-center justify-between rounded-xl px-3 py-2.5 border-2 transition-all cursor-pointer ${
                  settings.tone === tone.id
                    ? 'border-med-400 bg-med-50/40'
                    : 'border-slate-100 bg-white hover:border-slate-200'
                }`}
                onClick={() => updateSettings({ tone: tone.id as SoundToneId })}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    settings.tone === tone.id ? 'border-med-500 bg-med-500' : 'border-slate-300'
                  }`}>
                    {settings.tone === tone.id && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{tone.label}</p>
                    <p className="text-[11px] text-slate-400 truncate">{tone.description}</p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePreview(tone.id);
                  }}
                  className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 ${
                    previewingTone === tone.id
                      ? 'bg-med-200 text-med-800'
                      : 'text-med-600 bg-med-50 hover:bg-med-100'
                  }`}
                >
                  <Play className="w-3 h-3" />
                  {previewingTone === tone.id ? 'Playing…' : 'Preview'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Volume slider */}
        <div className="py-3 border-b border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700">Volume</p>
            <span className="text-xs text-slate-400 font-medium tabular-nums">{Math.round(settings.volume * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={settings.volume}
            onChange={(e) => updateSettings({ volume: parseFloat(e.target.value) })}
            className="w-full accent-med-600 h-1.5"
          />
        </div>

        {/* Lock Screen Alerts */}
        <div className="py-3">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-med-600" />
            <p className="text-sm font-medium text-slate-700">Lock Screen Alerts</p>
          </div>

          {/* Status indicator */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl mb-3 ${
            pushGranted
              ? 'bg-emerald-50 border border-emerald-100'
              : pushDenied
                ? 'bg-amber-50 border border-amber-100'
                : 'bg-slate-50 border border-slate-100'
          }`}>
            {pushGranted ? (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span className="text-xs font-semibold text-emerald-700">Notifications Allowed</span>
              </>
            ) : pushDenied ? (
              <>
                <ShieldAlert className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span className="text-xs font-semibold text-amber-700">Notifications Blocked</span>
              </>
            ) : pushUnsupported ? (
              <>
                <BellOff className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-xs font-semibold text-slate-500">Not supported on this device</span>
              </>
            ) : (
              <>
                <Bell className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-xs font-semibold text-slate-500">Notifications not yet enabled</span>
              </>
            )}
          </div>

          {/* Enable button */}
          {!pushUnsupported && !pushGranted && (
            <button
              onClick={handleEnableNotifications}
              disabled={requestingPush || pushDenied}
              className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${
                pushDenied
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-med-600 text-white hover:bg-med-700 active:scale-[0.98]'
              }`}
            >
              <Bell className="w-4 h-4" />
              {requestingPush ? 'Requesting…' : 'Enable Lock Screen Alerts'}
            </button>
          )}

          {pushDenied && (
            <p className="text-xs text-amber-600 mt-2 leading-relaxed">
              Notifications are blocked in your browser settings. Open your browser's site settings for this page and allow notifications, then reload.
            </p>
          )}

          {pushGranted && (
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-slate-500">Receive alerts while screen is locked</p>
              <ToggleSwitch
                checked={settings.pushEnabled}
                onChange={() => updateSettings({ pushEnabled: !settings.pushEnabled })}
              />
            </div>
          )}

          {!pushDenied && !pushGranted && !pushUnsupported && (
            <div className="flex items-start gap-2 mt-3 bg-med-50/40 rounded-xl p-3">
              <Info className="w-3.5 h-3.5 text-med-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-slate-600 leading-relaxed">
                Tap above to receive medication alerts even when your phone screen is locked.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Schedule Cutoff Section */}
      <div className="card p-4 animate-slide-up">
        <div className="flex items-center gap-2 mb-3">
          <SettingsIcon className="w-4 h-4 text-med-600" />
          <h2 className="text-sm font-bold text-slate-700">Schedule Cutoff</h2>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          The latest allowed time for each medication determines when doses stop being scheduled. Adjust this per medication in the Medicines tab.
        </p>
      </div>

      {/* Credits & About Section */}
      <div className="card p-4 animate-slide-up">
        <div className="flex items-center gap-2 mb-3">
          <HeartPulse className="w-4 h-4 text-med-600" />
          <h2 className="text-sm font-bold text-slate-700">Credits &amp; About</h2>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-xs text-slate-400 font-medium">Creator &amp; Developer</span>
            <span className="text-sm font-bold text-slate-700">Christopher Hart</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-xs text-slate-400 font-medium">App Name</span>
            <span className="text-sm font-semibold text-slate-700">MedTracker</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-xs text-slate-400 font-medium">Version</span>
            <span className="text-sm font-semibold text-slate-700">1.0.0</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-xs text-slate-400 font-medium">Audio Tones</span>
            <span className="text-sm font-semibold text-slate-700">Web Audio API</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed pt-2">
            MedTracker is a medication scheduling app designed to help manage complex dosing regimens with smart timing, sequencing rules, and audio reminders.
          </p>
        </div>
      </div>

      {/* Sign Out */}
      <button
        onClick={onSignOut}
        className="w-full bg-white border border-slate-200 rounded-xl py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
      >
        <X className="w-4 h-4 text-slate-400" />
        Sign Out
      </button>
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-all flex-shrink-0 ${
        checked ? 'bg-med-600' : 'bg-slate-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <div
        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${
          checked ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}