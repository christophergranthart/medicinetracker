import { Sun, Moon, Monitor, Type, X } from 'lucide-react';
import { useTheme, type ThemeMode, type FontSize } from '@/context/ThemeContext';

interface AppearanceDrawerProps {
  open: boolean;
  onClose: () => void;
}

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

const FONT_OPTIONS: { value: FontSize; label: string }[] = [
  { value: 'sm', label: 'S' },
  { value: 'md', label: 'M' },
  { value: 'lg', label: 'L' },
  { value: 'xl', label: 'XL' },
];

export function AppearanceDrawer({ open, onClose }: AppearanceDrawerProps) {
  const { theme, fontSize, setTheme, setFontSize } = useTheme();

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
        <div
          className="max-w-2xl mx-auto rounded-t-3xl border-t p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-default)',
          }}
        >
          {/* Drag handle */}
          <div className="w-10 h-1 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto mb-4" />

          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-med-50 to-teal-50 dark:from-med-900/40 dark:to-teal-900/40 flex items-center justify-center">
                <Type className="w-4 h-4 text-med-600 dark:text-med-400" />
              </div>
              <h2 className="font-bold text-app-primary" style={{ fontSize: 'var(--font-heading)' }}>
                Display &amp; Accessibility
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5 text-app-muted" />
            </button>
          </div>

          {/* Appearance / Theme Section */}
          <div className="mb-5">
            <p className="text-app-muted font-semibold mb-2" style={{ fontSize: 'var(--font-small)' }}>
              Appearance
            </p>
            <div className="grid grid-cols-3 gap-2">
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
                const active = theme === value;
                return (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all active:scale-95 ${
                      active
                        ? 'border-med-500 bg-med-50 dark:bg-med-900/30'
                        : 'border-app-default bg-app-card hover:border-med-300'
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 ${active ? 'text-med-600 dark:text-med-400' : 'text-app-muted'}`}
                      strokeWidth={active ? 2.5 : 2}
                    />
                    <span
                      className={`font-semibold ${active ? 'text-med-600 dark:text-med-400' : 'text-app-primary'}`}
                      style={{ fontSize: 'var(--font-small)' }}
                    >
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Text Size Section */}
          <div className="mb-2">
            <p className="text-app-muted font-semibold mb-2" style={{ fontSize: 'var(--font-small)' }}>
              Text Size
            </p>
            <div className="grid grid-cols-4 gap-2">
              {FONT_OPTIONS.map(({ value, label }) => {
                const active = fontSize === value;
                const previewSize = value === 'sm' ? '14px' : value === 'md' ? '16px' : value === 'lg' ? '18px' : '20px';
                return (
                  <button
                    key={value}
                    onClick={() => setFontSize(value)}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 transition-all active:scale-95 ${
                      active
                        ? 'border-med-500 bg-med-50 dark:bg-med-900/30'
                        : 'border-app-default bg-app-card hover:border-med-300'
                    }`}
                  >
                    <span
                      className={`font-bold ${active ? 'text-med-600 dark:text-med-400' : 'text-app-primary'}`}
                      style={{ fontSize: previewSize }}
                    >
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preview Text */}
          <div
            className="rounded-xl p-4 border"
            style={{
              background: 'var(--bg-card-hover)',
              borderColor: 'var(--border-default)',
            }}
          >
            <p className="text-app-faint font-semibold mb-1" style={{ fontSize: 'var(--font-tiny)' }}>
              PREVIEW
            </p>
            <p className="text-app-primary font-medium" style={{ fontSize: 'var(--font-base)' }}>
              Sample Dose: 1 drop at 08:00 AM
            </p>
            <p className="text-app-muted mt-1" style={{ fontSize: 'var(--font-small)' }}>
              Dexamethasone · Step 1 · Take with food
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
