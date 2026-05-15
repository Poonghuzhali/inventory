let suppliers = [];
let supplierSearchQuery = '';
let supplierDeleteTarget = null;

let supplierCategories = [];

async function loadSuppliers() {
    const cached = localStorage.getItem('suppliersData');
    if (cached) {
        suppliers = JSON.parse(cached);
    } else {
        const response = await fetch('assets/js/suppliers.json');
        const data = await response.json();
        suppliers = data.suppliers;
        localStorage.setItem('suppliersData', JSON.stringify(suppliers));
    }
}

function saveSuppliers() {
    localStorage.setItem('suppliersData', JSON.stringify(suppliers));
}

async function loadSupplierCategories() {
    const cached = localStorage.getItem('supplierCategories');
    if (cached) {
        supplierCategories = JSON.parse(cached);
    } else {
        const response = await fetch('assets/js/suppliers.json');
        const data = await response.json();
        supplierCategories = data.categories;
        localStorage.setItem('supplierCategories', JSON.stringify(supplierCategories));
    }
}

function saveSupplierCategories() {
    localStorage.setItem('supplierCategories', JSON.stringify(supplierCategories));
}

function populateSupplierCategoryDropdown(selected) {
    const sel = document.getElementById('sup-category');
    let html = '<option value="">Select Category</option>';
    supplierCategories.forEach(c => {
        html += `<option value="${c}"${c === selected ? ' selected' : ''}>${c}</option>`;
    });
    html += '<option value="__new__">+ Add New Category</option>';
    sel.innerHTML = html;
}

function initSupplierCategoryInput() {
    const sel = document.getElementById('sup-category');
    const wrap = document.getElementById('sup-new-category-wrap');
    const input = document.getElementById('sup-new-category');

    sel.addEventListener('change', () => {
        if (sel.value === '__new__') {
            wrap.classList.remove('hidden');
            input.focus();
        } else {
            wrap.classList.add('hidden');
            input.value = '';
        }
    });

    input.addEventListener('blur', () => addSupplierCategory());
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addSupplierCategory(); } });
}

function addSupplierCategory() {
    const input = document.getElementById('sup-new-category');
    const name = input.value.trim();
    if (!name) return;

    if (supplierCategories.includes(name)) {
        document.getElementById('sup-category').value = name;
        document.getElementById('sup-new-category-wrap').classList.add('hidden');
        input.value = '';
        return;
    }

    supplierCategories.push(name);
    saveSupplierCategories();

    populateSupplierCategoryDropdown(name);
    document.getElementById('sup-category').value = name;
    document.getElementById('sup-new-category-wrap').classList.add('hidden');
    input.value = '';
}

function getSupplierId(index) {
    return 'SPL-' + (index + 1).toString().padStart(3, '0');
}

function getFilteredSuppliers() {
    if (!supplierSearchQuery) return suppliers;
    const q = supplierSearchQuery;
    return suppliers.filter((s, i) => {
        const sid = getSupplierId(i);
        return s.name.toLowerCase().includes(q) ||
               sid.toLowerCase().includes(q) ||
               s.email.toLowerCase().includes(q) ||
               s.phone.includes(q);
    });
}

