// ============================================================================
// importer-modular.ts - Modular product importer for Cloudflare D1 + R2
// Uses separate engine modules for FX, logistics, and pricing
// ============================================================================

import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { convertToNaira } from '../backend/src/engines/fxEngine';
import { calculateLogistics } from '../backend/src/engines/logisticsEngine';
import { calculateSellingPrice } from '../engines/pricingEngine';

// Configuration
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN!;
const CLOUDFLARE_R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET!;
const CLOUDFLARE_D1_DATABASE_ID = process.env.CLOUDFLARE_D1_DATABASE_ID!;

// D1 API endpoint
const D1_API = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${CLOUDFLARE_D1_DATABASE_ID}/query`;

// Types
interface SupplierProduct {
  name: string;
  price: string;
  currency: string;
  weight: string;
  category: string;
  description?: string;
  image?: string;
  source?: string;
  brand?: string;
  sku?: string;
}

interface PendingProduct {
  name: string;
  description: string | null;
  imageUrl: string | null;
  category: string;
  weight: number;
  source: string | null;
  brand: string | null;
  sku: string | null;
  landedCost: number;
  priceRetail: number;
  priceWholesale: number;
  status: string;
  createdAt: string;
}

// ------------------------------ R2 Image Upload ------------------------------
async function uploadImageToR2(imageUrl: string | undefined, fileName: string): Promise<string | null> {
  if (!imageUrl || imageUrl.trim() === '') return null;

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.warn(`Failed to fetch image: ${imageUrl} (${response.status})`);
      return null;
    }

    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    const uploadUrl = `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${CLOUDFLARE_R2_BUCKET}/pending-products/${fileName}`;
    
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

    return `https://${CLOUDFLARE_R2_BUCKET}.${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/pending-products/${fileName}`;
  } catch (err) {
    console.error('Image upload failed:', err);
    return null;
  }
}

