// ============================================================================
// import-products.ts - Import products from CSV to Cloudflare D1 + R2
// Run with: npx wrangler d1 execute YOUR_DB --file=scripts/import-products.sql
// Or use this script with Bun/Node and Cloudflare API
// ============================================================================

import { readFileSync, createWriteStream } from 'fs';
import { parse } from 'csv-parse/sync';
import path from 'path';

// Configuration - Replace with your values
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN!;
const CLOUDFLARE_R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET!; // e.g., "primeshieldhub-products"
const CLOUDFLARE_D1_DATABASE_ID = process.env.CLOUDFLARE_D1_DATABASE_ID!;

// Cloudflare API endpoints
const R2_ENDPOINT = `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const D1_API = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${CLOUDFLARE_D1_DATABASE_ID}/query`;

interface ProductRow {
  'Product Name': string;
  'Price': string;
  'Category': string;
  'Image URL': string;
  'Stock'?: string;
  'Description'?: string;
  'Warranty'?: string;
}

interface Product {
  name: string;
  price: number;
  category: string;
  imageUrl: string | null;
  stock: number;
  description: string | null;
  warranty: string | null;
  createdAt: string;
}

// ------------------------------ R2 Image Upload ------------------------------
async function uploadImageToR2(imageUrl: string, fileName: string): Promise<string | null> {
  try {
    // Fetch image from URL
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // Upload to R2 via Cloudflare API
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

    // Return public URL (if bucket is public) or presigned URL
    // For private buckets, generate a presigned URL using Workers
    return `https://${CLOUDFLARE_R2_BUCKET}.${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/products/${fileName}`;
  } catch (err) {
    console.error('Image upload failed:', err);
    return null;
  }
}

// ------------------------------ D1 Database Operations ------------------------
async function insertProduct(product: Product): Promise<void> {
  const query = `
    INSERT INTO products (name, price, category, image_url, stock, description, warranty, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    product.name,
    product.price,
    product.category,
    product.imageUrl,
    product.stock,
    product.description,
    product.warranty,
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

  console.log('✅ Added:', product.name);
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

// ------------------------------ Main Import Function -------------------------
async function importProducts(csvPath: string): Promise<void> {
  console.log('🚀 IMPORT STARTED');
  console.log(`📁 Reading CSV: ${csvPath}`);

  const rows = parseCSV(csvPath);
  console.log(`📊 Found ${rows.length} products`);

  let successCount = 0;
  let failCount = 0;

  for (const item of rows) {
    try {
      // Sanitize filename
      const imageName = item['Product Name']
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_\-.]/g, '')
        .substring(0, 200) + '.jpg';

      // Upload image to R2
      let imageUrl: string | null = null;
      if (item['Image URL'] && item['Image URL'].trim()) {
        console.log(`📸 Uploading image for: ${item['Product Name']}`);
        imageUrl = await uploadImageToR2(item['Image URL'], imageName);
      }

      // Prepare product data
      const product: Product = {
        name: item['Product Name'],
        price: parseFloat(item['Price']),
        category: item['Category'],
        imageUrl: imageUrl,
        stock: parseInt(item['Stock'] || '0', 10),
        description: item['Description'] || null,
        warranty: item['Warranty'] || null,
        createdAt: new Date().toISOString(),
      };

      // Insert into D1
      await insertProduct(product);
      successCount++;
    } catch (err) {
      console.error(`❌ Failed to import: ${item['Product Name']}`, err);
      failCount++;
    }
  }

  console.log('\n📊 IMPORT SUMMARY');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log('🎉 IMPORT COMPLETE');
}

// ------------------------------ Schema Setup (Run once) ----------------------
const SCHEMA_SQL = `
-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  category TEXT NOT NULL,
  image_url TEXT,
  stock INTEGER DEFAULT 0,
  description TEXT,
  warranty TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  INDEX idx_category (category),
  INDEX idx_name (name)
);

-- Create indexes for search
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
`;

async function setupDatabase(): Promise<void> {
  console.log('🔧 Setting up database schema...');
  
  const response = await fetch(D1_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sql: SCHEMA_SQL,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Schema setup failed: ${error}`);
  }

  console.log('✅ Database schema ready');
}

// ------------------------------ Run Script -----------------------------------
// Check if running directly
if (require.main === module) {
  const csvPath = process.argv[2] || 'supplier.csv';
  
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN || !CLOUDFLARE_R2_BUCKET || !CLOUDFLARE_D1_DATABASE_ID) {
    console.error('❌ Missing environment variables. Please set:');
    console.error('   - CLOUDFLARE_ACCOUNT_ID');
    console.error('   - CLOUDFLARE_API_TOKEN');
    console.error('   - CLOUDFLARE_R2_BUCKET');
    console.error('   - CLOUDFLARE_D1_DATABASE_ID');
    process.exit(1);
  }

  (async () => {
    try {
      await setupDatabase();
      await importProducts(csvPath);
    } catch (err) {
      console.error('❌ Import failed:', err);
      process.exit(1);
    }
  })();
}

export { importProducts, setupDatabase, insertProduct, uploadImageToR2 };

