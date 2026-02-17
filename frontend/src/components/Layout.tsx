import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Camera, LogOut, ChevronLeft, Shield, Crown } from 'lucide-react';
import Footer from './Footer';
import { getPlan } from '../config/plans';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
  backTo?: string;
}

export default function Layout({ children, title, showBack, backTo }: LayoutProps) {
  const { host, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-ivory flex flex-col">
      {/* Header */}
      <header className="bg-pine-800 sticky top-0 z-50 shadow-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showBack && (
              <button
                onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>
            )}
            <Link to="/host" className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gold-300 rounded-lg flex items-center justify-center">
                <Camera className="w-4 h-4 text-pine-800" />
              </div>
              <span className="font-display text-xl font-semibold text-white tracking-wide">
                Backshots
              </span>
            </Link>
            {title && (
              <>
                <span className="text-white/30">/</span>
                <h1 className="font-sans font-semibold text-sm text-white/80 truncate">{title}</h1>
              </>
            )}
          </div>

          {host && (
            <div className="flex items-center gap-2 sm:gap-4">
              <Link
                to="/host/pricing"
                className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 transition-colors"
                title="View plans"
              >
                <Crown className="w-3.5 h-3.5 text-gold-300" />
                <span className="text-gold-200 capitalize">{getPlan(host.plan).name}</span>
              </Link>
              {isAdmin && (
                <Link
                  to="/host/admin"
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors text-amber-300"
                  title="Admin Panel"
                >
                  <Shield className="w-5 h-5" />
                </Link>
              )}
              <span className="text-sm text-white/60 hidden sm:inline">
                {host.displayName}
              </span>
              <button
                onClick={() => {
                  logout();
                  navigate('/host/login');
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/60"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6 flex-1">{children}</main>

      {/* Footer */}
      <Footer className="py-6" variant="light" />
    </div>
  );
}