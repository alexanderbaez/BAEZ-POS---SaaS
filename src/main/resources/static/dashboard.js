/**
 * BÁEZ POS - DASHBOARD DE GESTIÓN SAAS MULTI-TENANT
 * Alexander Baez - 2026
 */

// ==========================================
// 1. INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    const elUserLabel = document.getElementById('userNameLabel');
    if (elUserLabel) {
        const nombreUsuario = localStorage.getItem('baezpos_user_name');
        elUserLabel.innerText = nombreUsuario ? nombreUsuario.toUpperCase() : "USUARIO";
    }

    if (document.getElementById('fechaActual')) {
        const hoy = new Date();
        document.getElementById('fechaActual').innerText = hoy.toLocaleDateString('es-AR', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    // Inicializar fechas por defecto (Este mes)
    aplicarPresetFecha('ESTE_MES');

    await Promise.allSettled([
        cargarDatosDashboardHoy(),
        cargarAlertasStock(),
        cargarDatosGrafico()
    ]);
});

function fmtMoneda(val) {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2
    }).format(val || 0);
}

// Formatea fecha Date a String 'YYYY-MM-DD' en HOY LOCAL (Evita desfases de toISOString UTC)
function formatDateLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ==========================================
// 2. CARGA DE KPIS DEL DÍA (HOY)
// ==========================================
async function cargarDatosDashboardHoy() {
    try {
        const response = await apiFetch('/sales/report/box?period=today');
        if (!response || !response.ok) return;

        const data = await response.json();

        if (document.getElementById('txtRecaudacion'))
            document.getElementById('txtRecaudacion').innerText = fmtMoneda(data.totalSales);

        if (document.getElementById('txtEfectivoHoy'))
            document.getElementById('txtEfectivoHoy').innerText = fmtMoneda(data.cashSales);

        if (document.getElementById('txtTransfHoy'))
            document.getElementById('txtTransfHoy').innerText = fmtMoneda(data.transferSales);

        if (document.getElementById('txtCobrosLibretaHoy'))
            document.getElementById('txtCobrosLibretaHoy').innerText = fmtMoneda(data.creditPaymentsToday || data.cobrosLibretaHoy || 0);

        if (document.getElementById('cardLibreta'))
            document.getElementById('cardLibreta').innerText = fmtMoneda(data.tCredit || data.totalPendingCredit || 0);

        if (document.getElementById('cardBalanceReal'))
            document.getElementById('cardBalanceReal').innerText = fmtMoneda(data.realBalance);

    } catch (err) {
        console.error("Error al cargar KPIs de Hoy:", err);
    }
}

// ==========================================
// 3. CONSULTA POR FECHAS LIBRES / PRESETS
// ==========================================
function aplicarPresetFecha(preset) {
    const hoy = new Date();
    let desde, hasta;

    if (preset === 'ESTE_MES') {
        desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    } else if (preset === 'MES_PASADO') {
        desde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
        hasta = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
    } else if (preset === '3_MESES') {
        desde = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1);
        hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    }

    if (desde && hasta) {
        document.getElementById('fechaDesde').value = formatDateLocal(desde);
        document.getElementById('fechaHasta').value = formatDateLocal(hasta);
        consultarPorFechas();
    }
}

async function consultarPorFechas() {
    const desdeVal = document.getElementById('fechaDesde').value;
    const hastaVal = document.getElementById('fechaHasta').value;

    if (!desdeVal || !hastaVal) {
        return Swal.fire('Atención', 'Por favor selecciona ambas fechas (Desde y Hasta)', 'warning');
    }

    if (desdeVal > hastaVal) {
        return Swal.fire('Error', 'La fecha "Desde" no puede ser mayor que "Hasta"', 'error');
    }

    try {
        // Enviar parámetros limpios de fecha local (YYYY-MM-DD)
        const params = new URLSearchParams({
            startDate: desdeVal,
            endDate: hastaVal,
            from: desdeVal,
            to: hastaVal
        });

        const response = await apiFetch(`/sales/report/box?${params.toString()}`);
        if (!response || !response.ok) throw new Error("Error al consultar reporte por fecha");

        const data = await response.json();

        // Renderizar los datos en pantalla
        if (document.getElementById('txtRecaudacionMes'))
            document.getElementById('txtRecaudacionMes').innerText = fmtMoneda(data.totalSales || data.monthSales);

        if (document.getElementById('txtGananciaMes'))
            document.getElementById('txtGananciaMes').innerText = fmtMoneda(data.totalProfit || data.monthProfit);

        if (document.getElementById('txtReposicionMes'))
            document.getElementById('txtReposicionMes').innerText = fmtMoneda(data.replacementCost || data.monthReplacementCost);

        if (document.getElementById('txtVentasCountMes'))
            document.getElementById('txtVentasCountMes').innerText = data.totalOperations || data.monthOperations || 0;

        // Formatear mensaje visual de rango activo
        const f1 = desdeVal.split('-').reverse().join('/');
        const f2 = hastaVal.split('-').reverse().join('/');
        const lblRango = document.getElementById('lblRangoActivo');
        if (lblRango) lblRango.innerText = `Rango activo: ${f1} al ${f2}`;

    } catch (err) {
        console.error("Error al obtener datos por fecha:", err);
        Swal.fire('Error', 'No se pudieron recuperar los datos para el rango seleccionado', 'error');
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

// Exposición global
window.aplicarPresetFecha = aplicarPresetFecha;
window.consultarPorFechas = consultarPorFechas;