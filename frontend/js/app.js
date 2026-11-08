import { api } from './api.js';
import { store, filterBaselineDonors } from './state.js';

// Expose on window for runtime modules and testing
window.store = store;
window.api = api;

// Toast Notification
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'status');
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 200);
  }, 4000);
}

function formatDate(isoStr) {
  if (!isoStr) return 'N/A';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ==========================================
// THEME MANAGEMENT (DARK / BRIGHT MODE)
// ==========================================
function initTheme() {
  const storedTheme = localStorage.getItem('lifepulse_theme') || 'dark';
  applyTheme(storedTheme);

  const toggleBtn = document.getElementById('theme-toggle-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      applyTheme(newTheme);
      localStorage.setItem('lifepulse_theme', newTheme);
      showToast(`Switched to ${newTheme === 'dark' ? 'Dark' : 'Bright'} mode`, 'info');
    });
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const toggleBtn = document.getElementById('theme-toggle-btn');
  if (toggleBtn) {
    toggleBtn.setAttribute('title', theme === 'dark' ? 'Switch to Bright Mode' : 'Switch to Dark Mode');
    toggleBtn.setAttribute('aria-label', theme === 'dark' ? 'Switch to Bright Mode' : 'Switch to Dark Mode');
  }
}

// ==========================================
// RENDERERS FOR APPLICATION VIEWS
// ==========================================

// 1. Ticker & Inventory Grid
function renderTickerAndInventory(state) {
  const tickerWrap = document.getElementById('ticker-items');
  if (tickerWrap && state.inventory.length) {
    tickerWrap.innerHTML = state.inventory.map(item => {
      const isShortage = item.units_available <= item.min_threshold;
      return `
        <span class="ticker-pill ${isShortage ? 'shortage' : ''}" onclick="window.switchModule('inventory', true)" style="cursor: pointer;" title="Click to view ${item.blood_group} stock in inventory">
          <strong>${item.blood_group}:</strong> ${item.units_available} units
          ${isShortage ? '(Critical Shortage)' : ''}
        </span>
      `;
    }).join('');
  }

  const inventoryGrid = document.getElementById('inventory-matrix-grid');
  if (inventoryGrid && state.inventory.length) {
    inventoryGrid.innerHTML = state.inventory.map(item => {
      const statusClass = item.status === 'HEALTHY' ? 'healthy' : (item.status === 'LOW_STOCK' ? 'low' : 'critical');
      const statusLabel = item.status === 'HEALTHY' ? 'Adequate' : (item.status === 'LOW_STOCK' ? 'Low Stock' : 'Critical Depleted');
      return `
        <div class="inventory-card" onclick="window.openRequestModal('${item.blood_group}', 'Chennai')" style="cursor: pointer;" title="Click to request ${item.blood_group} units">
          <div class="blood-group-tag">${item.blood_group}</div>
          <div class="units-num tabular-nums">${item.units_available}</div>
          <div class="units-label">Units Available</div>
          <span class="inventory-status-pill ${statusClass}">${statusLabel}</span>
          <div style="margin-top: 0.75rem; font-size: 0.75rem; color: var(--text-muted);">Min: ${item.min_threshold} units &bull; Click to Request</div>
        </div>
      `;
    }).join('');

    const totalUnitsEl = document.getElementById('inventory-total-units');
    if (totalUnitsEl) totalUnitsEl.textContent = state.inventoryTotal;

    // Live Hero Stat Updates (Real Database Values)
    const heroUnitsEl = document.getElementById('stat-units-available');
    if (heroUnitsEl) heroUnitsEl.textContent = `${state.inventoryTotal} Units`;

    const heroDonorsEl = document.getElementById('stat-registered-donors');
    if (heroDonorsEl) heroDonorsEl.textContent = state.totalDonors ?? 0;

    const heroFulfilledEl = document.getElementById('stat-fulfilled-requests');
    if (heroFulfilledEl) heroFulfilledEl.textContent = state.fulfilledRequests ?? 0;
  }
}

