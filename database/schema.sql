-- =====================================================
-- PrimeShieldHub - Complete Database Schema (v9.0)
-- FULLY ALIGNED with Worker v9 Security Enhancements
-- =====================================================

-- =====================================================
-- USERS & AUTHENTICATION (HASHED PASSWORDS)
-- =====================================================

-- Users table – now stores password_hash and password_salt (PBKDF2)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,      -- PBKDF2 hash (hex)
  password_salt TEXT NOT NULL,      -- comma-separated bytes
  name TEXT,
  phone TEXT,
  role TEXT DEFAULT 'user',
  adminLevel TEXT,
  isAdmin INTEGER DEFAULT 0,
  disabled INTEGER DEFAULT 0,
  suspended INTEGER DEFAULT 0,
  emailVerified INTEGER DEFAULT 0,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER,
  created_at INTEGER
);

-- OTP Codes (2FA / Password Reset)
CREATE TABLE IF NOT EXISTS otp_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  verified INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Biometric Credentials (WebAuthn)
CREATE TABLE IF NOT EXISTS biometric_credentials (
  id TEXT PRIMARY KEY,
  staff_id TEXT,
  credential_id TEXT UNIQUE,
  public_key TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (staff_id) REFERENCES staff(id)
);

-- =====================================================
-- PRODUCTS & ORDERS
-- =====================================================

-- Products
CREATE TABLE IF NOT EXISTS products (
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
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  amount REAL NOT NULL,
  status TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- =====================================================
-- TRANSACTIONS & PAYMENTS
-- =====================================================

-- Transactions (Paystack/Payment Gateway)
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT UNIQUE NOT NULL,
  amount REAL NOT NULL,
  email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  paystack_data TEXT,
  metadata TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

-- Payments (Charging session payments)
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  session_id INTEGER,
  branch_id TEXT,
  amount REAL,
  method TEXT,
  status TEXT,
  created_at INTEGER,
  FOREIGN KEY (session_id) REFERENCES charging_sessions(id)
);

-- Payment Logs (Fraud tracking)
CREATE TABLE IF NOT EXISTS payment_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fingerprint TEXT NOT NULL,
  ip TEXT NOT NULL,
  reference TEXT NOT NULL,
  amount INTEGER NOT NULL,
  email TEXT NOT NULL,
  success INTEGER NOT NULL,
  response TEXT,
  timestamp INTEGER NOT NULL,
  fraud_risk INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- =====================================================
-- CHARGING SESSIONS & STAFF (HASHED PIN)
-- =====================================================

-- Charging Sessions
CREATE TABLE IF NOT EXISTS charging_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT,
  device_type TEXT,
  amount REAL,
  staff TEXT,
  branch_id TEXT,
  status TEXT DEFAULT 'charging',
  start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  end_time DATETIME,
  duration INTEGER
);

-- Staff – now stores pin_hash and pin_salt
CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  name TEXT,
  phone TEXT,
  role TEXT,
  pin_hash TEXT NOT NULL,           -- PBKDF2 hash
  pin_salt TEXT NOT NULL,           -- salt bytes
  branch_id TEXT,
  score INTEGER DEFAULT 100,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Staff Logs
CREATE TABLE IF NOT EXISTS staff_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id TEXT,
  action TEXT,
  session_id INTEGER,
  amount REAL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (staff_id) REFERENCES staff(id)
);

-- Legacy Charges (deprecated, kept for compatibility)
CREATE TABLE IF NOT EXISTS charges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT,
  device TEXT,
  amount INTEGER,
  staff TEXT,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- RECEIPT & NOTIFICATION SYSTEM
-- =====================================================

-- Receipt Delivery Logs
CREATE TABLE IF NOT EXISTS receipt_delivery_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT NOT NULL,
  channel TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  sent_at INTEGER NOT NULL
);

-- WhatsApp Queue
CREATE TABLE IF NOT EXISTS whatsapp_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  receipt_data TEXT,
  status TEXT DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  sent_at INTEGER
);

-- SMS Logs
CREATE TABLE IF NOT EXISTS sms_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  receipt_reference TEXT,
  status TEXT,
  sent_at INTEGER NOT NULL
);

