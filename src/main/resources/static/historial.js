// ==========================================
// 1. CONFIGURACIÓN Y VARIABLES GLOBALES
// ==========================================
let VENTA_SELECCIONADA = null;
let VENTAS_GLOBALES = [];
let DATOS_EMPRESA = null;

// ==========================================
// 2. INICIALIZACIÓN Y NORMALIZACIÓN DE FECHAS
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    const hoyLocal = new Date().toLocaleDateString('sv-SE'); // 'YYYY-MM-DD' local (AR)

    const fechaDesdeEl = document.getElementById('fechaDesde');
    const fechaHastaEl = document.getElementById('fechaHasta');

    if (fechaDesdeEl && !fechaDesdeEl.value) fechaDesdeEl.value = hoyLocal;
    if (fechaHastaEl && !fechaHastaEl.value) fechaHastaEl.value = hoyLocal;

    await cargarInfoEmpresa();
    await cargarVentas();
});

async function cargarInfoEmpresa() {
    try {
        const resp = await apiFetch('/admin/my-company/profile');
        if (resp.ok) {
            DATOS_EMPRESA = await resp.json();
        }
    } catch (err) {
        console.error("No se pudo cargar la info de la empresa:", err);
    }
}

// ==========================================
// 3. CARGA DE DATOS Y FILTRADO
// ==========================================
async function cargarVentas() {
    const desdeInput = document.getElementById('fechaDesde');
    const hastaInput = document.getElementById('fechaHasta');

    const desde = desdeInput ? desdeInput.value : '';
    const hasta = hastaInput ? hastaInput.value : '';

    if (!desde || !hasta) {
        return Swal.fire('Atención', 'Por favor selecciona el rango de fechas completo.', 'warning');
    }

    try {
        const tbody = document.getElementById('listaVentas');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center p-5 text-muted"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Buscando transacciones...</td></tr>';
        }

        const res = await apiFetch(`/sales?desde=${desde}&hasta=${hasta}`);
        if (!res.ok) throw new Error("Error al obtener el historial");

        const ventas = await res.json();
        VENTAS_GLOBALES = Array.isArray(ventas) ? ventas : (ventas.data || []);

        cargarVentasFiltradas();

    } catch (err) {
        console.error("Error al mapear historial:", err);
        Swal.fire('Error', 'No se pudieron recuperar las ventas para el rango seleccionado.', 'error');
    }
}

function cargarVentasFiltradas() {
    const filtroEl = document.getElementById('filtroMetodo');
    const metodo = filtroEl ? filtroEl.value : "TODOS";

    let ventasFiltradas = [...VENTAS_GLOBALES];

    if (metodo !== "TODOS") {
        ventasFiltradas = VENTAS_GLOBALES.filter(v => (v.paymentMethod || 'EFECTIVO') === metodo);
    }

    renderizarTabla(ventasFiltradas);
    calcularResumenVisto(ventasFiltradas);
}

function obtenerNumTicketVisual(v) {
    return v.nroComprobante || (v.numeroTicket ? `#${v.numeroTicket}` : `#${v.id}`);
}

