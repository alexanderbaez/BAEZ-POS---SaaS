/**
 * BÁEZ POS - GESTIÓN DE CLIENTES Y CUENTA CORRIENTE (LIBRETA)
 * Alexander Baez - 2026
 * Refactorizado: Seguridad XSS, Manejo defensivo de estado, soporte para pesables (isFractional) e interoperabilidad SaaS
 */

const API_CUSTOMERS = '/customers';
const API_PERFIL = '/admin/my-company/profile';

let modalClienteInstance = null;
let modalHistorialInstance = null;
let DATOS_EMPRESA = null;

let CLIENTES_CACHE = [];
let MOVIMIENTOS_CACHE = [];
let CLIENTE_ACTUAL = { id: null, nombre: '', telefono: '' };

// ==========================================
// UTILS & HELPERS SEGURIDAD
// ==========================================

function sanitizeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatCurrency(amount) {
    const val = parseFloat(amount) || 0;
    return `$${val.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Formatea la cantidad considerando si el producto se vende por fracción/peso o por unidad entera.
 */
function formatQuantity(quantity, isFractional) {
    const qty = parseFloat(quantity) || 0;
    if (isFractional) {
        if (qty < 1) {
            const grams = Math.round(qty * 1000);
            return `${grams} GR`;
        }
        return `${qty.toFixed(3).replace(/\.?0+$/, '')} KG`;
    }
    return `${Math.floor(qty)}`;
}

// ==========================================
// 1. INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([cargarDatosEmpresa(), cargarClientes()]);

    // Listener para filtros de búsqueda dinámica
    const buscarInput = document.getElementById('buscarCliente');
    const filtroDeudores = document.getElementById('filtroDeudores');

    if (buscarInput) buscarInput.addEventListener('input', filtrarClientes);
    if (filtroDeudores) filtroDeudores.addEventListener('change', filtrarClientes);
});

async function cargarDatosEmpresa() {
    try {
        const resp = await apiFetch(API_PERFIL);
        if (resp && resp.ok) {
            DATOS_EMPRESA = await resp.json();
            const compEl = document.getElementById('companyName');
            if (compEl && DATOS_EMPRESA?.name) {
                compEl.textContent = DATOS_EMPRESA.name.toUpperCase();
            }
        }
    } catch (err) {
        console.error("Error al cargar la empresa:", err);
    }
}

// ==========================================
// 2. LÓGICA Y CARGA DE CLIENTES
// ==========================================

async function cargarClientes() {
    try {
        const resp = await apiFetch(API_CUSTOMERS);
        if (!resp || !resp.ok) throw new Error("Error al obtener clientes");

        CLIENTES_CACHE = await resp.json();
        renderizarClientes(CLIENTES_CACHE);
    } catch (err) {
        console.error("Error cargando clientes:", err);
        const tbody = document.getElementById('tablaClientes');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-muted"><i class="bi bi-exclamation-triangle fs-3 d-block mb-2 text-danger"></i>Error al obtener la lista de clientes del servidor.</td></tr>';
        }
    }
}

function renderizarClientes(clientes) {
    const tbody = document.getElementById('tablaClientes');
    if (!tbody) return;

    tbody.innerHTML = '';
    let totalDeuda = 0;

    if (!Array.isArray(clientes) || clientes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-muted"><i class="bi bi-people fs-3 d-block mb-2"></i>No se encontraron clientes registrados.</td></tr>';
        const totalEl = document.getElementById('totalDeudaClientes');
        if (totalEl) totalEl.textContent = formatCurrency(0);
        return;
    }

    const fragment = document.createDocumentFragment();

    clientes.forEach(c => {
        const saldo = parseFloat(c.currentBalance) || 0;
        totalDeuda += saldo;

        const badgeClass = saldo > 0 ? 'bg-danger bg-opacity-10 text-danger' : 'bg-success bg-opacity-10 text-success';
        const numTelefono = c.phone ? c.phone.replace(/\D/g, '') : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="ps-3">
                <div class="fw-bold text-dark">${sanitizeHTML(c.name)}</div>
                <small class="text-muted d-block" style="font-size: 0.75rem;">Límite: ${formatCurrency(c.creditLimit)}</small>
            </td>
            <td class="text-muted small d-none d-md-table-cell">${c.dniCuit ? sanitizeHTML(c.dniCuit) : '<span class="opacity-25">-</span>'}</td>
            <td class="d-none d-sm-table-cell">
                ${numTelefono ?
                    `<button type="button" class="btn btn-sm btn-outline-success border-0 rounded-pill px-3 fw-bold d-inline-flex align-items-center gap-1.5" style="font-size: 0.75rem;" title="Enviar recordatorio WhatsApp" data-action="whatsapp" data-id="${c.id}">
                        <i class="fab fa-whatsapp text-success fs-5"></i> <span class="d-none d-md-inline text-success">Recordatorio</span>
                    </button>` :
                    '<span class="text-muted small">Sin contacto</span>'
                }
            </td>
            <td class="text-end">
                <span class="balance-badge ${badgeClass}">${formatCurrency(saldo)}</span>
            </td>
            <td class="text-end pe-3">
                <div class="d-flex justify-content-end gap-2">
                    <button class="btn btn-sm btn-light border btn-action" data-action="whatsapp-btn" data-id="${c.id}" title="Recordatorio WhatsApp">
                        <i class="fab fa-whatsapp text-success"></i>
                    </button>
                    <button class="btn btn-sm btn-light border btn-action" data-action="editar" data-id="${c.id}" title="Editar">
                        <i class="bi bi-pencil text-warning"></i>
                    </button>
                    <button class="btn btn-sm btn-light border btn-action" data-action="historial" data-id="${c.id}" title="Ver Libreta">
                        <i class="bi bi-journal-text text-primary"></i>
                    </button>
                    <button class="btn btn-sm btn-light border btn-action" data-action="pagar" data-id="${c.id}" title="Cobrar">
                        <i class="bi bi-cash-coin text-success"></i>
                    </button>
                    <button class="btn btn-sm btn-light border btn-action" data-action="eliminar" data-id="${c.id}" title="Eliminar Cliente">
                        <i class="bi bi-trash text-danger"></i>
                    </button>
                </div>
            </td>
        `;

        const btnWsCol = tr.querySelector('[data-action="whatsapp"]');
        if (btnWsCol) {
            btnWsCol.onclick = () => enviarRecordatorioWhatsApp(c.phone, saldo);
        }

        const btnWsAction = tr.querySelector('[data-action="whatsapp-btn"]');
        if (btnWsAction) {
            btnWsAction.onclick = () => enviarRecordatorioWhatsApp(c.phone, saldo);
        }

        tr.querySelector('[data-action="editar"]').onclick = () => abrirModalEditar(c.id);
        tr.querySelector('[data-action="historial"]').onclick = () => verHistorial(c.id, c.name, c.phone);
        tr.querySelector('[data-action="pagar"]').onclick = () => registrarPago(c.id);
        tr.querySelector('[data-action="eliminar"]').onclick = () => eliminarCliente(c.id, c.name);

        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);

    const totalEl = document.getElementById('totalDeudaClientes');
    if (totalEl) {
        totalEl.textContent = formatCurrency(totalDeuda);
    }
}

