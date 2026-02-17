import { encryptPassword, clearPublicKeyCache } from '../utils/crypto';

const API_BASE = '/v1';

class ApiClient {
  private hostToken: string | null = null;
  private guestToken: string | null = null;

  constructor() {
    this.hostToken = localStorage.getItem('hostToken');
    this.guestToken = sessionStorage.getItem('guestToken');
  }

  setHostToken(token: string | null) {
    this.hostToken = token;
    if (token) {
      localStorage.setItem('hostToken', token);
    } else {
      localStorage.removeItem('hostToken');
    }
  }

  setGuestToken(token: string | null) {
    this.guestToken = token;
    if (token) {
      sessionStorage.setItem('guestToken', token);
    } else {
      sessionStorage.removeItem('guestToken');
    }
  }

  getHostToken() {
    return this.hostToken;
  }

  getGuestToken() {
    return this.guestToken;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
    useGuest = false
  ): Promise<T> {
    const token = useGuest ? this.guestToken : this.hostToken;
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      // If we get a 401 on a host-authenticated request, the token is stale.
      // Clear it so the next ProtectedRoute check redirects to login.
      if (res.status === 401 && !useGuest && this.hostToken) {
        this.setHostToken(null);
        // Redirect to login if we're not already there
        if (!window.location.pathname.startsWith('/host/login') &&
            !window.location.pathname.startsWith('/host/signup')) {
          window.location.href = '/host/login';
          throw new Error('Session expired. Please log in again.');
        }
      }

      const error = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${res.status}`);
    }

    return res.json();
  }

  // Auth
  async signup(email: string, password: string, displayName: string) {
    const encryptedPassword = await encryptPassword(password);
    try {
      const data = await this.request<{ token: string; host: any }>(
        '/auth/host/signup',
        {
          method: 'POST',
          body: JSON.stringify({ email, encryptedPassword, displayName }),
        }
      );
      this.setHostToken(data.token);
      return data;
    } catch (err: any) {
      if (err.message?.includes('decrypt')) {
        clearPublicKeyCache();
      }
      throw err;
    }
  }

  async login(email: string, password: string) {
    const encryptedPassword = await encryptPassword(password);
    try {
      const data = await this.request<{ token: string; host: any }>(
        '/auth/host/login',
        {
          method: 'POST',
          body: JSON.stringify({ email, encryptedPassword }),
        }
      );
      this.setHostToken(data.token);
      return data;
    } catch (err: any) {
      if (err.message?.includes('decrypt')) {
        clearPublicKeyCache();
      }
      throw err;
    }
  }

  async getMe() {
    return this.request<{ host: any }>('/auth/host/me');
  }

  logout() {
    this.setHostToken(null);
  }

  // Events
  async createEvent(data: any) {
    return this.request<{ event: any }>('/events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getEvents() {
    return this.request<{ events: any[] }>('/events');
  }

  async getEvent(eventId: string) {
    return this.request<{ event: any }>(`/events/${eventId}`);
  }

  async updateEvent(eventId: string, data: any) {
    return this.request<{ event: any }>(`/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async uploadEventIcon(eventId: string, file: Blob) {
    const formData = new FormData();
    formData.append('icon', file);
    const token = this.getHostToken();
    const res = await fetch(`${API_BASE}/events/${eventId}/icon`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Failed to upload icon');
    }
    return res.json() as Promise<{ event: any }>;
  }

  async removeEventIcon(eventId: string) {
    return this.request<{ event: any }>(`/events/${eventId}/icon`, {
      method: 'DELETE',
    });
  }

  async getEventQR(eventId: string) {
    return this.request<{ qrCode: string; eventUrl: string; eventCode: string }>(
      `/events/${eventId}/qr`
    );
  }

  async getEventStats(eventId: string) {
    return this.request<{ stats: any }>(`/events/${eventId}/stats`);
  }

  // Photos (Host)
  async getPhotos(eventId: string, params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<{ photos: any[]; pagination: any }>(
      `/events/${eventId}/photos${query}`
    );
  }

  async bulkModeratePhotos(eventId: string, photoIds: string[], action: string) {
    return this.request<{ success: boolean; affected: number; action: string }>(
      `/events/${eventId}/photos/bulk`,
      {
        method: 'POST',
        body: JSON.stringify({ photoIds, action }),
      }
    );
  }

  async moderatePhoto(eventId: string, photoId: string, data: { hidden?: boolean; status?: string }) {
    return this.request<{ photo: any }>(`/events/${eventId}/photos/${photoId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Exports
  async createExport(eventId: string) {
    return this.request<{ export: any }>(`/events/${eventId}/exports`, {
      method: 'POST',
    });
  }

  async getExport(eventId: string, exportId: string) {
    return this.request<{ export: any }>(`/events/${eventId}/exports/${exportId}`);
  }

  async getExports(eventId: string) {
    return this.request<{ exports: any[] }>(`/events/${eventId}/exports`);
  }

  // Guest
  async getPublicEvent(eventCode: string) {
    return this.request<{ event: any }>(`/events/${eventCode}/public`);
  }

  async checkExistingSession(eventCode: string, deviceId: string) {
    return this.request<{ existingSession: any }>(
      `/events/${eventCode}/guest-sessions/check?deviceId=${encodeURIComponent(deviceId)}`
    );
  }

  async createGuestSession(eventCode: string, displayName: string, phoneNumber?: string, deviceId?: string) {
    const data = await this.request<{ token: string; session: any; event: any; returning: boolean }>(
      `/events/${eventCode}/guest-sessions`,
      {
        method: 'POST',
        body: JSON.stringify({ displayName, phoneNumber, deviceId }),
      }
    );
    this.setGuestToken(data.token);
    return data;
  }

  async updateGuestSession(eventCode: string, sessionId: string, displayName: string, phoneNumber?: string) {
    const data = await this.request<{ token: string; session: any; event: any }>(
      `/events/${eventCode}/guest-sessions/${sessionId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ displayName, phoneNumber }),
      }
    );
    this.setGuestToken(data.token);
    return data;
  }

  async getMyPhotos(eventId: string) {
    return this.request<{ photos: any[] }>(
      `/events/${eventId}/photos/mine`,
      {},
      true
    );
  }

  async deleteGuestPhoto(eventId: string, photoId: string) {
    return this.request<{ success: boolean }>(
      `/events/${eventId}/photos/${photoId}`,
      { method: 'DELETE' },
      true
    );
  }

  async uploadPhoto(eventId: string, file: Blob, title?: string, description?: string) {
    const formData = new FormData();
    formData.append('photo', file, 'photo.jpg');
    if (title) formData.append('title', title);
    if (description) formData.append('description', description);

    return this.request<{ photo: any; remainingPhotos: number }>(
      `/events/${eventId}/photos/upload`,
      {
        method: 'POST',
        body: formData,
      },
      true
    );
  }

  async getGuestGallery(eventCode: string, params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<{ photos: any[]; pagination: any }>(
      `/events/${eventCode}/gallery${query}`,
      {},
      true
    );
  }

  // Admin
  async getAdminHosts() {
    return this.request<{ hosts: any[] }>('/admin/hosts');
  }

  async updateHost(hostId: string, data: { role?: string; canCreateEvents?: boolean; plan?: string }) {
    return this.request<{ host: any }>(`/admin/hosts/${hostId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getAdminEvents() {
    return this.request<{ events: any[] }>('/admin/events');
  }

  async getAdminStats() {
    return this.request<{ stats: any }>('/admin/stats');
  }

  async adminDeleteEvent(eventId: string) {
    return this.request<{ success: boolean }>(`/admin/events/${eventId}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient();
