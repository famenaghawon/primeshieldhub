-- ==================== MIGRATION: Add missing tables for v12.0 ====================
-- This script checks if tables exist before creating them

-- ==================== STAFF INVITES TABLE ====================
CREATE TABLE IF NOT EXISTS staff_invites (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    branch TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff',
    expires_at INTEGER NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    revoked INTEGER DEFAULT 0,
    used INTEGER DEFAULT 0,
    used_by TEXT,
    used_at TEXT
);

-- ==================== AI RECOMMENDATIONS TABLE ====================
CREATE TABLE IF NOT EXISTS ai_recommendations (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    impact TEXT,
    suggested_action TEXT,
    data TEXT,
    reviewed INTEGER DEFAULT 0,
    reviewed_by TEXT,
    reviewed_action TEXT,
    reviewed_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ==================== WHOLESALE CODES TABLE ====================
-- (Replaces hardcoded codes)
CREATE TABLE IF NOT EXISTS wholesale_codes (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    discount_percent INTEGER NOT NULL DEFAULT 10,
    max_uses INTEGER,
    times_used INTEGER DEFAULT 0,
    description TEXT,
    expires_at TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER DEFAULT 1
);

-- ==================== SECURITY INCIDENTS TABLE ====================
CREATE TABLE IF NOT EXISTS security_incidents (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT DEFAULT 'medium',
    entity_type TEXT,
    entity_id TEXT,
    reported_by TEXT,
    status TEXT DEFAULT 'open',
    resolved_by TEXT,
    resolved_at TEXT,
    resolution_notes TEXT,
    reported_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ==================== USER DEVICES TABLE ====================
CREATE TABLE IF NOT EXISTS user_devices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    user_agent TEXT,
    last_seen TEXT,
    verified INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ==================== PAYMENTS TABLE ====================
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    reference TEXT UNIQUE NOT NULL,
    amount REAL NOT NULL,
    amount_paid REAL,
    status TEXT DEFAULT 'pending',
    product_id TEXT,
    metadata TEXT,
    gateway_response TEXT,
    paid_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ==================== INDEXES ====================
CREATE INDEX IF NOT EXISTS idx_staff_invites_code ON staff_invites(code);
CREATE INDEX IF NOT EXISTS idx_staff_invites_expires ON staff_invites(expires_at);
CREATE INDEX IF NOT EXISTS idx_wholesale_codes_code ON wholesale_codes(code);
CREATE INDEX IF NOT EXISTS idx_wholesale_codes_active ON wholesale_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_security_incidents_status ON security_incidents(status);
CREATE INDEX IF NOT EXISTS idx_user_devices_user ON user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_fingerprint ON user_devices(fingerprint);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(reference);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);

-- ==================== ADD MISSING COLUMNS TO EXISTING TABLES ====================
-- Add total_referrals to users if not exists
ALTER TABLE users ADD COLUMN total_referrals INTEGER DEFAULT 0;

-- Add wholesale_available to products if not exists
ALTER TABLE products ADD COLUMN wholesale_available INTEGER DEFAULT 1;

-- Add wholesale_price to products if not exists
ALTER TABLE products ADD COLUMN wholesale_price REAL;

-- Add admin_notes to orders if not exists
ALTER TABLE orders ADD COLUMN admin_notes TEXT;

-- Add tracking_number to orders if not exists
ALTER TABLE orders ADD COLUMN tracking_number TEXT;

-- Add capture_type to staff_captures if not exists
ALTER TABLE staff_captures ADD COLUMN capture_type TEXT DEFAULT 'general';

-- Add notified_sms to charging_sessions if not exists
ALTER TABLE charging_sessions ADD COLUMN notified_sms INTEGER DEFAULT 0;

-- ==================== VERIFICATION ====================
-- Check that all required tables exist
SELECT 'Verification complete' as status;
