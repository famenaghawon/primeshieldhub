-- PrimeShieldHub D1 schema (primeshieldhub-db)
-- Exported 2026-10-25 from sqlite_master
-- Note: D1 extensions (uuid()) present; local sqlite3 CLI may error — expected.

CREATE TABLE _cf_KV (
        key TEXT PRIMARY KEY,
        value BLOB
      ) WITHOUT ROWID;

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  basePrice REAL,
  price REAL,
  wholesalePrice REAL,
  stock INTEGER DEFAULT 0,
  weightKg REAL,
  image TEXT,
  description TEXT,
  active INTEGER DEFAULT 1,
  createdAt INTEGER NOT NULL
, wholesale_available INTEGER DEFAULT 0, wholesale_price REAL, image_url TEXT, reseller_price REAL, rating REAL, featured INTEGER DEFAULT 0, brand TEXT, is_bestseller INTEGER DEFAULT 0, is_new INTEGER DEFAULT 0, updated_at TEXT, specifications TEXT, store_type TEXT DEFAULT 'gadgets', landed_cost REAL, price_wholesale REAL, supplier TEXT, original_price REAL, slug TEXT, stock_alert_threshold INTEGER DEFAULT 5, featured_until TEXT, sku TEXT, franchise_id TEXT);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  amount REAL NOT NULL,
  status TEXT NOT NULL,
  createdAt INTEGER NOT NULL
, admin_notes TEXT, tracking_number TEXT, reference TEXT, trackingId TEXT, trackingStatus TEXT DEFAULT 'pending', trackingHistory TEXT DEFAULT '[]', estimatedDelivery TEXT, customerName TEXT, customerEmail TEXT, customerPhone TEXT, shippingAddress TEXT DEFAULT '{}', paymentMethod TEXT, total REAL, created_at TEXT, updated_at TEXT, deliveryAddress TEXT, city TEXT, state TEXT, fee INTEGER, shipping_cost INTEGER, vat INTEGER, items TEXT, subtotal REAL, paid_at INTEGER, express_delivery INTEGER DEFAULT 0, benin_pickup INTEGER DEFAULT 0, shipping_zone TEXT, estimated_days TEXT, shipping_label TEXT, wholesale_savings INTEGER DEFAULT 0, wholesale_tier TEXT, discount_code TEXT, discount_amount INTEGER DEFAULT 0, discount_label TEXT, franchise_id TEXT, reseller_id TEXT);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE TABLE resellers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  phone TEXT,
  createdAt INTEGER NOT NULL
, user_id TEXT, total_earnings REAL DEFAULT 0, total_referrals INTEGER DEFAULT 0, rank TEXT DEFAULT 'bronze', status TEXT DEFAULT 'active', payment_method TEXT, account_number TEXT, account_name TEXT, email TEXT, bank_name TEXT, updated_at TEXT, created_at TEXT, business_name TEXT, city TEXT, business_type TEXT, order_volume TEXT, partnership_tier TEXT, experience TEXT, referral_source TEXT);

CREATE TABLE reseller_codes (
  code TEXT PRIMARY KEY,
  discount REAL,
  tier TEXT,
  maxUses INTEGER,
  dailyUsageLimit INTEGER,
  rateLimit INTEGER,
  expiryDate INTEGER,
  singleUse INTEGER,
  suspiciousThreshold INTEGER,
  accountStatus TEXT,
  active INTEGER DEFAULT 1,
  allowedCountries TEXT, -- JSON array
  blockedCountries TEXT, -- JSON array
  createdAt INTEGER NOT NULL
);

CREATE TABLE charges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT,
  device TEXT,
  amount INTEGER,
  staff TEXT,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE charging_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT,
  device_type TEXT,
  amount INTEGER,
  staff TEXT,
  status TEXT DEFAULT 'charging',
  start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  end_time DATETIME,
  duration INTEGER
, branch_id TEXT, ticket_number TEXT, customer_phone TEXT, customer_email TEXT, device_model TEXT, battery_start INTEGER DEFAULT 0, cable_type TEXT DEFAULT 'USB-C', notes TEXT, special_handling INTEGER DEFAULT 0, paused_time TEXT, resumed_time TEXT, completed_time TEXT, ready_time TEXT, overnight_since TEXT, notified_ready INTEGER DEFAULT 0, notified_whatsapp INTEGER DEFAULT 0, notified_telegram INTEGER DEFAULT 0, notified_closing INTEGER DEFAULT 0, last_notification TEXT, notified_sms INTEGER DEFAULT 0, estimated_minutes INTEGER, estimated_completion DATETIME, staff_name TEXT, updated_at DATETIME, staff_id TEXT, bay_id TEXT, payment_method TEXT, completed_by TEXT, completion_notes TEXT, paused_at DATETIME, resumed_at DATETIME, pause_reason TEXT, ready_at DATETIME, notified_overnight INTEGER DEFAULT 0);

CREATE TABLE staff (
  id TEXT PRIMARY KEY,
  name TEXT,
  phone TEXT,
  role TEXT,
  pin TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
, branch_id TEXT, score INTEGER DEFAULT 100, total_revenue REAL DEFAULT 0, total_sessions INTEGER DEFAULT 0, branch_name TEXT DEFAULT 'Main', status TEXT DEFAULT 'active', email TEXT, password_hash TEXT, password_salt TEXT, approved_by TEXT, approved_at DATETIME, rejected_by TEXT, rejected_at DATETIME, rejection_reason TEXT, updated_at TEXT, department TEXT, designation TEXT, employment_type TEXT DEFAULT 'full-time', photo_url TEXT, display_id TEXT, address TEXT, bio TEXT, date_of_birth TEXT, gender TEXT, emergency_contact_name TEXT, emergency_contact_phone TEXT, emergency_contact_relationship TEXT, notification_email BOOLEAN DEFAULT 1, notification_sms BOOLEAN DEFAULT 0, notification_push BOOLEAN DEFAULT 1, two_factor_enabled BOOLEAN DEFAULT 0, two_factor_secret TEXT, last_login_at TEXT, last_login_ip TEXT, login_count INTEGER DEFAULT 0, shift_start TEXT, shift_end TEXT, hourly_rate REAL, supervisor_id TEXT, skills TEXT, certifications TEXT, performance_score REAL DEFAULT 100, attendance_streak INTEGER DEFAULT 0, createdAt INTEGER);

CREATE TABLE staff_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id TEXT,
  action TEXT,
  session_id INTEGER,
  amount INTEGER,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  session_id INTEGER,
  amount INTEGER,
  method TEXT,
  status TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE daily_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  total_sessions INTEGER,
  total_revenue INTEGER,
  date TEXT
, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT,
  message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_products_active ON products(active);

CREATE INDEX idx_products_category ON products(category);

CREATE INDEX idx_orders_user_id ON orders(user_id);

CREATE INDEX idx_orders_status ON orders(status);

CREATE INDEX idx_orders_createdAt ON orders(createdAt);

CREATE INDEX idx_charging_sessions_status ON charging_sessions(status);

CREATE INDEX idx_charging_sessions_staff ON charging_sessions(staff);

CREATE INDEX idx_charging_sessions_start_time ON charging_sessions(start_time);

CREATE INDEX idx_staff_logs_staff_id ON staff_logs(staff_id);

CREATE INDEX idx_staff_logs_action ON staff_logs(action);

CREATE INDEX idx_staff_logs_timestamp ON staff_logs(timestamp);

CREATE INDEX idx_payments_session_id ON payments(session_id);

CREATE INDEX idx_payments_status ON payments(status);

