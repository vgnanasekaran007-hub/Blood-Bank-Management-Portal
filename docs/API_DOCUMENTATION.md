# LifePulse REST API Documentation
## CCS375 – Web Technologies | Team 1

---

### Base URLs
- **Local Development:** `http://127.0.0.1:8000/api`
- **Render Production Backend:** `https://blood-bank-portal-backend.onrender.com/api`

---

### 1. System Health
#### `GET /api/health/`
- **Description:** Verifies backend health and database connectivity.
- **Permissions:** Public (`AllowAny`)
- **Response `200 OK`:**
```json
{
  "status": "healthy",
  "service": "Blood Donor & Blood Bank Management Portal API",
  "course": "CCS375 - Web Technologies (Team 1)",
  "database": "ok",
  "timestamp": "2026-11-01T15:05:02.492054+00:00"
}
```

---

### 2. Authentication & Session
#### `POST /api/auth/register/`
- **Description:** Register a new user account with role (`donor` or `requester`).
- **Body:**
```json
{
  "username": "anand_donor",
  "email": "anand@example.com",
  "password": "strongPassword123",
  "full_name": "Anand Kumar",
  "role": "donor",
  "phone_number": "9840123456",
  "blood_group": "B+",
  "city": "Chennai",
  "district": "Chennai",
  "date_of_birth": "1998-05-12",
  "gender": "MALE",
  "locality": "Anna Nagar"
}
```

#### `POST /api/auth/login/`
- **Body:** `{"username": "admin", "password": "admin123"}`
- **Response `200 OK`:** Returns user details and session cookie.

#### `GET /api/auth/me/`
- **Description:** Checks current authenticated user session and role.

#### `POST /api/auth/logout/`
- **Description:** Ends current session.

---

### 3. Module 1: Donor Registration & Profile
#### `GET /api/donors/profile/`
- **Permissions:** Authenticated Donor (own profile) or Admin (via `?donor_id=ID`).
- **Response `200 OK`:**
```json
{
  "id": 1,
  "user_id": 4,
  "username": "karthik_o_pos",
  "full_name": "Karthik Raman",
  "blood_group": "O+",
  "phone_number": "9840551122",
  "district": "Chennai",
  "locality": "Anna Nagar",
  "is_available": true,
  "last_donation_date": "2026-07-10",
  "is_eligible": true,
  "days_since_last_donation": 114,
  "consent_to_contact": true,
  "total_donations": 4
}
```

#### `PATCH /api/donors/profile/`
- **Description:** Update availability switch, contact consent, or location.
- **Body:** `{"is_available": false, "consent_to_contact": true}`

---

### 4. Module 2: Blood Group Search & Discovery
#### `GET /api/search/?blood_group=O%2B&district=Chennai`
- **Permissions:** Public (`AllowAny`)
- **Privacy Rule:** Does NOT expose phone numbers or exact street addresses!
- **Response `200 OK`:**
```json
{
  "filters_applied": { "blood_group": "O+", "district": "Chennai" },
  "count": 2,
  "blood_stock": { "blood_group": "O+", "units_available": 32, "status": "HEALTHY" },
  "donors": [
    {
      "id": 1,
      "donor_code": "DNR-0001",
      "display_name": "Karthik R.",
      "blood_group": "O+",
      "district": "Chennai",
      "city": "Chennai",
      "is_available": true,
      "is_eligible": true,
      "total_donations": 4
    }
  ],
  "suggestion": null
}
```

---

### 5. Module 3: Donation Records
#### `GET /api/donations/`
- **Permissions:** Donors view their own; Admins view all.
- **Query Params:** `status=PENDING`, `blood_group=A+`

#### `POST /api/donations/`
- **Description:** Log voluntary donation (starts with status `PENDING`).
- **Body:**
```json
{
  "blood_group": "O+",
  "units": 1,
  "donation_date": "2026-11-01",
  "hospital_or_camp": "Stanley Medical College",
  "notes": "Walk-in voluntary donation"
}
```

#### `POST /api/donations/{id}/verify/`
- **Permissions:** Admin Only (`IsAdminUserOrStaff`).
- **Business Rule:** Executes atomic transaction, increments stock in `BloodInventory`, logs `InventoryTransaction`.
- **Body:** `{"status": "VERIFIED", "notes": "Hemoglobin confirmed normal at 14.2 g/dL."}`

---

### 6. Module 4: Blood Inventory
#### `GET /api/inventory/`
- **Permissions:** Public (`AllowAny`)
- **Response `200 OK`:**
```json
{
  "total_units": 100,
  "critical_groups": ["B-", "AB-", "O-"],
  "inventory": [
    { "blood_group": "A+", "units_available": 18, "min_threshold": 5, "status": "HEALTHY" },
    { "blood_group": "B-", "units_available": 4, "min_threshold": 5, "status": "LOW_STOCK" },
    { "blood_group": "AB-", "units_available": 2, "min_threshold": 5, "status": "OUT_OF_STOCK" }
  ]
}
```

#### `GET /api/inventory/transactions/`
- **Permissions:** Admin Only.
- **Description:** Full audit ledger of stock additions, deductions, and fulfillment events.

---

### 7. Module 5: Blood Requests
#### `GET /api/requests/`
- **Permissions:** Requesters view their own; Admins view all.

#### `POST /api/requests/`
- **Permissions:** Authenticated User / Requester.
- **Body:**
```json
{
  "patient_name": "R. Meenakshi",
  "patient_age": 46,
  "patient_gender": "FEMALE",
  "blood_group": "O+",
  "units_needed": 2,
  "hospital_name": "Apollo Speciality Hospital",
  "hospital_address": "Greams Road, Chennai",
  "city": "Chennai",
  "district": "Chennai",
  "contact_person": "Muthu Kumar (Son)",
  "contact_phone": "9841234567",
  "urgency": "CRITICAL",
  "required_by_date": "2026-11-01",
  "medical_reason": "Emergency Cardiac Bypass Surgery"
}
```

#### `POST /api/requests/{id}/update_status/`
- **Permissions:** Admin (or Requester if status is `CANCELLED`).
- **Lifecycle transitions:** `UNDER_REVIEW`, `APPROVED`, `FULFILLED`, `REJECTED`, `CANCELLED`.
- **Atomic Rule:** If `status == 'FULFILLED'`, verifies stock availability, deducts units, logs transaction. Rejects if stock is insufficient.