// ==========================================
// 4. RENDERIZADO DE TABLA (OPCION OPTIMIZADA)
// ==========================================
function renderizarTabla(ventas) {
    const tbody = document.getElementById('listaVentas');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!ventas || ventas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center p-5 text-muted">No se encontraron ventas en este período.</td></tr>';
        return;
    }

    // Ordenamiento numérico descendente
    const ventasOrdenadas = [...ventas].sort((a, b) => {
        const numA = Number(a.numeroTicket || a.id) || 0;
        const numB = Number(b.numeroTicket || b.id) || 0;
        return numB - numA;
    });

    const fragment = document.createDocumentFragment();

    ventasOrdenadas.forEach(v => {
        const estaAnulada = v.status === "ANULADA" || Boolean(v.canceled);
        const numTicketVisual = obtenerNumTicketVisual(v);

        let iconClass = "bi-cash text-success";
        let metodoNombre = (v.paymentMethod || 'EFECTIVO').replace(/_/g, ' ').toUpperCase();

        if (v.paymentMethod === 'TRANSFERENCIA') {
            iconClass = "bi-phone text-primary";
        } else if (v.paymentMethod === 'CUENTA_CORRIENTE') {
            iconClass = "bi-journal-bookmark text-warning";
            metodoNombre = "LIBRETA";
        }

        const tr = document.createElement('tr');
        if (estaAnulada) tr.classList.add('status-anulada');

        // Mapeo seguro de cliente
        const nombreClienteBruto = v.customerName || v.clienteNombre || v.customer || 'Consumidor Final';
        const cliente = escapeHtml(nombreClienteBruto).toUpperCase();

        // Mapeo seguro de productos
        const itemsArray = Array.isArray(v.items) ? v.items : [];
        const listaNombresProductos = itemsArray
            .map(i => i.productName || i.nombre || i.title || '')
            .filter(Boolean)
            .join(", ");

        const resumenProductos = listaNombresProductos
            ? escapeHtml(listaNombresProductos)
            : '<em class="text-muted opacity-75">Sin detalle de productos</em>';

        // Mapeo seguro de fecha
        const fechaRaw = v.saleDate || v.created_at || v.createdAt || new Date();
        const fechaObj = new Date(fechaRaw);
        const fechaFormateada = !isNaN(fechaObj.getTime())
            ? fechaObj.toLocaleString('es-AR')
            : 'Fecha no registrada';

        const descuentoVal = parseFloat(v.discount) || 0;
        const totalVal = parseFloat(v.total) || 0;
        const vendedorNombre = escapeHtml(v.sellerName || v.userName || v.cashierName || 'Admin');

        tr.innerHTML = `
            <td class="ps-3 align-middle"><span class="fw-bold text-dark">${escapeHtml(numTicketVisual)}</span></td>
            <td class="text-muted small align-middle text-nowrap d-none d-md-table-cell">${fechaFormateada}</td>
            <td class="align-middle">
                <div class="fw-bold text-dark text-truncate" style="max-width: 230px;">${cliente}</div>
                <div class="text-muted small text-truncate" style="max-width: 230px;" title="${escapeHtml(listaNombresProductos)}">
                    ${resumenProductos}
                </div>
            </td>
            <td class="align-middle text-nowrap d-none d-lg-table-cell">
                <span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1">
                    <i class="bi bi-person me-1"></i> ${vendedorNombre}
                </span>
            </td>
            <td class="align-middle text-nowrap d-none d-sm-table-cell">
                <span class="badge bg-light text-dark border px-2 py-1">
                    <i class="bi ${iconClass} me-1"></i> ${escapeHtml(metodoNombre)}
                </span>
            </td>
            <td class="text-end text-danger align-middle text-nowrap amount-num d-none d-xl-table-cell">-$${descuentoVal.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            <td class="text-end fw-bold align-middle text-dark text-nowrap amount-num">$${totalVal.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            <td class="text-center align-middle text-nowrap pe-3" style="width: 110px;">
                <div class="d-flex flex-row justify-content-center align-items-center gap-1">
                    <button class="btn btn-sm btn-light" onclick="verDetalle(${v.id})" title="Ver detalle">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-light" onclick="confirmarAnulacion(${v.id})" ${estaAnulada ? 'disabled' : ''} title="Anular">
                        <i class="bi bi-trash text-danger"></i>
                    </button>
                </div>
            </td>
        `;
        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
}

// Sanitizador XSS
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ==========================================
// 5. LÓGICA DE ANULACIÓN
// ==========================================
async function confirmarAnulacion(id) {
    const venta = VENTAS_GLOBALES.find(v => v.id === id);
    const numTicketVisual = venta ? obtenerNumTicketVisual(venta) : `#${id}`;

    const result = await Swal.fire({
        title: `¿Anular venta ${numTicketVisual}?`,
        text: "El stock se reintegrará automáticamente y esta acción no se puede deshacer.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, anular venta',
        cancelButtonText: 'Mantener'
    });

    if (result.isConfirmed) {
        try {
            const res = await apiFetch(`/sales/${id}/cancel`, { method: 'PUT' });

            if (res.ok) {
                Swal.fire('Venta Anulada', 'El stock ha sido restaurado.', 'success');
                await cargarVentas();
            } else {
                const errorData = await res.json();
                Swal.fire('Error', errorData.message || 'No se pudo procesar la anulación', 'error');
            }
        } catch (err) {
            Swal.fire('Error de red', 'No hay conexión con el servidor.', 'error');
        }
    }
}

// ==========================================
// HELPER GLOBAL DE FORMATEO DE CANTIDAD (ESTÁNDAR TICKET/HISTORIAL)
// ==========================================
function fmtCantidadGlobal(item) {
    if (!item) return '1 un.';

    const qty = parseFloat(item.quantity || item.cantidad || item.weight || item.peso || 1);
    const nombreProd = (item.productName || item.nombre || '').toUpperCase();

    // Palabras clave para detectar productos de balanza/peso por su nombre
    const palabrasPesables = ['PAN', 'QUESO', 'CARNE', 'POLLO', 'ASADO', 'FIAMBRE', 'PALETA', 'JAMON', 'MILANESA', 'FRUTA', 'VERDURA', 'VERDURAS', 'FRUTAS', 'KG', 'KILO'];
    const coincideNombre = palabrasPesables.some(function verificarPalabraPesable(p) {
        return nombreProd.includes(p);
    });

    // Detectar unidad en los metadatos del objeto
    const rawUnit = (
        item.unitOfMeasure ||
        item.unitType ||
        item.unidadMedida ||
        item.saleType ||
        item.unit ||
        item.unidad ||
        ''
    ).toString().toUpperCase().trim();

    const esFraccionado = Boolean(
        item.isFractional ||
        item.esFraccionado ||
        ['KG', 'GRAM', 'KILO', 'GRAMO', 'G', 'GR'].includes(rawUnit) ||
        coincideNombre ||
        (qty % 1 !== 0)
    );

    if (typeof window.fmtCantidadTicket === 'function') {
        return window.fmtCantidadTicket(qty, esFraccionado);
    }

    if (esFraccionado) {
        if (qty < 1 && qty > 0) {
            return (qty * 1000) + " gr";
        }
        let formatted = Number.isInteger(qty) ? qty.toString() : qty.toFixed(3).replace(/\.?0+$/, '');
        return formatted + " Kg";
    }

    return parseInt(qty).toString() + " un";
}

// ==========================================
// 6. VER DETALLE (MODAL TICKET)
// ==========================================
function verDetalle(idVenta) {
    const venta = VENTAS_GLOBALES.find(v => v.id === idVenta);
    if (!venta) return;

    VENTA_SELECCIONADA = venta;

    const setSafeText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    };

    setSafeText('txtIdVenta', obtenerNumTicketVisual(venta));
    setSafeText('txtCajeroModal', (venta.sellerName || venta.userName || venta.cashierName || 'Admin').toUpperCase());

    const container = document.getElementById('contenedorItems');
    if (container) {
        container.innerHTML = '';
        let sumaSubtotales = 0;

        (venta.items || []).forEach(item => {
            const cant = parseFloat(item.quantity || item.cantidad || 1);
            const prec = parseFloat(item.price || item.precio || 0);
            const subtotalItem = item.subtotal !== undefined ? parseFloat(item.subtotal) : (prec * cant);
            sumaSubtotales += subtotalItem;

            const itemDiv = document.createElement('div');
            itemDiv.className = "d-flex justify-content-between align-items-center mb-2 border-bottom pb-2";
            itemDiv.innerHTML = `
                <div style="flex: 1;">
                    <span class="fw-bold text-uppercase" style="font-size: 12px;">${escapeHtml(item.productName || item.nombre || 'PRODUCTO')}</span><br>
                    <small class="text-muted">${fmtCantidadGlobal(item)} x $${prec.toLocaleString('es-AR', {minimumFractionDigits: 2})}</small>
                </div>
                <div class="fw-bold">$${subtotalItem.toLocaleString('es-AR', {minimumFractionDigits: 2})}</div>
            `;
            container.appendChild(itemDiv);
        });

        const descuento = parseFloat(venta.discount) || 0;
        const recargo = parseFloat(venta.surcharge) || 0;

        setSafeText('txtSubtotalModal', `$${sumaSubtotales.toLocaleString('es-AR', {minimumFractionDigits: 2})}`);
        setSafeText('txtDescuentoModal', `-$${descuento.toLocaleString('es-AR', {minimumFractionDigits: 2})}`);

        setSafeText('txtRecargoModal', `+$${recargo.toLocaleString('es-AR', {minimumFractionDigits: 2})}`);
        setSafeText('txtTotalModal', `$${(parseFloat(venta.total) || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}`);

        const metodoElement = document.getElementById('txtMetodoModal');
        if (metodoElement) {
            let metodo = (venta.paymentMethod || 'EFECTIVO').toUpperCase();
            if (metodo === 'CUENTA_CORRIENTE') metodo = 'LIBRETA';
            metodoElement.innerHTML = `<i class="bi bi-info-circle me-1"></i> PAGO CON ${metodo}`;
        }
    }

    const modalElement = document.getElementById('modalDetalleVenta');
    if (modalElement) {
        // Reutilización segura de la instancia de Bootstrap Modal
        const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
        modal.show();
    }
}

// ==========================================
// 7. RESUMEN SUPERIOR
// ==========================================
function calcularResumenVisto(ventas) {
    let totalEfe = 0;
    let totalTra = 0;
    let totalLib = 0;

    ventas.forEach(v => {
        if (v.status !== "ANULADA" && !v.canceled) {
            const montoTotal = parseFloat(v.total) || 0;
            if (v.paymentMethod === 'TRANSFERENCIA') {
                totalTra += montoTotal;
            } else if (v.paymentMethod === 'CUENTA_CORRIENTE') {
                totalLib += montoTotal;
            } else {
                totalEfe += montoTotal;
            }
        }
    });

    const totalCajaReal = totalEfe + totalTra;
    const totalMontoVendido = totalEfe + totalTra + totalLib;
    const fmt = (val) => `$${val.toLocaleString('es-AR', {minimumFractionDigits: 2})}`;

    const safeSetText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    };

    safeSetText('resumenEfectivo', fmt(totalEfe));
    safeSetText('resumenTransf', fmt(totalTra));
    safeSetText('resumenLibreta', fmt(totalLib));
    safeSetText('resumenTotalCaja', fmt(totalCajaReal));
    safeSetText('resumenVentaTotal', fmt(totalMontoVendido));
}

