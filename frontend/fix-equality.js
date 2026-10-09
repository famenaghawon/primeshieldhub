// fix-equality.js - Targeted fix for the == error
const fs = require('fs');

const filePath = './public/buildmart/js/main.js';
console.log(`📝 Fixing: ${filePath}`);

let content = fs.readFileSync(filePath, 'utf8');

// Find problematic patterns
const problems = [];

// Check for == in template literals
const templateRegex = /\$\{[^}]*==[^}]*\}/g;
let match;
while ((match = templateRegex.exec(content)) !== null) {
    problems.push({
        line: content.substring(0, match.index).split('\n').length,
        match: match[0]
    });
}

console.log(`Found ${problems.length} potential issues in template literals:`);
problems.forEach(p => console.log(`  Line ${p.line}: ${p.match}`));

// Fix: Convert == to === in template literals
content = content.replace(/\$\{([^}]*?)==([^}]*?)\}/g, (match, left, right) => {
    console.log(`  Fixing: ${match} -> \${${left}===${right}}`);
    return `\${${left}===${right}}`;
});

// Also check for standalone == that might be problematic
const standaloneRegex = /([^=!])=([^=])/g;
let fixed = false;

// Write the fixed content
fs.writeFileSync(filePath, content);
console.log('✅ Fixed main.js');

console.log('\n🔍 Also check for these patterns in other files:');
console.log('  - Comparison in if statements using == (should be ===)');
console.log('  - Assignment in if statements (should be comparison)');
console.log('  - Missing parentheses in template literals');