function renderSuppliers() {
    const tbody = document.getElementById('supplier-body');
    const items = getFilteredSuppliers();

    if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="p-10 text-center text-gray-500">No suppliers found.</td></tr>';
        return;
    }

    let html = '';
    items.forEach((s, i) => {
        const realIndex = suppliers.indexOf(s);
        const sid = getSupplierId(realIndex);
        const statusClass = s.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
        html += `<tr class="hover:bg-gray-50 transition-colors">
            <td class="p-4 font-mono text-sm font-semibold text-slate-700">${sid}</td>
            <td class="p-4"><span class="font-semibold text-slate-800">${s.name}</span><br><span class="text-xs text-slate-400">${s.category}</span></td>
            <td class="p-4 text-slate-700">${s.contact}</td>
            <td class="p-4 text-slate-600">${s.phone}</td>
            <td class="p-4 text-sm text-slate-500">${s.email}</td>
            <td class="p-4 text-sm text-slate-600">${s.address}</td>
            <td class="p-4"><span class="${statusClass} px-2 py-1 rounded text-xs font-semibold">${s.status}</span></td>
            <td class="p-4 text-center">
                <button class="sup-edit-btn text-slate-400 hover:text-emerald-600 transition mr-2" data-index="${realIndex}" title="Edit">
                    <svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                </button>
                <button class="sup-delete-btn text-slate-400 hover:text-red-600 transition" data-index="${realIndex}" title="Delete">
                    <svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </td>
        </tr>`;
    });
    tbody.innerHTML = html;

    tbody.querySelectorAll('.sup-edit-btn').forEach(b => b.addEventListener('click', () => openEditSupplier(Number(b.dataset.index))));
    tbody.querySelectorAll('.sup-delete-btn').forEach(b => b.addEventListener('click', () => openDeleteSupplier(Number(b.dataset.index))));
}

function downloadSuppliersCSV() {
    const items = getFilteredSuppliers();
    if (!items.length) return;

    const headers = ['Supplier ID', 'Supplier Name', 'Contact Person', 'Phone', 'Email', 'Category', 'Address', 'Status'];
    const rows = items.map((s, i) => {
        const sid = getSupplierId(suppliers.indexOf(s));
        return [sid, s.name, s.contact, s.phone, s.email, s.category, s.address, s.status];
    });

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'suppliers-export-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function openAddSupplier() {
    document.getElementById('supplier-edit-id').value = '';
    document.getElementById('supplier-modal-title').textContent = 'Add Supplier';
    document.getElementById('supplier-form').reset();
    document.querySelectorAll('#supplier-form .form-error').forEach(e => e.classList.add('hidden'));
    document.querySelectorAll('#supplier-form input, #supplier-form select, #supplier-form textarea').forEach(el => el.classList.remove('border-red-400'));
    document.getElementById('sup-new-category-wrap').classList.add('hidden');
    populateSupplierCategoryDropdown();
    document.getElementById('supplier-modal').classList.remove('hidden');
}

function openEditSupplier(index) {
    const s = suppliers[index];
    if (!s) return;
    document.getElementById('supplier-edit-id').value = index;
    document.getElementById('supplier-modal-title').textContent = 'Edit Supplier';
    document.querySelectorAll('#supplier-form .form-error').forEach(e => e.classList.add('hidden'));
    document.querySelectorAll('#supplier-form input, #supplier-form select, #supplier-form textarea').forEach(el => el.classList.remove('border-red-400'));

    document.getElementById('sup-name').value = s.name;
    document.getElementById('sup-contact').value = s.contact;
    document.getElementById('sup-phone').value = s.phone;
    document.getElementById('sup-email').value = s.email;
    document.getElementById('sup-status').value = s.status;
    document.getElementById('sup-address').value = s.address;

    document.getElementById('sup-new-category-wrap').classList.add('hidden');
    populateSupplierCategoryDropdown(s.category);

    document.getElementById('supplier-modal').classList.remove('hidden');
}

function closeSupplierModal() {
    document.getElementById('supplier-modal').classList.add('hidden');
}

function openDeleteSupplier(index) {
    supplierDeleteTarget = index;
    document.getElementById('sup-delete-name').textContent = suppliers[index].name;
    document.getElementById('sup-delete-modal').classList.remove('hidden');
}

function closeDeleteSupplierModal() {
    supplierDeleteTarget = null;
    document.getElementById('sup-delete-modal').classList.add('hidden');
}

function showSupError(inputId) {
    const input = document.getElementById(inputId);
    const err = input.parentElement.querySelector('.form-error');
    if (err) err.classList.remove('hidden');
    input.classList.add('border-red-400');
}

