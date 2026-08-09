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
    // Generar formato YYYY-MM-DD considerando la zona horaria local (AR)
    const hoyLocal = new Date().toLocaleDateString('sv-SE'); // 'sv-SE' devuelve exactamente YYYY-MM-DD local

    const fechaDesdeEl = document.getElementById('fechaDesde');
    const fechaHastaEl = document.getElementById('fechaHasta');

    if (fechaDesdeEl && !fechaDesdeEl.value) fechaDesdeEl.value = hoyLocal;
    if (fechaHastaEl && !fechaHastaEl.value) fechaHastaEl.value = hoyLocal;

    // Carga de la información del perfil del negocio
    await cargarInfoEmpresa();

    // Carga inicial de ventas del día
    await cargarVentas();
});

async function cargarInfoEmpresa() {
    try {
        const resp = await apiFetch('/admin/my-company/profile');
        if (resp.ok) {
            DATOS_EMPRESA = await resp.json();
            console.log("Datos de empresa cargados para el ticket:", DATOS_EMPRESA);
        }
    } catch (err) {
        console.error("No se pudo cargar la info de la empresa para el ticket", err);
    }
}

// ==========================================
// 3. CARGA DE DATOS Y FILTRADO (API FETCH)
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
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center p-5 text-muted"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Buscando transacciones...</td></tr>';

        // Enviar parámetros con rango amplio de fin de día para evitar pérdida por hora/UTC
        const res = await apiFetch(`/sales?desde=${desde}&hasta=${hasta}`);
        if (!res.ok) throw new Error("Error al obtener el historial");

        const ventas = await res.json();

        // Asignación segura garantizando que sea un Array
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
        ventasFiltradas = VENTAS_GLOBALES.filter(v => {
            const m = v.paymentMethod || 'EFECTIVO';
            return m === metodo;
        });
    }

    renderizarTabla(ventasFiltradas);
    calcularResumenVisto(ventasFiltradas);
}

