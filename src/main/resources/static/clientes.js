/**
 * BAEZ POS - GESTIÓN DE CLIENTES Y CUENTA CORRIENTE (LIBRETA)
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

let paginaActual = 1;
let totalPaginasBackend = 1;
let totalElementosBackend = 0;
const LIMITE_POR_PAGINA = 20;
let debounceBuscarClientesTimer = null;

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
 * Obtiene el nombre del comercio desde DATOS_EMPRESA, sesión o DOM.
 */
function obtenerNombreNegocio() {
    if (DATOS_EMPRESA && DATOS_EMPRESA.name) {
        return DATOS_EMPRESA.name.trim();
    }
    try {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            const parsed = JSON.parse(storedUser);
            if (parsed.companyName) return parsed.companyName.trim();
            if (parsed.company?.name) return parsed.company.name.trim();
        }
    } catch (e) {}
    try {
        const sessionComp = sessionStorage.getItem('companyName');
        if (sessionComp && sessionComp.trim() !== '') return sessionComp.trim();
    } catch (e) {}
    const domComp = document.getElementById('companyName') || document.getElementById('companyNameNav');
    if (domComp && domComp.textContent && domComp.textContent.trim() !== '') {
        return domComp.textContent.trim();
    }
    return "BaezPOS";
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
    try {
        await Promise.all([cargarDatosEmpresa(), cargarClientes(0)]);
    } finally {
        if (typeof ocultarPantallaDeCarga === 'function') {
            ocultarPantallaDeCarga();
        }
    }

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
// 2. LÓGICA Y CARGA DE CLIENTES (PAGINADA)
// ==========================================