// 2. Blood Group Search & Privacy-Masked Donor Cards
function renderSearchResults(state) {
  const container = document.getElementById('donor-search-results');
  const countEl = document.getElementById('search-results-count');
  const suggestionBox = document.getElementById('search-suggestion-box');

  if (!container) return;

  if (countEl) countEl.textContent = state.searchResults.length;

  if (suggestionBox) {
    if (state.searchSuggestion) {
      suggestionBox.style.display = 'block';
      suggestionBox.innerHTML = `<strong>Guidance:</strong> ${state.searchSuggestion}`;
    } else {
      suggestionBox.style.display = 'none';
    }
  }

  if (state.searchResults.length === 0) {
    container.innerHTML = `
      <div class="state-box" style="grid-column: 1 / -1;">
        <div class="state-icon">&#128269;</div>
        <h4 class="state-title">No Donors Registered Yet in this Area</h4>
        <p class="state-desc">No active voluntary donors are registered yet for the selected criteria. Be the first to register and save lives!</p>
        <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
          <button class="btn btn-primary" onclick="window.openRegisterDonorModal()">
            Register as Voluntary Donor
          </button>
          <button class="btn btn-secondary" onclick="window.openRequestModal('${state.searchFilters.blood_group || 'O+'}')">
            Submit Emergency Request
          </button>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = state.searchResults.map(donor => `
    <div class="donor-card">
      <div class="donor-card-top">
        <div class="donor-blood-badge">${donor.blood_group}</div>
        <div class="donor-meta-info">
          <h4 class="donor-name">${donor.display_name}</h4>
          <span class="donor-code">${donor.donor_code}</span>
        </div>
        <div class="donor-avatar-silhouette" aria-hidden="true">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a5 5 0 1 0 5 5 5 5 0 0 0-5-5zm0 12c-5.33 0-8 2.67-8 6v2h16v-2c0-3.33-2.67-6-8-6z"/>
          </svg>
        </div>
      </div>

      <div class="donor-details-list">
        <div class="donor-detail-item">
          <svg class="detail-icon icon-pin" width="16" height="16" viewBox="0 0 24 24" fill="#ff1a3c" stroke="none">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/>
          </svg>
          <span class="detail-text">${donor.district}, ${donor.city || donor.state || 'Tamil Nadu'}</span>
        </div>
        <div class="donor-detail-item">
          <svg class="detail-icon icon-check" width="16" height="16" viewBox="0 0 24 24" fill="#10b981" stroke="none">
            <circle cx="12" cy="12" r="10" fill="#10b981"/>
            <path d="m9 12 2 2 4-4" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
          <span class="detail-text">${donor.total_donations} Previous Donation(s)</span>
        </div>
        <div class="donor-detail-item">
          <svg class="detail-icon icon-drop" width="16" height="16" viewBox="0 0 24 24" fill="#ffffff" stroke="none">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
          </svg>
          <span class="detail-text">${donor.is_eligible ? 'Eligible to Donate' : 'Waiting Safe Interval'}</span>
        </div>
      </div>

      <div class="donor-privacy-note">
        <svg class="privacy-lock-icon" width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b" stroke="none">
          <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
        </svg>
        <span>Contact protected by privacy policy. Details via verified blood request.</span>
      </div>

      <button type="button" class="donor-card-request-btn" onclick="window.openRequestModal('${donor.blood_group}', '${donor.district}')" title="Request ${donor.blood_group} via Portal">
        <svg class="request-plane-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"/>
          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
        <span>Request ${donor.blood_group} via Portal</span>
        <svg class="request-arrow-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"/>
          <polyline points="12 5 19 12 12 19"/>
        </svg>
      </button>
    </div>
  `).join('');
}
window.renderSearchResults = renderSearchResults;

// 3. Donor Portal (Profile, Availability Switch, 90-day safe interval)
function renderDonorPortal(state) {
  const profile = state.donorProfile;
  const container = document.getElementById('donor-portal-view');
  if (!container) return;

  if (!profile) {
    container.innerHTML = `
      <div class="state-box">
        <div class="state-icon">&#129656;</div>
        <h4 class="state-title">Donor Registration Required</h4>
        <p class="state-desc">You are not registered as a voluntary blood donor yet. Register now to save lives and manage your availability.</p>
        <button class="btn btn-primary" onclick="window.openRegisterDonorModal()">Register as Voluntary Donor</button>
      </div>
    `;
    return;
  }

  const isEligible = profile.is_eligible;
  const days = profile.days_since_last_donation;

  container.innerHTML = `
    <div class="find-blood-card" style="margin-bottom: 2rem;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
        <div>
          <span class="hero-pill-badge">Registered Voluntary Donor</span>
          <h3>${profile.full_name || profile.username}</h3>
          <p style="color: var(--text-muted); font-size: 0.875rem;">Blood Group: <strong>${profile.blood_group}</strong> | Location: ${profile.district}, ${profile.city}</p>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 0.8125rem; font-weight: 600; margin-bottom: 0.35rem; color: var(--text-heading);">Availability Status:</div>
          <button id="toggle-availability-btn" class="btn ${profile.is_available ? 'btn-success' : 'btn-secondary'} btn-sm">
            ${profile.is_available ? '&#9679; Available for Emergency Call' : '&#9675; Currently Unavailable'}
          </button>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border-color);">
        <div class="stat-card">
          <div class="stat-title">Last Donation Date</div>
          <div class="stat-value" style="font-size: 1.25rem;">${formatDate(profile.last_donation_date)}</div>
          <div class="stat-subtext">${days !== null ? `${days} days ago` : 'First-time donor'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">Clinical Safe Interval</div>
          <div class="stat-value" style="font-size: 1.25rem; color: ${isEligible ? '#059669' : '#d97706'};">
            ${isEligible ? 'Eligible Now' : 'Resting Period'}
          </div>
          <div class="stat-subtext">${isEligible ? 'Standard 90-day interval fulfilled' : 'Minimum 90 days required between donations'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">Lifetime Donations</div>
          <div class="stat-value tabular-nums" style="font-size: 1.5rem;">${profile.total_donations}</div>
          <div class="stat-subtext">Verified life-saving units</div>
        </div>
      </div>

      <div style="margin-top: 1.5rem; display: flex; justify-content: flex-end; gap: 0.75rem;">
        <button class="btn btn-secondary btn-sm" onclick="window.openLogDonationModal()">Log Walk-in Donation</button>
      </div>
    </div>

    <!-- Personal Donation History -->
    <div class="section-head">
      <div class="section-head-title">
        <h3>My Donation Records</h3>
        <p>Official verified history of your blood contributions</p>
      </div>
    </div>
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Date</th>
              <th>Blood Group</th>
              <th>Units</th>
              <th>Center / Camp</th>
              <th>Verification Status</th>
            </tr>
          </thead>
          <tbody id="my-donations-table-body">
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Availability toggle
  const toggleBtn = document.getElementById('toggle-availability-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', async () => {
      try {
        const updated = await api.donors.updateProfile({ is_available: !profile.is_available });
        store.set({ donorProfile: updated.profile });
        showToast(`Availability set to: ${updated.profile.is_available ? 'Available' : 'Unavailable'}`, 'success');
        renderDonorPortal(store.state);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // Populate donor's personal donation table
  const tbody = document.getElementById('my-donations-table-body');
  if (tbody) {
    if (!state.myDonations.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">No donation records logged yet.</td></tr>`;
    } else {
      tbody.innerHTML = state.myDonations.map(d => {
        const statusBadge = d.status === 'VERIFIED'
          ? '<span class="badge badge-fulfilled">Verified & In Stock</span>'
          : (d.status === 'PENDING' ? '<span class="badge badge-review">Pending Staff Verification</span>' : '<span class="badge badge-rejected">Rejected</span>');
        return `
          <tr>
            <td class="tabular-nums">#DON-${d.id}</td>
            <td>${formatDate(d.donation_date)}</td>
            <td><strong style="color: var(--btn-primary);">${d.blood_group}</strong></td>
            <td class="tabular-nums">${d.units} unit</td>
            <td>${d.hospital_or_camp}</td>
            <td>${statusBadge}</td>
          </tr>
        `;
      }).join('');
    }
  }
}

// 4. Blood Requests Workflow (Requester & Staff View)
function renderRequestsWorkflow(state) {
  const container = document.getElementById('requests-table-body');
  if (!container) return;

  const requests = state.role === 'admin' ? state.adminRequests : state.myRequests;

  if (!requests.length) {
    container.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          No blood requests found. Click "+ New Emergency Blood Request" to create one.
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = requests.map(req => {
    let badgeClass = 'badge-submitted';
    if (req.status === 'UNDER_REVIEW') badgeClass = 'badge-review';
    if (req.status === 'APPROVED') badgeClass = 'badge-approved';
    if (req.status === 'FULFILLED') badgeClass = 'badge-fulfilled';
    if (req.status === 'REJECTED') badgeClass = 'badge-rejected';
    if (req.status === 'CANCELLED') badgeClass = 'badge-cancelled';

    let urgencyClass = 'badge-urgency-normal';
    if (req.urgency === 'URGENT') urgencyClass = 'badge-urgency-urgent';
    if (req.urgency === 'CRITICAL') urgencyClass = 'badge-urgency-critical';

    const isAdmin = state.role === 'admin';

    let actionButtons = '';
    if (isAdmin) {
      if (req.status === 'SUBMITTED') {
        actionButtons = `
          <button class="btn btn-secondary btn-sm" onclick="window.updateRequestStatus(${req.id}, 'UNDER_REVIEW')">Review</button>
          <button class="btn btn-success btn-sm" onclick="window.updateRequestStatus(${req.id}, 'APPROVED')">Approve</button>
          <button class="btn btn-danger btn-sm" onclick="window.updateRequestStatus(${req.id}, 'REJECTED')">Reject</button>
        `;
      } else if (req.status === 'UNDER_REVIEW') {
        actionButtons = `
          <button class="btn btn-success btn-sm" onclick="window.updateRequestStatus(${req.id}, 'APPROVED')">Approve</button>
          <button class="btn btn-danger btn-sm" onclick="window.updateRequestStatus(${req.id}, 'REJECTED')">Reject</button>
        `;
      } else if (req.status === 'APPROVED') {
        actionButtons = `
          <button class="btn btn-primary btn-sm" onclick="window.fulfillBloodRequest(${req.id}, '${req.blood_group}', ${req.units_needed})">
            Fulfill & Dispatch (${req.units_needed} units)
          </button>
        `;
      } else {
        actionButtons = `<span style="font-size: 0.75rem; color: var(--text-muted);">&#10003; Processed</span>`;
      }
    } else {
      if (req.status === 'SUBMITTED' || req.status === 'UNDER_REVIEW') {
        actionButtons = `
          <button class="btn btn-secondary btn-sm" onclick="window.cancelRequest(${req.id})">Cancel</button>
        `;
      } else {
        actionButtons = `<span style="font-size: 0.75rem; color: var(--text-muted);">${req.status}</span>`;
      }
    }

    return `
      <tr>
        <td class="tabular-nums">#REQ-${req.id}</td>
        <td>
          <strong style="color: var(--text-heading);">${req.patient_name}</strong>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${req.patient_age} yrs, ${req.patient_gender}</div>
        </td>
        <td><strong style="color: var(--btn-primary); font-size: 1rem;">${req.blood_group}</strong></td>
        <td class="tabular-nums"><strong>${req.units_needed}</strong> unit(s)</td>
        <td>
          <div>${req.hospital_name}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${req.district}</div>
        </td>
        <td><span class="badge ${urgencyClass}">${req.urgency}</span></td>
        <td><span class="badge ${badgeClass}">${req.status}</span></td>
        <td><div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">${actionButtons}</div></td>
      </tr>
    `;
  }).join('');
}

// 5. Admin Donation Verification Queue
function renderAdminDonationsQueue(state) {
  const container = document.getElementById('admin-donations-queue');
  if (!container) return;

  const donations = state.adminDonations || [];
  const pending = donations.filter(d => d.status === 'PENDING');

  if (!pending.length) {
    container.innerHTML = `
      <div class="state-box" style="padding: 1.5rem;">
        <p style="color: var(--text-muted); font-size: 0.875rem;">No pending donation records awaiting staff verification.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = pending.map(item => `
    <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.1rem; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
      <div>
        <div style="font-weight: 700; color: var(--text-heading);">
          ${item.donor_name} (<span style="color: var(--btn-primary);">${item.blood_group}</span> - ${item.units} unit)
        </div>
        <div style="font-size: 0.8125rem; color: var(--text-muted);">
          Date: ${formatDate(item.donation_date)} | Center: ${item.hospital_or_camp}
        </div>
        ${item.notes ? `<div style="font-size: 0.75rem; color: var(--text-body); margin-top: 0.25rem;"><em>"${item.notes}"</em></div>` : ''}
      </div>
      <div style="display: flex; gap: 0.5rem;">
        <button class="btn btn-success btn-sm" onclick="window.verifyDonationRecord(${item.id}, 'VERIFIED')">
          &#10003; Verify & Add to Stock
        </button>
        <button class="btn btn-danger btn-sm" onclick="window.verifyDonationRecord(${item.id}, 'REJECTED')">
          Reject
        </button>
      </div>
    </div>
  `).join('');
}

// 6. Admin Console: KPIs & Audit Logs
function renderAdminConsole(state) {
  if (state.role !== 'admin') return;

  const kpis = state.kpis || {};
  document.getElementById('kpi-total-donors').textContent = kpis.total_donors || 0;
  document.getElementById('kpi-active-donors').textContent = kpis.active_donors || 0;
  document.getElementById('kpi-total-units').textContent = kpis.total_units_in_stock || 0;
  document.getElementById('kpi-pending-donations').textContent = kpis.pending_donations || 0;
  document.getElementById('kpi-pending-requests').textContent = kpis.pending_requests || 0;
  document.getElementById('kpi-fulfilled-requests').textContent = kpis.fulfilled_requests || 0;

  const auditContainer = document.getElementById('admin-audit-logs-body');
  if (auditContainer && state.auditLogs) {
    auditContainer.innerHTML = state.auditLogs.map(log => `
      <tr>
        <td style="font-family: 'JetBrains Mono', monospace; font-size: 0.75rem;">${formatDate(log.created_at)}</td>
        <td><strong style="color: var(--text-heading);">${log.user_name}</strong></td>
        <td><span class="badge" style="background: var(--bg-secondary); color: var(--text-heading); border: 1px solid var(--border-color);">${log.action}</span></td>
        <td>${log.entity_type} #${log.entity_id}</td>
        <td style="font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: var(--text-muted); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${JSON.stringify(log.details)}
        </td>
      </tr>
    `).join('');
  }
}

// ==========================================
// SKELETON LOADERS & NETWORK RESILIENCE
// ==========================================
export function renderInventorySkeleton() {
  const inventoryGrid = document.getElementById('inventory-matrix-grid');
  if (!inventoryGrid) return;
  const groups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  inventoryGrid.innerHTML = groups.map(bg => `
    <div class="inventory-card skeleton-card" aria-hidden="true">
      <div class="blood-group-tag skeleton" style="width: 44px; height: 26px; border-radius: 8px; margin-bottom: 0.5rem;"></div>
      <div class="skeleton skeleton-num"></div>
      <div class="skeleton skeleton-text" style="width: 65%; margin: 0 auto 0.6rem; height: 11px;"></div>
      <div class="skeleton skeleton-pill"></div>
      <div class="skeleton skeleton-text" style="width: 80%; margin: 0.8rem auto 0; height: 9px;"></div>
    </div>
  `).join('');
}

export function renderSearchSkeleton() {
  const container = document.getElementById('donor-search-results');
  if (!container) return;
  container.innerHTML = Array(4).fill(0).map(() => `
    <div class="donor-card skeleton-card" aria-hidden="true">
      <div class="donor-card-top" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <div class="skeleton skeleton-badge" style="width: 42px; height: 42px; border-radius: 10px;"></div>
        <div style="flex: 1; display: flex; flex-direction: column; align-items: flex-end; gap: 0.4rem;">
          <div class="skeleton skeleton-text" style="width: 110px; height: 14px;"></div>
          <div class="skeleton skeleton-text" style="width: 70px; height: 10px;"></div>
        </div>
      </div>
      <div class="donor-details-list" style="margin-bottom: 1.25rem;">
        <div class="skeleton skeleton-text" style="width: 80%; height: 12px; margin-bottom: 0.5rem;"></div>
        <div class="skeleton skeleton-text" style="width: 60%; height: 12px; margin-bottom: 0.5rem;"></div>
        <div class="skeleton skeleton-text" style="width: 70%; height: 12px;"></div>
      </div>
      <div class="skeleton skeleton-btn" style="height: 38px; border-radius: 8px;"></div>
    </div>
  `).join('');
}

export function renderRequestsSkeleton() {
  const container = document.getElementById('requests-table-body');
  if (!container) return;
  container.innerHTML = Array(4).fill(0).map(() => `
    <tr class="skeleton-row" aria-hidden="true">
      <td><div class="skeleton skeleton-text" style="width: 55px; height: 14px;"></div></td>
      <td>
        <div class="skeleton skeleton-text" style="width: 120px; height: 14px; margin-bottom: 4px;"></div>
        <div class="skeleton skeleton-text" style="width: 75px; height: 10px;"></div>
      </td>
      <td><div class="skeleton skeleton-badge" style="width: 34px; height: 26px; border-radius: 6px;"></div></td>
      <td><div class="skeleton skeleton-text" style="width: 50px; height: 14px;"></div></td>
      <td>
        <div class="skeleton skeleton-text" style="width: 140px; height: 14px; margin-bottom: 4px;"></div>
        <div class="skeleton skeleton-text" style="width: 80px; height: 10px;"></div>
      </td>
      <td><div class="skeleton skeleton-pill" style="width: 65px; height: 22px;"></div></td>
      <td><div class="skeleton skeleton-pill" style="width: 75px; height: 22px;"></div></td>
      <td><div class="skeleton skeleton-btn" style="width: 80px; height: 28px; border-radius: 6px;"></div></td>
    </tr>
  `).join('');
}

export function renderOfflineState(containerId, title = 'Network Connection Issue', message = 'Unable to reach the LifePulse database server. Please check your internet connection.') {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `
    <div class="offline-state-card" style="grid-column: 1 / -1;">
      <div class="offline-icon-box">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="1" y1="1" x2="23" y2="23"></line>
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
          <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
          <line x1="12" y1="20" x2="12.01" y2="20"></line>
        </svg>
      </div>
      <h3 class="offline-state-title">${title}</h3>
      <p class="offline-state-desc">${message}</p>
      <button class="btn btn-primary" onclick="window.retryNetworkConnection()">
        &#128259; Reload with Live Data
      </button>
    </div>
  `;
}

function showOfflineBanner() {
  const banner = document.getElementById('network-offline-banner');
  if (banner) banner.style.display = 'block';
}

function hideOfflineBanner() {
  const banner = document.getElementById('network-offline-banner');
  if (banner) banner.style.display = 'none';
}

window.retryNetworkConnection = async function () {
  const spinner = document.getElementById('retry-spinner-icon');
  if (spinner) spinner.classList.add('spinning');

  showToast('Connecting to LifePulse server & reloading live records...', 'info');

  renderInventorySkeleton();
  renderSearchSkeleton();
  renderRequestsSkeleton();

  await new Promise(r => setTimeout(r, 500));

  const success = await refreshAllData({ showSkeleton: false });
  if (spinner) spinner.classList.remove('spinning');

  if (success) {
    showToast('Connection established! Live database state reloaded.', 'success');
  } else {
    showToast('Network issue persists. Please verify your connection.', 'error');
  }
};

function initNetworkMonitoring() {
  window.addEventListener('online', () => {
    hideOfflineBanner();
    showToast('Internet connection restored. Reloading data...', 'info');
    window.retryNetworkConnection();
  });

  window.addEventListener('offline', () => {
    showOfflineBanner();
    showToast('You are offline. Showing cached portal state.', 'warning');
  });

  if (!navigator.onLine) {
    showOfflineBanner();
  }
}

// ==========================================
// CENTRAL DATA REFRESH
// ==========================================
export async function refreshAllData(options = {}) {
  const { showSkeleton = false } = options;

  if (showSkeleton && (!store.state.inventory || !store.state.inventory.length)) {
    renderInventorySkeleton();
    renderSearchSkeleton();
    renderRequestsSkeleton();
  }

  // Ensure baseline data is visible matching current filters immediately
  const { blood_group, district, city } = store.state.searchFilters;
  const currentFiltered = filterBaselineDonors(store.state.allDonors, { blood_group, district, city });
  if (!store.state.searchResults || !store.state.searchResults.length) {
    store.set({ searchResults: currentFiltered });
    renderSearchResults(store.state);
  }
  if (!store.state.inventory || !store.state.inventory.length) {
    renderTickerAndInventory(store.state);
  }

  try {
    // Parallel high-performance data retrieval
    const [invRes, searchRes] = await Promise.all([
      api.inventory.get().catch(err => null),
      api.search.donors(blood_group, district, city).catch(err => null)
    ]);

    if (invRes && invRes.inventory && invRes.inventory.length) {
      store.set({
        inventory: invRes.inventory,
        inventoryTotal: invRes.total_units || 0,
        criticalGroups: invRes.critical_groups || [],
        totalDonors: invRes.total_donors || store.state.totalDonors,
        fulfilledRequests: invRes.fulfilled_requests || store.state.fulfilledRequests,
      });
      renderTickerAndInventory(store.state);
    }

    if (searchRes && Array.isArray(searchRes.donors) && searchRes.donors.length > 0) {
      store.set({
        searchResults: searchRes.donors,
        searchSuggestion: searchRes.suggestion,
      });
    } else {
      store.set({
        searchResults: currentFiltered,
        searchSuggestion: searchRes ? searchRes.suggestion : null,
      });
    }
    renderSearchResults(store.state);

    if (store.state.user) {
      if (store.state.role === 'admin') {
        const [kpiRes, adminReqs, adminDons, auditRes] = await Promise.all([
          api.admin.getKPIs(),
          api.requests.list(),
          api.donations.list(),
          api.admin.getAuditLogs(),
        ]);
        store.set({
          kpis: kpiRes.kpis || kpiRes,
          adminRequests: adminReqs.results || adminReqs,
          adminDonations: adminDons.results || adminDons,
          auditLogs: auditRes.logs || [],
          totalDonors: (kpiRes.kpis && kpiRes.kpis.total_donors) || store.state.totalDonors,
          fulfilledRequests: (kpiRes.kpis && kpiRes.kpis.fulfilled_requests) || store.state.fulfilledRequests,
        });
      } else {
        const [myReqs, myDons] = await Promise.all([
          api.requests.list(),
          api.donations.list(),
        ]);
        store.set({
          myRequests: myReqs.results || myReqs,
          myDonations: myDons.results || myDons,
        });

        if (store.state.donorProfile) {
          const donorRes = await api.donors.getProfile();
          store.set({ donorProfile: donorRes });
        }
      }
    }

    hideOfflineBanner();
    return true;
  } catch (err) {
    console.warn('Backend server waking up or syncing:', err.message || err);
    // Smooth fallback filtering without disrupting user view
    const fallbackFiltered = filterBaselineDonors(store.state.allDonors, { blood_group, district, city });
    store.set({ searchResults: fallbackFiltered });
    renderSearchResults(store.state);
    renderTickerAndInventory(store.state);
    return false;
  }
}

window.refreshAllData = refreshAllData;

// ==========================================
// GLOBAL EVENT HOOKS & NAVIGATION
// ==========================================
window.switchModule = function (moduleName, shouldScroll = true) {
  // Strict access guard: only authenticated staff administrators can access admin console
  if (moduleName === 'admin_console') {
    if (!store.state.user || store.state.role !== 'admin') {
      showToast('Staff Administrator authentication required to access Console.', 'warning');
      window.openLoginModal();
      return;
    }
  }

  store.setModule(moduleName);
  document.querySelectorAll('.app-module-section').forEach(el => el.classList.remove('active'));
  const target = document.getElementById(`module-${moduleName}`);
  if (target) {
    target.classList.add('active');
    if (shouldScroll) {
      const headerOffset = 90;
      const elementPosition = target.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  }

  // Synchronize desktop nav, mobile drawer nav, and mobile bottom nav
  document.querySelectorAll('.nav-link').forEach(el => {
    el.classList.toggle('active', el.dataset.module === moduleName);
  });
  document.querySelectorAll('.mobile-nav-link').forEach(el => {
    el.classList.toggle('active', el.dataset.module === moduleName);
  });
  document.querySelectorAll('.bottom-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.module === moduleName);
  });
};

// Mobile Drawer Navigation Controllers
window.toggleMobileMenu = function () {
  const drawer = document.getElementById('mobile-nav-drawer');
  const isOpen = drawer && drawer.classList.contains('open');
  if (isOpen) {
    window.closeMobileMenu();
  } else {
    window.openMobileMenu();
  }
};

window.openMobileMenu = function () {
  const drawer = document.getElementById('mobile-nav-drawer');
  const backdrop = document.getElementById('mobile-drawer-backdrop');
  const toggleBtn = document.getElementById('mobile-menu-toggle');
  const iconBurger = document.getElementById('icon-hamburger');
  const iconClose = document.getElementById('icon-close');

  if (drawer) drawer.classList.add('open');
  if (backdrop) backdrop.classList.add('open');
  if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
  if (iconBurger) iconBurger.style.display = 'none';
  if (iconClose) iconClose.style.display = 'block';
  document.body.style.overflow = 'hidden';
};

window.closeMobileMenu = function () {
  const drawer = document.getElementById('mobile-nav-drawer');
  const backdrop = document.getElementById('mobile-drawer-backdrop');
  const toggleBtn = document.getElementById('mobile-menu-toggle');
  const iconBurger = document.getElementById('icon-hamburger');
  const iconClose = document.getElementById('icon-close');

  if (drawer) drawer.classList.remove('open');
  if (backdrop) backdrop.classList.remove('open');
  if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
  if (iconBurger) iconBurger.style.display = 'block';
  if (iconClose) iconClose.style.display = 'none';
  document.body.style.overflow = '';
};

window.searchAvailabilityAndScroll = function () {
  const selectedBtn = document.querySelector('.blood-radio-btn.selected');
  const bg = selectedBtn ? selectedBtn.dataset.blood : '';
  const distSelect = document.getElementById('search-district-select');
  const dist = distSelect ? distSelect.value : '';

  // Update filters and immediately filter donors for instant response
  const filters = { ...store.state.searchFilters, blood_group: bg, district: dist };
  const filteredDonors = filterBaselineDonors(store.state.allDonors, filters);
  store.set({ searchFilters: filters, searchResults: filteredDonors });
  renderSearchResults(store.state);
  refreshAllData();

  // Switch to search module and smoothly scroll directly to "Find Donors & Available Blood" section
  window.switchModule('search', true);
  showToast(`Found ${filteredDonors.length} matching donors for ${bg || 'all groups'} in ${dist || 'Tamil Nadu'}.`, 'info');
};

window.switchRole = async function (role) {
  const dropdown = document.getElementById('role-menu-dropdown');
  if (dropdown) dropdown.classList.remove('show');

  try {
    if (role === 'admin') {
      if (store.state.user && store.state.role === 'admin') {
        window.switchModule('admin_console', true);
        showToast('Viewing Staff Administrator Console', 'info');
      } else {
        showToast('Please sign in with administrator credentials to access Staff Console.', 'warning');
        window.openLoginModal();
      }
    } else {
      await api.auth.logout();
      showToast('Switched to Public View', 'info');
      store.setUser(null, null);
      await refreshAllData();
      updateUIForAuth();
      populateChecksheetEdit();
      window.switchModule('search', true);
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.handleLogout = async function () {
  return window.switchRole('guest');
};

window.copyChecksheetLink = async function () {
  const url = `${window.location.origin}${window.location.pathname}#checksheet`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      showToast('Checksheet link copied to clipboard! You can share this link with real users/donors.', 'success');
      return;
    } catch (err) {
      // Fallback to custom popup prompt
    }
  }
  await window.showCustomPrompt({
    title: 'Checksheet <span class="popup-title-red">Link</span>',
    htmlMessage: 'Copy this checksheet link to share with voluntary blood donors:',
    defaultValue: url,
    okText: 'Done',
    cancelText: 'Close'
  });
};

window.setChecksheetMode = function (mode) {
  const newPanel = document.getElementById('checksheet-new-panel');
  const updatePanel = document.getElementById('checksheet-update-panel');
  const tabNew = document.getElementById('tab-checksheet-new');
  const tabUpdate = document.getElementById('tab-checksheet-update');

  if (mode === 'new') {
    if (newPanel) newPanel.style.display = 'block';
    if (updatePanel) updatePanel.style.display = 'none';
    if (tabNew) { tabNew.className = 'btn btn-primary'; }
    if (tabUpdate) { tabUpdate.className = 'btn btn-secondary'; }
  } else {
    if (newPanel) newPanel.style.display = 'none';
    if (updatePanel) updatePanel.style.display = 'block';
    if (tabNew) { tabNew.className = 'btn btn-secondary'; }
    if (tabUpdate) { tabUpdate.className = 'btn btn-primary'; }
    populateChecksheetEdit();
  }
};

window.toggleFirstTimeDonor = function (isFirstTime) {
  const dateInput = document.getElementById('cs-last-donation');
  if (dateInput) {
    if (isFirstTime) {
      dateInput.value = '';
      dateInput.disabled = true;
    } else {
      dateInput.disabled = false;
    }
  }
};

function populateChecksheetEdit() {
  const user = store.state.user;
  const profile = store.state.donorProfile;
  const promptBox = document.getElementById('checksheet-login-prompt');
  const formWrap = document.getElementById('checksheet-edit-form-wrap');

  if (!user || !profile) {
    if (promptBox) promptBox.style.display = 'block';
    if (formWrap) formWrap.style.display = 'none';
    return;
  }

  if (promptBox) promptBox.style.display = 'none';
  if (formWrap) formWrap.style.display = 'block';

  const nameEl = document.getElementById('cs-edit-donor-name');
  const groupEl = document.getElementById('cs-edit-blood-group');
  if (nameEl) nameEl.textContent = profile.full_name || user.first_name || user.username;
  if (groupEl) groupEl.textContent = profile.blood_group;

  const phoneInput = document.getElementById('cs-update-phone');
  if (phoneInput) phoneInput.value = profile.phone_number || '';

  const altPhoneInput = document.getElementById('cs-update-alt-phone');
  if (altPhoneInput) altPhoneInput.value = profile.alternate_phone || '';

  const distSelect = document.getElementById('cs-update-district');
  if (distSelect && profile.district) distSelect.value = profile.district;

  const cityInput = document.getElementById('cs-update-city');
  if (cityInput) cityInput.value = profile.city || '';

  const pinInput = document.getElementById('cs-update-pincode');
  if (pinInput) pinInput.value = profile.pincode || '';

  const dateInput = document.getElementById('cs-update-last-donation');
  if (dateInput && profile.last_donation_date) dateInput.value = profile.last_donation_date;

  const availSelect = document.getElementById('cs-update-availability');
  if (availSelect) availSelect.value = profile.is_available ? 'true' : 'false';
}

window.openRequestModal = function (bloodGroup = 'O+', district = 'Chennai') {
  const modal = document.getElementById('request-modal');
  if (!modal) return;
  document.getElementById('req-blood-group').value = bloodGroup;
  document.getElementById('req-district').value = district;
  modal.classList.add('open');
};

window.closeModal = function (modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('open');
  if (modalId === 'login-modal') {
    sessionStorage.setItem('lifepulse_guest_visited', 'true');
  }
};

window.continueAsPublicGuest = function () {
  sessionStorage.setItem('lifepulse_guest_visited', 'true');
  window.closeModal('login-modal');
  window.switchRole('guest');
  window.switchModule('search');
  showToast('Welcome to LifePulse! Browsing in Public View.', 'info');
};

window.openRegisterDonorModal = function () {
  const dropdown = document.getElementById('role-menu-dropdown');
  if (dropdown) dropdown.classList.remove('show');
  const modal = document.getElementById('donor-register-modal');
  if (modal) modal.classList.add('open');
};

window.switchToRegisterFromLogin = function () {
  window.closeModal('login-modal');
  window.openRegisterDonorModal();
};

window.toggleAuthPasswordVisibility = function () {
  const pwdInput = document.getElementById('login-password');
  const eyeIcon = document.getElementById('pwd-eye-icon');
  if (!pwdInput) return;
  if (pwdInput.type === 'password') {
    pwdInput.type = 'text';
    if (eyeIcon) {
      eyeIcon.innerHTML = '<path d="m2 2 20 20"/><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>';
    }
  } else {
    pwdInput.type = 'password';
    if (eyeIcon) {
      eyeIcon.innerHTML = '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>';
    }
  }
};

window.toggleRegPasswordVisibility = function () {
  const pwdInput = document.getElementById('reg-password');
  const eyeIcon = document.getElementById('reg-pwd-eye-icon');
  if (!pwdInput) return;
  if (pwdInput.type === 'password') {
    pwdInput.type = 'text';
    if (eyeIcon) {
      eyeIcon.innerHTML = '<path d="m2 2 20 20"/><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>';
    }
  } else {
    pwdInput.type = 'password';
    if (eyeIcon) {
      eyeIcon.innerHTML = '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>';
    }
  }
};

window.openLoginModal = function () {
  const dropdown = document.getElementById('role-menu-dropdown');
  if (dropdown) dropdown.classList.remove('show');
  const modal = document.getElementById('login-modal');
  if (modal) modal.classList.add('open');
};

window.openLogDonationModal = function () {
  const modal = document.getElementById('log-donation-modal');
  if (modal) modal.classList.add('open');
};

/**
 * Custom Glowing Crimson Popup Modal (Exact Clone of User Reference Image 2)
 * Eliminates all native browser confirm/prompt/alert dialogs.
 */
window.showCustomConfirm = function ({
  title = 'Confirm <span class="popup-title-red">Action</span>',
  message = '',
  htmlMessage = null,
  okText = 'OK',
  cancelText = 'Cancel',
  bloodBadge = null
} = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('custom-confirm-modal');
    if (!modal) {
      resolve(true);
      return;
    }

    const titleEl = document.getElementById('custom-popup-title');
    const msgEl = document.getElementById('custom-popup-message');
    const inputContainer = document.getElementById('custom-popup-input-container');
    const cancelBtn = document.getElementById('custom-popup-cancel-btn');
    const okBtn = document.getElementById('custom-popup-ok-btn');
    const closeBtn = document.getElementById('custom-popup-close-btn');
    const okTextEl = document.getElementById('custom-popup-ok-text');
    const cancelTextEl = document.getElementById('custom-popup-cancel-text');

    if (titleEl) titleEl.innerHTML = title;

    if (msgEl) {
      if (htmlMessage) {
        msgEl.innerHTML = htmlMessage;
      } else {
        let formatted = message;
        if (bloodBadge) {
          formatted = formatted.replace(bloodBadge, `<span class="popup-blood-badge">${bloodBadge}</span>`);
        }
        msgEl.innerHTML = formatted;
      }
    }

    if (inputContainer) inputContainer.style.display = 'none';
    if (cancelBtn) cancelBtn.style.display = 'inline-flex';
    if (okTextEl) okTextEl.textContent = okText;
    if (cancelTextEl) cancelTextEl.textContent = cancelText;

    modal.style.display = 'flex';
    modal.classList.add('open');

    function cleanup() {
      modal.classList.remove('open');
      modal.style.display = 'none';
      okBtn?.removeEventListener('click', onOk);
      cancelBtn?.removeEventListener('click', onCancel);
      closeBtn?.removeEventListener('click', onCancel);
      window.removeEventListener('keydown', onKey);
    }

    function onOk() {
      cleanup();
      resolve(true);
    }

    function onCancel() {
      cleanup();
      resolve(false);
    }

    function onKey(e) {
      if (e.key === 'Escape') onCancel();
      else if (e.key === 'Enter') onOk();
    }

    okBtn?.addEventListener('click', onOk);
    cancelBtn?.addEventListener('click', onCancel);
    closeBtn?.addEventListener('click', onCancel);
    window.addEventListener('keydown', onKey);
    okBtn?.focus();
  });
};

window.showCustomPrompt = function ({
  title = 'Action <span class="popup-title-red">Input</span>',
  message = '',
  htmlMessage = null,
  defaultValue = '',
  placeholder = 'Enter value...',
  okText = 'OK',
  cancelText = 'Cancel'
} = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('custom-confirm-modal');
    if (!modal) {
      resolve(defaultValue);
      return;
    }

    const titleEl = document.getElementById('custom-popup-title');
    const msgEl = document.getElementById('custom-popup-message');
    const inputContainer = document.getElementById('custom-popup-input-container');
    const inputEl = document.getElementById('custom-popup-input');
    const cancelBtn = document.getElementById('custom-popup-cancel-btn');
    const okBtn = document.getElementById('custom-popup-ok-btn');
    const closeBtn = document.getElementById('custom-popup-close-btn');
    const okTextEl = document.getElementById('custom-popup-ok-text');
    const cancelTextEl = document.getElementById('custom-popup-cancel-text');

    if (titleEl) titleEl.innerHTML = title;
    if (msgEl) msgEl.innerHTML = htmlMessage || message;
    if (inputContainer) inputContainer.style.display = 'block';
    if (inputEl) {
      inputEl.value = defaultValue;
      inputEl.placeholder = placeholder;
    }
    if (cancelBtn) cancelBtn.style.display = 'inline-flex';
    if (okTextEl) okTextEl.textContent = okText;
    if (cancelTextEl) cancelTextEl.textContent = cancelText;

    modal.style.display = 'flex';
    modal.classList.add('open');

    function cleanup() {
      modal.classList.remove('open');
      modal.style.display = 'none';
      okBtn?.removeEventListener('click', onOk);
      cancelBtn?.removeEventListener('click', onCancel);
      closeBtn?.removeEventListener('click', onCancel);
      window.removeEventListener('keydown', onKey);
    }

    function onOk() {
      const val = inputEl ? inputEl.value : '';
      cleanup();
      resolve(val);
    }

    function onCancel() {
      cleanup();
      resolve(null);
    }

    function onKey(e) {
      if (e.key === 'Escape') onCancel();
      else if (e.key === 'Enter') onOk();
    }

    okBtn?.addEventListener('click', onOk);
    cancelBtn?.addEventListener('click', onCancel);
    closeBtn?.addEventListener('click', onCancel);
    window.addEventListener('keydown', onKey);
    setTimeout(() => {
      inputEl?.focus();
      inputEl?.select();
    }, 60);
  });
};

window.showCustomAlert = function ({
  title = 'System <span class="popup-title-red">Notice</span>',
  message = '',
  htmlMessage = null,
  okText = 'OK'
} = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('custom-confirm-modal');
    if (!modal) {
      resolve();
      return;
    }

    const titleEl = document.getElementById('custom-popup-title');
    const msgEl = document.getElementById('custom-popup-message');
    const inputContainer = document.getElementById('custom-popup-input-container');
    const cancelBtn = document.getElementById('custom-popup-cancel-btn');
    const okBtn = document.getElementById('custom-popup-ok-btn');
    const closeBtn = document.getElementById('custom-popup-close-btn');
    const okTextEl = document.getElementById('custom-popup-ok-text');

    if (titleEl) titleEl.innerHTML = title;
    if (msgEl) msgEl.innerHTML = htmlMessage || message;
    if (inputContainer) inputContainer.style.display = 'none';
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (okTextEl) okTextEl.textContent = okText;

    modal.style.display = 'flex';
    modal.classList.add('open');

    function cleanup() {
      modal.classList.remove('open');
      modal.style.display = 'none';
      okBtn?.removeEventListener('click', onOk);
      closeBtn?.removeEventListener('click', onOk);
      window.removeEventListener('keydown', onKey);
    }

    function onOk() {
      cleanup();
      resolve();
    }

    function onKey(e) {
      if (e.key === 'Escape' || e.key === 'Enter') onOk();
    }

    okBtn?.addEventListener('click', onOk);
    closeBtn?.addEventListener('click', onOk);
    window.addEventListener('keydown', onKey);
    okBtn?.focus();
  });
};

