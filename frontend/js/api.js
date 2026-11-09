/**
 * Blood Bank Portal - Central API Client
 * Connects frontend with Django REST Framework backend on Render / Localhost
 * Supports session cookies, CSRF tokens, and consistent error handling.
 */

// Production Render API URL (Update this with your deployed Render service URL if different)
const PRODUCTION_BACKEND_API = window.API_BASE_URL || 'https://blood-bank-portal-backend.onrender.com/api';

const API_BASE = (
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:8000/api'
    : PRODUCTION_BACKEND_API
);

function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

function formatValidationDetails(details) {
  if (!details || typeof details !== 'object') return '';
  if (Array.isArray(details)) {
    return details.map(item => (typeof item === 'string' ? item : JSON.stringify(item))).join(' ');
  }
  const parts = [];
  for (const [field, value] of Object.entries(details)) {
    const label = field === 'non_field_errors' || field === 'detail'
      ? ''
      : `${field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}: `;
    const msg = Array.isArray(value)
      ? value.map(v => (typeof v === 'string' ? v : formatValidationDetails(v))).join(', ')
      : (typeof value === 'object' ? formatValidationDetails(value) : String(value));
    if (msg) parts.push(`${label}${msg}`);
  }
  return parts.join(' | ');
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...options.headers,
  };

  // Attach token from localStorage for seamless cross-domain session handling
  const token = localStorage.getItem('lifepulse_auth_token');
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const csrftoken = getCookie('csrftoken');
  if (csrftoken) {
    headers['X-CSRFToken'] = csrftoken;
  }

  const controller = new AbortController();
  const defaultTimeout = endpoint === '/health/' ? 8000 : (endpoint === '/auth/logout/' ? 5000 : 25000);
  const timeoutMs = options.timeout || defaultTimeout;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const config = {
    ...options,
    signal: controller.signal,
    headers,
    credentials: 'include', // sends session cookies cross-origin / same-origin
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, config);
    const contentType = response.headers.get('content-type');
    let data = null;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('lifepulse_auth_token');
      }
      const detailsMsg = data && typeof data === 'object' ? formatValidationDetails(data.details) : '';
      const genericErrors = new Set([
        'Validation failed',
        'Invalid profile data',
        'Invalid status transition',
        'Invalid verification input',
      ]);
      let errorMsg = '';
      if (detailsMsg && (!data.error || genericErrors.has(data.error))) {
        errorMsg = detailsMsg;
      } else if (data && typeof data === 'object') {
        errorMsg = data.error || data.detail || detailsMsg;
      } else if (typeof data === 'string' && data.trim() && !data.trim().startsWith('<')) {
        errorMsg = data.trim().slice(0, 180);
      }
      if (!errorMsg) {
        errorMsg = `Request failed with status ${response.status}`;
      }
      const err = new Error(errorMsg);
      err.status = response.status;
      err.data = data;
      throw err;
    }

    // Auto-save auth token on login, registration, or emergency request
    if (data && data.token) {
      localStorage.setItem('lifepulse_auth_token', data.token);
    }

    return data;
  } catch (err) {
    if (err.name === 'AbortError') {
      const abortErr = new Error(`Request timed out after ${timeoutMs}ms: [${options.method || 'GET'} ${endpoint}]`);
      abortErr.isTimeout = true;
      console.warn(abortErr.message);
      throw abortErr;
    }
    console.error(`API Error on [${options.method || 'GET'} ${endpoint}]:`, err);
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const api = {
  auth: {
    login: (username, password) => request('/auth/login/', { method: 'POST', body: { username, password } }),
    register: (userData) => request('/auth/register/', { method: 'POST', body: userData }),
    logout: async () => {
      // Clear local session token immediately so UI sign-out is 0ms & resilient to offline/cold starts
      const token = localStorage.getItem('lifepulse_auth_token');
      localStorage.removeItem('lifepulse_auth_token');
      try {
        await request('/auth/logout/', {
          method: 'POST',
          timeout: 5000,
          keepalive: true,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
      } catch (err) {
        console.warn('Server logout warning (local session already cleared):', err?.message || err);
      }
      return { message: 'Logged out cleanly' };
    },
    me: () => request('/auth/me/'),
  },

  donors: {
    getProfile: (donorId) => request(`/donors/profile/${donorId ? `?donor_id=${donorId}` : ''}`),
    updateProfile: (data) => request('/donors/profile/', { method: 'PATCH', body: data }),
    listAdmin: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/donors/admin-list/${q ? `?${q}` : ''}`);
    },
  },

  search: {
    donors: (bloodGroup = '', district = '', city = '') => {
      const params = new URLSearchParams();
      if (bloodGroup) params.append('blood_group', bloodGroup);
      if (district) params.append('district', district);
      if (city) params.append('city', city);
      return request(`/search/?${params.toString()}`);
    },
  },

  inventory: {
    get: () => request('/inventory/'),
    getTransactions: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/inventory/transactions/${q ? `?${q}` : ''}`);
    },
  },

  donations: {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/donations/${q ? `?${q}` : ''}`);
    },
    create: (data) => request('/donations/', { method: 'POST', body: data }),
    verify: (id, status, notes = '', rejectionReason = '') =>
      request(`/donations/${id}/verify/`, {
        method: 'POST',
        body: { status, notes, rejection_reason: rejectionReason },
      }),
  },

  requests: {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/requests/${q ? `?${q}` : ''}`);
    },
    create: (data) => request('/requests/', { method: 'POST', body: data }),
    updateStatus: (id, targetStatus, adminRemarks = '') =>
      request(`/requests/${id}/update_status/`, {
        method: 'POST',
        body: { status: targetStatus, admin_remarks: adminRemarks },
      }),
  },

  admin: {
    getKPIs: () => request('/admin/dashboard/'),
    getAuditLogs: () => request('/admin/audit-logs/'),
  },

  health: () => request('/health/'),
};
