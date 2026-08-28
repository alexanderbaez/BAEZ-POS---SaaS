/**
 * BÁEZ POS - SAAS DASHBOARD (Vista Gerencial & Análisis Detallado)
 * Alexander Baez - 2026
 */

let chartSemanalInstance = null;

const fmtARS = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2
});

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Nombre de usuario y Fecha actual
    const userName = (localStorage.getItem('baezpos_user_name') || 'Usuario').toUpperCase();
    const userEl = document.getElementById('userNameLabel');
    if (userEl) userEl.innerText = userName;

    const fechaEl = document.getElementById('fechaActual');
    if (fechaEl) {
        const hoy = new Date();
        fechaEl.innerText = hoy.toLocaleDateString('es-AR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    // 2. Configurar listener para resize de Chart.js al cambiar de pestañas
    const tabGerencialBtn = document.getElementById('tab-gerencial-btn');
    if (tabGerencialBtn) {
        tabGerencialBtn.addEventListener('shown.bs.tab', () => {
            if (chartSemanalInstance) {
                chartSemanalInstance.resize();
            }
        });
    }

    // 3. Inicializar preset por defecto en Análisis Detallado (Por defecto: Hoy)
    aplicarPresetFecha('HOY');

    // 4. Carga concurrente inicial
    await Promise.allSettled([
        cargarKpisYTablas(),
        cargarGraficoSemanal(),
        cargarAlertasStock()
    ]);
});

// ===================================================================
// TAB 1: VISTA GERENCIAL (RESUMEN MENSUAL Y ACTIVIDAD RECIENTE)
// ===================================================================
async function cargarKpisYTablas() {
    const ahora = new Date();
    const primerDiaMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const ultimoDiaMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0);

    const desdeStr = formatInputDate(primerDiaMes);
    const hastaStr = formatInputDate(ultimoDiaMes);

    try {
        const [resBoxMes, resVentas, resGastos, resProveedores] = await Promise.allSettled([
            apiFetch(`/sales/report/box?from=${desdeStr}&to=${hastaStr}`),
            apiFetch(`/sales?desde=${desdeStr}&hasta=${hastaStr}`),
            apiFetch('/expenses'),
            apiFetch('/providers')
        ]);

        let listaVentas = [];
        if (resVentas.status === 'fulfilled' && resVentas.value && resVentas.value.ok) {
            listaVentas = await resVentas.value.json();
            if (!Array.isArray(listaVentas)) listaVentas = [];
        }

        let listaGastos = [];
        if (resGastos.status === 'fulfilled' && resGastos.value && resGastos.value.ok) {
            listaGastos = await resGastos.value.json();
            if (!Array.isArray(listaGastos)) listaGastos = [];
        }

        let listaProveedores = [];
        if (resProveedores.status === 'fulfilled' && resProveedores.value && resProveedores.value.ok) {
            listaProveedores = await resProveedores.value.json();
            if (!Array.isArray(listaProveedores)) listaProveedores = [];
        }

        // --- FILTRAR VENTAS ACTIVAS DEL MES ---
        const ventasActivasMes = listaVentas.filter(v => !v.canceled && v.status !== 'ANULADA');
        let totalVentasMes = 0;
        ventasActivasMes.forEach(v => {
            const m = (v.paymentMethod || 'EFECTIVO').toUpperCase();
            if (m !== 'CUENTA_CORRIENTE') {
                totalVentasMes += parseFloat(v.total) || 0;
            }
        });

        // --- FILTRAR GASTOS DEL MES ---
        const mesActual = ahora.getMonth();
        const anioActual = ahora.getFullYear();
        const gastosMes = listaGastos.filter(g => {
            if (!g.date) return false;
            const fechaG = new Date(g.date);
            return fechaG.getMonth() === mesActual && fechaG.getFullYear() === anioActual;
        });

        let totalGastosMes = 0;
        gastosMes.forEach(g => {
            totalGastosMes += parseFloat(g.amount) || 0;
        });

        let gananciaNeta = totalVentasMes - totalGastosMes;

        if (resBoxMes.status === 'fulfilled' && resBoxMes.value && resBoxMes.value.ok) {
            const dataBoxMes = await resBoxMes.value.json();
            if (dataBoxMes.periodSales !== undefined) {
                totalVentasMes = parseFloat(dataBoxMes.periodSales) || 0;
            }
            if (dataBoxMes.periodProfit !== undefined) {
                gananciaNeta = parseFloat(dataBoxMes.periodProfit) || 0;
            }
        }

        // --- DEUDA PROVEEDORES ---
        let totalDeudaProveedores = 0;
        let proveedoresConDeuda = 0;
        listaProveedores.forEach(p => {
            const saldo = parseFloat(p.currentBalance) || 0;
            if (saldo > 0) {
                totalDeudaProveedores += saldo;
                proveedoresConDeuda++;
            }
        });

        // --- ACTUALIZAR DOM KPIS GERENCIAL ---
        setElementText('kpiVentasMes', fmtARS.format(totalVentasMes));
        setElementText('kpiVentasCount', `${ventasActivasMes.length} operaciones este mes`);

        setElementText('kpiGastosMes', fmtARS.format(totalGastosMes));
        setElementText('kpiGastosCount', `${gastosMes.length} egresos este mes`);

        const gananciaEl = document.getElementById('kpiGananciaNeta');
        if (gananciaEl) {
            gananciaEl.innerText = fmtARS.format(gananciaNeta);
            if (gananciaNeta < 0) {
                gananciaEl.classList.remove('text-success');
                gananciaEl.classList.add('text-danger');
            } else {
                gananciaEl.classList.remove('text-danger');
                gananciaEl.classList.add('text-success');
            }
        }

        setElementText('kpiDeudaProveedores', fmtARS.format(totalDeudaProveedores));
        setElementText('kpiProveedoresCount', `${proveedoresConDeuda} con saldo pendiente`);

        // --- RENDERIZAR TABLAS GERENCIALES ---
        renderizarTopProductos(ventasActivasMes);
        renderizarUltimosMovimientos(listaVentas, listaGastos);

    } catch (err) {
        console.error("Error cargando KPIs gerenciales:", err);
    }
}

