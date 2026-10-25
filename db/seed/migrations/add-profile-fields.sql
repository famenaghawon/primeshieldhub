-- ======================================================================
-- PROFILE ENHANCEMENT MIGRATIONS — D1 COMPATIBLE
-- Run with: npx wrangler d1 execute primeshieldhub-db --remote --file=this-file.sql
-- ======================================================================

-- 1. Add columns to users table
ALTER TABLE users ADD COLUMN photo_url TEXT;
ALTER TABLE users ADD COLUMN address TEXT;
ALTER TABLE users ADD COLUMN department TEXT;
ALTER TABLE users ADD COLUMN designation TEXT;
ALTER TABLE users ADD COLUMN employment_type TEXT DEFAULT 'full-time';
ALTER TABLE users ADD COLUMN bio TEXT;
ALTER TABLE users ADD COLUMN date_of_birth TEXT;
ALTER TABLE users ADD COLUMN gender TEXT;
ALTER TABLE users ADD COLUMN emergency_contact_name TEXT;
ALTER TABLE users ADD COLUMN emergency_contact_phone TEXT;
ALTER TABLE users ADD COLUMN emergency_contact_relationship TEXT;
ALTER TABLE users ADD COLUMN notification_email BOOLEAN DEFAULT 1;
ALTER TABLE users ADD COLUMN notification_sms BOOLEAN DEFAULT 0;
ALTER TABLE users ADD COLUMN notification_push BOOLEAN DEFAULT 1;
ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT 0;
ALTER TABLE users ADD COLUMN two_factor_secret TEXT;
ALTER TABLE users ADD COLUMN last_login_at TEXT;
ALTER TABLE users ADD COLUMN last_login_ip TEXT;
ALTER TABLE users ADD COLUMN login_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN updated_at TEXT;

-- 2. Add columns to staff table
ALTER TABLE staff ADD COLUMN photo_url TEXT;
ALTER TABLE staff ADD COLUMN address TEXT;
ALTER TABLE staff ADD COLUMN department TEXT;
ALTER TABLE staff ADD COLUMN designation TEXT;
ALTER TABLE staff ADD COLUMN employment_type TEXT DEFAULT 'full-time';
ALTER TABLE staff ADD COLUMN bio TEXT;
ALTER TABLE staff ADD COLUMN date_of_birth TEXT;
ALTER TABLE staff ADD COLUMN gender TEXT;
ALTER TABLE staff ADD COLUMN emergency_contact_name TEXT;
ALTER TABLE staff ADD COLUMN emergency_contact_phone TEXT;
ALTER TABLE staff ADD COLUMN emergency_contact_relationship TEXT;
ALTER TABLE staff ADD COLUMN notification_email BOOLEAN DEFAULT 1;
ALTER TABLE staff ADD COLUMN notification_sms BOOLEAN DEFAULT 0;
ALTER TABLE staff ADD COLUMN notification_push BOOLEAN DEFAULT 1;
ALTER TABLE staff ADD COLUMN two_factor_enabled BOOLEAN DEFAULT 0;
ALTER TABLE staff ADD COLUMN two_factor_secret TEXT;
ALTER TABLE staff ADD COLUMN last_login_at TEXT;
ALTER TABLE staff ADD COLUMN last_login_ip TEXT;
ALTER TABLE staff ADD COLUMN login_count INTEGER DEFAULT 0;
ALTER TABLE staff ADD COLUMN updated_at TEXT;
ALTER TABLE staff ADD COLUMN shift_start TEXT;
ALTER TABLE staff ADD COLUMN shift_end TEXT;
ALTER TABLE staff ADD COLUMN hourly_rate REAL;
ALTER TABLE staff ADD COLUMN supervisor_id TEXT;
ALTER TABLE staff ADD COLUMN skills TEXT;
ALTER TABLE staff ADD COLUMN certifications TEXT;
ALTER TABLE staff ADD COLUMN performance_score REAL DEFAULT 100;
ALTER TABLE staff ADD COLUMN attendance_streak INTEGER DEFAULT 0;

-- 3. Create staff_documents table
CREATE TABLE IF NOT EXISTS staff_documents (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    document_type TEXT NOT NULL,
    document_name TEXT NOT NULL,
    file_url TEXT,
    file_key TEXT,
    file_size INTEGER,
    mime_type TEXT,
    verification_status TEXT DEFAULT 'pending',
    verified_by TEXT,
    verified_at TEXT,
    expiry_date TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT,
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

-- 4. Create staff_skills table
CREATE TABLE IF NOT EXISTS staff_skills (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    skill_name TEXT NOT NULL,
    proficiency_level TEXT DEFAULT 'beginner',
    years_experience REAL DEFAULT 0,
    is_verified BOOLEAN DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

-- 5. Create staff_attendance table
CREATE TABLE IF NOT EXISTS staff_attendance (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    date TEXT NOT NULL,
    clock_in TEXT,
    clock_out TEXT,
    status TEXT DEFAULT 'present',
    late_minutes INTEGER DEFAULT 0,
    early_departure_minutes INTEGER DEFAULT 0,
    overtime_minutes INTEGER DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

-- 6. Create staff_leave_requests table
CREATE TABLE IF NOT EXISTS staff_leave_requests (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    leave_type TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    approved_by TEXT,
    approved_at TEXT,
    rejection_reason TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT,
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

-- 7. Create staff_performance_reviews table
CREATE TABLE IF NOT EXISTS staff_performance_reviews (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    reviewer_id TEXT NOT NULL,
    review_period TEXT NOT NULL,
    rating REAL,
    strengths TEXT,
    improvements TEXT,
    goals TEXT,
    status TEXT DEFAULT 'draft',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT,
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

-- 8. Create notification_preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    email_notifications BOOLEAN DEFAULT 1,
    sms_notifications BOOLEAN DEFAULT 0,
    push_notifications BOOLEAN DEFAULT 1,
    session_alerts BOOLEAN DEFAULT 1,
    payment_alerts BOOLEAN DEFAULT 1,
    payroll_alerts BOOLEAN DEFAULT 1,
    system_alerts BOOLEAN DEFAULT 1,
    marketing_emails BOOLEAN DEFAULT 0,
    quiet_hours_start TEXT,
    quiet_hours_end TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT,
    UNIQUE(user_id)
);

-- 9. Create login_history table
CREATE TABLE IF NOT EXISTS login_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    login_at TEXT DEFAULT (datetime('now')),
    ip_address TEXT,
    user_agent TEXT,
    device_type TEXT,
    browser TEXT,
    os TEXT,
    location TEXT,
    is_successful BOOLEAN DEFAULT 1,
    failure_reason TEXT,
    logout_at TEXT,
    session_duration INTEGER
);

-- 10. Create indexes
CREATE INDEX IF NOT EXISTS idx_staff_documents_staff_id ON staff_documents(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_staff_date ON staff_attendance(staff_id, date);
CREATE INDEX IF NOT EXISTS idx_staff_leave_staff_id ON staff_leave_requests(staff_id);
CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_login_at ON login_history(login_at);
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user_id ON notification_preferences(user_id);
