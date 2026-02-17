import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { X, Camera, CheckCircle, AlertTriangle, Info } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'photo';
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
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none max-w-sm w-full">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

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

  const iconMap = {
    info: <Info className="w-5 h-5 text-blue-400" />,
    success: <CheckCircle className="w-5 h-5 text-green-400" />,
    warning: <AlertTriangle className="w-5 h-5 text-yellow-400" />,
    photo: <Camera className="w-5 h-5 text-pine-700" />,
  };

  const bgMap = {
    info: 'border-blue-500/20',
    success: 'border-green-500/20',
    warning: 'border-yellow-500/20',
    photo: 'border-pine-700/30',
  };

  return (
    <div
      className={`pointer-events-auto bg-white shadow-xl rounded-xl border ${bgMap[toast.type]} 
      px-4 py-3 flex items-center gap-3 transition-all duration-300 
      ${exiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0 animate-slide-in'}
      ${toast.onClick ? 'cursor-pointer hover:bg-gray-50' : ''}`}
      onClick={handleClick}
    >
      <div className="flex-shrink-0">{iconMap[toast.type]}</div>
      <p className="text-sm text-gray-700 flex-1">{toast.message}</p>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        className="flex-shrink-0 p-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-400"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
