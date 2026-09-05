let proveedoresGlobales = [];
let debounceTimer = null;
let modalProveedorInstance = null;
let modalAbonoInstance = null;

let paginaActual = 1;
let totalPaginasBackend = 1;
let totalElementosBackend = 0;
const LIMITE_POR_PAGINA = 20;

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

    const abonoMetodo = document.getElementById('abonoMetodoPago');
    if (abonoMetodo) {
        abonoMetodo.addEventListener('change', (e) => {
            actualizarEstadoAbonoDeduct(e.target.value);
        });
    }

    // Listeners de submit para modales ABM
    const formProv = document.getElementById('formProveedor');
    if (formProv) {
        formProv.addEventListener('submit', guardarProveedor);
    }
    const formAb = document.getElementById('formAbono');
    if (formAb) {
        formAb.addEventListener('submit', registrarAbono);
    }
    const formOrden = document.getElementById('formOrdenCompra');
    if (formOrden) {
        formOrden.addEventListener('submit', generarOrdenCompra);
    }

    cargarProveedores(0);
});

function actualizarEstadoAbonoDeduct(metodo) {
    const lbl = document.getElementById('lblAyudaAbonoDeduct');
    const switchEl = document.getElementById('abonoDeductFromBox');
    if (switchEl) switchEl.disabled = false;
    if (lbl) {
        if (metodo === 'EFECTIVO_CAJA' || metodo === 'EFECTIVO') {
            lbl.textContent = "Descuenta billetes del cajón actual";
        } else {
            lbl.textContent = "Descuenta del saldo bancario del negocio";
        }
    }
}

/**
 * Carga la lista de proveedores desde el Backend de forma paginada
 */
