import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';

// Host pages
import Login from './host/Login';
import Signup from './host/Signup';
import EventList from './host/EventList';
import CreateEvent from './host/CreateEvent';
import EventDashboard from './host/EventDashboard';
import EventSettings from './host/EventSettings';
import Moderation from './host/Moderation';
import HostGallery from './host/Gallery';
import ExportPage from './host/Export';
import Admin from './host/Admin';
import Pricing from './host/Pricing';

// Guest pages
import GuestLanding from './guest/Landing';
import GuestCamera from './guest/Camera';
import GuestGallery from './guest/Gallery';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-pine-800 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/host/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Host routes */}
      <Route path="/host/login" element={<Login />} />
      <Route path="/host/signup" element={<Signup />} />
      <Route
        path="/host"
        element={
          <ProtectedRoute>
            <EventList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/host/events/new"
        element={
          <ProtectedRoute>
            <CreateEvent />
          </ProtectedRoute>
        }
      />
      <Route
        path="/host/events/:eventId"
        element={
          <ProtectedRoute>
            <EventDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/host/events/:eventId/settings"
        element={
          <ProtectedRoute>
            <EventSettings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/host/events/:eventId/moderation"
        element={
          <ProtectedRoute>
            <Moderation />
          </ProtectedRoute>
        }
      />
      <Route
        path="/host/events/:eventId/gallery"
        element={
          <ProtectedRoute>
            <HostGallery />
          </ProtectedRoute>
        }
      />
      <Route
        path="/host/events/:eventId/export"
        element={
          <ProtectedRoute>
            <ExportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/host/admin"
        element={
          <ProtectedRoute>
            <Admin />
          </ProtectedRoute>
        }
      />

      <Route
        path="/host/pricing"
        element={
          <ProtectedRoute>
            <Pricing />
          </ProtectedRoute>
        }
      />

      {/* Guest routes */}
      <Route path="/e/:eventCode" element={<GuestLanding />} />
      <Route path="/e/:eventCode/camera" element={<GuestCamera />} />
      <Route path="/e/:eventCode/gallery" element={<GuestGallery />} />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/host" replace />} />
      <Route path="*" element={<Navigate to="/host" replace />} />
    </Routes>
  );
}
