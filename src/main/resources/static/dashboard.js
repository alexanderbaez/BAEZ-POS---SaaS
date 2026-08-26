/**
 * BÁEZ POS - SAAS DASHBOARD (Rediseño Limpio y Minimalista)
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

    // 2. Carga paralela de componentes
    await Promise.allSettled([
        cargarKpisYTablas(),
        cargarGraficoSemanal()
    ]);
});

// ==========================================
// 1. CARGA DE KPIS DEL MES Y TABLAS RÁPIDAS
// ==========================================
async function cargarKpisYTablas() {
    const ahora = new Date();
    const primerDiaMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const ultimoDiaMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0);

    const desdeStr = primerDiaMes.toISOString().split('T')[0];
    const hastaStr = ultimoDiaMes.toISOString().split('T')[0];

    try {
        // Peticiones paralelas de ventas, gastos y proveedores
        const [resVentas, resGastos, resProveedores] = await Promise.allSettled([
            apiFetch(`/sales?desde=${desdeStr}&hasta=${hastaStr}`),
            apiFetch('/api/v1/expenses'),
            apiFetch('/api/v1/providers')
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
            totalVentasMes += parseFloat(v.total) || 0;
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

        // --- CALCULAR GANANCIA NETA ---
        const gananciaNeta = totalVentasMes - totalGastosMes;

        // --- DEUDA A PROVEEDORES ---
        let totalDeudaProveedores = 0;
        let proveedoresConDeuda = 0;
        listaProveedores.forEach(p => {
            const saldo = parseFloat(p.currentBalance) || 0;
            if (saldo > 0) {
                totalDeudaProveedores += saldo;
                proveedoresConDeuda++;
            }
        });

        // --- ACTUALIZAR DOM DE KPIS ---
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
        setElementText('kpiProveedoresCount', `${proveedoresConDeuda} proveedores con saldo`);

        // --- RENDERIZAR TABLAS RÁPIDAS ---
        renderizarTopProductos(ventasActivasMes);
        renderizarUltimosMovimientos(listaVentas, listaGastos);

    } catch (err) {
        console.error("Error al cargar KPIs del dashboard:", err);
    }
}

// ==========================================
// 2. TOP 5 PRODUCTOS MÁS VENDIDOS
// ==========================================
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
                    <strong class="text-dark">${escapeHTML(p.nombre)}</strong>
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

// ==========================================
// 3. ÚLTIMOS 5 MOVIMIENTOS (VENTAS / GASTOS)
// ==========================================
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
            subdetalle: v.customerName || 'Consumidor Final',
            fecha: isNaN(fechaObj.getTime()) ? new Date() : fechaObj,
            metodo: (v.paymentMethod || 'EFECTIVO').replace(/_/g, ' '),
            monto: parseFloat(v.total) || 0,
            anulada: Boolean(v.canceled || v.status === 'ANULADA')
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
            subdetalle: g.category || 'Gasto',
            fecha: isNaN(fechaObj.getTime()) ? new Date() : fechaObj,
            metodo: (g.paymentMethod || 'EFECTIVO_CAJA').replace(/_/g, ' '),
            monto: parseFloat(g.amount) || 0,
            anulada: false
        });
    });

    // Ordenar cronológicamente descendente y tomar los 5 más recientes
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

// ==========================================
// 4. GRÁFICO CENTRAL DE EVOLUCIÓN (CHART.JS)
// ==========================================
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

        // Generar etiquetas de los últimos 7 días si los datos vienen vacíos
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

        // Destruir instancia previa para evitar glitches al redimensionar
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
                    legend: {
                        display: false
                    },
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
                        grid: {
                            color: '#f1f5f9',
                            borderDash: [4, 4]
                        },
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

// ==========================================
// UTILIDADES AUXILIARES
// ==========================================
function setElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
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