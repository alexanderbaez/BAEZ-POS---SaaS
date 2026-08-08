/**
 * BÁEZ POS - DASHBOARD DE GESTIÓN SAAS MULTI-TENANT
 * Alexander Baez - 2026
 */

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

function fmtStock(cant, producto = {}) {
    const stockVal = parseFloat(cant) || 0;
    const esFraccionado = producto.isFractional ||
                         producto.unitOfMeasure === 'KG' ||
                         producto.unitOfMeasure === 'GRAM' ||
                         producto.unitType === 'KG';

    if (esFraccionado) {
        if (stockVal < 1 && stockVal > 0) {
            const gramos = Math.round(stockVal * 1000);
            return `${gramos} gr`;
        }
        return `${stockVal.toLocaleString('es-AR', { maximumFractionDigits: 3 })} Kg`;
    }

    return `${stockVal.toLocaleString('es-AR', { maximumFractionDigits: 2 })} u.`;
}

function formatDateLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ==========================================
// 1. CARGA DE KPIS DEL DÍA (HOY)
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
// 2. CONSULTA POR FECHAS LIBRES / PRESETS
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
    } else if (preset === 'ESTE_ANO') {
        desde = new Date(hoy.getFullYear(), 0, 1);
        hasta = hoy;
    } else if (preset === 'ANO_PASADO') {
        desde = new Date(hoy.getFullYear() - 1, 0, 1);
        hasta = new Date(hoy.getFullYear() - 1, 11, 31);
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
        const params = new URLSearchParams({
            startDate: desdeVal,
            endDate: hastaVal,
            from: desdeVal,
            to: hastaVal
        });

        const response = await apiFetch(`/sales/report/box?${params.toString()}`);
        if (!response || !response.ok) throw new Error("Error al consultar reporte por fecha");

        const data = await response.json();

        const totalVentasRango = data.monthSales ?? data.totalSales ?? 0;
        const totalGananciaRango = data.monthProfit ?? data.totalProfit ?? 0;
        const costoReposicionRango = data.monthReplacementCost ?? data.replacementCost ?? 0;
        const operacionesRango = data.monthOperations ?? data.totalOperations ?? 0;

        // Cálculo de KPI Derivado: Ticket Medio
        const ticketMedio = operacionesRango > 0 ? (totalVentasRango / operacionesRango) : 0;

        if (document.getElementById('txtRecaudacionMes'))
            document.getElementById('txtRecaudacionMes').innerText = fmtMoneda(totalVentasRango);

        if (document.getElementById('txtGananciaMes'))
            document.getElementById('txtGananciaMes').innerText = fmtMoneda(totalGananciaRango);

        if (document.getElementById('txtReposicionMes'))
            document.getElementById('txtReposicionMes').innerText = fmtMoneda(costoReposicionRango);

        if (document.getElementById('txtVentasCountMes'))
            document.getElementById('txtVentasCountMes').innerText = operacionesRango;

        if (document.getElementById('txtTicketPromedio'))
            document.getElementById('txtTicketPromedio').innerText = fmtMoneda(ticketMedio);

        const f1 = desdeVal.split('-').reverse().join('/');
        const f2 = hastaVal.split('-').reverse().join('/');
        const lblRango = document.getElementById('lblRangoActivo');
        if (lblRango) lblRango.innerText = `Mostrando datos del ${f1} al ${f2}`;

    } catch (err) {
        console.error("Error al obtener datos por fecha:", err);
        Swal.fire('Error', 'No se pudieron recuperar los datos para el rango seleccionado', 'error');
    }
}

// ==========================================
// 3. GRÁFICO DE EVOLUCIÓN
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
    const gradient = ctx.createLinearGradient(0, 0, 0, 280);
    gradient.addColorStop(0, 'rgba(37, 99, 235, 0.18)');
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
                borderWidth: 2.5,
                backgroundColor: gradient,
                fill: true,
                tension: 0.3,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#2563eb',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0f172a',
                    titleFont: { size: 13, weight: 'bold' },
                    bodyFont: { size: 12 },
                    padding: 10,
                    cornerRadius: 8,
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
                        color: '#64748b',
                        callback: (value) => '$' + value.toLocaleString('es-AR')
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#64748b' }
                }
            }
        }
    });
}

// ==========================================
// 4. INVENTARIO CRÍTICO
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
                <div class="text-center py-4">
                    <i class="bi bi-check-circle-fill fs-2 text-success opacity-75"></i>
                    <p class="mt-2 mb-0 small text-muted">Stock en niveles óptimos.</p>
                </div>`;
            return;
        }

        container.innerHTML = criticos.map(p => {
            const textoStock = fmtStock(p.stock, p);
            const esMuyCritico = p.stock <= 3;
            return `
            <div class="stock-item d-flex align-items-center justify-content-between">
                <div class="pe-2">
                    <span class="d-block fw-semibold text-dark small text-truncate" style="max-width: 180px;">
                        ${(p.name || '').toUpperCase()}
                    </span>
                    <small class="text-muted" style="font-size: 0.75rem;">Mínimo recomendado: 10 u.</small>
                </div>
                <span class="badge ${esMuyCritico ? 'bg-danger-subtle text-danger border border-danger-subtle' : 'bg-warning-subtle text-warning-emphasis border border-warning-subtle'} rounded-pill">
                    ${textoStock}
                </span>
            </div>
        `}).join('');

    } catch (err) {
        console.error("Error al cargar alertas de stock:", err);
    }
}

window.aplicarPresetFecha = aplicarPresetFecha;
window.consultarPorFechas = consultarPorFechas;