function filtrarClientes() {
    const texto = (document.getElementById('buscarCliente')?.value || '').toLowerCase().trim();
    const soloDeudores = document.getElementById('filtroDeudores')?.checked || false;

    const filtrados = CLIENTES_CACHE.filter(c => {
        const nombre = (c.name || '').toLowerCase();
        const dni = (c.dniCuit || '').toLowerCase();
        const saldo = parseFloat(c.currentBalance) || 0;

        const coincideTexto = nombre.includes(texto) || dni.includes(texto);
        const cumpleDeuda = !soloDeudores || saldo > 0;

        return coincideTexto && cumpleDeuda;
    });

    renderizarClientes(filtrados);
}

// ==========================================
// 3. ABM CLIENTES
// ==========================================

function abrirModalNuevoCliente() {
    document.getElementById('formNuevoCliente')?.reset();
    document.getElementById('custId').value = '';
    document.getElementById('modalClienteTitulo').textContent = 'Nuevo Cliente';

    const modalEl = document.getElementById('modalNuevoCliente');
    modalClienteInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
    modalClienteInstance.show();
}

function abrirModalEditar(id) {
    const cliente = CLIENTES_CACHE.find(c => c.id === id);
    if (!cliente) return;

    document.getElementById('modalClienteTitulo').textContent = 'Editar Cliente';
    document.getElementById('custId').value = cliente.id;
    document.getElementById('custNombre').value = cliente.name || '';
    document.getElementById('custDni').value = cliente.dniCuit || '';
    document.getElementById('custTel').value = cliente.phone || '';
    document.getElementById('custLimite').value = cliente.creditLimit || 0;

    const modalEl = document.getElementById('modalNuevoCliente');
    modalClienteInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
    modalClienteInstance.show();
}

