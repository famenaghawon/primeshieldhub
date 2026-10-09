const fs = require('fs');
const path = require('path');

function fixInvalidAssignment(filePath) {
    console.log(`\n🔍 Checking: ${filePath}`);
    let content = fs.readFileSync(filePath, 'utf8');
    let changes = 0;

    // Fix 1: if (variable = value) -> if (variable === value)
    const ifPattern = /if\s*\(\s*(\w+)\s*=\s*([^;)]+)\)/g;
    let match;
    let newContent = content;
    while ((match = ifPattern.exec(content)) !== null) {
        const fullMatch = match[0];
        const varName = match[1];
        const value = match[2].trim();
        // Skip if it's already using === or !==
        if (!fullMatch.includes('===') && !fullMatch.includes('!==')) {
            const fixed = `if (${varName} === ${value})`;
            console.log(`  Found: ${fullMatch}`);
            console.log(`  Fixed:  ${fixed}`);
            newContent = newContent.replace(fullMatch, fixed);
            changes++;
        }
    }

    // Fix 2: variable = = value (double equals in assignment)
    const doubleAssignPattern = /(\w+)\s*=\s*=\s*([^;]+)/g;
    while ((match = doubleAssignPattern.exec(content)) !== null) {
        const fullMatch = match[0];
        if (!fullMatch.includes('===') && !fullMatch.includes('!==')) {
            const fixed = fullMatch.replace('= =', '=').replace('==', '=');
            console.log(`  Found: ${fullMatch}`);
            console.log(`  Fixed:  ${fixed}`);
            newContent = newContent.replace(fullMatch, fixed);
            changes++;
        }
    }

    // Fix 3: function() = value -> function() { return value; }
    const funcAssignPattern = /(\w+)\s*=\s*function\s*\(\s*\)\s*=\s*([^;]+)/g;
    while ((match = funcAssignPattern.exec(content)) !== null) {
        const fullMatch = match[0];
        const funcName = match[1];
        const value = match[2].trim();
        const fixed = `${funcName} = function() { return ${value}; }`;
        console.log(`  Found: ${fullMatch}`);
        console.log(`  Fixed:  ${fixed}`);
        newContent = newContent.replace(fullMatch, fixed);
        changes++;
    }

    // Fix 4: const x = function = value -> const x = function() { return value; }
    const constFuncPattern = /(const|let|var)\s+(\w+)\s*=\s*function\s*=\s*([^;]+)/g;
    while ((match = constFuncPattern.exec(content)) !== null) {
        const fullMatch = match[0];
        const type = match[1];
        const name = match[2];
        const value = match[3].trim();
        const fixed = `${type} ${name} = function() { return ${value}; }`;
        console.log(`  Found: ${fullMatch}`);
        console.log(`  Fixed:  ${fixed}`);
        newContent = newContent.replace(fullMatch, fixed);
        changes++;
    }

    if (changes > 0) {
        fs.writeFileSync(filePath, newContent);
        console.log(`✅ Fixed ${changes} issues in ${path.basename(filePath)}`);
        return changes;
    } else {
        console.log(`✅ No issues found in ${path.basename(filePath)}`);
        return 0;
    }
}

// Scan all JS files
function scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    let totalChanges = 0;
    
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
            totalChanges += scanDirectory(fullPath);
        } else if (file.endsWith('.js')) {
            try {
                totalChanges += fixInvalidAssignment(fullPath);
            } catch (e) {
                console.error(`Error fixing ${fullPath}: ${e.message}`);
            }
        }
    }
    return totalChanges;
}

console.log('🔍 Scanning JavaScript files for "Invalid left-hand side in assignment" errors...');
const jsDir = path.join(__dirname, 'public', 'js');
let total = 0;
if (fs.existsSync(jsDir)) {
    total += scanDirectory(jsDir);
}

const buildmartJsDir = path.join(__dirname, 'public', 'buildmart', 'js');
if (fs.existsSync(buildmartJsDir)) {
    total += scanDirectory(buildmartJsDir);
}

console.log(`\n✨ Done! Fixed ${total} issues total.`);
