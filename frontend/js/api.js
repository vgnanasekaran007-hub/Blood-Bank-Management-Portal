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

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...options.headers,
  };

  // Attach token from localStorage for seamless cross-domain session handling
  const token = localStorage.getItem('lifepulse_auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const csrftoken = getCookie('csrftoken');
  if (csrftoken) {
    headers['X-CSRFToken'] = csrftoken;
  }

  const config = {
    ...options,
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
      const errorMsg = (data && (data.error || data.detail || (data.details && JSON.stringify(data.details))))
        || `Request failed with status ${response.status}`;
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
    console.error(`API Error on [${options.method || 'GET'} ${endpoint}]:`, err);
    throw err;
  }
}

export const api = {
  auth: {
    login: (username, password) => request('/auth/login/', { method: 'POST', body: { username, password } }),
    register: (userData) => request('/auth/register/', { method: 'POST', body: userData }),
    logout: async () => {
      try {
        await request('/auth/logout/', { method: 'POST' });
      } finally {
        localStorage.removeItem('lifepulse_auth_token');
      }
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
