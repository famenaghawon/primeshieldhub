const fs = require('fs');

// Helper to escape single quotes in SQL
function escapeSql(str) {
  if (str === null || str === undefined) return 'NULL';
  if (typeof str === 'string') return `'${str.replace(/'/g, "''")}'`;
  return str;
}

// Convert timestamp strings to numbers
function toTimestamp(dateStr) {
  if (!dateStr) return Date.now();
  return new Date(dateStr).getTime();
}

// Process Users
function transformUsers() {
  if (!fs.existsSync('users.json')) {
    console.log('users.json not found');
    return [];
  }
  const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
  const inserts = users.map(user => `
INSERT INTO users (id, email, name, adminLevel, role, isAdmin, disabled, suspended, emailVerified, createdAt, updatedAt) VALUES (
  ${escapeSql(user.id)},
  ${escapeSql(user.email)},
  ${escapeSql(user.name)},
  ${escapeSql(user.adminLevel)},
  ${escapeSql(user.role)},
  ${user.isAdmin ? 1 : 0},
  ${user.disabled ? 1 : 0},
  ${user.suspended ? 1 : 0},
  ${user.emailVerified ? 1 : 0},
  ${toTimestamp(user.createdAt)},
  ${toTimestamp(user.updatedAt)}
);`);
  return inserts;
}

// Process Products
function transformProducts() {
  if (!fs.existsSync('products.json')) {
    console.log('products.json not found');
    return [];
  }
  const products = JSON.parse(fs.readFileSync('products.json', 'utf8'));
  const inserts = products.map(product => `
INSERT INTO products (id, name, category, basePrice, price, wholesalePrice, stock, weightKg, image, description, active, createdAt) VALUES (
  ${escapeSql(product.id)},
  ${escapeSql(product.name)},
  ${escapeSql(product.category)},
  ${product.basePrice || 'NULL'},
  ${product.price || 'NULL'},
  ${product.wholesalePrice || 'NULL'},
  ${product.stock || 0},
  ${product.weightKg || 'NULL'},
  ${escapeSql(product.image)},
  ${escapeSql(product.description)},
  ${product.active !== false ? 1 : 0},
  ${toTimestamp(product.createdAt)}
);`);
  return inserts;
}

// Process Settings (key-value pairs)
function transformSettings() {
  if (!fs.existsSync('settings.json')) {
    console.log('settings.json not found');
    return [];
  }
  const settings = JSON.parse(fs.readFileSync('settings.json', 'utf8'));
  const inserts = [];
  settings.forEach(setting => {
    // If settings is a document with multiple fields
    for (const [key, value] of Object.entries(setting)) {
      if (key !== 'id') {
        inserts.push(`
INSERT INTO settings (key, value, updatedAt) VALUES (
  ${escapeSql(key)},
  ${escapeSql(String(value))},
  ${toTimestamp(setting.LastUpdated || setting.updatedAt)}
);`);
      }
    }
  });
  return inserts;
}

// Process Resellers
function transformResellers() {
  if (!fs.existsSync('resellers.json')) {
    console.log('resellers.json not found');
    return [];
  }
  const resellers = JSON.parse(fs.readFileSync('resellers.json', 'utf8'));
  const inserts = resellers.map(reseller => `
INSERT INTO resellers (id, name, location, phone, createdAt) VALUES (
  ${escapeSql(reseller.id)},
  ${escapeSql(reseller.name)},
  ${escapeSql(reseller.location)},
  ${escapeSql(reseller.phone)},
  ${toTimestamp(reseller.createdAt)}
);`);
  return inserts;
}

// Process Reseller Codes
function transformResellerCodes() {
  if (!fs.existsSync('reseller_codes.json')) {
    console.log('reseller_codes.json not found');
    return [];
  }
  const codes = JSON.parse(fs.readFileSync('reseller_codes.json', 'utf8'));
  const inserts = codes.map(code => `
INSERT INTO reseller_codes (code, discount, tier, maxUses, dailyUsageLimit, rateLimit, expiryDate, singleUse, suspiciousThreshold, accountStatus, active, allowedCountries, blockedCountries, createdAt) VALUES (
  ${escapeSql(code.code)},
  ${code.discount || 'NULL'},
  ${escapeSql(code.tier)},
  ${code.maxUses || 'NULL'},
  ${code.dailyUsageLimit || 'NULL'},
  ${code.rateLimit || 'NULL'},
  ${toTimestamp(code.expiryDate)},
  ${code.singleUse ? 1 : 0},
  ${code.suspiciousThreshold || 'NULL'},
  ${escapeSql(code.accountStatus)},
  ${code.active !== false ? 1 : 0},
  ${escapeSql(JSON.stringify(code.allowedCountries))},
  ${escapeSql(JSON.stringify(code.blockedCountries))},
  ${toTimestamp(code.createdAt)}
);`);
  return inserts;
}

// Generate main seed.sql
function generateSeedSQL() {
  console.log('Generating seed.sql...');
  
  const inserts = [
    ...transformUsers(),
    ...transformProducts(),
    ...transformSettings(),
    ...transformResellers(),
    ...transformResellerCodes()
  ];
  
  const sql = inserts.join('\n');
  fs.writeFileSync('seed.sql', sql);
  console.log(`✅ Generated seed.sql with ${inserts.length} INSERT statements`);
}

generateSeedSQL();