CREATE INDEX idx_daily_stats_date ON daily_stats(date);

CREATE INDEX idx_alerts_created_at ON alerts(created_at);

CREATE INDEX idx_alerts_type ON alerts(type);

CREATE INDEX idx_reseller_codes_active ON reseller_codes(active);

CREATE TABLE otp_codes (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, code TEXT NOT NULL, expires_at INTEGER NOT NULL, verified INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);

CREATE INDEX idx_otp_codes_user_id ON otp_codes(user_id);

CREATE TABLE penalties (id INTEGER PRIMARY KEY AUTOINCREMENT, staff TEXT, reason TEXT, amount INTEGER, timestamp TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE actions (id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT, details TEXT, timestamp TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE system_control (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT UNIQUE, value TEXT);

CREATE TABLE deploy_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT,
  status TEXT,
  message TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE branches (id TEXT PRIMARY KEY, name TEXT, location TEXT, status TEXT DEFAULT 'active', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, phone TEXT, manager TEXT, city TEXT, address TEXT, state TEXT, country TEXT DEFAULT 'Nigeria', branch_type TEXT DEFAULT 'retail', is_headquarters INTEGER DEFAULT 0, capabilities TEXT DEFAULT 'retail', email TEXT);

CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE, name TEXT, password_hash TEXT, password_salt TEXT, role TEXT DEFAULT 'user', phone TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, status TEXT DEFAULT 'active', total_referrals INTEGER DEFAULT 0, address TEXT, photo_url TEXT, updated_at TEXT, branch_id TEXT, points INTEGER DEFAULT 0, total_revenue REAL DEFAULT 0, total_sessions INTEGER DEFAULT 0, department TEXT, designation TEXT, employment_type TEXT DEFAULT 'full-time', bio TEXT, date_of_birth TEXT, gender TEXT, emergency_contact_name TEXT, emergency_contact_phone TEXT, emergency_contact_relationship TEXT, notification_email BOOLEAN DEFAULT 1, notification_sms BOOLEAN DEFAULT 0, notification_push BOOLEAN DEFAULT 1, two_factor_enabled BOOLEAN DEFAULT 0, two_factor_secret TEXT, last_login_at TEXT, last_login_ip TEXT, login_count INTEGER DEFAULT 0, referral_code TEXT, createdAt INTEGER, wholesale_tier TEXT DEFAULT 'standard', loyalty_points INTEGER DEFAULT 0, last_cart_sync TEXT, total_spent DECIMAL(10,2) DEFAULT 0, total_orders INTEGER DEFAULT 0, review_count INTEGER DEFAULT 0, average_rating DECIMAL(3,2) DEFAULT 0, customer_lifetime_value DECIMAL(10,2) DEFAULT 0, average_order_value DECIMAL(10,2) DEFAULT 0, must_change_password INTEGER DEFAULT 0);

CREATE TABLE commissions (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, reseller_id TEXT NOT NULL, customer_id TEXT, customer_name TEXT DEFAULT 'Anonymous', sale_amount REAL NOT NULL DEFAULT 0, commission_amount REAL NOT NULL DEFAULT 0, commission_rate REAL DEFAULT 0.15, status TEXT DEFAULT 'pending', paid_at TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (reseller_id) REFERENCES users(id));

CREATE INDEX idx_commissions_reseller ON commissions(reseller_id);

CREATE INDEX idx_commissions_order ON commissions(order_id);

CREATE UNIQUE INDEX idx_resellers_user ON resellers(user_id);

CREATE TABLE payouts (id TEXT PRIMARY KEY, reseller_id TEXT NOT NULL, amount REAL NOT NULL, bank_name TEXT, account_number TEXT, account_name TEXT, status TEXT DEFAULT 'pending', paid_at TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (reseller_id) REFERENCES users(id));

CREATE TABLE notifications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, message TEXT, type TEXT DEFAULT 'info', link TEXT, read INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (user_id) REFERENCES users(id));

CREATE INDEX idx_payouts_reseller ON payouts(reseller_id);

CREATE INDEX idx_notifications_user ON notifications(user_id);

CREATE TABLE referrals (id TEXT PRIMARY KEY, referrer_id TEXT NOT NULL, referred_user_id TEXT NOT NULL, referred_email TEXT, status TEXT DEFAULT 'signed_up', created_at TEXT DEFAULT (datetime('now')), reward_claimed INTEGER DEFAULT 0, reward_claimed_at TEXT, reward_amount REAL DEFAULT 500, FOREIGN KEY (referrer_id) REFERENCES users(id), FOREIGN KEY (referred_user_id) REFERENCES users(id));

CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);

CREATE TABLE customer_history (id TEXT PRIMARY KEY, customer_phone TEXT NOT NULL, customer_name TEXT, device_type TEXT, amount REAL, session_id TEXT, date TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE staff_locations (id TEXT PRIMARY KEY, staff_id TEXT, lat REAL, lng REAL, branch_id TEXT, timestamp TEXT);

CREATE TABLE staff_captures (id TEXT PRIMARY KEY, staff_id TEXT, image_url TEXT, branch_id TEXT, timestamp TEXT, capture_type TEXT DEFAULT 'general');

CREATE INDEX idx_customer_history_phone ON customer_history(customer_phone);

CREATE INDEX idx_customer_history_date ON customer_history(date);

CREATE INDEX idx_staff_locations_staff ON staff_locations(staff_id);

CREATE INDEX idx_staff_captures_staff ON staff_captures(staff_id);

CREATE INDEX idx_charging_sessions_ticket ON charging_sessions(ticket_number);

CREATE INDEX idx_charging_sessions_phone ON charging_sessions(customer_phone);

CREATE TABLE audit_logs (id TEXT PRIMARY KEY, action TEXT NOT NULL, user_id TEXT NOT NULL, resource TEXT NOT NULL, resource_id TEXT, changes TEXT, ip_address TEXT, device_fingerprint TEXT, timestamp TEXT NOT NULL, event_type TEXT, description TEXT);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, timestamp);

CREATE INDEX idx_audit_logs_action ON audit_logs(action, timestamp);

CREATE INDEX idx_audit_logs_resource ON audit_logs(resource, resource_id);

CREATE TABLE staff_invites ( id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, branch TEXT NOT NULL, role TEXT DEFAULT 'staff', expires_at INTEGER NOT NULL, created_by TEXT, used INTEGER DEFAULT 0, revoked INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP , status TEXT DEFAULT 'pending', used_by TEXT, used_at DATETIME);

CREATE TABLE wholesale_requests (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT, message TEXT, business_info TEXT, expected_volume TEXT, status TEXT DEFAULT 'pending', reviewed_by TEXT, reviewed_at TEXT, created_at TEXT DEFAULT (datetime('now')));

CREATE TABLE ai_recommendations (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    impact TEXT,
    reviewed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
, action TEXT);

CREATE INDEX idx_staff_invites_code ON staff_invites(code);

CREATE INDEX idx_staff_invites_expires ON staff_invites(expires_at);

CREATE INDEX idx_charging_sessions_branch ON charging_sessions(branch_id);

CREATE TABLE security_incidents (id TEXT PRIMARY KEY, type TEXT NOT NULL, description TEXT NOT NULL, severity TEXT DEFAULT 'medium', entity_type TEXT, entity_id TEXT, reported_by TEXT, status TEXT DEFAULT 'open', resolved_by TEXT, resolved_at TEXT, resolution_notes TEXT, reported_at TEXT DEFAULT CURRENT_TIMESTAMP, details TEXT, source TEXT);

