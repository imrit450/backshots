import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { X } from 'lucide-react';

type ToastType = 'info' | 'success' | 'warning' | 'error' | 'photo';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  onClick?: () => void;
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => void;
}

const ToastContext = createContext<ToastContextType>({ addToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div
        className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
        style={{ maxWidth: '22rem', width: 'calc(100vw - 2rem)' }}
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const typeConfig: Record<
  ToastType,
  { icon: string; borderClass: string; textClass: string }
> = {
  success: {
    icon: 'check_circle',
    borderClass: 'border-l-2 border-primary',
    textClass: 'text-primary',
  },
  error: {
    icon: 'error',
    borderClass: 'border-l-2 border-error',
    textClass: 'text-error',
  },
  warning: {
    icon: 'warning',
    borderClass: 'border-l-2 border-secondary',
    textClass: 'text-secondary',
  },
  info: {
    icon: 'info',
    borderClass: '',
    textClass: 'text-on-surface',
  },
  photo: {
    icon: 'photo_camera',
    borderClass: 'border-l-2 border-primary',
    textClass: 'text-primary',
  },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const duration = toast.duration ?? 5000;
    const fadeTimer = setTimeout(() => setExiting(true), duration - 300);
    const removeTimer = setTimeout(onDismiss, duration);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [toast.duration, onDismiss]);

  const handleClick = () => {
    if (toast.onClick) {
      toast.onClick();
      onDismiss();
    }
  };

  const { icon, borderClass, textClass } = typeConfig[toast.type] ?? typeConfig.info;

  return (
    <div
      className={[
        'pointer-events-auto',
        'bg-surface-container-high/90 backdrop-blur-xl',
        'rounded-xl',
        'shadow-2xl shadow-black/40',
        'px-4 py-3',
        'flex items-start gap-3',
        'transition-all duration-300',
        borderClass,
        exiting
          ? 'opacity-0 translate-x-4'
          : 'opacity-100 translate-x-0 animate-slide-in',
        toast.onClick ? 'cursor-pointer' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={handleClick}
    >
      {/* Icon */}
      <span
        className={`material-symbols-outlined text-[20px] flex-shrink-0 mt-0.5 ${textClass}`}
        style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 20" }}
      >
        {icon}
      </span>

      {/* Message */}
      <p className="text-sm text-on-surface flex-1 leading-snug">{toast.message}</p>

      {/* Dismiss */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        className="flex-shrink-0 p-1 -mr-1 -mt-0.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-bright transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