async function cargarProveedores(pagina = 0) {
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
        const res = await apiFetch(`/providers?page=${pagina}&size=${LIMITE_POR_PAGINA}&sort=businessName,asc`);
        if (!res || !res.ok) {
            throw new Error("No se pudo obtener el listado de proveedores.");
        }

        const data = await res.json();
        let lista = [];

        if (data && Array.isArray(data.content)) {
            lista = data.content;
            paginaActual = data.number + 1;
            totalPaginasBackend = data.totalPages;
            totalElementosBackend = data.totalElements;
        } else if (Array.isArray(data)) {
            lista = data;
            paginaActual = 1;
            totalPaginasBackend = 1;
            totalElementosBackend = data.length;
        }

        proveedoresGlobales = lista;
        renderizarProveedores(proveedoresGlobales);
        actualizarKPIs(proveedoresGlobales);

        renderizarPaginacion(data);
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
    const infoPaginacion = document.getElementById('infoPaginacion');
    if (infoPaginacion) {
        const total = (totalElementosBackend !== undefined && totalElementosBackend !== null) ? totalElementosBackend : (lista ? lista.length : 0);
        infoPaginacion.innerText = 'Mostrando ' + total + ' proveedores';
    }
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
                    <button class="btn btn-sm btn-outline-secondary px-2 py-1 fw-semibold d-inline-flex align-items-center" 
                            title="Ver Pagos" 
                            onclick="abrirModalHistorialPagos(${prov.id}, '${escapeHTML(prov.businessName)}')">
                        <i class="bi bi-clock-history me-1"></i> Ver Pagos
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

function renderizarPaginacion(data) {
    const contenedor = document.getElementById('paginacionContenedor');
    const infoPaginacion = document.getElementById('infoPaginacion');
    if (infoPaginacion) {
        const total = (data && data.totalElements !== undefined) ? data.totalElements : (totalElementosBackend || 0);
        infoPaginacion.innerText = 'Mostrando ' + total + ' proveedores';
    }

    if (!contenedor) return;
    contenedor.innerHTML = '';

    if (!data || data.totalPages === undefined) return;

    const isFirst = data.first;
    const isLast = data.last;
    const currentPage = data.number;

    let html = '';

    // Botón Anterior
    html += `
        <li class="page-item ${isFirst ? 'disabled' : ''}">
            <button class="page-link" onclick="cambiarPaginaProveedores(${currentPage})">Anterior</button>
        </li>
    `;

    // Botón Siguiente
    html += `
        <li class="page-item ${isLast ? 'disabled' : ''}">
            <button class="page-link" onclick="cambiarPaginaProveedores(${currentPage + 2})">Siguiente</button>
        </li>
    `;

    contenedor.innerHTML = html;
}

function cambiarPaginaProveedores(nuevaPagina) {
    if (nuevaPagina < 1 || nuevaPagina > totalPaginasBackend) return;
    cargarProveedores(nuevaPagina - 1);
}

/**
 * Actualiza los contadores y métricas de deuda
 */
function actualizarKPIs(lista) {
    const totalProveedores = totalElementosBackend || (lista ? lista.length : 0);
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
 * Filtro interactivo con búsqueda reactiva
 */
function filtrarProveedores() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
        const q = (document.getElementById('buscarProveedor')?.value || '').trim();
        const soloDeuda = document.getElementById('filtroDeuda')?.checked || false;

        if (!q && !soloDeuda) {
            cargarProveedores(0);
            return;
        }

        try {
            const url = q
                ? `/providers/search?q=${encodeURIComponent(q)}&size=100`
                : `/providers?page=0&size=100&sort=businessName,asc`;
            const res = await apiFetch(url);
            if (!res || !res.ok) return;

            let data = await res.json();
            let lista = Array.isArray(data.content) ? data.content : (Array.isArray(data) ? data : []);

            if (soloDeuda) {
                lista = lista.filter(p => (parseFloat(p.currentBalance) || 0) > 0);
            }

            proveedoresGlobales = lista;
            paginaActual = 1;
            totalPaginasBackend = 1;
            totalElementosBackend = lista.length;

            renderizarProveedores(proveedoresGlobales);
            renderizarPaginacion(data);
        } catch (err) {
            console.error("Error buscando proveedores:", err);
        }
    }, 300);
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
async function guardarProveedor(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
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
    const nombre = prov ? prov.businessName : 'este proveedor';

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
async function registrarAbono(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
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
    const deductSwitch = document.getElementById('abonoDeductFromBox');
    const deductFromBoxValue = deductSwitch ? deductSwitch.checked : true;

    const payload = {
        amount: monto,
        paymentMethod: metodoPago,
        invoiceNumber: invoiceNumber,
        reference: reference,
        deductFromBox: deductFromBoxValue
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

/* ==========================================================
   MÓDULO: ÓRDENES DE COMPRA (FASE 2)
   ========================================================== */
let carritoOrden = [];
let sugerenciasTimeout = null;

// Cambiar Vista (Pestañas)
window.cambiarVista = function(vista) {
    if (vista === 'ordenes') {
        cargarOrdenes(0);
    } else {
        cargarProveedores(0);
    }
};

// Cargar Órdenes Paginadas
async function cargarOrdenes(pagina = 0) {
    const tbody = document.getElementById('tablaOrdenes');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-muted">Cargando órdenes...</td></tr>`;
    
    try {
        const res = await apiFetch(`/purchase-orders?page=${pagina}&size=20&sort=orderDate,desc`);
        if (!res.ok) throw new Error("Error cargando historial de órdenes");
        const data = await res.json();
        
        const content = data.content || data;
        
        if (content.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-muted">No hay órdenes registradas.</td></tr>`;
            return;
        }
        
        const fragment = document.createDocumentFragment();
        
        content.forEach(orden => {
            const fechaObj = new Date(orden.orderDate);
            const fechaFormateada = fechaObj.toLocaleDateString('es-AR') + ' ' + fechaObj.toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'});
            
            let badgeEstado = '';
            let btnRecibir = '';
            let btnCancelar = '';
            let btnEliminar = '';
            
            if (orden.status === 'PENDING') {
                badgeEstado = `<span class="badge bg-light text-warning border border-warning-subtle px-2 py-1"><i class="bi bi-clock me-1"></i>Pendiente</span>`;
                btnRecibir = `<button class="btn btn-sm btn-outline-success mx-1" onclick="recibirOrden(${orden.id})" title="Recibir Stock"><i class="bi bi-box-seam"></i></button>`;
                btnCancelar = `<button class="btn btn-sm btn-outline-warning mx-1" onclick="cancelarOrden(${orden.id})" title="Cancelar Orden"><i class="bi bi-x-circle"></i></button>`;
                btnEliminar = `<button class="btn btn-sm btn-outline-danger mx-1" onclick="eliminarOrden(${orden.id})" title="Eliminar Orden"><i class="bi bi-trash"></i></button>`;
            } else if (orden.status === 'RECEIVED') {
                badgeEstado = `<span class="badge bg-light text-success border border-success-subtle px-2 py-1"><i class="bi bi-check2-circle me-1"></i>Recibido</span>`;
            } else if (orden.status === 'CANCELED') {
                badgeEstado = `<span class="badge bg-light text-danger border border-danger-subtle px-2 py-1"><i class="bi bi-x-circle me-1"></i>Cancelado</span>`;
                btnEliminar = `<button class="btn btn-sm btn-outline-danger mx-1" onclick="eliminarOrden(${orden.id})" title="Eliminar Orden"><i class="bi bi-trash"></i></button>`;
            }

            const btnDetalle = `<button class="btn btn-sm btn-outline-primary mx-1" onclick="abrirModalDetalleOrden(${orden.id})" title="Ver Detalle"><i class="bi bi-eye"></i></button>`;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="ps-3"><span class="fw-semibold text-dark">${fechaFormateada}</span></td>
                <td><span class="fw-bold text-dark">${escapeHTML(orden.providerName)}</span></td>
                <td>${badgeEstado}</td>
                <td class="text-end fw-bold text-dark amount-num">${fmtARS.format(orden.totalAmount)}</td>
                <td class="text-end pe-3">
                    ${btnDetalle}
                    ${btnRecibir}
                    ${btnCancelar}
                    ${btnEliminar}
                </td>
            `;
            fragment.appendChild(tr);
        });
        
        tbody.innerHTML = '';
        tbody.appendChild(fragment);
        
        if (data.totalElements !== undefined) {
            const infoPaginacion = document.getElementById('infoPaginacionOrdenes');
            if(infoPaginacion) infoPaginacion.textContent = `Mostrando ${content.length} de ${data.totalElements} órdenes`;
        }
        
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-danger">Error: ${err.message}</td></tr>`;
    }
}

// Abrir Modal de Nueva Orden
window.abrirModalGenerarOrden = async function() {
    carritoOrden = [];
    document.getElementById('selectProveedor').innerHTML = '<option value="">Seleccione un proveedor...</option>';
    document.getElementById('inputBuscarProducto').value = '';
    document.getElementById('listaSugerenciasProd').classList.add('d-none');
    renderizarCarrito();
    
    try {
        const res = await apiFetch(`/providers?page=0&size=1000&sort=businessName,asc`);
        if (res.ok) {
            const data = await res.json();
            const providers = data.content || data;
            const select = document.getElementById('selectProveedor');
            providers.forEach(p => {
                select.innerHTML += `<option value="${p.id}">${escapeHTML(p.businessName)}</option>`;
            });
        }
    } catch (err) {
        console.error("Error cargando proveedores para modal", err);
    }

    const modal = new bootstrap.Modal(document.getElementById('modalGenerarOrden'));
    modal.show();
};

// Búsqueda de Productos para el Carrito
const inputBuscarProducto = document.getElementById('inputBuscarProducto');
if(inputBuscarProducto) {
    inputBuscarProducto.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (sugerenciasTimeout) clearTimeout(sugerenciasTimeout);
        
        if (query.length < 2) {
            document.getElementById('listaSugerenciasProd').classList.add('d-none');
            return;
        }
        
        sugerenciasTimeout = setTimeout(async () => {
            try {
                const res = await apiFetch(`/products/search?q=${encodeURIComponent(query)}&limit=10`);
                if (res.ok) {
                    const productos = await res.json();
                    const divSugerencias = document.getElementById('listaSugerenciasProd');
                    divSugerencias.className = 'list-group position-absolute w-100 bg-white border rounded shadow-lg z-index-3';
                    divSugerencias.innerHTML = '';
                    
                    if (productos.length === 0) {
                        divSugerencias.innerHTML = `<div class="list-group-item text-muted small">No se encontraron productos.</div>`;
                    } else {
                        productos.forEach(prod => {
                            const a = document.createElement('a');
                            a.href = "#";
                            a.className = "list-group-item list-group-item-action d-flex justify-content-between align-items-center p-2 cursor-pointer";
                            a.innerHTML = `
                                <div>
                                    <span class="fw-bold d-block text-dark">${escapeHTML(prod.name)}</span>
                                    <small class="text-muted">Costo actual: ${fmtARS.format(prod.cost)}</small>
                                </div>
                                <i class="bi bi-plus-circle text-primary"></i>
                            `;
                            a.onclick = (event) => {
                                event.preventDefault();
                                agregarAlCarrito(prod);
                                divSugerencias.classList.add('d-none');
                                document.getElementById('inputBuscarProducto').value = '';
                            };
                            divSugerencias.appendChild(a);
                        });
                    }
                    divSugerencias.classList.remove('d-none');
                }
            } catch (err) {
                console.error("Error buscando productos", err);
            }
        }, 300);
    });
}

function agregarAlCarrito(producto) {
    const existe = carritoOrden.find(i => i.productId === producto.id);
    if (existe) {
        existe.quantity += 1;
    } else {
        carritoOrden.push({
            productId: producto.id,
            productName: producto.name,
            quantity: 1,
            unitCost: producto.cost || 0,
            currentStock: producto.stock || 0
        });
    }
    renderizarCarrito();
}

window.eliminarItemCarrito = function(index) {
    carritoOrden.splice(index, 1);
    renderizarCarrito();
};

window.actualizarItemCarrito = function(index, campo, valor, inputElement) {
    const val = parseFloat(valor);
    if (!isNaN(val) && val >= 0) {
        carritoOrden[index][campo] = val;
    }
    
    // Actualización dinámica sin re-render completo
    if (inputElement) {
        const tr = inputElement.closest('tr');
        if (tr) {
            const item = carritoOrden[index];
            const subtotal = item.quantity * item.unitCost;
            const proyectado = (item.currentStock || 0) + item.quantity;
            
            // Actualizar Proyección
            const colProy = tr.querySelector('.col-proyectado');
            if (colProy) colProy.innerHTML = `<small class="text-muted mb-1">Actual: ${item.currentStock || 0}</small><span class="badge bg-success-subtle text-success border border-success-subtle w-auto">Final: ${proyectado}</span>`;
            
            // Actualizar Total General
            let total = 0;
            carritoOrden.forEach(i => total += (i.quantity * i.unitCost));
            document.getElementById('totalOrdenBadge').textContent = fmtARS.format(total);
        }
    } else {
        renderizarCarrito(); // Fallback por seguridad
    }
};

function renderizarCarrito() {
    const tbody = document.getElementById('carritoBody');
    let total = 0;
    
    if (carritoOrden.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-5 text-muted small"><i class="bi bi-inbox fs-3 d-block mb-2 text-secondary"></i> El carrito está vacío. Busque un producto para agregarlo.</td></tr>`;
        document.getElementById('totalOrdenBadge').textContent = fmtARS.format(0);
        return;
    }
    
    const fragment = document.createDocumentFragment();
    carritoOrden.forEach((item, index) => {
        const subtotal = item.quantity * item.unitCost;
        total += subtotal;
        
        const proyectado = (item.currentStock || 0) + item.quantity;
        
        const tr = document.createElement('tr');
        tr.className = "border-bottom";
        tr.innerHTML = `
            <td class="ps-3"><span class="fw-semibold text-dark">${escapeHTML(item.productName)}</span></td>
            <td>
                <div class="input-group input-group-sm flex-nowrap">
                    <span class="input-group-text bg-light border-0 text-muted">$</span>
                    <input type="number" class="form-control form-control-sm text-center" style="min-width: 90px; width: 100%;"
                           value="${item.unitCost}" oninput="actualizarItemCarrito(${index}, 'unitCost', this.value, this)">
                </div>
            </td>
            <td>
                <input type="number" class="form-control form-control-sm text-center" value="${item.quantity}" min="1" style="width: 70px;"
                       oninput="actualizarItemCarrito(${index}, 'quantity', this.value, this)">
            </td>
            <td>
                <div class="d-flex flex-column lh-1 col-proyectado">
                    <small class="text-muted mb-1">Actual: ${item.currentStock || 0}</small>
                    <span class="badge bg-success-subtle text-success border border-success-subtle w-auto">Final: ${proyectado}</span>
                </div>
            </td>
            <td>
                <button class="btn btn-outline-danger btn-sm border-0 w-100 d-flex justify-content-center" onclick="eliminarItemCarrito(${index})">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        fragment.appendChild(tr);
    });
    
    tbody.innerHTML = '';
    tbody.appendChild(fragment);
    document.getElementById('totalOrdenBadge').textContent = fmtARS.format(total);
}

window.generarOrdenCompra = async function(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const providerId = document.getElementById('selectProveedor').value;
    if (!providerId) {
        return Swal.fire("Atención", "Debe seleccionar un proveedor", "warning");
    }
    
    if (carritoOrden.length === 0) {
        return Swal.fire("Atención", "El carrito no puede estar vacío", "warning");
    }
    
    const payload = {
        providerId: parseInt(providerId),
        items: carritoOrden.map(i => ({
            productId: i.productId,
            quantity: i.quantity,
            unitCost: i.unitCost
        }))
    };
    
    try {
        const res = await apiFetch(`/purchase-orders`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        
        if (res.ok) {
            const orden = await res.json();
            
            const modalEl = document.getElementById('modalGenerarOrden');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
            Swal.fire({
                icon: 'success',
                title: 'Orden Generada',
                text: 'La orden fue registrada con éxito. ¿Deseas enviarla al proveedor?',
                showCancelButton: true,
                confirmButtonText: '<i class="bi bi-whatsapp"></i> WhatsApp',
                cancelButtonText: '<i class="bi bi-envelope"></i> Email',
                confirmButtonColor: '#25D366',
                cancelButtonColor: '#3b82f6',
                showCloseButton: true,
            }).then((result) => {
                if (result.isConfirmed) {
                    const providerSelect = document.getElementById('selectProveedor');
                    const providerName = providerSelect.options[providerSelect.selectedIndex].text;
                    
                    let companyName = 'Nuestra Empresa';
                    try {
                        const rawData = sessionStorage.getItem('DATOS_EMPRESA') || sessionStorage.getItem('config_comercio');
                        if (rawData) {
                            const parsed = JSON.parse(rawData);
                            if (parsed && parsed.name) companyName = parsed.name;
                        }
                    } catch(e) {}
                    
                    let wmsg = `Hola ${providerName}, te envío un pedido desde *${companyName}*:\n\n`;
                    carritoOrden.forEach(i => {
                        const qtyStr = (i.quantity % 1 === 0) ? i.quantity.toString() : i.quantity.toString();
                        wmsg += `- ${qtyStr} x ${i.productName}\n`;
                    });
                    wmsg += `\nAguardo confirmación. ¡Muchas gracias!`;
                    
                    const wlink = `https://wa.me/?text=${encodeURIComponent(wmsg)}`;
                    window.open(wlink, '_blank');
                } else if (result.dismiss === Swal.DismissReason.cancel) {
                    enviarOrdenEmail(orden.id);
                }
            });
            cargarOrdenes(0);
            
        } else {
            const err = await res.json();
            Swal.fire("Error", err.message || "No se pudo generar la orden", "error");
        }
    } catch (err) {
        Swal.fire("Error", "Ocurrió un error al generar la orden", "error");
    }
};