// ==========================================
// 4. RENDERIZADO DE TABLA PROFESIONAL
// ==========================================
function renderizarTabla(ventas) {
    const tbody = document.getElementById('listaVentas');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!ventas || ventas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center p-5 text-muted">No se encontraron ventas en este período.</td></tr>';
        return;
    }

    ventas.sort((a, b) => b.id - a.id).forEach(v => {
        const estaAnulada = v.status === "ANULADA" || v.canceled;

        let iconClass = "bi-cash text-success";
        let metodoNombre = v.paymentMethod || 'EFECTIVO';

        if (v.paymentMethod === 'TRANSFERENCIA') {
            iconClass = "bi-phone text-primary";
        } else if (v.paymentMethod === 'CUENTA_CORRIENTE') {
            iconClass = "bi-journal-bookmark text-warning";
            metodoNombre = "LIBRETA";
        }

        const tr = document.createElement('tr');
        if (estaAnulada) tr.classList.add('status-anulada');

        tr.innerHTML = `
            <td class="ps-4"><span class="fw-bold">#${v.id}</span></td>
            <td class="text-muted small">${new Date(v.saleDate).toLocaleString('es-AR')}</td>
            <td>
                <div class="fw-bold">${v.customerName || 'Consumidor Final'}</div>
                <small class="text-muted text-truncate" style="max-width: 150px; display:block;">
                    ${(v.items || []).map(i => i.productName || i.nombre || '').join(", ")}
                </small>
            </td>
            <td>
                <span class="badge bg-light text-dark border px-2 py-1">
                    <i class="bi ${iconClass} me-1"></i> ${metodoNombre}
                </span>
            </td>
            <td class="text-end text-danger">-$${(v.discount || 0).toFixed(2)}</td>
            <td class="text-end fw-bold">$${(v.total || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
            <td class="text-center">
                <button class="btn btn-sm btn-light" onclick="verDetalle(${v.id})"><i class="bi bi-eye"></i></button>
                <button class="btn btn-sm btn-light" onclick="confirmarAnulacion(${v.id})" ${estaAnulada ? 'disabled' : ''}><i class="bi bi-trash text-danger"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================
// 5. LÓGICA DE ANULACIÓN
// ==========================================
async function confirmarAnulacion(id) {
    const result = await Swal.fire({
        title: `¿Anular venta #${id}?`,
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
            // ✅ Ruta relativa directa procesada por apiFetch
            const res = await apiFetch(`/sales/${id}/cancel`, {
                method: 'PUT'
            });

            if (res.ok) {
                Swal.fire('Venta Anulada', 'El stock ha sido restaurado.', 'success');
                cargarVentas();
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
// HELPER GLOBAL DE FORMATEO DE CANTIDAD Y PESO
// ==========================================
function fmtCantidadGlobal(item) {
    const qty = parseFloat(item.quantity || item.cantidad || 1);
    const nombreProd = (item.productName || item.nombre || '').toUpperCase();

    // Palabras clave comunes para detectar productos pesables si el backend/objeto no envía el flag explícito
    const palabrasPesables = ['PAN', 'QUESO', 'CARNE', 'POLLO', 'ASADO', 'FIAMBRE', 'PALETA', 'JAMON', 'MILANESA', 'FRUTA', 'VERDURA', 'VERDURAS', 'FRUTAS', 'KG', 'KILO'];
    const coincideNombre = palabrasPesables.some(p => nombreProd.includes(p));

    // Detección robusta de producto pesable/fraccionado
    const esFraccionado = Boolean(
        item.isFractional ||
        item.unitOfMeasure === 'KG' ||
        item.unitOfMeasure === 'GRAM' ||
        item.unitType === 'KG' ||
        coincideNombre ||
        (qty % 1 !== 0) // Tiene decimales (ej: 0.5, 1.250)
    );

    if (esFraccionado) {
        if (qty < 1 && qty > 0) {
            const gramos = Math.round(qty * 1000);
            return `${gramos} gr`;
        }
        const qtyFormatted = qty.toLocaleString('es-AR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 3
        });
        return `${qtyFormatted} Kg`;
    }

    return `${qty} un.`;
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

    setSafeText('txtIdVenta', venta.id);

    const container = document.getElementById('contenedorItems');
    if (container) {
        container.innerHTML = '';
        let sumaSubtotales = 0;
        (venta.items || []).forEach(item => {
            const cant = parseFloat(item.quantity || item.cantidad || 1);
            const prec = parseFloat(item.price || item.precio || 0);
            const subtotalItem = item.subtotal !== undefined ? parseFloat(item.subtotal) : (prec * cant);
            sumaSubtotales += subtotalItem;

            const cantTexto = fmtCantidadGlobal(item);

            const itemDiv = document.createElement('div');
            itemDiv.className = "d-flex justify-content-between align-items-center mb-2 border-bottom pb-2";
            itemDiv.innerHTML = `
                <div style="flex: 1;">
                    <span class="fw-bold text-uppercase" style="font-size: 12px;">${item.productName || item.nombre || 'PRODUCTO'}</span><br>
                    <small class="text-muted">${cantTexto} x $${prec.toLocaleString('es-AR', {minimumFractionDigits: 2})}</small>
                </div>
                <div class="fw-bold">$${subtotalItem.toLocaleString('es-AR', {minimumFractionDigits: 2})}</div>
            `;
            container.appendChild(itemDiv);
        });

        const descuento = parseFloat(venta.discount) || 0;
        const recargo = parseFloat(venta.surcharge) || 0;

        setSafeText('txtSubtotalModal', `$${sumaSubtotales.toLocaleString('es-AR', {minimumFractionDigits: 2})}`);
        setSafeText('txtDescuentoModal', `-$${descuento.toLocaleString('es-AR', {minimumFractionDigits: 2})}`);

        const elRecargo = document.getElementById('txtRecargoModal');
        if (elRecargo) {
            elRecargo.innerText = `+$${recargo.toLocaleString('es-AR', {minimumFractionDigits: 2})}`;
        }

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
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    }
}

// ==========================================
// 7. RESUMEN SUPERIOR (CARDS - SEPARACIÓN CAJA REAL VS LIBRETA)
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
                totalLib += montoTotal; // Fiado otorgado
            } else {
                totalEfe += montoTotal;
            }
        }
    });

    const totalCajaReal = totalEfe + totalTra;
    const totalMontoVendido = totalEfe + totalTra + totalLib;

    const fmt = (val) => `$${val.toLocaleString('es-AR', {minimumFractionDigits: 2})}`;

    if (document.getElementById('resumenEfectivo'))
        document.getElementById('resumenEfectivo').innerText = fmt(totalEfe);

    if (document.getElementById('resumenTransf'))
        document.getElementById('resumenTransf').innerText = fmt(totalTra);

    if (document.getElementById('resumenLibreta'))
        document.getElementById('resumenLibreta').innerText = fmt(totalLib);

    // Muestra lo recaudado realmente en caja (Efectivo + Transferencia)
    if (document.getElementById('resumenTotalCaja'))
        document.getElementById('resumenTotalCaja').innerText = fmt(totalCajaReal);

    // Muestra el volumen total vendido en el período (incluyendo fiado)
    if (document.getElementById('resumenVentaTotal'))
        document.getElementById('resumenVentaTotal').innerText = fmt(totalMontoVendido);
}

