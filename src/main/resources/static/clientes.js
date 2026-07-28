/**
 * BÁEZ POS - GESTIÓN DE CLIENTES Y CUENTA CORRIENTE (LIBRETA)
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
// 1. INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    await cargarDatosEmpresa();
    await cargarClientes();
});

async function cargarDatosEmpresa() {
    try {
        const resp = await apiFetch(API_PERFIL);
        if (resp && resp.ok) {
            DATOS_EMPRESA = await resp.json();
            const compEl = document.getElementById('companyName');
            if (compEl && DATOS_EMPRESA.name) {
                compEl.innerText = DATOS_EMPRESA.name.toUpperCase();
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
            tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-muted">Error al obtener la lista de clientes.</td></tr>';
        }
    }
}

function renderizarClientes(clientes) {
    const tbody = document.getElementById('tablaClientes');
    if (!tbody) return;

    tbody.innerHTML = '';
    let totalDeuda = 0;

    if (!clientes || clientes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-muted">No se encontraron clientes registrados.</td></tr>';
        const totalEl = document.getElementById('totalDeudaClientes');
        if (totalEl) totalEl.innerText = '$0,00';
        return;
    }

    clientes.forEach(c => {
        const saldo = parseFloat(c.currentBalance) || 0;
        totalDeuda += saldo;

        const badgeClass = saldo > 0 ? 'bg-danger bg-opacity-10 text-danger' : 'bg-success bg-opacity-10 text-success';
        const msgWsCaja = `Hola ${c.name}, te recordamos tu saldo pendiente de $${saldo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}. Saludos de ${DATOS_EMPRESA?.name || 'BaezPOS'}!`;
        const numTelefono = c.phone ? c.phone.replace(/\D/g, '') : '';
        const linkWs = numTelefono ? `https://wa.me/${numTelefono}?text=${encodeURIComponent(msgWsCaja)}` : '#';

        const nombreSeguro = (c.name || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const phoneSeguro = (c.phone || '').replace(/'/g, "\\'");

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="ps-4">
                <div class="fw-bold text-dark">${c.name}</div>
                <small class="text-muted" style="font-size: 0.75rem;">Límite: $${(c.creditLimit || 0).toLocaleString('es-AR')}</small>
            </td>
            <td class="text-muted small">${c.dniCuit || '<span class="opacity-25">-</span>'}</td>
            <td>
                ${numTelefono ?
                    `<a href="${linkWs}" target="_blank" class="btn btn-sm btn-outline-success border-0 rounded-pill px-3 fw-bold" style="font-size: 0.75rem;">
                        <i class="bi bi-whatsapp me-1"></i> Recordatorio
                    </a>` :
                    '<span class="text-muted small">Sin contacto</span>'
                }
            </td>
            <td>
                <span class="balance-badge ${badgeClass}">
                    $${saldo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
            </td>
            <td class="text-end pe-4">
                <div class="d-flex justify-content-end gap-2">
                    <button class="btn-action" onclick="abrirModalEditar(${c.id})" title="Editar">
                        <i class="bi bi-pencil text-warning"></i>
                    </button>
                    <button class="btn-action" onclick="verHistorial(${c.id}, '${nombreSeguro}', '${phoneSeguro}')" title="Ver Libreta">
                        <i class="bi bi-journal-text text-primary"></i>
                    </button>
                    <button class="btn-action" onclick="registrarPago(${c.id})" title="Cobrar">
                        <i class="bi bi-cash-coin text-success"></i>
                    </button>
                    <button class="btn-action" onclick="eliminarCliente(${c.id}, '${nombreSeguro}')" title="Eliminar Cliente">
                        <i class="bi bi-trash text-danger"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    const totalEl = document.getElementById('totalDeudaClientes');
    if (totalEl) {
        totalEl.innerText = `$${totalDeuda.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
    }
}

function filtrarClientes() {
    const texto = document.getElementById('buscarCliente').value.toLowerCase().trim();
    const soloDeudores = document.getElementById('filtroDeudores').checked;

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
    document.getElementById('formNuevoCliente').reset();
    document.getElementById('custId').value = '';
    document.getElementById('modalClienteTitulo').innerText = 'Nuevo Cliente';

    const modalEl = document.getElementById('modalNuevoCliente');
    modalClienteInstance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modalClienteInstance.show();
}

function abrirModalEditar(id) {
    const cliente = CLIENTES_CACHE.find(c => c.id === id);
    if (!cliente) return;

    document.getElementById('modalClienteTitulo').innerText = 'Editar Cliente';
    document.getElementById('custId').value = cliente.id;
    document.getElementById('custNombre').value = cliente.name || '';
    document.getElementById('custDni').value = cliente.dniCuit || '';
    document.getElementById('custTel').value = cliente.phone || '';
    document.getElementById('custLimite').value = cliente.creditLimit || 0;

    const modalEl = document.getElementById('modalNuevoCliente');
    modalClienteInstance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
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
            const modalEl = document.getElementById('modalNuevoCliente');
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) modalInstance.hide();

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
        html: `¿Estás seguro de que deseas eliminar a <b>${nombre}</b>?<br><small class="text-muted">Esta acción no se puede deshacer.</small>`,
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

        document.getElementById('historialTitulo').innerText = `Libreta: ${nombre.toUpperCase()}`;
        document.getElementById('filtroFechaDesde').value = '';
        document.getElementById('filtroFechaHasta').value = '';

        renderizarTablaMovimientos();

        const modalEl = document.getElementById('modalHistorialCliente');
        modalHistorialInstance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modalHistorialInstance.show();

    } catch (err) {
        console.error("Error cargando historial:", err);
        Swal.fire('Error', 'No se pudieron cargar los movimientos.', 'error');
    }
}

function aplicarFiltroFechas() {
    renderizarTablaMovimientos();
}

function limpiarFiltroFechas() {
    document.getElementById('filtroFechaDesde').value = '';
    document.getElementById('filtroFechaHasta').value = '';
    renderizarTablaMovimientos();
}

function renderizarTablaMovimientos() {
    const tbody = document.getElementById('listaMovimientos');
    if (!tbody) return;
    tbody.innerHTML = '';

    const desdeVal = document.getElementById('filtroFechaDesde').value;
    const hastaVal = document.getElementById('filtroFechaHasta').value;

    const fechaDesde = desdeVal ? new Date(`${desdeVal}T00:00:00`) : null;
    const fechaHasta = hastaVal ? new Date(`${hastaVal}T23:59:59`) : null;

    // Ordenamiento cronológico previo para el cálculo acumulado
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

        if (fechaDesde && fechaMov < fechaDesde) incluir = false;
        if (fechaHasta && fechaMov > fechaHasta) incluir = false;

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

            let subtotalPuro = 0;
            if (esVenta && m.itemsDetail && m.itemsDetail.length > 0) {
                subtotalPuro = m.itemsDetail.reduce((acc, item) => {
                    const sub = item.subtotal !== undefined ? parseFloat(item.subtotal) : ((parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 1));
                    return acc + sub;
                }, 0);
            }

            let descuento = parseFloat(m.discount || m.discountAmount) || 0;
            let recargo = parseFloat(m.surcharge || m.surchargeAmount || m.recargo) || 0;

            if (esVenta && subtotalPuro > 0) {
                const diferencia = montoFinal - (subtotalPuro - descuento);
                if (diferencia > 0.01 && recargo === 0) recargo = diferencia;
            }

            const icono = esVenta
                ? '<i class="bi bi-receipt text-primary me-2"></i>'
                : '<i class="bi bi-cash-stack text-success me-2"></i>';

            let badgesAdicionales = '';
            if (esVenta) {
                if (descuento > 0) badgesAdicionales += `<span class="badge bg-danger-subtle text-danger ms-1" style="font-size: 0.65rem;">DESC. -$${descuento.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>`;
                if (recargo > 0) badgesAdicionales += `<span class="badge bg-warning-subtle text-warning-emphasis ms-1" style="font-size: 0.65rem;">RECARGO +$${recargo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>`;
            }

            const filaPrincipal = `
                <tr class="align-middle" style="cursor: ${esVenta ? 'pointer' : 'default'};" ${esVenta ? `onclick="toggleDetalle(${idx})"` : ''}>
                    <td class="ps-4 text-muted" style="font-size: 0.75rem;">${fecha}</td>
                    <td>
                        <div class="d-flex align-items-center">
                            ${icono}
                            <div>
                                <span class="${esVenta ? 'text-dark' : 'text-success fw-bold'}">${m.description || (esVenta ? 'Venta' : 'Pago libreta')}</span>
                                ${badgesAdicionales}
                            </div>
                            ${esVenta ? `<i id="icon-${idx}" class="bi bi-chevron-down ms-2 text-primary small"></i>` : ''}
                        </div>
                    </td>
                    <td class="text-end text-danger fw-bold">${esVenta ? '+$' + montoFinal.toLocaleString('es-AR', { minimumFractionDigits: 2 }) : ''}</td>
                    <td class="text-end text-success fw-bold">${!esVenta ? '-$' + montoFinal.toLocaleString('es-AR', { minimumFractionDigits: 2 }) : ''}</td>
                    <td class="pe-4 text-end fw-bold text-secondary">$${m.saldoMomentaneo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                </tr>
            `;

            let detalleHtml = '';
            if (esVenta) {
                let itemsLista = '<p class="text-muted small p-2 m-0">Detalle de productos no disponible.</p>';

                if (m.itemsDetail && m.itemsDetail.length > 0) {
                    itemsLista = m.itemsDetail.map(i => {
                        const subItem = i.subtotal !== undefined ? parseFloat(i.subtotal) : ((parseFloat(i.price) || 0) * (parseFloat(i.quantity) || 1));
                        return `
                            <div class="d-flex justify-content-between border-bottom py-1">
                                <span class="text-uppercase" style="font-size: 0.75rem;">${i.quantity}x ${(i.productName || i.nombre || 'Producto')}</span>
                                <span class="fw-bold small">$${subItem.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                            </div>
                        `;
                    }).join('');

                    itemsLista += `
                        <div class="mt-3 p-2 bg-white border rounded border-dashed">
                            <div class="d-flex justify-content-between small text-muted">
                                <span>Subtotal Productos:</span>
                                <span>$${subtotalPuro.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            ${descuento > 0 ? `
                            <div class="d-flex justify-content-between small text-danger fw-bold mt-1">
                                <span>Descuento aplicado:</span>
                                <span>-$${descuento.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                            </div>` : ''}
                            ${recargo > 0 ? `
                            <div class="d-flex justify-content-between small text-warning fw-bold mt-1">
                                <span>Recargo Aplicado:</span>
                                <span>+$${recargo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                            </div>` : ''}
                            <div class="d-flex justify-content-between mt-2 border-top border-secondary pt-1">
                                <span class="fw-bold text-dark text-uppercase small">Impacto en Libreta:</span>
                                <span class="fw-bold text-primary fs-5">$${montoFinal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    `;
                }

                const nombreSeguro = CLIENTE_ACTUAL.nombre.replace(/'/g, "\\'").replace(/"/g, '&quot;');

                detalleHtml = `
                    <tr id="detalle-${idx}" class="d-none bg-light">
                        <td colspan="5" class="p-3">
                            <div class="card card-body border-0 shadow-sm mx-4" style="background-color: #fdfdfd; border-left: 4px solid #1e3a8a !important;">
                                <h6 class="small fw-bold text-primary mb-3"><i class="bi bi-box-seam me-1"></i> DETALLE DE COMPRA:</h6>
                                ${itemsLista}
                                <div class="text-end mt-3">
                                    <button class="btn btn-sm btn-success px-3 shadow-sm rounded-pill fw-bold"
                                        onclick="event.stopPropagation(); compartirWhatsApp('${nombreSeguro}', '${CLIENTE_ACTUAL.telefono}', '${fecha}', ${montoFinal}, '${encodeURIComponent(JSON.stringify(m.itemsDetail || []))}', ${descuento}, ${recargo})">
                                        <i class="bi bi-whatsapp me-1"></i> Enviar ticket
                                    </button>
                                </div>
                            </div>
                        </td>
                    </tr>
                `;
            }

            tbody.innerHTML += filaPrincipal + detalleHtml;
        });
    }

    const subEl = document.getElementById('historialSubtitulo');
    if (subEl) {
        subEl.innerText = `Deuda Total Actual: $${saldoAcumulado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
    }
}

// ==========================================
// 5. REGISTRO DE PAGOS / COBROS
// ==========================================

async function registrarPago(id) {
    const { value: formValues } = await Swal.fire({
        title: 'Registrar Cobro de Libreta',
        html:
            `<div class="text-start mb-2"><label class="small fw-bold text-muted">Monto que entrega el cliente ($):</label></div>` +
            `<input id="swal-input1" class="form-control form-control-lg border mb-3 text-primary fw-bold" type="number" step="0.01" placeholder="0.00">` +
            `<div class="text-start mb-2"><label class="small fw-bold text-muted">Método de Ingreso:</label></div>` +
            `<select id="swal-input2" class="form-select form-select-lg border">
                <option value="EFECTIVO">Efectivo</option>
                <option value="TRANSFERENCIA">Transferencia / Mercado Pago</option>
            </select>`,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Confirmar Ingreso',
        cancelButtonText: 'Cancelar',
        customClass: {
            confirmButton: 'btn btn-primary px-4 py-2 me-2',
            cancelButton: 'btn btn-secondary px-4 py-2'
        },
        buttonsStyling: false,
        preConfirm: () => {
            const montoVal = document.getElementById('swal-input1').value;
            const metodoVal = document.getElementById('swal-input2').value;
            if (!montoVal || parseFloat(montoVal) <= 0) {
                Swal.showValidationMessage('Ingresa un monto válido mayor a 0');
                return false;
            }
            return { monto: parseFloat(montoVal), metodo: metodoVal };
        }
    });

    if (formValues) {
        try {
            const resp = await apiFetch(`${API_CUSTOMERS}/${id}/payments`, {
                method: 'POST',
                body: JSON.stringify({
                    amount: formValues.monto,
                    method: formValues.metodo,
                    paymentMethod: formValues.metodo,
                    description: `Cobro de libreta - ${formValues.metodo}`
                })
            });

            if (resp && resp.ok) {
                Swal.fire('¡Ingreso Registrado!', `Se ingresaron $${formValues.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })} a tu caja (${formValues.metodo})`, 'success');
                await cargarClientes();

                if (typeof cargarDatosDashboard === "function") cargarDatosDashboard();
                if (typeof actualizarBalanceGlobal === "function") actualizarBalanceGlobal();
            } else if (resp) {
                const errData = await resp.json().catch(() => ({}));
                Swal.fire('Error', errData.message || 'No se pudo procesar el pago', 'error');
            }
        } catch (err) {
            console.error("Error en cobro de libreta:", err);
            Swal.fire('Error', 'No se pudo registrar el pago en el sistema', 'error');
        }
    }
}

// ==========================================
// 6. UTILIDADES E INTEGRACIÓN CON WHATSAPP
// ==========================================

window.toggleDetalle = function(index) {
    const el = document.getElementById(`detalle-${index}`);
    const icono = document.getElementById(`icon-${index}`);
    if (el) {
        if (el.classList.contains('d-none')) {
            el.classList.remove('d-none');
            if (icono) icono.classList.replace('bi-chevron-down', 'bi-chevron-up');
        } else {
            el.classList.add('d-none');
            if (icono) icono.classList.replace('bi-chevron-up', 'bi-chevron-down');
        }
    }
};

window.compartirWhatsApp = function(nombreCliente, telefono, fecha, total, itemsEncoded, descuento = 0, recargo = 0) {
    if (!telefono || telefono === "null" || telefono === "") {
        return Swal.fire('Atención', 'El cliente no tiene un teléfono registrado.', 'warning');
    }

    let items = [];
    try {
        items = JSON.parse(decodeURIComponent(itemsEncoded));
    } catch (e) {
        items = [];
    }

    const local = DATOS_EMPRESA?.name?.toUpperCase() || "BAEZ POS";
    const direccion = DATOS_EMPRESA?.address || "";
    const mensajePie = DATOS_EMPRESA?.ticketMessage || '¡Muchas gracias por su compra!';

    const totalNum = typeof total === 'number' ? total : parseFloat(String(total).replace(/\./g, '').replace(',', '.')) || 0;
    const descNum = parseFloat(descuento) || 0;
    const recNum = parseFloat(recargo) || 0;

    let subtotalItems = 0;
    items.forEach(i => {
        subtotalItems += i.subtotal !== undefined ? parseFloat(i.subtotal) : ((parseFloat(i.price) || 0) * (parseFloat(i.quantity) || 1));
    });

    let texto = `┏━━━━━━━━━━━━━━━━━━━━┓%0A`;
    texto += `  🏪  *${local}*%0A`;
    if (direccion) texto += `  📍  _${direccion}_%0A`;
    texto += `┗━━━━━━━━━━━━━━━━━━━━┛%0A%0A`;

    texto += `*🧾 COMPROBANTE DE COMPRA*%0A`;
    texto += `------------------------------------------%0A`;
    texto += `*👤 CLIENTE:* ${nombreCliente.toUpperCase()}%0A`;
    texto += `*📅 FECHA:* ${fecha}%0A`;
    texto += `*💳 PAGO:* LIBRETA (A CUENTA)%0A`;
    texto += `------------------------------------------%0A%0A`;

    if (items.length > 0) {
        texto += `*🛒 DETALLE DE PRODUCTOS:*%0A`;
        items.forEach(i => {
            const sub = i.subtotal !== undefined ? parseFloat(i.subtotal) : ((parseFloat(i.price) || 0) * (parseFloat(i.quantity) || 1));
            texto += `▪️ ${i.quantity}x ${(i.productName || i.nombre || 'Producto').toUpperCase()}%0A`;
            texto += `      Subtotal: *$${sub.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}*%0A`;
        });
        texto += `------------------------------------------%0A`;
        texto += `*Subtotal:* $${subtotalItems.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%0A`;
    }

    if (descNum > 0) {
        texto += `*DESCUENTO:* -$${descNum.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%0A`;
    }

    if (recNum > 0) {
        texto += `*RECARGO LIBRETA:* +$${recNum.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%0A`;
    }

    texto += `%0A------------------------------------------%0A`;
    texto += `*💰 TOTAL FINAL: $${totalNum.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}*%0A`;
    texto += `------------------------------------------%0A%0A`;

    texto += `💬 _${mensajePie}_%0A%0A`;
    texto += `*¡Tu saldo ha sido actualizado en la libreta!*%0A%0A`;
    texto += `✨ _Generado por BaezPOS_`;

    const numLimpio = telefono.replace(/\D/g, '');
    window.open(`https://wa.me/${numLimpio}?text=${encodeURIComponent(texto)}`, '_blank');
};

// Exposición explícita en window para llamadas desde HTML
window.abrirModalEditar = abrirModalEditar;
window.verHistorial = verHistorial;
window.registrarPago = registrarPago;
window.eliminarCliente = eliminarCliente;
window.abrirModalNuevoCliente = abrirModalNuevoCliente;
window.guardarCliente = guardarCliente;
window.filtrarClientes = filtrarClientes;
window.aplicarFiltroFechas = aplicarFiltroFechas;
window.limpiarFiltroFechas = limpiarFiltroFechas;