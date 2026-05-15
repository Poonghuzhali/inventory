async function loadDashboardData() {
    const cached = localStorage.getItem('inventoryData');
    if (cached) {
        const data = JSON.parse(cached);
        const firstSku = data.inventory[Object.keys(data.inventory)[0]]?.[0]?.sku;
        if (firstSku && /^\d{4}$/.test(firstSku)) {
            localStorage.removeItem('inventoryData');
        } else {
            return data;
        }
    }
    const response = await fetch('assets/js/inventory.json');
    const data = await response.json();
    localStorage.setItem('inventoryData', JSON.stringify(data));
    return data;
}

async function renderStats(data) {
    let totalStock = 0;
    let totalValue = 0;
    let lowStockCount = 0;

    for (const category in data.inventory) {
        data.inventory[category].forEach(item => {
            totalStock += item.stock;
            totalValue += item.price * item.stock;
            if (item.stock < 15) lowStockCount++;
        });
    }

    document.getElementById('total-stock').textContent = totalStock.toLocaleString('en-IN');
    document.getElementById('total-value').textContent = '\u20b9' + totalValue.toLocaleString('en-IN');
    document.getElementById('low-stock').textContent = lowStockCount;

    let supData = localStorage.getItem('suppliersData');
    if (!supData) {
        try {
            const response = await fetch('assets/js/suppliers.json');
            const json = await response.json();
            localStorage.setItem('suppliersData', JSON.stringify(json.suppliers));
            supData = localStorage.getItem('suppliersData');
        } catch {}
    }
    const suppliers = supData ? JSON.parse(supData) : [];
    document.getElementById('total-suppliers').textContent = suppliers.length;
}

function renderPieChart(data) {
    const labels = [];
    const values = [];
    const colors = [
        '#94a3b8', '#818cf8', '#f472b6', '#fb923c',
        '#fbbf24', '#a3e635', '#34d399', '#2dd4bf',
        '#22d3ee', '#38bdf8', '#c084fc', '#e879f9'
    ];

    for (const category in data.inventory) {
        labels.push(category);
        values.push(data.inventory[category].reduce((s, i) => s + i.stock, 0));
    }

    new Chart(document.getElementById('categoryPieChart'), {
        type: 'pie',
        data: {
            labels,
            datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { padding: 14, usePointStyle: true, font: { size: 10 }, boxWidth: 10 }
                }
            }
        }
    });
}

function renderBarChart(data) {
    const items = [];
    for (const category in data.inventory) {
        data.inventory[category].forEach(item => items.push(item));
    }

    items.sort((a, b) => b.stock - a.stock);
    const top = items.slice(0, 15);

    new Chart(document.getElementById('productBarChart'), {
        type: 'bar',
        data: {
            labels: top.map(i => i.name),
            datasets: [{
                data: top.map(i => i.stock),
                backgroundColor: '#94a3b8',
                hoverBackgroundColor: '#64748b',
                borderRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.raw + ' units' } } },
            scales: {
                x: { grid: { display: false }, ticks: { font: { size: 9 } } },
                y: { grid: { display: false }, ticks: { font: { size: 10 } } }
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const data = await loadDashboardData();
    await renderStats(data);
    renderPieChart(data);
    renderBarChart(data);
});