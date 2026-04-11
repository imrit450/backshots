import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from './Toast';
import { api } from '../api/client';
import { UserButton } from '@clerk/react';
import {
  LayoutDashboard,
  CalendarDays,
  Settings,
  Shield,
  Crown,
  Menu,
  BookImage,
} from 'lucide-react';
import { getPlan } from '../config/plans';
import { LogoIcon, LogoWordmark } from './Logo';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  backTo?: string;
}

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  matchExact?: boolean;
}

function NavLink({ item, active, onClick }: { item: NavItem; active: boolean; onClick?: () => void }) {
  return (
    <Link
      to={item.to}
      onClick={onClick}
      className={
        active
          ? 'nav-link-active'
          : 'nav-link'
      }
    >
      <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
        {item.icon}
      </span>
      <span className="text-sm font-medium">{item.label}</span>
    </Link>
  );
}

const PENDING_POLL_MS = 12_000;

export default function Layout({ children, title, subtitle, showBack, backTo }: LayoutProps) {
  const { host, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);
  const lastPendingRef = useRef<number | null>(null);

  const plan = host ? getPlan(host.plan) : null;

  // ── Global pending-photo notifier ────────────────────────────────────────
  const eventIdMatch = location.pathname.match(/\/host\/events\/([^/]+)/);
  const currentEventId = eventIdMatch ? eventIdMatch[1] : null;

  useEffect(() => {
    if (!currentEventId) {
      lastPendingRef.current = null;
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const data = await api.getEventStats(currentEventId);
        if (cancelled) return;
        const pending: number = data.stats?.pending ?? 0;
        if (lastPendingRef.current !== null && pending > lastPendingRef.current) {
          const diff = pending - lastPendingRef.current;
          addToast({
            type: 'photo',
            message: `${diff} photo${diff > 1 ? 's' : ''} awaiting your review`,
            duration: 8000,
            onClick: () => navigate(`/host/events/${currentEventId}/moderation`),
          });
        }
        lastPendingRef.current = pending;
      } catch {
        // silent — don't disrupt the UI for a background poll failure
      }
    };

    poll();
    const interval = setInterval(poll, PENDING_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
      lastPendingRef.current = null;
    };
  }, [currentEventId, addToast, navigate]);

  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      to: '/host',
      icon: <LayoutDashboard className="w-5 h-5" />,
      matchExact: true,
    },
    {
      label: 'Events',
      to: '/host/events',
      icon: <CalendarDays className="w-5 h-5" />,
    },
    {
      label: 'My Memories',
      to: '/host/memories',
      icon: <BookImage className="w-5 h-5" />,
    },
    {
      label: 'Pricing',
      to: '/host/pricing',
      icon: <Crown className="w-5 h-5" />,
    },
  ];

  if (!authLoading && isAdmin) {
    navItems.push({
      label: 'Admin',
      to: '/host/admin',
      icon: <Shield className="w-5 h-5" />,
    });
  }

  function isActive(item: NavItem): boolean {
    if (item.matchExact) return location.pathname === item.to;
    return location.pathname.startsWith(item.to);
  }

  const planBadgeColors: Record<string, string> = {
    free: 'text-on-surface-variant bg-surface-variant',
    starter: 'text-primary bg-primary/10',
    pro: 'text-secondary bg-secondary/10',
    business: 'text-tertiary bg-tertiary/10',
    enterprise: 'text-tertiary bg-tertiary/10',
  };
  const planColor = host ? (planBadgeColors[host.plan] ?? planBadgeColors.free) : planBadgeColors.free;

  const Sidebar = ({ onNavClick }: { onNavClick?: () => void }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 flex-shrink-0">
        <Link
          to="/host"
          className="flex items-center gap-2.5 group"
          onClick={onNavClick}
        >
          <LogoWordmark iconSize={28} textSize="text-xl" />
        </Link>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-outline-variant/40 mb-4 flex-shrink-0" />

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto no-scrollbar">
        {navItems.map((item) => (
          <NavLink
            key={item.to + item.label}
            item={item}
            active={isActive(item)}
            onClick={onNavClick}
          />
        ))}
      </nav>

      {/* User info at bottom */}
      {host && (
        <div className="flex-shrink-0 p-4 border-t border-outline-variant/30">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <UserButton />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-on-surface truncate leading-tight">
                {host.displayName}
              </p>
              <Link
                to="/host/pricing"
                className={`inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-opacity hover:opacity-80 ${planColor}`}
                onClick={onNavClick}
              >
                <Crown className="w-2.5 h-2.5" />
                {plan?.name}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-surface flex">
      {/* ── Desktop sidebar ─────────────────────────────── */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-64 bg-surface-container-low border-r border-outline-variant/30 z-40">
        <Sidebar />
      </aside>

      {/* ── Mobile sidebar overlay ───────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          {/* Scrim */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Drawer */}
          <aside
            className="absolute left-0 top-0 bottom-0 w-64 bg-surface-container-low border-r border-outline-variant/30 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar onNavClick={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* ── Mobile top app bar ───────────────────────────── */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 h-16 bg-surface-container-low/90 backdrop-blur-xl border-b border-outline-variant/30 flex items-center px-4 gap-3">
        <button
          className="p-2 -ml-1 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {showBack && (
          <button
            onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
            className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors"
            aria-label="Go back"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
        )}

        <Link to="/host" className="flex items-center gap-2 flex-1 min-w-0">
          <LogoIcon size={22} className="flex-shrink-0" />
          {title && (
            <>
              <span className="text-on-surface-variant/40 text-sm">/</span>
              <span className="text-sm font-medium text-on-surface-variant truncate">{title}</span>
            </>
          )}
        </Link>

        <div className="flex items-center gap-2 flex-shrink-0">
          {!authLoading && isAdmin && (
            <Link
              to="/host/admin"
              className="p-2 rounded-xl text-secondary hover:bg-secondary/10 transition-colors"
              title="Admin Panel"
            >
              <Shield className="w-4 h-4" />
            </Link>
          )}
          <Link
            to="/host/pricing"
            className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </Link>
          <Link
            to="/"
            className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors"
            title="Visit website"
          >
            <span className="material-symbols-outlined text-[20px]">language</span>
          </Link>
          {host && <UserButton />}
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────── */}
      <main className="flex-1 lg:ml-64 pt-16 lg:pt-0 min-h-screen overflow-x-hidden">
        {/* Desktop page header */}
        {(title || subtitle || showBack) && (
          <div className="hidden lg:flex items-center gap-3 px-8 pt-8 pb-2">
            {showBack && (
              <button
                onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
                className="p-2 -ml-2 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors"
                aria-label="Go back"
              >
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              </button>
            )}
            <div>
              {title && (
                <h1 className="font-headline text-2xl font-bold text-on-surface leading-tight">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="text-sm text-on-surface-variant mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>
        )}

        <div className="px-4 lg:px-8 py-4 lg:py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
