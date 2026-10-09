const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
  console.log('📤 Uploading files to R2...\n');
  
  // Walk through all files in the directory
  function walkDir(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        results = results.concat(walkDir(filePath));
      } else {
        results.push(filePath);
      }
    });
    return results;
  }
  
  const files = walkDir(sourceDir);
  
  if (files.length === 0) {
    console.log('No files found to upload');
    return;
  }
  
  console.log(`Found ${files.length} files to upload\n`);
  
  for (const filePath of files) {
    // Get the relative path from firebase-files
    const relativePath = path.relative(sourceDir, filePath);
    const r2Key = relativePath.replace(/\\/g, '/'); // Convert Windows paths to forward slashes
    
    console.log(`⬆️  Uploading: ${relativePath} → ${r2Key}`);
    
    try {
      await execAsync(`wrangler r2 object put primeshieldhub-storage/${r2Key} --file="${filePath}"`);
      console.log(`   ✅ Uploaded successfully`);
    } catch (error) {
      console.error(`   ❌ Error uploading:`, error.message);
    }
  }
  
  console.log(`\n✅ Uploaded ${files.length} files to R2 bucket: primeshieldhub-storage`);
}

uploadToR2();

