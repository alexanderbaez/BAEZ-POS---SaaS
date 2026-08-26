/**
 * BÁEZ POS - MÓDULO DE GESTIÓN DE PROVEEDORES (SaaS Multi-tenant)
 * Alexander Baez - 2026
 */

let proveedoresGlobales = [];
let debounceTimer = null;
let modalProveedorInstance = null;
let modalAbonoInstance = null;

// Formateador estándar de moneda local (ARS)
const fmtARS = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2
});

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar instancias de modales Bootstrap
    const modalProvEl = document.getElementById('modalProveedor');
    if (modalProvEl) {
        modalProveedorInstance = new bootstrap.Modal(modalProvEl);
    }
    const modalAbonoEl = document.getElementById('modalAbonoProveedor');
    if (modalAbonoEl) {
        modalAbonoInstance = new bootstrap.Modal(modalAbonoEl);
    }

    cargarProveedores();
});

/**
 * Carga la lista de proveedores desde el Backend mediante apiFetch
 */
async function cargarProveedores() {
    const tbody = document.getElementById('tablaProveedores');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center p-4">
                    <div class="spinner-border text-primary spinner-border-sm me-2" role="status"></div>
                    <span class="text-muted">Cargando proveedores...</span>
                </td>
            </tr>`;
    }

    try {
        const res = await apiFetch('/providers');
        if (!res || !res.ok) {
            throw new Error("No se pudo obtener el listado de proveedores.");
        }

        proveedoresGlobales = await res.json();
        renderizarProveedores(proveedoresGlobales);
        actualizarKPIs(proveedoresGlobales);
    } catch (err) {
        console.error("Error al cargar proveedores:", err);
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-danger p-4">
                        <i class="bi bi-exclamation-triangle fs-4 d-block mb-2"></i>
                        Error al cargar proveedores. Verifique su conexión o sesión.
                    </td>
                </tr>`;
        }
    }
}

/**
 * Renderiza los proveedores en la tabla principal
 */
