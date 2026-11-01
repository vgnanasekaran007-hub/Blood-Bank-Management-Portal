import { api } from './api.js';
import { store } from './state.js';

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
  const sunIcon = document.getElementById('theme-icon-sun');
  const moonIcon = document.getElementById('theme-icon-moon');
  if (sunIcon && moonIcon) {
    if (theme === 'light') {
      sunIcon.style.display = 'block';
      moonIcon.style.display = 'none';
    } else {
      sunIcon.style.display = 'none';
      moonIcon.style.display = 'block';
    }
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
        <span class="ticker-pill ${isShortage ? 'shortage' : ''}">
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
        <div class="inventory-card">
          <div class="blood-group-tag">${item.blood_group}</div>
          <div class="units-num tabular-nums">${item.units_available}</div>
          <div class="units-label">Units Available</div>
          <span class="inventory-status-pill ${statusClass}">${statusLabel}</span>
          <div style="margin-top: 0.75rem; font-size: 0.75rem; color: var(--text-muted);">Min: ${item.min_threshold} units</div>
        </div>
      `;
    }).join('');

    const totalUnitsEl = document.getElementById('inventory-total-units');
    if (totalUnitsEl) totalUnitsEl.textContent = state.inventoryTotal;

    const heroUnitsEl = document.getElementById('stat-units-available');
    if (heroUnitsEl) heroUnitsEl.textContent = `${state.inventoryTotal} Units`;
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
        <h4 class="state-title">No Matching Donors Found</h4>
        <p class="state-desc">No active voluntary donors match the chosen blood group and district. You can submit an Emergency Blood Request directly to blood banks.</p>
        <button class="btn btn-primary" onclick="window.openRequestModal('${state.searchFilters.blood_group || 'O+'}')">
          Submit Emergency Request for ${state.searchFilters.blood_group || 'Blood'}
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = state.searchResults.map(donor => `
    <div class="donor-card">
      <div class="donor-card-top">
        <div class="donor-blood-badge">${donor.blood_group}</div>
        <div class="donor-meta" style="text-align: right;">
          <h4>${donor.display_name}</h4>
          <span class="donor-code">${donor.donor_code}</span>
        </div>
      </div>
      <div class="donor-details-list">
        <div class="donor-detail-item">
          <span>&#128205;</span> <span>${donor.district}, ${donor.city || donor.state}</span>
        </div>
        <div class="donor-detail-item">
          <span>&#128154;</span> <span>${donor.total_donations} Previous Donation(s)</span>
        </div>
        <div class="donor-detail-item">
          <span>&#128337;</span> <span>${donor.is_eligible ? 'Eligible to Donate' : 'Waiting Safe Interval'}</span>
        </div>
      </div>
      <div class="donor-privacy-note">
        &#128274; <em>Contact protected by privacy policy. Contact via verified blood request.</em>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="window.openRequestModal('${donor.blood_group}', '${donor.district}')">
        Request ${donor.blood_group} via Portal
      </button>
    </div>
  `).join('');
}

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
        <p class="state-desc">You are not registered as a voluntary blood donor yet. Join the registry to save lives.</p>
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

  // Also update hero stat banner if present
  const heroRegistered = document.getElementById('stat-registered-donors');
  if (heroRegistered && kpis.total_donors) {
    heroRegistered.textContent = `${kpis.total_donors}+`;
  }

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
// CENTRAL DATA REFRESH
// ==========================================
export async function refreshAllData() {
  try {
    const invRes = await api.inventory.get();
    store.set({
      inventory: invRes.inventory,
      inventoryTotal: invRes.total_units,
      criticalGroups: invRes.critical_groups,
    });

    const { blood_group, district, city } = store.state.searchFilters;
    const searchRes = await api.search.donors(blood_group, district, city);
    store.set({
      searchResults: searchRes.donors,
      searchSuggestion: searchRes.suggestion,
    });

    if (store.state.user) {
      if (store.state.role === 'admin') {
        const [kpiRes, adminReqs, adminDons, auditRes] = await Promise.all([
          api.admin.getKPIs(),
          api.requests.list(),
          api.donations.list(),
          api.admin.getAuditLogs(),
        ]);
        store.set({
          kpis: kpiRes.kpis,
          adminRequests: adminReqs.results || adminReqs,
          adminDonations: adminDons.results || adminDons,
          auditLogs: auditRes.logs || [],
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
  } catch (err) {
    console.error('Data refresh error:', err);
  }
}

// ==========================================
// GLOBAL EVENT HOOKS
// ==========================================
window.switchModule = function (moduleName) {
  store.setModule(moduleName);
  document.querySelectorAll('.app-module-section').forEach(el => el.classList.remove('active'));
  const target = document.getElementById(`module-${moduleName}`);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-link').forEach(el => {
    el.classList.toggle('active', el.dataset.module === moduleName);
  });
};

window.switchRole = async function (role) {
  // Close menu dropdown
  const dropdown = document.getElementById('role-menu-dropdown');
  if (dropdown) dropdown.classList.remove('show');

  try {
    if (role === 'admin') {
      await api.auth.login('admin', 'admin123');
      showToast('Logged in as Staff Administrator (Dr. Arumugam)', 'success');
    } else if (role === 'donor') {
      await api.auth.login('karthik_o_pos', 'donor123');
      showToast('Logged in as Voluntary Donor (Karthik Raman - O+)', 'success');
    } else if (role === 'requester') {
      await api.auth.login('requester1', 'req123');
      showToast('Logged in as Requester (Muthu Kumar)', 'success');
    } else {
      await api.auth.logout();
      showToast('Switched to Public View', 'info');
    }

    const authCheck = await api.auth.me();
    store.setUser(authCheck.user, authCheck.donor_profile);
    await refreshAllData();
    updateUIForAuth();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

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
};

window.openRegisterDonorModal = function () {
  const modal = document.getElementById('donor-register-modal');
  if (modal) modal.classList.add('open');
};

window.openLogDonationModal = function () {
  const modal = document.getElementById('log-donation-modal');
  if (modal) modal.classList.add('open');
};

window.fulfillBloodRequest = async function (requestId, bloodGroup, unitsNeeded) {
  if (!confirm(`Confirm atomic stock fulfillment for Request #${requestId}: Deduct ${unitsNeeded} unit(s) of ${bloodGroup}?`)) return;

  try {
    await api.requests.updateStatus(requestId, 'FULFILLED', 'Authorized and dispatched by blood bank staff.');
    showToast(`Request #${requestId} fulfilled! Stock decreased atomically.`, 'success');
    await refreshAllData();
  } catch (err) {
    showToast(`Fulfillment halted: ${err.message}`, 'error');
  }
};