// ------------------------------ D1 Database Operations ------------------------
async function insertPendingProduct(product: PendingProduct): Promise<void> {
  const query = `
    INSERT INTO pending_products (
      name, description, image_url, category, weight_kg,
      source, brand, sku, landed_cost, price_retail, 
      price_wholesale, status, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    product.name,
    product.description,
    product.imageUrl,
    product.category,
    product.weight,
    product.source,
    product.brand,
    product.sku,
    product.landedCost,
    product.priceRetail,
    product.priceWholesale,
    product.status,
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

// Check if product already exists (by SKU or name)
async function productExists(sku: string | null, name: string): Promise<boolean> {
  if (!sku) return false;

  const query = `SELECT id FROM pending_products WHERE sku = ? OR name = ? LIMIT 1`;
  
  const response = await fetch(D1_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sql: query,
      params: [sku, name],
    }),
  });

  if (!response.ok) return false;
  
  const data = await response.json() as any;
  return data.result && data.result.rows && data.result.rows.length > 0;
}

// ------------------------------ CSV Parsing -----------------------------------
function parseCSV(filePath: string): SupplierProduct[] {
  const fileContent = readFileSync(filePath, 'utf-8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
  });
  return records as SupplierProduct[];
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\-.]/g, '')
    .substring(0, 200);
}

// ------------------------------ Main Import Function -------------------------
async function importSupplierProducts(csvPath: string): Promise<void> {
  console.log('ðŸš€ MODULAR SUPPLIER IMPORT STARTED');
  console.log(`ðŸ“ Reading CSV: ${csvPath}`);

  const rows = parseCSV(csvPath);
  console.log(`ðŸ“Š Found ${rows.length} products`);

  let successCount = 0;
  let failCount = 0;
  let duplicateCount = 0;

  for (const item of rows) {
    try {
      const productName = item.name;
      if (!productName) {
        console.warn('Skipping: No product name');
        failCount++;
        continue;
      }

      // Parse values
      const priceForeign = parseFloat(item.price || '0');
      const currency = (item.currency || 'USD').toUpperCase();
      const weight = parseFloat(item.weight || '0.5');
      const category = (item.category || 'accessories').toLowerCase();

      if (isNaN(priceForeign)) {
        console.warn(`Skipping ${productName}: Invalid price`);
        failCount++;
        continue;
      }

      // Check for duplicates
      const sku = item.sku || null;
      const exists = await productExists(sku, productName);
      if (exists) {
        console.log(`â­ï¸ Skipping duplicate: ${productName}`);
        duplicateCount++;
        continue;
      }

      // 1. Convert foreign currency to NGN
      const nairaValue = await convertToNaira(priceForeign, currency);
      console.log(`  ðŸ’± ${productName}: ${priceForeign} ${currency} â†’ â‚¦${nairaValue.toLocaleString()}`);

      // 2. Calculate logistics cost based on weight
      const logistics = await calculateLogistics(weight);
      console.log(`  ðŸ“¦ Logistics (${weight}kg): â‚¦${logistics.toLocaleString()}`);

      // 3. Calculate landed cost
      const landedCost = nairaValue + logistics;

      // 4. Calculate selling prices (retail + wholesale)
      const selling = await calculateSellingPrice(landedCost, category);
      console.log(`  ðŸ’° Prices: Retail: â‚¦${selling.retail.toLocaleString()} | Wholesale: â‚¦${selling.wholesale.toLocaleString()}`);

      // 5. Upload image if available
      let uploadedImageUrl: string | null = null;
      if (item.image && item.image.trim()) {
        const imageName = `${sanitizeFileName(productName)}.jpg`;
        uploadedImageUrl = await uploadImageToR2(item.image, imageName);
      }

      // 6. Prepare pending product
      const pendingProduct: PendingProduct = {
        name: productName,
        description: item.description || null,
        imageUrl: uploadedImageUrl,
        category: category,
        weight: weight,
        source: item.source || null,
        brand: item.brand || null,
        sku: sku,
        landedCost: Math.round(landedCost),
        priceRetail: Math.round(selling.retail),
        priceWholesale: Math.round(selling.wholesale),
        status: 'pending_review',
        createdAt: new Date().toISOString(),
      };

      // 7. Insert into pending_products table
      await insertPendingProduct(pendingProduct);
      successCount++;
      
      console.log(`âœ… [${successCount}] Imported: ${productName}`);
    } catch (err) {
      console.error(`âŒ Failed to import: ${item.name}`, err);
      failCount++;
    }
  }

  console.log('\nðŸ“Š IMPORT SUMMARY');
  console.log(`âœ… Successful: ${successCount}`);
  console.log(`âŒ Failed: ${failCount}`);
  console.log(`â­ï¸ Duplicates skipped: ${duplicateCount}`);
  console.log('ðŸŽ‰ IMPORT COMPLETE â†’ pending_products table');
}

// ------------------------------ Schema Setup ---------------------------------
const SCHEMA_SQL = `
-- Pending products table (for review before publishing)
CREATE TABLE IF NOT EXISTS pending_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  category TEXT NOT NULL,
  weight_kg REAL DEFAULT 0.5,
  source TEXT,
  brand TEXT,
  sku TEXT UNIQUE,
  landed_cost INTEGER NOT NULL,
  price_retail INTEGER NOT NULL,
  price_wholesale INTEGER NOT NULL,
  status TEXT DEFAULT 'pending_review',
  review_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  INDEX idx_pending_status (status),
  INDEX idx_pending_category (category),
  INDEX idx_pending_sku (sku)
);

-- Create trigger for updated_at
CREATE TRIGGER IF NOT EXISTS update_pending_products_updated_at 
  AFTER UPDATE ON pending_products
  BEGIN
    UPDATE pending_products SET updated_at = datetime('now') WHERE id = NEW.id;
  END;
`;

async function setupSchema(): Promise<void> {
  console.log('ðŸ”§ Setting up pending_products table...');
  
  const response = await fetch(D1_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql: SCHEMA_SQL }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Schema setup failed: ${error}`);
  }

  console.log('âœ… Database schema ready');
}

// ------------------------------ Run Script -----------------------------------
if (require.main === module) {
  const csvPath = process.argv[2] || 'supplier.csv';
  
  const requiredEnv = [
    'CLOUDFLARE_ACCOUNT_ID',
    'CLOUDFLARE_API_TOKEN',
    'CLOUDFLARE_R2_BUCKET',
    'CLOUDFLARE_D1_DATABASE_ID'
  ];
  
  const missing = requiredEnv.filter(env => !process.env[env]);
  if (missing.length > 0) {
    console.error('âŒ Missing environment variables:', missing.join(', '));
    console.error('\nPlease set:');
    console.error('  export CLOUDFLARE_ACCOUNT_ID="your-account-id"');
    console.error('  export CLOUDFLARE_API_TOKEN="your-api-token"');
    console.error('  export CLOUDFLARE_R2_BUCKET="primeshieldhub-products"');
    console.error('  export CLOUDFLARE_D1_DATABASE_ID="your-d1-id"');
    process.exit(1);
  }

  (async () => {
    try {
      await setupSchema();
      await importSupplierProducts(csvPath);
    } catch (err) {
      console.error('âŒ Import failed:', err);
      process.exit(1);
    }
  })();
}

export { importSupplierProducts, insertPendingProduct, productExists };