CREATE TABLE user_devices (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, fingerprint TEXT NOT NULL, user_agent TEXT, last_seen TEXT, verified INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE INDEX idx_security_incidents_status ON security_incidents(status);

CREATE INDEX idx_user_devices_user ON user_devices(user_id);

CREATE INDEX idx_user_devices_fingerprint ON user_devices(fingerprint);

CREATE TABLE d1_migrations(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE investor_leads (id TEXT PRIMARY KEY, name TEXT, email TEXT, phone TEXT, amount TEXT, message TEXT, simulation_data TEXT, created_at TEXT DEFAULT (datetime('now')));

CREATE TABLE bays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    branch_id TEXT,
    cable_type TEXT DEFAULT 'USB-C',
    power_delivery TEXT DEFAULT '65W',
    occupied INTEGER DEFAULT 0,
    session_id TEXT,
    occupied_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (branch_id) REFERENCES branches(id)
);

CREATE TABLE counters (
    key TEXT PRIMARY KEY,
    value INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE staff_activity (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    branch_id TEXT,
    action TEXT NOT NULL,
    details TEXT,
    session_id TEXT,
    ip TEXT,
    fingerprint TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES staff(id),
    FOREIGN KEY (branch_id) REFERENCES branches(id)
);

CREATE TABLE transactions (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    branch_id TEXT,
    amount REAL NOT NULL,
    payment_method TEXT DEFAULT 'cash',
    staff_id TEXT,
    customer_phone TEXT,
    status TEXT DEFAULT 'pending',
    reference TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES charging_sessions(id),
    FOREIGN KEY (branch_id) REFERENCES branches(id),
    FOREIGN KEY (staff_id) REFERENCES users(id)
);

CREATE INDEX idx_bays_branch ON bays(branch_id);

CREATE INDEX idx_bays_occupied ON bays(occupied);

CREATE INDEX idx_bays_session ON bays(session_id);

CREATE INDEX idx_staff_activity_staff ON staff_activity(staff_id);

CREATE INDEX idx_staff_activity_created ON staff_activity(created_at);

CREATE INDEX idx_staff_activity_action ON staff_activity(action);

CREATE INDEX idx_transactions_session ON transactions(session_id);

CREATE INDEX idx_transactions_branch ON transactions(branch_id);

CREATE INDEX idx_transactions_created ON transactions(created_at);

CREATE INDEX idx_transactions_staff ON transactions(staff_id);

CREATE INDEX idx_staff_locations_timestamp ON staff_locations(timestamp);

CREATE INDEX idx_staff_captures_staff_id ON staff_captures(staff_id);

CREATE INDEX idx_otp_codes_code ON otp_codes(code);

CREATE INDEX idx_user_devices_user_id ON user_devices(user_id);

CREATE INDEX idx_referrals_referrer_id ON referrals(referrer_id);

CREATE INDEX idx_actions_timestamp ON actions(timestamp);

CREATE INDEX idx_commissions_reseller_id ON commissions(reseller_id);

CREATE INDEX idx_deploy_logs_timestamp ON deploy_logs(timestamp);

CREATE TABLE pages ( id TEXT PRIMARY KEY DEFAULT (uuid()), title TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, content TEXT, meta_title TEXT, meta_description TEXT, status TEXT DEFAULT 'draft', views INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP , meta_keywords TEXT);

CREATE INDEX idx_staff_locations_staff_id ON staff_locations(staff_id);

CREATE INDEX idx_pages_slug ON pages(slug);

CREATE TABLE admin_invitations (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending',
    expires_at DATETIME,
    used_by TEXT,
    used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE anomaly_logs (  id TEXT PRIMARY KEY DEFAULT (uuid()),  type TEXT,  severity TEXT,  message TEXT,  details TEXT,  timestamp TEXT DEFAULT CURRENT_TIMESTAMP, source TEXT, count INTEGER DEFAULT 0, category TEXT, resolved INTEGER DEFAULT 0, resolved_at DATETIME, resolved_by TEXT, severity_score INTEGER DEFAULT 0, confidence REAL DEFAULT 0.5);

CREATE INDEX idx_anomaly_logs_timestamp ON anomaly_logs(timestamp);

CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);

CREATE TABLE admin_logs (     id TEXT PRIMARY KEY DEFAULT (uuid()),     action TEXT,     user_id TEXT,     resource TEXT,     resource_id TEXT,     details TEXT,     timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,     ip TEXT,     fingerprint TEXT   );

CREATE INDEX idx_charging_sessions_bay_id ON charging_sessions(bay_id);

CREATE INDEX idx_charging_sessions_staff_id ON charging_sessions(staff_id);

CREATE INDEX idx_anomaly_logs_severity ON anomaly_logs(severity);

CREATE INDEX idx_anomaly_logs_resolved ON anomaly_logs(resolved);

CREATE INDEX idx_anomaly_logs_severity_score ON anomaly_logs(severity_score);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);

CREATE INDEX idx_notifications_read ON notifications(read);

CREATE INDEX idx_notifications_created_at ON notifications(created_at);

CREATE TABLE customer_loyalty (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    points INTEGER DEFAULT 0,
    tier TEXT DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
    total_visits INTEGER DEFAULT 0,
    total_spent DECIMAL(10,2) DEFAULT 0,
    last_visit INTEGER,
    metadata TEXT, -- JSON string for additional data
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    UNIQUE(customer_id)
);

CREATE INDEX idx_loyalty_customer_id ON customer_loyalty(customer_id);

CREATE INDEX idx_loyalty_points ON customer_loyalty(points DESC);

CREATE INDEX idx_loyalty_tier ON customer_loyalty(tier);

CREATE TABLE staff_performance (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    staff_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL, -- YYYY-MM-DD
    sessions_completed INTEGER DEFAULT 0,
    sessions_abandoned INTEGER DEFAULT 0,
    revenue DECIMAL(10,2) DEFAULT 0,
    avg_session_duration INTEGER DEFAULT 0, -- in minutes
    customer_satisfaction DECIMAL(3,2) DEFAULT 0,
    metadata TEXT, -- JSON string for additional data
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    UNIQUE(staff_id, date)
);

CREATE INDEX idx_performance_staff_id ON staff_performance(staff_id);

CREATE INDEX idx_performance_date ON staff_performance(date);

CREATE INDEX idx_performance_revenue ON staff_performance(revenue DESC);

CREATE TABLE analytics_cache (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    metric TEXT NOT NULL,
    data TEXT NOT NULL, -- JSON string
    period TEXT NOT NULL CHECK (period IN ('hourly', 'daily', 'weekly', 'monthly')),
    branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE,
    computed_at INTEGER DEFAULT (unixepoch()),
    expires_at INTEGER,
    UNIQUE(metric, period, branch_id)
);

CREATE INDEX idx_analytics_metric ON analytics_cache(metric);

CREATE INDEX idx_analytics_period ON analytics_cache(period);

CREATE INDEX idx_analytics_expires ON analytics_cache(expires_at);

CREATE TABLE reports (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('daily', 'weekly', 'monthly', 'custom')),
    format TEXT NOT NULL CHECK (format IN ('json', 'pdf', 'csv', 'excel')),
    data TEXT NOT NULL, -- JSON string of report data
    file_url TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    filters TEXT, -- JSON string of filters used
    download_count INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_reports_user_id ON reports(user_id);

CREATE INDEX idx_reports_type ON reports(type);

CREATE INDEX idx_reports_status ON reports(status);

CREATE TABLE customer_activity_log (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('visit', 'purchase', 'loyalty_earn', 'loyalty_redeem', 'feedback')),
    description TEXT,
    metadata TEXT, -- JSON string for additional data
    created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_activity_customer_id ON customer_activity_log(customer_id);

CREATE INDEX idx_activity_type ON customer_activity_log(activity_type);

CREATE INDEX idx_activity_created_at ON customer_activity_log(created_at);

CREATE TABLE branch_settings (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    setting_key TEXT NOT NULL,
    setting_value TEXT NOT NULL, -- JSON or string value
    setting_type TEXT DEFAULT 'string' CHECK (setting_type IN ('string', 'number', 'boolean', 'json', 'array')),
    description TEXT,
    updated_by TEXT REFERENCES users(id),
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    UNIQUE(branch_id, setting_key)
);

CREATE INDEX idx_branch_settings_branch_id ON branch_settings(branch_id);

CREATE INDEX idx_branch_settings_key ON branch_settings(setting_key);

CREATE TRIGGER update_notifications_updated_at 
AFTER UPDATE ON notifications
BEGIN
    UPDATE notifications SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER update_customer_loyalty_updated_at 
AFTER UPDATE ON customer_loyalty
BEGIN
    UPDATE customer_loyalty SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER update_staff_performance_updated_at 
AFTER UPDATE ON staff_performance
BEGIN
    UPDATE staff_performance SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER update_reports_updated_at 
AFTER UPDATE ON reports
BEGIN
    UPDATE reports SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER update_branch_settings_updated_at 
AFTER UPDATE ON branch_settings
BEGIN
    UPDATE branch_settings SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TABLE opportunities (id TEXT PRIMARY KEY, type TEXT, message TEXT, potential_value TEXT, confidence REAL, source TEXT, status TEXT DEFAULT 'active', created_at TEXT DEFAULT (datetime('now')));

CREATE TABLE pattern_analysis (id TEXT PRIMARY KEY, pattern_key TEXT, frequency INTEGER, trend TEXT, details TEXT, analysis_date TEXT DEFAULT (datetime('now')));

CREATE TABLE events (id TEXT PRIMARY KEY, type TEXT, data TEXT, created_at TEXT DEFAULT (datetime('now')));

CREATE TABLE staff_password_resets (id TEXT PRIMARY KEY, staff_id TEXT NOT NULL, email TEXT NOT NULL, reset_code TEXT NOT NULL, expires_at INTEGER NOT NULL, used INTEGER DEFAULT 0, created_at INTEGER NOT NULL, ip_address TEXT, user_agent TEXT);

CREATE INDEX idx_staff_resets_email ON staff_password_resets(email);

CREATE INDEX idx_staff_resets_code ON staff_password_resets(reset_code);

CREATE INDEX idx_staff_resets_expires ON staff_password_resets(expires_at);

CREATE TABLE staff_audit_log (id TEXT PRIMARY KEY, staff_id TEXT NOT NULL, action TEXT NOT NULL, details TEXT, ip_address TEXT, user_agent TEXT, created_at INTEGER NOT NULL);

CREATE INDEX idx_staff_audit_staff_id ON staff_audit_log(staff_id);

CREATE INDEX idx_staff_audit_action ON staff_audit_log(action);

CREATE INDEX idx_staff_resets_staff_id ON staff_password_resets(staff_id);

CREATE INDEX idx_staff_audit_created ON staff_audit_log(created_at);

CREATE TABLE staff_bank_accounts (id TEXT PRIMARY KEY, staff_id TEXT NOT NULL, bank_name TEXT NOT NULL, account_number TEXT NOT NULL, account_name TEXT NOT NULL, paystack_recipient_code TEXT, is_default INTEGER DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, FOREIGN KEY (staff_id) REFERENCES staff(id));

CREATE TABLE payroll (id TEXT PRIMARY KEY, reference TEXT UNIQUE NOT NULL, staff_id TEXT NOT NULL, period TEXT NOT NULL, basic_salary REAL DEFAULT 0, allowances REAL DEFAULT 0, bonuses REAL DEFAULT 0, commission REAL DEFAULT 0, overtime REAL DEFAULT 0, deductions REAL DEFAULT 0, penalty REAL DEFAULT 0, tax REAL DEFAULT 0, pension REAL DEFAULT 0, loan_repayment REAL DEFAULT 0, gross_salary REAL DEFAULT 0, net_salary REAL DEFAULT 0, status TEXT DEFAULT 'pending', payment_reference TEXT, payment_method TEXT DEFAULT 'paystack_transfer', payslip_url TEXT, notes TEXT, approved_by TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, FOREIGN KEY (staff_id) REFERENCES staff(id));

CREATE TABLE staff_wallets (id TEXT PRIMARY KEY, staff_id TEXT UNIQUE NOT NULL, balance REAL DEFAULT 0, total_earned REAL DEFAULT 0, total_withdrawn REAL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, FOREIGN KEY (staff_id) REFERENCES staff(id));

CREATE TABLE wallet_transactions (id TEXT PRIMARY KEY, staff_id TEXT NOT NULL, wallet_id TEXT NOT NULL, type TEXT NOT NULL, amount REAL NOT NULL, description TEXT, reference TEXT UNIQUE, balance_before REAL, balance_after REAL, source TEXT, created_at INTEGER NOT NULL, FOREIGN KEY (staff_id) REFERENCES staff(id), FOREIGN KEY (wallet_id) REFERENCES staff_wallets(id));

CREATE TABLE staff_id_counter (prefix TEXT PRIMARY KEY, last_number INTEGER DEFAULT 0);

CREATE TABLE staff_documents (id TEXT PRIMARY KEY, staff_id TEXT NOT NULL, document_type TEXT NOT NULL, document_name TEXT NOT NULL, file_url TEXT, file_key TEXT, file_size INTEGER, mime_type TEXT, verification_status TEXT DEFAULT 'pending', verified_by TEXT, verified_at TEXT, expiry_date TEXT, notes TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT, FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE);

CREATE TABLE staff_skills (id TEXT PRIMARY KEY, staff_id TEXT NOT NULL, skill_name TEXT NOT NULL, proficiency_level TEXT DEFAULT 'beginner', years_experience REAL DEFAULT 0, is_verified BOOLEAN DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE);

CREATE TABLE staff_attendance (id TEXT PRIMARY KEY, staff_id TEXT NOT NULL, date TEXT NOT NULL, clock_in TEXT, clock_out TEXT, status TEXT DEFAULT 'present', late_minutes INTEGER DEFAULT 0, early_departure_minutes INTEGER DEFAULT 0, overtime_minutes INTEGER DEFAULT 0, notes TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE);

CREATE TABLE staff_leave_requests (id TEXT PRIMARY KEY, staff_id TEXT NOT NULL, leave_type TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, reason TEXT, status TEXT DEFAULT 'pending', approved_by TEXT, approved_at TEXT, rejection_reason TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT, FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE);

CREATE TABLE staff_performance_reviews (id TEXT PRIMARY KEY, staff_id TEXT NOT NULL, reviewer_id TEXT NOT NULL, review_period TEXT NOT NULL, rating REAL, strengths TEXT, improvements TEXT, goals TEXT, status TEXT DEFAULT 'draft', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT, FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE);

CREATE TABLE notification_preferences (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, email_notifications BOOLEAN DEFAULT 1, sms_notifications BOOLEAN DEFAULT 0, push_notifications BOOLEAN DEFAULT 1, session_alerts BOOLEAN DEFAULT 1, payment_alerts BOOLEAN DEFAULT 1, payroll_alerts BOOLEAN DEFAULT 1, system_alerts BOOLEAN DEFAULT 1, marketing_emails BOOLEAN DEFAULT 0, quiet_hours_start TEXT, quiet_hours_end TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT, UNIQUE(user_id));

CREATE TABLE login_history (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, login_at TEXT DEFAULT (datetime('now')), ip_address TEXT, user_agent TEXT, device_type TEXT, browser TEXT, os TEXT, location TEXT, is_successful BOOLEAN DEFAULT 1, failure_reason TEXT, logout_at TEXT, session_duration INTEGER);

CREATE INDEX idx_staff_documents_staff_id ON staff_documents(staff_id);

CREATE INDEX idx_staff_attendance_staff_date ON staff_attendance(staff_id, date);

CREATE INDEX idx_login_history_user_id ON login_history(user_id);

CREATE INDEX idx_notification_prefs_user_id ON notification_preferences(user_id);

CREATE TABLE challenges (
  reference TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  ip TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('otp', 'captcha', 'turnstile')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'verified', 'expired')),
  otp_hash TEXT,
  captcha_nonce TEXT,
  used INTEGER NOT NULL DEFAULT 0,
  verified_via TEXT,
  verified_ip TEXT,
  verified_at INTEGER,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX idx_challenges_fingerprint ON challenges(fingerprint);