// ==========================================
// 8. REPORTES ROBUSTOS (PDF Y EXCEL DESGLOSADOS POR PRODUCTO)
// ==========================================

function obtenerVentasParaExportar() {
    const filtroEl = document.getElementById('filtroMetodo');
    const metodo = filtroEl ? filtroEl.value : "TODOS";

    return VENTAS_GLOBALES.filter(v => {
        if (v.status === "ANULADA" || v.canceled) return false;
        if (metodo !== "TODOS") {
            const m = v.paymentMethod || 'EFECTIVO';
            return m === metodo;
        }
        return true;
    });
}

function exportarPDF() {
    const ventasAExportar = obtenerVentasParaExportar();

    if (ventasAExportar.length === 0) {
        Swal.fire('Sin datos', 'No hay ventas activas para exportar en el rango seleccionado.', 'info');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    let totalEfectivo = 0;
    let totalTransferencia = 0;
    let totalLibreta = 0;
    let sumaDescuentos = 0;
    let sumaRecargos = 0;
    const filas = [];

    ventasAExportar.forEach(v => {
        const desc = parseFloat(v.discount) || 0;
        const rec = parseFloat(v.surcharge) || 0;
        const totalVenta = parseFloat(v.total) || 0;

        sumaDescuentos += desc;
        sumaRecargos += rec;

        if (v.paymentMethod === 'TRANSFERENCIA') {
            totalTransferencia += totalVenta;
        } else if (v.paymentMethod === 'CUENTA_CORRIENTE') {
            totalLibreta += totalVenta;
        } else {
            totalEfectivo += totalVenta;
        }

        const items = v.items || [];
        const fechaFmt = new Date(v.saleDate).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });

        if (items.length === 0) {
            filas.push([
                `#${v.id}`,
                fechaFmt,
                v.customerName || v.clienteNombre || 'Consumidor Final',
                'SIN DETALLE DE PRODUCTOS',
                '1 un.',
                `$${totalVenta.toLocaleString('es-AR', {minimumFractionDigits: 2})}`,
                `$${totalVenta.toLocaleString('es-AR', {minimumFractionDigits: 2})}`,
                v.paymentMethod === 'CUENTA_CORRIENTE' ? 'LIBRETA' : (v.paymentMethod || 'EFECTIVO')
            ]);
        } else {
            items.forEach((item, index) => {
                const cant = parseFloat(item.quantity || item.cantidad || 1);
                const prec = parseFloat(item.price || item.precio || 0);
                const subtotalItem = item.subtotal !== undefined ? parseFloat(item.subtotal) : (cant * prec);

                filas.push([
                    index === 0 ? `#${v.id}` : "",
                    index === 0 ? fechaFmt : "",
                    index === 0 ? (v.customerName || v.clienteNombre || 'Consumidor Final') : "",
                    (item.productName || item.nombre || 'PRODUCTO').toUpperCase(),
                    fmtCantidadGlobal(item),
                    `$${prec.toLocaleString('es-AR', {minimumFractionDigits: 2})}`,
                    `$${subtotalItem.toLocaleString('es-AR', {minimumFractionDigits: 2})}`,
                    index === 0 ? (v.paymentMethod === 'CUENTA_CORRIENTE' ? 'LIBRETA' : (v.paymentMethod || 'EFECTIVO')) : ""
                ]);
            });
        }
    });

    const fechaDesde = document.getElementById('fechaDesde') ? document.getElementById('fechaDesde').value : '';
    const fechaHasta = document.getElementById('fechaHasta') ? document.getElementById('fechaHasta').value : '';

    // Encabezado del PDF
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(0, 0, 210, 38, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text("BaezPOS - Reporte Detallado de Ventas", 14, 18);
    doc.setFontSize(9);
    doc.text(`Rango auditado: Desde ${fechaDesde} hasta ${fechaHasta}`, 14, 27);
    doc.text(`Total operaciones auditadas: ${ventasAExportar.length} ventas`, 14, 33);

    // Tabla con autoTable
    doc.autoTable({
        startY: 42,
        head: [['ID', 'FECHA', 'CLIENTE', 'PRODUCTO', 'CANT', 'P. UNIT', 'SUBTOTAL', 'PAGO']],
        body: filas,
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 7, cellPadding: 2 },
        columnStyles: {
            0: { cellWidth: 12 },
            1: { cellWidth: 26 },
            2: { cellWidth: 28 },
            3: { cellWidth: 'auto' },
            4: { cellWidth: 16, halign: 'center' },
            5: { cellWidth: 20, halign: 'right' },
            6: { cellWidth: 22, halign: 'right' },
            7: { cellWidth: 22, halign: 'center' }
        },
        margin: { top: 42, bottom: 20 }
    });

    // Resumen Financiero en PDF
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

    doc.setTextColor(217, 119, 6); // Naranja
    doc.text(`( ) Deuda Pendiente en Libreta (Fiados): $${totalLibreta.toLocaleString('es-AR', {minimumFractionDigits: 2})} (incluye $${sumaRecargos.toLocaleString('es-AR', {minimumFractionDigits: 2})} de recargos)`, 14, actualY + 18);

    doc.setTextColor(220, 38, 38); // Rojo
    doc.text(`(-) Total Descuentos Aplicados: $${sumaDescuentos.toLocaleString('es-AR', {minimumFractionDigits: 2})}`, 14, actualY + 24);

    doc.setFontSize(12);
    doc.setTextColor(37, 99, 235);
    doc.setFont(undefined, 'bold');
    doc.text(`TOTAL RECAUDADO EN CAJA (EFE + TRA): $${(totalEfectivo + totalTransferencia).toLocaleString('es-AR', {minimumFractionDigits: 2})}`, 14, actualY + 34);

    doc.save(`Reporte_Ventas_Productos_${fechaDesde}_al_${fechaHasta}.pdf`);
}