function clearSupErrors() {
    document.querySelectorAll('#supplier-form .form-error').forEach(e => e.classList.add('hidden'));
    document.querySelectorAll('#supplier-form input, #supplier-form select, #supplier-form textarea').forEach(el => el.classList.remove('border-red-400'));
}

function validateSupplierForm() {
    let valid = true;
    clearSupErrors();

    if (!document.getElementById('sup-name').value.trim()) { showSupError('sup-name'); valid = false; }
    if (!document.getElementById('sup-contact').value.trim()) { showSupError('sup-contact'); valid = false; }

    const phone = document.getElementById('sup-phone').value.trim();
    if (!phone) { showSupError('sup-phone'); valid = false; }
    else if (!/^\d{10}$/.test(phone)) {
        document.getElementById('sup-phone').classList.add('border-red-400');
        document.getElementById('sup-phone-format').classList.remove('hidden');
        valid = false;
    }

    const email = document.getElementById('sup-email').value.trim();
    if (!email) { showSupError('sup-email'); valid = false; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        document.getElementById('sup-email').classList.add('border-red-400');
        document.getElementById('sup-email-format').classList.remove('hidden');
        valid = false;
    }

    const catVal = document.getElementById('sup-category').value;
    if (!catVal) { showSupError('sup-category'); valid = false; }
    else if (catVal === '__new__') {
        const newCat = document.getElementById('sup-new-category').value.trim();
        if (!newCat) {
            document.getElementById('sup-category').classList.add('border-red-400');
            document.getElementById('sup-new-cat-error').classList.remove('hidden');
            valid = false;
        }
    }
    if (!document.getElementById('sup-status').value) { showSupError('sup-status'); valid = false; }
    if (!document.getElementById('sup-address').value.trim()) { showSupError('sup-address'); valid = false; }

    return valid;
}

function handleSupplierFormSubmit(e) {
    e.preventDefault();
    if (!validateSupplierForm()) return;

    const supplier = {
        name: document.getElementById('sup-name').value.trim(),
        contact: document.getElementById('sup-contact').value.trim(),
        phone: document.getElementById('sup-phone').value.trim(),
        email: document.getElementById('sup-email').value.trim(),
        category: document.getElementById('sup-category').value,
        status: document.getElementById('sup-status').value,
        address: document.getElementById('sup-address').value.trim()
    };

    const editId = document.getElementById('supplier-edit-id').value;

    if (editId !== '') {
        suppliers[Number(editId)] = supplier;
    } else {
        suppliers.push(supplier);
    }

    saveSuppliers();
    closeSupplierModal();
    renderSuppliers();
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!document.getElementById('supplier-body')) return;

    await loadSuppliers();
    await loadSupplierCategories();
    renderSuppliers();

    document.getElementById('supplier-search').addEventListener('input', (e) => {
        supplierSearchQuery = e.target.value.toLowerCase().trim();
        renderSuppliers();
    });

    document.getElementById('supplier-download-btn').addEventListener('click', downloadSuppliersCSV);
    document.getElementById('add-supplier-btn').addEventListener('click', openAddSupplier);
    document.getElementById('supplier-modal-close').addEventListener('click', closeSupplierModal);
    document.getElementById('sup-modal-cancel').addEventListener('click', closeSupplierModal);
    document.getElementById('supplier-modal-backdrop').addEventListener('click', closeSupplierModal);
    document.getElementById('supplier-form').addEventListener('submit', handleSupplierFormSubmit);
    initSupplierCategoryInput();
    document.getElementById('sup-delete-cancel').addEventListener('click', closeDeleteSupplierModal);
    document.getElementById('sup-delete-confirm').addEventListener('click', () => {
        if (supplierDeleteTarget !== null) {
            suppliers.splice(supplierDeleteTarget, 1);
            saveSuppliers();
            renderSuppliers();
        }
        closeDeleteSupplierModal();
    });
});