function renderizarTopProductos(ventas) {
    const tbody = document.getElementById('tablaTopProductos');
    if (!tbody) return;

    const mapaProductos = new Map();

    ventas.forEach(v => {
        const items = Array.isArray(v.items) ? v.items : [];
        items.forEach(item => {
            const nombre = item.productName || item.nombre || item.title || 'Producto';
            const cantidad = parseFloat(item.quantity) || 0;
            const subtotal = parseFloat(item.subtotal) || (cantidad * (parseFloat(item.price) || 0));

            if (!mapaProductos.has(nombre)) {
                mapaProductos.set(nombre, { nombre, cantidad: 0, total: 0 });
            }
            const prod = mapaProductos.get(nombre);
            prod.cantidad += cantidad;
            prod.total += subtotal;
        });
    });

    const listaOrdenada = Array.from(mapaProductos.values())
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 5);

    if (listaOrdenada.length === 0) {
        if (typeof renderEmptyState === 'function') {
            renderEmptyState('tablaTopProductos', 'bi-trophy', 'Sin ventas este mes', 'Los productos más vendidos aparecerán aquí automáticamente.', '', 3);
        } else {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center p-4 text-muted">Sin registros de ventas en este período.</td></tr>';
        }
        return;
    }

    tbody.innerHTML = '';
    const fragment = document.createDocumentFragment();

    listaOrdenada.forEach((p, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="ps-3">
                <div class="d-flex align-items-center">
                    <span class="badge bg-light text-dark border me-2" style="width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem;">
                        #${idx + 1}
                    </span>
                    <strong class="text-dark text-truncate" style="max-width: 220px;">${escapeHTML(p.nombre)}</strong>
                </div>
            </td>
            <td class="text-center">
                <span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2.5 py-1 fw-bold">
                    ${p.cantidad.toLocaleString('es-AR')} u.
                </span>
            </td>
            <td class="text-end pe-3 fw-bold text-dark amount-num">
                ${fmtARS.format(p.total)}
            </td>
        `;
        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
}

function renderizarUltimosMovimientos(ventas, gastos) {
    const tbody = document.getElementById('tablaUltimosMovimientos');
    if (!tbody) return;

    const movimientos = [];

    // Normalizar ventas
    (ventas || []).forEach(v => {
        const fechaRaw = v.saleDate || v.created_at || v.createdAt || new Date();
        const fechaObj = new Date(fechaRaw);
        movimientos.push({
            tipo: 'VENTA',
            id: v.id,
            concepto: v.nroComprobante || (v.numeroTicket ? `Ticket #${v.numeroTicket}` : `Venta #${v.id}`),
            fecha: isNaN(fechaObj.getTime()) ? new Date() : fechaObj,
            metodo: (v.paymentMethod || 'EFECTIVO').replace(/_/g, ' '),
            monto: parseFloat(v.total) || 0
        });
    });

    // Normalizar gastos
    (gastos || []).forEach(g => {
        const fechaRaw = g.date || new Date();
        const fechaObj = new Date(fechaRaw);
        movimientos.push({
            tipo: 'GASTO',
            id: g.id,
            concepto: g.description || 'Egreso operativo',
            fecha: isNaN(fechaObj.getTime()) ? new Date() : fechaObj,
            metodo: (g.paymentMethod || 'EFECTIVO_CAJA').replace(/_/g, ' '),
            monto: parseFloat(g.amount) || 0
        });
    });

    const ultimos5 = movimientos
        .sort((a, b) => b.fecha - a.fecha)
        .slice(0, 5);

    if (ultimos5.length === 0) {
        if (typeof renderEmptyState === 'function') {
            renderEmptyState('tablaUltimosMovimientos', 'bi-arrow-left-right', 'Sin movimientos registrados', 'Las transacciones recientes se reflejarán aquí.', '', 3);
        } else {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center p-4 text-muted">No hay movimientos recientes.</td></tr>';
        }
        return;
    }

    tbody.innerHTML = '';
    const fragment = document.createDocumentFragment();

    ultimos5.forEach(m => {
        const esVenta = m.tipo === 'VENTA';
        const icono = esVenta ? 'bi-cart-check-fill text-success' : 'bi-wallet2 text-danger';
        const badgeBg = esVenta ? 'bg-success bg-opacity-10' : 'bg-danger bg-opacity-10';
        const montoTexto = esVenta ? `+${fmtARS.format(m.monto)}` : `-${fmtARS.format(m.monto)}`;
        const montoClase = esVenta ? 'text-success' : 'text-danger';

        const horaFormateada = m.fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        const diaFormateado = m.fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="ps-3">
                <div class="d-flex align-items-center">
                    <div class="p-2 ${badgeBg} rounded-circle me-2 d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;">
                        <i class="bi ${icono} fs-6"></i>
                    </div>
                    <div>
                        <strong class="text-dark d-block text-truncate" style="max-width: 200px;">${escapeHTML(m.concepto)}</strong>
                        <small class="text-muted">${diaFormateado} - ${horaFormateada} hs</small>
                    </div>
                </div>
            </td>
            <td class="d-none d-sm-table-cell">
                <span class="badge bg-light text-dark border px-2 py-1" style="font-size: 0.75rem;">
                    ${escapeHTML(m.metodo)}
                </span>
            </td>
            <td class="text-end pe-3 fw-bold ${montoClase} amount-num">
                ${montoTexto}
            </td>
        `;
        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
}

// ===================================================================
// GRÁFICO CENTRAL DE EVOLUCIÓN (CHART.JS)
// ===================================================================
async function cargarGraficoSemanal() {
    const canvas = document.getElementById('chartSemanal');
    if (!canvas) return;

    try {
        const response = await apiFetch('/sales/report/chart');
        let data = [];

        if (response && response.ok) {
            data = await response.json();
            if (!Array.isArray(data)) data = [];
        }

        let labels = [];
        let valores = [];

        if (data.length > 0) {
            labels = data.map(d => {
                const dateObj = new Date(d.date + 'T00:00:00');
                return dateObj.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
            });
            valores = data.map(d => parseFloat(d.total) || 0);
        } else {
            const hoy = new Date();
            for (let i = 6; i >= 0; i--) {
                const d = new Date(hoy);
                d.setDate(hoy.getDate() - i);
                labels.push(d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }));
                valores.push(0);
            }
        }

        // Destruir instancia previa para evitar glitches
        if (chartSemanalInstance) {
            chartSemanalInstance.destroy();
            chartSemanalInstance = null;
        }

        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(37, 99, 235, 0.28)');
        gradient.addColorStop(1, 'rgba(37, 99, 235, 0.01)');

        chartSemanalInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Ventas ($ ARS)',
                    data: valores,
                    borderColor: '#2563eb',
                    backgroundColor: gradient,
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.35,
                    pointBackgroundColor: '#2563eb',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4.5,
                    pointHoverRadius: 6.5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#0f172a',
                        titleFont: { family: 'Inter', size: 12, weight: 'bold' },
                        bodyFont: { family: 'Inter', size: 12 },
                        padding: 10,
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                return ` Ventas: ${fmtARS.format(context.parsed.y)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            font: { family: 'Inter', size: 11, weight: '500' },
                            color: '#64748b'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: '#f1f5f9', borderDash: [4, 4] },
                        ticks: {
                            font: { family: 'Inter', size: 11 },
                            color: '#64748b',
                            callback: function(value) {
                                if (value >= 1000000) return '$' + (value / 1000000).toFixed(1) + 'M';
                                if (value >= 1000) return '$' + (value / 1000).toFixed(0) + 'k';
                                return '$' + value;
                            }
                        }
                    }
                }
            }
        });

    } catch (err) {
        console.error("Error al renderizar gráfico semanal:", err);
    }
}

