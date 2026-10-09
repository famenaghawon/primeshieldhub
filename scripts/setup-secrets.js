// scripts/setup-secrets.js
// Interactive script to set all required secrets for production

import { execSync } from 'child_process';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

const REQUIRED_SECRETS = [
  { name: 'GATEWAY_SECRET', description: 'Primary secret for JWT and HMAC signing' },
  { name: 'UPSTASH_URL', description: 'Upstash Redis REST URL' },
  { name: 'UPSTASH_REDIS_REST_TOKEN', description: 'Upstash Redis REST token' },
  { name: 'CLOUDFLARE_ZONE_ID', description: 'Cloudflare Zone ID for IP blocking' },
  { name: 'CLOUDFLARE_API_TOKEN', description: 'Cloudflare API Token with Firewall permissions' },
  { name: 'TELEGRAM_TOKEN', description: 'Telegram Bot Token for alerts' },
  { name: 'TELEGRAM_CHAT_ID', description: 'Telegram Chat ID for alerts' },
  { name: 'TERMII_API_KEY', description: 'Termii API Key for SMS' },
  { name: 'WHATSAPP_TOKEN', description: 'WhatsApp Cloud API Token' },
  { name: 'WHATSAPP_PHONE_ID', description: 'WhatsApp Phone Number ID' },
  { name: 'RESEND_API_KEY', description: 'Resend API Key for emails' },
  { name: 'ADMIN_PHONE', description: 'Admin phone number (international format)' },
  { name: 'ADMIN_EMAIL', description: 'Admin email address' }
];

const OPTIONAL_SECRETS = [
  { name: 'FRAUD_AI_URL', description: 'External AI fraud detection endpoint' },
  { name: 'AI_API_KEY', description: 'API key for AI fraud service' }
];

async function setupSecrets() {
  console.log('\n🔐 PrimeShieldHub Secrets Setup\n');
  console.log('This script will help you set all required secrets for production.\n');
  console.log('Required secrets:');
  
  for (const secret of REQUIRED_SECRETS) {
    console.log(`  • ${secret.name}: ${secret.description}`);
    
    const existing = await checkSecret(secret.name);
    if (existing) {
      const update = await question(`    Secret already set. Update? (y/N): `);
      if (update.toLowerCase() !== 'y') {
        console.log(`    ⏭️  Skipping ${secret.name}`);
        continue;
      }
    }
    
    const value = await question(`    Enter value for ${secret.name}: `);
    if (value) {
      setSecret(secret.name, value);
      console.log(`    ✅ ${secret.name} set`);
    }
  }

  console.log('\nOptional secrets (press Enter to skip):');
  for (const secret of OPTIONAL_SECRETS) {
    const value = await question(`  ${secret.name} (${secret.description}): `);
    if (value) {
      setSecret(secret.name, value);
      console.log(`    ✅ ${secret.name} set`);
    }
  }

  console.log('\n✅ Secrets setup complete!');
  rl.close();
}

async function checkSecret(name) {
  try {
    execSync(`wrangler secret list --env production --name ${name}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function setSecret(name, value) {
  try {
    execSync(`echo "${value}" | wrangler secret put ${name} --env production`, {
      stdio: 'pipe'
    });
    return true;
  } catch (error) {
    console.error(`    ❌ Failed to set ${name}: ${error.message}`);
    return false;
  }
}

setupSecrets().catch(console.error);

