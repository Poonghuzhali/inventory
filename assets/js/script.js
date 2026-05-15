/** Nav bar toggle */
const btn = document.getElementById('menu-toggle');
const sidebar = document.getElementById('sidebar');
if (btn) {
    btn.addEventListener('click', () => sidebar.classList.toggle('-translate-x-full'));
    document.addEventListener('click', (e) => {
        if (!sidebar.contains(e.target) && !btn.contains(e.target) && window.innerWidth < 1024)
            sidebar.classList.add('-translate-x-full');
    });
}

/** State */
let inventoryData = null;
let deleteTarget = null;

const filters = { category: null, supplier: null, sku: null, stock: null, invoice: null, expiry: null };
let searchQuery = '';

const skuPrefixMap = {
    'Fruits & Vegetables': 'FV', 'Dairy & Bakery': 'DB', 'Staples & Grains': 'SG',
    'Cooking Oils & Ghee': 'CO', 'Snacks & Biscuits': 'SB', 'Beverages': 'BV',
    'Spices & Seasonings': 'SS', 'Cleaning Supplies': 'CS', 'Personal Care': 'PC',
    'Baby Care': 'BC', 'Home & Kitchen': 'HK', 'Frozen Foods': 'FF'
};

let suppliersList = [];
let categorySupplierMap = {};

async function loadSupplierDataForInventory() {
    let suppliers;
    const cached = localStorage.getItem('suppliersData');
    if (cached) {
        suppliers = JSON.parse(cached);
    } else {
        const response = await fetch('assets/js/suppliers.json');
        const data = await response.json();
        suppliers = data.suppliers;
        localStorage.setItem('suppliersData', JSON.stringify(suppliers));
    }

    suppliersList = suppliers.map(s => s.name);

    categorySupplierMap = {};
    suppliers.forEach(s => {
        categorySupplierMap[s.category] = s.name;
    });
    categorySupplierMap['Baby Care'] = 'GlowCare Personal';
    categorySupplierMap['Home & Kitchen'] = 'CleanHome Supplies';
}

/** Data */
async function loadData() {
    const cached = localStorage.getItem('inventoryData');
    if (cached) {
        inventoryData = JSON.parse(cached);
        // Check if cached data has old SKU format (all digits) — re-fetch if stale
        const firstSku = inventoryData.inventory[Object.keys(inventoryData.inventory)[0]]?.[0]?.sku;
        if (firstSku && /^\d{4}$/.test(firstSku)) {
            localStorage.removeItem('inventoryData');
            inventoryData = null;
        } else {
            return;
        }
    }
    const response = await fetch('assets/js/inventory.json');
    inventoryData = await response.json();
    localStorage.setItem('inventoryData', JSON.stringify(inventoryData));
}

function saveData() {
    localStorage.setItem('inventoryData', JSON.stringify(inventoryData));
}

function findItemBySku(sku) {
    for (const cat in inventoryData.inventory) {
        const idx = inventoryData.inventory[cat].findIndex(i => i.sku === sku);
        if (idx !== -1) return { category: cat, index: idx, item: inventoryData.inventory[cat][idx] };
    }
    return null;
}

