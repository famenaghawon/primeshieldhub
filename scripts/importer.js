// ============================================================================
// importer-canada.ts - Import Canadian supplier products to Cloudflare D1 + R2
// Run with: npx wrangler d1 execute YOUR_DB --file=scripts/import-canada.sql
// Or use this script with ts-node and Cloudflare API
// ============================================================================

import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { PricingEngine } from '../utils/pricing-engine';

// Configuration - Replace with your values
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN!;
const CLOUDFLARE_R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET!;
const CLOUDFLARE_D1_DATABASE_ID = process.env.CLOUDFLARE_D1_DATABASE_ID!;

// Cloudflare API endpoints
const R2_ENDPOINT = `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const D1_API = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${CLOUDFLARE_D1_DATABASE_ID}/query`;

// Pricing configuration (loaded from D1 or JSON)
interface PricingConfig {
  currencyRateCAD: number;
  currencyRateUSD: number;
  currencyRateCNY: number;
  customsFactor: number;
  shippingPerUnit: number;
  retailMarkupPct: number;
  wholesaleMarkupPct: number;
}

interface ProductRow {
  'Product Name'?: string;
  'Name'?: string;
  'Price'?: string;
  'Price CAD'?: string;
  'Price USD'?: string;
  'Currency'?: string;
  'Currency Code'?: string;
  'Stock'?: string;
  'Category'?: string;
  'Image URL'?: string;
  'image'?: string;
  'Description'?: string;
  'Source'?: string;
  'Supplier SKU'?: string;
  'Brand'?: string;
  'Weight'?: string;
}

interface Product {
  name: string;
  description: string;
  price: number;
  priceWholesale: number;
  landedCost: number;
  stock: number;
  category: string;
  imageUrl: string | null;
  source: string;
  supplierSku: string | null;
  brand: string | null;
  weight: number | null;
  createdAt: string;
}

// ------------------------------ R2 Image Upload ------------------------------
async function uploadImageToR2(imageUrl: string, fileName: string): Promise<string | null> {
  if (!imageUrl || imageUrl.trim() === '') return null;

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.warn(`Failed to fetch image: ${imageUrl} (${response.status})`);
      return null;
    }

    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    const uploadUrl = `${R2_ENDPOINT}/${CLOUDFLARE_R2_BUCKET}/products/${fileName}`;
    
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

