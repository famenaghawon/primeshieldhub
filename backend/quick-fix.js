// quick-fix.js - Run once to add missing columns
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const fixes = [
  "ALTER TABLE charging_sessions ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;",
  "ALTER TABLE charging_sessions ADD COLUMN staff_name TEXT;",
  "ALTER TABLE charging_sessions ADD COLUMN updated_at DATETIME;",
  "ALTER TABLE charging_sessions ADD COLUMN completed_time DATETIME;",
  "ALTER TABLE charging_sessions ADD COLUMN amount REAL DEFAULT 0;",
  "ALTER TABLE charging_sessions ADD COLUMN staff_id TEXT;",
];

async function runFixes() {
  console.log('🔧 Applying additional fixes...\n');
  
  for (const sql of fixes) {
    try {
      console.log(`📝 ${sql.substring(0, 60)}...`);
      await execAsync(`npx wrangler d1 execute primeshieldhub-db --remote --command="${sql.replace(/"/g, '\\"')}"`);
      console.log('✅ Success');
    } catch (error) {
      if (error.message.includes('duplicate column') || error.message.includes('already exists')) {
        console.log('ℹ️ Already exists');
      } else {
        console.log(`⚠️ ${error.message.substring(0, 100)}`);
      }
    }
  }
  console.log('\n✅ Done!');
}

runFixes();
