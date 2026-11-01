/**
 * Application State Store
 * Manages active user session, role view switching, current module tab, and cached records.
 */

class AppStore {
  constructor() {
    this.state = {
      user: null,
      donorProfile: null,
      role: 'guest', // 'admin' | 'donor' | 'requester' | 'guest'
      activeModule: 'search', // 'search' | 'inventory' | 'requests' | 'donor_portal' | 'admin_console'
      inventory: [],
      inventoryTotal: 0,
      criticalGroups: [],
      searchFilters: { blood_group: '', district: '', city: '' },
      searchResults: [],
      myRequests: [],
      adminRequests: [],
      myDonations: [],
      adminDonations: [],
      kpis: {},
      auditLogs: [],
      isLoading: false,
    };
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(changeType) {
    for (const listener of this.listeners) {
      listener(this.state, changeType);
    }
  }

  set(partial) {
    this.state = { ...this.state, ...partial };
    this.notify('update');
  }

  setUser(user, donorProfile = null) {
    let role = 'guest';
    if (user) {
      role = user.role || (donorProfile ? 'donor' : 'requester');
    }
    this.state.user = user;
    this.state.donorProfile = donorProfile;
    this.state.role = role;
    this.notify('auth');
  }

  setModule(moduleName) {
    this.state.activeModule = moduleName;
    this.notify('navigation');
  }
}

export const store = new AppStore();
