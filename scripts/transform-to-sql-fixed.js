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
  try {
    return new Date(dateStr).getTime();
  } catch(e) {
    return Date.now();
  }
}

// Safely get value from object
function getValue(obj, key, defaultValue = null) {
  if (!obj) return defaultValue;
  return obj[key] !== undefined ? obj[key] : defaultValue;
}

// Process Users
function transformUsers() {
  if (!fs.existsSync('users.json')) {
    console.log('⚠️  users.json not found');
    return [];
  }
  const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
  console.log(`   Processing ${users.length} users...`);
  
  const inserts = users.map(user => {
    // Handle createdAt which might be an object with _seconds
    let createdAt = user.createdAt;
    if (createdAt && typeof createdAt === 'object') {
      createdAt = createdAt._seconds ? new Date(createdAt._seconds * 1000).toISOString() : null;
    }
    
    let updatedAt = user.updatedAt;
    if (updatedAt && typeof updatedAt === 'object') {
      updatedAt = updatedAt._seconds ? new Date(updatedAt._seconds * 1000).toISOString() : null;
    }
    
    return `
INSERT OR REPLACE INTO users (id, email, name, adminLevel, role, isAdmin, disabled, suspended, emailVerified, createdAt, updatedAt) VALUES (
  ${escapeSql(user.id)},
  ${escapeSql(getValue(user, 'email'))},
  ${escapeSql(getValue(user, 'name'))},
  ${escapeSql(getValue(user, 'adminLevel'))},
  ${escapeSql(getValue(user, 'role'))},
  ${getValue(user, 'isAdmin') ? 1 : 0},
  ${getValue(user, 'disabled') ? 1 : 0},
  ${getValue(user, 'suspended') ? 1 : 0},
  ${getValue(user, 'emailVerified') ? 1 : 0},
  ${toTimestamp(createdAt)},
  ${toTimestamp(updatedAt)}
);`;
  });
  return inserts;
}

// Process Products - FIXED to handle missing fields
function transformProducts() {
  if (!fs.existsSync('products.json')) {
    console.log('⚠️  products.json not found');
    return [];
  }
  const products = JSON.parse(fs.readFileSync('products.json', 'utf8'));
  console.log(`   Processing ${products.length} products...`);
  
  const inserts = products.map(product => {
    // Handle the case where the document itself might have the fields directly
    // or might be nested under a field
    let productData = product;
    
    // Sometimes Firestore export nests data under fields
    if (product.fields) {
      productData = {};
      for (const [key, value] of Object.entries(product.fields)) {
        if (value.stringValue) productData[key] = value.stringValue;
        else if (value.integerValue) productData[key] = parseInt(value.integerValue);
        else if (value.doubleValue) productData[key] = parseFloat(value.doubleValue);
        else if (value.booleanValue) productData[key] = value.booleanValue;
        else productData[key] = value;
      }
    }
    
    // Extract values with defaults
    const name = getValue(productData, 'name') || getValue(productData, 'productName') || 'Unnamed Product';
    const price = getValue(productData, 'price') || getValue(productData, 'basePrice') || 0;
    const basePrice = getValue(productData, 'basePrice') || price;
    const wholesalePrice = getValue(productData, 'wholesalePrice') || null;
    const stock = getValue(productData, 'stock') || 0;
    const weightKg = getValue(productData, 'weightKg') || null;
    const image = getValue(productData, 'image') || null;
    const description = getValue(productData, 'description') || null;
    const category = getValue(productData, 'category') || 'general';
    const active = getValue(productData, 'active') !== false ? 1 : 0;
    
    let createdAt = getValue(productData, 'createdAt');
    if (createdAt && typeof createdAt === 'object') {
      createdAt = createdAt._seconds ? new Date(createdAt._seconds * 1000).toISOString() : null;
    }
    
    console.log(`      - Product: ${name} (ID: ${product.id})`);
    
    return `
INSERT OR REPLACE INTO products (id, name, category, basePrice, price, wholesalePrice, stock, weightKg, image, description, active, createdAt) VALUES (
  ${escapeSql(product.id)},
  ${escapeSql(name)},
  ${escapeSql(category)},
  ${basePrice || 'NULL'},
  ${price || 'NULL'},
  ${wholesalePrice || 'NULL'},
  ${stock || 0},
  ${weightKg || 'NULL'},
  ${escapeSql(image)},
  ${escapeSql(description)},
  ${active},
  ${toTimestamp(createdAt)}
);`;
  });
  return inserts;
}

