-- ====================================================================
-- Blood Donor and Blood Bank Management Portal - Supabase Schema
-- Course: CCS375 - Web Technologies | Mini-Project 2026-2027 | Team 1
-- Database: PostgreSQL / Supabase
-- ====================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUM TYPES
DO $$ BEGIN
    CREATE TYPE blood_group_enum AS ENUM ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_role_enum AS ENUM ('donor', 'requester', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE donation_status_enum AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE request_status_enum AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'FULFILLED', 'REJECTED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE urgency_level_enum AS ENUM ('NORMAL', 'URGENT', 'CRITICAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_type_enum AS ENUM ('DONATION_ADD', 'REQUEST_FULFILL', 'MANUAL_ADJUSTMENT', 'DISCARD');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. USER PROFILES TABLE (Mirrors Django auth_user & UserProfile)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE,
    role VARCHAR(20) NOT NULL DEFAULT 'requester',
    phone_number VARCHAR(20) NOT NULL,
    city VARCHAR(100),
    district VARCHAR(100),
    state VARCHAR(100) DEFAULT 'Tamil Nadu',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. DONOR PROFILES TABLE (Module 1)
CREATE TABLE IF NOT EXISTS public.donor_profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
    blood_group VARCHAR(5) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    alternate_phone VARCHAR(20),
    date_of_birth DATE,
    gender VARCHAR(10) DEFAULT 'MALE',
    city VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL,
    state VARCHAR(100) DEFAULT 'Tamil Nadu',
    pincode VARCHAR(10),
    locality VARCHAR(150),
    is_available BOOLEAN DEFAULT TRUE,
    last_donation_date DATE,
    consent_to_contact BOOLEAN DEFAULT TRUE,
    total_donations INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_donors_search ON public.donor_profiles (blood_group, district, is_available);
CREATE INDEX IF NOT EXISTS idx_donors_city ON public.donor_profiles (city);
COMMENT ON COLUMN public.donor_profiles.district IS 'Supports all 38 districts of Tamil Nadu (Ariyalur to Virudhunagar)';

-- 5. BLOOD INVENTORY TABLE (Module 4)
CREATE TABLE IF NOT EXISTS public.blood_inventory (
    id BIGSERIAL PRIMARY KEY,
    blood_group VARCHAR(5) UNIQUE NOT NULL,
    units_available INTEGER NOT NULL DEFAULT 0 CHECK (units_available >= 0),
    min_threshold INTEGER NOT NULL DEFAULT 5,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- 6. DONATION RECORDS TABLE (Module 3)
CREATE TABLE IF NOT EXISTS public.donation_records (
    id BIGSERIAL PRIMARY KEY,
    donor_id BIGINT REFERENCES public.donor_profiles(id) ON DELETE CASCADE,
    blood_group VARCHAR(5) NOT NULL,
    units INTEGER NOT NULL DEFAULT 1 CHECK (units > 0 AND units <= 3),
    donation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    hospital_or_camp VARCHAR(200) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    verified_by_id INTEGER,
    verified_at TIMESTAMPTZ,
    rejection_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. BLOOD REQUESTS TABLE (Module 5)
CREATE TABLE IF NOT EXISTS public.blood_requests (
    id BIGSERIAL PRIMARY KEY,
    requester_id INTEGER NOT NULL,
    patient_name VARCHAR(150) NOT NULL,
    patient_age INTEGER NOT NULL CHECK (patient_age >= 0 AND patient_age <= 120),
    patient_gender VARCHAR(10) DEFAULT 'MALE',
    blood_group VARCHAR(5) NOT NULL,
    units_needed INTEGER NOT NULL DEFAULT 1 CHECK (units_needed > 0 AND units_needed <= 10),
    hospital_name VARCHAR(200) NOT NULL,
    hospital_address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL,
    contact_person VARCHAR(150) NOT NULL,
    contact_phone VARCHAR(20) NOT NULL,
    urgency VARCHAR(20) NOT NULL DEFAULT 'URGENT',
    medical_reason VARCHAR(200),
    required_by_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED',
    admin_remarks TEXT,
    reviewed_by_id INTEGER,
    reviewed_at TIMESTAMPTZ,
    fulfilled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_requests_status_group ON public.blood_requests (status, blood_group);
CREATE INDEX IF NOT EXISTS idx_requests_district ON public.blood_requests (district);

-- 8. INVENTORY TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
    id BIGSERIAL PRIMARY KEY,
    blood_group VARCHAR(5) NOT NULL,
    transaction_type VARCHAR(30) NOT NULL,
    units INTEGER NOT NULL,
    stock_before INTEGER NOT NULL,
    stock_after INTEGER NOT NULL,
    reference_donation_id BIGINT REFERENCES public.donation_records(id) ON DELETE SET NULL,
    reference_request_id BIGINT REFERENCES public.blood_requests(id) ON DELETE SET NULL,
    performed_by_id INTEGER,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(50) NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. INITIAL INVENTORY SEEDING (Clean working model starts at 0 units)
INSERT INTO public.blood_inventory (blood_group, units_available, min_threshold) VALUES
('A+', 0, 5),
('A-', 0, 5),
('B+', 0, 5),
('B-', 0, 5),
('AB+', 0, 5),
('AB-', 0, 5),
('O+', 0, 5),
('O-', 0, 5)
ON CONFLICT (blood_group) DO UPDATE SET
units_available = EXCLUDED.units_available,
min_threshold = EXCLUDED.min_threshold,
last_updated = NOW();

-- 11. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.donor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blood_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blood_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donation_records ENABLE ROW LEVEL SECURITY;

-- Public can read inventory
CREATE POLICY "Public can view blood inventory"
    ON public.blood_inventory FOR SELECT
    USING (true);

-- Authenticated donors can manage their own profile
CREATE POLICY "Donors can manage their own profile"
    ON public.donor_profiles FOR ALL
    USING (auth.uid() = user_id::text::uuid);

-- Public can discover donors only if available and consented (phone/address protected)
CREATE POLICY "Public discovery for active donors"
    ON public.donor_profiles FOR SELECT
    USING (is_available = true AND consent_to_contact = true);
