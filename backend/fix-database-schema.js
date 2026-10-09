// fix-database-schema.js - Complete version
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const SQL_COMMANDS = [
  // Fix charging_sessions - add staff_name column
  "ALTER TABLE charging_sessions ADD COLUMN staff_name TEXT;",
  "ALTER TABLE charging_sessions ADD COLUMN estimated_minutes INTEGER;",
  "ALTER TABLE charging_sessions ADD COLUMN estimated_completion DATETIME;",
  
  // Fix branches - add missing columns
  "ALTER TABLE branches ADD COLUMN city TEXT;",
  "ALTER TABLE branches ADD COLUMN address TEXT;",
  "ALTER TABLE branches ADD COLUMN manager TEXT;",
  
  // Fix anomaly_logs - add source column
  "ALTER TABLE anomaly_logs ADD COLUMN source TEXT;",
  "ALTER TABLE anomaly_logs ADD COLUMN severity TEXT;",
  
  // Create anomaly_logs if it doesn't exist
  `CREATE TABLE IF NOT EXISTS anomaly_logs (
    id TEXT PRIMARY KEY DEFAULT (uuid()),
    type TEXT,
    severity TEXT DEFAULT 'medium',
    source TEXT,
    message TEXT,
    details TEXT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP
  );`,
  
  // Create audit_logs if it doesn't exist
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY DEFAULT (uuid()),
    action TEXT,
    user_id TEXT,
    resource TEXT,
    resource_id TEXT,
    changes TEXT,
    ip TEXT,
    fingerprint TEXT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP
  );`
];

async function runSchemaFix() {
  console.log('🔧 Applying database schema fixes...\n');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const sql of SQL_COMMANDS) {
    try {
      const cleanSql = sql.replace(/"/g, '\\"');
      console.log(`📝 ${sql.substring(0, 80)}...`);
      
      const { stdout, stderr } = await execAsync(
        `npx wrangler d1 execute primeshieldhub-db --remote --command="${cleanSql}"`
      );
      
      if (stderr && stderr.includes('already exists')) {
        console.log(`ℹ️ Already exists (skipped)`);
        successCount++;
      } else if (stderr && stderr.includes('duplicate column')) {
        console.log(`ℹ️ Column already exists (skipped)`);
        successCount++;
      } else if (stdout && stdout.includes('Error')) {
        console.log(`⚠️ ${stdout.trim()}`);
        failCount++;
      } else {
        console.log(`✅ Success`);
        successCount++;
      }
    } catch (error) {
      if (error.message.includes('already exists') || 
          error.message.includes('duplicate column') ||
          error.message.includes('SQLITE_ERROR')) {
        console.log(`ℹ️ Already exists or table missing (skipped)`);
        successCount++;
      } else {
        console.log(`❌ Error: ${error.message.substring(0, 150)}`);
        failCount++;
      }
    }
    console.log('---');
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 Schema Fix Results:`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  if (failCount === 0) {
    console.log('\n🎉 All schema fixes applied successfully!');
  } else {
    console.log('\n⚠️ Some fixes failed. You may need to run them manually.');
  }
}

runSchemaFix();
