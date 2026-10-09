// fix-exports.js
const fs = require('fs');
const path = require('path');

const files = [
    'src/handlers/admin-auth.js',
    'src/handlers/admin.js', 
    'src/handlers/branch.js',
    'src/handlers/charging.js'
];

function removeDefaultExport(content) {
    // Find the position of the last export default
    const lines = content.split('\n');
    let newLines = [];
    let inDefaultExport = false;
    let braceCount = 0;
    let foundStart = false;
    
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        
        // Check if this line starts a default export
        if (line.match(/^\s*export\s+default\s*\{/)) {
            inDefaultExport = true;
            braceCount = 1;
            foundStart = true;
            continue;
        }
        
        if (inDefaultExport) {
            // Count braces in this line
            const openBraces = (line.match(/\{/g) || []).length;
            const closeBraces = (line.match(/\}/g) || []).length;
            braceCount += openBraces - closeBraces;
            
            if (braceCount <= 0) {
                inDefaultExport = false;
                foundStart = false;
            }
            continue;
        }
        
        // If we found the start, we need to remove everything from there to the end
        if (foundStart) {
            // Skip this line (it's part of the default export)
            continue;
        }
        
        // Keep this line
        newLines.unshift(line);
    }
    
    // If we didn't find a default export, return original content
    if (!foundStart) {
        return content;
    }
    
    // Remove any trailing whitespace
    while (newLines.length > 0 && newLines[newLines.length - 1].trim() === '') {
        newLines.pop();
    }
    
    return newLines.join('\n');
}

files.forEach(file => {
    const fullPath = path.join(__dirname, file);
    console.log(`Processing: ${file}`);
    
    if (!fs.existsSync(fullPath)) {
        console.log(`  ⚠️ File not found: ${file}`);
        return;
    }
    
    const content = fs.readFileSync(fullPath, 'utf8');
    const newContent = removeDefaultExport(content);
    
    if (content !== newContent) {
        fs.writeFileSync(fullPath, newContent);
        console.log(`  ✅ Fixed: ${file}`);
    } else {
        console.log(`  ℹ️ No changes needed: ${file}`);
    }
});

console.log('\n✅ All files processed!');
