/**
 * api.js — Wrapper fetch untuk seluruh REST API EMOOSE.
 */
(function () {
  async function request(url, options = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      ...options
    });
    if (res.status === 401) {
      window.location.href = '/';
      throw new Error('Unauthorized');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.message || `Request gagal (${res.status})`);
    }
    return data;
  }

  const EmooseApi = {
    login: (username, password) =>
      request('/api/login', { method: 'POST', body: JSON.stringify({ username, password }) }),

    logout: () => request('/api/logout', { method: 'POST' }),

    getLatestSensor: () => request('/api/sensor/latest'),

    getSensorHistory: (limit = 40) => request(`/api/sensor/history?limit=${limit}`),

    getEvents: ({ search = '', status = '', date = '', page = 1, limit = 25 } = {}) => {
      const q = new URLSearchParams({ search, status, date, page, limit }).toString();
      return request(`/api/events?${q}`);
    },

    deleteEvent: (id) => request(`/api/events/${id}`, { method: 'DELETE' }),

    deleteAllEvents: (range = 'all') => request(`/api/events/all?range=${range}`, { method: 'DELETE' }),

    getStatus: () => request('/api/status'),

    getNodeConfig: () => request('/api/config/node'),

    getSettings: () => request('/api/settings'),

    saveSettings: (payload) => request('/api/settings', { method: 'POST', body: JSON.stringify(payload) }),

    // ---------------- Manual Control ----------------
    sendCommand: (type, action) => request('/api/command', { method: 'POST', body: JSON.stringify({ type, action }) }),

    // ---------------- Access Log (Riwayat Akses) ----------------
    getAccessLog: (limit = 200) => request(`/api/access-log?limit=${limit}`),
    deleteAllAccessLog: (range = 'all') => request(`/api/access-log/all?range=${range}`, { method: 'DELETE' }),

    // ---------------- Analytics ----------------
    getWaterAnalytics: () => request('/api/analytics/water'),
    getEnergyAnalytics: () => request('/api/analytics/energy'),
    getMaintenanceAnalytics: () => request('/api/analytics/maintenance'),
    getHealthScore: () => request('/api/analytics/health'),
    getAbnormalWeek: () => request('/api/analytics/abnormal-week')
  };

  window.EmooseApi = EmooseApi;
})();
