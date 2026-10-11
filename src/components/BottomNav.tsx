import { Chrome as Home, Clock, Pill, Settings } from 'lucide-react';

export type NavView = 'home' | 'history' | 'medicines' | 'settings';

interface BottomNavProps {
  activeView: NavView;
  onNavigate: (view: NavView) => void;
}

const TABS: { view: NavView; label: string; icon: typeof Home }[] = [
  { view: 'home', label: 'Today', icon: Home },
  { view: 'history', label: 'History', icon: Clock },
  { view: 'medicines', label: 'Medicines', icon: Pill },
  { view: 'settings', label: 'Settings', icon: Settings },
];

export function BottomNav({ activeView, onNavigate }: BottomNavProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      <div
        className="backdrop-blur-lg border-t px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)]"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="max-w-2xl mx-auto flex items-center justify-around h-14">
          {TABS.map(({ view, label, icon: Icon }) => {
            const active = activeView === view;
            return (
              <button
                key={view}
                onClick={() => onNavigate(view)}
                className="flex flex-col items-center gap-0.5 px-3 py-1.5 transition-all min-w-[64px]"
              >
                <Icon
                  className={`w-5 h-5 transition-all ${active ? 'text-med-600 dark:text-med-400' : 'text-app-faint'}`}
                  strokeWidth={active ? 2.5 : 2}
                />
                <span
                  className={`font-semibold transition-colors ${active ? 'text-med-600 dark:text-med-400' : 'text-app-faint'}`}
                  style={{ fontSize: 'var(--font-tiny)' }}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
