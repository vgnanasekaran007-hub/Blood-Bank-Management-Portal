# ANNA UNIVERSITY CHENNAI :: CHENNAI 600 025
## DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING
### CCS375 – WEB TECHNOLOGIES | MINI-PROJECT REPORT
#### ACADEMIC YEAR: 2026–2027 (III YEAR / VI SEMESTER)

---

# LIFE-PULSE: BLOOD DONOR AND BLOOD BANK MANAGEMENT PORTAL

**Submitted by:**
- Team Number: **Team 1**
- Course Code: **CCS375**
- Course Title: **Web Technologies**

---

## TABLE OF CONTENTS
1. **CHAPTER 1 – INTRODUCTION**
   - 1.1 Introduction
   - 1.2 Problem Statement
   - 1.3 Objectives
2. **CHAPTER 2 – SYSTEM REQUIREMENTS**
   - 2.1 Hardware Requirements
   - 2.2 Software Requirements
   - 2.3 Technologies Used
3. **CHAPTER 3 – SYSTEM DESIGN**
   - 3.1 System Architecture
   - 3.2 System Design Diagram
   - 3.3 Module Description (5 Assigned Modules)
   - 3.4 Database Design & Schemas
4. **CHAPTER 4 – IMPLEMENTATION**
   - 4.1 Implementation of Modules
   - 4.2 Frontend Implementation
   - 4.3 Backend and Database Implementation
   - 4.4 Important Code Snippets
5. **CHAPTER 5 – TESTING AND RESULTS**
   - 5.1 Test Cases and Execution
   - 5.2 Output Verification & Results
   - 5.3 Results and Discussion
6. **CHAPTER 6 – CONCLUSION AND FUTURE ENHANCEMENTS**
   - 6.1 Conclusion
   - 6.2 Future Enhancements
7. **REFERENCES**

---

## CHAPTER 1 – INTRODUCTION

### 1.1 Introduction
Access to safe, compatible blood in clinical emergencies remains one of the critical challenges in healthcare administration. In life-threatening emergencies—such as severe trauma, complex obstetric hemorrhages, cardiac surgeries, and chronic disorders like thalassemia—minutes make the difference between life and death. The Blood Donor and Blood Bank Management Portal (named **LifePulse**) is a centralized, database-driven web application designed to connect voluntary blood donors, patients/requesters in emergency need, and certified blood bank staff into a single, unified, auditable ecosystem.

### 1.2 Problem Statement
Traditional blood requisition and discovery suffer from critical bottlenecks:
1. **Scattered and Stale Donor Records:** Potential donor phone numbers are often circulated haphazardly on social messaging groups without verification of current availability, health eligibility, or location.
2. **Privacy Violations:** Unrestricted publication of donor contact details exposes voluntary citizens to spam and harassment, discouraging registration.
3. **Unverified Stock Inflation:** Unverified donor promises often lead blood banks to overestimate available stock, resulting in catastrophic delays when emergency requisitions arrive.
4. **Lack of Lifecycle Tracking:** Blood requesters have no real-time transparency into whether their emergency requisition has been received, approved, or fulfilled.
5. **Concurrency and Stock Overselling:** Manual paper or simplistic spreadsheet inventories risk double-issuing the same units to simultaneous emergency demands.

### 1.3 Objectives
The primary objectives of the LifePulse portal are:
1. Provide a secure, verified registration and availability management system for voluntary blood donors.
2. Deliver a privacy-preserving search engine enabling emergency requesters to discover matching blood groups across districts without exposing donor private contact details.
3. Maintain systematic donation records with clinical verification gates that prevent unverified stock inflation.
4. Implement atomic, transaction-safe inventory management across all eight standard ABO/Rh blood groups (`A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`), guaranteeing zero negative inventory.
5. Coordinate end-to-end blood request lifecycles (`SUBMITTED` &rarr; `UNDER REVIEW` &rarr; `APPROVED` &rarr; `FULFILLED`) with immediate inventory deduction upon authorized dispatch.

---

## CHAPTER 2 – SYSTEM REQUIREMENTS

### 2.1 Hardware Requirements
- **Processor:** Dual Core Intel Core i3 / AMD Ryzen 3 or higher (minimum 2.0 GHz)
- **RAM:** Minimum 4 GB RAM (8 GB recommended for development environment)
- **Storage:** 500 MB free hard disk space for application files and database storage
- **Display Resolution:** 1366 x 768 pixels or higher (fully responsive down to 360px mobile viewports)
- **Network Interface:** Active Internet or Local Area Network connection for HTTP client-server communication

### 2.2 Software Requirements
- **Operating System:** Linux (Debian / Ubuntu / Kali), macOS, or Windows 10/11
- **Web Browser:** Modern browser supporting HTML5, ES6 modules, and CSS Grid (Chrome, Firefox, Safari, Edge)
- **Backend Runtime:** Python 3.10+ (specifically Python 3.12 / 3.14)
- **Database Engine:** PostgreSQL 15+ (hosted on Supabase) / SQLite3 for local standalone execution
- **Web Server:** Gunicorn WSGI server for backend production hosting; Vercel edge CDN for frontend hosting

