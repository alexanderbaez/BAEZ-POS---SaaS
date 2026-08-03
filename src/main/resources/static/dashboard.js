/**
 * BÁEZ POS - DASHBOARD DE GESTIÓN SAAS MULTI-TENANT
 * Alexander Baez - 2026
 */

// Cache de reportes históricos
let REPORTES_MESES_CACHE = {};

// ==========================================
// 1. INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Nombre de usuario
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

    // 3. Cargar datos en paralelo
    await Promise.allSettled([
        cargarDatosDashboardHoy(),
        cargarRangoHistoricoMensual(0),
        cargarAlertasStock(),
        cargarDatosGrafico()
    ]);
});

// Helper de formato de moneda ARS
function fmtMoneda(val) {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2
    }).format(val || 0);
}

// ==========================================
// 2. CARGA DE KPIS DEL DÍA (HOY)
// ==========================================
async function cargarDatosDashboardHoy() {
    try {
        const response = await apiFetch('/sales/report/box?period=today');
        if (!response || !response.ok) return;

        const data = await response.json();

        // Totales comerciales y caja de hoy
        if (document.getElementById('txtRecaudacion'))
            document.getElementById('txtRecaudacion').innerText = fmtMoneda(data.totalSales);

        if (document.getElementById('txtEfectivoHoy'))
            document.getElementById('txtEfectivoHoy').innerText = fmtMoneda(data.cashSales);

        if (document.getElementById('txtTransfHoy'))
            document.getElementById('txtTransfHoy').innerText = fmtMoneda(data.transferSales);

        if (document.getElementById('txtCobrosLibretaHoy'))
            document.getElementById('txtCobrosLibretaHoy').innerText = fmtMoneda(data.creditPaymentsToday || data.cobrosLibretaHoy || 0);

        // Deuda acumulada en libreta y saldo real disponible en caja
        if (document.getElementById('cardLibreta'))
            document.getElementById('cardLibreta').innerText = fmtMoneda(data.tCredit || data.totalPendingCredit || 0);

        if (document.getElementById('cardBalanceReal'))
            document.getElementById('cardBalanceReal').innerText = fmtMoneda(data.realBalance);

    } catch (err) {
        console.error("Error al cargar KPIs de Hoy:", err);
    }
}

// ==========================================
// 3. CONSULTA Y SELECTOR HISTÓRICO MENSUAL
// ==========================================
async function cambiarRangoHistorico(offsetMeses) {
    const offset = parseInt(offsetMeses) || 0;
    await cargarRangoHistoricoMensual(offset);
}

async function cargarRangoHistoricoMensual(offsetMeses = 0) {
    try {
        // Calcular rango de fechas según offset (0 = este mes, 1 = mes pasado, etc.)
        const fechaBase = new Date();
        fechaBase.setMonth(fechaBase.getMonth() - offsetMeses);

        const primerDia = new Date(fechaBase.getFullYear(), fechaBase.getMonth(), 1);
        const ultimoDia = new Date(fechaBase.getFullYear(), fechaBase.getMonth() + 1, 0);

        const fromStr = primerDia.toISOString().split('T')[0];
        const toStr = ultimoDia.toISOString().split('T')[0];

        let data = null;

        // Intento 1: Endpoint de rango específico
        const res = await apiFetch(`/sales/report/box?from=${fromStr}&to=${toStr}`);
        if (res && res.ok) {
            data = await res.json();
        } else {
            // Intento 2: Fallback por query parameter period / offset
            const resPeriod = await apiFetch(`/sales/report/box?monthOffset=${offsetMeses}`);
            if (resPeriod && resPeriod.ok) data = await resPeriod.json();
        }

        if (!data) return;

        // Renderizar métricas en las tarjetas
        if (document.getElementById('txtRecaudacionMes'))
            document.getElementById('txtRecaudacionMes').innerText = fmtMoneda(data.monthSales || data.totalSales);

        if (document.getElementById('txtGananciaMes'))
            document.getElementById('txtGananciaMes').innerText = fmtMoneda(data.monthProfit || data.totalProfit);

        if (document.getElementById('txtReposicionMes'))
            document.getElementById('txtReposicionMes').innerText = fmtMoneda(data.monthReplacementCost || data.replacementCost);

        if (document.getElementById('txtVentasCountMes'))
            document.getElementById('txtVentasCountMes').innerText = data.monthOperations || data.totalOperations || 0;

        // Actualizar etiqueta del título
        const nombresMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const lblTitulo = document.getElementById('lblTituloRecaudacion');
        if (lblTitulo) {
            lblTitulo.innerText = `RECAUDACIÓN (${nombresMeses[fechaBase.getMonth()].toUpperCase()} ${fechaBase.getFullYear()})`;
        }

    } catch (err) {
        console.error("Error al cargar reporte mensual histórico:", err);
    }
}

// ==========================================
// 4. GRÁFICO DE EVOLUCIÓN DE VENTAS
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
    gradient.addColorStop(0, 'rgba(37, 99, 235, 0.25)');
    gradient.addColorStop(1, 'rgba(37, 99, 235, 0.0)');

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
                tension: 0.35,
                pointRadius: 5,
                pointHoverRadius: 7,
                pointBackgroundColor: '#2563eb'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` Ventas: ${fmtMoneda(ctx.raw)}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#f1f5f9' },
                    ticks: {
                        callback: (value) => '$' + value.toLocaleString('es-AR')
                    }
                },
                x: { grid: { display: false } }
            }
        }
    });
}

// ==========================================
// 5. ALERTAS DE INVENTARIO Y STOCK CRÍTICO
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
                    <p class="mt-2 small text-muted">Stock al día. Sin alertas de reposición.</p>
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

// Exposición global para llamados desde HTML
window.cambiarRangoHistorico = cambiarRangoHistorico;