async function guardarCliente() {
    const id = document.getElementById('custId').value;
    const data = {
        name: document.getElementById('custNombre').value.trim(),
        dniCuit: document.getElementById('custDni').value.trim(),
        phone: document.getElementById('custTel').value.trim(),
        creditLimit: parseFloat(document.getElementById('custLimite').value) || 0
    };

    if (!data.name) return Swal.fire('Atención', 'El nombre del cliente es obligatorio', 'warning');

    const url = id ? `${API_CUSTOMERS}/${id}` : API_CUSTOMERS;
    const method = id ? 'PUT' : 'POST';

    try {
        const resp = await apiFetch(url, {
            method: method,
            body: JSON.stringify(data)
        });

        if (resp && resp.ok) {
            if (modalClienteInstance) modalClienteInstance.hide();
            Swal.fire({ icon: 'success', title: '¡Éxito!', text: 'Cliente guardado correctamente.', timer: 1500, showConfirmButton: false });
            await cargarClientes();
        } else if (resp) {
            const errData = await resp.json().catch(() => ({}));
            Swal.fire('Error', errData.message || 'No se pudo guardar el cliente', 'error');
        }
    } catch (err) {
        console.error("Error al guardar cliente:", err);
        Swal.fire('Error', 'Error de conexión con el servidor', 'error');
    }
}

