import { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type FontSize = 'sm' | 'md' | 'lg' | 'xl';

interface ThemeContextValue {
  theme: ThemeMode;
  fontSize: FontSize;
  isDark: boolean;
  setTheme: (theme: ThemeMode) => void;
  setFontSize: (size: FontSize) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'medtracker-theme-settings';

interface StoredSettings {
  theme: ThemeMode;
  fontSize: FontSize;
}

const DEFAULTS: StoredSettings = { theme: 'light', fontSize: 'md' };

function getStoredSettings(): StoredSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

function getSystemDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<StoredSettings>(getStoredSettings);
  const [systemDark, setSystemDark] = useState(getSystemDark);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const isDark = settings.theme === 'dark' || (settings.theme === 'system' && systemDark);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('font-sm', 'font-md', 'font-lg', 'font-xl');
    root.classList.add(`font-${settings.fontSize}`);
  }, [settings.fontSize]);

  const setTheme = useCallback((theme: ThemeMode) => {
    setSettings((prev) => {
      const next = { ...prev, theme };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const setFontSize = useCallback((fontSize: FontSize) => {
    setSettings((prev) => {
      const next = { ...prev, fontSize };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: settings.theme, fontSize: settings.fontSize, isDark, setTheme, setFontSize }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
