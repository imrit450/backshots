import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Landing page for Google OAuth callback.
 * The backend redirects here with ?status=connected or ?status=error
 * We store the result in sessionStorage, then redirect back to where the
 * user came from (stored before starting the OAuth flow).
 */
export default function GoogleCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    const reason = params.get('reason');

    if (status) {
      sessionStorage.setItem('googleOAuthResult', JSON.stringify({ status, reason }));
    }

    // Go back to the page that initiated the OAuth flow
    const returnTo = sessionStorage.getItem('googleOAuthReturnTo') || '/host';
    sessionStorage.removeItem('googleOAuthReturnTo');
    navigate(returnTo, { replace: true });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-on-surface-variant text-sm">Connecting Google account…</p>
    </div>
  );
}
