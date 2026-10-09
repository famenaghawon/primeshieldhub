// ============================================================================
// export-d1-to-json.ts - Export Cloudflare D1 tables to JSON files
// Run with: npx ts-node scripts/export-d1-to-json.ts
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';

// Configuration - Replace with your values
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const CLOUDFLARE_D1_DATABASE_ID = process.env.CLOUDFLARE_D1_DATABASE_ID || '';

// D1 API endpoint
const D1_API = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${CLOUDFLARE_D1_DATABASE_ID}/query`;

// Output directory
const OUTPUT_DIR = './exports';

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

interface TableInfo {
  name: string;
  description: string;
}

// List of tables to export (based on your Firebase collections)
const TABLES: TableInfo[] = [
  { name: 'users', description: 'User accounts and profiles' },
  { name: 'products', description: 'Product catalog' },
  { name: 'resellers', description: 'Reseller information' },
  { name: 'reseller_codes', description: 'Reseller discount codes' },
  { name: 'settings', description: 'Application settings' },
  { name: 'orders', description: 'Customer orders' },
  { name: 'transactions', description: 'Payment transactions' },
  { name: 'carts', description: 'Shopping carts' },
  { name: 'wishlists', description: 'User wishlists' },
  { name: 'categories', description: 'Product categories' },
  { name: 'reviews', description: 'Product reviews' },
  { name: 'blog_posts', description: 'Blog content' },
  { name: 'faqs', description: 'Frequently asked questions' },
  { name: 'contacts', description: 'Contact form submissions' },
  { name: 'newsletter', description: 'Newsletter subscribers' }
];

// Helper function to execute D1 query
async function executeQuery(sql: string, params: any[] = []): Promise<any[]> {
  const response = await fetch(D1_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sql: sql,
      params: params,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`D1 query failed: ${error}`);
  }

  const data = await response.json() as any;
  
  // Handle D1 response format
  if (data.result && data.result.rows) {
    return data.result.rows;
  }
  
  if (data.result && data.result[0] && data.result[0].results) {
    return data.result[0].results;
  }
  
  return [];
}

// Check if table exists
async function tableExists(tableName: string): Promise<boolean> {
  try {
    const query = `
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name=?
    `;
    const rows = await executeQuery(query, [tableName]);
    return rows.length > 0;
  } catch (error) {
    console.error(`   ⚠️  Error checking table ${tableName}:`, error);
    return false;
  }
}

// Get column info for a table
async function getTableColumns(tableName: string): Promise<string[]> {
  try {
    const query = `PRAGMA table_info(${tableName})`;
    const rows = await executeQuery(query, []);
    return rows.map((row: any) => row.name);
  } catch (error) {
    console.error(`   ⚠️  Error getting columns for ${tableName}:`, error);
    return [];
  }
}

// Export a single table to JSON
async function exportTable(tableInfo: TableInfo): Promise<void> {
  const { name: tableName, description } = tableInfo;
  
  console.log(`\n📁 Exporting ${tableName}... (${description})`);
  
  try {
    // Check if table exists
    const exists = await tableExists(tableName);
    if (!exists) {
      console.log(`   ⚠️  Table '${tableName}' does not exist. Skipping...`);
      return;
    }
    
    // Get column info
    const columns = await getTableColumns(tableName);
    if (columns.length === 0) {
      console.log(`   ⚠️  No columns found for ${tableName}. Skipping...`);
      return;
    }
    
    // Query all data from table
    const query = `SELECT * FROM ${tableName}`;
    const rows = await executeQuery(query, []);
    
    if (rows.length === 0) {
      console.log(`   ⚠️  No data found in ${tableName}`);
      return;
    }
    
    // Process data (convert any special types)
    const processedData = rows.map((row: any) => {
      const processed: any = {};
      for (const [key, value] of Object.entries(row)) {
        // Handle Date/Time strings
        if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
          processed[key] = value;
        } else if (value && typeof value === 'object' && value !== null) {
          // Handle nested objects (JSON fields)
          processed[key] = value;
        } else {
          processed[key] = value;
        }
      }
      return processed;
    });
    
    // Write to file
    const outputPath = path.join(OUTPUT_DIR, `${tableName}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(processedData, null, 2));
    console.log(`   ✅ Exported ${processedData.length} records to ${outputPath}`);
    
  } catch (error) {
    console.error(`   ❌ Error exporting ${tableName}:`, error);
  }
}

