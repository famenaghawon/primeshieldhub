import crypto from 'crypto';

// Node.js SHA-256
function nodeHash(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Web Crypto API (what Worker uses)
async function webCryptoHash(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

const password = 'Mustake0826)4';

console.log('Password:', password);
console.log('Node.js hash:', nodeHash(password));

webCryptoHash(password).then(hash => {
  console.log('Web Crypto hash:', hash);
  console.log('Database hash:  ', '8ca7a0a66b84f1bf9f48f58a6f2e793d9f33286a20628c56d94e19eb1fe44f02');
  console.log('Match?', hash === '8ca7a0a66b84f1bf9f48f58a6f2e793d9f33286a20628c56d94e19eb1fe44f02');
});

