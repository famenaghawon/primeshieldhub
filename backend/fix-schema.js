// fix-schema.js - Run with: node fix-schema.js
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const SQL_COMMANDS = [
  "ALTER TABLE charging_sessions ADD COLUMN estimated_minutes INTEGER;",
  "ALTER TABLE charging_sessions ADD COLUMN estimated_completion DATETIME;",
  "ALTER TABLE branches ADD COLUMN city TEXT;",
  "ALTER TABLE branches ADD COLUMN address TEXT;",
  "ALTER TABLE branches ADD COLUMN manager TEXT;",
  "CREATE TABLE IF NOT EXISTS anomaly_logs (id TEXT PRIMARY KEY DEFAULT (uuid()), type TEXT, severity TEXT, message TEXT, details TEXT, timestamp TEXT DEFAULT CURRENT_TIMESTAMP);",
  "CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY DEFAULT (uuid()), action TEXT, user_id TEXT, resource TEXT, resource_id TEXT, changes TEXT, ip TEXT, fingerprint TEXT, timestamp TEXT DEFAULT CURRENT_TIMESTAMP);"
];

async function runFix() {
  console.log('🔧 Applying database schema fixes...\n');
  
  for (const sql of SQL_COMMANDS) {
    try {
      console.log(`Executing: ${sql.substring(0, 60)}...`);
      const { stdout, stderr } = await execAsync(
        `npx wrangler d1 execute primeshieldhub-db --remote --command="${sql}"`
      );
      if (stdout) console.log(`✅ ${stdout.trim()}`);
      if (stderr && !stderr.includes('already exists')) {
        console.log(`⚠️ ${stderr.trim()}`);
      }
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.log(`❌ Error: ${error.message}`);
      }
    }
  }
  
  console.log('\n✅ Schema fixes applied!');
  console.log('Run: node verify-api.js to test again');
}

runFix();