// Global fallback override for alert
window.alert = function (msg) {
  window.showCustomAlert({ message: String(msg) });
};

window.fulfillBloodRequest = async function (requestId, bloodGroup, unitsNeeded, skipConfirm = false) {
  if (!skipConfirm) {
    const confirmed = await window.showCustomConfirm({
      title: 'Confirm <span class="popup-title-red">Action</span>',
      htmlMessage: `Confirm atomic stock fulfillment for <strong>Request #${requestId}</strong>:<br>Deduct <strong>${unitsNeeded} units</strong> of <span class="popup-blood-badge">${bloodGroup}</span>`,
      okText: 'OK',
      cancelText: 'Cancel'
    });
    if (!confirmed) return;
  }

  try {
    await api.requests.updateStatus(requestId, 'FULFILLED', 'Authorized and dispatched by blood bank staff.');
    showToast(`Request #${requestId} fulfilled! Stock decreased atomically.`, 'success');
    await refreshAllData();
  } catch (err) {
    showToast(`Fulfillment halted: ${err.message}`, 'error');
  }
};

window.updateRequestStatus = async function (requestId, newStatus, optionalRemark) {
  let remark = optionalRemark;
  if (optionalRemark === undefined) {
    remark = await window.showCustomPrompt({
      title: `Update <span class="popup-title-red">Status (${newStatus})</span>`,
      htmlMessage: `Enter optional remarks or clinical notes for updating Request <strong>#${requestId}</strong> to <strong>${newStatus}</strong>:`,
      defaultValue: '',
      placeholder: 'e.g. Authorized and dispatched by staff...',
      okText: 'Update Status',
      cancelText: 'Cancel'
    });
    if (remark === null) return;
  }

  try {
    await api.requests.updateStatus(requestId, newStatus, remark);
    showToast(`Request #${requestId} status updated to ${newStatus}`, 'success');
    await refreshAllData();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.cancelRequest = async function (requestId) {
  const confirmed = await window.showCustomConfirm({
    title: 'Confirm <span class="popup-title-red">Cancellation</span>',
    htmlMessage: `Are you sure you want to cancel blood request <strong>#${requestId}</strong>? This action will mark the request as CANCELLED.`,
    okText: 'Cancel Request',
    cancelText: 'Keep Request'
  });
  if (!confirmed) return;

  try {
    await api.requests.updateStatus(requestId, 'CANCELLED', 'Cancelled by requester');
    showToast('Blood request cancelled.', 'info');
    await refreshAllData();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.verifyDonationRecord = async function (donationId, decision, optionalNotes, optionalReason) {
  let notes = optionalNotes !== undefined ? optionalNotes : '';
  let reason = optionalReason !== undefined ? optionalReason : '';
  if (decision === 'REJECTED' && optionalReason === undefined) {
    reason = await window.showCustomPrompt({
      title: 'Clinical <span class="popup-title-red">Rejection Reason</span>',
      htmlMessage: `Enter specific medical or clinical reason for rejecting donation record <strong>#${donationId}</strong>:`,
      defaultValue: 'Hemoglobin below clinical threshold (<12.5 g/dL)',
      placeholder: 'Specify rejection criteria...',
      okText: 'Confirm Rejection',
      cancelText: 'Cancel'
    });
    if (!reason) return;
  } else if (decision === 'VERIFIED' && optionalNotes === undefined) {
    notes = await window.showCustomPrompt({
      title: 'Clinical <span class="popup-title-red">Verification Notes</span>',
      htmlMessage: `Enter optional clinical screening notes for verified donation unit <strong>#${donationId}</strong>:`,
      defaultValue: 'Blood unit screened and verified normal.',
      placeholder: 'Screening lab notes...',
      okText: 'Approve & Stock',
      cancelText: 'Cancel'
    });
    if (notes === null) return;
  }

  try {
    await api.donations.verify(donationId, decision, notes, reason);
    showToast(`Donation #${donationId} marked ${decision}! ${decision === 'VERIFIED' ? 'Stock incremented.' : ''}`, 'success');
    await refreshAllData();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

function updateUIForAuth() {
  const { user, role } = store.state;
  const userDisplay = document.getElementById('user-session-display');
  const adminNav = document.getElementById('nav-admin-console');
  const signoutBtn = document.getElementById('menu-signout-btn');

  if (userDisplay) {
    if (user) {
      userDisplay.textContent = `${user.first_name || user.username} (${role.toUpperCase()})`;
      if (signoutBtn) signoutBtn.style.display = 'flex';
    } else {
      userDisplay.textContent = 'Public View';
      if (signoutBtn) signoutBtn.style.display = 'none';
    }
  }

  if (adminNav) {
    adminNav.style.display = role === 'admin' ? 'inline-flex' : 'none';
  }

  const mobileAdminNav = document.getElementById('mobile-nav-admin');
  if (mobileAdminNav) {
    mobileAdminNav.style.display = role === 'admin' ? 'block' : 'none';
  }

  const staffBadge = document.getElementById('staff-name-badge');
  if (staffBadge) {
    if (user && role === 'admin') {
      staffBadge.textContent = `Logged in as Staff Administrator (${user.first_name || user.username})`;
    } else {
      staffBadge.textContent = 'Logged in as Staff Administrator';
    }
  }

  // Update active role menu items
  document.querySelectorAll('.role-menu-item').forEach(item => {
    item.classList.toggle('active', item.dataset.role === role);
  });

  // Strict access guard: non-admin users cannot remain on admin console
  if (role !== 'admin' && store.state.activeModule === 'admin_console') {
    window.switchModule('search');
  }
}

window.updateUIForAuth = updateUIForAuth;

// ==========================================
// CUSTOM DISTRICT SELECTOR (Hover highlights cursor position; click selects only)
// ==========================================
function initCustomDistrictDropdown() {
  const wrapper = document.getElementById('custom-district-wrapper');
  const trigger = document.getElementById('custom-district-trigger');
  const dropdown = document.getElementById('custom-district-dropdown');
  const label = document.getElementById('search-district-label');
  const listEl = document.getElementById('custom-district-list');
  const searchInput = document.getElementById('custom-district-search');
  const clearBtn = document.getElementById('district-clear-search-btn');
  const nameDisplay = document.getElementById('custom-district-selected-name');
  const nativeSelect = document.getElementById('search-district-select');

  if (!wrapper || !trigger || !dropdown || !listEl || !nativeSelect) return;

  const options = Array.from(nativeSelect.options).map(opt => ({
    value: opt.value,
    text: opt.text,
    selected: opt.selected
  }));

  let currentSelectedValue = nativeSelect.value || 'Chennai';

  function renderList(filterQuery = '') {
    const q = filterQuery.trim().toLowerCase();
    const filtered = options.filter(opt => opt.text.toLowerCase().includes(q));

    listEl.innerHTML = '';
    if (filtered.length === 0) {
      const emptyLi = document.createElement('li');
      emptyLi.className = 'custom-district-empty';
      emptyLi.textContent = 'No matching districts found';
      listEl.appendChild(emptyLi);
      return;
    }

    filtered.forEach(opt => {
      const li = document.createElement('li');
      li.className = 'custom-district-item';
      li.setAttribute('role', 'option');
      li.setAttribute('data-value', opt.value);
      if (opt.value === currentSelectedValue) {
        li.classList.add('is-selected');
        li.setAttribute('aria-selected', 'true');
      }

      li.innerHTML = `
        <span>${opt.text}</span>
        <svg class="item-check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      `;

      // Visual hover highlight follows cursor position without auto-selecting
      li.addEventListener('pointerenter', () => {
        listEl.querySelectorAll('.custom-district-item').forEach(i => i.classList.remove('cursor-pointed'));
        li.classList.add('cursor-pointed');
      });

      // ONLY on explicit user click: finalize selection
      li.addEventListener('click', (e) => {
        e.stopPropagation();
        selectDistrict(opt.value, opt.text);
        closeDropdown();
      });

      listEl.appendChild(li);
    });
  }

  function selectDistrict(val, labelText) {
    currentSelectedValue = val;
    if (nameDisplay) {
      nameDisplay.textContent = labelText || (val ? val : 'All 38 Districts (Statewide)');
    }
    if (nativeSelect.value !== val) {
      nativeSelect.value = val;
      nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    listEl.querySelectorAll('.custom-district-item').forEach(item => {
      const isMatch = item.getAttribute('data-value') === val;
      item.classList.toggle('is-selected', isMatch);
      item.setAttribute('aria-selected', isMatch ? 'true' : 'false');
    });
  }

  function openDropdown() {
    wrapper.classList.add('is-open');
    dropdown.removeAttribute('hidden');
    trigger.setAttribute('aria-expanded', 'true');
    renderList(searchInput ? searchInput.value : '');

    requestAnimationFrame(() => {
      const selectedItem = listEl.querySelector('.custom-district-item.is-selected');
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
      if (window.innerWidth > 768 && searchInput) {
        searchInput.focus();
      }
    });
  }

  function closeDropdown() {
    wrapper.classList.remove('is-open');
    dropdown.setAttribute('hidden', '');
    trigger.setAttribute('aria-expanded', 'false');
    if (searchInput) searchInput.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
  }

  function toggleDropdown() {
    if (wrapper.classList.contains('is-open')) {
      closeDropdown();
    } else {
      openDropdown();
    }
  }

  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleDropdown();
  });

  if (label) {
    label.addEventListener('click', (e) => {
      e.preventDefault();
      trigger.focus();
      openDropdown();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value;
      if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';
      renderList(q);
    });

    searchInput.addEventListener('click', (e) => e.stopPropagation());
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeDropdown();
        trigger.focus();
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      searchInput.value = '';
      clearBtn.style.display = 'none';
      renderList('');
      searchInput.focus();
    });
  }

  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) {
      closeDropdown();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && wrapper.classList.contains('is-open')) {
      closeDropdown();
      trigger.focus();
    }
  });

  const initialOpt = options.find(o => o.selected) || options.find(o => o.value === 'Chennai');
  if (initialOpt) {
    selectDistrict(initialOpt.value, initialOpt.text);
  }
}
window.initCustomDistrictDropdown = initCustomDistrictDropdown;