function renderizarProveedores(lista) {
    const tbody = document.getElementById('tablaProveedores');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!lista || lista.length === 0) {
        if (typeof renderEmptyState === 'function') {
            renderEmptyState('tablaProveedores', 'bi-truck', 'Sin proveedores registrados', 'No se encontraron proveedores activos o coincidentes con la búsqueda.', '<button class="btn btn-primary btn-sm fw-bold" onclick="abrirModalNuevoProveedor()"><i class="bi bi-truck me-1"></i>Nuevo Proveedor</button>', 6);
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center p-5 text-muted">
                        <i class="bi bi-inbox fs-3 d-block mb-1 text-secondary"></i>
                        No se encontraron proveedores registrados o coincidentes.
                    </td>
                </tr>`;
        }
        return;
    }

    const fragment = document.createDocumentFragment();

    lista.forEach(prov => {
        const tr = document.createElement('tr');

        const saldo = parseFloat(prov.currentBalance) || 0;
        const tieneDeuda = saldo > 0;
        const badgeSaldo = tieneDeuda
            ? `<span class="badge bg-danger bg-opacity-10 text-danger border border-danger balance-badge">${fmtARS.format(saldo)}</span>`
            : `<span class="badge bg-success bg-opacity-10 text-success border border-success balance-badge">${fmtARS.format(saldo)}</span>`;

        let telHtml = '<span class="text-muted small">Sin teléfono</span>';
        if (prov.phone) {
            const cleanPhone = prov.phone.replace(/\D/g, '');
            telHtml = `
                <a href="https://wa.me/${cleanPhone}" target="_blank" class="text-decoration-none text-success fw-semibold small d-inline-flex align-items-center">
                    <i class="bi bi-whatsapp me-1"></i> ${escapeHTML(prov.phone)}
                </a>
            `;
        }

        const emailHtml = prov.email
            ? `<span class="small text-muted">${escapeHTML(prov.email)}</span>`
            : '<span class="text-muted small">-</span>';

        const taxIdHtml = prov.taxId
            ? `<span class="small fw-semibold text-secondary">${escapeHTML(prov.taxId)}</span>`
            : '<span class="text-muted small">-</span>';

        tr.innerHTML = `
            <td class="ps-3">
                <div class="d-flex align-items-center">
                    <div class="p-2 bg-primary bg-opacity-10 text-primary rounded-circle me-2 d-flex align-items-center justify-content-center" style="width: 36px; height: 36px;">
                        <i class="bi bi-truck"></i>
                    </div>
                    <div>
                        <strong class="text-dark d-block">${escapeHTML(prov.businessName)}</strong>
                        <small class="text-muted">ID #${prov.id}</small>
                    </div>
                </div>
            </td>
            <td class="d-none d-md-table-cell">${taxIdHtml}</td>
            <td class="d-none d-sm-table-cell">${telHtml}</td>
            <td class="d-none d-lg-table-cell">${emailHtml}</td>
            <td class="text-end">${badgeSaldo}</td>
            <td class="text-end pe-3">
                <div class="d-flex justify-content-end gap-1">
                    <button class="btn btn-sm btn-success px-2 py-1 fw-semibold d-inline-flex align-items-center" 
                            title="Registrar Abono / Pago" 
                            onclick="abrirModalAbono(${prov.id})">
                        <i class="bi bi-cash-stack me-1"></i> Pagar
                    </button>
                    <button class="btn-action text-primary" 
                            title="Editar Proveedor" 
                            onclick="abrirModalEditar(${prov.id})">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn-action text-danger" 
                            title="Eliminar Proveedor" 
                            onclick="eliminarProveedor(${prov.id})">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        `;

        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
}

/**
 * Actualiza los contadores y métricas de deuda
 */
function actualizarKPIs(lista) {
    const totalProveedores = lista ? lista.length : 0;
    let deudaConsolidada = 0;

    if (lista) {
        lista.forEach(p => {
            const bal = parseFloat(p.currentBalance) || 0;
            if (bal > 0) {
                deudaConsolidada += bal;
            }
        });
    }

    const elTotal = document.getElementById('kpiTotalProveedores');
    const elDeuda = document.getElementById('kpiDeudaTotal');

    if (elTotal) elTotal.textContent = totalProveedores;
    if (elDeuda) elDeuda.textContent = fmtARS.format(deudaConsolidada);
}

/**
 * Filtro interactivo por texto y por solo deudores
 */
function filtrarProveedores() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        const q = (document.getElementById('buscarProveedor')?.value || '').toLowerCase().trim();
        const soloDeuda = document.getElementById('filtroDeuda')?.checked || false;

        const filtrados = proveedoresGlobales.filter(p => {
            const matchTexto = (p.businessName || '').toLowerCase().includes(q) ||
                               (p.taxId || '').toLowerCase().includes(q) ||
                               (p.phone || '').toLowerCase().includes(q) ||
                               (p.email || '').toLowerCase().includes(q);

            const saldo = parseFloat(p.currentBalance) || 0;
            const matchDeuda = !soloDeuda || (saldo > 0);

            return matchTexto && matchDeuda;
        });

        renderizarProveedores(filtrados);
    }, 200);
}

/**
 * Modal Crear Proveedor
 */
function abrirModalNuevoProveedor() {
    document.getElementById('formProveedor').reset();
    document.getElementById('provId').value = '';
    document.getElementById('modalProveedorTitulo').textContent = 'Nuevo Proveedor';
    document.getElementById('provCurrentBalance').value = '0.00';
    
    // Mostrar campo de saldo inicial
    const divSaldo = document.getElementById('divSaldoInicial');
    if (divSaldo) divSaldo.style.display = 'block';

    if (modalProveedorInstance) modalProveedorInstance.show();
}

/**
 * Modal Editar Proveedor
 */
function abrirModalEditar(id) {
    const prov = proveedoresGlobales.find(p => p.id === id);
    if (!prov) return;

    document.getElementById('formProveedor').reset();
    document.getElementById('provId').value = prov.id;
    document.getElementById('modalProveedorTitulo').textContent = 'Editar Proveedor';

    document.getElementById('provBusinessName').value = prov.businessName || '';
    document.getElementById('provTaxId').value = prov.taxId || '';
    document.getElementById('provPhone').value = prov.phone || '';
    document.getElementById('provEmail').value = prov.email || '';
    document.getElementById('provCurrentBalance').value = prov.currentBalance || 0;

    if (modalProveedorInstance) modalProveedorInstance.show();
}

/**
 * Guarda (Crear o Actualizar) un proveedor
 */
async function guardarProveedor() {
    const businessName = document.getElementById('provBusinessName').value.trim();
    if (!businessName) {
        return Swal.fire({
            icon: 'warning',
            title: 'Campo obligatorio',
            text: 'Debe ingresar la Razón Social o Nombre del proveedor.',
            confirmButtonColor: '#2563eb'
        });
    }

    const id = document.getElementById('provId').value;
    const taxId = document.getElementById('provTaxId').value.trim() || null;
    const phone = document.getElementById('provPhone').value.trim() || null;
    const email = document.getElementById('provEmail').value.trim() || null;
    const balanceInput = document.getElementById('provCurrentBalance').value;
    const currentBalance = parseFloat(balanceInput) || 0;

    const payload = {
        businessName,
        taxId,
        phone,
        email,
        currentBalance
    };

    try {
        let res;
        if (id) {
            res = await apiFetch(`/providers/${id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
        } else {
            res = await apiFetch('/providers', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        }

        if (res && (res.ok || res.status === 201)) {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: id ? 'Proveedor actualizado con éxito' : 'Proveedor creado con éxito',
                showConfirmButton: false,
                timer: 2000,
                timerProgressBar: true
            });

            if (modalProveedorInstance) modalProveedorInstance.hide();
            cargarProveedores();
        } else {
            let errMsg = 'Ocurrió un error al guardar los datos del proveedor.';
            try {
                const errData = await res.json();
                errMsg = errData.message || errData.error || errMsg;
            } catch (e) {}
            throw new Error(errMsg);
        }
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: err.message,
            confirmButtonColor: '#2563eb'
        });
    }
}