/** Filters */
function renderFilters() {
    if (!inventoryData) return;

    const flat = flattenItems();

    // Category
    const catSel = document.getElementById('category-filters');
    let html = '<option value="">All Categories</option>';
    Object.keys(inventoryData.inventory).sort().forEach(c => { html += `<option value="${c}">${c}</option>`; });
    catSel.innerHTML = html;

    // Supplier
    const supSel = document.getElementById('supplier-filters');
    html = '<option value="">All Suppliers</option>';
    const supData = localStorage.getItem('suppliersData');
    const suppliers = supData ? JSON.parse(supData) : [];
    (suppliers.length ? suppliers : suppliersList).forEach(s => {
        const name = typeof s === 'string' ? s : s.name;
        html += `<option value="${name}">${name}</option>`;
    });
    supSel.innerHTML = html;

    // SKU
    const skuSel = document.getElementById('sku-filters');
    html = '<option value="">All SKUs</option>';
    flat.forEach(i => { html += `<option value="${i.sku}">${i.sku}</option>`; });
    skuSel.innerHTML = html;

    // Stock
    const stkSel = document.getElementById('stock-filters');
    const ranges = [
        { label: 'All Stock Levels', value: '' },
        { label: '0 - 10', value: '0-10' },
        { label: '11 - 25', value: '11-25' },
        { label: '26 - 50', value: '26-50' },
        { label: '50+', value: '51+' }
    ];
    html = '';
    ranges.forEach(r => { html += `<option value="${r.value}">${r.label}</option>`; });
    stkSel.innerHTML = html;

    // Invoice
    const invSel = document.getElementById('invoice-filters');
    html = '<option value="">All Invoices</option>';
    flat.forEach(i => { html += `<option value="${i.invoice}">${i.invoice}</option>`; });
    invSel.innerHTML = html;

    // Expiry
    const expSel = document.getElementById('expiry-filters');
    const opts = [
        { label: 'All Expiry', value: '' },
        { label: 'Expired', value: 'expired' },
        { label: 'Next 30 Days', value: '30' },
        { label: 'Next 90 Days', value: '90' },
        { label: 'Next 180 Days', value: '180' }
    ];
    html = '';
    opts.forEach(o => { html += `<option value="${o.value}">${o.label}</option>`; });
    expSel.innerHTML = html;

    document.querySelectorAll('.filter-select').forEach(s => s.addEventListener('change', handleFilterChange));
}

function handleFilterChange(e) {
    const sel = e.currentTarget;
    const val = sel.value;
    switch (sel.id) {
        case 'category-filters': filters.category = val || null; break;
        case 'supplier-filters': filters.supplier = val || null; break;
        case 'sku-filters': filters.sku = val || null; break;
        case 'stock-filters': filters.stock = val ? parseStockRange(val) : null; break;
        case 'invoice-filters': filters.invoice = val || null; break;
        case 'expiry-filters': filters.expiry = val || null; break;
    }
    renderTable();
}

function parseStockRange(val) {
    if (val.endsWith('+')) return { min: Number(val.slice(0, -1)), max: Infinity };
    const p = val.split('-');
    return { min: Number(p[0]), max: Number(p[1]) };
}

/** Search */
function initSearch() {
    const input = document.getElementById('search-input');
    if (!input) return;
    input.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        renderTable();
    });
}

/** Flatten */
function flattenItems() {
    const arr = [];
    for (const cat in inventoryData.inventory) {
        inventoryData.inventory[cat].forEach(i => arr.push(i));
    }
    return arr;
}

/** Filtering */
function getFilteredItems() {
    if (!inventoryData) return [];
    return flattenItems().filter(item => {
        if (filters.category && item.category !== filters.category) return false;
        if (filters.supplier) {
            const itemSupplier = item.supplier || categorySupplierMap[item.category] || '';
            if (itemSupplier !== filters.supplier) return false;
        }
        if (filters.sku && item.sku !== filters.sku) return false;
        if (filters.stock && (item.stock < filters.stock.min || item.stock > filters.stock.max)) return false;
        if (filters.invoice && item.invoice !== filters.invoice) return false;
        if (filters.expiry) {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const exp = new Date(item.exp_date); exp.setHours(0, 0, 0, 0);
            if (filters.expiry === 'expired') { if (exp >= today) return false; }
            else {
                const days = Number(filters.expiry);
                const limit = new Date(today); limit.setDate(limit.getDate() + days);
                if (exp > limit || exp < today) return false;
            }
        }
        if (searchQuery) {
            const q = searchQuery;
            if (!item.name.toLowerCase().includes(q) && !item.sku.toLowerCase().includes(q) && !item.invoice.toLowerCase().includes(q))
                return false;
        }
        return true;
    });
}