-- Email Logs
CREATE TABLE IF NOT EXISTS email_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  receipt_reference TEXT,
  status TEXT,
  sent_at INTEGER NOT NULL
);

-- =====================================================
-- DISPUTES & EVIDENCE
-- =====================================================

-- Disputes
CREATE TABLE IF NOT EXISTS disputes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT NOT NULL,
  amount REAL NOT NULL,
  customer_email TEXT,
  status TEXT DEFAULT 'open',
  resolution TEXT,
  created_at INTEGER NOT NULL,
  resolved_at INTEGER
);

-- Evidence (Fraud evidence)
CREATE TABLE IF NOT EXISTS evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  ip TEXT NOT NULL,
  email TEXT NOT NULL,
  amount INTEGER NOT NULL,
  product_id TEXT,
  risk_score INTEGER NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  staff_id TEXT,
  session_id INTEGER,
  image_url TEXT,
  captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- =====================================================
-- FRANCHISE SYSTEM (HASHED PASSWORDS)
-- =====================================================

-- Branches
CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  name TEXT,
  location TEXT,
  manager_id TEXT,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Franchise Applications
CREATE TABLE IF NOT EXISTS franchise_applications (
  id TEXT PRIMARY KEY,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  location TEXT,
  capital TEXT,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Franchise Contracts
CREATE TABLE IF NOT EXISTS franchise_contracts (
  id TEXT PRIMARY KEY,
  application_id TEXT,
  signed INTEGER DEFAULT 0,
  document_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES franchise_applications(id)
);

-- Franchise Accounts – now stores password_hash and password_salt
CREATE TABLE IF NOT EXISTS franchise_accounts (
  id TEXT PRIMARY KEY,
  branch_id TEXT,
  owner_name TEXT,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id)
);

-- Franchise Commissions
CREATE TABLE IF NOT EXISTS franchise_commissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id TEXT,
  total_revenue REAL,
  your_cut REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id)
);

-- =====================================================
-- RESELLER SYSTEM
-- =====================================================

-- Resellers
CREATE TABLE IF NOT EXISTS resellers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  location TEXT,
  code TEXT UNIQUE,
  createdAt INTEGER NOT NULL
);

-- Reseller Codes
CREATE TABLE IF NOT EXISTS reseller_codes (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE,
  discount REAL,
  tier TEXT,
  maxUses INTEGER,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  dailyUsageLimit INTEGER,
  rateLimit INTEGER,
  expiryDate INTEGER,
  expiry_date INTEGER,
  singleUse INTEGER,
  suspiciousThreshold INTEGER,
  accountStatus TEXT,
  active INTEGER DEFAULT 1,
  allowedCountries TEXT,
  blockedCountries TEXT,
  createdAt INTEGER NOT NULL
);

-- =====================================================
-- AI & LEARNING SYSTEM
-- =====================================================

-- AI Memory
CREATE TABLE IF NOT EXISTS ai_memory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT,
  key TEXT UNIQUE,
  value REAL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- AI Patterns
CREATE TABLE IF NOT EXISTS ai_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern_type TEXT,
  description TEXT,
  impact_score REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Predictions (Forecast storage)
CREATE TABLE IF NOT EXISTS predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id TEXT,
  prediction_type TEXT,
  predicted_value REAL,
  actual_value REAL,
  accuracy REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Fraud Patterns
CREATE TABLE IF NOT EXISTS fraud_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern_name TEXT,
  severity INTEGER,
  detection_count INTEGER DEFAULT 1,
  last_detected DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- ANALYTICS & REPORTING
-- =====================================================

-- Daily Stats
CREATE TABLE IF NOT EXISTS daily_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id TEXT,
  total_sessions INTEGER,
  total_revenue REAL,
  date TEXT
);

-- Revenue Logs
CREATE TABLE IF NOT EXISTS revenue_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id TEXT,
  amount REAL,
  source TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Location Logs (GPS Tracking)