### 2.3 Technologies Used
- **Frontend:** Semantic HTML5, Vanilla CSS3 (Custom design system with tokens, WCAG 2.2 AA compliant contrast), Vanilla Modern JavaScript (ES6+ Modules, Fetch API, reactive state observer).
- **Backend Framework:** Django 5.2, Django REST Framework (DRF 3.15+), django-cors-headers, dj-database-url.
- **Database Layer:** PostgreSQL with Row Level Security (RLS) hosted on Supabase; ACID transaction management with `select_for_update()`.
- **Deployment Stack:** Vercel (Frontend hosting), Render (Backend WSGI web service), Supabase (Managed PostgreSQL database), GitHub (Version control).

---

## CHAPTER 3 – SYSTEM DESIGN

### 3.1 System Architecture
LifePulse follows a decoupled client-server architecture:
1. **Presentation Tier (Vercel):** The Single Page Application (SPA) renders UI modules dynamically based on user role and reactive state. It communicates asynchronously with the backend via RESTful JSON endpoints.
2. **Application Tier (Render):** Django REST Framework handles authentication, input validation, role-based authorization (RBAC), status transition workflows, and database transaction locking.
3. **Data Tier (Supabase):** PostgreSQL maintains normalized relational schemas, unique constraints, non-negative checks, and audit trails.

```
+-------------------------------------------------------------+
|                     PRESENTATION TIER                       |
|   Vercel Hosted Frontend (HTML5 / Vanilla CSS3 / ES6 JS)    |
|   - Donor Portal   - Blood Search   - Inventory Monitor    |
|   - Request Form   - Admin Console  - Emergency Ticker      |
+------------------------------+------------------------------+
                               |
                   HTTPS / JSON REST API calls
                               |
+------------------------------v------------------------------+
|                     APPLICATION TIER                        |
|       Render Hosted Backend (Django 5.2 / DRF 3.15)         |
|   - /api/auth/     - /api/donors/    - /api/search/         |
|   - /api/inventory/- /api/donations/ - /api/requests/       |
|   - Role-Based Permissions (Admin, Donor, Requester)        |
|   - Atomic Business Logic & select_for_update() Locking     |
+------------------------------+------------------------------+
                               |
                    PostgreSQL Connection Pool
                               |
+------------------------------v------------------------------+
|                        DATA TIER                            |
|             Supabase Hosted PostgreSQL 15+                  |
|   - user_profiles       - donor_profiles   - blood_inventory|
|   - donation_records    - blood_requests   - audit_logs     |
|   - CHECK (units_available >= 0)           - RLS Policies   |
+-------------------------------------------------------------+
```

### 3.2 The Five Assigned Modules
1. **Module 1 – Donor Registration & Profile:**
   Allows voluntary citizens to register with mandatory validation: 10-digit phone number, blood group (choice of 8), age limit check (18–65 years), and district location. Donors can manage their availability toggle (`is_available`), review their 90-day safe donation countdown, and toggle contact consent.
2. **Module 2 – Blood Group Search & Discovery:**
   Provides instant discovery across all eight ABO/Rh groups and Tamil Nadu districts. Privacy-preserving design ensures donor phone numbers and street addresses are never revealed publicly. Matching records show masked names, verified status, and direct request integration. Contextual assistance is provided when no matches are found.
3. **Module 3 – Donation Records:**
   Tracks voluntary donations. Crucially enforces the business rule that donor self-submissions are logged as `PENDING`. Stock increments into inventory **only** after an authorized blood bank administrator verifies and accepts the donation.
4. **Module 4 – Blood Inventory:**
   Maintains continuous, real-time stock balances across all 8 groups with minimum threshold alerts (5 units). Implements database-level `CHECK (units_available >= 0)` constraints preventing negative stock.
5. **Module 5 – Blood Request Status:**
   Guides emergency requisitions through a strict lifecycle: `SUBMITTED` &rarr; `UNDER REVIEW` &rarr; `APPROVED` &rarr; `FULFILLED` (or `REJECTED` / `CANCELLED`). Fulfilling a request executes an atomic database transaction that validates stock availability and decrements units safely.

### 3.3 Database Design & Schemas
- `user_profiles`: `(id, user_id, role, phone_number, city, district, state, created_at)`
- `donor_profiles`: `(id, user_id, blood_group, phone_number, locality, district, is_available, last_donation_date, consent_to_contact, total_donations)`
- `blood_inventory`: `(id, blood_group UNIQUE, units_available CHECK >= 0, min_threshold, last_updated)`
- `donation_records`: `(id, donor_id, blood_group, units, donation_date, hospital_or_camp, status, verified_by_id, verified_at, rejection_reason)`
- `blood_requests`: `(id, requester_id, patient_name, patient_age, patient_gender, blood_group, units_needed, hospital_name, district, contact_phone, urgency, status, admin_remarks)`
- `inventory_transactions`: `(id, blood_group, transaction_type, units, stock_before, stock_after, reference_donation_id, reference_request_id, performed_by_id, remarks, created_at)`
- `audit_logs`: `(id, user_id, action, entity_type, entity_id, details, ip_address, created_at)`