// ------------------------------ D1 Database Operations ------------------------
async function insertProduct(product: Product): Promise<void> {
  const query = `
    INSERT INTO products (
      name, description, price, price_wholesale, landed_cost, 
      stock, category, image_url, source, supplier_sku, brand, 
      weight_kg, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    product.name,
    product.description,
    product.price,
    product.priceWholesale,
    product.landedCost,
    product.stock,
    product.category,
    product.imageUrl,
    product.source,
    product.supplierSku,
    product.brand,
    product.weight,
    product.createdAt,
    product.createdAt, // updated_at same as created_at initially
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

// ------------------------------ Pricing Calculation ---------------------------
async function calculatePriceFromCurrency(
  amount: number,
  currency: string,
  cfg: PricingConfig
): Promise<{ landed: number; retail: number; wholesale: number }> {
  // Convert to NGN
  let naira = amount;
  const upperCurrency = (currency || '').toUpperCase();
  
  switch (upperCurrency) {
    case 'CAD':
      naira = amount * cfg.currencyRateCAD;
      break;
    case 'USD':
      naira = amount * cfg.currencyRateUSD;
      break;
    case 'CNY':
      naira = amount * cfg.currencyRateCNY;
      break;
    case 'NGN':
      naira = amount;
      break;
    default:
      naira = amount * (cfg.currencyRateCAD || cfg.currencyRateUSD || 1);
  }

  // Landed cost calculation
  const customs = naira * (cfg.customsFactor || 0);
  const shipping = cfg.shippingPerUnit || 0;
  const landed = Math.round(naira + customs + shipping);

  // Markup calculations
  const retailMarkup = (cfg.retailMarkupPct || 30) / 100;
  const wholesaleMarkup = (cfg.wholesaleMarkupPct || 15) / 100;
  
  const retail = Math.round(landed + (landed * retailMarkup));
  const wholesale = Math.round(landed + (landed * wholesaleMarkup));

  return { landed, retail, wholesale };
}

// ------------------------------ Load Pricing Config ---------------------------
async function getPricingConfig(): Promise<PricingConfig> {
  // Try to load from D1 first
  const query = `
    SELECT key, value FROM app_settings 
    WHERE category = 'pricing' AND key IN (
      'currencyRateCAD', 'currencyRateUSD', 'currencyRateCNY',
      'customsFactor', 'shippingPerUnit', 'retailMarkupPct', 'wholesaleMarkupPct'
    )
  `;

  const response = await fetch(D1_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql: query }),
  });

  if (response.ok) {
    const data = await response.json() as any;
    const config: any = {};
    if (data.result && data.result.rows) {
      for (const row of data.result.rows) {
        config[row.key] = parseFloat(row.value);
      }
    }
    
    if (Object.keys(config).length > 0) {
      return config as PricingConfig;
    }
  }

  // Fallback to default config
  console.log('Using default pricing configuration');
  return {
    currencyRateCAD: 430,      // 1 CAD = 430 NGN
    currencyRateUSD: 580,      // 1 USD = 580 NGN
    currencyRateCNY: 80,       // 1 CNY = 80 NGN
    customsFactor: 0.05,       // 5% customs duty
    shippingPerUnit: 5000,     // 5000 NGN per unit shipping
    retailMarkupPct: 30,       // 30% retail markup
    wholesaleMarkupPct: 15,    // 15% wholesale markup
  };
}

// ------------------------------ CSV Parsing -----------------------------------
function parseCSV(filePath: string): ProductRow[] {
  const fileContent = readFileSync(filePath, 'utf-8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
  });
  return records as ProductRow[];
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\-.]/g, '')
    .substring(0, 200);
}

// ------------------------------ Main Import Function -------------------------
async function importCanadianProducts(csvPath: string): Promise<void> {
  console.log('🚀 CANADIAN SUPPLIER IMPORT STARTED');
  console.log(`📁 Reading CSV: ${csvPath}`);

  // Load pricing configuration
  const pricingConfig = await getPricingConfig();
  console.log('📊 Pricing config loaded:', {
    cadRate: pricingConfig.currencyRateCAD,
    usdRate: pricingConfig.currencyRateUSD,
    retailMarkup: pricingConfig.retailMarkupPct,
    wholesaleMarkup: pricingConfig.wholesaleMarkupPct,
  });

  const rows = parseCSV(csvPath);
  console.log(`📊 Found ${rows.length} products`);

  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  for (const item of rows) {
    try {
      // Extract product name
      const productName = item['Product Name'] || item['Name'];
      if (!productName) {
        console.warn('Skipping: No product name');
        skippedCount++;
        continue;
      }

      // Extract price and currency
      const priceRaw = item['Price'] || item['Price CAD'] || item['Price USD'] || '0';
      const priceNum = parseFloat(priceRaw);
      if (isNaN(priceNum)) {
        console.warn(`Skipping ${productName}: Invalid price`);
        skippedCount++;
        continue;
      }

      const currency = (item['Currency'] || item['Currency Code'] || 'CAD').trim();
      
      // Calculate prices
      const priceData = await calculatePriceFromCurrency(priceNum, currency, pricingConfig);

      // Upload image if available
      const imageUrl = item['Image URL'] || item['image'] || null;
      let uploadedImageUrl: string | null = null;
      let imageKey: string | null = null;

      if (imageUrl && imageUrl.trim()) {
        const imageName = `${sanitizeFileName(productName)}.jpg`;
        uploadedImageUrl = await uploadImageToR2(imageUrl, imageName);
        if (uploadedImageUrl) {
          imageKey = `products/${imageName}`;
        }
      }

      // Prepare product object
      const product: Product = {
        name: productName,
        description: item['Description'] || '',
        price: priceData.retail,
        priceWholesale: priceData.wholesale,
        landedCost: priceData.landed,
        stock: parseInt(item['Stock'] || '0', 10),
        category: item['Category'] || 'general',
        imageUrl: uploadedImageUrl,
        source: item['Source'] || currency.toLowerCase(),
        supplierSku: item['Supplier SKU'] || null,
        brand: item['Brand'] || null,
        weight: item['Weight'] ? parseFloat(item['Weight']) : null,
        createdAt: new Date().toISOString(),
      };

      // Insert into D1
      await insertProduct(product);
      successCount++;
      
      console.log(`✅ [${successCount}] Imported: ${productName} - ₦${priceData.retail.toLocaleString()}`);
    } catch (err) {
      console.error(`❌ Failed to import: ${item['Product Name'] || item['Name']}`, err);
      failCount++;
    }
  }

  console.log('\n📊 IMPORT SUMMARY');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`⏭️ Skipped: ${skippedCount}`);
  console.log('🎉 IMPORT COMPLETE');
}

// ------------------------------ Schema Updates -------------------------------
const SCHEMA_UPDATE_SQL = `
-- Add new columns for Canadian supplier data
ALTER TABLE products ADD COLUMN supplier_sku TEXT;
ALTER TABLE products ADD COLUMN brand TEXT;
ALTER TABLE products ADD COLUMN weight_kg REAL;
ALTER TABLE products ADD COLUMN landed_cost INTEGER;
ALTER TABLE products ADD COLUMN price_wholesale INTEGER;
ALTER TABLE products ADD COLUMN source TEXT;

-- Create index for source tracking
CREATE INDEX IF NOT EXISTS idx_products_source ON products(source);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
`;

async function updateSchema(): Promise<void> {
  console.log('🔧 Updating database schema...');
  
  const response = await fetch(D1_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql: SCHEMA_UPDATE_SQL }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.warn(`Schema update warning (may already exist): ${error}`);
  } else {
    console.log('✅ Database schema updated');
  }
}

// ------------------------------ Run Script -----------------------------------
if (require.main === module) {
  const csvPath = process.argv[2] || 'canada.csv';
  
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
    console.error('  export CLOUDFLARE_R2_BUCKET="primeshieldhub-products"');
    console.error('  export CLOUDFLARE_D1_DATABASE_ID="your-d1-id"');
    process.exit(1);
  }

  (async () => {
    try {
      await updateSchema();
      await importCanadianProducts(csvPath);
    } catch (err) {
      console.error('❌ Import failed:', err);
      process.exit(1);
    }
  })();
}

export { importCanadianProducts, getPricingConfig, calculatePriceFromCurrency };

