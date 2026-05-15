let expiryData = null;
let expirySearchQuery = '';

function flattenAllItems(data) {
    const arr = [];
    for (const cat in data.inventory) {
        data.inventory[cat].forEach(i => arr.push({ ...i, category: cat }));
    }
    return arr;
}

function getExpiryStatus(expDate) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const exp = new Date(expDate + 'T00:00:00');
    const diff = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { label: 'Expired', class: 'bg-red-100 text-red-700' };
    if (diff <= 30) return { label: 'Expiring Soon', class: 'bg-yellow-100 text-yellow-700' };
    return { label: 'Good', class: 'bg-green-100 text-green-700' };
}

function renderExpiryTable() {
    const tbody = document.getElementById('expiry-data-body');
    if (!expiryData) {
        tbody.innerHTML = '<tr><td colspan="10" class="p-10 text-center text-gray-500">Loading...</td></tr>';
        return;
    }

    let items = flattenAllItems(expiryData);

    if (expirySearchQuery) {
        const q = expirySearchQuery;
        items = items.filter(i =>
            i.name.toLowerCase().includes(q) ||
            i.sku.toLowerCase().includes(q) ||
            i.invoice.toLowerCase().includes(q)
        );
    }

    items.sort((a, b) => new Date(a.exp_date + 'T00:00:00') - new Date(b.exp_date + 'T00:00:00'));

    if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="10" class="p-10 text-center text-gray-500">No items found.</td></tr>';
        return;
    }

    let html = '';
    items.forEach(item => {
        const status = getExpiryStatus(item.exp_date);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const exp = new Date(item.exp_date + 'T00:00:00');
        const isExpired = exp < today;
        const rowClass = isExpired ? 'bg-red-50' : '';

        html += `<tr class="hover:bg-gray-50 transition-colors ${rowClass}">
            <td class="p-4 font-medium text-slate-800">${item.name}</td>
            <td class="p-4 text-xs text-gray-500 font-mono">${item.sku}</td>
            <td class="p-4 text-xs text-gray-500 font-mono">${item.barcode}</td>
            <td class="p-4 text-xs text-gray-500">${item.invoice}</td>
            <td class="p-4 text-xs text-gray-500">${item.category}</td>
            <td class="p-4 text-gray-600">${item.unit}</td>
            <td class="p-4 font-semibold">\u20b9${item.price}</td>
            <td class="p-4 text-gray-700">${item.stock}</td>
            <td class="p-4 text-sm font-mono text-gray-600">${item.exp_date}</td>
            <td class="p-4"><span class="${status.class} px-2 py-1 rounded text-xs font-semibold">${status.label}</span></td>
        </tr>`;
    });
    tbody.innerHTML = html;
}

function downloadExpiryCSV() {
    if (!expiryData) return;
    let items = flattenAllItems(expiryData);

    if (expirySearchQuery) {
        const q = expirySearchQuery;
        items = items.filter(i =>
            i.name.toLowerCase().includes(q) ||
            i.sku.toLowerCase().includes(q) ||
            i.invoice.toLowerCase().includes(q)
        );
    }

    items.sort((a, b) => new Date(a.exp_date + 'T00:00:00') - new Date(b.exp_date + 'T00:00:00'));

    const headers = ['Product', 'SKU', 'Barcode', 'Invoice', 'Category', 'Unit', 'Price', 'GST', 'MFG Date', 'Exp Date', 'Stock', 'Status'];
    const rows = items.map(i => {
        const status = getExpiryStatus(i.exp_date).label;
        return [i.name, i.sku, i.barcode, i.invoice, i.category, i.unit, i.price, i.gst, i.mfg_date, i.exp_date, i.stock, status];
    });

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'expiry-tracker-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!document.getElementById('expiry-data-body')) return;

    const cached = localStorage.getItem('inventoryData');
    if (cached) {
        expiryData = JSON.parse(cached);
        renderExpiryTable();
    } else {
        try {
            const response = await fetch('assets/js/inventory.json');
            expiryData = await response.json();
            localStorage.setItem('inventoryData', JSON.stringify(expiryData));
            renderExpiryTable();
        } catch {
            document.getElementById('expiry-data-body').innerHTML = '<tr><td colspan="10" class="p-10 text-center text-red-500">Failed to load data.</td></tr>';
        }
    }

    const searchInput = document.getElementById('expiry-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            expirySearchQuery = e.target.value.toLowerCase().trim();
            renderExpiryTable();
        });
    }

    document.getElementById('expiry-download-btn').addEventListener('click', downloadExpiryCSV);
});
