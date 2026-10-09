// ============================================================================
// scripts/importer-canada.ts - Import Canadian supplier products to Cloudflare D1 + R2
// Run with: npx ts-node scripts/importer-canada.ts
// ============================================================================

import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

// Configuration - Replace with your values
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const CLOUDFLARE_R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET || 'primeshieldhub-storage';
const CLOUDFLARE_D1_DATABASE_ID = process.env.CLOUDFLARE_D1_DATABASE_ID || '73add641-4a4b-4e7a-bda3-078a14b6240e';

// D1 API endpoint
const D1_API = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${CLOUDFLARE_D1_DATABASE_ID}/query`;

// Types
interface CanadaProductRow {
  name: string;
  description: string;
  'Price CAD': string;
  category: string;
  type: string;
  stock: string;
  image: string;
}

interface PriceData {
  landed: number;
  retail: number;
  wholesale: number;
}

interface CanadaProduct {
  name: string;
  description: string;
  price: number;
  priceWholesale: number;
  landedCost: number;
  stock: number;
  category: string;
  type: string;
  imageUrl: string | null;
  source: string;
  createdAt: string;
}

// ------------------------------ Pricing Engine for CAD ------------------------------
const PRICING_CONFIG = {
  // Exchange rate: 1 CAD = X NGN
  cadToNgn: 430,
  
  // Logistics costs (in NGN)
  airCargoPerKg: 15,
  clearingPerKg: 12,
  localDelivery: 5000,
  
  // Default weight by type (in kg)
  defaultWeight: {
    phones: 0.3,
    laptops: 2.5,
    tablets: 0.6,
    audio: 0.5,
    wearables: 0.15,
    gaming: 3.0,
    accessories: 0.2,
    default: 0.5,
  },
  
  // Markup by category (percentage)
  markup: {
    phones: 30,
    laptops: 25,
    tablets: 28,
    audio: 35,
    wearables: 38,
    gaming: 25,
    accessories: 40,
    default: 30,
  },
  
  // Wholesale markup (percentage)
  wholesaleMarkup: 15,
};

async function calculatePrice(
  priceCAD: number,
  currency: string,
  category: string,
  type: string
): Promise<PriceData> {
  // Convert to NGN (1 CAD = 430 NGN)
  let nairaEquivalent = priceCAD;
  if (currency.toUpperCase() === 'CAD') {
    nairaEquivalent = priceCAD * PRICING_CONFIG.cadToNgn;
  } else if (currency.toUpperCase() === 'USD') {
    nairaEquivalent = priceCAD * 580; // USD fallback
  } else {
    nairaEquivalent = priceCAD * PRICING_CONFIG.cadToNgn;
  }
  
  // Get weight for this product type
  const weightKey = type.toLowerCase() as keyof typeof PRICING_CONFIG.defaultWeight;
  const weight = PRICING_CONFIG.defaultWeight[weightKey] || PRICING_CONFIG.defaultWeight.default;
  
  // Calculate logistics costs
  const freight = weight * PRICING_CONFIG.airCargoPerKg;
  const clearing = weight * PRICING_CONFIG.clearingPerKg;
  const localDelivery = PRICING_CONFIG.localDelivery;
  
  // Landed cost (total cost to get product to Nigeria)
  const landed = Math.round(nairaEquivalent + freight + clearing + localDelivery);
  
  // Get markup for category
  const categoryKey = category.toLowerCase() as keyof typeof PRICING_CONFIG.markup;
  const markupPercent = PRICING_CONFIG.markup[categoryKey] || PRICING_CONFIG.markup.default;
  const wholesaleMarkupPercent = PRICING_CONFIG.wholesaleMarkup;
  
  // Calculate retail and wholesale prices
  const retail = Math.round(landed + (landed * markupPercent / 100));
  const wholesale = Math.round(landed + (landed * wholesaleMarkupPercent / 100));
  
  return { landed, retail, wholesale };
}

// ------------------------------ R2 Image Upload ------------------------------
async function uploadImageToR2(imageUrl: string, fileName: string): Promise<string | null> {
  if (!imageUrl || imageUrl.trim() === '') {
    return null;
  }
  
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.warn(`Failed to fetch image: ${imageUrl} (${response.status})`);
      return null;
    }
    
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    const uploadUrl = `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${CLOUDFLARE_R2_BUCKET}/products/${fileName}`;
    
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': contentType,
      },
      body: imageBuffer,
    });
    
    if (!uploadResponse.ok) {
      throw new Error(`R2 upload failed: ${uploadResponse.status}`);
    }
    
    return `https://${CLOUDFLARE_R2_BUCKET}.${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/products/${fileName}`;
  } catch (err) {
    console.error('Image upload failed:', err);
    return null;
  }
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\-.]/g, '')
    .substring(0, 200);
}