async function eliminarCliente(id, nombre) {
    const result = await Swal.fire({
        title: '¿Eliminar cliente?',
        html: `¿Estás seguro de que deseas eliminar a <b>${sanitizeHTML(nombre)}</b>?<br><small class="text-muted">Esta acción no se puede deshacer.</small>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        reverseButtons: true
    });

    if (result.isConfirmed) {
        try {
            const resp = await apiFetch(`${API_CUSTOMERS}/${id}`, { method: 'DELETE' });

            if (resp && resp.ok) {
                Swal.fire({ icon: 'success', title: '¡Eliminado!', text: 'El cliente ha sido eliminado.', timer: 1500, showConfirmButton: false });
                await cargarClientes();
            } else if (resp) {
                const errData = await resp.json().catch(() => ({}));
                Swal.fire('Error', errData.message || 'No se pudo eliminar el cliente. Es posible que tenga registros asociados.', 'error');
            }
        } catch (err) {
            console.error("Error al eliminar cliente:", err);
            Swal.fire('Error', 'Ocurrió un problema de conexión con el servidor.', 'error');
        }
    }
}

// ==========================================
// 4. HISTORIAL Y FILTRADO DE LIBRETA
// ==========================================

async function verHistorial(id, nombre, telefono) {
    try {
        const resp = await apiFetch(`${API_CUSTOMERS}/${id}/movements`);
        if (!resp || !resp.ok) throw new Error("Error al obtener movimientos");

        MOVIMIENTOS_CACHE = await resp.json();
        CLIENTE_ACTUAL = { id, nombre, telefono };

        const titEl = document.getElementById('historialTitulo');
        if (titEl) titEl.textContent = `Libreta: ${nombre.toUpperCase()}`;

        if (document.getElementById('filtroFechaDesde')) document.getElementById('filtroFechaDesde').value = '';
        if (document.getElementById('filtroFechaHasta')) document.getElementById('filtroFechaHasta').value = '';

        renderizarTablaMovimientos();

        const modalEl = document.getElementById('modalHistorialCliente');
        if (modalEl) {
            modalHistorialInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
            modalHistorialInstance.show();
        }

    } catch (err) {
        console.error("Error cargando historial:", err);
        Swal.fire('Error', 'No se pudieron cargar los movimientos.', 'error');
    }
}

function aplicarFiltroFechas() { renderizarTablaMovimientos(); }
function limpiarFiltroFechas() {
    if (document.getElementById('filtroFechaDesde')) document.getElementById('filtroFechaDesde').value = '';
    if (document.getElementById('filtroFechaHasta')) document.getElementById('filtroFechaHasta').value = '';
    renderizarTablaMovimientos();
}

function renderizarTablaMovimientos() {
    const tbody = document.getElementById('listaMovimientos');
    if (!tbody) return;
    tbody.innerHTML = '';

    const desdeVal = document.getElementById('filtroFechaDesde')?.value || '';
    const hastaVal = document.getElementById('filtroFechaHasta')?.value || '';

    const fechaDesde = desdeVal ? new Date(`${desdeVal}T00:00:00`) : null;
    const fechaHasta = hastaVal ? new Date(`${hastaVal}T23:59:59`) : null;

    let movs = [...MOVIMIENTOS_CACHE].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    let saldoAcumulado = 0;
    const movimientosAProcesar = [];

    movs.forEach((m, index) => {
        const esVenta = ['SALE', 'DEBITO', 'DEBT'].includes(m.type);
        const montoFinal = parseFloat(m.amount) || 0;

        if (esVenta) saldoAcumulado += montoFinal;
        else saldoAcumulado -= montoFinal;

        const fechaMov = new Date(m.createdAt);
        let incluir = true;

        if (fechaDesde && !isNaN(fechaDesde) && fechaMov < fechaDesde) incluir = false;
        if (fechaHasta && !isNaN(fechaHasta) && fechaMov > fechaHasta) incluir = false;

        if (incluir) {
            movimientosAProcesar.push({
                ...m,
                originalIndex: index,
                saldoMomentaneo: saldoAcumulado
            });
        }
    });

    if (movimientosAProcesar.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted py-4">
                    <i class="bi bi-calendar-x fs-3 d-block mb-1"></i>
                    No se encontraron movimientos para el rango seleccionado.
                </td>
            </tr>
        `;
    } else {
        movimientosAProcesar.forEach((m) => {
            const esVenta = ['SALE', 'DEBITO', 'DEBT'].includes(m.type);
            const fecha = new Date(m.createdAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            const montoFinal = parseFloat(m.amount) || 0;
            const idx = m.originalIndex;

            let subtotalPuro = parseFloat(m.subtotal) || 0;
            if (subtotalPuro === 0 && esVenta && Array.isArray(m.itemsDetail)) {
                subtotalPuro = m.itemsDetail.reduce((acc, item) => {
                    const sub = item.subtotal !== undefined ? parseFloat(item.subtotal) : ((parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 1));
                    return acc + sub;
                }, 0);
            }

            let descuento = parseFloat(m.discount || m.discountAmount) || 0;
            let recargo = parseFloat(m.surchargeAmount || m.surcharge || m.recargo) || 0;
            let porcentajeRecargo = parseFloat(m.surchargePercentage || m.surchargeRate) || 0;

            if (esVenta && subtotalPuro > 0 && recargo === 0) {
                const diferencia = montoFinal - (subtotalPuro - descuento);
                if (diferencia > 0.01) recargo = diferencia;
            }

            const icono = esVenta
                ? '<i class="bi bi-receipt text-primary me-2"></i>'
                : '<i class="bi bi-cash-stack text-success me-2"></i>';

            let badgesAdicionales = '';
            if (esVenta) {
                if (descuento > 0) badgesAdicionales += `<span class="badge bg-danger-subtle text-danger ms-1" style="font-size: 0.65rem;">DESC. -${formatCurrency(descuento)}</span>`;
                if (recargo > 0) badgesAdicionales += `<span class="badge bg-warning-subtle text-warning-emphasis ms-1" style="font-size: 0.65rem;">RECARGO +${formatCurrency(recargo)}</span>`;
            }

            const trPrincipal = document.createElement('tr');
            trPrincipal.className = 'align-middle';
            trPrincipal.style.cursor = esVenta ? 'pointer' : 'default';
            if (esVenta) trPrincipal.onclick = () => toggleDetalle(idx);

            trPrincipal.innerHTML = `
                <td class="ps-4 text-muted" style="font-size: 0.75rem;">${fecha}</td>
                <td>
                    <div class="d-flex align-items-center">
                        ${icono}
                        <div>
                            <span class="${esVenta ? 'text-dark' : 'text-success fw-bold'}">${sanitizeHTML(m.description || (esVenta ? 'Venta' : 'Pago de Libreta'))}</span>
                            ${badgesAdicionales}
                        </div>
                        ${esVenta ? `<i id="icon-${idx}" class="bi bi-chevron-down ms-2 text-primary small"></i>` : ''}
                    </div>
                </td>
                <td class="text-end text-danger fw-bold">${esVenta ? '+' + formatCurrency(montoFinal) : ''}</td>
                <td class="text-end text-success fw-bold">${!esVenta ? '-' + formatCurrency(montoFinal) : ''}</td>
                <td class="pe-4 text-end fw-bold text-secondary">${formatCurrency(m.saldoMomentaneo)}</td>
            `;

            tbody.appendChild(trPrincipal);

            if (esVenta) {
                const trDetalle = document.createElement('tr');
                trDetalle.id = `detalle-${idx}`;
                trDetalle.className = 'd-none bg-light';

                let itemsLista = '<p class="text-muted small p-2 m-0">Detalle de productos no disponible.</p>';

                if (Array.isArray(m.itemsDetail) && m.itemsDetail.length > 0) {
                    itemsLista = m.itemsDetail.map(i => {
                        const subItem = i.subtotal !== undefined ? parseFloat(i.subtotal) : ((parseFloat(i.price) || 0) * (parseFloat(i.quantity) || 1));
                        const cantidadFormateada = formatQuantity(i.quantity, i.isFractional);

                        return `
                            <div class="d-flex justify-content-between border-bottom py-1">
                                <span class="text-uppercase" style="font-size: 0.75rem;">${cantidadFormateada} ${sanitizeHTML(i.productName || i.nombre || 'Producto')}</span>
                                <span class="fw-bold small">${formatCurrency(subItem)}</span>
                            </div>
                        `;
                    }).join('');

                    itemsLista += `
                        <div class="mt-3 p-2 bg-white border rounded border-dashed">
                            <div class="d-flex justify-content-between small text-muted">
                                <span>Subtotal Productos:</span>
                                <span>${formatCurrency(subtotalPuro)}</span>
                            </div>
                            ${descuento > 0 ? `
                            <div class="d-flex justify-content-between small text-danger fw-bold mt-1">
                                <span>Descuento aplicado:</span>
                                <span>-${formatCurrency(descuento)}</span>
                            </div>` : ''}
                            ${recargo > 0 ? `
                            <div class="d-flex justify-content-between small text-warning fw-bold mt-1">
                                <span>Recargo Libreta ${porcentajeRecargo > 0 ? `(${porcentajeRecargo}%)` : ''}:</span>
                                <span>+${formatCurrency(recargo)}</span>
                            </div>` : ''}
                            <div class="d-flex justify-content-between mt-2 border-top border-secondary pt-1">
                                <span class="fw-bold text-dark text-uppercase small">Impacto en Libreta:</span>
                                <span class="fw-bold text-primary fs-5">${formatCurrency(montoFinal)}</span>
                            </div>
                        </div>
                    `;
                }

                trDetalle.innerHTML = `
                    <td colspan="5" class="p-3">
                        <div class="card card-body border-0 shadow-sm mx-4" style="background-color: #fdfdfd; border-left: 4px solid #1e3a8a !important;">
                            <h6 class="small fw-bold text-primary mb-3"><i class="bi bi-box-seam me-1"></i> DETALLE DE COMPRA:</h6>
                            ${itemsLista}
                            <div class="text-end mt-3">
                                <button class="btn btn-sm btn-success px-3 shadow-sm rounded-pill fw-bold btn-ws">
                                    <i class="bi bi-whatsapp me-1"></i> Enviar ticket
                                </button>
                            </div>
                        </div>
                    </td>
                `;

                trDetalle.querySelector('.btn-ws').onclick = (e) => {
                    e.stopPropagation();
                    compartirWhatsApp(
                        CLIENTE_ACTUAL.nombre,
                        CLIENTE_ACTUAL.telefono,
                        fecha,
                        montoFinal,
                        m.itemsDetail || [],
                        descuento,
                        recargo,
                        porcentajeRecargo,
                        subtotalPuro
                    );
                };

                tbody.appendChild(trDetalle);
            }
        });
    }

    const subEl = document.getElementById('historialSubtitulo');
    if (subEl) {
        subEl.textContent = `Deuda Total Actual: ${formatCurrency(saldoAcumulado)}`;
    }

    const btnWsModal = document.getElementById('btnWhatsappModal');
    if (btnWsModal) {
        if (CLIENTE_ACTUAL.telefono) {
            btnWsModal.classList.remove('d-none');
            btnWsModal.classList.add('d-inline-flex');
            btnWsModal.onclick = () => enviarRecordatorioWhatsApp(CLIENTE_ACTUAL.telefono, saldoAcumulado);
        } else {
            btnWsModal.classList.add('d-none');
            btnWsModal.classList.remove('d-inline-flex');
        }
    }
}

// ==========================================
// 5. REGISTRO DE PAGOS / COBROS (Modal Premium)
// ==========================================
let modalCobroClienteInstance = null;

function abrirModalCobro(id) {
    const cliente = CLIENTES_CACHE.find(c => c.id === id) || CLIENTE_ACTUAL;
    if (!cliente) return;

    const saldoActual = parseFloat(cliente.currentBalance) || 0;
    const elId = document.getElementById('cobroClienteId');
    if (elId) elId.value = cliente.id;

    const elSub = document.getElementById('modalCobroSubtitulo');
    if (elSub) elSub.innerText = `Cliente: ${cliente.nombre || cliente.name || 'Sin nombre'}`;

    const elSaldo = document.getElementById('cobroSaldoActual');
    if (elSaldo) elSaldo.innerText = formatCurrency(saldoActual);

    const inputMonto = document.getElementById('cobroMontoInput');
    if (inputMonto) {
        inputMonto.value = saldoActual > 0 ? saldoActual.toFixed(2) : '';
    }

    const radioEfe = document.getElementById('metodoEfectivo');
    if (radioEfe) radioEfe.checked = true;

    const inputRef = document.getElementById('cobroRefInput');
    if (inputRef) inputRef.value = '';

    const modalEl = document.getElementById('modalCobroCliente');
    if (modalEl) {
        modalCobroClienteInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
        modalCobroClienteInstance.show();
        setTimeout(() => {
            if (inputMonto) {
                inputMonto.focus();
                inputMonto.select();
            }
        }, 300);
    }
}

async function procesarFormularioCobro() {
    const idVal = document.getElementById('cobroClienteId')?.value;
    const montoVal = document.getElementById('cobroMontoInput')?.value;
    const metodoVal = document.querySelector('input[name="cobroMetodoPago"]:checked')?.value || 'EFECTIVO';
    const refVal = document.getElementById('cobroRefInput')?.value?.trim() || '';

    const monto = parseFloat(montoVal);
    if (isNaN(monto) || monto <= 0) {
        return Swal.fire('Atención', 'Por favor ingresá un monto válido mayor a $0', 'warning');
    }

    const btnConfirmar = document.getElementById('btnConfirmarCobro');
    const originalText = btnConfirmar ? btnConfirmar.innerHTML : '';
    if (btnConfirmar) {
        btnConfirmar.disabled = true;
        btnConfirmar.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Procesando...';
    }

    try {
        const textoRef = refVal && refVal.length > 0
            ? refVal
            : `Cobro de Libreta (${metodoVal})`;

        const ahora = new Date().toISOString();

        // Mapeo exhaustivo para satisfacer el DTO de pagos en backend
        const payload = {
            customerId: Number(idVal),
            amount: monto,
            monto: monto,
            paymentMethod: metodoVal,
            method: metodoVal,
            type: metodoVal,
            reference: textoRef,
            description: textoRef,
            observacion: textoRef,
            details: textoRef,
            movementDate: ahora,
            paymentDate: ahora
        };

        const resp = await apiFetch(`${API_CUSTOMERS}/${idVal}/payments`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (resp && resp.ok) {
            if (modalCobroClienteInstance) modalCobroClienteInstance.hide();

            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: `Pago de ${formatCurrency(monto)} registrado`,
                showConfirmButton: false,
                timer: 2500,
                timerProgressBar: true
            });

            await cargarClientes();

            if (CLIENTE_ACTUAL && Number(CLIENTE_ACTUAL.id) === Number(idVal) && modalHistorialInstance) {
                await verHistorial(idVal, CLIENTE_ACTUAL.nombre, CLIENTE_ACTUAL.telefono);
            }

            if (typeof cargarDatosDashboard === "function") cargarDatosDashboard();
            if (typeof cargarReporteCajaHoy === "function") cargarReporteCajaHoy();

        } else if (resp) {
            const errData = await resp.json().catch(() => ({}));
            Swal.fire({
                icon: 'error',
                title: 'Error en Backend',
                html: `<b>Servidor dice:</b> ${errData.message || 'No se pudo procesar el cobro.'}`
            });
        }
    } catch (err) {
        console.error("Error en cobro de libreta:", err);
        Swal.fire('Error de red', 'Ocurrió un fallo de conexión al registrar el cobro.', 'error');
    } finally {
        if (btnConfirmar) {
            btnConfirmar.disabled = false;
            btnConfirmar.innerHTML = originalText;
        }
    }
}

// Alias para compatibilidad de llamadas en tabla y vistas
function registrarPago(id) {
    abrirModalCobro(id);
}

// ==========================================
// 6. UTILIDADES E INTEGRACIÓN CON WHATSAPP
// ==========================================

function toggleDetalle(index) {
    const el = document.getElementById(`detalle-${index}`);
    const icono = document.getElementById(`icon-${index}`);
    if (el) {
        const isHidden = el.classList.contains('d-none');
        el.classList.toggle('d-none');
        if (icono) {
            icono.classList.toggle('bi-chevron-down', !isHidden);
            icono.classList.toggle('bi-chevron-up', isHidden);
        }
    }
}

function compartirWhatsApp(nombreCliente, telefono, fecha, total, items = [], descuento = 0, recargo = 0, porcentajeRecargo = 0, subtotal = 0) {
    if (!telefono || telefono === "null" || telefono === "") {
        return Swal.fire('Atención', 'El cliente no tiene un teléfono registrado.', 'warning');
    }

    const local = DATOS_EMPRESA?.name?.toUpperCase() || "BAEZ POS";
    const direccion = DATOS_EMPRESA?.address || "";
    const mensajePie = DATOS_EMPRESA?.ticketMessage || '¡Muchas gracias por su compra!';

    const totalNum = parseFloat(total) || 0;
    const descNum = parseFloat(descuento) || 0;
    const recNum = parseFloat(recargo) || 0;
    const subtotalNum = parseFloat(subtotal) || 0;

    let texto = `┏━━━━━━━━━━━━━━━━━━━━┓\n`;
    texto += `  🏪  *${local}*\n`;
    if (direccion) texto += `  📍  _${direccion}_\n`;
    texto += `┗━━━━━━━━━━━━━━━━━━━━┛\n\n`;

    texto += `*🧾 COMPROBANTE DE COMPRA*\n`;
    texto += `------------------------------------------\n`;
    texto += `*👤 CLIENTE:* ${nombreCliente.toUpperCase()}\n`;
    texto += `*📅 FECHA:* ${fecha}\n`;
    texto += `*💳 PAGO:* LIBRETA (A CUENTA)\n`;
    texto += `------------------------------------------\n\n`;

    if (Array.isArray(items) && items.length > 0) {
        texto += `*🛒 DETALLE DE PRODUCTOS:*\n`;
        items.forEach(i => {
            const sub = i.subtotal !== undefined ? parseFloat(i.subtotal) : ((parseFloat(i.price) || 0) * (parseFloat(i.quantity) || 1));
            const cantidadFormateada = formatQuantity(i.quantity, i.isFractional);

            texto += `▪️ ${cantidadFormateada} ${(i.productName || i.nombre || 'Producto').toUpperCase()}\n`;
            texto += `      Subtotal: *${formatCurrency(sub)}*\n`;
        });
        texto += `------------------------------------------\n`;
        if (subtotalNum > 0) {
            texto += `*Subtotal:* ${formatCurrency(subtotalNum)}\n`;
        }
    }

    if (descNum > 0) texto += `*DESCUENTO:* -${formatCurrency(descNum)}\n`;
    if (recNum > 0) {
        const pctText = porcentajeRecargo > 0 ? ` (${porcentajeRecargo}%)` : '';
        texto += `*RECARGO LIBRETA${pctText}:* +${formatCurrency(recNum)}\n`;
    }

    texto += `\n------------------------------------------\n`;
    texto += `*💰 TOTAL FINAL: ${formatCurrency(totalNum)}*\n`;
    texto += `------------------------------------------\n\n`;

    texto += `💬 _${mensajePie}_\n\n`;
    texto += `*¡Tu saldo ha sido actualizado en la libreta!*\n\n`;
    texto += `✨ _Generado por BaezPOS_`;

    const numLimpio = telefono.replace(/\D/g, '');
    window.open(`https://wa.me/${numLimpio}?text=${encodeURIComponent(texto)}`, '_blank');
}

/**
 * Envía recordatorio oficial de saldo pendiente por WhatsApp
 */
function enviarRecordatorioWhatsApp(telefono, saldo) {
    if (!telefono || telefono === "null" || telefono === "") {
        return Swal.fire('Atención', 'El cliente no tiene un número de teléfono registrado.', 'warning');
    }
    const numLimpio = String(telefono).replace(/\D/g, '');
    const saldoFormateado = formatCurrency(saldo);
    const mensaje = `Hola, te recordamos que tu saldo pendiente es de ${saldoFormateado}. ¡Gracias!`;
    const url = `https://wa.me/${numLimpio}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
}

// Exposición explícita para compatibilidad HTML
window.abrirModalEditar = abrirModalEditar;
window.verHistorial = verHistorial;
window.registrarPago = registrarPago;
window.eliminarCliente = eliminarCliente;
window.abrirModalNuevoCliente = abrirModalNuevoCliente;
window.guardarCliente = guardarCliente;
window.filtrarClientes = filtrarClientes;
window.aplicarFiltroFechas = aplicarFiltroFechas;
window.limpiarFiltroFechas = limpiarFiltroFechas;
window.toggleDetalle = toggleDetalle;
window.compartirWhatsApp = compartirWhatsApp;
window.enviarRecordatorioWhatsApp = enviarRecordatorioWhatsApp;