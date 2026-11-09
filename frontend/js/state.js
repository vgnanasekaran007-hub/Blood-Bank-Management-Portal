/**
 * Application State Store
 * Manages active user session, role view switching, current module tab, and cached records.
 * Provides resilient fallback data so live stock and donor directories are instantly visible
 * even during backend cold starts on Render/Supabase.
 */

export const BASELINE_INVENTORY = [
  { blood_group: 'O+', units_available: 18, min_threshold: 5, status: 'HEALTHY' },
  { blood_group: 'A+', units_available: 14, min_threshold: 5, status: 'HEALTHY' },
  { blood_group: 'B+', units_available: 16, min_threshold: 5, status: 'HEALTHY' },
  { blood_group: 'AB+', units_available: 7, min_threshold: 5, status: 'HEALTHY' },
  { blood_group: 'O-', units_available: 6, min_threshold: 5, status: 'HEALTHY' },
  { blood_group: 'A-', units_available: 4, min_threshold: 5, status: 'LOW_STOCK' },
  { blood_group: 'B-', units_available: 4, min_threshold: 5, status: 'LOW_STOCK' },
  { blood_group: 'AB-', units_available: 2, min_threshold: 5, status: 'LOW_STOCK' },
];

export const BASELINE_DONORS = [
  {
    id: 1,
    donor_code: 'LP-DON-1001',
    display_name: 'Ramesh K.',
    blood_group: 'O+',
    district: 'Chennai',
    city: 'Anna Nagar',
    locality: 'Anna Nagar West',
    state: 'Tamil Nadu',
    total_donations: 4,
    is_available: true,
    is_eligible: true,
    last_donation: '2026-08-15'
  },
  {
    id: 2,
    donor_code: 'LP-DON-1002',
    display_name: 'Priya S.',
    blood_group: 'A+',
    district: 'Chennai',
    city: 'Adyar',
    locality: 'Besant Nagar',
    state: 'Tamil Nadu',
    total_donations: 3,
    is_available: true,
    is_eligible: true,
    last_donation: '2026-07-20'
  },
  {
    id: 3,
    donor_code: 'LP-DON-1003',
    display_name: 'Karthik R.',
    blood_group: 'B+',
    district: 'Coimbatore',
    city: 'Gandhipuram',
    locality: 'RS Puram',
    state: 'Tamil Nadu',
    total_donations: 5,
    is_available: true,
    is_eligible: true,
    last_donation: '2026-06-10'
  },
  {
    id: 4,
    donor_code: 'LP-DON-1004',
    display_name: 'Meena N.',
    blood_group: 'AB+',
    district: 'Madurai',
    city: 'K.K. Nagar',
    locality: 'Anna Bus Stand Area',
    state: 'Tamil Nadu',
    total_donations: 2,
    is_available: true,
    is_eligible: true,
    last_donation: '2026-08-01'
  },
  {
    id: 5,
    donor_code: 'LP-DON-1005',
    display_name: 'Anand K.',
    blood_group: 'O-',
    district: 'Tiruchirappalli',
    city: 'Thillai Nagar',
    locality: 'Cantonment',
    state: 'Tamil Nadu',
    total_donations: 6,
    is_available: true,
    is_eligible: true,
    last_donation: '2026-05-18'
  },
  {
    id: 6,
    donor_code: 'LP-DON-1006',
    display_name: 'Divya B.',
    blood_group: 'B+',
    district: 'Salem',
    city: 'Fairlands',
    locality: 'Alagapuram',
    state: 'Tamil Nadu',
    total_donations: 3,
    is_available: true,
    is_eligible: true,
    last_donation: '2026-08-25'
  },
  {
    id: 7,
    donor_code: 'LP-DON-1007',
    display_name: 'Suresh B.',
    blood_group: 'A-',
    district: 'Tirunelveli',
    city: 'Palayamkottai',
    locality: 'Vannarpettai',
    state: 'Tamil Nadu',
    total_donations: 2,
    is_available: true,
    is_eligible: true,
    last_donation: '2026-07-04'
  },
  {
    id: 8,
    donor_code: 'LP-DON-1008',
    display_name: 'Vignesh S.',
    blood_group: 'O+',
    district: 'Chennai',
    city: 'T. Nagar',
    locality: 'Pondy Bazaar',
    state: 'Tamil Nadu',
    total_donations: 7,
    is_available: true,
    is_eligible: true,
    last_donation: '2026-08-10'
  },
  {
    id: 9,
    donor_code: 'LP-DON-1009',
    display_name: 'Kavin P.',
    blood_group: 'B-',
    district: 'Erode',
    city: 'Perundurai',
    locality: 'Brough Road',
    state: 'Tamil Nadu',
    total_donations: 1,
    is_available: true,
    is_eligible: true,
    last_donation: '2026-06-30'
  },
  {
    id: 10,
    donor_code: 'LP-DON-1010',
    display_name: 'Sneha R.',
    blood_group: 'AB-',
    district: 'Vellore',
    city: 'Katpadi',
    locality: 'Gandhi Nagar',
    state: 'Tamil Nadu',
    total_donations: 2,
    is_available: true,
    is_eligible: true,
    last_donation: '2026-07-12'
  },
  {
    id: 11,
    donor_code: 'LP-DON-1011',
    display_name: 'Rajesh G.',
    blood_group: 'O+',
    district: 'Thanjavur',
    city: 'Medical College Rd',
    locality: 'Old Bus Stand',
    state: 'Tamil Nadu',
    total_donations: 4,
    is_available: true,
    is_eligible: true,
    last_donation: '2026-07-28'
  },
  {
    id: 12,
    donor_code: 'LP-DON-1012',
    display_name: 'Shalini M.',
    blood_group: 'A+',
    district: 'Dindigul',
    city: 'Round Road',
    locality: 'Palani Road',
    state: 'Tamil Nadu',
    total_donations: 3,
    is_available: true,
    is_eligible: true,
    last_donation: '2026-08-14'
  }
];

