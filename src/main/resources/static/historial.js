// ==========================================
// 1. CONFIGURACIÓN Y VARIABLES GLOBALES
// ==========================================
const BACKEND_URL = 'https://baez-pos-saas.onrender.com';
const API_SALES = `${BACKEND_URL}/sales`;

let VENTA_SELECCIONADA = null;
let VENTAS_GLOBALES = [];
let DATOS_EMPRESA = null;

// ==========================================
// 2. INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    const d = new Date();
    const hoy = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

    if (document.getElementById('fechaDesde')) document.getElementById('fechaDesde').value = hoy;
    if (document.getElementById('fechaHasta')) document.getElementById('fechaHasta').value = hoy;

    // Carga de la información del perfil del negocio
    await cargarInfoEmpresa();

    // Carga inicial de ventas del día
    cargarVentas();
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

    const url = `${API_SALES}?desde=${desde}&hasta=${hasta}`;

    try {
        const tbody = document.getElementById('listaVentas');
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center p-5 text-muted"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Buscando transacciones...</td></tr>';

        const res = await apiFetch(url);
        if (!res.ok) throw new Error("Error al obtener el historial");

        const ventas = await res.json();
        VENTAS_GLOBALES = ventas;

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
            const subtotalItem = item.subtotal !== undefined ? item.subtotal : ((item.price || item.precio || 0) * item.quantity);
            sumaSubtotales += subtotalItem;

            const itemDiv = document.createElement('div');
            itemDiv.className = "d-flex justify-content-between align-items-center mb-2 border-bottom pb-2";
            itemDiv.innerHTML = `
                <div style="flex: 1;">
                    <span class="fw-bold text-uppercase" style="font-size: 12px;">${item.productName || item.nombre || 'PRODUCTO'}</span><br>
                    <small class="text-muted">${item.quantity} un. x $${(item.price || item.precio || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}</small>
                </div>
                <div class="fw-bold">$${subtotalItem.toLocaleString('es-AR', {minimumFractionDigits: 2})}</div>
            `;
            container.appendChild(itemDiv);
        });

        const descuento = parseFloat(venta.discount) || 0;
        const recargo = parseFloat(venta.surcharge) || 0;

        setSafeText('txtSubtotalModal', `$${sumaSubtotales.toLocaleString('es-AR', {minimumFractionDigits: 2})}`);
        setSafeText('txtDescuentoModal', `-$${descuento.toLocaleString('es-AR', {minimumFractionDigits: 2})}`);

        // Si existe un elemento en el modal para mostrar recargos:
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
                v.customerName || 'Consumidor Final',
                'SIN DETALLE DE PRODUCTOS',
                1,
                `$${totalVenta.toFixed(2)}`,
                `$${totalVenta.toFixed(2)}`,
                v.paymentMethod === 'CUENTA_CORRIENTE' ? 'LIBRETA' : (v.paymentMethod || 'EFECTIVO')
            ]);
        } else {
            // Imprimir TODOS los productos individualmente
            items.forEach((item, index) => {
                const subtotalItem = item.subtotal !== undefined ? item.subtotal : ((item.price || item.precio || 0) * item.quantity);
                filas.push([
                    index === 0 ? `#${v.id}` : "",
                    index === 0 ? fechaFmt : "",
                    index === 0 ? (v.customerName || 'Consumidor Final') : "",
                    (item.productName || item.nombre || 'PRODUCTO').toUpperCase(),
                    item.quantity,
                    `$${(item.price || item.precio || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}`,
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
            4: { cellWidth: 12, halign: 'center' },
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
    let totalUnidadesVendidas = 0;

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
                "Cliente": v.customerName || 'Consumidor Final',
                "Producto": 'SIN DETALLE',
                "Cantidad": 1,
                "Precio Unitario": totalVenta,
                "Subtotal Ítem": totalVenta,
                "Descuento Venta": desc,
                "Recargo Libreta": rec,
                "Total Venta": totalVenta,
                "Método de Pago": v.paymentMethod === 'CUENTA_CORRIENTE' ? 'LIBRETA' : (v.paymentMethod || 'EFECTIVO')
            });
        } else {
            items.forEach((item) => {
                const cant = item.quantity || 1;
                const prec = item.price || item.precio || 0;
                const subt = item.subtotal !== undefined ? item.subtotal : (cant * prec);
                totalUnidadesVendidas += cant;

                dataExcel.push({
                    "N° Venta": v.id,
                    "Fecha / Hora": new Date(v.saleDate).toLocaleString('es-AR'),
                    "Cliente": v.customerName || 'Consumidor Final',
                    "Producto": (item.productName || item.nombre || 'PRODUCTO').toUpperCase(),
                    "Cantidad": cant,
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
    dataExcel.push({ "Producto": "TOTAL UNIDADES VENDIDAS:", "Cantidad": totalUnidadesVendidas });
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
        { wch: 10 },
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

    const fiscalActivo = infoEmpresa.hasTaxData === true || infoEmpresa.hasTaxData === "true" || !!venta.cae;

    const nombreLocal = (infoEmpresa.name || venta.companyName || 'MI NEGOCIO').toUpperCase();
    const direccionLocal = infoEmpresa.address || venta.companyAddress || '';
    const telefonoLocal = infoEmpresa.phone || venta.companyPhone || '';
    const emailLocal = infoEmpresa.email || venta.companyEmail || '';
    const mensajePie = infoEmpresa.ticketMessage || venta.ticketMessage || '¡Gracias por su compra!';

    const cuitLocal = infoEmpresa.taxId || infoEmpresa.cuit || venta.companyCuit || '';
    const iibbLocal = infoEmpresa.iibb || venta.companyIibb || '';
    const condicionIva = (infoEmpresa.condicionIva || 'RESPONSABLE MONOTRIBUTO').toUpperCase();

    let inicioActividades = infoEmpresa.inicioActividades || infoEmpresa.inicioAct || '';
    if (inicioActividades.includes('-')) {
        const parts = inicioActividades.split('-');
        inicioActividades = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    const tipoComprobante = fiscalActivo
        ? (venta.tipoComprobante || infoEmpresa.tipoComprobante || 'FACTURA C').toUpperCase()
        : (venta.tipoComprobante || 'TICKET DE VENTA');

    const cae = venta.cae || infoEmpresa.caePrueba || '';
    const caeVto = venta.caeVto || infoEmpresa.caeVtoPrueba || '';

    const nroComprobante = venta.nroComprobante || `00001-${String(venta.id || 1).padStart(8, '0')}`;
    const fechaVenta = venta.saleDate ? new Date(venta.saleDate).toLocaleString('es-AR') : new Date().toLocaleString('es-AR');
    let metodoPago = (venta.paymentMethod || 'EFECTIVO').replace('_', ' ').toUpperCase();
    if (metodoPago === 'CUENTA CORRIENTE') metodoPago = 'LIBRETA / CUENTA CORRIENTE';

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
        qrText = `https://www.afip.gob.ar/fe/qr/?p=${btoa(JSON.stringify(datosQr))}`;
    }

    ventana.document.write(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>Ticket #${venta.id || ''}</title>
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css">
                <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
                    @page { margin: 0; }
                    body {
                        font-family: 'Inter', sans-serif;
                        width: 58mm;
                        padding: 10px;
                        margin: 0;
                        color: #1e293b;
                        background: #fff;
                        line-height: 1.2;
                    }
                    .center { text-align: center; }
                    .ticket-header { border-bottom: 1px dashed #cbd5e1; padding-bottom: 8px; margin-bottom: 8px; }
                    .business-name { font-weight: 900; font-size: 15px; margin: 3px 0; text-transform: uppercase; color: #0f172a; }
                    .small-info { font-size: 10px; color: #475569; margin: 2px 0; }
                    .fiscal-header { font-size: 9px; color: #334155; text-align: left; background: #f8fafc; padding: 4px; border-radius: 4px; margin-top: 5px; }
                    .item-row { display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 4px; }
                    .item-name { font-weight: 700; text-transform: uppercase; flex: 1; padding-right: 5px; }
                    .line { border-top: 1px dashed #cbd5e1; margin: 8px 0; }
                    .total-container {
                        border-top: 2px solid #0f172a;
                        margin-top: 8px;
                        padding-top: 8px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .total-label { font-weight: 900; font-size: 16px; color: #0f172a; }
                    .total-amount { font-weight: 900; font-size: 16px; color: #2563eb; }

                    .arca-container { border-top: 1px solid #0f172a; margin-top: 12px; padding-top: 10px; text-align: center; }
                    .arca-logo { font-weight: 900; font-size: 12px; letter-spacing: 2px; color: #0f172a; margin-bottom: 5px; }
                    .qr-box { display: flex; justify-content: center; margin: 8px 0; }
                    .cae-info { font-size: 9px; font-weight: 700; text-align: left; color: #0f172a; margin-top: 4px; }

                    .ticket-footer { text-align: center; margin-top: 10px; border-top: 1px dashed #cbd5e1; padding-top: 10px; }
                    .msg-pie { font-style: italic; font-size: 11px; color: #475569; margin-bottom: 8px; display: block; }
                    .payment-method { font-weight: 800; font-size: 10px; color: #0f172a; border: 1px solid #e2e8f0; padding: 3px; display: inline-block; border-radius: 4px; margin-bottom: 8px; }
                    .powered { font-size: 7px; font-weight: 700; opacity: 0.4; margin-top: 8px; letter-spacing: 1px; }
                    .watermark-reprint { font-size: 8px; font-weight: 800; color: #475569; background: #f1f5f9; padding: 2px 4px; border-radius: 3px; display: inline-block; margin: 3px 0; border: 1px solid #e2e8f0; }
                    i.bi-shop { display: block; font-size: 20px; color: #2563eb; opacity: 0.5; }
                </style>
            </head>
            <body>
                <div class="ticket-header center">
                    <i class="bi bi-shop"></i>
                    <div class="business-name">${nombreLocal}</div>
                    ${direccionLocal ? `<div class="small-info">${direccionLocal}</div>` : ''}
                    ${telefonoLocal ? `<div class="small-info">Tel: ${telefonoLocal}</div>` : ''}
                    ${emailLocal ? `<div class="small-info">Email: ${emailLocal}</div>` : ''}

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
                        const subtotalItem = item.subtotal !== undefined ? item.subtotal : ((item.price || item.precio || 0) * item.quantity);
                        return `
                            <div class="item-row">
                                <span class="item-name">${item.quantity}x ${(item.productName || item.nombre || '').toUpperCase()}</span>
                                <span style="font-weight:700;">$${parseFloat(subtotalItem).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                            </div>
                        `;
                    }).join('') : ''}

                    ${descuentoMonto > 0 ? `
                        <div class="line"></div>
                        <div class="item-row" style="color: #dc3545;">
                            <span class="item-name">DESCUENTO:</span>
                            <span>-$${descuentoMonto.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                        </div>
                    ` : ''}

                    ${recargoMonto > 0 ? `
                        <div class="line"></div>
                        <div class="item-row" style="color: #6c757d; font-size: 9px;">
                            <span class="item-name">SUBTOTAL PRODUCTOS:</span>
                            <span>$${subtotalProductos.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                        </div>
                        <div class="item-row" style="color: #d97706; font-weight: bold;">
                            <span class="item-name">RECARGO LIBRETA (${recargoPorcentaje}%):</span>
                            <span>+$${recargoMonto.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
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
                    if (${Boolean(fiscalActivo && cae)}) {
                        new QRCode(document.getElementById("qrcode"), {
                            text: "${qrText}",
                            width: 90,
                            height: 90,
                            colorDark : "#000000",
                            colorLight : "#ffffff",
                            correctLevel : QRCode.CorrectLevel.M
                        });
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