function exportarExcelPro() {
    const ventasAExportar = obtenerVentasParaExportar();

    if (ventasAExportar.length === 0) {
        Swal.fire('Atención', 'No hay datos activos para exportar en el rango seleccionado.', 'info');
        return;
    }

    let efe = 0;
    let tra = 0;
    let lib = 0;
    let descTot = 0;
    let recTot = 0;

    const dataExcel = [];

    // Mapeo detallado ÍTEM POR ÍTEM
    ventasAExportar.forEach(v => {
        const desc = parseFloat(v.discount) || 0;
        const rec = parseFloat(v.surcharge) || 0;
        const totalVenta = parseFloat(v.total) || 0;

        descTot += desc;
        recTot += rec;

        if (v.paymentMethod === 'TRANSFERENCIA') {
            tra += totalVenta;
        } else if (v.paymentMethod === 'CUENTA_CORRIENTE') {
            lib += totalVenta;
        } else {
            efe += totalVenta;
        }

        const items = v.items || [];

        if (items.length === 0) {
            dataExcel.push({
                "N° Venta": v.id,
                "Fecha / Hora": new Date(v.saleDate).toLocaleString('es-AR'),
                "Cliente": v.customerName || v.clienteNombre || 'Consumidor Final',
                "Producto": 'SIN DETALLE',
                "Cantidad / Peso": '1 un.',
                "Precio Unitario": totalVenta,
                "Subtotal Ítem": totalVenta,
                "Descuento Venta": desc,
                "Recargo Libreta": rec,
                "Total Venta": totalVenta,
                "Método de Pago": v.paymentMethod === 'CUENTA_CORRIENTE' ? 'LIBRETA' : (v.paymentMethod || 'EFECTIVO')
            });
        } else {
            items.forEach((item) => {
                const cant = parseFloat(item.quantity || item.cantidad || 1);
                const prec = parseFloat(item.price || item.precio || 0);
                const subt = item.subtotal !== undefined ? parseFloat(item.subtotal) : (cant * prec);

                dataExcel.push({
                    "N° Venta": v.id,
                    "Fecha / Hora": new Date(v.saleDate).toLocaleString('es-AR'),
                    "Cliente": v.customerName || v.clienteNombre || 'Consumidor Final',
                    "Producto": (item.productName || item.nombre || 'PRODUCTO').toUpperCase(),
                    "Cantidad / Peso": fmtCantidadGlobal(item),
                    "Precio Unitario": prec,
                    "Subtotal Ítem": subt,
                    "Descuento Venta": desc,
                    "Recargo Libreta": rec,
                    "Total Venta": totalVenta,
                    "Método de Pago": v.paymentMethod === 'CUENTA_CORRIENTE' ? 'LIBRETA' : (v.paymentMethod || 'EFECTIVO')
                });
            });
        }
    });

    const fechaDesde = document.getElementById('fechaDesde') ? document.getElementById('fechaDesde').value : '';
    const fechaHasta = document.getElementById('fechaHasta') ? document.getElementById('fechaHasta').value : '';

    // Filas de Resumen Final
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
        { wch: 10 },
        { wch: 18 },
        { wch: 22 },
        { wch: 35 },
        { wch: 16 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 16 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Detalle de Productos");
    XLSX.writeFile(wb, `Planilla_Ventas_Productos_${fechaDesde}_al_${fechaHasta}.xlsx`);
}

// ==========================================
// 9. REIMPRESIÓN DE TICKET TÉRMICO (100% ALINEADO A POS 58mm)
// ==========================================
function reimprimirTicket() {
    if (!VENTA_SELECCIONADA) return;

    const venta = VENTA_SELECCIONADA;
    const ventana = window.open('', 'PRINT', 'height=700,width=400');

    if (!ventana) {
        Swal.fire({ icon: 'warning', title: 'Popup bloqueado', text: 'Permití las ventanas emergentes.' });
        return;
    }

    const infoEmpresa = (typeof DATOS_EMPRESA !== 'undefined' && DATOS_EMPRESA !== null) ? DATOS_EMPRESA : {};
    const fiscalActivo = String(venta.isFiscal !== undefined ? venta.isFiscal : infoEmpresa.hasTaxData) === "true";

    const nombreLocal = (venta.companyName || infoEmpresa.name || 'MI NEGOCIO').toUpperCase();
    const direccionLocal = venta.companyAddress || infoEmpresa.address || '';
    const telefonoLocal = venta.companyPhone || infoEmpresa.phone || '';
    const emailLocal = venta.companyEmail || infoEmpresa.email || '';
    const mensajePie = venta.ticketMessage || infoEmpresa.ticketMessage || '¡Gracias por su compra!';

    const cuitLocal = venta.companyCuit || infoEmpresa.taxId || infoEmpresa.cuit || '';
    const iibbLocal = venta.companyIibb || infoEmpresa.iibb || '';
    const condicionIva = (venta.condicionIva || infoEmpresa.condicionIva || 'RESPONSABLE MONOTRIBUTO').toUpperCase();

    let inicioActividades = venta.inicioActividades || infoEmpresa.inicioActividades || infoEmpresa.inicioAct || '';
    if (inicioActividades && inicioActividades.includes('-')) {
        const parts = inicioActividades.split('-');
        if (parts.length === 3) {
            inicioActividades = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
    }

    const tipoComprobante = fiscalActivo
        ? (venta.tipoComprobante || infoEmpresa.tipoComprobante || 'FACTURA C').toUpperCase()
        : (venta.tipoComprobante || 'TICKET INTERNO');

    const cae = venta.cae || '';
    const caeVto = venta.caeVto || '';

    const nroComprobante = venta.nroComprobante || `00001-${String(venta.id || 1).padStart(8, '0')}`;
    const fechaVenta = venta.saleDate ? new Date(venta.saleDate).toLocaleString('es-AR') : new Date().toLocaleString('es-AR');
    let metodoPago = (venta.paymentMethod || 'EFECTIVO').replace(/_/g, ' ').toUpperCase();
    if (metodoPago === 'CUENTA CORRIENTE') metodoPago = 'LIBRETA';

    const nombreCliente = (venta.customerName || venta.clienteNombre || 'CONSUMIDOR FINAL').toUpperCase();
    const cuitCliente = venta.clienteCuit || venta.customerCuit || '';

    // Parseo seguro de montos
    const recargoMonto = parseFloat(venta.surcharge) || 0;
    const recargoPorcentaje = parseFloat(venta.surchargeRate) || 0;
    const descuentoMonto = parseFloat(venta.discount) || 0;
    const totalFinal = parseFloat(venta.total) || 0;
    const subtotalProductos = (totalFinal - recargoMonto) + descuentoMonto;

    let qrText = '';
    if (fiscalActivo && cae) {
        const cuitLimpio = cuitLocal.replace(/\D/g, '');
        const cuitClienteLimpio = cuitCliente.replace(/\D/g, '');

        const datosQr = {
            ver: 1,
            fecha: fechaVenta.split(' ')[0],
            cuit: Number(cuitLimpio),
            ptoVta: 1,
            tipoCmp: tipoComprobante.includes('A') ? 1 : 11,
            nroCmp: venta.id || 1,
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

    // Formateador de cantidades
    const fmtCantidadTicket = (item) => {
        const cantStr = typeof fmtCantidadGlobal === 'function' ? fmtCantidadGlobal(item) : `${item.quantity || item.cantidad || 1} un.`;
        return cantStr.endsWith('un.') ? `${parseFloat(item.quantity || item.cantidad || 1)} ` : `${cantStr} `;
    };

    ventana.document.write(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>Ticket #${venta.id || ''}</title>
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css">
                <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
                    @page { margin: 0; }
                    body { font-family: 'Inter', sans-serif; width: 58mm; padding: 8px; margin: 0; color: #0f172a; background: #fff; line-height: 1.25; }
                    .center { text-align: center; }
                    .ticket-header { border-bottom: 1px dashed #94a3b8; padding-bottom: 8px; margin-bottom: 8px; }
                    .shop-icon-container { display: flex; justify-content: center; align-items: center; margin-bottom: 4px; }
                    .shop-icon-container svg { width: 32px; height: 32px; fill: #3b82f6; }
                    .business-name { font-weight: 900; font-size: 14px; margin: 2px 0; text-transform: uppercase; letter-spacing: -0.2px; }
                    .small-info { font-size: 9.5px; color: #334155; margin: 1.5px 0; }
                    .fiscal-header { font-size: 8.5px; color: #334155; text-align: left; background: #f1f5f9; padding: 4px 6px; border-radius: 4px; margin-top: 5px; }
                    .item-row { display: flex; justify-content: space-between; align-items: flex-start; font-size: 10px; margin-bottom: 5px; word-break: break-word; }
                    .item-qty-name { font-weight: 700; text-transform: uppercase; flex: 1; padding-right: 6px; }
                    .item-price { font-weight: 700; white-space: nowrap; }
                    .line { border-top: 1px dashed #94a3b8; margin: 8px 0; }
                    .total-container { border-top: 2px solid #0f172a; margin-top: 8px; padding-top: 6px; display: flex; justify-content: space-between; align-items: center; }
                    .total-label { font-weight: 900; font-size: 15px; }
                    .total-amount { font-weight: 900; font-size: 15px; color: #0f172a; }
                    .arca-container { border-top: 1px solid #0f172a; margin-top: 10px; padding-top: 8px; text-align: center; }
                    .arca-logo { font-weight: 900; font-size: 11px; letter-spacing: 2px; }
                    .qr-box { display: flex; justify-content: center; margin: 6px 0; }
                    .cae-info { font-size: 8.5px; font-weight: 700; text-align: left; }
                    .ticket-footer { text-align: center; margin-top: 10px; border-top: 1px dashed #94a3b8; padding-top: 8px; }
                    .msg-pie { font-style: italic; font-size: 10px; color: #475569; margin-bottom: 6px; display: block; }
                    .payment-method { font-weight: 800; font-size: 9.5px; border: 1px solid #cbd5e1; padding: 3px 6px; display: inline-block; border-radius: 4px; margin-bottom: 6px; }
                    .powered { font-size: 7px; font-weight: 700; opacity: 0.5; margin-top: 6px; letter-spacing: 0.5px; }
                    .watermark-reprint { font-size: 8px; font-weight: 800; color: #475569; background: #f1f5f9; padding: 2px 4px; border-radius: 3px; display: inline-block; margin: 3px 0; border: 1px solid #cbd5e1; }
                </style>
            </head>
            <body>
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
                    <div class="small-info" style="text-align: left; margin-top: 4px;"><strong>A:</strong> ${nombreCliente} ${cuitCliente ? `(CUIT: ${cuitCliente})` : ''}</div>
                </div>

                <div class="ticket-body">
                    ${venta.items ? venta.items.map(item => {
                        const cant = parseFloat(item.quantity || item.cantidad || 1);
                        const prec = parseFloat(item.price || item.precio || 0);
                        const subtotalItem = item.subtotal !== undefined ? parseFloat(item.subtotal) : (prec * cant);
                        const prefijoCantidad = fmtCantidadTicket(item);
                        return `
                            <div class="item-row">
                                <span class="item-qty-name">${prefijoCantidad}${(item.productName || item.nombre || '').toUpperCase()}</span>
                                <span class="item-price">$${subtotalItem.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                            </div>
                        `;
                    }).join('') : ''}

                    ${descuentoMonto > 0 ? `
                        <div class="line"></div>
                        <div class="item-row" style="color: #dc3545;">
                            <span class="item-qty-name">DESCUENTO:</span>
                            <span class="item-price">-$${descuentoMonto.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                        </div>
                    ` : ''}

                    ${recargoMonto > 0 ? `
                        <div class="line"></div>
                        <div class="item-row" style="color: #64748b; font-size: 8.5px;">
                            <span class="item-qty-name">SUBTOTAL PRODUCTOS:</span>
                            <span class="item-price">$${subtotalProductos.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                        </div>
                        <div class="item-row" style="color: #d97706; font-weight: bold;">
                            <span class="item-qty-name">RECARGO LIBRETA (${recargoPorcentaje}%):</span>
                            <span class="item-price">+$${recargoMonto.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                        </div>
                    ` : ''}

                    <div class="total-container">
                        <span class="total-label">TOTAL</span>
                        <span class="total-amount">$${totalFinal.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                </div>

                ${(fiscalActivo && cae) ? `
                    <div class="arca-container">
                        <div class="arca-logo">ARCA / AFIP</div>
                        <div class="small-info" style="font-size: 8px;">Comprobante Autorizado Electrónicamente</div>
                        <div class="qr-box" id="qrcode"></div>
                        <div class="cae-info">CAE: ${cae}</div>
                        <div class="cae-info">Vto. CAE: ${caeVto}</div>
                    </div>
                ` : ''}

                <div class="ticket-footer">
                    <div class="payment-method">FORMA DE PAGO: ${metodoPago}</div>
                    <span class="msg-pie">${mensajePie}</span>
                    <div class="powered">BAEZPOS v3.5 - POWERED BY BAEZ ALEXANDER</div>
                </div>

                <script>
                    if (${Boolean(fiscalActivo && cae && qrText)}) {
                        try {
                            new QRCode(document.getElementById("qrcode"), {
                                text: "${qrText}",
                                width: 85,
                                height: 85,
                                colorDark : "#000000",
                                colorLight : "#ffffff",
                                correctLevel : QRCode.CorrectLevel.M
                            });
                        } catch(e) {}
                    }

                    setTimeout(() => {
                        window.print();
                        window.close();
                    }, 500);
                </script>
            </body>
        </html>
    `);
    ventana.document.close();
}