window.recibirOrden = async function(id) {
    const confirm = await Swal.fire({
        title: '¿Recibir mercadería?',
        text: 'Esto sumará el stock de forma automática y cargará el saldo a la deuda del proveedor. Esta acción es irreversible.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#16a34a',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Sí, recibir'
    });
    
    if (confirm.isConfirmed) {
        try {
            const res = await apiFetch(`/purchase-orders/${id}/receive`, { method: 'PUT' });
            if (res.ok) {
                Swal.fire('¡Recibido!', 'El stock fue actualizado y la cuenta corriente ajustada.', 'success');
                cargarOrdenes(0);
            } else {
                const err = await res.json();
                Swal.fire('Error', err.message || 'No se pudo procesar la recepción.', 'error');
            }
        } catch (err) {
            Swal.fire('Error', 'Fallo de conexión.', 'error');
        }
    }
};

window.cancelarOrden = async function(id) {
    const confirm = await Swal.fire({
        title: '¿Cancelar orden?',
        text: 'La orden se marcará como cancelada y no tendrá efectos contables ni de stock.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, cancelar'
    });
    
    if (confirm.isConfirmed) {
        try {
            const res = await apiFetch(`/purchase-orders/${id}/cancel`, { method: 'PUT' });
            if (res.ok) {
                Swal.fire('¡Cancelada!', 'La orden fue cancelada exitosamente.', 'success');
                cargarOrdenes(0);
            } else {
                const err = await res.json();
                Swal.fire('Error', err.message || 'No se pudo cancelar.', 'error');
            }
        } catch (err) {
            Swal.fire('Error', 'Fallo de conexión.', 'error');
        }
    }
};