CREATE TABLE IF NOT EXISTS location_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id TEXT,
  branch_id TEXT,
  latitude REAL,
  longitude REAL,
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id TEXT,
  type TEXT,
  message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- SYSTEM CONFIGURATION & OPERATIONAL LOGS (NEW)
-- =====================================================

-- System Control (Master switches)
CREATE TABLE IF NOT EXISTS system_control (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Settings (Key-value pairs)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updatedAt INTEGER NOT NULL
);

-- General Logs (for admin dashboard)
CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  user TEXT NOT NULL,
  details TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Autonomous Actions Log
CREATE TABLE IF NOT EXISTS actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  details TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Penalties Log
CREATE TABLE IF NOT EXISTS penalties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id TEXT NOT NULL,
  amount REAL,
  reason TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (staff_id) REFERENCES staff(id)
);

-- Deployment Logs (for AI deployment monitoring)
CREATE TABLE IF NOT EXISTS deploy_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  risk_score INTEGER,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES (UPDATED FOR NEW COLUMNS)
-- =====================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Products indexes
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- Orders indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_createdAt ON orders(createdAt);

-- Transactions indexes
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_email ON transactions(email);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at);

-- Charging sessions indexes
CREATE INDEX IF NOT EXISTS idx_charging_sessions_status ON charging_sessions(status);
CREATE INDEX IF NOT EXISTS idx_charging_sessions_staff ON charging_sessions(staff);
CREATE INDEX IF NOT EXISTS idx_charging_sessions_branch_id ON charging_sessions(branch_id);
CREATE INDEX IF NOT EXISTS idx_charging_sessions_start_time ON charging_sessions(start_time);

-- Staff indexes
CREATE INDEX IF NOT EXISTS idx_staff_branch_id ON staff(branch_id);
CREATE INDEX IF NOT EXISTS idx_staff_score ON staff(score);
CREATE INDEX IF NOT EXISTS idx_staff_status ON staff(status);

-- Staff logs indexes
CREATE INDEX IF NOT EXISTS idx_staff_logs_staff_id ON staff_logs(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_logs_action ON staff_logs(action);
CREATE INDEX IF NOT EXISTS idx_staff_logs_timestamp ON staff_logs(timestamp);

-- Payments indexes
CREATE INDEX IF NOT EXISTS idx_payments_session_id ON payments(session_id);
CREATE INDEX IF NOT EXISTS idx_payments_branch_id ON payments(branch_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

-- Payment logs indexes
CREATE INDEX IF NOT EXISTS idx_payment_logs_reference ON payment_logs(reference);
CREATE INDEX IF NOT EXISTS idx_payment_logs_fingerprint ON payment_logs(fingerprint);

-- Receipt logs indexes
CREATE INDEX IF NOT EXISTS idx_logs_reference ON receipt_delivery_logs(reference);
CREATE INDEX IF NOT EXISTS idx_logs_channel ON receipt_delivery_logs(channel);

-- WhatsApp queue indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_status ON whatsapp_queue(status);

-- SMS/Email logs indexes
CREATE INDEX IF NOT EXISTS idx_sms_phone ON sms_logs(phone);
CREATE INDEX IF NOT EXISTS idx_email_email ON email_logs(email);

-- Disputes indexes
CREATE INDEX IF NOT EXISTS idx_disputes_reference ON disputes(reference);

-- Evidence indexes
CREATE INDEX IF NOT EXISTS idx_evidence_reference ON evidence(reference);
CREATE INDEX IF NOT EXISTS idx_evidence_staff_id ON evidence(staff_id);
CREATE INDEX IF NOT EXISTS idx_evidence_session_id ON evidence(session_id);

-- Daily stats indexes
CREATE INDEX IF NOT EXISTS idx_daily_stats_branch_id ON daily_stats(branch_id);
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date);

-- Alerts indexes
CREATE INDEX IF NOT EXISTS idx_alerts_branch_id ON alerts(branch_id);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);

-- Reseller codes indexes
CREATE INDEX IF NOT EXISTS idx_reseller_codes_active ON reseller_codes(active);
CREATE INDEX IF NOT EXISTS idx_reseller_codes_code ON reseller_codes(code);