// ==========================================
// 8. REPORTES ROBUSTOS (PDF Y EXCEL)
// ==========================================
function obtenerVentasParaExportar() {
    const filtroEl = document.getElementById('filtroMetodo');
    const metodo = filtroEl ? filtroEl.value : "TODOS";

    return VENTAS_GLOBALES.filter(v => {
        if (v.status === "ANULADA" || v.canceled) return false;
        if (metodo !== "TODOS") {
            return (v.paymentMethod || 'EFECTIVO') === metodo;
        }
        return true;
    });
}

function exportarPDF() {
    const ventasAExportar = obtenerVentasParaExportar();

    if (ventasAExportar.length === 0) {
        return Swal.fire('Sin datos', 'No hay ventas activas para exportar en el rango seleccionado.', 'info');
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    let totalEfectivo = 0, totalTransferencia = 0, totalLibreta = 0;
    let sumaDescuentos = 0, sumaRecargos = 0;
    const filas = [];

    ventasAExportar.forEach(v => {
        const desc = parseFloat(v.discount) || 0;
        const rec = parseFloat(v.surcharge) || 0;
        const totalVenta = parseFloat(v.total) || 0;
        const numTicketVisual = obtenerNumTicketVisual(v);

        sumaDescuentos += desc;
        sumaRecargos += rec;

        if (v.paymentMethod === 'TRANSFERENCIA') totalTransferencia += totalVenta;
        else if (v.paymentMethod === 'CUENTA_CORRIENTE') totalLibreta += totalVenta;
        else totalEfectivo += totalVenta;

        const items = v.items || [];
        const fechaFmt = new Date(v.saleDate).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
        const metodoPagoText = v.paymentMethod === 'CUENTA_CORRIENTE' ? 'LIBRETA' : (v.paymentMethod || 'EFECTIVO');
        const clienteText = v.customerName || v.clienteNombre || 'Consumidor Final';

        if (items.length === 0) {
            filas.push([
                numTicketVisual, fechaFmt, clienteText, 'SIN DETALLE DE PRODUCTOS', '1 un.',
                `$${totalVenta.toLocaleString('es-AR', {minimumFractionDigits: 2})}`,
                `$${totalVenta.toLocaleString('es-AR', {minimumFractionDigits: 2})}`,
                metodoPagoText
            ]);
        } else {
            items.forEach((item, index) => {
                const cant = parseFloat(item.quantity || item.cantidad || 1);
                const prec = parseFloat(item.price || item.precio || 0);
                const subtotalItem = item.subtotal !== undefined ? parseFloat(item.subtotal) : (cant * prec);

                filas.push([
                    index === 0 ? numTicketVisual : "",
                    index === 0 ? fechaFmt : "",
                    index === 0 ? clienteText : "",
                    (item.productName || item.nombre || 'PRODUCTO').toUpperCase(),
                    fmtCantidadGlobal(item),
                    `$${prec.toLocaleString('es-AR', {minimumFractionDigits: 2})}`,
                    `$${subtotalItem.toLocaleString('es-AR', {minimumFractionDigits: 2})}`,
                    index === 0 ? metodoPagoText : ""
                ]);
            });
        }
    });

    const fechaDesde = document.getElementById('fechaDesde')?.value || '';
    const fechaHasta = document.getElementById('fechaHasta')?.value || '';

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 38, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text("Reporte Detallado de Ventas", 14, 18);
    doc.setFontSize(9);
    doc.text(`Rango auditado: Desde ${fechaDesde} hasta ${fechaHasta}`, 14, 27);
    doc.text(`Total operaciones auditadas: ${ventasAExportar.length} ventas`, 14, 33);

    doc.autoTable({
        startY: 42,
        head: [['COMPROBANTE', 'FECHA', 'CLIENTE', 'PRODUCTO', 'CANT', 'P. UNIT', 'SUBTOTAL', 'PAGO']],
        body: filas,
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 7, cellPadding: 2 },
        columnStyles: {
            0: { cellWidth: 22 }, 1: { cellWidth: 24 }, 2: { cellWidth: 26 },
            3: { cellWidth: 'auto' }, 4: { cellWidth: 16, halign: 'center' },
            5: { cellWidth: 18, halign: 'right' }, 6: { cellWidth: 20, halign: 'right' },
            7: { cellWidth: 20, halign: 'center' }
        },
        margin: { top: 42, bottom: 20 }
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    if (finalY > 230) doc.addPage();
    const actualY = finalY > 230 ? 20 : finalY;

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text("BALANCE DE AUDITORÍA CONTABLE:", 14, actualY);

    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.text(`(+) Recaudación en Efectivo: $${totalEfectivo.toLocaleString('es-AR', {minimumFractionDigits: 2})}`, 14, actualY + 6);
    doc.text(`(+) Recaudación Transferencias/Digital: $${totalTransferencia.toLocaleString('es-AR', {minimumFractionDigits: 2})}`, 14, actualY + 12);

    doc.setTextColor(217, 119, 6);
    doc.text(`( ) Deuda Pendiente en Libreta: $${totalLibreta.toLocaleString('es-AR', {minimumFractionDigits: 2})} (incluye $${sumaRecargos.toLocaleString('es-AR', {minimumFractionDigits: 2})} de recargos)`, 14, actualY + 18);

    doc.setTextColor(220, 38, 38);
    doc.text(`(-) Total Descuentos Aplicados: $${sumaDescuentos.toLocaleString('es-AR', {minimumFractionDigits: 2})}`, 14, actualY + 24);

    doc.setFontSize(12);
    doc.setTextColor(37, 99, 235);
    doc.setFont(undefined, 'bold');
    doc.text(`TOTAL RECAUDADO EN CAJA (EFE + TRA): $${(totalEfectivo + totalTransferencia).toLocaleString('es-AR', {minimumFractionDigits: 2})}`, 14, actualY + 34);

    doc.save(`Reporte_Ventas_${fechaDesde}_al_${fechaHasta}.pdf`);
}

function exportarExcelPro() {
    const ventasAExportar = obtenerVentasParaExportar();

    if (ventasAExportar.length === 0) {
        return Swal.fire('Atención', 'No hay datos activos para exportar en el rango seleccionado.', 'info');
    }

    let efe = 0, tra = 0, lib = 0, descTot = 0, recTot = 0;
    const dataExcel = [];

    ventasAExportar.forEach(v => {
        const desc = parseFloat(v.discount) || 0;
        const rec = parseFloat(v.surcharge) || 0;
        const totalVenta = parseFloat(v.total) || 0;
        const numTicketVisual = obtenerNumTicketVisual(v);

        descTot += desc;
        recTot += rec;

        if (v.paymentMethod === 'TRANSFERENCIA') tra += totalVenta;
        else if (v.paymentMethod === 'CUENTA_CORRIENTE') lib += totalVenta;
        else efe += totalVenta;

        const items = v.items || [];
        const metodoTexto = v.paymentMethod === 'CUENTA_CORRIENTE' ? 'LIBRETA' : (v.paymentMethod || 'EFECTIVO');
        const clienteTexto = v.customerName || v.clienteNombre || 'Consumidor Final';
        const fechaTexto = new Date(v.saleDate).toLocaleString('es-AR');

        if (items.length === 0) {
            dataExcel.push({
                "N° Comprobante": numTicketVisual,
                "Fecha / Hora": fechaTexto,
                "Cliente": clienteTexto,
                "Producto": 'SIN DETALLE',
                "Cantidad / Peso": '1 un.',
                "Precio Unitario": totalVenta,
                "Subtotal Ítem": totalVenta,
                "Descuento Venta": desc,
                "Recargo Libreta": rec,
                "Total Venta": totalVenta,
                "Método de Pago": metodoTexto
            });
        } else {
            items.forEach((item, index) => {
                const cant = parseFloat(item.quantity || item.cantidad || 1);
                const prec = parseFloat(item.price || item.precio || 0);
                const subt = item.subtotal !== undefined ? parseFloat(item.subtotal) : (cant * prec);

                // Evitamos duplicar totales agregados por renglón de ítem
                dataExcel.push({
                    "N° Comprobante": index === 0 ? numTicketVisual : "",
                    "Fecha / Hora": index === 0 ? fechaTexto : "",
                    "Cliente": index === 0 ? clienteTexto : "",
                    "Producto": (item.productName || item.nombre || 'PRODUCTO').toUpperCase(),
                    "Cantidad / Peso": fmtCantidadGlobal(item),
                    "Precio Unitario": prec,
                    "Subtotal Ítem": subt,
                    "Descuento Venta": index === 0 ? desc : "",
                    "Recargo Libreta": index === 0 ? rec : "",
                    "Total Venta": index === 0 ? totalVenta : "",
                    "Método de Pago": index === 0 ? metodoTexto : ""
                });
            });
        }
    });

    const fechaDesde = document.getElementById('fechaDesde')?.value || '';
    const fechaHasta = document.getElementById('fechaHasta')?.value || '';

    dataExcel.push({});
    dataExcel.push({ "Producto": "--- RESUMEN DE AUDITORÍA DE CAJA ---" });
    dataExcel.push({ "Producto": "TOTAL DESCUENTOS APLICADOS:", "Subtotal Ítem": descTot });
    dataExcel.push({ "Producto": "TOTAL RECARGOS LIBRETA:", "Subtotal Ítem": recTot });
    dataExcel.push({ "Producto": "TOTAL EFECTIVO (CAJA):", "Subtotal Ítem": efe });
    dataExcel.push({ "Producto": "TOTAL TRANSFERENCIA (BANCO):", "Subtotal Ítem": tra });
    dataExcel.push({ "Producto": "TOTAL LIBRETA (PENDIENTE DE COBRO):", "Subtotal Ítem": lib });
    dataExcel.push({ "Producto": "TOTAL RECAUDACIÓN REAL EN CAJA (EFE + TRA):", "Subtotal Ítem": efe + tra });

    const ws = XLSX.utils.json_to_sheet(dataExcel);
    ws['!cols'] = [
        { wch: 16 }, { wch: 18 }, { wch: 22 }, { wch: 35 },
        { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
        { wch: 14 }, { wch: 14 }, { wch: 16 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Detalle de Productos");
    XLSX.writeFile(wb, `Planilla_Ventas_Productos_${fechaDesde}_al_${fechaHasta}.xlsx`);
}

// ==========================================
// 9. REIMPRESIÓN DE TICKET TÉRMICO (58mm POS)
// ==========================================
/**
 * Motor de impresión nativo mediante CSS @media print y #print-section.
 * Sincroniza la carga de imágenes (ej. códigos QR) antes de invocar window.print().
 */
function imprimirHTMLConIframe(htmlContent) {
    let printSection = document.getElementById('print-section');
    if (!printSection) {
        printSection = document.createElement('div');
        printSection.id = 'print-section';
        document.body.appendChild(printSection);
    }
    printSection.innerHTML = htmlContent;

    const images = Array.from(printSection.querySelectorAll('img'));
    const pendingImages = images.filter(img => !img.complete);

    const ejecutarImpresion = () => {
        try {
            window.print();
        } finally {
            setTimeout(() => {
                if (printSection) printSection.innerHTML = '';
            }, 1000);
        }
    };

    if (pendingImages.length === 0) {
        ejecutarImpresion();
    } else {
        const imagePromises = pendingImages.map(img => {
            return new Promise(resolve => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
            });
        });

        const timeoutPromise = new Promise(resolve => setTimeout(resolve, 1500));

        Promise.race([Promise.all(imagePromises), timeoutPromise]).then(() => {
            ejecutarImpresion();
        });
    }
}

function reimprimirTicket() {
    if (!VENTA_SELECCIONADA) return;

    const venta = VENTA_SELECCIONADA;
    const infoEmpresa = (typeof DATOS_EMPRESA !== 'undefined' && DATOS_EMPRESA !== null) ? DATOS_EMPRESA : {};
    const fiscalActivo = String(venta.isFiscal !== undefined ? venta.isFiscal : infoEmpresa.hasTaxData) === "true";

    // Datos del emisor
    const nombreLocal = escapeHtml(venta.companyName || infoEmpresa.name || 'MI NEGOCIO').toUpperCase();
    const direccionLocal = escapeHtml(venta.companyAddress || infoEmpresa.address || '');
    const telefonoLocal = escapeHtml(venta.companyPhone || infoEmpresa.phone || '');
    const emailLocal = escapeHtml(venta.companyEmail || infoEmpresa.email || '');
    const mensajePie = escapeHtml(venta.ticketMessage || infoEmpresa.ticketMessage || '¡Gracias por su compra!');

    const cuitLocal = venta.companyCuit || infoEmpresa.taxId || infoEmpresa.cuit || '';
    const iibbLocal = venta.companyIibb || infoEmpresa.iibb || '';
    const condicionIva = (venta.condicionIva || infoEmpresa.condicionIva || 'RESPONSABLE MONOTRIBUTO').toUpperCase();

    let inicioActividades = venta.inicioActividades || infoEmpresa.inicioActividades || infoEmpresa.inicioAct || '';
    if (inicioActividades && inicioActividades.includes('-')) {
        const parts = inicioActividades.split('-');
        if (parts.length === 3) inicioActividades = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    const tipoComprobante = fiscalActivo
        ? (venta.invoiceType || infoEmpresa.tipoComprobante || 'FACTURA C').toUpperCase()
        : 'TICKET NO FISCAL';

    const cae = venta.cae || '';
    const caeVto = venta.caeExpiration || venta.caeVto || '';

    // Número de Comprobante / Ticket
    const nroComprobante = venta.invoiceNumber || venta.nroComprobante || `00001-${String(venta.numeroTicket || venta.id || 1).padStart(8, '0')}`;
    const fechaVenta = venta.saleDate ? new Date(venta.saleDate).toLocaleString('es-AR') : new Date().toLocaleString('es-AR');
    const cajeroNombre = escapeHtml(venta.sellerName || venta.userName || venta.cashierName || 'Admin').toUpperCase();
    const metodoPago = (venta.paymentMethod || 'EFECTIVO').replace(/_/g, ' ').toUpperCase();

    const nombreCliente = escapeHtml((venta.clienteNombre || 'CONSUMIDOR FINAL').toUpperCase());
    const cuitCliente = venta.clienteCuit || '';

    const recargoMonto = parseFloat(venta.surcharge) || 0;
    const recargoPorcentaje = parseFloat(venta.surchargeRate) || 0;
    const descuentoMonto = parseFloat(venta.discount) || 0;
    const totalFinal = parseFloat(venta.total) || 0;
    const subtotalProductos = (totalFinal - recargoMonto) + descuentoMonto;

    // Generar JSON Oficial de AFIP / ARCA para el QR
    let qrText = '';
    if (cae) {
        const cuitLimpio = cuitLocal.replace(/\D/g, '');
        const cuitClienteLimpio = cuitCliente.replace(/\D/g, '');

        const numeroComprobanteEntero = nroComprobante.includes('-')
            ? parseInt(nroComprobante.split('-')[1], 10)
            : (venta.numeroTicket || venta.id || 1);

        const datosQr = {
            ver: 1,
            fecha: fechaVenta.split(' ')[0],
            cuit: Number(cuitLimpio),
            ptoVta: 1,
            tipoCmp: tipoComprobante.includes('A') ? 1 : 11,
            nroCmp: numeroComprobanteEntero,
            importe: totalFinal,
            moneda: "ARS",
            ctz: 1,
            tipoDocRec: cuitClienteLimpio ? 80 : 99,
            nroDocRec: cuitClienteLimpio ? Number(cuitClienteLimpio) : 0,
            tipoCodAut: "E",
            codAut: Number(cae) || 0
        };
        try {
            qrText = `https://www.afip.gob.ar/fe/qr/?p=${btoa(JSON.stringify(datosQr))}`;
        } catch(e) {
            qrText = '';
        }
    }

    // Listado de Productos vendidos
    const itemsHTML = venta.items ? venta.items.map(function mapItemTicketHTML(item) {
        const subtotalItem = item.subtotal !== undefined
            ? item.subtotal
            : ((item.price || item.unitPrice || item.precio || 0) * (item.quantity || item.cantidad || 1));
        const cantidadVal = item.quantity !== undefined ? item.quantity : (item.cantidad !== undefined ? item.cantidad : 1);
        const isFractionalVal = Boolean(
            item.isFractional ||
            item.fraccionable ||
            item.unitType === 'KG' ||
            item.unit === 'KG' ||
            (item.product && (item.product.isFractional || item.product.fraccionable)) ||
            (item.producto && (item.producto.isFractional || item.producto.fraccionable)) ||
            (!Number.isInteger(parseFloat(cantidadVal)))
        );
        const cantFormatted = (typeof window.fmtCantidadTicket === 'function')
            ? window.fmtCantidadTicket(cantidadVal, isFractionalVal)
            : (cantidadVal + (isFractionalVal ? ' Kg' : ' un'));
        const prefijoCantidad = cantFormatted ? `${cantFormatted} ` : '';

        return `
            <div class="item-row">
                <span class="item-qty-name">${prefijoCantidad}${escapeHtml(item.productName || item.nombre || item.name || '').toUpperCase()}</span>
                <span class="item-price">$${window.fmtPrecioTicket ? window.fmtPrecioTicket(subtotalItem) : (typeof formatearMoneda === 'function' ? formatearMoneda(parseFloat(subtotalItem)) : window.formatearMoneda(parseFloat(subtotalItem)))}</span>
            </div>
        `;
    }).join('') : '';

    const htmlTicket = `
        <!DOCTYPE html>
        <html>
            <head>
                <title>Reimpresión Ticket #${venta.id || ''}</title>
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css">
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
                    @page { margin: 0; size: auto; }
                    body {
                        font-family: 'Inter', sans-serif;
                        width: 100%;
                        max-width: 80mm;
                        padding: 4px;
                        margin: 0 auto;
                        color: #000000;
                        background: #ffffff;
                        line-height: 1.25;
                        font-size: 9pt;
                    }
                    .center { text-align: center; }
                    .ticket-header { border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
                    .shop-icon-container { display: flex; justify-content: center; align-items: center; margin-bottom: 4px; }
                    .shop-icon-container svg { width: 28px; height: 28px; fill: #000; }
                    .business-name { font-weight: 900; font-size: 12pt; margin: 2px 0; text-transform: uppercase; letter-spacing: -0.2px; }
                    .small-info { font-size: 8.5pt; color: #000; margin: 1.5px 0; }
                    .fiscal-header { font-size: 8pt; color: #000; text-align: left; background: #f8fafc; padding: 4px 6px; border-radius: 4px; margin-top: 4px; border: 1px solid #e2e8f0; }
                    .item-row { display: flex; justify-content: space-between; align-items: flex-start; font-size: 8.5pt; margin-bottom: 4px; word-break: break-word; }
                    .item-qty-name { font-weight: 700; text-transform: uppercase; flex: 1; padding-right: 6px; }
                    .item-price { font-weight: 700; white-space: nowrap; }
                    .line { border-top: 1px dashed #000; margin: 6px 0; }
                    .total-container { border-top: 2px solid #000; margin-top: 6px; padding-top: 6px; display: flex; justify-content: space-between; align-items: center; }
                    .total-label { font-weight: 900; font-size: 12pt; }
                    .total-amount { font-weight: 900; font-size: 12pt; color: #000; }
                    .arca-container { border-top: 1px solid #000; margin-top: 8px; padding-top: 6px; text-align: center; }
                    .arca-logo { font-weight: 900; font-size: 10pt; letter-spacing: 2px; }
                    .cae-info { font-size: 8pt; font-weight: 700; text-align: left; }
                    .ticket-footer { text-align: center; margin-top: 8px; border-top: 1px dashed #000; padding-top: 6px; }
                    .msg-pie { font-style: italic; font-size: 8.5pt; color: #000; margin-bottom: 4px; display: block; }
                    .payment-method { font-weight: 800; font-size: 8.5pt; border: 1px solid #000; padding: 2px 6px; display: inline-block; border-radius: 4px; margin-bottom: 4px; }
                    .watermark-reprint { font-size: 7.5pt; font-weight: 800; color: #000; background: #f1f5f9; padding: 2px 4px; border-radius: 3px; display: inline-block; margin: 3px 0; border: 1px solid #cbd5e1; }
                    .powered { font-size: 7pt; font-weight: 700; opacity: 0.6; margin-top: 6px; letter-spacing: 0.5px; }
                </style>
            </head>
            <body class="layout-ticket">
                <div class="layout-ticket">
                    <div class="ticket-header center">
                        <div class="shop-icon-container">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
                                <path d="M2.97 1.35A1 1 0 0 1 3.73 1h8.54a1 1 0 0 1 .76.35l2.609 3.044A1.5 1.5 0 0 1 16 5.37v.255a2.375 2.375 0 0 1-4.25 1.458A2.37 2.37 0 0 1 9.875 8 2.37 2.37 0 0 1 8 7.083 2.37 2.37 0 0 1 6.125 8a2.37 2.37 0 0 1-1.875-.917A2.375 2.375 0 0 1 0 5.625V5.37a1.5 1.5 0 0 1 .361-.976zm1.78 4.275a1.375 1.375 0 0 0 2.75 0 .5.5 0 0 1 1 0 1.375 1.375 0 0 0 2.75 0 .5.5 0 0 1 1 0 1.375 1.375 0 1 0 2.75 0V5.37a.5.5 0 0 0-.12-.325L12.27 2H3.73L1.12 5.045A.5.5 0 0 0 1 5.37v.255a1.375 1.375 0 0 0 2.75 0 .5.5 0 0 1 1 0M1.5 8.5A.5.5 0 0 1 2 9v6h12V9a.5.5 0 0 1 1 0v6.5a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5V9a.5.5 0 0 1 .5-.5M5 11a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5v4H5z"/>
                            </svg>
                        </div>
                        <div class="business-name">${nombreLocal}</div>
                        ${direccionLocal ? `<div class="small-info">${direccionLocal}</div>` : ''}
                        ${telefonoLocal ? `<div class="small-info">Tel: ${telefonoLocal}</div>` : ''}
                        ${emailLocal ? `<div class="small-info">${emailLocal}</div>` : ''}
                        ${fiscalActivo ? `
                            <div class="fiscal-header">
                                ${cuitLocal ? `<div><strong>CUIT:</strong> ${cuitLocal}</div>` : ''}
                                ${iibbLocal ? `<div><strong>Ing. Brutos:</strong> ${iibbLocal}</div>` : ''}
                                ${inicioActividades ? `<div><strong>Inic. Act.:</strong> ${inicioActividades}</div>` : ''}
                                ${condicionIva ? `<div><strong>Cond. IVA:</strong> ${condicionIva}</div>` : ''}
                            </div>
                        ` : ''}
                        <div class="line"></div>
                        <div class="watermark-reprint">DUPLICADO / REIMPRESIÓN</div>
                        <div class="small-info"><strong>${tipoComprobante} N° ${nroComprobante}</strong></div>
                        <div class="small-info">Fecha: ${fechaVenta}</div>
                        <div class="small-info">Cajero: ${cajeroNombre}</div>
                        <div class="small-info" style="text-align: left; margin-top: 4px;"><strong>A:</strong> ${nombreCliente} ${cuitCliente ? `(CUIT: ${cuitCliente})` : ''}</div>
                    </div>

                    <div class="ticket-body">
                        ${itemsHTML}
                        ${descuentoMonto > 0 ? `
                            <div class="line"></div>
                            <div class="item-row" style="color: #dc3545;">
                                <span class="item-qty-name">DESCUENTO:</span>
                                <span class="item-price">-$${formatearMoneda(descuentoMonto)}</span>
                            </div>
                        ` : ''}
                        ${recargoMonto > 0 ? `
                            <div class="line"></div>
                            <div class="item-row" style="color: #64748b; font-size: 8pt;">
                                <span class="item-qty-name">SUBTOTAL PRODUCTOS:</span>
                                <span class="item-price">$${formatearMoneda(subtotalProductos)}</span>
                            </div>
                            <div class="item-row" style="color: #d97706; font-weight: bold;">
                                <span class="item-qty-name">RECARGO LIBRETA (${recargoPorcentaje}%):</span>
                                <span class="item-price">+$${formatearMoneda(recargoMonto)}</span>
                            </div>
                        ` : ''}
                        <div class="total-container">
                            <span class="total-label">TOTAL</span>
                            <span class="total-amount">$${formatearMoneda(totalFinal)}</span>
                        </div>
                    </div>

                    ${cae ? `
                        <div class="arca-container" style="border-top: 1px dashed #000; margin-top: 8px; padding-top: 6px; text-align: center;">
                            <div class="arca-logo" style="text-align: center; font-weight: 900; font-size: 10pt; letter-spacing: 2px;">ARCA / AFIP</div>
                            <div class="small-info center" style="font-size: 7.5pt; margin-bottom: 4px; text-align: center;">Comprobante Autorizado Electrónicamente</div>
                            <div style="text-align: center; margin: 6px 0;">
                                <img src="https://quickchart.io/qr?text=${encodeURIComponent(qrText || `https://www.afip.gob.ar/fe/qr/?p=${btoa(JSON.stringify({ fecha: fechaVenta.split(' ')[0], cuit: Number(cuitLocal.replace(/\\D/g, '') || 301234559), ptoVta: 1, tipoCmp: tipoComprobante.includes('A') ? 1 : 11, nroCmp: 1, importe: totalFinal, tipoDocRec: 99, nroDocRec: 0, tipoCodAut: 'E', codAut: Number(cae) || 0 }))}`)}&size=120" style="width: 120px; height: 120px; display: inline-block;" alt="QR AFIP" />
                            </div>
                            <div class="cae-info" style="font-size: 8pt; font-weight: 700; text-align: left; margin-top: 4px;">CUIT: ${cuitLocal}</div>
                            <div class="cae-info" style="font-size: 8pt; font-weight: 700; text-align: left;">Comprobante: ${tipoComprobante} Nro: ${nroComprobante}</div>
                            <div class="cae-info" style="font-size: 8pt; font-weight: 700; text-align: left;">CAE: ${cae}</div>
                            <div class="cae-info" style="font-size: 8pt; font-weight: 700; text-align: left;">Vto. CAE: ${caeVto}</div>
                        </div>
                    ` : ''}

                    <div class="ticket-footer">
                        <div class="payment-method">FORMA DE PAGO: ${metodoPago}</div>
                        <span class="msg-pie">${mensajePie}</span>
                        <div class="powered">BAEZPOS v3.5 - POWERED BY BAEZ ALEXANDER</div>
                    </div>
                </div>
            </body>
        </html>
    `;

    imprimirHTMLConIframe(htmlTicket);
}

/**
 * Generador formal de Factura / Documento Fiscal A4 Tabular para el Historial.
 */
function generarFacturaA4HTML(venta) {
    if (!venta) return { html: '', qrText: '' };

    const infoEmpresa = (typeof DATOS_EMPRESA !== 'undefined' && DATOS_EMPRESA !== null) ? DATOS_EMPRESA : {};
    const fiscalActivo = String(venta.isFiscal !== undefined ? venta.isFiscal : infoEmpresa.hasTaxData) === "true";

    const nombreLocal = escapeHtml(venta.companyName || infoEmpresa.name || 'MI NEGOCIO').toUpperCase();
    const direccionLocal = escapeHtml(venta.companyAddress || infoEmpresa.address || '');
    const telefonoLocal = escapeHtml(venta.companyPhone || infoEmpresa.phone || '');
    const emailLocal = escapeHtml(venta.companyEmail || infoEmpresa.email || '');
    const mensajePie = escapeHtml(venta.ticketMessage || infoEmpresa.ticketMessage || '¡Gracias por su compra!');

    const cuitLocal = venta.companyCuit || infoEmpresa.taxId || infoEmpresa.cuit || '';
    const iibbLocal = venta.companyIibb || infoEmpresa.iibb || '';
    const condicionIva = (venta.condicionIva || infoEmpresa.condicionIva || 'RESPONSABLE MONOTRIBUTO').toUpperCase();

    let inicioActividades = venta.inicioActividades || infoEmpresa.inicioActividades || infoEmpresa.inicioAct || '';
    if (inicioActividades && inicioActividades.includes('-')) {
        const parts = inicioActividades.split('-');
        if (parts.length === 3) inicioActividades = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    const tipoComprobante = (venta.invoiceType || infoEmpresa.tipoComprobante || (fiscalActivo ? 'FACTURA C' : 'DOCUMENTO NO FISCAL')).toUpperCase();

    let letra = 'C';
    let codigoComprobante = 'COD. 011';
    if (tipoComprobante.includes('FACTURA A') || tipoComprobante.includes('NOTA DE DÉBITO A') || tipoComprobante.includes('NOTA DE CRÉDITO A')) {
        letra = 'A';
        codigoComprobante = 'COD. 001';
    } else if (tipoComprobante.includes('FACTURA B') || tipoComprobante.includes('NOTA DE DÉBITO B') || tipoComprobante.includes('NOTA DE CRÉDITO B')) {
        letra = 'B';
        codigoComprobante = 'COD. 006';
    } else if (tipoComprobante.includes('FACTURA C') || tipoComprobante.includes('NOTA DE DÉBITO C') || tipoComprobante.includes('NOTA DE CRÉDITO C')) {
        letra = 'C';
        codigoComprobante = 'COD. 011';
    } else {
        letra = 'X';
        codigoComprobante = 'DOC. NO FISCAL';
    }

    const cae = venta.cae || '';
    const caeVto = venta.caeExpiration || venta.caeVto || '';

    const nroComprobante = venta.invoiceNumber || venta.nroComprobante || `00001-${String(venta.numeroTicket || venta.id || 1).padStart(8, '0')}`;
    const fechaVenta = venta.saleDate ? new Date(venta.saleDate).toLocaleString('es-AR') : new Date().toLocaleString('es-AR');
    const cajeroNombre = escapeHtml(venta.sellerName || venta.userName || venta.cashierName || 'Admin').toUpperCase();
    const metodoPago = (venta.paymentMethod || 'EFECTIVO').replace(/_/g, ' ').toUpperCase();

    const nombreCliente = escapeHtml((venta.clienteNombre || 'CONSUMIDOR FINAL').toUpperCase());
    const cuitCliente = venta.clienteCuit || '';

    const recargoMonto = parseFloat(venta.surcharge) || 0;
    const recargoPorcentaje = parseFloat(venta.surchargeRate) || 0;
    const descuentoMonto = parseFloat(venta.discount) || 0;
    const totalFinal = parseFloat(venta.total) || 0;
    const subtotalProductos = (totalFinal - recargoMonto) + descuentoMonto;

    let qrText = '';
    if (cae) {
        const cuitLimpio = cuitLocal.replace(/\D/g, '');
        const cuitClienteLimpio = cuitCliente.replace(/\D/g, '');
        const numeroComprobanteEntero = nroComprobante.includes('-')
            ? parseInt(nroComprobante.split('-')[1], 10)
            : (venta.numeroTicket || venta.id || 1);

        const datosQr = {
            ver: 1,
            fecha: fechaVenta.split(' ')[0],
            cuit: Number(cuitLimpio || 301234559),
            ptoVta: 1,
            tipoCmp: tipoComprobante.includes('A') ? 1 : 11,
            nroCmp: numeroComprobanteEntero,
            importe: totalFinal,
            moneda: "ARS",
            ctz: 1,
            tipoDocRec: cuitClienteLimpio ? 80 : 99,
            nroDocRec: cuitClienteLimpio ? Number(cuitClienteLimpio) : 0,
            tipoCodAut: "E",
            codAut: Number(cae) || 0
        };
        try {
            qrText = `https://www.afip.gob.ar/fe/qr/?p=${btoa(JSON.stringify(datosQr))}`;
        } catch(e) {
            qrText = '';
        }
    }

    const itemsHTML = venta.items ? venta.items.map(function mapItemA4(item) {
        const subtotalItem = item.subtotal !== undefined
            ? item.subtotal
            : ((item.price || item.unitPrice || item.precio || 0) * (item.quantity || item.cantidad || 1));
        const unitPrice = (item.price || item.unitPrice || item.precio || 0);
        const cantidadVal = item.quantity !== undefined ? item.quantity : (item.cantidad !== undefined ? item.cantidad : 1);
        const isFractionalVal = Boolean(
            item.isFractional ||
            item.fraccionable ||
            item.unitType === 'KG' ||
            item.unit === 'KG' ||
            (item.product && (item.product.isFractional || item.product.fraccionable)) ||
            (item.producto && (item.producto.isFractional || item.producto.fraccionable)) ||
            (!Number.isInteger(parseFloat(cantidadVal)))
        );
        const cantFormatted = (typeof window.fmtCantidadTicket === 'function')
            ? window.fmtCantidadTicket(cantidadVal, isFractionalVal)
            : (cantidadVal + (isFractionalVal ? ' Kg' : ' un'));

        return `
            <tr>
                <td style="text-align: center; font-weight: 700; border: 1px solid #cbd5e1; padding: 6px 8px;">${cantFormatted}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px 8px;"><strong>${escapeHtml(item.productName || item.nombre || item.name || '').toUpperCase()}</strong></td>
                <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px 8px;">$${window.fmtPrecioTicket ? window.fmtPrecioTicket(unitPrice) : unitPrice.toFixed(2)}</td>
                <td style="text-align: right; font-weight: 700; border: 1px solid #cbd5e1; padding: 6px 8px;">$${window.fmtPrecioTicket ? window.fmtPrecioTicket(subtotalItem) : subtotalItem.toFixed(2)}</td>
            </tr>
        `;
    }).join('') : '<tr><td colspan="4" style="text-align: center; color: #64748b; padding: 12px;">Sin productos detallados</td></tr>';

    const htmlA4 = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Factura ${nroComprobante}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
                @page {
                    size: A4 portrait;
                    margin: 8mm;
                }
                * { box-sizing: border-box; }
                body {
                    font-family: 'Inter', system-ui, -apple-system, sans-serif;
                    color: #0f172a;
                    background: #ffffff;
                    margin: 0;
                    padding: 0;
                    font-size: 9pt;
                    line-height: 1.35;
                }
                .layout-a4 {
                    width: 100%;
                    max-width: 194mm;
                    margin: 0 auto;
                    padding: 0;
                }
                .a4-header {
                    display: flex;
                    border: 1.5px solid #0f172a;
                    border-radius: 6px;
                    position: relative;
                    margin-bottom: 8px;
                    background: #ffffff;
                }
                .a4-col-empresa {
                    flex: 1;
                    padding: 10px 14px;
                    border-right: 1px solid #cbd5e1;
                }
                .a4-empresa-nombre {
                    font-size: 13pt;
                    font-weight: 800;
                    color: #0f172a;
                    margin: 0 0 4px 0;
                    text-transform: uppercase;
                    letter-spacing: -0.2px;
                }
                .a4-line {
                    font-size: 8.5pt;
                    color: #334155;
                    margin-bottom: 2px;
                }
                .a4-box-letra {
                    position: absolute;
                    top: 0;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 44px;
                    height: 48px;
                    background: #ffffff;
                    border: 1.5px solid #0f172a;
                    border-top: none;
                    border-radius: 0 0 6px 6px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    z-index: 10;
                }
                .a4-letra {
                    font-size: 18pt;
                    font-weight: 900;
                    color: #0f172a;
                    line-height: 1;
                }
                .a4-letra-cod {
                    font-size: 6pt;
                    font-weight: 700;
                    color: #475569;
                }
                .a4-col-comprobante {
                    flex: 1;
                    padding: 10px 14px 10px 28px;
                    text-align: right;
                }
                .a4-comp-titulo {
                    font-size: 12pt;
                    font-weight: 800;
                    color: #0f172a;
                    margin: 0 0 3px 0;
                    text-transform: uppercase;
                }
                .a4-comp-numero {
                    font-size: 11pt;
                    font-weight: 800;
                    color: #2563eb;
                    margin-bottom: 4px;
                }
                .a4-cliente-box {
                    border: 1.5px solid #0f172a;
                    border-radius: 6px;
                    padding: 8px 12px;
                    margin-bottom: 8px;
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                    background: #f8fafc;
                }
                .a4-row-split {
                    display: flex;
                    justify-content: space-between;
                    font-size: 8.5pt;
                }
                .a4-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 8px;
                    font-size: 8.5pt;
                }
                .a4-table th {
                    background: #0f172a;
                    color: #ffffff !important;
                    font-weight: 700;
                    padding: 6px 8px;
                    text-align: left;
                    border: 1px solid #0f172a;
                }
                .a4-table td {
                    padding: 6px 8px;
                    border: 1px solid #cbd5e1;
                    vertical-align: middle;
                }
                .a4-table tbody tr:nth-child(even) {
                    background: #f8fafc;
                }
                .a4-totales-container {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 16px;
                    margin-bottom: 8px;
                }
                .a4-obs-box {
                    flex: 1;
                    border: 1px dashed #94a3b8;
                    border-radius: 6px;
                    padding: 8px 10px;
                    font-size: 8pt;
                    color: #475569;
                }
                .a4-totales-box {
                    width: 260px;
                    border: 1.5px solid #0f172a;
                    border-radius: 6px;
                    overflow: hidden;
                }
                .a4-tot-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 4px 10px;
                    font-size: 8.5pt;
                    border-bottom: 1px solid #e2e8f0;
                }
                .a4-tot-row.final {
                    background: #0f172a;
                    color: #ffffff !important;
                    font-weight: 800;
                    font-size: 11pt;
                    border-bottom: none;
                    padding: 6px 10px;
                }
                .a4-tot-row.final * {
                    color: #ffffff !important;
                }
                .a4-fiscal-footer {
                    border: 1.5px solid #0f172a;
                    border-radius: 6px;
                    padding: 8px 12px;
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    margin-top: 6px;
                    background: #ffffff;
                }
                .a4-qr-img {
                    width: 100px;
                    height: 100px;
                    display: block;
                }
                .a4-cae-data {
                    flex: 1;
                    font-size: 8.5pt;
                }
                .a4-cae-title {
                    font-weight: 800;
                    font-size: 9.5pt;
                    letter-spacing: 0.5px;
                    margin-bottom: 3px;
                }
            </style>
        </head>
        <body class="layout-a4">
            <div class="layout-a4">
                <div class="a4-header">
                    <div class="a4-col-empresa">
                        <div class="a4-empresa-nombre">${nombreLocal}</div>
                        ${direccionLocal ? `<div class="a4-line">${direccionLocal}</div>` : ''}
                        ${telefonoLocal ? `<div class="a4-line">Tel: ${telefonoLocal}</div>` : ''}
                        ${emailLocal ? `<div class="a4-line">Email: ${emailLocal}</div>` : ''}
                        <div class="a4-line" style="font-weight: 700; margin-top: 3px;">IVA: ${condicionIva}</div>
                    </div>

                    <div class="a4-box-letra">
                        <div class="a4-letra">${letra}</div>
                        <div class="a4-letra-cod">${codigoComprobante}</div>
                    </div>

                    <div class="a4-col-comprobante">
                        <div class="a4-comp-titulo">${tipoComprobante}</div>
                        <div class="a4-comp-numero">N° ${nroComprobante}</div>
                        <div class="a4-line">Fecha de Emisión: <strong>${fechaVenta}</strong></div>
                        <div class="a4-line">CUIT: <strong>${cuitLocal || 'S/C'}</strong></div>
                        <div class="a4-line">Ingresos Brutos: <strong>${iibbLocal || 'Exento / S/C'}</strong></div>
                        <div class="a4-line">Inicio de Actividades: <strong>${inicioActividades || '-'}</strong></div>
                    </div>
                </div>

                <div class="a4-cliente-box">
                    <div class="a4-row-split">
                        <div><strong>Razón Social / Cliente:</strong> ${nombreCliente}</div>
                        <div><strong>CUIT / DNI:</strong> ${cuitCliente || 'Consumidor Final'}</div>
                    </div>
                    <div class="a4-row-split">
                        <div><strong>Condición IVA:</strong> ${cuitCliente ? 'IVA Responsable Inscripto / Monotributo' : 'Consumidor Final'}</div>
                        <div><strong>Condición de Venta:</strong> ${metodoPago}</div>
                        <div><strong>Cajero/a:</strong> ${cajeroNombre}</div>
                    </div>
                </div>

                <table class="a4-table">
                    <thead>
                        <tr>
                            <th style="width: 12%; text-align: center;">CANT.</th>
                            <th style="width: 53%;">DESCRIPCIÓN</th>
                            <th style="width: 17%; text-align: right;">P. UNITARIO</th>
                            <th style="width: 18%; text-align: right;">SUBTOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHTML}
                    </tbody>
                </table>

                <div class="a4-totales-container">
                    <div class="a4-obs-box">
                        <strong>Observaciones / Leyenda:</strong><br>
                        ${mensajePie}<br>
                        <span style="opacity: 0.7; font-size: 7.5pt; display: block; margin-top: 6px;">Documento generado a través de BÁEZ POS SaaS Platform.</span>
                    </div>
                    <div class="a4-totales-box">
                        ${descuentoMonto > 0 ? `
                            <div class="a4-tot-row" style="color: #dc2626;">
                                <span>Descuento:</span>
                                <span>-$${window.fmtPrecioTicket ? window.fmtPrecioTicket(descuentoMonto) : descuentoMonto.toFixed(2)}</span>
                            </div>
                        ` : ''}
                        ${recargoMonto > 0 ? `
                            <div class="a4-tot-row" style="color: #d97706;">
                                <span>Recargo (${recargoPorcentaje}%):</span>
                                <span>+$${window.fmtPrecioTicket ? window.fmtPrecioTicket(recargoMonto) : recargoMonto.toFixed(2)}</span>
                            </div>
                        ` : ''}
                        <div class="a4-tot-row final">
                            <span>TOTAL FINAL:</span>
                            <span>$${window.fmtPrecioTicket ? window.fmtPrecioTicket(totalFinal) : totalFinal.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                ${cae ? `
                    <div class="a4-fiscal-footer">
                        <div>
                            <img class="a4-qr-img" src="https://quickchart.io/qr?text=${encodeURIComponent(qrText || `https://www.afip.gob.ar/fe/qr/?p=${btoa(JSON.stringify({ fecha: fechaVenta.split(' ')[0], cuit: Number(cuitLocal.replace(/\\D/g, '') || 301234559), ptoVta: 1, tipoCmp: tipoComprobante.includes('A') ? 1 : 11, nroCmp: 1, importe: totalFinal, tipoDocRec: 99, nroDocRec: 0, tipoCodAut: 'E', codAut: Number(cae) || 0 }))}`)}&size=140" alt="QR AFIP" />
                        </div>
                        <div class="a4-cae-data">
                            <div class="a4-cae-title">ARCA / AFIP - Comprobante Autorizado Electrónicamente</div>
                            <div><strong>CAE N°:</strong> ${cae}</div>
                            <div><strong>Fecha de Vto. de CAE:</strong> ${caeVto}</div>
                            <div style="font-size: 7.5pt; color: #475569; margin-top: 3px;">Comprobante oficial válido como factura comercial. Verifique su autenticidad escaneando el código QR.</div>
                        </div>
                    </div>
                ` : ''}
            </div>
        </body>
        </html>
    `;

    return {
        html: htmlA4,
        qrText: qrText
    };
}

function reimprimirFacturaA4() {
    if (!VENTA_SELECCIONADA) return;
    const plantilla = generarFacturaA4HTML(VENTA_SELECCIONADA);
    imprimirHTMLConIframe(plantilla.html);
}

// Exposición global
window.reimprimirTicket = reimprimirTicket;
window.reimprimirFacturaA4 = reimprimirFacturaA4;
window.generarFacturaA4HTML = generarFacturaA4HTML;
window.imprimirHTMLConIframe = imprimirHTMLConIframe;