// ==========================================
// APPLICATION INITIALIZATION
// ==========================================
async function initLifePulseApp() {
  initTheme();

  // Role menu dropdown toggle
  const roleTrigger = document.getElementById('role-menu-trigger');
  const roleDropdown = document.getElementById('role-menu-dropdown');
  if (roleTrigger && roleDropdown) {
    roleTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      roleDropdown.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!roleTrigger.contains(e.target) && !roleDropdown.contains(e.target)) {
        roleDropdown.classList.remove('show');
      }
    });
  }

  // Subscribe UI renders to state updates
  store.subscribe((state) => {
    renderTickerAndInventory(state);
    renderSearchResults(state);
    renderDonorPortal(state);
    renderRequestsWorkflow(state);
    renderAdminDonationsQueue(state);
    renderAdminConsole(state);
    updateUIForAuth();
  });

  // Hero blood selector buttons (Exact match of Reference Image 4 with checkmark)
  document.querySelectorAll('.blood-radio-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.blood-radio-btn').forEach(b => {
        b.classList.remove('selected');
        const oldCheck = b.querySelector('.bg-selected-checkmark');
        if (oldCheck) oldCheck.remove();
      });
      btn.classList.add('selected');
      if (!btn.querySelector('.bg-selected-checkmark')) {
        const checkmark = document.createElement('span');
        checkmark.className = 'bg-selected-checkmark';
        checkmark.setAttribute('aria-hidden', 'true');
        checkmark.innerHTML = `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#cf0022" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        btn.appendChild(checkmark);
      }
      const bg = btn.dataset.blood;
      store.set({ searchFilters: { ...store.state.searchFilters, blood_group: bg } });
      refreshAllData();
    });
  });

  // District filter & custom accessible selector
  const districtSelect = document.getElementById('search-district-select');
  if (districtSelect) {
    districtSelect.addEventListener('change', (e) => {
      store.set({ searchFilters: { ...store.state.searchFilters, district: e.target.value } });
      refreshAllData();
    });
  }
  initCustomDistrictDropdown();

  // Account login form (High-performance instant sign-in)
  const loginForm = document.getElementById('account-login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = loginForm.querySelector('button[type="submit"]') || loginForm.querySelector('.auth-primary-submit');
      const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
      
      const formData = new FormData(loginForm);
      const username = formData.get('username');
      const password = formData.get('password');

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
          <span class="auth-btn-spinner" aria-hidden="true"></span>
          <span>Signing In...</span>
        `;
      }

      try {
        const res = await api.auth.login(username, password);

        // 1. Instant UI update & modal dismissal
        showToast(`Welcome back, ${res.user.first_name || res.user.username}!`, 'success');
        window.closeModal('login-modal');
        loginForm.reset();

        // 2. Immediately store credentials & switch views with 0ms delay
        store.setUser(res.user, res.donor_profile || null);
        updateUIForAuth();

        if (store.state.role === 'admin' || (store.isAdmin && store.isAdmin())) {
          window.switchModule('admin_console');
        } else if (store.state.role === 'donor' || (store.isDonor && store.isDonor())) {
          window.switchModule('donor_portal');
        }

        // 3. Fast asynchronous background data synchronization (non-blocking)
        refreshAllData().catch(err => console.warn('Background data sync:', err));
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnHtml;
        }
      }
    });
  }

  // Emergency request form
  const reqForm = document.getElementById('emergency-request-form');
  if (reqForm) {
    reqForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(reqForm);
      const payload = {
        patient_name: formData.get('patient_name'),
        patient_age: parseInt(formData.get('patient_age'), 10),
        patient_gender: formData.get('patient_gender'),
        blood_group: formData.get('blood_group'),
        units_needed: parseInt(formData.get('units_needed'), 10),
        hospital_name: formData.get('hospital_name'),
        hospital_address: formData.get('hospital_address'),
        city: formData.get('city'),
        district: formData.get('district'),
        contact_person: formData.get('contact_person'),
        contact_phone: formData.get('contact_phone'),
        urgency: formData.get('urgency'),
        medical_reason: formData.get('medical_reason'),
        required_by_date: formData.get('required_by_date'),
      };

      try {
        const res = await api.requests.create(payload);
        showToast('Blood request submitted successfully to database!', 'success');
        window.closeModal('request-modal');
        reqForm.reset();

        if (res.user && !store.state.user) {
          store.setUser(res.user);
          updateUIForAuth();
        }

        await refreshAllData();
        window.switchModule('requests');
      } catch (err) {
        showToast(`Request failed: ${err.message}`, 'error');
      }
    });
  }

  // Donor registration form
  const donorForm = document.getElementById('donor-register-form');
  if (donorForm) {
    donorForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(donorForm);
      const payload = {
        username: formData.get('username'),
        email: formData.get('email'),
        password: formData.get('password'),
        full_name: formData.get('full_name'),
        role: 'donor',
        phone_number: formData.get('phone_number'),
        blood_group: formData.get('blood_group'),
        gender: formData.get('gender'),
        date_of_birth: formData.get('date_of_birth'),
        city: formData.get('city'),
        district: formData.get('district'),
        locality: formData.get('city'),
      };

      try {
        const res = await api.auth.register(payload);
        showToast('Donor profile registered and saved to database!', 'success');
        window.closeModal('donor-register-modal');
        donorForm.reset();

        store.setUser(res.user, res.donor_profile || null);
        await refreshAllData();
        updateUIForAuth();
        window.switchModule('donor_portal');
      } catch (err) {
        showToast(`Registration failed: ${err.message}`, 'error');
      }
    });
  }

  // Log donation form
  const donationForm = document.getElementById('log-donation-form');
  if (donationForm) {
    donationForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(donationForm);
      const payload = {
        blood_group: formData.get('blood_group'),
        units: parseInt(formData.get('units'), 10),
        donation_date: formData.get('donation_date'),
        hospital_or_camp: formData.get('hospital_or_camp'),
        notes: formData.get('notes'),
      };

      try {
        await api.donations.create(payload);
        showToast('Donation record saved to database! Awaiting staff verification.', 'success');
        window.closeModal('log-donation-modal');
        donationForm.reset();
        await refreshAllData();
      } catch (err) {
        showToast(`Failed to log donation: ${err.message}`, 'error');
      }
    });
  }

  // Checksheet - New Donor Registration
  const csRegForm = document.getElementById('checksheet-register-form');
  if (csRegForm) {
    csRegForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(csRegForm);
      const payload = {
        username: formData.get('username'),
        email: formData.get('email'),
        password: formData.get('password'),
        full_name: formData.get('full_name'),
        role: 'donor',
        phone_number: formData.get('phone_number'),
        blood_group: formData.get('blood_group'),
        gender: formData.get('gender'),
        date_of_birth: formData.get('date_of_birth'),
        city: formData.get('city'),
        district: formData.get('district'),
        pincode: formData.get('pincode'),
        last_donation_date: formData.get('last_donation_date') || null,
        is_available: formData.get('is_available') === 'true',
      };

      try {
        const res = await api.auth.register(payload);
        showToast('Donor checksheet saved directly to database!', 'success');
        csRegForm.reset();
        const authCheck = await api.auth.me();
        store.setUser(authCheck.user, authCheck.donor_profile);
        await refreshAllData();
        updateUIForAuth();
        populateChecksheetEdit();
        window.setChecksheetMode('update');
      } catch (err) {
        showToast(`Checksheet submission failed: ${err.message}`, 'error');
      }
    });
  }

  // Checksheet - Sign in to load existing record
  const csLoginForm = document.getElementById('checksheet-quick-login-form');
  if (csLoginForm) {
    csLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('cs-login-username').value;
      const password = document.getElementById('cs-login-password').value;
      const submitBtn = csLoginForm.querySelector('button[type="submit"]');
      const origBtnHtml = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="auth-btn-spinner"></span> Signing In...';
      }
      try {
        const loginData = await api.auth.login(username, password);
        store.setUser(loginData.user, loginData.donor_profile);
        showToast(`Welcome! Loaded details for ${loginData.user.first_name || loginData.user.username}`, 'success');
        updateUIForAuth();
        populateChecksheetEdit();
        // Non-blocking background sync
        refreshAllData().catch(console.error);
      } catch (err) {
        showToast(`Sign in failed: ${err.message}`, 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = origBtnHtml;
        }
      }
    });
  }

  // Checksheet - Update existing details
  const csUpdateForm = document.getElementById('checksheet-update-form');
  if (csUpdateForm) {
    csUpdateForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(csUpdateForm);
      const payload = {
        phone_number: formData.get('phone_number'),
        alternate_phone: formData.get('alternate_phone'),
        district: formData.get('district'),
        city: formData.get('city'),
        pincode: formData.get('pincode'),
        last_donation_date: formData.get('last_donation_date') || null,
        is_available: formData.get('is_available') === 'true',
      };

      try {
        await api.donors.updateProfile(payload);
        showToast('Donor details updated and saved to database successfully!', 'success');
        const authCheck = await api.auth.me();
        store.setUser(authCheck.user, authCheck.donor_profile);
        await refreshAllData();
        updateUIForAuth();
        populateChecksheetEdit();
      } catch (err) {
        showToast(`Update failed: ${err.message}`, 'error');
      }
    });
  }

  // Initialize Network Connectivity & Offline Monitoring
  initNetworkMonitoring();

  // Instant render of baseline stock & donors for immediate zero-latency feedback
  renderTickerAndInventory(store.state);
  renderSearchResults(store.state);

  // First entrance: directly prompt Sign In modal immediately if unauthenticated
  const hasStoredToken = !!localStorage.getItem('access_token') || !!localStorage.getItem('token');
  const hasChosenGuest = sessionStorage.getItem('lifepulse_guest_visited');
  if (!hasStoredToken && !hasChosenGuest) {
    window.openLoginModal();
  }

  // Initial authentication check & background data refresh
  (async () => {
    if (hasStoredToken) {
      try {
        const authCheck = await api.auth.me();
        store.setUser(authCheck.user, authCheck.donor_profile);
      } catch (err) {
        store.setUser(null, null);
      }
    } else {
      store.setUser(null, null);
    }

    // Refresh live database data silently in background
    await refreshAllData({ showSkeleton: false });
    updateUIForAuth();
    populateChecksheetEdit();
  })();

  // Hash-based direct link routing (#checksheet, #inventory, etc.)
  function handleHashRoute() {
    const hash = window.location.hash.toLowerCase();
    if (hash === '#checksheet' || hash === '#register') {
      window.switchModule('checksheet');
    } else if (hash === '#inventory') {
      window.switchModule('inventory');
    } else if (hash === '#requests') {
      window.switchModule('requests');
    } else if (hash === '#portal' || hash === '#donor') {
      window.switchModule('donor_portal');
    } else if (hash === '#admin' || hash === '#console') {
      if (store.state.user && store.state.role === 'admin') {
        window.switchModule('admin_console');
      } else {
        window.switchModule('search');
        showToast('Staff Administrator authentication required to enter Console.', 'warning');
        window.openLoginModal();
      }
    }
  }

  window.addEventListener('hashchange', handleHashRoute);
  handleHashRoute();

  console.log('LifePulse Portal Initialized in Real Working Model Mode.');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLifePulseApp);
} else {
  initLifePulseApp();
}
