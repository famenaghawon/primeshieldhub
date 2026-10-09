// fix-clearfilters.js
const fs = require('fs');

const filePath = './public/buildmart/js/main.js';
console.log(`📝 Fixing: ${filePath}`);

let content = fs.readFileSync(filePath, 'utf8');

// Find and fix the clearFilters function
const fixedFunction = `function clearFilters() {
    AppState.filters = {
        minPrice: 0,
        maxPrice: 999999999,
        stock: 'all',
        brand: ''
    };
    
    AppState.currentFilter = 'all';
    AppState.currentPage = 1;

    // Reset UI
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.filter-btn[data-filter="all"]')?.classList.add('active');
    document.getElementById('priceMin').value = '';
    document.getElementById('priceMax').value = '';
    document.getElementById('stockFilter').value = 'all';
    document.getElementById('searchInput').value = '';

    loadProductsFromAPI({
        category: 'all',
        sort: AppState.currentSort || 'default',
        page: 1
    }).then(() => {
        renderProducts('all', AppState.currentSort, 1);
        showNotification('Filters cleared', 'info', 2000);
    });
}`;

// Replace the entire clearFilters function
const regex = /function clearFilters\(\)\s*\{[\s\S]*?\}/;
if (regex.test(content)) {
    content = content.replace(regex, fixedFunction);
    fs.writeFileSync(filePath, content);
    console.log('✅ Fixed clearFilters function!');
} else {
    console.log('⚠️ Could not find clearFilters function in the file.');
}

console.log('\n✅ Done!');