CREATE INDEX idx_challenges_ip ON challenges(ip);

CREATE INDEX idx_challenges_status ON challenges(status);

CREATE INDEX idx_challenges_expires ON challenges(expires_at);

CREATE TABLE otp_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT NOT NULL,
  ip TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  attempted_at INTEGER NOT NULL,
  success INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_otp_attempts_ref ON otp_attempts(reference);

CREATE INDEX idx_otp_attempts_ip ON otp_attempts(ip);

CREATE INDEX idx_otp_attempts_time ON otp_attempts(attempted_at);

CREATE TABLE verification_locks (
  reference TEXT PRIMARY KEY,
  acquired_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE blacklist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('fingerprint', 'ip')),
  value TEXT NOT NULL,
  reason TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  UNIQUE(type, value)
);

CREATE INDEX idx_blacklist_type_value ON blacklist(type, value);

CREATE INDEX idx_blacklist_expires ON blacklist(expires_at);

CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  reset_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_rate_limits_reset ON rate_limits(reset_at);

CREATE TABLE sessions (
  jti TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT,
  fingerprint TEXT,
  ip TEXT,
  session_data TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
, createdAt INTEGER);

CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE INDEX idx_sessions_expires ON sessions(expires_at);

CREATE TABLE wishlist (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, product_id TEXT NOT NULL, priority TEXT DEFAULT 'medium', created_at INTEGER DEFAULT (unixepoch()), notes TEXT DEFAULT '', updated_at INTEGER DEFAULT (unixepoch()), price_alert_enabled INTEGER DEFAULT 0, price_alert_threshold REAL, price_alert_triggered INTEGER DEFAULT 0, added_at INTEGER DEFAULT (unixepoch()), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE, UNIQUE(user_id, product_id));