// ===================================================================
// TAB 2: ANÁLISIS DETALLADO (PRESETS & CONSULTA DE RANGO HISTÓRICO)
// ===================================================================
function aplicarPresetFecha(preset) {
    const hoy = new Date();
    let desde, hasta;

    switch (preset) {
        case 'HOY':
            desde = hoy;
            hasta = hoy;
            break;
        case 'AYER':
            desde = new Date(hoy);
            desde.setDate(hoy.getDate() - 1);
            hasta = desde;
            break;
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

    const selectEl = document.getElementById('selectPresetFechas');
    if (selectEl && selectEl.value !== preset) {
        selectEl.value = preset;
    }

    if (desde && hasta) {
        const inputDesde = document.getElementById('fechaDesde');
        const inputHasta = document.getElementById('fechaHasta');
        if (inputDesde) inputDesde.value = formatInputDate(desde);
        if (inputHasta) inputHasta.value = formatInputDate(hasta);
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
        return Swal.fire('Error', 'La fecha "Desde" no puede ser posterior a "Hasta"', 'error');
    }

    try {
        // Consultas paralelas para el análisis detallado
        const [resBox, resVentasRango, resGastos] = await Promise.allSettled([
            apiFetch(`/sales/report/box?from=${desdeVal}&to=${hastaVal}`),
            apiFetch(`/sales?desde=${desdeVal}&hasta=${hastaVal}`),
            apiFetch('/expenses')
        ]);

        // 1. Métricas de Reporte / Box (Fuente de Verdad Financiera - Flujo de Caja Puro)
        if (resBox.status === 'fulfilled' && resBox.value && resBox.value.ok) {
            const dataBox = await resBox.value.json();

            const periodSales = parseFloat(dataBox.periodSales) || 0;
            const periodProfit = parseFloat(dataBox.periodProfit) || 0;
            const periodReplacementCost = parseFloat(dataBox.periodReplacementCost) || 0;
            const periodOperations = parseInt(dataBox.periodOperations || 0, 10);
            const ticketPromedio = periodOperations > 0 ? (periodSales / periodOperations) : 0;

            setElementText('txtRecaudacionMes', fmtARS.format(periodSales));
            setElementText('txtGananciaMes', fmtARS.format(periodProfit));
            setElementText('txtReposicionMes', fmtARS.format(periodReplacementCost));
            setElementText('txtVentasCountMes', periodOperations);
            setElementText('txtTicketPromedio', fmtARS.format(ticketPromedio));

            // Trazabilidad Separada y Totales con Flujo de Caja Puro:
            const cashSales = parseFloat(dataBox.cashSales ?? dataBox.periodCashSales ?? 0);
            const cashPayments = parseFloat(dataBox.cashPayments ?? dataBox.periodCustomerPaymentsCash ?? 0);
            const cashExpenses = parseFloat(dataBox.cashExpenses ?? dataBox.periodExpensesCash ?? 0);
            const transferSales = parseFloat(dataBox.transferSales ?? dataBox.periodTransferSales ?? 0);
            const transferPayments = parseFloat(dataBox.transferPayments ?? dataBox.periodCustomerPaymentsTransfer ?? 0);
            const creditSales = parseFloat(dataBox.creditSales ?? dataBox.periodCreditSales ?? 0);

            const netCash = (dataBox.netCash !== undefined && dataBox.netCash !== null)
                ? parseFloat(dataBox.netCash)
                : (cashSales + cashPayments - cashExpenses);

            const netTransfer = (dataBox.netTransfer !== undefined && dataBox.netTransfer !== null)
                ? parseFloat(dataBox.netTransfer)
                : (transferSales + transferPayments);

            setElementText('txtEfectivoRango', fmtARS.format(netCash));
            setElementText('txtTransfRango', fmtARS.format(netTransfer));
            setElementText('txtFiadoRango', fmtARS.format(creditSales));

            // Inyección del desglose detallado en Efectivo Caja:
            const elDesgloseEfe = document.getElementById('desgloseEfectivoRango') || document.getElementById('countEfectivoRango');
            if (elDesgloseEfe) {
                elDesgloseEfe.innerHTML = `<small class="text-muted d-block" style="font-size: 0.78rem;">Ventas: ${fmtARS.format(cashSales)} | Cobros Cta: ${fmtARS.format(cashPayments)} | Gastos: -${fmtARS.format(cashExpenses)}</small>`;
            }

            // Inyección del desglose detallado en Transferencias:
            const elDesgloseTra = document.getElementById('desgloseTransfRango') || document.getElementById('countTransfRango');
            if (elDesgloseTra) {
                elDesgloseTra.innerHTML = `<small class="text-muted d-block" style="font-size: 0.78rem;">Ventas: ${fmtARS.format(transferSales)} | Cobros Cta: ${fmtARS.format(transferPayments)}</small>`;
            }

            const elDesgloseFia = document.getElementById('desgloseFiadoRango') || document.getElementById('countFiadoRango');
            if (elDesgloseFia) {
                const countCredit = dataBox.periodCreditCount ?? 0;
                elDesgloseFia.innerHTML = `<small class="text-muted d-block" style="font-size: 0.78rem;">${countCredit} a cuenta corriente</small>`;
            }
        }

        // 3. Egresos en el Rango Clasificados
        if (resGastos.status === 'fulfilled' && resGastos.value && resGastos.value.ok) {
            const todosGastos = await resGastos.value.json();
            const desdeDate = new Date(desdeVal + 'T00:00:00');
            const hastaDate = new Date(hastaVal + 'T23:59:59');

            const gastosFiltrados = (Array.isArray(todosGastos) ? todosGastos : []).filter(g => {
                if (!g.date) return false;
                const fg = new Date(g.date);
                return fg >= desdeDate && fg <= hastaDate;
            });

            renderizarEgresosCategorias(gastosFiltrados);
        }

        const f1 = desdeVal.split('-').reverse().join('/');
        const f2 = hastaVal.split('-').reverse().join('/');
        setElementText('lblRangoActivo', `Datos auditados del ${f1} al ${f2}`);

    } catch (err) {
        console.error("Error al consultar datos detallados:", err);
    }
}

function renderizarEgresosCategorias(gastos) {
    const tbody = document.getElementById('tablaEgresosCategorias');
    if (!tbody) return;

    let totalEgresos = 0;
    const mapaCategorias = new Map();

    const NOMBRES_CAT = {
        'PROVEEDOR': 'Pago a Proveedor',
        'SERVICIOS': 'Servicios (Luz, Gas, Internet)',
        'LOGISTICA': 'Fletes y Logística',
        'SUELDOS': 'Sueldos y Adelantos',
        'MANTENIMIENTO': 'Mantenimiento / Insumos',
        'CAJA_CHICA': 'Caja Chica',
        'VARIOS_RETIRO': 'Retiros / Gastos Varios'
    };

    gastos.forEach(g => {
        const monto = parseFloat(g.amount) || 0;
        totalEgresos += monto;

        const catClave = g.category || 'VARIOS_RETIRO';
        const catNombre = NOMBRES_CAT[catClave] || catClave.replace(/_/g, ' ');

        if (!mapaCategorias.has(catNombre)) {
            mapaCategorias.set(catNombre, { nombre: catNombre, cantidad: 0, total: 0 });
        }
        const obj = mapaCategorias.get(catNombre);
        obj.cantidad++;
        obj.total += monto;
    });

    setElementText('txtTotalEgresosRango', fmtARS.format(totalEgresos));

    const listaCategorias = Array.from(mapaCategorias.values()).sort((a, b) => b.total - a.total);

    if (listaCategorias.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center p-3 text-muted">Sin egresos registrados en este rango.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    const fragment = document.createDocumentFragment();

    listaCategorias.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="ps-3 fw-semibold text-dark">${escapeHTML(c.nombre)}</td>
            <td class="text-center">
                <span class="badge bg-light text-secondary border px-2 py-1">${c.cantidad}</span>
            </td>
            <td class="text-end pe-3 fw-bold text-danger amount-num">-${fmtARS.format(c.total)}</td>
        `;
        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
}

// ===================================================================
// ALERTAS DE INVENTARIO CRÍTICO
// ===================================================================
async function cargarAlertasStock() {
    const container = document.getElementById('listaAlertasStock');
    if (!container) return;

    try {
        const res = await apiFetch('/products');
        if (!res || !res.ok) return;

        const productos = await res.json();
        if (!Array.isArray(productos)) return;

        const criticos = productos.filter(p => {
            const stock = parseFloat(p.stock) || 0;
            const minStock = parseFloat(p.minStock) || 5;
            return stock <= minStock;
        });

        setElementText('badgeStockCount', criticos.length);

        if (criticos.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <i class="bi bi-check-circle-fill fs-2 text-success opacity-75"></i>
                    <p class="mt-2 mb-0 small text-muted">Stock en niveles óptimos.</p>
                </div>`;
            return;
        }

        container.innerHTML = criticos.map(p => {
            const stockNum = parseFloat(p.stock) || 0;
            const minNum = parseFloat(p.minStock) || 5;
            const esMuyCritico = stockNum <= 0;

            return `
            <div class="d-flex align-items-center justify-content-between py-2 border-bottom">
                <div class="pe-2 text-truncate" style="max-width: 220px;">
                    <span class="d-block fw-semibold text-dark small text-truncate">
                        ${escapeHTML(p.name || 'Producto')}
                    </span>
                    <small class="text-muted" style="font-size: 0.72rem;">Mínimo: ${minNum} u.</small>
                </div>
                <span class="badge ${esMuyCritico ? 'bg-danger text-white' : 'bg-warning-subtle text-warning-emphasis border border-warning-subtle'} rounded-pill px-2.5 py-1">
                    ${stockNum} u.
                </span>
            </div>`;
        }).join('');

    } catch (err) {
        console.error("Error al cargar alertas de stock:", err);
    }
}

// ===================================================================
// HELPERS Y UTILIDADES
// ===================================================================
function setElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

function formatInputDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Exposición al scope global para eventos onclick/onchange en el DOM
window.aplicarPresetFecha = aplicarPresetFecha;
window.consultarPorFechas = consultarPorFechas;