/** Table */
function renderTable() {
    const tbody = document.getElementById('inventory-data-body');
    if (!inventoryData) {
        tbody.innerHTML = '<tr><td colspan="11" class="p-10 text-center text-gray-500">Loading inventory...</td></tr>';
        return;
    }

    const items = getFilteredItems();

    if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="11" class="p-10 text-center text-gray-500">No items match the selected filters.</td></tr>';
        return;
    }

    const grouped = {};
    items.forEach(i => {
        if (!grouped[i.category]) grouped[i.category] = [];
        grouped[i.category].push(i);
    });

    let html = '';
    for (const cat in grouped) {
        html += `<tr class="bg-emerald-50"><td colspan="11" class="p-2 font-bold text-emerald-800 text-sm uppercase tracking-wider">${cat}</td></tr>`;
        grouped[cat].forEach(item => {
            const supplier = item.supplier || categorySupplierMap[item.category] || '—';
            const low = item.stock < 15;
            const badge = low
                ? '<span class="bg-red-100 text-red-700 px-2 py-1 rounded text-xs">Low</span>'
                : '<span class="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">OK</span>';
            html += `<tr class="hover:bg-gray-50 transition-colors">
                <td class="p-4 font-medium text-slate-800">${item.name}</td>
                <td class="p-4 text-xs text-gray-500 font-mono">${item.sku}</td>
                <td class="p-4"><svg class="barcode" data-value="${item.barcode}"></svg></td>
                <td class="p-4 text-xs text-gray-500">${item.invoice}</td>
                <td class="p-4 text-xs text-gray-500">${supplier}</td>
                <td class="p-4 text-gray-600">${item.unit}</td>
                <td class="p-4 font-semibold">\u20b9${item.price}</td>
                <td class="p-4 text-gray-500 text-sm">${item.gst}</td>
                <td class="p-4 ${low ? 'text-red-600 font-bold' : 'text-gray-700'}">${item.stock} ${badge}</td>
                <td class="p-4 text-sm text-gray-600">${item.exp_date}</td>
                <td class="p-4 text-center">
                    <button class="edit-btn text-slate-400 hover:text-emerald-600 transition mr-2" data-sku="${item.sku}" title="Edit">
                        <svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    </button>
                    <button class="delete-btn text-slate-400 hover:text-red-600 transition" data-sku="${item.sku}" title="Delete">
                        <svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </td>
            </tr>`;
        });
    }
    tbody.innerHTML = html;

    tbody.querySelectorAll('.edit-btn').forEach(b => b.addEventListener('click', () => openEditModal(b.dataset.sku)));
    tbody.querySelectorAll('.delete-btn').forEach(b => b.addEventListener('click', () => openDeleteModal(b.dataset.sku)));

    if (typeof JsBarcode !== 'undefined') {
        tbody.querySelectorAll('.barcode').forEach(el => {
            JsBarcode(el, el.dataset.value, { format: 'CODE128', width: 0.9, height: 24, displayValue: false, margin: 0 });
        });
    }
}