// Process Settings
function transformSettings() {
  if (!fs.existsSync('settings.json')) {
    console.log('⚠️  settings.json not found');
    return [];
  }
  const settings = JSON.parse(fs.readFileSync('settings.json', 'utf8'));
  console.log(`   Processing ${settings.length} setting documents...`);
  
  const inserts = [];
  settings.forEach(setting => {
    // For each setting document, insert each field as a key-value pair
    for (const [key, value] of Object.entries(setting)) {
      if (key !== 'id' && key !== '_id' && typeof value !== 'object') {
        inserts.push(`
INSERT OR REPLACE INTO settings (key, value, updatedAt) VALUES (
  ${escapeSql(key)},
  ${escapeSql(String(value))},
  ${toTimestamp(getValue(setting, 'LastUpdated') || getValue(setting, 'updatedAt'))}
);`);
      }
    }
  });
  return inserts;
}

// Process Resellers
function transformResellers() {
  if (!fs.existsSync('resellers.json')) {
    console.log('⚠️  resellers.json not found');
    return [];
  }
  const resellers = JSON.parse(fs.readFileSync('resellers.json', 'utf8'));
  console.log(`   Processing ${resellers.length} resellers...`);
  
  const inserts = resellers.map(reseller => {
    let createdAt = getValue(reseller, 'createdAt');
    if (createdAt && typeof createdAt === 'object') {
      createdAt = createdAt._seconds ? new Date(createdAt._seconds * 1000).toISOString() : null;
    }
    
    return `
INSERT OR REPLACE INTO resellers (id, name, location, phone, createdAt) VALUES (
  ${escapeSql(reseller.id)},
  ${escapeSql(getValue(reseller, 'name'))},
  ${escapeSql(getValue(reseller, 'location'))},
  ${escapeSql(getValue(reseller, 'phone'))},
  ${toTimestamp(createdAt)}
);`;
  });
  return inserts;
}

// Process Reseller Codes
function transformResellerCodes() {
  if (!fs.existsSync('reseller_codes.json')) {
    console.log('⚠️  reseller_codes.json not found');
    return [];
  }
  const codes = JSON.parse(fs.readFileSync('reseller_codes.json', 'utf8'));
  console.log(`   Processing ${codes.length} reseller codes...`);
  
  const inserts = codes.map(code => {
    let expiryDate = getValue(code, 'expiryDate');
    if (expiryDate && typeof expiryDate === 'object') {
      expiryDate = expiryDate._seconds ? new Date(expiryDate._seconds * 1000).toISOString() : null;
    }
    
    let createdAt = getValue(code, 'createdAt');
    if (createdAt && typeof createdAt === 'object') {
      createdAt = createdAt._seconds ? new Date(createdAt._seconds * 1000).toISOString() : null;
    }
    
    return `
INSERT OR REPLACE INTO reseller_codes (code, discount, tier, maxUses, dailyUsageLimit, rateLimit, expiryDate, singleUse, suspiciousThreshold, accountStatus, active, allowedCountries, blockedCountries, createdAt) VALUES (
  ${escapeSql(getValue(code, 'code'))},
  ${getValue(code, 'discount') || 'NULL'},
  ${escapeSql(getValue(code, 'tier'))},
  ${getValue(code, 'maxUses') || 'NULL'},
  ${getValue(code, 'dailyUsageLimit') || 'NULL'},
  ${getValue(code, 'rateLimit') || 'NULL'},
  ${toTimestamp(expiryDate)},
  ${getValue(code, 'singleUse') ? 1 : 0},
  ${getValue(code, 'suspiciousThreshold') || 'NULL'},
  ${escapeSql(getValue(code, 'accountStatus'))},
  ${getValue(code, 'active') !== false ? 1 : 0},
  ${escapeSql(JSON.stringify(getValue(code, 'allowedCountries')))},
  ${escapeSql(JSON.stringify(getValue(code, 'blockedCountries')))},
  ${toTimestamp(createdAt)}
);`;
  });
  return inserts;
}

// Generate main seed.sql
function generateSeedSQL() {
  console.log('\n📝 Generating seed.sql...\n');
  
  const allInserts = [
    ...transformUsers(),
    ...transformProducts(),
    ...transformSettings(),
    ...transformResellers(),
    ...transformResellerCodes()
  ];
  
  // Add SQL to clear tables first (optional)
  const header = `-- PrimeShieldHub Data Migration
-- Generated: ${new Date().toISOString()}

-- Clear existing data (optional)
DELETE FROM reseller_codes;
DELETE FROM resellers;
DELETE FROM settings;
DELETE FROM products;
DELETE FROM users;

-- Insert new data
`;
  
  const sql = header + allInserts.join('\n');
  fs.writeFileSync('seed.sql', sql);
  console.log(`\n✅ Generated seed.sql with ${allInserts.length} INSERT statements`);
  console.log(`\n📄 File size: ${(fs.statSync('seed.sql').size / 1024).toFixed(2)} KB`);
}

generateSeedSQL();