window.updateRequestStatus = async function (requestId, newStatus) {
  const remark = prompt(`Enter optional remarks for status '${newStatus}':`, '');
  if (remark === null) return;

  try {
    await api.requests.updateStatus(requestId, newStatus, remark);
    showToast(`Request #${requestId} status updated to ${newStatus}`, 'success');
    await refreshAllData();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.cancelRequest = async function (requestId) {
  if (!confirm('Are you sure you want to cancel this blood request?')) return;
  try {
    await api.requests.updateStatus(requestId, 'CANCELLED', 'Cancelled by requester');
    showToast('Blood request cancelled.', 'info');
    await refreshAllData();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.verifyDonationRecord = async function (donationId, decision) {
  let notes = '';
  let reason = '';
  if (decision === 'REJECTED') {
    reason = prompt('Enter specific reason for rejecting this donation record:', 'Hemoglobin below clinical threshold (<12.5 g/dL)');
    if (!reason) return;
  } else {
    notes = prompt('Enter optional clinical verification notes:', 'Blood unit screened and verified normal.');
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

  if (userDisplay) {
    if (user) {
      userDisplay.textContent = `${user.first_name || user.username} (${role.toUpperCase()})`;
    } else {
      userDisplay.textContent = 'Public View';
    }
  }

  if (adminNav) {
    adminNav.style.display = role === 'admin' ? 'inline-flex' : 'none';
  }

  // Update active role menu items
  document.querySelectorAll('.role-menu-item').forEach(item => {
    item.classList.toggle('active', item.dataset.role === role);
  });
}

// ==========================================
// APPLICATION INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize theme
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

  // Hero blood selector buttons
  document.querySelectorAll('.blood-radio-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.blood-radio-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const bg = btn.dataset.blood;
      store.set({ searchFilters: { ...store.state.searchFilters, blood_group: bg } });
      refreshAllData();
    });
  });

  // District filter
  const districtSelect = document.getElementById('search-district-select');
  if (districtSelect) {
    districtSelect.addEventListener('change', (e) => {
      store.set({ searchFilters: { ...store.state.searchFilters, district: e.target.value } });
      refreshAllData();
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
        await api.requests.create(payload);
        showToast('Blood request submitted successfully!', 'success');
        window.closeModal('request-modal');
        reqForm.reset();
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
        locality: formData.get('locality'),
      };

      try {
        const res = await api.auth.register(payload);
        showToast('Registered as voluntary donor successfully!', 'success');
        window.closeModal('donor-register-modal');
        donorForm.reset();
        store.setUser(res.user);
        await refreshAllData();
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
        showToast('Donation record logged! Awaiting administrator verification.', 'success');
        window.closeModal('log-donation-modal');
        donationForm.reset();
        await refreshAllData();
      } catch (err) {
        showToast(`Failed to log donation: ${err.message}`, 'error');
      }
    });
  }

  // Initial authentication check
  try {
    const authCheck = await api.auth.me();
    store.setUser(authCheck.user, authCheck.donor_profile);
  } catch (err) {
    store.setUser(null, null);
  }

  // Load live data
  await refreshAllData();
  updateUIForAuth();
  console.log('LifePulse Portal Initialized in Precision Clinical Mode.');
});
