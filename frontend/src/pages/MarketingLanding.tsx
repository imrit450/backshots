import { Link } from 'react-router-dom';
import { LogoWordmark } from '../components/Logo';

export default function MarketingLanding() {
  return (
    <div className="bg-surface text-on-surface font-body min-h-screen">
      {/* ── TopAppBar ── */}
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl"
        style={{ boxShadow: '0 0 20px rgba(193,156,255,0.12)' }}>
        <nav className="flex justify-between items-center px-6 py-4 max-w-7xl mx-auto">
          <LogoWordmark iconSize={26} textSize="text-2xl" />
          <div className="hidden md:flex items-center gap-8 font-label text-sm">
            <Link to="/how-it-works" className="text-on-surface-variant hover:text-on-surface transition-colors">How it Works</Link>
            <a href="#features" className="text-on-surface-variant hover:text-on-surface transition-colors">Features</a>
            <Link to="/host/pricing" className="text-on-surface-variant hover:text-on-surface transition-colors">Pricing</Link>
          </div>
          <Link
            to="/host/signup"
            className="bg-primary text-on-primary px-6 py-2 rounded-xl font-bold text-sm transition-all active:scale-95"
            style={{ boxShadow: '0 0 15px rgba(193,156,255,0.3)' }}
          >
            Get Started
          </Link>
        </nav>
      </header>

      <main className="pt-24">
        {/* ── Hero ── */}
        <section className="relative min-h-[780px] flex items-center justify-center overflow-hidden">
          {/* Ambient blobs */}
          <div className="absolute inset-0 z-0">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-30"
              style={{ background: '#9146ff', filter: 'blur(120px)' }} />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full opacity-20"
              style={{ background: '#ff7441', filter: 'blur(120px)' }} />
          </div>

          <div className="relative z-10 max-w-6xl mx-auto px-6 w-full">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
              {/* Text + CTAs */}
              <div className="flex-1 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 bg-surface-container-highest px-4 py-2 rounded-full mb-8 border border-outline-variant/20">
                  <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                    Live from the Kinetic Lens
                  </span>
                </div>

                <h1 className="font-headline font-black tracking-tighter mb-6 leading-[0.9]"
                  style={{ fontSize: 'clamp(2.8rem, 8vw, 6rem)' }}>
                  Your Event,{' '}
                  <span className="text-primary italic">Their Lens.</span>
                  <br />
                  <span className="text-on-surface">No App Required.</span>
                </h1>

                <p className="text-xl text-on-surface-variant max-w-2xl mb-10 font-light mx-auto lg:mx-0">
                  Transform guest photos into real-time cinematic memories. Instant capture through
                  the browser, powered by professional curation tools.
                </p>

                <div className="flex flex-col md:flex-row items-center justify-center lg:justify-start gap-4">
                  <Link
                    to="/host/signup"
                    className="w-full md:w-auto px-10 py-5 text-on-primary font-black text-lg rounded-xl transition-transform hover:scale-[1.02]"
                    style={{
                      background: 'linear-gradient(135deg, #c19cff, #9146ff)',
                      boxShadow: '0 8px 30px rgba(193,156,255,0.3)',
                    }}
                  >
                    Launch Your Event
                  </Link>
                  <Link
                    to="/host"
                    className="w-full md:w-auto px-10 py-5 bg-surface-container-high text-on-surface border border-outline-variant/30 font-bold text-lg rounded-xl hover:bg-surface-container-highest transition-colors"
                  >
                    Manage Existing Events
                  </Link>
                </div>
              </div>

              {/* Spark mascot — body rotates, eyes fixed + blink */}
              <div className="flex-shrink-0 flex items-center justify-center relative w-72 h-72">
                {/* Radial glow */}
                <div className="absolute inset-0 rounded-full opacity-50 pointer-events-none"
                  style={{ background: 'radial-gradient(circle, #FF819F 0%, #C19CFF 50%, transparent 75%)', filter: 'blur(48px)' }} />
                <svg width="280" height="280" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg"
                  className="relative drop-shadow-[0_0_60px_rgba(193,156,255,0.5)]">
                  <defs>
                    <linearGradient id="hero_spark" x1="0" y1="0" x2="200" y2="200" gradientUnits="userSpaceOnUse">
                      <stop offset="0%"   stopColor="#FFD700" />
                      <stop offset="50%"  stopColor="#FF819F" />
                      <stop offset="100%" stopColor="#C19CFF" />
                    </linearGradient>
                    <style>{`
                      @keyframes spark-spin {
                        from { transform: rotate(0deg); }
                        to   { transform: rotate(360deg); }
                      }
                      @keyframes spark-blink {
                        0%, 88%, 100% { transform: scaleY(1); }
                        93%           { transform: scaleY(0.07); }
                        96%           { transform: scaleY(1); }
                      }
                      .spark-body {
                        transform-origin: 100px 100px;
                        animation: spark-spin 12s linear infinite;
                      }
                      .spark-eye {
                        transform-box: fill-box;
                        transform-origin: center;
                        animation: spark-blink 3.8s ease-in-out infinite;
                      }
                      .spark-eye-r {
                        transform-box: fill-box;
                        transform-origin: center;
                        animation: spark-blink 3.8s ease-in-out infinite 0.06s;
                      }
                    `}</style>
                  </defs>
                  {/* Rotating star body only */}
                  <g className="spark-body">
                    <path d="M100 0L130 70L200 100L130 130L100 200L70 130L0 100L70 70L100 0Z"
                      fill="url(#hero_spark)" />
                  </g>
                  {/* Fixed face — dark iris + eyes */}
                  <circle cx="100" cy="100" r="30" fill="black" fillOpacity="0.75" />
                  <ellipse cx="90"  cy="100" rx="4" ry="4" fill="white" className="spark-eye" />
                  <ellipse cx="110" cy="100" rx="4" ry="4" fill="white" className="spark-eye-r" />
                </svg>
              </div>
            </div>
          </div>
        </section>

        {/* ── How it Works ── */}
        <section id="how" className="py-24 bg-surface-container-low">
          <div className="max-w-7xl mx-auto px-6">
            <div className="mb-16">
              <p className="text-secondary font-bold uppercase tracking-[0.3em] text-sm mb-3">The Workflow</p>
              <h3 className="font-headline font-black text-4xl md:text-5xl">Zero Friction, Max Impact.</h3>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  n: '01', icon: 'qr_code_scanner', title: 'Scan',
                  body: 'Guests scan a unique event QR code. No downloads, no sign-ups, no friction. Just open the camera and go.',
                },
                {
                  n: '02', icon: 'photo_camera', title: 'Shoot',
                  body: 'Guests capture the magic using our optimised web interface. Photos sync instantly to your private event cloud.',
                },
                {
                  n: '03', icon: 'auto_awesome', title: 'Share',
                  body: 'Display a live feed at the venue or export high-res gallery links to guests instantly after the event.',
                },
              ].map(({ n, icon, title, body }) => (
                <div key={n} className="relative bg-surface p-10 rounded-xl overflow-hidden border border-outline-variant/10">
                  <div className="absolute -top-4 -right-4 font-black leading-none select-none pointer-events-none"
                    style={{ fontSize: 120, color: 'rgba(145,70,255,0.07)' }}>
                    {n}
                  </div>
                  <div className="relative z-10">
                    <div className="w-16 h-16 bg-surface-container-highest rounded-2xl flex items-center justify-center mb-6">
                      <span className="material-symbols-outlined text-primary text-3xl">{icon}</span>
                    </div>
                    <h4 className="font-headline font-bold text-2xl mb-4 uppercase">{title}</h4>
                    <p className="text-on-surface-variant leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Bento Features ── */}
        <section id="features" className="py-24 px-6 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6" style={{ gridAutoRows: '300px' }}>

            {/* Big: Live Feeds */}
            <div className="md:col-span-8 md:row-span-2 rounded-[2rem] overflow-hidden relative group bg-surface-container-high">
              <div className="absolute inset-0"
                style={{ background: 'linear-gradient(135deg, rgba(145,70,255,0.15) 0%, rgba(255,116,65,0.08) 100%)' }} />
              <div className="absolute inset-0 flex items-center justify-center opacity-10">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 240 }}>play_circle</span>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 p-12">
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1 bg-secondary text-on-secondary rounded-full text-xs font-black uppercase tracking-wider">Real-time</span>
                  <span className="text-on-surface-variant font-bold text-sm">Visual Infrastructure</span>
                </div>
                <h4 className="font-headline font-black text-4xl md:text-5xl mb-4 uppercase">Cinematic Live Feeds</h4>
                <p className="text-on-surface-variant text-lg max-w-xl">
                  Project a curated stream of guest captures onto any screen in real-time. Turn your venue into a living, breathing gallery.
                </p>
              </div>
            </div>

            {/* Moderation */}
            <div className="md:col-span-4 bg-primary text-on-primary rounded-[2rem] p-10 flex flex-col justify-between">
              <div>
                <span className="material-symbols-outlined text-4xl mb-4 block"
                  style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
                <h4 className="font-headline font-bold text-2xl leading-tight uppercase">Elite Moderation</h4>
              </div>
              <p className="text-on-primary/80 font-medium">
                Full host control. Approve every photo before it hits the big screen with our rapid-fire dashboard.
              </p>
            </div>

            {/* Pro Exports */}
            <div className="md:col-span-4 bg-surface-container-highest rounded-[2rem] p-10 border border-outline-variant/20 flex flex-col justify-between">
              <div className="w-12 h-12 bg-surface rounded-full flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-secondary">hd</span>
              </div>
              <div>
                <h4 className="font-headline font-bold text-xl mb-2 uppercase">Pro Exports</h4>
                <p className="text-on-surface-variant text-sm">
                  Download original resolution files. No compression, just the raw aesthetic of the moment.
                </p>
              </div>
            </div>

            {/* Stat */}
            <div className="md:col-span-4 bg-surface-container rounded-[2rem] p-10 flex flex-col items-center justify-center text-center">
              <div className="font-headline font-black text-primary mb-2 tracking-tighter" style={{ fontSize: '4rem' }}>
                ∞
              </div>
              <div className="text-on-surface-variant font-bold uppercase tracking-widest text-xs">
                Memories Captured
              </div>
            </div>

            {/* Kinetic Engine */}
            <div className="md:col-span-8 bg-surface-container-low border border-primary/20 rounded-[2rem] flex items-center justify-between p-12 overflow-hidden relative">
              <div className="relative z-10">
                <h4 className="font-headline font-black text-3xl mb-2 uppercase italic">Kinetic Engine</h4>
                <p className="text-on-surface-variant max-w-md">
                  Our backend optimises every upload for maximum clarity and instant playback, regardless of signal strength.
                </p>
              </div>
              <div className="hidden md:block absolute right-0 top-0 h-full w-1/3 opacity-20 pointer-events-none">
                <div className="w-full h-full" style={{ background: 'linear-gradient(to left, #c19cff, transparent)' }} />
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section id="events" className="py-24 bg-surface relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(193,156,255,0.06) 0%, transparent 70%)' }} />
          <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
            <h2 className="font-headline font-black tracking-tighter mb-8 leading-none"
              style={{ fontSize: 'clamp(2.5rem, 7vw, 4.5rem)' }}>
              READY TO OWN THE MOMENT?
            </h2>
            <p className="text-xl text-on-surface-variant mb-12">
              Join photographers and event planners using Lumora to redefine the event photo experience.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <Link
                to="/host/signup"
                className="w-full sm:w-auto px-12 py-6 bg-primary text-on-primary rounded-full font-black text-xl transition-all hover:shadow-[0_0_40px_rgba(193,156,255,0.4)]"
              >
                Launch Your Event
              </Link>
              <Link
                to="/host"
                className="group flex items-center gap-3 text-on-surface font-bold text-lg hover:text-primary transition-colors"
              >
                Explore Event Dashboard
                <span className="material-symbols-outlined transition-transform group-hover:translate-x-2">arrow_forward</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="bg-surface-container-lowest w-full py-16 border-t border-outline-variant/15">
        <div className="flex flex-col md:flex-row justify-between items-center px-8 max-w-7xl mx-auto gap-8">
          <div className="flex flex-col items-center md:items-start gap-3">
            <LogoWordmark iconSize={22} textSize="text-lg" />
            <p className="text-on-surface-variant text-sm text-center md:text-left">
              © {new Date().getFullYear()} Lumora. All rights reserved.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-8 text-sm">
            <a href="#features" className="text-on-surface-variant hover:text-secondary transition-colors">Features</a>
            <Link to="/host/pricing" className="text-on-surface-variant hover:text-secondary transition-colors">Pricing</Link>
            <Link to="/host" className="text-on-surface-variant hover:text-secondary transition-colors">Host Dashboard</Link>
            <Link to="/host/login" className="text-on-surface-variant hover:text-secondary transition-colors">Login</Link>
          </div>

          <div className="flex gap-4">
            {['camera_alt', 'videocam'].map((icon) => (
              <div key={icon}
                className="w-10 h-10 rounded-full border border-outline-variant/30 flex items-center justify-center text-on-surface-variant hover:border-primary hover:text-primary transition-all cursor-pointer">
                <span className="material-symbols-outlined text-xl">{icon}</span>
              </div>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
