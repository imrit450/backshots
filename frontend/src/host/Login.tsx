import { SignIn } from '@clerk/react';
import { LogoWordmark } from '../components/Logo';

export default function Login() {
  return (
    <div className="min-h-screen flex bg-surface overflow-hidden">
      {/* ── Left panel (hidden on mobile) ── */}
      <div className="hidden md:flex flex-col justify-between w-1/2 bg-surface-container-lowest relative overflow-hidden p-12">
        {/* Ambient glow blobs */}
        <div className="absolute top-[-80px] left-[-80px] w-80 h-80 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-60px] right-[-60px] w-64 h-64 rounded-full bg-primary-dim/15 blur-3xl pointer-events-none" />

        {/* Brand mark */}
        <div className="relative z-10 flex items-center gap-2">
          <LogoWordmark iconSize={26} textSize="text-xl" />
        </div>

        {/* Hero copy */}
        <div className="relative z-10 flex flex-col gap-8">
          <div>
            <h1 className="font-headline font-extrabold text-5xl text-on-surface leading-[1.1] tracking-tight">
              WELCOME<br />BACK
            </h1>
            <p className="mt-4 text-on-surface-variant text-base leading-relaxed max-w-xs">
              Your guests' candid moments, curated and delivered. Manage events, review photos, and share memories — all in one place.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-col gap-3">
            <div className="inline-flex items-center gap-3 bg-surface-container-low border border-outline-variant/40 rounded-2xl px-5 py-3 w-fit glass-panel">
              <span className="material-symbols-outlined text-primary text-xl">camera_alt</span>
              <span className="text-on-surface text-sm font-medium font-body">Guest Camera Access</span>
            </div>
            <div className="inline-flex items-center gap-3 bg-surface-container-low border border-outline-variant/40 rounded-2xl px-5 py-3 w-fit glass-panel">
              <span className="material-symbols-outlined text-primary text-xl">photo_library</span>
              <span className="text-on-surface text-sm font-medium font-body">Live Gallery Review</span>
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
          {/* Logo (mobile only — desktop shows it in left panel) */}
          <div className="md:hidden flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-primary text-2xl">photo_camera</span>
            <span className="font-headline font-extrabold text-xl text-on-surface tracking-tight">Lumora</span>
          </div>

          {/* Clerk SignIn component */}
          <div className="w-full [&_.cl-rootBox]:w-full">
            <SignIn
              routing="hash"
              signUpUrl="/host/signup"
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