CREATE TABLE wishlist_alerts (id TEXT PRIMARY KEY, wishlist_id TEXT NOT NULL, target_price REAL NOT NULL, active INTEGER DEFAULT 1, created_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()), triggered_at INTEGER, FOREIGN KEY (wishlist_id) REFERENCES wishlist(id) ON DELETE CASCADE);

CREATE TABLE wishlist_shares (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, share_token TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL, created_at INTEGER DEFAULT (unixepoch()), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE);

CREATE INDEX idx_wishlist_user ON wishlist(user_id);

CREATE INDEX idx_wishlist_product ON wishlist(product_id);

CREATE INDEX idx_wishlist_alerts_wishlist ON wishlist_alerts(wishlist_id);

CREATE INDEX idx_wishlist_shares_token ON wishlist_shares(share_token);

CREATE TABLE cart (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  variant TEXT,
  notes TEXT DEFAULT '',
  active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE cart_saved (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  variant TEXT,
  active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE cart_discounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  code TEXT NOT NULL,
  discount_id TEXT,
  amount INTEGER DEFAULT 0,
  applied_at INTEGER DEFAULT (unixepoch())
, active INTEGER DEFAULT 1);

CREATE TABLE discount_codes (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  type TEXT DEFAULT 'percentage',
  value INTEGER NOT NULL,
  description TEXT,
  min_amount INTEGER,
  max_uses INTEGER,
  times_used INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  expires_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
, label TEXT);

CREATE INDEX idx_cart_user ON cart(user_id);

CREATE INDEX idx_cart_product ON cart(product_id);

CREATE INDEX idx_cart_active ON cart(active);

CREATE INDEX idx_cart_saved_user ON cart_saved(user_id);

CREATE INDEX idx_cart_saved_product ON cart_saved(product_id);

CREATE INDEX idx_cart_saved_active ON cart_saved(active);

CREATE INDEX idx_cart_discounts_user ON cart_discounts(user_id);

CREATE INDEX idx_discount_codes_code ON discount_codes(code);

CREATE INDEX idx_discount_codes_active ON discount_codes(active);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  parent_id TEXT,
  display_order INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_categories_parent ON categories(parent_id);

CREATE INDEX idx_categories_slug ON categories(slug);

CREATE INDEX idx_categories_active ON categories(active);

CREATE INDEX idx_categories_display_order ON categories(display_order);

CREATE TABLE blocked_ips (
    id TEXT PRIMARY KEY,
    ip TEXT NOT NULL UNIQUE,
    reason TEXT,
    blocked_by TEXT,
    expires_at TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_blocked_ips_ip ON blocked_ips(ip);

CREATE INDEX idx_blocked_ips_active ON blocked_ips(active);

CREATE INDEX idx_blocked_ips_expires_at ON blocked_ips(expires_at);

CREATE TABLE job_postings (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    department TEXT,
    location TEXT,
    employment_type TEXT,
    experience_level TEXT,
    salary_range TEXT,
    description TEXT,
    requirements TEXT,
    benefits TEXT,
    posted_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    application_deadline DATETIME,
    is_active BOOLEAN DEFAULT 1,
    is_featured BOOLEAN DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE job_applications (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    tracking_token TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    current_company TEXT,
    current_title TEXT,
    years_experience INTEGER,
    cover_letter TEXT,
    resume_url TEXT,
    portfolio_url TEXT,
    linkedin_url TEXT,
    github_url TEXT,
    status TEXT DEFAULT 'submitted',
    notes TEXT,
    internal_notes TEXT,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    referral_source TEXT,
    FOREIGN KEY (job_id) REFERENCES job_postings(id) ON DELETE CASCADE
);

CREATE TABLE application_documents (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL,
    document_type TEXT,
    file_name TEXT,
    file_url TEXT,
    file_size INTEGER,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES job_applications(id) ON DELETE CASCADE
);

CREATE TABLE application_status_history (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL,
    status TEXT NOT NULL,
    note TEXT,
    changed_by TEXT,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES job_applications(id) ON DELETE CASCADE
);

CREATE TABLE job_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE job_skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    category TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE job_skills_mapping (
    job_id TEXT NOT NULL,
    skill_id TEXT NOT NULL,
    PRIMARY KEY (job_id, skill_id),
    FOREIGN KEY (job_id) REFERENCES job_postings(id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES job_skills(id) ON DELETE CASCADE
);

CREATE TABLE quotes (
  id TEXT PRIMARY KEY,
  quote_number TEXT UNIQUE NOT NULL,
  customer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
  staff_id TEXT REFERENCES staff(id) ON DELETE SET NULL,
  project_name TEXT,
  project_type TEXT CHECK(project_type IN ('residential', 'commercial', 'industrial', 'infrastructure', 'renovation', 'other')),
  project_size TEXT,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'pending', 'sent', 'reviewed', 'approved', 'rejected', 'converted', 'expired')),
  subtotal REAL DEFAULT 0,
  discount REAL DEFAULT 0,
  discount_type TEXT CHECK(discount_type IN ('percentage', 'fixed')),
  discount_reason TEXT,
  tax REAL DEFAULT 0,
  delivery_fee REAL DEFAULT 0,
  total REAL DEFAULT 0,
  currency TEXT DEFAULT 'NGN',
  valid_until TEXT,
  notes TEXT,
  terms_conditions TEXT,
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_at TEXT,
  converted_to_order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE quote_items (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_sku TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price REAL DEFAULT 0,
  total REAL DEFAULT 0,
  discount REAL DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE quote_status_history (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE contractor_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  registration_number TEXT,
  tax_id TEXT,
  years_in_business INTEGER DEFAULT 0,
  project_types TEXT, -- JSON array: ["residential", "commercial", "industrial"]
  preferred_brands TEXT, -- JSON array: ["Dangote", "BUA", "Dulux"]
  credit_limit REAL DEFAULT 0,
  credit_used REAL DEFAULT 0,
  payment_terms TEXT CHECK(payment_terms IN ('cash', '14_days', '30_days', '45_days', '60_days', 'project_completion')),
  discount_rate REAL DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'suspended', 'pending_verification')),
  verification_documents TEXT, -- JSON array of document URLs
  verified_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  verified_at TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE contractor_projects (
  id TEXT PRIMARY KEY,
  contractor_id TEXT NOT NULL REFERENCES contractor_accounts(id) ON DELETE CASCADE,
  project_name TEXT NOT NULL,
  project_type TEXT,
  project_value REAL,
  start_date TEXT,
  end_date TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'on_hold', 'cancelled')),
  address TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE delivery_regions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  states TEXT, -- JSON array: ["Edo", "Delta", "Lagos"]
  cities TEXT, -- JSON array: ["Benin City", "Warri", "Lagos Island"]
  base_price REAL DEFAULT 0,
  price_per_km REAL DEFAULT 0,
  min_order_value REAL DEFAULT 0,
  estimated_days TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
, state TEXT);

CREATE TABLE deliveries (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  quote_id TEXT REFERENCES quotes(id) ON DELETE SET NULL,
  delivery_reference TEXT UNIQUE NOT NULL,
  customer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  delivery_address TEXT NOT NULL,
  region_id TEXT REFERENCES delivery_regions(id),
  zone_id TEXT REFERENCES delivery_zones(id),
  items JSON, -- JSON array of items
  subtotal REAL DEFAULT 0,
  delivery_fee REAL DEFAULT 0,
  total REAL DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'dispatched', 'in_transit', 'delivered', 'failed', 'returned')),
  driver_name TEXT,
  driver_phone TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  scheduled_date TEXT,
  delivered_at TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bulk_orders (
  id TEXT PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  customer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  company_name TEXT,
  branch_id TEXT REFERENCES branches(id),
  staff_id TEXT REFERENCES staff(id),
  project_name TEXT,
  project_type TEXT CHECK(project_type IN ('residential', 'commercial', 'industrial', 'infrastructure', 'government', 'other')),
  requirements TEXT,
  budget_range TEXT,
  timeline TEXT,
  delivery_address TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'reviewing', 'quoted', 'approved', 'processing', 'completed', 'cancelled')),
  priority TEXT DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bulk_order_items (
  id TEXT PRIMARY KEY,
  bulk_order_id TEXT NOT NULL REFERENCES bulk_orders(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit TEXT,
  specifications TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE construction_brands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  website TEXT,
  description TEXT,
  category TEXT, -- which category this brand specializes in
  country TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
  display_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE construction_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  project_type TEXT CHECK(project_type IN ('residential', 'commercial', 'industrial', 'infrastructure', 'renovation')),
  status TEXT DEFAULT 'completed' CHECK(status IN ('planning', 'ongoing', 'completed', 'featured')),
  location TEXT,
  images TEXT, -- JSON array of image URLs
  start_date TEXT,
  completion_date TEXT,
  contractor_id TEXT REFERENCES contractor_accounts(id) ON DELETE SET NULL,
  client_name TEXT,
  materials_used TEXT, -- JSON array of product IDs
  testimonial TEXT,
  testimonial_author TEXT,
  featured INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
, budget REAL DEFAULT 0, total_value REAL DEFAULT 0);

CREATE INDEX idx_quotes_customer_id ON quotes(customer_id);

CREATE INDEX idx_quotes_status ON quotes(status);

CREATE INDEX idx_quotes_created_at ON quotes(created_at);

CREATE INDEX idx_quotes_quote_number ON quotes(quote_number);

CREATE INDEX idx_quote_items_quote_id ON quote_items(quote_id);

CREATE INDEX idx_quote_items_product_id ON quote_items(product_id);

CREATE INDEX idx_contractor_accounts_user_id ON contractor_accounts(user_id);

CREATE INDEX idx_contractor_accounts_status ON contractor_accounts(status);

CREATE INDEX idx_contractor_projects_contractor_id ON contractor_projects(contractor_id);

CREATE INDEX idx_deliveries_order_id ON deliveries(order_id);

CREATE INDEX idx_deliveries_quote_id ON deliveries(quote_id);

CREATE INDEX idx_deliveries_status ON deliveries(status);

CREATE INDEX idx_deliveries_delivery_reference ON deliveries(delivery_reference);

CREATE INDEX idx_bulk_orders_customer_id ON bulk_orders(customer_id);

CREATE INDEX idx_bulk_orders_status ON bulk_orders(status);

CREATE INDEX idx_bulk_order_items_bulk_order_id ON bulk_order_items(bulk_order_id);

CREATE INDEX idx_construction_projects_slug ON construction_projects(slug);

CREATE INDEX idx_construction_projects_featured ON construction_projects(featured);

CREATE TRIGGER update_quote_total
AFTER INSERT ON quote_items
BEGIN
  UPDATE quotes SET 
    subtotal = (
      SELECT COALESCE(SUM(total), 0) 
      FROM quote_items 
      WHERE quote_id = NEW.quote_id
    ),
    total = (
      SELECT COALESCE(SUM(total), 0) 
      FROM quote_items 
      WHERE quote_id = NEW.quote_id
    ) + COALESCE(delivery_fee, 0) + COALESCE(tax, 0) - COALESCE(discount, 0),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.quote_id;
END;

CREATE TRIGGER update_quote_total_on_update
AFTER UPDATE ON quote_items
BEGIN
  UPDATE quotes SET 
    subtotal = (
      SELECT COALESCE(SUM(total), 0) 
      FROM quote_items 
      WHERE quote_id = NEW.quote_id
    ),
    total = (
      SELECT COALESCE(SUM(total), 0) 
      FROM quote_items 
      WHERE quote_id = NEW.quote_id
    ) + COALESCE(delivery_fee, 0) + COALESCE(tax, 0) - COALESCE(discount, 0),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.quote_id;
END;

CREATE TRIGGER update_quote_total_on_delete
AFTER DELETE ON quote_items
BEGIN
  UPDATE quotes SET 
    subtotal = (
      SELECT COALESCE(SUM(total), 0) 
      FROM quote_items 
      WHERE quote_id = OLD.quote_id
    ),
    total = (
      SELECT COALESCE(SUM(total), 0) 
      FROM quote_items 
      WHERE quote_id = OLD.quote_id
    ) + COALESCE(delivery_fee, 0) + COALESCE(tax, 0) - COALESCE(discount, 0),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = OLD.quote_id;
END;

CREATE TRIGGER quote_status_history_trigger
AFTER UPDATE OF status ON quotes
BEGIN
  INSERT INTO quote_status_history (id, quote_id, old_status, new_status, changed_by, created_at)
  VALUES (
    uuid(),
    NEW.id,
    OLD.status,
    NEW.status,
    NULL,
    CURRENT_TIMESTAMP
  );
END;

CREATE TABLE ai_conversations (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, fingerprint TEXT DEFAULT '', user_message TEXT, assistant_reply TEXT, sentiment TEXT DEFAULT 'neutral', urgency INTEGER DEFAULT 0, model TEXT DEFAULT 'unknown', intent TEXT DEFAULT 'general', user_id TEXT, createdAt INTEGER DEFAULT (unixepoch()));

CREATE TABLE ai_analytics (id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT, event_data TEXT, analysis TEXT, createdAt INTEGER DEFAULT (unixepoch()));

CREATE TABLE logs (id INTEGER PRIMARY KEY AUTOINCREMENT, level TEXT, message TEXT, source TEXT, createdAt INTEGER DEFAULT (unixepoch()), event_type TEXT, description TEXT, user TEXT, details TEXT, timestamp DATETIME);

CREATE TABLE security_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT, details TEXT, ip TEXT, createdAt INTEGER DEFAULT (unixepoch()));

