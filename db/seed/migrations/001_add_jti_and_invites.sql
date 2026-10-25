-- C:\Users\myori\Desktop\primeshieldhub\backend\migrations\001_add_jti_and_invites.sql

-- Add jti support for sessions (if not exists)
ALTER TABLE users ADD COLUMN total_referrals INTEGER DEFAULT 0;

-- Create staff_invites table (if not exists)
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

-- Create ai_recommendations table for storing AI suggestions (read-only)
CREATE TABLE IF NOT EXISTS ai_recommendations (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    impact TEXT,
    reviewed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Add wholesale_codes table if not exists (remove hardcoded codes)
CREATE TABLE IF NOT EXISTS wholesale_codes (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    discount_percent INTEGER NOT NULL DEFAULT 10,
    max_uses INTEGER,
    times_used INTEGER DEFAULT 0,
    description TEXT,
    expires_at INTEGER,
    created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER DEFAULT 1
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_invites_code ON staff_invites(code);
CREATE INDEX IF NOT EXISTS idx_staff_invites_expires ON staff_invites(expires_at);
CREATE INDEX IF NOT EXISTS idx_wholesale_codes_code ON wholesale_codes(code);
CREATE INDEX IF NOT EXISTS idx_charging_sessions_branch ON charging_sessions(branch_id);
CREATE INDEX IF NOT EXISTS idx_customer_history_phone ON customer_history(customer_phone);