/** Download */
function downloadCSV() {
    const items = getFilteredItems();
    if (!items.length) return;

    const headers = ['Product', 'SKU', 'Barcode', 'Invoice', 'Supplier', 'Category', 'Unit', 'Price', 'GST', 'MFG Date', 'Exp Date', 'Stock'];
    const rows = items.map(i => [
        i.name, i.sku, i.barcode, i.invoice, i.supplier || categorySupplierMap[i.category] || '', i.category, i.unit,
        i.price, i.gst, i.mfg_date, i.exp_date, i.stock
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory-export-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function generateBarcode() {
    const prefix = '890';
    let barcode;
    do {
        const rand = Math.floor(1000000000 + Math.random() * 9000000000).toString();
        barcode = prefix + rand.slice(0, 10);
    } while (findItemByBarcode(barcode));
    return barcode;
}

function findItemByBarcode(barcode) {
    for (const cat in inventoryData.inventory) {
        if (inventoryData.inventory[cat].some(i => i.barcode === barcode)) return true;
    }
    return false;
}

function parseUnit(unitStr) {
    const m = unitStr && unitStr.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
    if (m) return { count: m[1], type: m[2] };
    return { count: '1', type: unitStr || '' };
}

function generateInvoice() {
    const year = new Date().getFullYear();
    let maxNum = 0;
    const flat = flattenItems();
    flat.forEach(i => {
        const m = i.invoice && i.invoice.match(new RegExp('^INV-' + year + '-(\\d{3})$'));
        if (m) maxNum = Math.max(maxNum, Number(m[1]));
    });
    return 'INV-' + year + '-' + (maxNum + 1).toString().padStart(3, '0');
}

/** Modals */
function openAddModal() {
    document.getElementById('edit-index').value = '';
    document.getElementById('modal-title').textContent = 'Add Product';
    document.getElementById('product-form').reset();
    document.querySelectorAll('.form-error').forEach(e => e.classList.add('hidden'));
    document.querySelectorAll('#product-form input, #product-form select').forEach(el => el.classList.remove('border-red-400'));
    document.getElementById('new-category-wrap').classList.add('hidden');
    populateCategoryDropdown();
    populateSupplierDropdown();
    document.getElementById('form-barcode').value = generateBarcode();
    document.getElementById('product-modal').classList.remove('hidden');
}

function openEditModal(sku) {
    const found = findItemBySku(sku);
    if (!found) return;
    const item = found.item;
    document.getElementById('edit-index').value = sku;
    document.getElementById('modal-title').textContent = 'Edit Product';
    document.querySelectorAll('.form-error').forEach(e => e.classList.add('hidden'));
    document.querySelectorAll('#product-form input, #product-form select').forEach(el => el.classList.remove('border-red-400'));
    document.getElementById('new-category-wrap').classList.add('hidden');

    document.getElementById('form-name').value = item.name;
    document.getElementById('form-sku').value = item.sku;
    document.getElementById('form-barcode').value = item.barcode;
    document.getElementById('form-invoice').value = item.invoice;
    const parsed = parseUnit(item.unit);
    document.getElementById('form-unit').value = parsed.type;
    document.getElementById('form-unit-count').value = parsed.count;
    document.getElementById('form-price').value = item.price;
    document.getElementById('form-mfg').value = item.mfg_date;
    document.getElementById('form-exp').value = item.exp_date;
    document.getElementById('form-stock').value = item.stock;

    populateCategoryDropdown(item.category);
    populateSupplierDropdown(item.supplier || categorySupplierMap[item.category] || '');
    const gstSel = document.getElementById('form-gst');
    gstSel.value = item.gst;

    document.getElementById('product-modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('product-modal').classList.add('hidden');
}

function openDeleteModal(sku) {
    const found = findItemBySku(sku);
    if (!found) return;
    deleteTarget = sku;
    document.getElementById('delete-product-name').textContent = found.item.name;
    document.getElementById('delete-modal').classList.remove('hidden');
}

function closeDeleteModal() {
    deleteTarget = null;
    document.getElementById('delete-modal').classList.add('hidden');
}

function populateCategoryDropdown(selected) {
    const sel = document.getElementById('form-category');
    let html = '<option value="">Select Category</option>';
    Object.keys(inventoryData.inventory).sort().forEach(c => {
        html += `<option value="${c}"${c === selected ? ' selected' : ''}>${c}</option>`;
    });
    html += '<option value="__new__">+ Add New Category</option>';
    sel.innerHTML = html;
}

function populateSupplierDropdown(selected) {
    const sel = document.getElementById('form-supplier');
    let html = '<option value="">Select</option>';
    suppliersList.forEach(s => {
        html += `<option value="${s}"${s === selected ? ' selected' : ''}>${s}</option>`;
    });
    sel.innerHTML = html;
}

function initCategoryInput() {
    const sel = document.getElementById('form-category');
    const wrap = document.getElementById('new-category-wrap');
    const input = document.getElementById('form-new-category');

    sel.addEventListener('change', () => {
        if (sel.value === '__new__') {
            wrap.classList.remove('hidden');
            input.focus();
        } else {
            wrap.classList.add('hidden');
            input.value = '';
            suggestSku(sel.value);
            const mapped = categorySupplierMap[sel.value];
            if (mapped) document.getElementById('form-supplier').value = mapped;
        }
    });

    input.addEventListener('blur', () => addNewCategory());
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addNewCategory(); } });
}

function suggestSku(category) {
    const prefix = skuPrefixMap[category] || category.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    let maxNum = 0;
    for (const c in inventoryData.inventory) {
        inventoryData.inventory[c].forEach(i => {
            const m = i.sku && i.sku.match(new RegExp('^' + prefix + '(\\d{3})$'));
            if (m) maxNum = Math.max(maxNum, Number(m[1]));
        });
    }
    const skuInput = document.getElementById('form-sku');
    if (!skuInput.value || /^[A-Za-z]{2}\d{3}$/.test(skuInput.value)) {
        skuInput.value = prefix + (maxNum + 1).toString().padStart(3, '0');
    }
}

function addNewCategory() {
    const input = document.getElementById('form-new-category');
    const name = input.value.trim();
    if (!name) return;

    // Check duplicate
    if (inventoryData.inventory[name]) {
        document.getElementById('form-category').value = name;
        document.getElementById('new-category-wrap').classList.add('hidden');
        input.value = '';
        return;
    }

    inventoryData.inventory[name] = [];
    saveData();

    populateCategoryDropdown(name);
    document.getElementById('form-category').value = name;
    suggestSku(name);
    document.getElementById('new-category-wrap').classList.add('hidden');
    input.value = '';
}

/** Form */
function showFieldError(inputId) {
    const input = document.getElementById(inputId);
    const err = input.parentElement.querySelector('.form-error');
    if (err) err.classList.remove('hidden');
    input.classList.add('border-red-400');
}

function clearFormErrors() {
    document.querySelectorAll('.form-error').forEach(e => e.classList.add('hidden'));
    document.querySelectorAll('#product-form input, #product-form select').forEach(el => el.classList.remove('border-red-400'));
}

function validateForm() {
    let valid = true;
    clearFormErrors();

    if (!document.getElementById('form-name').value.trim()) { showFieldError('form-name'); valid = false; }

    const invoice = document.getElementById('form-invoice').value.trim();
    if (!invoice) { showFieldError('form-invoice'); valid = false; }
    else if (!/^INV-\d{4}-\d{3}$/.test(invoice)) {
        document.getElementById('form-invoice').classList.add('border-red-400');
        document.getElementById('invoice-format-error').classList.remove('hidden');
        valid = false;
    }

    if (!document.getElementById('form-supplier').value) { showFieldError('form-supplier'); valid = false; }

    const catVal = document.getElementById('form-category').value;
    if (!catVal) { showFieldError('form-category'); valid = false; }
    else if (catVal === '__new__') {
        const newCat = document.getElementById('form-new-category').value.trim();
        if (!newCat) {
            document.getElementById('form-category').classList.add('border-red-400');
            document.getElementById('new-cat-error').classList.remove('hidden');
            valid = false;
        }
    }
    if (!document.getElementById('form-unit').value.trim()) { showFieldError('form-unit'); valid = false; }

    const price = Number(document.getElementById('form-price').value);
    if (isNaN(price) || price < 0) { showFieldError('form-price'); valid = false; }

    if (!document.getElementById('form-gst').value) { showFieldError('form-gst'); valid = false; }

    const mfg = document.getElementById('form-mfg').value;
    const exp = document.getElementById('form-exp').value;
    const today = new Date(); today.setHours(0, 0, 0, 0);

    if (!mfg) { showFieldError('form-mfg'); valid = false; }
    if (!exp) { showFieldError('form-exp'); valid = false; }

    if (mfg) {
        const mfgDate = new Date(mfg); mfgDate.setHours(0, 0, 0, 0);
        if (mfgDate > today) {
            document.getElementById('form-mfg').classList.add('border-red-400');
            document.getElementById('mfg-future-error').classList.remove('hidden');
            valid = false;
        }
    }

    if (exp) {
        const expDate = new Date(exp); expDate.setHours(0, 0, 0, 0);
        const minExp = new Date(today); minExp.setDate(minExp.getDate() + 30);
        if (expDate < minExp) {
            document.getElementById('form-exp').classList.add('border-red-400');
            document.getElementById('exp-future-error').classList.remove('hidden');
            valid = false;
        }
    }

    if (mfg && exp && new Date(exp) <= new Date(mfg)) {
        document.getElementById('form-exp').classList.add('border-red-400');
        document.getElementById('exp-order-error').classList.remove('hidden');
        valid = false;
    }

    const stock = Number(document.getElementById('form-stock').value);
    if (isNaN(stock) || stock < 0 || !Number.isInteger(stock)) { showFieldError('form-stock'); valid = false; }

    const unitCount = Number(document.getElementById('form-unit-count').value);
    if (isNaN(unitCount) || unitCount < 1 || !Number.isInteger(unitCount)) { showFieldError('form-unit-count'); valid = false; }

    return valid;
}

function handleFormSubmit(e) {
    e.preventDefault();
    if (!validateForm()) return;

    const unitType = document.getElementById('form-unit').value.trim();
    const unitCount = document.getElementById('form-unit-count').value.trim();
    const item = {
        name: document.getElementById('form-name').value.trim(),
        sku: document.getElementById('form-sku').value.trim(),
        barcode: document.getElementById('form-barcode').value.trim(),
        invoice: document.getElementById('form-invoice').value.trim(),
        category: document.getElementById('form-category').value,
        supplier: document.getElementById('form-supplier').value,
        unit: unitCount + ' ' + unitType,
        price: Number(document.getElementById('form-price').value),
        gst: document.getElementById('form-gst').value,
        mfg_date: document.getElementById('form-mfg').value,
        exp_date: document.getElementById('form-exp').value,
        stock: Number(document.getElementById('form-stock').value)
    };

    const editSku = document.getElementById('edit-index').value;

    if (editSku) {
        // Edit mode
        const found = findItemBySku(editSku);
        if (found) {
            if (found.category !== item.category) {
                inventoryData.inventory[found.category].splice(found.index, 1);
                if (inventoryData.inventory[found.category].length === 0) delete inventoryData.inventory[found.category];
                if (!inventoryData.inventory[item.category]) inventoryData.inventory[item.category] = [];
                inventoryData.inventory[item.category].push(item);
            } else {
                Object.assign(found.item, item);
            }
        }
    } else {
        // Add mode
        if (!inventoryData.inventory[item.category]) inventoryData.inventory[item.category] = [];
        inventoryData.inventory[item.category].push(item);
    }

    saveData();
    closeModal();
    renderFilters();
    renderTable();
}

/** Init */
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    await loadSupplierDataForInventory();

    // Only run inventory-page logic if the table body exists
    if (!document.getElementById('inventory-data-body')) return;

    renderFilters();
    renderTable();
    initSearch();

    document.getElementById('download-btn').addEventListener('click', downloadCSV);
    document.getElementById('add-product-btn').addEventListener('click', openAddModal);
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    document.getElementById('modal-backdrop').addEventListener('click', closeModal);
    document.getElementById('product-form').addEventListener('submit', handleFormSubmit);
    initCategoryInput();
    document.getElementById('delete-cancel').addEventListener('click', closeDeleteModal);
    document.getElementById('delete-confirm').addEventListener('click', () => {
        if (deleteTarget) {
            const found = findItemBySku(deleteTarget);
            if (found) {
                inventoryData.inventory[found.category].splice(found.index, 1);
                if (inventoryData.inventory[found.category].length === 0) delete inventoryData.inventory[found.category];
                saveData();
                renderFilters();
                renderTable();
            }
        }
        closeDeleteModal();
    });
});