CREATE INDEX idx_ai_conversations_session ON ai_conversations(session_id);

CREATE INDEX idx_ai_conversations_created ON ai_conversations(createdAt);

CREATE INDEX idx_ai_conversations_sentiment ON ai_conversations(sentiment);

CREATE INDEX idx_ai_conversations_fingerprint ON ai_conversations(fingerprint);

CREATE INDEX idx_ai_analytics_created ON ai_analytics(createdAt);

CREATE INDEX idx_logs_created ON logs(createdAt);

CREATE INDEX idx_security_logs_created ON security_logs(createdAt);

CREATE TABLE brands (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, logo_url TEXT, product_count INTEGER DEFAULT 0, created_at INTEGER DEFAULT (unixepoch()));

CREATE TABLE knowledge_articles (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, excerpt TEXT, content TEXT, category TEXT, read_time INTEGER, author TEXT, helpful_count INTEGER DEFAULT 0, created_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()));

CREATE TABLE cart_items (id INTEGER PRIMARY KEY AUTOINCREMENT, fingerprint TEXT, product_id INTEGER, quantity INTEGER, created_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()));

CREATE TABLE wishlist_items (id INTEGER PRIMARY KEY AUTOINCREMENT, fingerprint TEXT, product_id INTEGER, created_at INTEGER DEFAULT (unixepoch()));