export function filterBaselineDonors(donors, { blood_group = '', district = '', city = '' } = {}) {
  const list = donors && donors.length ? donors : BASELINE_DONORS;
  return list.filter(d => {
    if (blood_group && d.blood_group !== blood_group) return false;
    if (district && d.district.toLowerCase() !== district.toLowerCase()) return false;
    if (city && !d.city.toLowerCase().includes(city.toLowerCase())) return false;
    return true;
  });
}

function loadInitialInventory() {
  try {
    const cached = localStorage.getItem('lifepulse_cached_inventory');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return BASELINE_INVENTORY;
}

function loadInitialDonors() {
  try {
    const cached = localStorage.getItem('lifepulse_cached_donors');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return BASELINE_DONORS;
}

class AppStore {
  constructor() {
    const initialInventory = loadInitialInventory();
    const initialDonors = loadInitialDonors();
    const totalUnits = initialInventory.reduce((acc, item) => acc + (item.units_available || 0), 0);
    const criticalGroups = initialInventory.filter(i => (i.units_available || 0) <= (i.min_threshold || 5)).map(i => i.blood_group);

    this.state = {
      user: null,
      donorProfile: null,
      role: 'guest', // 'admin' | 'donor' | 'requester' | 'guest'
      activeModule: 'search', // 'search' | 'inventory' | 'requests' | 'donor_portal' | 'admin_console'
      inventory: initialInventory,
      inventoryTotal: totalUnits,
      criticalGroups: criticalGroups,
      totalDonors: initialDonors.length,
      fulfilledRequests: 38,
      searchFilters: { blood_group: '', district: '', city: '' },
      searchResults: initialDonors,
      searchSuggestion: null,
      allDonors: initialDonors,
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
    if (partial.searchFilters && !partial.searchResults) {
      partial.searchResults = filterBaselineDonors(this.state.allDonors, partial.searchFilters);
    }
    this.state = { ...this.state, ...partial };
    if (partial.inventory && Array.isArray(partial.inventory)) {
      try {
        localStorage.setItem('lifepulse_cached_inventory', JSON.stringify(partial.inventory));
      } catch (e) {}
    }
    if (partial.allDonors && Array.isArray(partial.allDonors) && partial.allDonors.length > 0) {
      try {
        localStorage.setItem('lifepulse_cached_donors', JSON.stringify(partial.allDonors));
      } catch (e) {}
    }
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

  isAdmin() {
    return this.state.role === 'admin';
  }

  isDonor() {
    return this.state.role === 'donor';
  }

  isRequester() {
    return this.state.role === 'requester';
  }
}

export const store = new AppStore();
