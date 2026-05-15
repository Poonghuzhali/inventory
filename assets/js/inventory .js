  /** Nav bar toggle */
  const btn = document.getElementById('menu-toggle');
        const sidebar = document.getElementById('sidebar');

        btn.addEventListener('click', () => {
            sidebar.classList.toggle('-translate-x-full');
        });

        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', (e) => {
            if (!sidebar.contains(e.target) && !btn.contains(e.target) && window.innerWidth < 1024) {
                sidebar.classList.add('-translate-x-full');
            }
        });

    /** Inventory data & filters */
let inventoryData = null;

const filters = {
    category: null,
    stock: null,
    expiry: null
};

async function loadData() {
    const cached = localStorage.getItem('inventoryData');
    if (cached) {
        inventoryData = JSON.parse(cached);
        return;
    }
    const response = await fetch('assets/js/inventory.json');
    inventoryData = await response.json();
    localStorage.setItem('inventoryData', JSON.stringify(inventoryData));
}

function renderFilters() {
    if (!inventoryData) return;

    const catSelect = document.getElementById('category-filters');
    const categories = Object.keys(inventoryData.inventory);
    let catHtml = '<option value="">All Categories</option>';
    categories.forEach(cat => {
        catHtml += `<option value="${cat}">${cat}</option>`;
    });
    catSelect.innerHTML = catHtml;

    const stockSelect = document.getElementById('stock-filters');
    const stockRanges = [
        { label: 'All Stock Levels', value: '' },
        { label: '0 - 10', value: '0-10' },
        { label: '11 - 25', value: '11-25' },
        { label: '26 - 50', value: '26-50' },
        { label: '50+', value: '51+' }
    ];
    let stockHtml = '';
    stockRanges.forEach(r => {
        stockHtml += `<option value="${r.value}">${r.label}</option>`;
    });
    stockSelect.innerHTML = stockHtml;

    const expirySelect = document.getElementById('expiry-filters');
    const expiryOptions = [
        { label: 'All Expiry', value: '' },
        { label: 'Expired', value: 'expired' },
        { label: 'Next 30 Days', value: '30' },
        { label: 'Next 90 Days', value: '90' },
        { label: 'Next 180 Days', value: '180' }
    ];
    let expiryHtml = '';
    expiryOptions.forEach(o => {
        expiryHtml += `<option value="${o.value}">${o.label}</option>`;
    });
    expirySelect.innerHTML = expiryHtml;

    document.querySelectorAll('.filter-select').forEach(sel => {
        sel.addEventListener('change', handleFilterChange);
    });
}

function handleFilterChange(e) {
    const select = e.currentTarget;

    if (select.id === 'category-filters') {
        filters.category = select.value || null;
    } else if (select.id === 'stock-filters') {
        filters.stock = select.value ? parseStockRange(select.value) : null;
    } else if (select.id === 'expiry-filters') {
        filters.expiry = select.value || null;
    }

    renderTable();
}

function parseStockRange(val) {
    if (val.endsWith('+')) {
        return { min: Number(val.slice(0, -1)), max: Infinity };
    }
    const parts = val.split('-');
    return { min: Number(parts[0]), max: Number(parts[1]) };
}

function renderTable() {
    const tableBody = document.getElementById('inventory-data-body');
    if (!inventoryData) {
        tableBody.innerHTML = '<tr><td colspan="7" class="p-10 text-center text-gray-500">Loading inventory...</td></tr>';
        return;
    }

    let allItems = [];
    for (const cat in inventoryData.inventory) {
        allItems = allItems.concat(inventoryData.inventory[cat]);
    }

    let filtered = allItems.filter(item => {
        if (filters.category && item.category !== filters.category) return false;
        if (filters.stock) {
            if (item.stock < filters.stock.min || item.stock > filters.stock.max) return false;
        }
        if (filters.expiry) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const expDate = new Date(item.exp_date);
            expDate.setHours(0, 0, 0, 0);
            if (filters.expiry === 'expired') {
                if (expDate >= today) return false;
            } else {
                const days = Number(filters.expiry);
                const limit = new Date(today);
                limit.setDate(limit.getDate() + days);
                if (expDate > limit || expDate < today) return false;
            }
        }
        return true;
    });

    if (filtered.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="p-10 text-center text-gray-500">No items match selected filters.</td></tr>';
        return;
    }

    const grouped = {};
    filtered.forEach(item => {
        if (!grouped[item.category]) grouped[item.category] = [];
        grouped[item.category].push(item);
    });

    let html = '';
    for (const cat in grouped) {
        html += `<tr class="bg-emerald-50"><td colspan="7" class="p-2 font-bold text-emerald-800 text-sm uppercase tracking-wider">${cat}</td></tr>`;
        grouped[cat].forEach(item => {
            const stockColor = item.stock < 15 ? 'text-red-600 font-bold' : 'text-gray-700';
            const badge = item.stock < 15
                ? '<span class="bg-red-100 text-red-700 px-2 py-1 rounded text-xs">Low</span>'
                : '<span class="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">OK</span>';
            html += `<tr class="hover:bg-gray-50 transition-colors">
                <td class="p-4 font-medium text-slate-800">${item.name}</td>
                <td class="p-4 text-xs text-gray-500 font-mono">${item.barcode}</td>
                <td class="p-4 text-gray-600">${item.unit}</td>
                <td class="p-4 font-semibold">\u20b9${item.price}</td>
                <td class="p-4 text-gray-500 text-sm">${item.gst}</td>
                <td class="p-4 ${stockColor}">${item.stock} ${badge}</td>
                <td class="p-4 text-sm text-gray-600">${item.exp_date}</td>
            </tr>`;
        });
    }

    tableBody.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    renderFilters();
    renderTable();
});