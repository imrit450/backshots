import { SignUp } from '@clerk/react';
import { LogoWordmark } from '../components/Logo';

export default function Signup() {
  return (
    <div className="min-h-screen flex bg-surface overflow-hidden">
      {/* ── Left panel (hidden on mobile) ── */}
      <div className="hidden md:flex flex-col justify-between w-1/2 bg-surface-container-lowest relative overflow-hidden p-12">
        {/* Ambient glow blobs */}
        <div className="absolute top-[-100px] right-[-60px] w-96 h-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-80px] left-[-40px] w-72 h-72 rounded-full bg-secondary/10 blur-3xl pointer-events-none" />

        {/* Brand mark */}
        <div className="relative z-10 flex items-center gap-2">
          <LogoWordmark iconSize={26} textSize="text-xl" />
        </div>

        {/* Hero copy */}
        <div className="relative z-10 flex flex-col gap-8">
          <div>
            <h1 className="font-headline font-extrabold text-5xl text-on-surface leading-[1.1] tracking-tight">
              YOUR EVENT,<br />THEIR LENS
            </h1>
            <p className="mt-4 text-on-surface-variant text-base leading-relaxed max-w-xs">
              Let your guests be the photographers. Collect candid, authentic moments from every angle — no app download required.
            </p>
          </div>

          {/* Glass feature card */}
          <div className="glass-panel border border-outline-variant/30 rounded-2xl p-6 max-w-xs">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-primary-dim flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-on-primary text-lg">auto_awesome</span>
              </div>
              <div>
                <p className="text-on-surface text-sm font-bold font-headline">Instant Photo Hub</p>
                <p className="text-on-surface-variant text-xs font-body">Photos appear live as guests snap them</p>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 h-16 rounded-xl bg-surface-container overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent" />
                <span className="material-symbols-outlined absolute bottom-2 right-2 text-primary/60 text-sm">
                  landscape
                </span>
              </div>
              <div className="flex-1 h-16 rounded-xl bg-surface-container overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-secondary/20 to-transparent" />
                <span className="material-symbols-outlined absolute bottom-2 right-2 text-secondary/60 text-sm">
                  group
                </span>
              </div>
              <div className="flex-1 h-16 rounded-xl bg-surface-container overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary-dim/20" />
                <span className="material-symbols-outlined absolute bottom-2 right-2 text-primary-dim/60 text-sm">
                  celebration
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom tagline */}
        <p className="relative z-10 text-on-surface-variant/50 text-xs font-body">
          © {new Date().getFullYear()} Lumora — Event photography, reimagined.
        </p>
      </div>

      {/* ── Right panel ── */}
      <div className="flex flex-1 flex-col items-center justify-center min-h-screen bg-surface p-6 md:p-12 relative overflow-y-auto">
        {/* Subtle glow behind form */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

        <div className="w-full max-w-md relative z-10 flex flex-col items-center">
          {/* Logo (mobile only) */}
          <div className="md:hidden flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-primary text-2xl">photo_camera</span>
            <span className="font-headline font-extrabold text-xl text-on-surface tracking-tight">Lumora</span>
          </div>

          {/* Clerk SignUp component */}
          <div className="w-full [&_.cl-rootBox]:w-full">
            <SignUp
              routing="hash"
              signInUrl="/host/login"
              fallbackRedirectUrl="/host"
              appearance={{
                variables: {
                  colorBackground: '#ffffff',
                  colorText: '#111111',
                  colorTextSecondary: '#555555',
                  colorInputBackground: '#ffffff',
                  colorInputText: '#111111',
                  colorPrimary: '#9146ff',
                  borderRadius: '0.75rem',
                },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
