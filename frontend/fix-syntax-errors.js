// C:\Users\myori\Desktop\primeshieldhub\frontend\fix-syntax-errors.js

const fs = require('fs');
const path = require('path');

function fixAssignmentErrors(filePath) {
    console.log(`Checking: ${filePath}`);
    let content = fs.readFileSync(filePath, 'utf8');
    let fixed = false;
    
    // Fix pattern: if (variable = value)
    content = content.replace(/if\s*\(\s*(\w+)\s*=\s*([^;]+)\)/g, (match, varName, value) => {
        console.log(`  Found: ${match} -> Using ===`);
        fixed = true;
        return `if (${varName} === ${value})`;
    });
    
    // Fix pattern: function = value (invalid assignment)
    content = content.replace(/(\w+)\s*=\s*function\s*=\s*([^;]+)/g, (match, name, value) => {
        console.log(`  Found: ${match} -> Fixing function assignment`);
        fixed = true;
        return `${name} = function() { return ${value}; }`;
    });
    
    // Fix pattern: double equals in assignment
    content = content.replace(/(\w+)\s*=\s*=\s*([^;]+)/g, (match, varName, value) => {
        if (!match.includes('===') && !match.includes('!==')) {
            console.log(`  Found: ${match} -> Removing extra equals`);
            fixed = true;
            return `${varName} = ${value}`;
        }
        return match;
    });
    
    if (fixed) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ Fixed: ${filePath}`);
    }
    return fixed;
}

function scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
            scanDirectory(fullPath);
        } else if (file.endsWith('.js')) {
            try {
                fixAssignmentErrors(fullPath);
            } catch (e) {
                console.error(`Error fixing ${fullPath}: ${e.message}`);
            }
        }
    }
}

// Scan the public/js directory
const jsDir = path.join(__dirname, 'public', 'js');
console.log('🔍 Scanning JavaScript files for syntax errors...');
scanDirectory(jsDir);

// Also scan buildmart/js
const buildmartJsDir = path.join(__dirname, 'public', 'buildmart', 'js');
if (fs.existsSync(buildmartJsDir)) {
    scanDirectory(buildmartJsDir);
}

console.log('✨ Done! Check the output above for changes.');