/**
 * Baja lógica de un proveedor
 */
async function eliminarProveedor(id) {
    const prov = proveedoresGlobales.find(p => p.id === id);
    const nombre = prov ? prov.businessName : `ID #${id}`;

    const confirmacion = await Swal.fire({
        title: '¿Dar de baja proveedor?',
        text: `Se dará de baja a "${nombre}". Podrá reactivarse si es necesario.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Sí, dar de baja',
        cancelButtonText: 'Cancelar'
    });

    if (confirmacion.isConfirmed) {
        try {
            const res = await apiFetch(`/providers/${id}`, { method: 'DELETE' });
            if (res && res.ok) {
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: 'Proveedor eliminado correctamente',
                    showConfirmButton: false,
                    timer: 2000
                });
                cargarProveedores();
            } else {
                throw new Error("No se pudo eliminar el proveedor.");
            }
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Error al eliminar',
                text: err.message,
                confirmButtonColor: '#2563eb'
            });
        }
    }
}

/**
 * Abre el modal de abono para un proveedor específico
 */
function abrirModalAbono(id) {
    const prov = proveedoresGlobales.find(p => p.id === id);
    if (!prov) return;

    document.getElementById('formAbono').reset();
    document.getElementById('abonoProvId').value = prov.id;
    document.getElementById('abonoProveedorNombre').textContent = prov.businessName;

    const saldo = parseFloat(prov.currentBalance) || 0;
    document.getElementById('abonoProveedorDeudaActual').textContent = fmtARS.format(saldo);

    // Si tiene saldo deudor, sugerimos el importe completo
    const elMonto = document.getElementById('abonoMonto');
    if (elMonto) {
        elMonto.value = saldo > 0 ? saldo.toFixed(2) : '';
    }

    if (modalAbonoInstance) modalAbonoInstance.show();
}

/**
 * Registra el abono / pago al proveedor llamando al endpoint POST /api/v1/providers/{id}/pay
 */
async function registrarAbono() {
    const id = document.getElementById('abonoProvId').value;
    const montoInput = document.getElementById('abonoMonto').value;
    const monto = parseFloat(montoInput.replace(',', '.'));

    if (isNaN(monto) || monto <= 0) {
        return Swal.fire({
            icon: 'warning',
            title: 'Monto inválido',
            text: 'Debe ingresar un monto válido mayor a cero para registrar el abono.',
            confirmButtonColor: '#16a34a'
        });
    }

    const metodoPago = document.getElementById('abonoMetodoPago').value;
    const invoiceNumber = document.getElementById('abonoInvoiceNumber').value.trim() || null;
    const reference = document.getElementById('abonoReferencia').value.trim() || null;

    const payload = {
        amount: monto,
        paymentMethod: metodoPago,
        invoiceNumber: invoiceNumber,
        reference: reference
    };

    try {
        const res = await apiFetch(`/providers/${id}/pay`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (res && res.ok) {
            const proveedorActualizado = await res.json();
            const nombreMetodo = (metodoPago === 'EFECTIVO_CAJA') ? 'Efectivo (Caja)' :
                                 (metodoPago === 'EFECTIVO_CAJA_FUERTE') ? 'Efectivo (Caja Fuerte / Dueño)' :
                                 (metodoPago === 'TRANSFERENCIA') ? 'Transferencia' :
                                 (metodoPago === 'TARJETA') ? 'Tarjeta' : metodoPago;

            Swal.fire({
                icon: 'success',
                title: '¡Abono registrado con éxito!',
                html: `
                    <p class="mb-2">Se registró el pago de <strong>${fmtARS.format(monto)}</strong> por <strong>${nombreMetodo}</strong>.</p>
                    <p class="text-muted small mb-0">Nuevo saldo deudor: <strong>${fmtARS.format(proveedorActualizado.currentBalance)}</strong></p>
                `,
                confirmButtonColor: '#16a34a'
            });

            if (modalAbonoInstance) modalAbonoInstance.hide();
            cargarProveedores();
        } else {
            let errMsg = 'No se pudo procesar el abono a proveedor.';
            try {
                const errData = await res.json();
                errMsg = errData.message || errData.error || errMsg;
            } catch (e) {}
            throw new Error(errMsg);
        }
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Error al procesar pago',
            text: err.message,
            confirmButtonColor: '#ef4444'
        });
    }
}

/**
 * Sanitiza cadenas para prevenir XSS
 */
function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// Exportar funciones a ámbito global para invocaciones onclick del DOM
window.abrirModalNuevoProveedor = abrirModalNuevoProveedor;
window.abrirModalEditar = abrirModalEditar;
window.guardarProveedor = guardarProveedor;
window.eliminarProveedor = eliminarProveedor;
window.abrirModalAbono = abrirModalAbono;
window.registrarAbono = registrarAbono;
window.filtrarProveedores = filtrarProveedores;
