const fs = require('fs');
const path = require('path');

function fixSyntaxErrors(filePath) {
    console.log(`\n📝 Fixing: ${filePath}`);
    let content = fs.readFileSync(filePath, 'utf8');
    let changes = 0;

    // Fix the specific issue: sort === == 'value' -> sort === 'value'
    const patterns = [
        // Fix sort === == 'price-asc'
        { 
            find: /sort\s*===\s*==\s*['"]([^'"]+)['"]/g,
            replace: "sort === '$1'"
        },
        // Fix any other === == patterns
        {
            find: /(\w+)\s*===\s*==\s*['"]([^'"]+)['"]/g,
            replace: "$1 === '$2'"
        },
        // Fix any double equals that might have been created
        {
            find: /(\w+)\s*===\s*==\s*([^,;)\s]+)/g,
            replace: "$1 === $2"
        }
    ];

    // Apply each pattern
    for (const pattern of patterns) {
        // Reset the regex before using it
        pattern.find.lastIndex = 0;
        
        // Check if the pattern exists
        if (pattern.find.test(content)) {
            // Reset again because test() advances the index
            pattern.find.lastIndex = 0;
            
            // Count matches
            const matches = content.match(pattern.find);
            if (matches) {
                console.log(`  Found ${matches.length} matches for pattern`);
            }
            
            // Apply the replacement
            const newContent = content.replace(pattern.find, pattern.replace);
            if (newContent !== content) {
                changes += (matches ? matches.length : 0);
                content = newContent;
                console.log(`  Applied fix for pattern`);
            }
        }
    }

    // Also fix the template literal issue we created earlier
    const templateFixes = [
        { find: /\$\{i\s*===\s*==\s*page/g, replace: '${i === page' },
        { find: /\$\{i\s*==\s*page/g, replace: '${i === page' }
    ];
    
    for (const fix of templateFixes) {
        if (fix.find.test(content)) {
            fix.find.lastIndex = 0;
            content = content.replace(fix.find, fix.replace);
            changes++;
            console.log(`  Fixed template literal issue`);
        }
    }

    if (changes > 0) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ Fixed ${changes} issues in ${path.basename(filePath)}`);
        return changes;
    } else {
        console.log(`✅ No issues found in ${path.basename(filePath)}`);
        return 0;
    }
}

// Fix the main file
const mainJsPath = './public/buildmart/js/main.js';
if (fs.existsSync(mainJsPath)) {
    fixSyntaxErrors(mainJsPath);
} else {
    console.log('❌ main.js not found at:', mainJsPath);
}

console.log('\n✨ Done! Redeploy to apply fixes.');
