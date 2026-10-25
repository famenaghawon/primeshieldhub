-- PrimeShieldHub Data Migration
-- Generated: 2026-04-01T22:59:35.059Z

-- Clear existing data (optional)
DELETE FROM reseller_codes;
DELETE FROM resellers;
DELETE FROM settings;
DELETE FROM products;
DELETE FROM users;

-- Insert new data

INSERT OR REPLACE INTO users (id, email, name, adminLevel, role, isAdmin, disabled, suspended, emailVerified, createdAt, updatedAt) VALUES (
  'rsBTBMVBBjYFG8qNy26A0fvGL752',
  'primeshieldhub@gmail.com',
  'Quantum Admin',
  'super',
  'admin',
  1,
  0,
  0,
  1,
  1770830483016,
  1770830483016
);

INSERT OR REPLACE INTO products (id, name, category, basePrice, price, wholesalePrice, stock, weightKg, image, description, active, createdAt) VALUES (
  'FCgM2VvUPdBhQoVw71vM',
  'Unnamed Product',
  'general',
  85000,
  85000,
  NULL,
  0,
  NULL,
  'https://images.unsplash.com/photo-1606229365485-93a3b8ee0385',
  'Premium quality AirPods with deep bass and long battery life.',
  1,
  1775084375058
);

INSERT OR REPLACE INTO products (id, name, category, basePrice, price, wholesalePrice, stock, weightKg, image, description, active, createdAt) VALUES (
  'GLJY4GSHbXCw5dzI74EF',
  'iphone 15 Pro Max',
  'smartphones',
  1250000,
  1250000,
  1150000,
  15,
  NULL,
  NULL,
  NULL,
  1,
  1775084375058
);

INSERT OR REPLACE INTO products (id, name, category, basePrice, price, wholesalePrice, stock, weightKg, image, description, active, createdAt) VALUES (
  'airpods-pro-2',
  'Airpods Pro 2',
  'accessories',
  85000,
  85000,
  NULL,
  0,
  0.4,
  'https://www.jumia.com.ng/catalog/productimagezoom/sku/GE779EA4E300NNAFAMZ/image/1/',
  NULL,
  1,
  1775084375058
);

INSERT OR REPLACE INTO settings (key, value, updatedAt) VALUES (
  'currencyRateUSD',
  '1353',
  1775084375058
);

INSERT OR REPLACE INTO settings (key, value, updatedAt) VALUES (
  'currencyRateCAD',
  '994',
  1775084375058
);

INSERT OR REPLACE INTO settings (key, value, updatedAt) VALUES (
  'currencyRateCNY',
  '196',
  1775084375058
);

INSERT OR REPLACE INTO settings (key, value, updatedAt) VALUES (
  'airCargoPerKg',
  '12000',
  1775084375058
);

INSERT OR REPLACE INTO settings (key, value, updatedAt) VALUES (
  'customsperkg',
  '1000',
  1775084375058
);

INSERT OR REPLACE INTO settings (key, value, updatedAt) VALUES (
  'localDeliveryPerUnit',
  '500',
  1775084375058
);

INSERT OR REPLACE INTO settings (key, value, updatedAt) VALUES (
  'markupAccessaries',
  '80',
  1775084375058
);

INSERT OR REPLACE INTO settings (key, value, updatedAt) VALUES (
  'markUPphones',
  '18',
  1775084375058
);

INSERT OR REPLACE INTO settings (key, value, updatedAt) VALUES (
  'markupBulky',
  '35',
  1775084375058
);

INSERT OR REPLACE INTO settings (key, value, updatedAt) VALUES (
  'lastUpdated',
  '2026-02-13T08:38:41.089Z',
  1775084375058
);

INSERT OR REPLACE INTO settings (key, value, updatedAt) VALUES (
  'resellerCode',
  'PHS-RESELLER-2026',
  1775084375058
);

INSERT OR REPLACE INTO settings (key, value, updatedAt) VALUES (
  'adminEmail',
  'primeshieldhub@gmail.com',
  1775084375058
);

INSERT OR REPLACE INTO settings (key, value, updatedAt) VALUES (
  'systemMode',
  'production',
  1775084375058
);

INSERT OR REPLACE INTO resellers (id, name, location, phone, createdAt) VALUES (
  'NWtCPiBDsWomp0DLLf99',
  'sav flux',
  'Lagos',
  '08127763676',
  1770353713836
);

INSERT OR REPLACE INTO reseller_codes (code, discount, tier, maxUses, dailyUsageLimit, rateLimit, expiryDate, singleUse, suspiciousThreshold, accountStatus, active, allowedCountries, blockedCountries, createdAt) VALUES (
  'PSH-RESELLER-2026',
  15,
  '"basic"',
  1000,
  50,
  10,
  1774672093357,
  0,
  NULL,
  'active',
  1,
  '["NG"]',
  '[""]',
  1775084375059
);