// ------------------------------ D1 Database Operations ------------------------
async function insertProduct(product: CanadaProduct): Promise<void> {
  const query = `
    INSERT INTO products (
      name, description, price, price_wholesale, landed_cost,
      stock, category, type, image_url, source, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  const params = [
    product.name,
    product.description,
    product.price,
    product.priceWholesale,
    product.landedCost,
    product.stock,
    product.category,
    product.type,
    product.imageUrl,
    product.source,
    product.createdAt,
    product.createdAt,
  ];
  
  const response = await fetch(D1_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sql: query,
      params: params,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`D1 insert failed: ${error}`);
  }
}

async function productExistsByName(name: string): Promise<boolean> {
  const query = `SELECT id FROM products WHERE name = ? LIMIT 1`;
  
  const response = await fetch(D1_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sql: query,
      params: [name],
    }),
  });
  
  if (!response.ok) return false;
  
  const data = await response.json() as any;
  return data.result && data.result.rows && data.result.rows.length > 0;
}

// ------------------------------ CSV Parsing -----------------------------------
function parseCSV(filePath: string): CanadaProductRow[] {
  const fileContent = readFileSync(filePath, 'utf-8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
  });
  return records as CanadaProductRow[];
}

// ------------------------------ Main Import Function -------------------------
async function importCanadaProducts(csvPath: string): Promise<void> {
  console.log('🚀 CANADA PRODUCTS IMPORT STARTED');
  console.log(`📁 Reading CSV: ${csvPath}`);
  
  // Check if file exists
  try {
    readFileSync(csvPath, 'utf-8');
  } catch (err) {
    console.error(`❌ CSV file not found: ${csvPath}`);
    console.log('   Please ensure the file exists at: ./data/canada.csv');
    process.exit(1);
  }
  
  const rows = parseCSV(csvPath);
  console.log(`📊 Found ${rows.length} products in CSV`);
  
  let successCount = 0;
  let failCount = 0;
  let duplicateCount = 0;
  
  for (let i = 0; i < rows.length; i++) {
    const item = rows[i];
    
    try {
      const productName = item.name;
      if (!productName) {
        console.warn(`Skipping row ${i + 1}: No product name`);
        failCount++;
        continue;
      }
      
      // Check for duplicates
      const exists = await productExistsByName(productName);
      if (exists) {
        console.log(`⏭️ Skipping duplicate: ${productName}`);
        duplicateCount++;
        continue;
      }
      
      // Parse price
      const priceCAD = Number(item['Price CAD']);
      if (isNaN(priceCAD) || priceCAD <= 0) {
        console.warn(`Skipping ${productName}: Invalid price (${item['Price CAD']})`);
        failCount++;
        continue;
      }
      
      // Calculate prices using the pricing engine
      const priceData = await calculatePrice(
        priceCAD,
        'CAD',
        item.category,
        item.type
      );
      
      console.log(`  💰 ${productName}: $${priceCAD} CAD → ₦${priceData.retail.toLocaleString()}`);
      
      // Upload image to R2 if available
      let uploadedImageUrl: string | null = null;
      if (item.image && item.image.trim()) {
        const imageName = `${sanitizeFileName(productName)}.jpg`;
        uploadedImageUrl = await uploadImageToR2(item.image, imageName);
        if (uploadedImageUrl) {
          console.log(`  📸 Image uploaded: ${productName}`);
        }
      }
      
      // Prepare product object
      const product: CanadaProduct = {
        name: productName,
        description: item.description || '',
        price: priceData.retail,
        priceWholesale: priceData.wholesale,
        landedCost: priceData.landed,
        stock: parseInt(item.stock || '0', 10),
        category: item.category || 'general',
        type: item.type || 'default',
        imageUrl: uploadedImageUrl,
        source: 'canada',
        createdAt: new Date().toISOString(),
      };
      
      // Insert into D1
      await insertProduct(product);
      successCount++;
      
      console.log(`✅ [${successCount}] Imported: ${productName}`);
    } catch (err) {
      console.error(`❌ Failed to import: ${item.name || `row ${i + 1}`}`, err);
      failCount++;
    }
  }
  
  console.log('\n📊 IMPORT SUMMARY');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`⏭️ Duplicates skipped: ${duplicateCount}`);
  console.log('🎉 CANADA IMPORT COMPLETE');
}

// ------------------------------ Ensure Products Table Exists -----------------
const PRODUCTS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL,
  price_wholesale INTEGER,
  landed_cost INTEGER,
  stock INTEGER DEFAULT 0,
  category TEXT,
  type TEXT,
  image_url TEXT,
  source TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_source ON products(source);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
`;

async function ensureTableExists(): Promise<void> {
  console.log('🔧 Ensuring products table exists...');
  
  const response = await fetch(D1_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql: PRODUCTS_TABLE_SQL }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.warn(`Table creation warning: ${error}`);
  } else {
    console.log('✅ Products table ready');
  }
}

// ------------------------------ Run Script -----------------------------------
async function main(): Promise<void> {
  const csvPath = process.argv[2] || './data/canada.csv';
  
  const requiredEnv = [
    'CLOUDFLARE_ACCOUNT_ID',
    'CLOUDFLARE_API_TOKEN',
    'CLOUDFLARE_R2_BUCKET',
    'CLOUDFLARE_D1_DATABASE_ID'
  ];
  
  const missing = requiredEnv.filter(env => !process.env[env]);
  if (missing.length > 0) {
    console.error('❌ Missing environment variables:', missing.join(', '));
    console.error('\nPlease set:');
    console.error('  export CLOUDFLARE_ACCOUNT_ID="your-account-id"');
    console.error('  export CLOUDFLARE_API_TOKEN="your-api-token"');
    console.error('  export CLOUDFLARE_R2_BUCKET="primeshieldhub-storage"');
    console.error('  export CLOUDFLARE_D1_DATABASE_ID="73add641-4a4b-4e7a-bda3-078a14b6240e"');
    process.exit(1);
  }
  
  try {
    await ensureTableExists();
    await importCanadaProducts(csvPath);
  } catch (err) {
    console.error('❌ Import failed:', err);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { importCanadaProducts, calculatePrice, PRICING_CONFIG };

