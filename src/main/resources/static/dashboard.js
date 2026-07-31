/**
 * BÁEZ POS - DASHBOARD DE GESTIÓN SAAS
 * Alexander Baez - 2026
 */

// ==========================================
// 1. INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Mostrar nombre de usuario
    const elUserLabel = document.getElementById('userNameLabel');
    if (elUserLabel) {
        const nombreUsuario = localStorage.getItem('baezpos_user_name');
        elUserLabel.innerText = nombreUsuario ? nombreUsuario.toUpperCase() : "USUARIO";
    }

    // 2. Fecha actual formateada
    if (document.getElementById('fechaActual')) {
        const hoy = new Date();
        document.getElementById('fechaActual').innerText = hoy.toLocaleDateString('es-AR', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    // 3. Ejecutar cargas asíncronas en paralelo controlado
    await Promise.allSettled([
        cargarDatosDashboard(),
        cargarAlertasStock(),
        cargarDatosGrafico()
    ]);
});

// ==========================================
// 2. CARGA DE KPIS DEL DASHBOARD
// ==========================================
async function cargarDatosDashboard() {
    try {
        const response = await apiFetch('/sales/report/box?period=today');
        if (!response || !response.ok) return;

        const data = await response.json();

        // Formateador de moneda en ARS
        const fmt = (val) => new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            signDisplay: 'auto'
        }).format(val || 0);

        // Totales Diarios
        if (document.getElementById('txtRecaudacion'))
            document.getElementById('txtRecaudacion').innerText = fmt(data.totalSales);

        if (document.getElementById('cardBalanceReal'))
            document.getElementById('cardBalanceReal').innerText = fmt(data.realBalance);

        if (document.getElementById('txtEfectivoHoy'))
            document.getElementById('txtEfectivoHoy').innerText = fmt(data.cashSales);

        if (document.getElementById('txtTransfHoy'))
            document.getElementById('txtTransfHoy').innerText = fmt(data.transferSales);

        // Cuentas Corrientes (Libreta)
        if (document.getElementById('cardLibreta')) {
            const elLibreta = document.getElementById('cardLibreta');
            const saldoLibreta = data.tCredit || 0;
            elLibreta.innerText = fmt(saldoLibreta);
        }

        // Métricas Mensuales
        if (document.getElementById('txtRecaudacionMes'))
            document.getElementById('txtRecaudacionMes').innerText = fmt(data.monthSales);

        if (document.getElementById('txtGananciaMes'))
            document.getElementById('txtGananciaMes').innerText = fmt(data.monthProfit);

        if (document.getElementById('txtReposicionMes'))
            document.getElementById('txtReposicionMes').innerText = fmt(data.monthReplacementCost);

        if (document.getElementById('txtVentasCountMes'))
            document.getElementById('txtVentasCountMes').innerText = data.monthOperations || 0;

    } catch (err) {
        console.error("Error al cargar KPIs del Dashboard:", err);
    }
}

// ==========================================
// 3. GRÁFICO SEMANAL
// ==========================================
async function cargarDatosGrafico() {
    try {
        const response = await apiFetch('/sales/report/chart');
        if (!response || !response.ok) return;

        const data = await response.json();

        if (!data || data.length === 0) {
            renderizarGraficoSemanal([], []);
            return;
        }

        const etiquetas = data.map(item => {
            const partes = item.label.split('-');
            return partes.length === 3 ? `${partes[2]}/${partes[1]}` : item.label;
        });

        const valores = data.map(item => item.total);
        renderizarGraficoSemanal(etiquetas, valores);

    } catch (err) {
        console.error("Error cargando el gráfico:", err);
    }
}

function renderizarGraficoSemanal(etiquetas, valores) {
    const canvas = document.getElementById('chartSemanal');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(37, 99, 235, 0.2)');
    gradient.addColorStop(1, 'rgba(37, 99, 235, 0)');

    if (window.myChart) window.myChart.destroy();

    window.myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: etiquetas,
            datasets: [{
                label: 'Ventas ($)',
                data: valores,
                borderColor: '#2563eb',
                borderWidth: 3,
                backgroundColor: gradient,
                fill: true,
                tension: 0.3,
                pointRadius: 4,
                pointBackgroundColor: '#2563eb'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
                x: { grid: { display: false } }
            }
        }
    });
}

// ==========================================
// 4. ALERTAS DE STOCK
// ==========================================
async function cargarAlertasStock() {
    try {
        const res = await apiFetch('/products');
        if (!res || !res.ok) return;

        const productos = await res.json();
        const criticos = productos.filter(p => p.stock <= 10);

        const badge = document.getElementById('badgeStockCount');
        if (badge) badge.innerText = criticos.length;

        const container = document.getElementById('listaAlertasStock');
        if (!container) return;

        if (criticos.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4 opacity-75">
                    <i class="bi bi-check-circle fs-1 text-success"></i>
                    <p class="mt-2 small text-muted">Stock al día. Sin alertas.</p>
                </div>`;
            return;
        }

        container.innerHTML = criticos.map(p => `
            <div class="d-flex align-items-center p-3 mb-2 rounded-3 border-start border-4 ${p.stock <= 3 ? 'border-danger bg-danger bg-opacity-10' : 'border-warning bg-warning bg-opacity-10'}">
                <div class="flex-grow-1">
                    <h6 class="mb-0 fw-bold small text-dark">${(p.name || '').toUpperCase()}</h6>
                    <small class="text-muted">Quedan ${p.stock} unidades</small>
                </div>
                <span class="badge ${p.stock <= 3 ? 'bg-danger' : 'bg-warning'} rounded-pill">${p.stock}</span>
            </div>
        `).join('');

    } catch (err) {
        console.error("Error al cargar alertas de stock:", err);
    }
}