import { encryptPassword, clearPublicKeyCache } from '../utils/crypto';

// In native Capacitor builds VITE_API_BASE must be the absolute server URL (e.g. https://api.example.com/v1)
// because relative paths resolve to capacitor://localhost which never reaches the backend.
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/v1';

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
      // If we get a 401 on a host-authenticated request, the token is likely stale.
      // Clear it so the next ProtectedRoute check redirects to login – but avoid doing
      // this for admin storage tooling, where we'd rather show a local error than
      // bounce the user out of the Admin area.
      const isAdminStoragePath =
        path.startsWith('/admin/storage/config') ||
        path.startsWith('/admin/storage/health') ||
        path.startsWith('/admin/storage/list') ||
        path.startsWith('/admin/storage/test');

      if (res.status === 401 && !useGuest && this.hostToken && !isAdminStoragePath) {
        this.setHostToken(null);
        // Let the UI handle redirect based on auth state instead of forcing a full reload.
      }

      const error = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${res.status}`);
    }

    return res.json();
  }

  // Auth
  async signup(email: string, password: string, displayName: string) {
    let body: Record<string, string>;
    try {
      const encryptedPassword = await encryptPassword(password);
      body = { email, encryptedPassword, displayName };
    } catch (err: any) {
      if (err.message === 'ENCRYPTION_UNAVAILABLE') {
        body = { email, password, displayName };
      } else {
        if (err.message?.includes('decrypt')) clearPublicKeyCache();
        throw err;
      }
    }
    try {
      const data = await this.request<{ token: string; host: any }>(
        '/auth/host/signup',
        { method: 'POST', body: JSON.stringify(body) }
      );
      this.setHostToken(data.token);
      return data;
    } catch (err: any) {
      if (err.message?.includes('decrypt')) clearPublicKeyCache();
      throw err;
    }
  }

  async login(email: string, password: string) {
    let body: Record<string, string>;
    try {
      const encryptedPassword = await encryptPassword(password);
      body = { email, encryptedPassword };
    } catch (err: any) {
      if (err.message === 'ENCRYPTION_UNAVAILABLE') {
        body = { email, password };
      } else {
        if (err.message?.includes('decrypt')) clearPublicKeyCache();
        throw err;
      }
    }
    try {
      const data = await this.request<{ token: string; host: any }>(
        '/auth/host/login',
        { method: 'POST', body: JSON.stringify(body) }
      );
      this.setHostToken(data.token);
      return data;
    } catch (err: any) {
      if (err.message?.includes('decrypt')) clearPublicKeyCache();
      throw err;
    }
  }

  async getMe() {
    return this.request<{ host: any }>('/auth/host/me');
  }

  /**
   * Exchange a Clerk session JWT for a Lumora backend JWT.
   * The backend verifies the Clerk token, then upserts a Host row and
   * returns its own short-lived JWT alongside the Host profile.
   */
  async clerkExchange(clerkToken: string) {
    const data = await this.request<{ token: string; host: any }>(
      '/auth/host/clerk',
      {
        method: 'POST',
        body: JSON.stringify({ clerkToken }),
      }
    );
    this.setHostToken(data.token);
    return data;
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

  async deleteEvent(eventId: string) {
    const token = this.getHostToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_BASE}/events/${eventId}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `HTTP ${res.status}`);
    }
    // DELETE returns 204 No Content, so nothing to parse.
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

  // Videos (Host)
  async getVideos(eventId: string) {
    return this.request<{ videos: any[] }>(`/events/${eventId}/videos`);
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

  async bulkModerateVideos(eventId: string, videoIds: string[], action: string) {
    return this.request<{ success: boolean; affected: number; action: string }>(
      `/events/${eventId}/videos/bulk`,
      {
        method: 'POST',
        body: JSON.stringify({ photoIds: videoIds, action }),
      }
    );
  }

  async moderatePhoto(eventId: string, photoId: string, data: { hidden?: boolean; status?: string }) {
    return this.request<{ photo: any }>(`/events/${eventId}/photos/${photoId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async moderateVideo(eventId: string, videoId: string, data: { hidden?: boolean; status?: string }) {
    return this.request<{ video: any }>(`/events/${eventId}/videos/${videoId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Public stream (no auth)
  async getStreamData(eventId: string) {
    return this.request<{ event: any; stats: any; qr: any; photos: any[]; videos: any[] }>(
      `/events/${eventId}/stream`
    );
  }

  // Event moderators
  async searchModerators(eventId: string, q: string) {
    return this.request<{ hosts: any[] }>(`/events/${eventId}/moderators/search?q=${encodeURIComponent(q)}`);
  }

  async getEventModerators(eventId: string) {
    return this.request<{ moderators: any[] }>(`/events/${eventId}/moderators`);
  }

  async addEventModerator(eventId: string, email: string) {
    return this.request<{ moderator: any }>(`/events/${eventId}/moderators`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async removeEventModerator(eventId: string, entryId: string) {
    return this.request<{ success: boolean }>(`/events/${eventId}/moderators/${entryId}`, {
      method: 'DELETE',
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

  // Guest videos
  async uploadVideo(eventId: string, file: Blob, durationSec: number, title?: string, description?: string) {
    const formData = new FormData();
    formData.append('video', file, 'clip.webm');
    formData.append('durationSec', String(durationSec));
    if (title) formData.append('title', title);
    if (description) formData.append('description', description);

    return this.request<{ video: any }>(
      `/events/${eventId}/videos/upload`,
      {
        method: 'POST',
        body: formData,
      },
      true
    );
  }

  // Memories
  async getMyMemories() {
    return this.request<{ memories: any[] }>('/host/memories');
  }

  async getMemory(sessionId: string) {
    return this.request<{ memory: any }>(`/host/memories/${sessionId}`);
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

  // Storage (Admin)
  async getStorageHealth() {
    return this.request<{ ok: boolean; storageType: string; [k: string]: any }>('/admin/storage/health');
  }

  async listStorageObjects(prefix: string, limit = 50, cursor?: string | null) {
    const params = new URLSearchParams();
    if (prefix) params.set('prefix', prefix);
    params.set('limit', String(limit));
    if (cursor) params.set('cursor', cursor);
    return this.request<{ prefix: string; nextCursor: string | null; objects: any[] }>(
      `/admin/storage/list?${params.toString()}`
    );
  }

  async getStorageConfig() {
    return this.request<{
      storageType: 'filesystem' | 's3';
      s3: null | {
        bucket: string;
        region: string;
        endpoint: string;
        accessKeyId: string;
        secretAccessKey: string; // masked as "***" when set
        publicUrl: string;
        forcePathStyle: boolean;
      };
    }>('/admin/storage/config');
  }

  async saveStorageConfig(body: {
    storageType: 'filesystem' | 's3';
    s3?: {
      bucket: string;
      region: string;
      endpoint?: string;
      accessKeyId?: string;
      secretAccessKey?: string;
      publicUrl: string;
      forcePathStyle?: boolean;
    };
  }) {
    return this.request<{ ok: boolean }>('/admin/storage/config', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async testStorageConfig(body: {
    storageType: 'filesystem' | 's3';
    s3?: {
      bucket: string;
      region: string;
      endpoint?: string;
      accessKeyId?: string;
      secretAccessKey?: string;
      publicUrl: string;
      forcePathStyle?: boolean;
    };
  }) {
    return this.request<{ ok: boolean; sampleKey: string | null }>('/admin/storage/test', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
}

export const api = new ApiClient();
