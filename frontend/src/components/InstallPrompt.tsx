import { useState, useEffect } from 'react';
import { Share, Plus, X, Download } from 'lucide-react';

const DISMISSED_KEY = 'pwa_install_dismissed';

// True when running as an installed PWA (standalone / fullscreen)
function isInstalled() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isAndroid = /Android/i.test(navigator.userAgent);

export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  // Android: holds the deferred beforeinstallprompt event
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    if (isInstalled()) return;
    if (sessionStorage.getItem(DISMISSED_KEY)) return;
    if (!isIOS && !isAndroid) return; // desktop — skip

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // iOS never fires beforeinstallprompt — show our manual instructions instead
    if (isIOS) {
      // Small delay so it doesn't pop up the moment the page loads
      const t = setTimeout(() => setShow(true), 3000);
      return () => {
        clearTimeout(t);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      };
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, '1');
    setShow(false);
  };

  const install = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setShow(false);
      setDeferredPrompt(null);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-surface-2 border border-white/10 rounded-2xl p-4 shadow-2xl">
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 text-white/40 hover:text-white/70 p-1"
        >
          <X size={16} />
        </button>

        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
            <img src="/favicon.svg" alt="Lumora" className="w-6 h-6" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm">Add Lumora to your home screen</p>

            {isIOS ? (
              <p className="text-white/50 text-xs mt-1 leading-relaxed">
                Tap <Share size={11} className="inline -mt-0.5" /> in Safari, then{' '}
                <span className="inline-flex items-center gap-0.5 text-white/70">
                  <Plus size={11} />
                  <span>Add to Home Screen</span>
                </span>
              </p>
            ) : (
              <p className="text-white/50 text-xs mt-1">
                Get the full-screen experience with one tap.
              </p>
            )}

            {!isIOS && (
              <button
                onClick={install}
                className="mt-3 flex items-center gap-1.5 bg-primary text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors"
              >
                <Download size={13} />
                Install app
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