window.enviarOrdenEmail = async function(id) {
    try {
        Swal.fire({ title: 'Enviando...', text: 'Por favor, espere.', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
        const res = await apiFetch(`/purchase-orders/${id}/send-email`, { method: 'POST' });
        if (res.ok) {
            Swal.fire('Enviado', 'La orden fue enviada por correo exitosamente.', 'success');
        } else {
            const err = await res.json();
            Swal.fire('Atención', err.message || 'No se pudo enviar el correo', 'error');
        }
    } catch (e) {
        Swal.fire('Error', 'Fallo en el envío', 'error');
    }
};

window.eliminarOrden = async function(id) {
    const confirm = await Swal.fire({ 
        title: '¿Eliminar Orden?', 
        text: 'Esta acción no se puede deshacer.', 
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonText: 'Sí, eliminar', 
        cancelButtonText: 'Cancelar', 
        confirmButtonColor: '#dc2626' 
    });
    
    if (confirm.isConfirmed) {
        try {
            const res = await apiFetch(`/purchase-orders/${id}`, { method: 'DELETE' });
            if (res.ok) {
                Swal.fire('Eliminada', 'La orden ha sido eliminada.', 'success');
                cargarOrdenes(0);
            } else {
                const err = await res.json();
                Swal.fire('Atención', err.message || 'No se pudo eliminar la orden', 'error');
            }
        } catch (e) {
            Swal.fire('Error', 'No se pudo procesar la solicitud', 'error');
        }
    }
};

// ==========================================
// 8. HISTORIAL ESPECÍFICO DE PAGOS A PROVEEDORES
// ==========================================
window.abrirModalHistorialPagos = async function(providerId, providerName) {
    const subtitulo = document.getElementById('historialPagosSubtitulo');
    const tbody = document.getElementById('tablaHistorialPagos');
    const totalEl = document.getElementById('historialPagosTotal');
    
    if (subtitulo) subtitulo.textContent = `Proveedor: ${providerName}`;
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-muted"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Cargando pagos...</td></tr>`;
    if (totalEl) totalEl.textContent = '$0,00';

    const modalEl = document.getElementById('modalHistorialPagos');
    if (modalEl) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }

    try {
        const res = await apiFetch(`/providers/${providerId}/payments?size=100&sort=expenseDate,desc`);
        if (!res.ok) throw new Error("Error al consultar el historial de pagos");

        const data = await res.json();
        const pagos = data.content || (Array.isArray(data) ? data : []);

        if (pagos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-muted py-4">
                        <i class="bi bi-receipt-cutoff fs-3 d-block mb-1 text-secondary"></i>
                        No se registraron pagos ni abonos para este proveedor.
                    </td>
                </tr>
            `;
            return;
        }

        let sumaTotal = 0;
        let html = '';

        pagos.forEach(p => {
            const monto = parseFloat(p.amount) || 0;
            sumaTotal += monto;

            const fechaObj = new Date(p.date || p.expenseDate);
            const fechaFormateada = isNaN(fechaObj.getTime()) ? '-' : (fechaObj.toLocaleDateString('es-AR') + ' ' + fechaObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }));

            const medioPago = p.paymentMethod || 'EFECTIVO';
            let badgeMedio = `<span class="badge bg-light text-dark border">${escapeHTML(medioPago)}</span>`;
            if (medioPago.includes('EFECTIVO')) {
                badgeMedio = `<span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25"><i class="bi bi-cash me-1"></i>Efectivo</span>`;
            } else if (medioPago.includes('TRANSFERENCIA')) {
                badgeMedio = `<span class="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25"><i class="bi bi-bank me-1"></i>Transferencia</span>`;
            } else if (medioPago.includes('DEBITO') || medioPago.includes('TARJETA')) {
                badgeMedio = `<span class="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25"><i class="bi bi-credit-card me-1"></i>Tarjeta</span>`;
            }

            const refText = [p.invoiceNumber ? `Fac: ${p.invoiceNumber}` : '', p.reference].filter(Boolean).join(' - ') || '-';

            html += `
                <tr>
                    <td class="ps-3 py-3 text-muted">${fechaFormateada}</td>
                    <td class="py-3 fw-semibold text-dark">${escapeHTML(p.description || 'Pago a proveedor')}</td>
                    <td class="py-3">${badgeMedio}</td>
                    <td class="py-3 text-muted small">${escapeHTML(refText)}</td>
                    <td class="pe-3 py-3 text-end fw-bold text-success font-monospace">+${fmtARS.format(monto)}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
        if (totalEl) totalEl.textContent = fmtARS.format(sumaTotal);

    } catch (err) {
        console.error("Error al cargar pagos del proveedor:", err);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-danger">Error: ${err.message}</td></tr>`;
    }
};

// ==========================================
// 9. DETALLE COMPLETO DE ORDEN DE COMPRA (MODAL)
// ==========================================
window.abrirModalDetalleOrden = async function(ordenId) {
    const titulo = document.getElementById('detalleOrdenTitulo');
    const subtitulo = document.getElementById('detalleOrdenSubtitulo');
    const metaContainer = document.getElementById('detalleOrdenMeta');
    const tbody = document.getElementById('tablaDetalleOrdenItems');
    const totalEl = document.getElementById('detalleOrdenTotal');

    if (titulo) titulo.innerHTML = `<i class="bi bi-cart-check text-white"></i> Orden de Compra #${ordenId}`;
    if (subtitulo) subtitulo.textContent = 'Cargando detalle de la orden...';
    if (metaContainer) metaContainer.innerHTML = '';
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-muted"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Cargando productos...</td></tr>`;
    if (totalEl) totalEl.textContent = '$0,00';

    const modalEl = document.getElementById('modalDetalleOrden');
    if (modalEl) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }

    try {
        const res = await apiFetch(`/purchase-orders/${ordenId}`);
        if (!res.ok) throw new Error("Error al consultar el detalle de la orden");

        const orden = await res.json();

        if (subtitulo) subtitulo.textContent = `Proveedor: ${orden.providerName || 'N/A'}`;

        const fechaObj = new Date(orden.orderDate);
        const fechaEmision = isNaN(fechaObj.getTime()) ? '-' : (fechaObj.toLocaleDateString('es-AR') + ' ' + fechaObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }));

        let badgeEstado = '';
        if (orden.status === 'PENDING') {
            badgeEstado = `<span class="badge bg-warning bg-opacity-25 text-warning-emphasis border border-warning px-2.5 py-1.5"><i class="bi bi-clock me-1"></i>Pendiente</span>`;
        } else if (orden.status === 'RECEIVED') {
            badgeEstado = `<span class="badge bg-success bg-opacity-25 text-success-emphasis border border-success px-2.5 py-1.5"><i class="bi bi-check2-circle me-1"></i>Recibido</span>`;
        } else if (orden.status === 'CANCELED') {
            badgeEstado = `<span class="badge bg-danger bg-opacity-25 text-danger-emphasis border border-danger px-2.5 py-1.5"><i class="bi bi-x-circle me-1"></i>Cancelado</span>`;
        }

        let fechaRecepcionHtml = '';
        if (orden.receptionDate) {
            const recObj = new Date(orden.receptionDate);
            const fechaRec = isNaN(recObj.getTime()) ? '-' : (recObj.toLocaleDateString('es-AR') + ' ' + recObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }));
            fechaRecepcionHtml = `<div class="small"><span class="text-muted fw-semibold">Recepción:</span> <strong class="text-dark">${fechaRec}</strong></div>`;
        }

        if (metaContainer) {
            metaContainer.innerHTML = `
                <div class="d-flex align-items-center gap-3">
                    <div class="small"><span class="text-muted fw-semibold">Proveedor:</span> <strong class="text-dark">${escapeHTML(orden.providerName || 'N/A')}</strong></div>
                    <div class="small"><span class="text-muted fw-semibold">Emisión:</span> <strong class="text-dark">${fechaEmision}</strong></div>
                    ${fechaRecepcionHtml}
                </div>
                <div>${badgeEstado}</div>
            `;
        }

        const items = orden.items || [];
        if (items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-muted">La orden no contiene productos desglosados.</td></tr>`;
        } else {
            let html = '';
            items.forEach(item => {
                const subtotal = parseFloat(item.subtotal) || ((parseFloat(item.quantity) || 0) * (parseFloat(item.unitCost) || 0));
                const barcode = item.productBarcode ? `<span class="badge bg-light text-secondary font-monospace border">${escapeHTML(item.productBarcode)}</span>` : '<span class="text-muted">-</span>';

                html += `
                    <tr>
                        <td class="ps-3 py-3">${barcode}</td>
                        <td class="py-3 fw-bold text-dark">${escapeHTML(item.productName || 'Producto')}</td>
                        <td class="py-3 text-center fw-bold">${parseFloat(item.quantity || 0)}</td>
                        <td class="py-3 text-end font-monospace">${fmtARS.format(item.unitCost || 0)}</td>
                        <td class="pe-3 py-3 text-end fw-bold text-dark font-monospace">${fmtARS.format(subtotal)}</td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        }

        if (totalEl) totalEl.textContent = fmtARS.format(orden.totalAmount || 0);

    } catch (err) {
        console.error("Error al cargar detalle de la orden:", err);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-danger">Error: ${err.message}</td></tr>`;
    }
};
