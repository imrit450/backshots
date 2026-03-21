import { Link } from 'react-router-dom';
import { LogoWordmark } from '../components/Logo';

const steps = [
  {
    n: '01',
    color: 'primary' as const,
    label: 'Creation',
    title: 'Host creates event.',
    caption: 'Set your vibe, timing, and privacy rules in seconds.',
    icon: 'dashboard_customize',
    visual: (
      <div className="rounded-xl overflow-hidden bg-surface-container-low border border-outline-variant/15 aspect-square relative group">
        <img
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBfTxXlubeqjDAs8NyPppksXi2OS5AEg6GN27mgv4ircigNCtBOXPG19HMAvESxyUlVcuali-ua2dFDO2bKXWzxWPbR2iLVhwyaHNzU0pRQPDCWrvmvtNT8sR4bguzdKzMiqxkdn05HRn6sPciSjLCzT4zXIpbDt4yEjjQ5otjRNX-1ayOhguPoVks-2oa-5g-c3TvpO9Y2ByTjsVjhMi4tCQZugdmdpMU-8iF9ld4wujSBWmhFPU7SC6fbgDrJaIdnSg_nnIRfNBJt"
          alt="Digital dashboard interface showing event creation settings"
          className="w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent opacity-80" />
        <div className="absolute bottom-4 left-4 right-4">
          <div className="bg-surface-container-highest/60 backdrop-blur-md p-3 rounded-lg border border-white/5">
            <p className="text-xs text-on-surface-variant font-medium">Set your vibe, timing, and privacy rules in seconds.</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    n: '02',
    color: 'secondary' as const,
    label: 'Onboarding',
    title: 'Guests scan QR.',
    caption: 'No app, no friction. Just scan and start shooting.',
    icon: 'qr_code_scanner',
    visual: (
      <div className="rounded-xl overflow-hidden bg-surface-container-low border border-outline-variant/15 aspect-square relative group">
        <img
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuAQe3l8fFbr6kiSoxpi_zM-A8qo5wZDVRmEjRLxJdyrdCLUrAaTJI3N7OyOKRNLQ6qqJsR__B3MZNFMJGkJKcdS-jb8W4eCdL9hE2QOA-DwyKMWqzsfFO4ekY3jD5k06iXApJdj0ez_zlA6F2qNIvGOTdAzM4ZWMlunKaKVx8g4uBKjPv6S-_SSB-my2nlY61BfVqXuwPyvFrtMTVhcf4gbtqMSGss0BVWnCmF8AYPlF5f8iKKZUzhHYV5dOJQRoCttn_aKcS2BZ0e9"
          alt="Close up of hand scanning QR code at stylish event entrance"
          className="w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent opacity-80" />
        <div className="absolute bottom-4 left-4 right-4 flex justify-center">
          <div className="bg-secondary/20 backdrop-blur-xl px-6 py-3 rounded-full border border-secondary/30 flex items-center gap-3">
            <span className="material-symbols-outlined text-secondary">qr_code_scanner</span>
            <span className="text-sm font-bold text-white">Instant Sync</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    n: '03',
    color: 'primary' as const,
    label: 'Capture',
    title: 'Guests shoot & upload.',
    caption: 'Photos sync to your private cloud the moment they\'re taken.',
    icon: 'photo_camera',
    visual: (
      <div className="grid grid-cols-2 gap-3 aspect-square">
        <div className="bg-surface-container-low rounded-lg overflow-hidden border border-outline-variant/10 relative group">
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDd0UDp1Gbfmgfxi3qPUOugl1c9oJ9-JIAEQx7EgGS1QqDN7AsJ_QQiiMfsGbsGhMoTdKJMNW1ov2jyr_jAIrfL90dyh2icNadj9ucDYCh3494p-6IBFZukemMKC4dBpGtYYFnNi64je8lt7xjDSYpHJYmW_5x8Uzc-7JrhPG27oDqYhDinDqXtwrM5kJ7RMzYty-v_FeZb93WJYflK7siKhbCD9pLKZgv-4GoHlplCpuS0OoFDNQTR-q1DNcXlT3ZoM0v8iGf0hZGa"
            alt="Person taking a photo at a concert with a phone"
            className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-all"
          />
        </div>
        <div className="bg-surface-container-low rounded-lg overflow-hidden border border-outline-variant/10 translate-y-4 relative group">
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuA96Rj-p33JUjAJmCa81xv9n_WSliisAoC3Tre84L8RGIWSCdgMET4Ava9YzdnX6C8zq6FM-EC4YcOe9SRCBQWmSPFT9f_NyP_sz46pTcHF8VSifxJb0m_mmL2ENqBLNxJknvl7pwDwHazoNpYuyYoWdBjrc0-gyCUm3D3USHuomsSYP7s-wcaS8t1HchO1x_qBdWg-qFyUbkfp3LdETws-Wy0wHbnws7k0PpH1wc9bCs3mSbkGb9wUZcKK-2nRuNBTpx4SmP9FC6KI"
            alt="Blurred lights and action at a high-end party"
            className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-all"
          />
        </div>
        <div className="bg-surface-container-low rounded-lg overflow-hidden border border-outline-variant/10 col-span-2 mt-4 relative group">
          <div className="absolute inset-0 flex items-center justify-center bg-primary/10 backdrop-blur-sm z-10 group-hover:hidden">
            <span className="material-symbols-outlined text-primary text-4xl">upload_file</span>
          </div>
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuClh3xPGAGjUtvQF7tW1py5qD7YA-eHssbdSb10UFqhKXoDfQNnf5MtZnHfOQrKCQbe50w5sSGXSXtxgm-GI4QZF56vNuFa5XqH9B-qC7GtwAEBSftl1NkTjjHoEsrAH6to4NxPEo0Opv7BvkXbEuKiMMyw8-Yw-0VQC6bRYXNW5yzpABMcqltBRJ3rEuSkPVha0jvmksbjF6BRQNOJk_0U7rCme3wSNri2N9PMrRjFh6fvBOA5uErhOypvySbGuT9_dJhUbes3DJD_"
            alt="Crowd of people holding up phones at a celebration"
            className="w-full h-40 object-cover"
          />
        </div>
      </div>
    ),
  },
  {
    n: '04',
    color: 'secondary' as const,
    label: 'Showcase',
    title: 'Host moderates & displays.',
    caption: 'Approve photos, push to live feed, export in full resolution.',
    icon: 'live_tv',
    visual: (
      <div className="rounded-xl overflow-hidden bg-surface-container-highest border border-primary/20 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-error" />
            <div className="w-2.5 h-2.5 rounded-full bg-secondary" />
            <div className="w-2.5 h-2.5 rounded-full bg-primary" />
          </div>
          <span className="text-[10px] font-black text-primary px-2 py-0.5 border border-primary/40 rounded-full uppercase tracking-widest">Live Feed</span>
        </div>
        <div className="space-y-2.5">
          {[
            { status: 'approved', progress: '3/4' },
            { status: 'pending', progress: '0/4' },
          ].map((item, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 bg-surface-container-low p-2 rounded-lg ${item.status === 'pending' ? 'opacity-50' : ''}`}
            >
              <div className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0">
                <img
                  src={i === 0
                    ? "https://lh3.googleusercontent.com/aida-public/AB6AXuDzoINzDvM1TzuFu32ltN4EhhA3YBNIk13o2WYCVkfBPvMqXYjuPZhb65DWtpC_IGu9pifb34MGpm_9N_HsYrY67QHCzrflIuDUnQgFsVa2412PnPfeeU1GFDfFsnv5VvDlC0idzumJ25146W6_o1gU3PE5ltxq1IB2s_Z8NXCal9hJY6PebLEIqiVFUEt7XT-bzMEDR9Bsnwj-gz7grDlfutBn3vXWFVRHx2661UaqcI1lhL7P8AKw1P-Uc17OVel4h1dm-2KH0GET"
                    : "https://lh3.googleusercontent.com/aida-public/AB6AXuAsWaXVeCkQsLqHvrO_txhPmC8G0P1dYxecCzp2fi3peWKFAR4QL1-a0xKimA62JVRmjcjrlol0926gWJWLI5GLkbgn-b_Q6tGrHQOhHf3SJytA5MhHHnsOto_qz0JJmhcHZdmh31C32CA_p_lD8ytqMUgPB8PahW55C5tpLXB7iUXvmdum-vhzFxuecwoiKnj8vKEsg7dGef420-E2KCGDLLqC8cojRRehXOWOBUJnPSUd4nVM-lE6V_ijfXagR1EN-uHZYF7rFB3q"
                  }
                  alt="Moderation queue photo"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-grow h-1.5 bg-outline-variant/30 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${item.status === 'approved' ? 'bg-primary w-3/4' : 'w-0'}`}
                />
              </div>
              <span
                className="material-symbols-outlined text-base"
                style={{
                  color: item.status === 'approved' ? '#c19cff' : '#adaaaa',
                  fontVariationSettings: item.status === 'approved' ? "'FILL' 1" : undefined,
                }}
              >
                {item.status === 'approved' ? 'check_circle' : 'pending'}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-3 bg-primary/10 p-2 rounded-lg border border-primary/20">
            <span className="material-symbols-outlined text-primary text-base">live_tv</span>
            <span className="text-xs font-bold text-primary">Projecting to venue screen</span>
          </div>
        </div>
      </div>
    ),
  },
];

const eventTypes = [
  { icon: 'nightlife', label: 'Nightlife', color: 'primary' },
  { icon: 'favorite', label: 'Weddings', color: 'secondary' },
  { icon: 'business_center', label: 'Corporate', color: 'primary' },
  { icon: 'groups', label: 'Conferences', color: 'secondary' },
  { icon: 'celebration', label: 'Birthdays', color: 'primary' },
  { icon: 'school', label: 'Graduations', color: 'secondary' },
];

export default function HowItWorks() {
  return (
    <div className="bg-surface text-on-surface font-body min-h-screen">
      {/* ── TopAppBar ── */}
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl"
        style={{ boxShadow: '0 0 20px rgba(193,156,255,0.12)' }}>
        <nav className="flex justify-between items-center px-6 py-4 max-w-7xl mx-auto">
          <Link to="/">
            <LogoWordmark iconSize={26} textSize="text-2xl" />
          </Link>
          <div className="hidden md:flex items-center gap-8 font-label text-sm">
            <Link to="/#features" className="text-on-surface-variant hover:text-on-surface transition-colors">Features</Link>
            <span className="text-primary border-b-2 border-primary pb-0.5 font-bold">How it Works</span>
            <Link to="/#events" className="text-on-surface-variant hover:text-on-surface transition-colors">Events</Link>
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

      <main className="pt-32 pb-20 px-6 max-w-xl mx-auto">
        {/* ── Hero ── */}
        <section className="mb-16">
          <div className="inline-flex items-center gap-2 bg-surface-container-highest px-4 py-2 rounded-full mb-6 border border-outline-variant/20">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">The Kinetic Flow</span>
          </div>
          <h1 className="font-headline font-black tracking-tighter leading-none mb-4"
            style={{ fontSize: 'clamp(2.5rem, 8vw, 3.5rem)' }}>
            THE <span className="text-primary italic">APERTURE</span><br />FLUX SYSTEM
          </h1>
          <p className="text-on-surface-variant text-lg leading-relaxed max-w-sm">
            A high-octane visual journey from creation to curation. Four steps, zero friction.
          </p>
        </section>

        {/* ── Vertical Timeline ── */}
        <div className="relative">
          {/* Central line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 opacity-20 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, #c19cff 0%, #ff7441 100%)' }} />

          {steps.map((step, i) => {
            const colorClass = step.color === 'primary' ? 'text-primary border-primary' : 'text-secondary border-secondary';
            const isLast = i === steps.length - 1;
            return (
              <div key={step.n} className={`relative flex gap-8 group ${isLast ? '' : 'mb-20'}`}>
                {/* Step dot */}
                <div className={`z-10 flex-shrink-0 w-12 h-12 rounded-full bg-surface-container-highest border-2 ${colorClass} flex items-center justify-center`}
                  style={step.n === '01' || step.n === '04' ? { boxShadow: '0 0 40px -10px rgba(193,156,255,0.3)' } : undefined}>
                  <span className={`font-headline font-black text-sm ${step.color === 'primary' ? 'text-primary' : 'text-secondary'}`}>{step.n}</span>
                </div>

                <div className="flex-grow pt-1">
                  <div className="mb-4">
                    <span className={`text-xs font-black uppercase tracking-[0.2em] block mb-1 ${step.color === 'primary' ? 'text-primary' : 'text-secondary'}`}>
                      {step.label}
                    </span>
                    <h2 className="text-2xl font-headline font-bold text-on-surface leading-tight">{step.title}</h2>
                  </div>
                  {step.visual}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Event Types / Versatility Map ── */}
        <section className="mt-24">
          <div className="mb-10">
            <p className="text-secondary font-bold uppercase tracking-[0.3em] text-sm mb-3">Versatility Map</p>
            <h3 className="font-headline font-black text-3xl md:text-4xl">Every Event.<br />One Platform.</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {eventTypes.map(({ icon, label, color }) => (
              <div key={label}
                className="flex items-center gap-4 bg-surface-container-low border border-outline-variant/15 rounded-2xl p-5 hover:border-primary/30 transition-colors">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color === 'primary' ? 'bg-primary/10' : 'bg-secondary/10'}`}>
                  <span className={`material-symbols-outlined text-xl ${color === 'primary' ? 'text-primary' : 'text-secondary'}`}
                    style={{ fontVariationSettings: "'FILL' 1" }}>
                    {icon}
                  </span>
                </div>
                <span className="font-headline font-bold text-on-surface text-sm uppercase tracking-wide">{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="mt-20 text-center">
          <div className="p-px rounded-full mb-8 inline-block"
            style={{ background: 'linear-gradient(135deg, #c19cff, #ff7441)' }}>
            <Link
              to="/host/signup"
              className="block bg-surface px-10 py-5 rounded-full text-on-surface font-headline font-black text-xl hover:bg-transparent hover:text-on-primary transition-all"
            >
              START THE LENS
            </Link>
          </div>
          <p className="text-on-surface-variant font-medium text-sm">No credit card required. Pure kinetic energy.</p>
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
            <Link to="/#features" className="text-on-surface-variant hover:text-secondary transition-colors">Features</Link>
            <Link to="/how-it-works" className="text-primary font-bold">How it Works</Link>
            <Link to="/host/pricing" className="text-on-surface-variant hover:text-secondary transition-colors">Pricing</Link>
            <Link to="/host" className="text-on-surface-variant hover:text-secondary transition-colors">Host Dashboard</Link>
            <Link to="/host/login" className="text-on-surface-variant hover:text-secondary transition-colors">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
