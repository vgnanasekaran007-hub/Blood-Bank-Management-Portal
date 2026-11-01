# LifePulse: Blood Donor and Blood Bank Management Portal

[![Course: CCS375 Web Technologies](https://img.shields.io/badge/Course-CCS375%20Web%20Technologies-red.svg)](https://www.annauniv.edu/)
[![Academic Year: 2026-2027](https://img.shields.io/badge/Academic%20Year-2026--2027-blue.svg)]()
[![Team: Team 1](https://img.shields.io/badge/Assigned%20Team-Team%201-green.svg)]()
[![Backend: Django 5.2](https://img.shields.io/badge/Backend-Django%205.2%20%7C%20DRF-0C4B33.svg)](https://www.djangoproject.com/)
[![Database: Supabase PostgreSQL](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ECF8E.svg)](https://supabase.com/)
[![Hosting: Vercel + Render](https://img.shields.io/badge/Hosting-Vercel%20%2B%20Render-black.svg)]()

> A centralized, database-driven web application connecting voluntary donors, emergency blood requesters, and accredited blood bank staff with real-time ABO/Rh stock inventory, privacy-preserving discovery, and atomic fulfillment.

---

## 1. Project Overview & Academic Credentials
- **Course:** CCS375 – Web Technologies
- **Academic Year:** 2026–2027 (III Year / VI Semester)
- **Assigned Team:** Team 1
- **Allotted Mini Project:** Blood Donor and Blood Bank Management Portal
- **Architecture Flow:** GitHub &rarr; Vercel (Frontend) &rarr; Render (Backend API) &rarr; Supabase (PostgreSQL Database)

---

## 2. The Five Non-Negotiable Modules

### Module 1: Donor Registration & Profile
- Voluntary donor registration with 10-digit phone number format validation, mandatory blood group selection, and age eligibility verification (18–65 years).
- Donor Portal with instant **Availability Toggle** (`Available` / `Unavailable`), 90-day safe donation countdown interval, contact consent management, and personal donation ledger.

### Module 2: Blood Group Search & Discovery
- Interactive 8-Blood-Group matrix selector (`A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`) with district and city filters.
- **Privacy-Preserving Discovery:** Public searches never reveal personal phone numbers or exact residential addresses. Matching records display masked display names, donor codes, availability badges, and direct request hooks.
- Contextual assistance when no matches are found, suggesting emergency request submission.

### Module 3: Donation Records Tracking
- Donors can log voluntary walk-in donation intents.
- **Clinical Double Verification Gate:** Unverified donations enter status `PENDING`. Blood inventory **only** increments after an authorized blood bank administrator verifies and accepts the record into stock.

### Module 4: Blood Stock Inventory
- Real-time stock monitor across all eight ABO/Rh groups.
- Minimum threshold alert (5 units) triggering automated critical dispatch warnings in the live emergency ticker.
- **Database Non-Negative Constraint:** Protected by `CHECK (units_available >= 0)` and database row-level locking (`select_for_update()`).

### Module 5: Blood Request Status & Lifecycle
- Emergency requisition submission capturing patient name, age, blood group, units needed (1–10), hospital name, district, contact phone, and urgency level (`NORMAL`, `URGENT`, `CRITICAL`).
- **Complete Request Lifecycle:** `SUBMITTED` &rarr; `UNDER REVIEW` &rarr; `APPROVED` &rarr; `FULFILLED` (or `REJECTED` / `CANCELLED`).
- **Atomic Fulfillment:** Marking a request as `FULFILLED` verifies inventory availability, atomically deducts units, records an `InventoryTransaction`, and generates an audit log entry.

---

## 3. Demo Roles & Quick Switcher
The application features a built-in Academic Demo Bar for effortless evaluation during viva/demonstration:
- **Staff Admin:** Dr. Arumugam (`admin` / `admin123`) &mdash; Full access to the Admin Console, Donation Verification Queue, Request Fulfillment, and Audit Logs.
- **Voluntary Donor:** Karthik Raman (`karthik_o_pos` / `donor123`) &mdash; O+ donor with availability controls, safe interval calculation, and personal history.
- **Emergency Requester:** Muthu Kumar (`requester1` / `req123`) &mdash; Requisitions tracking and lifecycle visibility.
- **Public / Guest:** Unauthenticated discovery with privacy safeguards.

---

## 4. Local Execution & Quick Start

### Prerequisites
- Python 3.10+ (Django 5.2, DRF)
- Web Browser (Chrome, Firefox, Edge, Safari)

### Run Backend Server (Port 8000)
```bash
cd backend
python3 -m pip install -r requirements.txt
python3 manage.py migrate
python3 seed_data.py
python3 manage.py runserver 127.0.0.1:8000
```

### Run Frontend (Port 3000)
```bash
cd frontend
python3 -m http.server 3000
```
Open **`http://localhost:3000`** in your browser.

---

## 5. Verification & Automated Test Suite
To execute the comprehensive integration test suite covering all 5 modules and concurrency rules:
```bash
cd backend
python3 manage.py test bloodbank
```
**Test Results:**
- `test_health_check` &mdash; PASSED
- `test_module_1_donor_registration_and_profile` &mdash; PASSED
- `test_module_2_blood_search_privacy` &mdash; PASSED
- `test_module_3_donation_record_and_verification_increases_stock` &mdash; PASSED
- `test_module_4_blood_inventory_endpoint` &mdash; PASSED
- `test_module_5_blood_request_lifecycle_and_fulfillment_reduces_stock` &mdash; PASSED
- `test_negative_stock_prevention` &mdash; PASSED
*(7 of 7 integration tests passing with 100% success).*

---

## 6. Directory Structure
```
.
├── backend/
│   ├── bloodportal/          # Django core configuration (settings, urls, wsgi)
│   ├── bloodbank/            # Main application (models, serializers, views, permissions, tests)
│   ├── manage.py
│   ├── requirements.txt      # Python dependencies for Render
│   ├── render.yaml           # Render deployment blueprint
│   ├── seed_data.py          # Academic demo data seed script
│   └── supabase_schema.sql   # Standalone PostgreSQL / Supabase SQL migration
├── frontend/
│   ├── css/
│   │   └── style.css         # WCAG 2.2 AA compliant bespoke clinical design system
│   ├── js/
│   │   ├── api.js            # Central REST API client with session management
│   │   ├── state.js          # Reactive application store & role manager
│   │   └── app.js            # Module controllers, modals, and workflow coordinator
│   ├── index.html            # Semantic single-page application shell
│   ├── vercel.json           # Vercel deployment edge routing
│   └── package.json          # Node scripts for dev server
├── docs/
│   ├── CCS375_Team1_Project_Report.md  # Official 6-Chapter Department Report
│   ├── API_DOCUMENTATION.md            # Comprehensive REST API reference
│   └── DEPLOYMENT_GUIDE.md             # Production setup for Vercel, Render, Supabase
├── .env.example              # Environment variables template
└── README.md                 # Project documentation
```

---

## 7. Documentation
- [Official Mini-Project Report (6-Chapter Department Structure)](docs/CCS375_Team1_Project_Report.md)
- [REST API Reference](docs/API_DOCUMENTATION.md)
- [Production Deployment Guide (Vercel, Render, Supabase)](docs/DEPLOYMENT_GUIDE.md)

---
*Developed by Team 1 for CCS375 Web Technologies (Academic Year 2026–2027).*
