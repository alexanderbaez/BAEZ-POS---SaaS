/**
 * BAEZ POS - DASHBOARD DE GESTIÓN SAAS MULTI-TENANT
 * Control Estricto de Cajas, Auditoría de Turnos y Medios de Pago
 */

// Caché en memoria para evitar peticiones redundantes al cambiar de turno
let cacheSesionesHoy = [];

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Nombre de usuario y Fecha actual
    setElementText('userNameLabel', (localStorage.getItem('baezpos_user_name') || 'USUARIO').toUpperCase());

    const elFecha = document.getElementById('fechaActual');
    if (elFecha) {
        const hoy = new Date();
        elFecha.innerText = hoy.toLocaleDateString('es-AR', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    // 2. Carga inicial del rango "Este Mes" (Métricas históricas)
    aplicarPresetFecha('ESTE_MES');

    // 3. Ejecución concurrente de cargas independientes
    await Promise.allSettled([
        cargarDatosDashboardHoy(),
        cargarAlertasStock(),
        cargarDatosGrafico()
    ]);
});

// ==========================================
// UTILIDADES DE FORMATO Y AUXILIARES
// ==========================================
function parseNumber(val) {
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
}

function setElementText(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
}

function fmtMoneda(val) {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2
    }).format(parseNumber(val));
}

