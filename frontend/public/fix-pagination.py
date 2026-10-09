# Fix pagination and perPage
js = open('js/main.js', 'r', encoding='utf-8').read()

# Fix 1: perPage 9 -> 24
js = js.replace('perPage = 9', 'perPage = 24')

# Fix 2: Replace crowded pagination with compact version
old_pagination = '''if (paginationEl) {
        if (totalPages <= 1) {
            paginationEl.innerHTML = '';
            return;
        }
        var pagHtml = '';
        for (var pNum = 1; pNum <= totalPages; pNum++) {
            var activeClass = pNum === page ? 'active' : '';
            pagHtml += '<button class="page-btn ' + activeClass + '" data-page="' + pNum + '" data-filter="' + filter + '" data-sort="' + sort + '">' + pNum + '</button>';
        }
        paginationEl.innerHTML = pagHtml;'''

new_pagination = '''if (paginationEl) {
        if (totalPages <= 1) {
            paginationEl.innerHTML = '';
            return;
        }
        var pagHtml = '';
        var maxButtons = 7;
        var startPage = Math.max(1, page - 3);
        var endPage = Math.min(totalPages, startPage + maxButtons - 1);
        if (endPage - startPage < maxButtons - 1) { startPage = Math.max(1, endPage - maxButtons + 1); }
        if (startPage > 1) { pagHtml += '<button class="page-btn" data-page="1" data-filter="' + filter + '" data-sort="' + sort + '">1</button><span class="page-dots">...</span>'; }
        for (var pNum = startPage; pNum <= endPage; pNum++) {
            var activeClass = pNum === page ? 'active' : '';
            pagHtml += '<button class="page-btn ' + activeClass + '" data-page="' + pNum + '" data-filter="' + filter + '" data-sort="' + sort + '">' + pNum + '</button>';
        }
        if (endPage < totalPages) { pagHtml += '<span class="page-dots">...</span><button class="page-btn" data-page="' + totalPages + '" data-filter="' + filter + '" data-sort="' + sort + '">' + totalPages + '</button>'; }
        paginationEl.innerHTML = pagHtml;'''

js = js.replace(old_pagination, new_pagination)

with open('js/main.js', 'w', encoding='utf-8') as f:
    f.write(js)

print('Fixed: perPage=24, compact pagination with max 7 buttons')
