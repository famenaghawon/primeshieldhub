import fs from 'fs';
import crypto from 'crypto';
import https from 'https';

const CONFIG = {
  workerUrl: 'https://primeshieldhub-production.primeshieldhub-a74.workers.dev',
  fingerprint: crypto.randomBytes(16).toString('hex'),
  cookieFile: './auth-cookies.json',
};

function getCookieHeader() {
  try {
    const data = JSON.parse(fs.readFileSync(CONFIG.cookieFile, 'utf8'));
    return Object.entries(data).map(([k, v]) => `${k}=${v}`).join('; ');
  } catch {
    return '';
  }
}

async function sendDeployLog() {
  const cookieHeader = getCookieHeader();
  console.log('Cookie:', cookieHeader.substring(0, 50) + '...');
  
  const urlObj = new URL(`${CONFIG.workerUrl}/api/deploy/log`);
  
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-fingerprint': CONFIG.fingerprint,
        'Cookie': cookieHeader,
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Response:', body);
        resolve();
      });
    });
    
    req.on('error', reject);
    req.write(JSON.stringify({
      type: 'deploy',
      status: 'success',
      message: 'Deployment successful!',
    }));
    req.end();
  });
}

sendDeployLog();