CREATE TABLE search_history (id INTEGER PRIMARY KEY AUTOINCREMENT, fingerprint TEXT, search_term TEXT, created_at INTEGER DEFAULT (unixepoch()));

CREATE TABLE subscriptions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, plan TEXT NOT NULL CHECK(plan IN ('standard','pro','business')), status TEXT NOT NULL CHECK(status IN ('active','inactive','cancelled','expired')), auto_renew BOOLEAN DEFAULT 1, start_date DATETIME NOT NULL, end_date DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE);

CREATE TABLE user_integrations (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, integration_type TEXT NOT NULL CHECK(integration_type IN ('email','whatsapp','sms','paystack','analytics','shipping')), provider TEXT NOT NULL, access_token TEXT, refresh_token TEXT, settings JSON, is_connected BOOLEAN DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, UNIQUE(user_id, integration_type));

CREATE TABLE user_preferences (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, preference_key TEXT NOT NULL, preference_value TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, UNIQUE(user_id, preference_key));

CREATE TABLE activity_log (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, activity_type TEXT NOT NULL CHECK(activity_type IN ('order','login','logout','profile','payment','security','referral','subscription','integration')), activity_data JSON, ip_address TEXT, user_agent TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);

CREATE INDEX idx_subscriptions_status ON subscriptions(status);

CREATE INDEX idx_referrals_status ON referrals(status);

CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);

CREATE INDEX idx_activity_log_created_at ON activity_log(created_at);

CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);

CREATE INDEX idx_user_integrations_user_id ON user_integrations(user_id);

CREATE INDEX idx_user_integrations_integration_type ON user_integrations(integration_type);

CREATE INDEX idx_referrals_referred_user_id ON referrals(referred_user_id);

CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE, phone TEXT, address TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, franchise_id TEXT);

CREATE TABLE delivery_vehicles (id TEXT PRIMARY KEY, name TEXT, plate_number TEXT, capacity REAL, status TEXT DEFAULT 'active', region_id TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE warehouses (id TEXT PRIMARY KEY, name TEXT, location TEXT, capacity REAL, status TEXT DEFAULT 'active', created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE delivery_zones (
    id TEXT PRIMARY KEY,
    name TEXT,
    region_id TEXT,
    price REAL,
    estimated_days TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_reference ON orders(reference);

CREATE INDEX idx_orders_tracking ON orders(trackingId);

CREATE INDEX idx_orders_created ON orders(created_at);

CREATE TABLE analytics_events (
                  id TEXT PRIMARY KEY,
                  session_id TEXT,
                  user_id TEXT,
                  event_type TEXT,
                  event_data TEXT,
                  timestamp INTEGER,
                  url TEXT,
                  user_agent TEXT,
                  fingerprint TEXT,
                  ip TEXT,
                  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
                );

CREATE INDEX idx_users_createdAt ON users(createdAt);

CREATE INDEX idx_staff_createdAt ON staff(createdAt);

CREATE TABLE cart_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT REFERENCES users(id), session_id TEXT, items TEXT, discount_code TEXT, shipping_method TEXT, expires_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE saved_items (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT REFERENCES users(id), product_id TEXT REFERENCES products(id), saved_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, product_id));

CREATE INDEX idx_cart_user_id ON cart(user_id);

CREATE INDEX idx_cart_product_id ON cart(product_id);

CREATE INDEX idx_cart_saved_user_id ON cart_saved(user_id);

CREATE INDEX idx_cart_saved_product_id ON cart_saved(product_id);

CREATE INDEX idx_cart_sessions_session_id ON cart_sessions(session_id);

CREATE TABLE checkout (id TEXT PRIMARY KEY, session_id TEXT, user_id TEXT, items TEXT, customerName TEXT, customerEmail TEXT, customerPhone TEXT, deliveryAddress TEXT, city TEXT, state TEXT, subtotal REAL, shipping_cost INTEGER, vat INTEGER, fee INTEGER, total REAL, paymentMethod TEXT, discount_code TEXT, status TEXT DEFAULT 'active', created_at INTEGER, updated_at INTEGER, FOREIGN KEY (user_id) REFERENCES users(id));

CREATE INDEX idx_checkout_session ON checkout(session_id);

CREATE INDEX idx_checkout_user ON checkout(user_id);

CREATE INDEX idx_checkout_status ON checkout(status);

CREATE TABLE wholesale_codes (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, description TEXT, discount_percent INTEGER DEFAULT 15, tier TEXT DEFAULT 'wholesale', max_uses INTEGER DEFAULT 100, times_used INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, created_at INTEGER, updated_at INTEGER);

CREATE INDEX idx_wholesale_codes_code ON wholesale_codes(code);

CREATE INDEX idx_wholesale_codes_active ON wholesale_codes(is_active);

CREATE TABLE user_discount_usage (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, discount_code TEXT NOT NULL, used_at INTEGER, order_id TEXT, FOREIGN KEY (user_id) REFERENCES users(id), FOREIGN KEY (order_id) REFERENCES orders(id));

CREATE INDEX idx_user_discount_usage_user_code ON user_discount_usage(user_id, discount_code);

CREATE INDEX idx_user_discount_usage_order ON user_discount_usage(order_id);

CREATE TABLE cart_shipping (id TEXT PRIMARY KEY, user_id TEXT, state TEXT, price REAL, name TEXT, delivery_time TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, active INTEGER DEFAULT 1, method_id TEXT, method_name TEXT, estimated_days INTEGER);

CREATE INDEX idx_cart_user_active ON cart(user_id, active);

CREATE INDEX idx_user_discount_user ON user_discount_usage(user_id);

CREATE INDEX idx_user_discount_code ON user_discount_usage(discount_code);

CREATE TABLE wholesale_usage (id TEXT PRIMARY KEY, code_id TEXT NOT NULL, user_id TEXT, code_type TEXT DEFAULT 'wholesale', used_at INTEGER, FOREIGN KEY (code_id) REFERENCES wholesale_codes(id), FOREIGN KEY (user_id) REFERENCES users(id));

CREATE INDEX idx_wholesale_usage_code ON wholesale_usage(code_id);

CREATE INDEX idx_wholesale_usage_user ON wholesale_usage(user_id);

CREATE TABLE push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  endpoint TEXT UNIQUE NOT NULL,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);

CREATE INDEX idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);

