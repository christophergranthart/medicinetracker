import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxWidth?: string;
}

export function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-2xl' }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm dark:bg-black/60" onClick={onClose} />
      <div
        className={`relative rounded-t-3xl sm:rounded-2xl w-full ${maxWidth} max-h-[92vh] overflow-y-auto scrollbar-hide animate-slide-up shadow-2xl`}
        style={{ background: 'var(--bg-card)' }}
      >
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-default)' }} />
        </div>
        {title && (
          <div
            className="sticky top-0 backdrop-blur-sm border-b px-5 py-4 flex items-center justify-between z-10 rounded-t-3xl sm:rounded-t-2xl"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
          >
            <h2 className="font-bold text-app-primary" style={{ fontSize: 'var(--font-heading)' }}>{title}</h2>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-app-card-hover transition-colors"
            >
              <X className="w-5 h-5 text-app-muted" />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
