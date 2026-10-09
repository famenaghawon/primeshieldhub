const admin = 
const fs = require('fs');

// You need to download a service account key from Firebase
// Go to: Project Settings > Service Accounts > Generate New Private Key
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'primeshieldhub-efc30'
});

const db = admin.firestore();

async function exportCollection(collectionName, outputFile) {
  console.log(`Exporting ${collectionName}...`);
  const snapshot = await db.collection(collectionName).get();
  
  if (snapshot.empty) {
    console.log(`  No documents found in ${collectionName}`);
    return;
  }
  
  const data = [];
  snapshot.forEach(doc => {
    const docData = doc.data();
    // Convert Firebase Timestamps to readable format
    const processedData = {};
    for (const [key, value] of Object.entries(docData)) {
      if (value && value.toDate) {
        processedData[key] = value.toDate().toISOString();
      } else {
        processedData[key] = value;
      }
    }
    data.push({
      id: doc.id,
      ...processedData
    });
  });
  
  fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
  console.log(`  ✅ Exported ${data.length} documents to ${outputFile}`);
}

async function exportAll() {
  console.log('Starting Firestore export...\n');
  
  // Export all your collections
  await exportCollection('users', './users.json');
  await exportCollection('products', './products.json');
  await exportCollection('resellers', './resellers.json');
  await exportCollection('reseller_codes', './reseller_codes.json');
  await exportCollection('settings', './settings.json');
  await exportCollection('orders', './orders.json');
  
  console.log('\n✅ Export complete!');
}

exportAll().catch(console.error);

