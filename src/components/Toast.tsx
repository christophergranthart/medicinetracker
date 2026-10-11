import { CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, Info, X } from 'lucide-react';
import { useEffect, useState } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface ToastState {
  id: number;
  message: string;
  type: ToastType;
}

let toastCounter = 0;
const listeners: ((toast: ToastState) => void)[] = [];

export function showToast(message: string, type: ToastType = 'success') {
  const toast = { id: ++toastCounter, message, type };
  listeners.forEach((l) => l(toast));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastState[]>([]);

  useEffect(() => {
    const listener = (toast: ToastState) => {
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 3500);
    };
    listeners.push(listener);
    return () => {
      const idx = listeners.indexOf(listener);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }, []);

  return (
    <div className="fixed top-18 left-0 right-0 z-[60] flex flex-col items-center gap-2 px-4 pt-2 pointer-events-none" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 4.5rem)' }}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg animate-slide-down max-w-sm w-full border"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
        >
          {toast.type === 'success' && <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center flex-shrink-0"><CheckCircle2 className="w-5 h-5 text-emerald-500" /></div>}
          {toast.type === 'error' && <div className="w-8 h-8 bg-red-50 dark:bg-red-900/30 rounded-xl flex items-center justify-center flex-shrink-0"><AlertTriangle className="w-5 h-5 text-red-500" /></div>}
          {toast.type === 'info' && <div className="w-8 h-8 bg-med-50 dark:bg-med-900/30 rounded-xl flex items-center justify-center flex-shrink-0"><Info className="w-5 h-5 text-med-500" /></div>}
          <span className="text-app-primary font-medium flex-1" style={{ fontSize: 'var(--font-small)' }}>{toast.message}</span>
          <button
            onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            className="text-app-faint hover:text-app-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