-- AI Memory indexes
CREATE INDEX IF NOT EXISTS idx_ai_memory_key ON ai_memory(key);
CREATE INDEX IF NOT EXISTS idx_ai_memory_type ON ai_memory(type);

-- AI Patterns indexes
CREATE INDEX IF NOT EXISTS idx_ai_patterns_type ON ai_patterns(pattern_type);

-- Branches indexes
CREATE INDEX IF NOT EXISTS idx_branches_status ON branches(status);
CREATE INDEX IF NOT EXISTS idx_branches_location ON branches(location);

-- Franchise tables indexes
CREATE INDEX IF NOT EXISTS idx_franchise_applications_status ON franchise_applications(status);
CREATE INDEX IF NOT EXISTS idx_franchise_contracts_application_id ON franchise_contracts(application_id);
CREATE INDEX IF NOT EXISTS idx_franchise_accounts_branch_id ON franchise_accounts(branch_id);
CREATE INDEX IF NOT EXISTS idx_franchise_commissions_branch_id ON franchise_commissions(branch_id);

-- Revenue logs indexes
CREATE INDEX IF NOT EXISTS idx_revenue_logs_branch_id ON revenue_logs(branch_id);
CREATE INDEX IF NOT EXISTS idx_revenue_logs_created_at ON revenue_logs(created_at);

-- Location logs indexes
CREATE INDEX IF NOT EXISTS idx_location_logs_staff_id ON location_logs(staff_id);
CREATE INDEX IF NOT EXISTS idx_location_logs_recorded_at ON location_logs(recorded_at);

-- OTP indexes
CREATE INDEX IF NOT EXISTS idx_otp_codes_user_id ON otp_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_codes_code ON otp_codes(code);

-- Biometric indexes
CREATE INDEX IF NOT EXISTS idx_biometric_staff_id ON biometric_credentials(staff_id);
CREATE INDEX IF NOT EXISTS idx_biometric_credential_id ON biometric_credentials(credential_id);

-- Predictions indexes
CREATE INDEX IF NOT EXISTS idx_predictions_branch_id ON predictions(branch_id);
CREATE INDEX IF NOT EXISTS idx_predictions_created_at ON predictions(created_at);

-- Fraud patterns indexes
CREATE INDEX IF NOT EXISTS idx_fraud_patterns_severity ON fraud_patterns(severity);

-- New logs indexes
CREATE INDEX IF NOT EXISTS idx_logs_type ON logs(type);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_actions_timestamp ON actions(timestamp);
CREATE INDEX IF NOT EXISTS idx_penalties_staff_id ON penalties(staff_id);
CREATE INDEX IF NOT EXISTS idx_deploy_logs_timestamp ON deploy_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_deploy_logs_risk_score ON deploy_logs(risk_score);

-- =====================================================
-- DEFAULT DATA (UPDATED FOR HASHED PASSWORD)
-- =====================================================

-- System Control Defaults
INSERT OR IGNORE INTO system_control (key, value) VALUES 
  ('auto_mode', 'ON'),
  ('system_status', 'ON'),
  ('dynamic_price', '200'),
  ('promo_mode', 'INACTIVE');

-- AI Memory Defaults
INSERT OR IGNORE INTO ai_memory (type, key, value) VALUES 
  ('metric', 'avg_revenue', 10000),
  ('metric', 'avg_sessions', 50),
  ('metric', 'peak_hour', 14);

-- Default Admin User (password: admin123)
-- Pre‑computed with PBKDF2 (100k iterations, random salt).
-- You should generate a new hash for your own admin password.
INSERT OR IGNORE INTO users (id, email, password_hash, password_salt, name, role, created_at, createdAt) 
VALUES (
  'admin-1', 
  'ceo@primeshieldhub.com', 
  '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 
  '161,212,25,38,112,144,53,227,108,164,22,99,145,88,7,21',
  'System Admin', 
  'admin', 
  1733875200000,
  1733875200000
);

-- =====================================================
-- END OF COMPLETE SCHEMA (v9.0 - Security Hardened)
-- =====================================================