async function cargarClientes(pagina = 0) {
    try {
        const resp = await apiFetch(`${API_CUSTOMERS}?page=${pagina}&size=${LIMITE_POR_PAGINA}&sort=name,asc`);
        if (!resp || !resp.ok) throw new Error("Error al obtener clientes");

        const data = await resp.json();
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

        CLIENTES_CACHE = lista;
        renderizarClientes(CLIENTES_CACHE);

        const inicio = (paginaActual - 1) * LIMITE_POR_PAGINA;
        const fin = inicio + CLIENTES_CACHE.length;
        renderizarControlesPaginacion(totalElementosBackend, totalPaginasBackend, inicio, fin);
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
                    `<button type="button" class="btn btn-sm btn-outline-success fw-bold d-inline-flex align-items-center gap-1.5" title="Enviar recordatorio WhatsApp" data-action="whatsapp" data-id="${c.id}">
                        <i class="fab fa-whatsapp"></i> <span class="d-none d-md-inline">Recordatorio</span>
                    </button>` :
                    '<span class="text-muted small">Sin contacto</span>'
                }
            </td>
            <td class="text-end">
                <span class="balance-badge ${badgeClass}">${formatCurrency(saldo)}</span>
            </td>
            <td class="text-end pe-3">
                <div class="d-flex justify-content-end gap-2">
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
            btnWsCol.onclick = () => enviarRecordatorioWhatsApp(c.phone, saldo, c.name);
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

function renderizarControlesPaginacion(totalItems, totalPaginas, inicio, fin) {
    const infoText = document.getElementById('infoPaginacion');
    const contenedor = document.getElementById('paginacionContenedor');

    if (infoText) {
        if (totalItems === 0) {
            infoText.innerText = "Mostrando 0 clientes";
        } else {
            const limiteSuperior = fin > totalItems ? totalItems : fin;
            infoText.innerText = `Mostrando ${inicio + 1} - ${limiteSuperior} de ${totalItems} clientes`;
        }
    }

    if (!contenedor) return;
    contenedor.innerHTML = '';

    if (totalPaginas <= 1) return;

    let html = '';

    // Botón Anterior
    html += `
        <li class="page-item ${paginaActual === 1 ? 'disabled' : ''}">
            <button class="page-link" onclick="cambiarPaginaClientes(${paginaActual - 1})"><i class="bi bi-chevron-left"></i></button>
        </li>
    `;

    const maxPaginasVisibles = 5;
    let pagInicio = Math.max(1, paginaActual - Math.floor(maxPaginasVisibles / 2));
    let pagFin = Math.min(totalPaginas, pagInicio + maxPaginasVisibles - 1);

    if (pagFin - pagInicio + 1 < maxPaginasVisibles) {
        pagInicio = Math.max(1, pagFin - maxPaginasVisibles + 1);
    }

    if (pagInicio > 1) {
        html += `<li class="page-item"><button class="page-link" onclick="cambiarPaginaClientes(1)">1</button></li>`;
        if (pagInicio > 2) html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
    }

    for (let i = pagInicio; i <= pagFin; i++) {
        html += `
            <li class="page-item ${i === paginaActual ? 'active' : ''}">
                <button class="page-link" onclick="cambiarPaginaClientes(${i})">${i}</button>
            </li>
        `;
    }

    if (pagFin < totalPaginas) {
        if (pagFin < totalPaginas - 1) html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        html += `<li class="page-item"><button class="page-link" onclick="cambiarPaginaClientes(${totalPaginas})">${totalPaginas}</button></li>`;
    }

    // Botón Siguiente
    html += `
        <li class="page-item ${paginaActual === totalPaginas ? 'disabled' : ''}">
            <button class="page-link" onclick="cambiarPaginaClientes(${paginaActual + 1})"><i class="bi bi-chevron-right"></i></button>
        </li>
    `;

    contenedor.innerHTML = html;
}

function cambiarPaginaClientes(nuevaPagina) {
    if (nuevaPagina < 1 || nuevaPagina > totalPaginasBackend) return;
    cargarClientes(nuevaPagina - 1);
}

function filtrarClientes() {
    clearTimeout(debounceBuscarClientesTimer);
    debounceBuscarClientesTimer = setTimeout(async () => {
        const texto = (document.getElementById('buscarCliente')?.value || '').trim();
        const soloDeudores = document.getElementById('filtroDeudores')?.checked || false;

        if (!texto && !soloDeudores) {
            cargarClientes(0);
            return;
        }

        try {
            const url = texto
                ? `${API_CUSTOMERS}/search?q=${encodeURIComponent(texto)}&size=100`
                : `${API_CUSTOMERS}?page=0&size=100&sort=name,asc`;
            const resp = await apiFetch(url);
            if (!resp || !resp.ok) return;

            let data = await resp.json();
            let lista = Array.isArray(data.content) ? data.content : (Array.isArray(data) ? data : []);

            if (soloDeudores) {
                lista = lista.filter(c => (parseFloat(c.currentBalance) || 0) > 0);
            }

            CLIENTES_CACHE = lista;
            paginaActual = 1;
            totalPaginasBackend = 1;
            totalElementosBackend = lista.length;

            renderizarClientes(CLIENTES_CACHE);
            renderizarControlesPaginacion(totalElementosBackend, totalPaginasBackend, 0, CLIENTES_CACHE.length);
        } catch (err) {
            console.error("Error buscando clientes:", err);
        }
    }, 300);
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
            Swal.fire({ icon: 'success', title: '¡Éxito!', text: 'Cliente guardado correctamente.', timer: 2000, showConfirmButton: false });
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
        // Inicializar inputs de fecha con la fecha actual (Hoy) antes de disparar la consulta
        const hoy = new Date().toISOString().split('T')[0];
        const inputDesde = document.getElementById('filtroFechaDesde');
        const inputHasta = document.getElementById('filtroFechaHasta');
        if (inputDesde) inputDesde.value = hoy;
        if (inputHasta) inputHasta.value = hoy;

        const resp = await apiFetch(`${API_CUSTOMERS}/${id}/movements`);
        if (!resp || !resp.ok) throw new Error("Error al obtener movimientos");

        MOVIMIENTOS_CACHE = await resp.json();
        CLIENTE_ACTUAL = { id, nombre, telefono };

        const titEl = document.getElementById('historialTitulo');
        if (titEl) {
            titEl.className = 'fw-bold m-0 d-flex align-items-center gap-2 text-white';
            titEl.innerHTML = `<i class="bi bi-journal-bookmark-fill text-white"></i> Libreta: ${sanitizeHTML(nombre.toUpperCase())}`;
        }

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

const abrirModalDetallesCliente = verHistorial;
window.abrirModalDetallesCliente = abrirModalDetallesCliente;

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
                    <i class="bi bi-calendar-x fs-3 d-block mb-1 text-secondary"></i>
                    No se encontraron movimientos para el rango seleccionado.
                    <div class="mt-2">
                        <button class="btn btn-sm btn-outline-primary fw-bold" onclick="limpiarFiltroFechas()">
                            <i class="bi bi-calendar-check me-1"></i> Ver Todo el Historial
                        </button>
                    </div>
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
                ? '<i class="bi bi-receipt text-primary me-2 fs-6"></i>'
                : '<i class="bi bi-cash-stack text-success me-2 fs-6"></i>';

            let badgesAdicionales = '';
            if (esVenta) {
                if (descuento > 0) badgesAdicionales += `<span class="badge bg-danger-subtle text-danger ms-1" style="font-size: 0.65rem;">DESC. -${formatCurrency(descuento)}</span>`;
                if (recargo > 0) badgesAdicionales += `<span class="badge bg-warning-subtle text-warning-emphasis ms-1" style="font-size: 0.65rem;">RECARGO +${formatCurrency(recargo)}</span>`;
            }

            const badgeDebe = esVenta
                ? `<span class="badge rounded-pill bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-2.5 py-1.5 fw-bold font-monospace">+${formatCurrency(montoFinal)}</span>`
                : '<span class="text-muted small">-</span>';

            const badgeHaber = !esVenta
                ? `<span class="badge rounded-pill bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2.5 py-1.5 fw-bold font-monospace">-${formatCurrency(montoFinal)}</span>`
                : '<span class="text-muted small">-</span>';

            const badgeSaldo = `<span class="badge rounded-pill ${m.saldoMomentaneo > 0 ? 'bg-secondary bg-opacity-10 text-dark border' : (m.saldoMomentaneo < 0 ? 'bg-info bg-opacity-10 text-info border border-info border-opacity-25' : 'bg-success bg-opacity-10 text-success border border-success border-opacity-25')} px-2.5 py-1.5 fw-bold font-monospace">${formatCurrency(m.saldoMomentaneo)}</span>`;

            const trPrincipal = document.createElement('tr');
            trPrincipal.className = 'align-middle';
            trPrincipal.style.cursor = esVenta ? 'pointer' : 'default';
            if (esVenta) trPrincipal.onclick = () => toggleDetalle(idx);

            trPrincipal.innerHTML = `
                <td class="ps-3 py-3 text-muted" style="font-size: 0.78rem;">${fecha}</td>
                <td class="py-3">
                    <div class="d-flex align-items-center">
                        ${icono}
                        <div>
                            <span class="${esVenta ? 'text-dark fw-semibold' : 'text-success fw-bold'}">${sanitizeHTML(m.description || (esVenta ? 'Venta' : 'Pago de Libreta'))}</span>
                            ${badgesAdicionales}
                        </div>
                        ${esVenta ? `<i id="icon-${idx}" class="bi bi-chevron-down ms-2 text-primary small"></i>` : ''}
                    </div>
                </td>
                <td class="text-end py-3">${badgeDebe}</td>
                <td class="text-end py-3">${badgeHaber}</td>
                <td class="pe-3 text-end py-3">${badgeSaldo}</td>
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
        if (saldoAcumulado > 0) {
            subEl.className = 'badge rounded-pill bg-danger bg-opacity-25 text-danger-emphasis border border-danger border-opacity-50 px-3 py-1.5 fs-6 fw-bold shadow-sm';
            subEl.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-1.5 text-danger"></i> Deuda Total Actual: <span class="text-danger fw-black">${formatCurrency(saldoAcumulado)}</span>`;
        } else if (saldoAcumulado < 0) {
            subEl.className = 'badge rounded-pill bg-info bg-opacity-25 text-info-emphasis border border-info border-opacity-50 px-3 py-1.5 fs-6 fw-bold shadow-sm';
            subEl.innerHTML = `<i class="bi bi-info-circle-fill me-1.5 text-info"></i> Saldo a Favor: <span class="text-info fw-black">${formatCurrency(Math.abs(saldoAcumulado))}</span>`;
        } else {
            subEl.className = 'badge rounded-pill bg-success bg-opacity-25 text-success-emphasis border border-success border-opacity-50 px-3 py-1.5 fs-6 fw-bold shadow-sm';
            subEl.innerHTML = `<i class="bi bi-check-circle-fill me-1.5 text-success"></i> Al Día: <span class="text-success fw-black">${formatCurrency(0)}</span>`;
        }
    }

    const btnWsModal = document.getElementById('btnWhatsappModal');
    if (btnWsModal) {
        if (CLIENTE_ACTUAL.telefono) {
            btnWsModal.classList.remove('d-none');
            btnWsModal.classList.add('d-inline-flex');
            btnWsModal.onclick = () => enviarRecordatorioWhatsApp(CLIENTE_ACTUAL.telefono, saldoAcumulado, CLIENTE_ACTUAL.name || CLIENTE_ACTUAL.nombre);
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

    const nombreNegocio = obtenerNombreNegocio();
    const clienteNombre = nombreCliente ? String(nombreCliente).trim() : 'Cliente';
    const totalNum = parseFloat(total) || 0;
    const totalFormateado = (typeof formatCurrency === 'function' ? formatCurrency(totalNum).replace('$', '').trim() : totalNum.toFixed(2));

    let detalleTexto = '';
    if (Array.isArray(items) && items.length > 0) {
        detalleTexto = items.map(i => {
            const sub = i.subtotal !== undefined ? parseFloat(i.subtotal) : ((parseFloat(i.price) || 0) * (parseFloat(i.quantity) || 1));
            const cantidad = formatQuantity(i.quantity, i.isFractional);
            const producto = (i.productName || i.nombre || 'Producto').trim();
            const precio = typeof formatCurrency === 'function' ? formatCurrency(sub).replace('$', '').trim() : sub.toFixed(2);
            return `${cantidad} x ${producto} - $${precio}`;
        }).join('\n');
    } else {
        detalleTexto = `1 x Compra en Libreta - $${totalFormateado}`;
    }

    const texto = `*TICKET DE COMPRA - ${nombreNegocio}*

*Cliente:* ${clienteNombre}
*Fecha:* ${fecha}

*Detalle:*
${detalleTexto}

*TOTAL FINAL: $${totalFormateado}*

¡Muchas gracias por su compra!`;

    const numLimpio = String(telefono).replace(/\D/g, '');
    window.open(`https://wa.me/${numLimpio}?text=${encodeURIComponent(texto)}`, '_blank');
}

/**
 * Envía recordatorio oficial de saldo pendiente por WhatsApp
 */
function enviarRecordatorioWhatsApp(telefono, saldo, nombre) {
    if (!telefono || telefono === "null" || telefono === "") {
        return Swal.fire('Atención', 'El cliente no tiene un número de teléfono registrado.', 'warning');
    }
    const numLimpio = String(telefono).replace(/\D/g, '');
    const saldoFormateado = (typeof formatCurrency === 'function' ? formatCurrency(saldo) : `$${(parseFloat(saldo) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    const clienteNombre = nombre ? String(nombre).trim() : 'estimado/a cliente';
    const nombreNegocio = obtenerNombreNegocio();

    const mensaje = `Hola ${clienteNombre}, nos comunicamos de *${nombreNegocio}* para recordarte que tu saldo de cuenta corriente es de ${saldoFormateado}. ¡Cualquier consulta estamos a tu disposición, muchas gracias!`;
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
window.abrirModalDetallesCliente = verHistorial;