CREATE INDEX idx_push_subscriptions_created_at ON push_subscriptions(created_at);

CREATE INDEX idx_push_subscriptions_last_used ON push_subscriptions(last_used);

CREATE TABLE push_notification_logs (
  id TEXT PRIMARY KEY,
  subscription_id TEXT,
  user_id TEXT,
  title TEXT,
  message TEXT,
  url TEXT,
  status TEXT, -- 'sent', 'failed', 'invalid'
  error TEXT,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subscription_id) REFERENCES push_subscriptions(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_push_logs_subscription_id ON push_notification_logs(subscription_id);

CREATE INDEX idx_push_logs_user_id ON push_notification_logs(user_id);

CREATE INDEX idx_push_logs_sent_at ON push_notification_logs(sent_at);

CREATE INDEX idx_push_logs_status ON push_notification_logs(status);

CREATE TRIGGER update_push_subscriptions_updated_at
AFTER UPDATE ON push_subscriptions
BEGIN
  UPDATE push_subscriptions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TABLE chat_rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT CHECK(type IN ('general', 'announcement', 'help', 'direct', 'team')),
  description TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE chat_read_receipts (
  message_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (message_id, user_id),
  FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE chat_user_settings (
  user_id TEXT PRIMARY KEY,
  notifications_enabled BOOLEAN DEFAULT 1,
  sound_enabled BOOLEAN DEFAULT 1,
  theme TEXT DEFAULT 'dark',
  muted_rooms TEXT DEFAULT '[]', -- JSON array of muted room IDs
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_chat_read_receipts_user_id ON chat_read_receipts(user_id);

CREATE INDEX idx_chat_read_receipts_message_id ON chat_read_receipts(message_id);

CREATE TRIGGER update_chat_rooms_updated_at
AFTER UPDATE ON chat_rooms
BEGIN
  UPDATE chat_rooms SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TABLE chat_private_rooms (id TEXT PRIMARY KEY, room_name TEXT, is_group INTEGER DEFAULT 0, created_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (created_by) REFERENCES users(id));

CREATE TABLE chat_private_members (room_id TEXT NOT NULL, user_id TEXT NOT NULL, joined_at DATETIME DEFAULT CURRENT_TIMESTAMP, last_read_at DATETIME DEFAULT CURRENT_TIMESTAMP, is_admin INTEGER DEFAULT 0, PRIMARY KEY (room_id, user_id), FOREIGN KEY (room_id) REFERENCES chat_private_rooms(id), FOREIGN KEY (user_id) REFERENCES users(id));

CREATE TABLE chat_room_permissions (room_id TEXT NOT NULL, user_id TEXT, role TEXT NOT NULL, can_post INTEGER DEFAULT 1, can_read INTEGER DEFAULT 1, can_invite INTEGER DEFAULT 0, granted_at DATETIME DEFAULT CURRENT_TIMESTAMP, granted_by TEXT, PRIMARY KEY (room_id, user_id), FOREIGN KEY (room_id) REFERENCES chat_rooms(id), FOREIGN KEY (user_id) REFERENCES users(id));

CREATE TABLE chat_messages (id TEXT PRIMARY KEY, room_id TEXT NOT NULL, sender_id TEXT NOT NULL, recipient_id TEXT, message TEXT NOT NULL, message_type TEXT DEFAULT 'text', file_url TEXT, file_name TEXT, file_size INTEGER, read_at DATETIME, delivered_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);

CREATE INDEX idx_chat_messages_room_id ON chat_messages(room_id);

CREATE INDEX idx_chat_messages_sender_id ON chat_messages(sender_id);

CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);

CREATE INDEX idx_push_user_id ON push_subscriptions(user_id)
    ;

CREATE INDEX idx_push_endpoint ON push_subscriptions(endpoint)
    ;

CREATE INDEX idx_chat_messages_recipient_id ON chat_messages(recipient_id);

CREATE TRIGGER update_chat_messages_updated_at
AFTER UPDATE ON chat_messages
BEGIN
  UPDATE chat_messages SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TABLE "session_analytics" (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), session_id TEXT NOT NULL REFERENCES sessions(jti) ON DELETE CASCADE, start_time INTEGER NOT NULL, end_time INTEGER, duration INTEGER, device_type TEXT, battery_start INTEGER, battery_end INTEGER, amount DECIMAL(10,2), status TEXT, peak_hour BOOLEAN DEFAULT 0, metadata TEXT, created_at INTEGER DEFAULT (unixepoch()));

CREATE VIEW ai_analytics_daily AS SELECT date(createdAt, 'unixepoch') as date, COUNT(*) as total_queries, SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END) as positive_count, SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END) as negative_count, SUM(CASE WHEN sentiment = 'neutral' THEN 1 ELSE 0 END) as neutral_count, SUM(CASE WHEN urgency = 1 THEN 1 ELSE 0 END) as urgent_count, COUNT(DISTINCT fingerprint) as unique_users, COUNT(DISTINCT session_id) as unique_sessions FROM ai_conversations GROUP BY date(createdAt, 'unixepoch') ORDER BY date DESC;

CREATE TABLE franchises (id TEXT PRIMARY KEY, user_id TEXT UNIQUE, application_id TEXT UNIQUE, business_name TEXT NOT NULL, owner_name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT, tier TEXT DEFAULT 'starter', status TEXT DEFAULT 'pending', region TEXT, address TEXT, application_data TEXT, approved_at TEXT, approved_by TEXT, rejected_at TEXT, rejection_reason TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));

CREATE INDEX idx_franchises_user_id ON franchises(user_id);

CREATE INDEX idx_franchises_status ON franchises(status);

CREATE INDEX idx_franchises_email ON franchises(email);



-- ============================================================
-- Reviews (added 2026-10-25)
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created ON reviews(created_at DESC);

-- ============================================================
-- Reviews (added 2026-10-25, standardized)
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created ON reviews(created_at DESC);
