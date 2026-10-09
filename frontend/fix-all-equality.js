const fs = require('fs');
const path = require('path');

function fixEqualityOperators(filePath) {
    console.log(`\n📝 Checking: ${filePath}`);
    let content = fs.readFileSync(filePath, 'utf8');
    let changes = 0;

    // Fix == in template literals
    const templateRegex = /\$\{([^}]*?)==([^}]*?)\}/g;
    let match;
    let newContent = content;
    
    while ((match = templateRegex.exec(content)) !== null) {
        const fullMatch = match[0];
        const left = match[1].trim();
        const right = match[2].trim();
        const fixed = `\${${left} === ${right}}`;
        
        console.log(`  Found: ${fullMatch}`);
        console.log(`  Fixed:  ${fixed}`);
        
        newContent = newContent.replace(fullMatch, fixed);
        changes++;
    }

    // Fix assignment in if statements (x = y instead of x === y)
    const ifRegex = /if\s*\(\s*(\w+)\s*=\s*([^;)]+)\)/g;
    while ((match = ifRegex.exec(content)) !== null) {
        const fullMatch = match[0];
        const varName = match[1];
        const value = match[2].trim();
        const fixed = `if (${varName} === ${value})`;
        
        if (!fullMatch.includes('===') && !fullMatch.includes('!==')) {
            console.log(`  Found: ${fullMatch}`);
            console.log(`  Fixed:  ${fixed}`);
            newContent = newContent.replace(fullMatch, fixed);
            changes++;
        }
    }

    if (changes > 0) {
        fs.writeFileSync(filePath, newContent);
        console.log(`✅ Fixed ${changes} issues in ${path.basename(filePath)}`);
    } else {
        console.log(`✅ No issues found in ${path.basename(filePath)}`);
    }
    
    return changes;
}

// Fix the main file
const mainJsPath = './public/buildmart/js/main.js';
if (fs.existsSync(mainJsPath)) {
    fixEqualityOperators(mainJsPath);
} else {
    console.log('❌ main.js not found at:', mainJsPath);
}

console.log('\n✨ Done! Redeploy to apply fixes.');