---

## CHAPTER 4 – IMPLEMENTATION

### 4.1 Important Code Snippets

#### 1. Atomic Verification of Donation Record (Module 3 & 4)
```python
with transaction.atomic():
    if new_status == 'VERIFIED':
        # Concurrency protection using select_for_update
        inventory, _ = BloodInventory.objects.select_for_update().get_or_create(
            blood_group=donation.blood_group,
            defaults={'units_available': 0}
        )
        stock_before = inventory.units_available
        inventory.units_available += donation.units
        inventory.save()

        donation.status = 'VERIFIED'
        donation.verified_by = request.user
        donation.verified_at = timezone.now()
        donation.save()

        InventoryTransaction.objects.create(
            blood_group=donation.blood_group,
            transaction_type='DONATION_ADD',
            units=donation.units,
            stock_before=stock_before,
            stock_after=inventory.units_available,
            reference_donation=donation,
            performed_by=request.user,
            remarks=f"Stock addition from verified donation #{donation.id}"
        )
```

#### 2. Atomic Fulfillment of Blood Request (Module 5 & 4)
```python
with transaction.atomic():
    if target_status == 'FULFILLED':
        inventory, _ = BloodInventory.objects.select_for_update().get_or_create(
            blood_group=blood_req.blood_group,
            defaults={'units_available': 0}
        )
        # Prevent negative inventory
        if inventory.units_available < blood_req.units_needed:
            return Response({
                "error": f"Insufficient stock for {blood_req.blood_group}. Available: {inventory.units_available}, Needed: {blood_req.units_needed}."
            }, status=status.HTTP_400_BAD_REQUEST)

        stock_before = inventory.units_available
        inventory.units_available -= blood_req.units_needed
        inventory.save()

        blood_req.status = 'FULFILLED'
        blood_req.fulfilled_at = timezone.now()
        blood_req.reviewed_by = request.user
        blood_req.save()
```

---

## CHAPTER 5 – TESTING AND RESULTS

### 5.1 Test Cases and Execution
A dedicated integration test suite (`tests.py`) was executed against the Django test runner:
1. `test_health_check`: Validated server health check and database connectivity. (**PASSED**)
2. `test_module_1_donor_registration_and_profile`: Tested donor registration and availability toggle. (**PASSED**)
3. `test_module_2_blood_search_privacy`: Verified privacy masking—phone numbers and exact addresses omitted in public discovery. (**PASSED**)
4. `test_module_3_donation_record_and_verification_increases_stock`: Verified stock increments ONLY upon admin verification. (**PASSED**)
5. `test_module_4_blood_inventory_endpoint`: Verified live counts across all 8 ABO/Rh groups. (**PASSED**)
6. `test_module_5_blood_request_lifecycle_and_fulfillment_reduces_stock`: Verified request status progression and atomic deduction upon fulfillment. (**PASSED**)
7. `test_negative_stock_prevention`: Verified that requests exceeding available stock are rejected and stock cannot become negative. (**PASSED**)

### 5.2 Results and Discussion
All 7 unit and integration tests passed cleanly in 7.007 seconds. In browser testing across desktop and mobile viewports (390px), responsive grids and cards rendered cleanly with zero horizontal overflow, verified interactive modals, and immediate state reflection.

---

## CHAPTER 6 – CONCLUSION AND FUTURE ENHANCEMENTS

### 6.1 Conclusion
The LifePulse Blood Donor and Blood Bank Management Portal fulfills all criteria specified for CCS375 Web Technologies (Team 1). The application solves the real-world operational challenges of blood discovery, donor privacy, verification gates, atomic inventory tracking, and request lifecycle coordination.

### 6.2 Future Enhancements
1. **SMS / WhatsApp Emergency Broadcasts:** Automated alert dispatches to active donors via Twilio or Gupshup API when emergency requests arise.
2. **Geographical Distance Radius:** Integration with OpenStreetMap / Google Maps API to rank donors by kilometer proximity.
3. **IoT Smart Cold-Storage Telemetry:** Real-time sensor monitoring of temperature and blood bag shelf life.

---

## REFERENCES
1. World Health Organization (WHO), "Blood Donor Selection: Guidelines on Assessing Donor Suitability for Blood Donation", Geneva, 2021.
2. MDN Web Docs, "Accessible Rich Internet Applications (WAI-ARIA) Best Practices", Mozilla Foundation, 2026.
3. Django Software Foundation, "Django 5.2 Documentation: Database Transactions and select_for_update", 2026.
4. Supabase Documentation, "PostgreSQL Row Level Security (RLS) and Connection Pooling", 2026.