// Export all tables
async function exportAllTables(): Promise<void> {
  console.log('🚀 Starting D1 Database Export...');
  console.log('================================');
  console.log(`📂 Output directory: ${OUTPUT_DIR}`);
  console.log(`🗄️  Database ID: ${CLOUDFLARE_D1_DATABASE_ID}`);
  console.log('');
  
  let exportedCount = 0;
  let skippedCount = 0;
  
  for (const table of TABLES) {
    await exportTable(table);
    exportedCount++;
  }
  
  // Also try to export any other tables not in the list
  console.log('\n🔍 Checking for additional tables...');
  try {
    const query = `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`;
    const allTables = await executeQuery(query, []);
    
    for (const table of allTables) {
      const tableName = table.name;
      // Skip if already in our list
      if (!TABLES.some(t => t.name === tableName)) {
        await exportTable({ name: tableName, description: 'Auto-discovered table' });
        exportedCount++;
      }
    }
  } catch (error) {
    console.log('   ⚠️  Could not discover additional tables:', error);
  }
  
  console.log('\n✅ Export complete!');
  console.log('\n📄 Generated files:');
  
  const files = fs.readdirSync(OUTPUT_DIR);
  files.forEach(file => {
    const stats = fs.statSync(path.join(OUTPUT_DIR, file));
    const sizeKB = (stats.size / 1024).toFixed(2);
    console.log(`   📄 ${file} (${sizeKB} KB)`);
  });
  
  console.log(`\n📊 Summary:`);
  console.log(`   Total tables exported: ${exportedCount}`);
  console.log(`   Output directory: ${OUTPUT_DIR}`);
}

// Alternative: Export specific tables only
async function exportSpecificTables(tableNames: string[]): Promise<void> {
  console.log('🚀 Exporting specific tables...');
  console.log('================================');
  
  for (const tableName of tableNames) {
    await exportTable({ name: tableName, description: 'User-specified table' });
  }
  
  console.log('\n✅ Export complete!');
}

// Generate SQL INSERT statements from JSON (for migration)
function generateInsertStatements(jsonFilePath: string, tableName: string): void {
  const data = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));
  
  if (!Array.isArray(data) || data.length === 0) {
    console.log(`No data to generate INSERT statements for ${tableName}`);
    return;
  }
  
  const columns = Object.keys(data[0]);
  const insertStatements: string[] = [];
  
  for (const row of data) {
    const values = columns.map(col => {
      const val = row[col];
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
      if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
      return val;
    });
    
    insertStatements.push(
      `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});`
    );
  }
  
  const outputPath = path.join(OUTPUT_DIR, `${tableName}_inserts.sql`);
  fs.writeFileSync(outputPath, insertStatements.join('\n'));
  console.log(`   📝 Generated INSERT statements: ${outputPath}`);
}

// Run the export
async function main(): Promise<void> {
  // Check environment variables
  const requiredEnv = ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_D1_DATABASE_ID'];
  const missing = requiredEnv.filter(env => !process.env[env]);
  
  if (missing.length > 0) {
    console.error('❌ Missing environment variables:', missing.join(', '));
    console.error('\nPlease set:');
    console.error('  export CLOUDFLARE_ACCOUNT_ID="your-account-id"');
    console.error('  export CLOUDFLARE_API_TOKEN="your-api-token"');
    console.error('  export CLOUDFLARE_D1_DATABASE_ID="your-d1-id"');
    process.exit(1);
  }
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const specificTables = args.filter(arg => !arg.startsWith('--'));
  const generateInserts = args.includes('--inserts');
  
  try {
    if (specificTables.length > 0) {
      await exportSpecificTables(specificTables);
    } else {
      await exportAllTables();
    }
    
    // Generate INSERT statements if requested
    if (generateInserts) {
      console.log('\n📝 Generating INSERT statements...');
      const files = fs.readdirSync(OUTPUT_DIR);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const tableName = file.replace('.json', '');
          generateInsertStatements(path.join(OUTPUT_DIR, file), tableName);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { exportTable, exportAllTables, exportSpecificTables, generateInsertStatements };