function fmtStock(cant, producto = {}) {
    const stockVal = parseNumber(cant);
    const esFraccionado = Boolean(
        producto.isFractional ||
        producto.unitOfMeasure === 'KG' ||
        producto.unitOfMeasure === 'GRAM' ||
        producto.unitType === 'KG'
    );

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
// 1. CARGA DE KPIS DEL DÍA / AUDITORÍA DE TURNOS
// ==========================================
async function cargarDatosDashboardHoy() {
    try {
        const response = await apiFetch('/sales/report/box?period=today');
        if (!response || !response.ok) return;

        const data = await response.json();

        // ----------------------------------------------------
        // CAPA 2: CANALES DE RECAUDACIÓN DEL DÍA (CONSOLIDADO)
        // ----------------------------------------------------
        const totalSalesToday       = parseNumber(data.totalSalesToday);
        const transferSalesToday    = parseNumber(data.transferSalesToday);
        const transferExpensesToday = parseNumber(data.transferExpensesToday);
        const creditSalesToday      = parseNumber(data.creditSalesToday);
        const totalPendingCredit    = parseNumber(data.totalPendingCredit);

        setElementText('txtRecaudacion', fmtMoneda(totalSalesToday));
        setElementText('txtTransfHoy', fmtMoneda(transferSalesToday));
        setElementText('txtFiadoHoy', fmtMoneda(creditSalesToday));
        setElementText('cardLibreta', fmtMoneda(totalPendingCredit));

        const lblDetalleTransf = document.getElementById('lblDetalleTransf');
        if (lblDetalleTransf) {
            lblDetalleTransf.innerHTML = transferExpensesToday > 0
                ? `<span class="badge bg-danger-subtle text-danger border border-danger-subtle" style="font-size: 0.72rem;">-${fmtMoneda(transferExpensesToday)} gastos digital</span>`
                : '';
        }

        // ----------------------------------------------------
        // CAPA 1: AUDITORÍA DE CAJAS / TURNOS MULTI-USUARIO
        // ----------------------------------------------------
        cacheSesionesHoy = Array.isArray(data.todaySessions) ? data.todaySessions : [];
        poblarSelectorTurnos(cacheSesionesHoy);

        if (cacheSesionesHoy.length > 0) {
            // Prioridad: Seleccionar la caja abierta activa o la última registrada
            const cajaActiva = cacheSesionesHoy.find(s => s.status === 'OPEN') || cacheSesionesHoy[0];

            const select = document.getElementById('selectTurnoActivo');
            if (select) select.value = cajaActiva.id;

            renderizarMetricasCaja(cajaActiva);
        } else {
            // CORREGIDO: Mapeo exacto con los nombres de BoxReportDTO
            renderizarMetricasCaja({
                initialAmount: data.activeInitialAmount,
                totalCashSales: data.activeCashSales,
                totalCustomerPayments: data.activeCustomerPayments,
                totalExpenses: data.activeExpenses
            });
        }

    } catch (err) {
        console.error("Error al cargar KPIs de Hoy:", err);
    }
}

/**
 * Llena el elemento <select> de auditoría con todas las cajas iniciadas en la jornada.
 */
function poblarSelectorTurnos(sesiones) {
    const select = document.getElementById('selectTurnoActivo');
    if (!select) return;

    if (!sesiones || sesiones.length === 0) {
        select.innerHTML = `<option value="">Sin cajas registradas hoy</option>`;
        return;
    }

    let optionsHtml = '';
    sesiones.forEach((s) => {
        const horaApertura = s.openedAt
            ? new Date(s.openedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
            : '--:--';

        const estado = s.status === 'OPEN' ? '🟢 ABIERTA' : '🔴 CERRADA';
        const usuario = s.userName || 'Usuario Desconocido';
        const numCaja = s.sessionNumber || s.id; // Uso del número correlativo de sesión

        optionsHtml += `<option value="${s.id}">Caja #${numCaja} (${horaApertura} hs) - ${estado} [${usuario}]</option>`;
    });

    select.innerHTML = optionsHtml;
}

/**
 * Llena el elemento <select> de auditoría con todas las cajas iniciadas el día de hoy.
 */
function poblarSelectorTurnos(sesiones) {
    const select = document.getElementById('selectTurnoActivo');
    if (!select) return;

    if (!sesiones || sesiones.length === 0) {
        select.innerHTML = `<option value="">Sin cajas abiertas hoy</option>`;
        return;
    }

    let optionsHtml = '';
    sesiones.forEach((s) => {
        const horaApertura = new Date(s.openedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        const estado = s.status === 'OPEN' ? '🟢 ABIERTA' : '🔴 CERRADA';
        const usuario = s.userName || 'Usuario Desconocido';

        optionsHtml += `<option value="${s.id}">Caja #${s.id} (${horaApertura} hs) - ${estado} [${usuario}]</option>`;
    });

    select.innerHTML = optionsHtml;
}

/**
 * Evento desencadenado al cambiar el selector <select id="selectTurnoActivo">.
 */
function filtrarTurnoSeleccionado(sessionId) {
    if (!sessionId) return;

    const caja = cacheSesionesHoy.find(item => item.id == sessionId);
    if (caja) {
        renderizarMetricasCaja(caja);
    }
}

/**
 * Calcula y renderiza el balance físico y desglose de una caja específica.
 */
function renderizarMetricasCaja(caja) {
    const initialAmount         = parseNumber(caja.initialAmount);
    const cashSalesToday        = parseNumber(caja.totalCashSales);
    const customerPaymentsToday = parseNumber(caja.totalCustomerPayments);
    const cashExpensesToday     = parseNumber(caja.totalExpenses);

    // Ecuación de Arqueo Físico de Cajón
    const realBalance = initialAmount + cashSalesToday + customerPaymentsToday - cashExpensesToday;

    // Componentes del desglose
    setElementText('txtEfectivoHoy', fmtMoneda(cashSalesToday));

    const lblDetalleEfectivo = document.getElementById('lblDetalleEfectivo');
    if (lblDetalleEfectivo) {
        lblDetalleEfectivo.innerHTML = cashExpensesToday > 0
            ? `<span class="badge bg-danger-subtle text-danger border border-danger-subtle" style="font-size: 0.72rem;">-${fmtMoneda(cashExpensesToday)} gastos caja</span>`
            : `<span class="fw-bold text-danger fs-5">${fmtMoneda(0)}</span>`;
    }

    const elCobrosLibreta = document.getElementById('txtCobrosLibretaHoy');
    if (elCobrosLibreta) {
        elCobrosLibreta.innerText = fmtMoneda(customerPaymentsToday);
        elCobrosLibreta.className = customerPaymentsToday > 0 ? "fw-bold text-success fs-5 mt-1" : "fw-bold text-dark fs-5 mt-1";
    }

    // Hero Card: Dinero Físico en Cajón
    const cardBalanceReal = document.getElementById('cardBalanceReal');
    const containerCardBalance = document.getElementById('containerCardBalance');
    const titleBalanceReal = document.getElementById('titleBalanceReal');
    const iconBoxBalance = document.getElementById('iconBoxBalance');

    if (cardBalanceReal) {
        cardBalanceReal.innerText = fmtMoneda(realBalance);

        if (realBalance < 0) {
            cardBalanceReal.className = "fw-bold mb-0 text-danger mt-1 fs-3 fs-md-2";
            if (containerCardBalance) containerCardBalance.className = "dashboard-card p-3 p-md-4 border-start border-4 border-danger bg-white h-100 d-flex flex-column justify-content-between";
            if (titleBalanceReal) titleBalanceReal.className = "kpi-title text-danger";
            if (iconBoxBalance) iconBoxBalance.className = "icon-box-soft bg-danger text-white rounded-circle p-3 flex-shrink-0";
        } else {
            cardBalanceReal.className = "fw-bold mb-0 text-dark mt-1 fs-3 fs-md-2";
            if (containerCardBalance) containerCardBalance.className = "dashboard-card p-3 p-md-4 border-start border-4 border-primary bg-white h-100 d-flex flex-column justify-content-between";
            if (titleBalanceReal) titleBalanceReal.className = "kpi-title text-primary";
            if (iconBoxBalance) iconBoxBalance.className = "icon-box-soft bg-primary text-white rounded-circle p-3 flex-shrink-0";
        }
    }

    // Pie Explicativo Dinámico
    const lblDetalleBalance = document.getElementById('lblDetalleBalance');
    if (lblDetalleBalance) {
        let desgloseHtml = `(Fondo: ${fmtMoneda(initialAmount)}`;
        if (customerPaymentsToday > 0) {
            desgloseHtml += ` + <span class="fw-semibold text-success">${fmtMoneda(customerPaymentsToday)} cobros</span>`;
        }
        if (cashExpensesToday > 0) {
            desgloseHtml += ` <span class="badge bg-danger-subtle text-danger border border-danger-subtle ms-1">-${fmtMoneda(cashExpensesToday)} gastos caja</span>`;
        }
        desgloseHtml += `)`;
        lblDetalleBalance.innerHTML = desgloseHtml;
    }
}

// ==========================================
// 2. CONSULTA POR FECHAS Y PRESETS (CAPA 3)
// ==========================================
function aplicarPresetFecha(preset) {
    const hoy = new Date();
    let desde, hasta;

    switch (preset) {
        case 'ESTE_MES':
            desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
            hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
            break;
        case 'MES_PASADO':
            desde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
            hasta = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
            break;
        case '3_MESES':
            desde = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1);
            hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
            break;
        case 'ESTE_ANO':
            desde = new Date(hoy.getFullYear(), 0, 1);
            hasta = hoy;
            break;
        case 'ANO_PASADO':
            desde = new Date(hoy.getFullYear() - 1, 0, 1);
            hasta = new Date(hoy.getFullYear() - 1, 11, 31);
            break;
    }

    if (desde && hasta) {
        const inputDesde = document.getElementById('fechaDesde');
        const inputHasta = document.getElementById('fechaHasta');
        if (inputDesde) inputDesde.value = formatDateLocal(desde);
        if (inputHasta) inputHasta.value = formatDateLocal(hasta);
        consultarPorFechas();
    }
}

async function consultarPorFechas() {
    const elDesde = document.getElementById('fechaDesde');
    const elHasta = document.getElementById('fechaHasta');

    if (!elDesde || !elHasta) return;

    const desdeVal = elDesde.value;
    const hastaVal = elHasta.value;

    if (!desdeVal || !hastaVal) {
        return Swal.fire('Atención', 'Por favor selecciona ambas fechas (Desde y Hasta)', 'warning');
    }

    if (desdeVal > hastaVal) {
        return Swal.fire('Error', 'La fecha "Desde" no puede ser mayor que "Hasta"', 'error');
    }

    try {
        const params = new URLSearchParams({ from: desdeVal, to: hastaVal });
        const response = await apiFetch(`/sales/report/box?${params.toString()}`);

        if (!response || !response.ok) throw new Error("Error en la respuesta del servidor");

        const data = await response.json();

        const periodSales           = parseNumber(data.periodSales);
        const periodProfit          = parseNumber(data.periodProfit);
        const periodReplacementCost = parseNumber(data.periodReplacementCost);
        const periodOperations      = parseInt(data.periodOperations || 0, 10);
        const ticketPromedio        = periodOperations > 0 ? (periodSales / periodOperations) : 0;

        setElementText('txtRecaudacionMes', fmtMoneda(periodSales));
        setElementText('txtGananciaMes', fmtMoneda(periodProfit));
        setElementText('txtReposicionMes', fmtMoneda(periodReplacementCost));
        setElementText('txtVentasCountMes', periodOperations);
        setElementText('txtTicketPromedio', fmtMoneda(ticketPromedio));

        const f1 = desdeVal.split('-').reverse().join('/');
        const f2 = hastaVal.split('-').reverse().join('/');
        setElementText('lblRangoActivo', `Mostrando datos del ${f1} al ${f2}`);

    } catch (err) {
        console.error("Error al obtener datos por fecha:", err);
        Swal.fire('Error', 'No se pudieron recuperar los datos para el rango seleccionado', 'error');
    }
}

// ==========================================
// 3. GRÁFICO DE EVOLUCIÓN DE VENTAS
// ==========================================
async function cargarDatosGrafico() {
    try {
        const response = await apiFetch('/sales/report/chart');
        if (!response || !response.ok) return;

        const data = await response.json();

        if (!Array.isArray(data) || data.length === 0) {
            renderizarGraficoSemanal([], []);
            return;
        }

        const etiquetas = data.map(item => {
            if (!item.label) return '';
            const partes = item.label.split('-');
            return partes.length === 3 ? `${partes[2]}/${partes[1]}` : item.label;
        });

        const valores = data.map(item => parseNumber(item.total));
        renderizarGraficoSemanal(etiquetas, valores);

    } catch (err) {
        console.error("Error cargando el gráfico:", err);
    }
}

function renderizarGraficoSemanal(etiquetas, valores) {
    const canvas = document.getElementById('chartSemanal');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (window.myChart && typeof window.myChart.destroy === 'function') {
        window.myChart.destroy();
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, 280);
    gradient.addColorStop(0, 'rgba(37, 99, 235, 0.18)');
    gradient.addColorStop(1, 'rgba(37, 99, 235, 0.0)');

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
                        callback: (value) => '$' + parseNumber(value).toLocaleString('es-AR')
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
// 4. INVENTARIO CRÍTICO DE STOCK
// ==========================================
async function cargarAlertasStock() {
    try {
        const res = await apiFetch('/products');
        if (!res || !res.ok) return;

        const productos = await res.json();
        if (!Array.isArray(productos)) return;

        const criticos = productos.filter(p => parseNumber(p.stock) <= 10);

        setElementText('badgeStockCount', criticos.length);

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
            const stockNum = parseNumber(p.stock);
            const textoStock = fmtStock(stockNum, p);
            const esMuyCritico = stockNum <= 3;

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
            </div>`;
        }).join('');

    } catch (err) {
        console.error("Error al cargar alertas de stock:", err);
    }
}

// Exposición al scope global para bindings en HTML (onchange / onclick)
window.aplicarPresetFecha = aplicarPresetFecha;
window.consultarPorFechas = consultarPorFechas;
window.filtrarTurnoSeleccionado = filtrarTurnoSeleccionado;