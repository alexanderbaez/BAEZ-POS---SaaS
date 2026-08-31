/**
 * BÁEZ POS - PANEL MAESTRO SUPER ADMIN & SEGURIDAD SAAS
 */

const API_BASE = '/super-admin/companies';
const LOGS_BASE = '/logs';

let modalEdicion = null;
let modalMovimientos = null;
let todasLasEmpresas = [];

// Variables para control de paginación de Logs
let todosLosLogs = [];
let paginaActualLogs = 1;
const LOGS_POR_PAGINA = 20;

function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function parsearMonto(valor) {
    if (valor === null || valor === undefined) return 0;
    if (typeof valor === 'number') return isNaN(valor) ? 0 : valor;

    let str = String(valor).trim();
    if (str.includes(',') && str.includes('.')) {
        str = str.replace(/\./g, '').replace(',', '.');
    } else if (str.includes(',')) {
        str = str.replace(',', '.');
    }

    const limpio = str.replace(/[^0-9.-]/g, '');
    const num = parseFloat(limpio);
    return isNaN(num) ? 0 : num;
}

function esEmailValido(email) {
    if (!email) return false;
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return regex.test(email);
}

async function extraerMensajeError(resp) {
    try {
        const contentType = resp.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            const data = await resp.json();
            return data.message || data.error || 'Ocurrió un error en la solicitud.';
        } else {
            const text = await resp.text();
            return text || `Error HTTP ${resp.status}`;
        }
    } catch (e) {
        return `Error procesando la respuesta (${resp.status})`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const rolActual = (sessionStorage.getItem('baezpos_user_role') || '').toUpperCase().trim();
    const token = sessionStorage.getItem('baezpos_token');

    if (!token || (!rolActual.includes('SUPER_ADMIN') && !rolActual.includes('SUPERADMIN'))) {
        console.error("Acceso denegado: Se requiere sesión activa de SUPER_ADMIN.");
        window.location.href = 'login.html';
        return;
    }

    const elModalEdit = document.getElementById('modalEditar');
    if (elModalEdit) modalEdicion = new bootstrap.Modal(elModalEdit);

    const elModalMov = document.getElementById('modalMovimientos');
    if (elModalMov) modalMovimientos = new bootstrap.Modal(elModalMov);

    const buscador = document.getElementById('buscadorEmpresas');
    if (buscador) {
        buscador.addEventListener('input', (e) => filtrarEmpresas(e.target.value));
    }

    setInterval(cargarLogs, 30000);
    cargarTodo();
});

function cargarTodo() {
    cargarEmpresas();
    cargarLogs();
}

async function cargarEmpresas() {
    try {
        const resp = await apiFetch(API_BASE);
        if (!resp) return;

        if (!resp.ok) {
            const errorMsg = await extraerMensajeError(resp);
            if (typeof Swal !== 'undefined') Swal.fire('Error', errorMsg, 'error');
            return;
        }

        todasLasEmpresas = await resp.json();
        renderizarTabla(todasLasEmpresas);
        actualizarKpis(todasLasEmpresas);
    } catch (err) {
        console.error("Error al cargar empresas:", err);
    }
}

function renderizarTabla(empresas) {
    const tbody = document.getElementById('tablaEmpresas');
    if (!tbody) return;

    if (!empresas || empresas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center p-4 text-muted">No hay comercios registrados aún.</td></tr>';
        return;
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const fragment = document.createDocumentFragment();

    empresas.forEach(empresa => {
        const tr = document.createElement('tr');

        let fechaVenc = null;
        if (empresa.expirationDate) {
            const partes = String(empresa.expirationDate).split('T')[0].split('-');
            if (partes.length === 3) {
                fechaVenc = new Date(partes[0], partes[1] - 1, partes[2], 23, 59, 59);
            }
        }

        const estaVencida = fechaVenc && fechaVenc < hoy;
        const estaInactiva = empresa.active === false || estaVencida;

        if (estaInactiva) {
            tr.classList.add('row-vencido');
        }

        const badge = estaInactiva
            ? `<span class="badge rounded-pill bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-3 py-1"><i class="bi bi-x-circle me-1"></i>SUSPENDIDO</span>`
            : `<span class="badge rounded-pill bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-3 py-1"><i class="bi bi-check-all me-1"></i>ACTIVO</span>`;

        const cleanPhone = empresa.phone ? empresa.phone.replace(/\D/g, '') : '';
        const rawFee = empresa.monthlyFee ?? empresa.monthly_fee ?? 0;
        const abonoValor = parsearMonto(rawFee);
        const abonoFormateado = '$ ' + abonoValor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        tr.innerHTML = `
            <td class="ps-3">
                <div class="d-flex align-items-center gap-3">
                    <div class="rounded-3 bg-primary bg-opacity-10 p-2 text-primary">
                        <i class="bi bi-building fs-5"></i>
                    </div>
                    <div>
                        <div class="fw-bold text-white">${escapeHTML(empresa.name)}</div>
                        <div class="text-muted" style="font-size: 0.75rem;">CUIT: ${escapeHTML(empresa.taxId) || 'N/A'}</div>
                    </div>
                </div>
            </td>
            <td>
                <div class="fw-bold text-white small">${escapeHTML(empresa.adminName || empresa.ownerName || 'Sin Nombre')}</div>
                <div class="text-white-50" style="font-size: 0.75rem;">${escapeHTML(empresa.email || '-')}</div>
            </td>
            <td><span class="text-white small fw-bold">${abonoFormateado}</span></td>
            <td><div class="fw-bold small text-white">${escapeHTML(empresa.expirationDate) || 'Sin Fecha'}</div></td>
            <td>${badge}</td>
            <td class="text-end pe-3">
                <div class="d-flex justify-content-end gap-1">
                    <button class="btn-action bg-dark text-warning border border-warning border-opacity-25" title="Renovar +30 Días" data-action="renovar" data-id="${empresa.id}"><i class="bi bi-calendar-plus-fill"></i></button>
                    <button class="btn-action bg-dark text-success border border-success border-opacity-25" title="Ver Movimientos" data-action="movimientos" data-id="${empresa.id}" data-name="${escapeHTML(empresa.name)}"><i class="bi bi-eye-fill"></i></button>
                    <button class="btn-action bg-dark text-info border border-info border-opacity-25" title="Editar Comercio" data-action="editar" data-id="${empresa.id}"><i class="bi bi-pencil-fill"></i></button>
                    <button class="btn-action bg-dark text-success border border-success border-opacity-25" title="WhatsApp" data-action="whatsapp" data-phone="${cleanPhone}" data-name="${escapeHTML(empresa.name)}"><i class="bi bi-whatsapp"></i></button>
                    <button class="btn-action bg-dark text-danger border border-danger border-opacity-25" title="Eliminar" data-action="eliminar" data-id="${empresa.id}"><i class="bi bi-trash3"></i></button>
                </div>
            </td>
        `;

        fragment.appendChild(tr);
    });

    tbody.innerHTML = '';
    tbody.appendChild(fragment);

    tbody.onclick = (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;

        const action = btn.dataset.action;
        const id = Number(btn.dataset.id);

        if (action === 'renovar') renovarSuscripcion(id);
        if (action === 'movimientos') verMovimientos(id, btn.dataset.name);
        if (action === 'editar') prepararEdicion(id);
        if (action === 'eliminar') eliminarEmpresa(id);
        if (action === 'whatsapp') {
            const phone = btn.dataset.phone;
            const name = btn.dataset.name;
            const msg = encodeURIComponent(`Hola ${name}, te contacto desde la administración central de BáezPOS...`);
            window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
        }
    };
}

async function renovarSuscripcion(id) {
    const empresa = todasLasEmpresas.find(e => e.id === id);
    if (!empresa) return;

    const confirmar = typeof Swal !== 'undefined'
        ? (await Swal.fire({
            title: '¿Extender suscripción?',
            text: `Se sumarán 30 días a la suscripción de "${empresa.name}".`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#10b981',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'SÍ, RENOVAR',
            cancelButtonText: 'Cancelar'
        })).isConfirmed
        : confirm(`¿Extender suscripción de "${empresa.name}" en 30 días?`);

    if (confirmar) {
        try {
            const resp = await apiFetch(`${API_BASE}/${id}/extend`, { method: 'PATCH' });
            if (resp && resp.ok) {
                if (typeof Swal !== 'undefined') Swal.fire('¡Renovado!', 'Suscripción extendida 30 días.', 'success');
                cargarTodo();
            } else {
                const msg = await extraerMensajeError(resp);
                if (typeof Swal !== 'undefined') Swal.fire('Error', msg, 'error');
            }
        } catch (err) {
            if (typeof Swal !== 'undefined') Swal.fire('Error', 'Fallo en la comunicación.', 'error');
        }
    }
}

function actualizarKpis(empresas) {
    if (!Array.isArray(empresas)) return;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    let activos = 0, vencidos = 0, prontoVencer = 0;
    let estimadoMensual = 0;

    empresas.forEach(e => {
        const rawFee = e.monthlyFee ?? e.monthly_fee ?? 0;
        const abono = parsearMonto(rawFee);

        let fechaVenc = null;
        if (e.expirationDate) {
            const partes = String(e.expirationDate).split('T')[0].split('-');
            if (partes.length === 3) {
                fechaVenc = new Date(partes[0], partes[1] - 1, partes[2], 23, 59, 59);
            }
        }

        const esFechaValida = fechaVenc && !isNaN(fechaVenc.getTime());
        const estaVencida = esFechaValida && fechaVenc < hoy;
        const estaInactiva = e.active === false || estaVencida;

        if (!estaInactiva) {
            estimadoMensual += abono;
            activos++;
            if (esFechaValida) {
                const diffTime = fechaVenc - hoy;
                const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diasRestantes <= 7) {
                    prontoVencer++;
                }
            }
        } else {
            vencidos++;
        }
    });

    const setElem = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    };

    setElem('kpiTotal', empresas.length);
    setElem('kpiActivos', activos);
    setElem('kpiProntoVencer', prontoVencer);
    setElem('kpiVencidos', vencidos);

    const kpiGanancia = document.getElementById('kpiGanancia');
    if (kpiGanancia) {
        kpiGanancia.innerText = '$ ' + estimadoMensual.toLocaleString('es-AR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }
}

const formNueva = document.getElementById('formNuevaEmpresa');
if (formNueva) {
    formNueva.addEventListener('submit', async (e) => {
        e.preventDefault();

        const getVal = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
        const ownerEmail = getVal('masterEmail');

        if (!esEmailValido(ownerEmail)) {
            if (typeof Swal !== 'undefined') Swal.fire('Email Inválido', 'Por favor, ingrese un correo válido.', 'warning');
            return;
        }

        const btnSubmit = e.target.querySelector('button[type="submit"]');
        if (btnSubmit) btnSubmit.disabled = true;

        const companyName = getVal('masterNombre');
        const adminName = getVal('masterAdminName') || getVal('masterNombreOwner') || companyName;
        const nuevaEmpresaRequest = {
            companyName: companyName,
            taxId: getVal('masterTaxId'),
            phone: getVal('masterTelefono'),
            address: getVal('masterDireccion'),
            adminName: adminName,
            ownerName: adminName,
            ownerEmail: ownerEmail,
            ownerPassword: getVal('masterPass'),
            expirationDate: document.getElementById('masterVenc')?.value || null,
            monthlyFee: parsearMonto(getVal('masterAbono')),
            maxEmployees: parseInt(getVal('masterMaxEmployees') || '1', 10)
        };

        try {
            const resp = await apiFetch(API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nuevaEmpresaRequest)
            });

            if (resp && resp.ok) {
                if (typeof Swal !== 'undefined') Swal.fire('¡Registrado!', 'Comercio creado con éxito.', 'success');
                cargarTodo();
                e.target.reset();
            } else {
                const msg = await extraerMensajeError(resp);
                if (typeof Swal !== 'undefined') Swal.fire('Error', msg, 'error');
            }
        } catch (err) {
            if (typeof Swal !== 'undefined') Swal.fire('Error de Red', 'No se pudo conectar con el servidor.', 'error');
        } finally {
            if (btnSubmit) btnSubmit.disabled = false;
        }
    });
}

function prepararEdicion(id) {
    const empresa = todasLasEmpresas.find(e => e.id === id);
    if (!empresa) return;

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val !== undefined && val !== null ? val : ''; };

    setVal('editId', empresa.id);
    setVal('editNombre', empresa.name);
    setVal('editAdminName', empresa.adminName || empresa.ownerName || '');
    setVal('editTaxId', empresa.taxId);
    setVal('editEmail', empresa.email);
    setVal('editPhone', empresa.phone);
    setVal('editAddress', empresa.address);
    setVal('editVencimiento', empresa.expirationDate);
    setVal('editMonthlyFee', empresa.monthlyFee);
    setVal('editMaxEmployees', empresa.maxEmployees || 1);
    setVal('editTicketMessage', empresa.ticketMessage);
    setVal('editPass', '');
    setVal('editActive', empresa.active !== false ? "true" : "false");

    modalEdicion.show();
}

const formEdit = document.getElementById('formEditarEmpresa');
if (formEdit) {
    formEdit.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('editId').value;
        const editEmail = document.getElementById('editEmail').value.trim();
        const editAdminName = document.getElementById('editAdminName')?.value.trim();

        if (!esEmailValido(editEmail)) {
            if (typeof Swal !== 'undefined') Swal.fire('Email Inválido', 'Por favor, ingrese un correo válido.', 'warning');
            return;
        }

        const payload = {
            id: Number(id),
            name: document.getElementById('editNombre').value.trim(),
            adminName: editAdminName || null,
            ownerName: editAdminName || null,
            taxId: document.getElementById('editTaxId').value.trim(),
            email: editEmail,
            phone: document.getElementById('editPhone').value.trim(),
            address: document.getElementById('editAddress').value.trim(),
            expirationDate: document.getElementById('editVencimiento').value || null,
            monthlyFee: parsearMonto(document.getElementById('editMonthlyFee')?.value),
            maxEmployees: parseInt(document.getElementById('editMaxEmployees')?.value || '1', 10),
            ticketMessage: document.getElementById('editTicketMessage')?.value || '',
            active: document.getElementById('editActive').value === "true",
            ownerPassword: document.getElementById('editPass').value.trim() || null
        };

        try {
            const resp = await apiFetch(`${API_BASE}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (resp && resp.ok) {
                modalEdicion.hide();
                if (typeof Swal !== 'undefined') Swal.fire('¡Actualizado!', 'Datos guardados correctamente.', 'success');
                cargarTodo();
            } else {
                const msg = await extraerMensajeError(resp);
                if (typeof Swal !== 'undefined') Swal.fire('Error', msg, 'error');
            }
        } catch (err) {
            if (typeof Swal !== 'undefined') Swal.fire('Error', 'Fallo al guardar cambios.', 'error');
        }
    });
}

// MOVIMIENTOS Y AUDITORÍA DE UN CLIENTE
async function verMovimientos(id, nombreComercio) {
    document.getElementById('lblClienteMov').innerText = nombreComercio;
    document.getElementById('detTotalVentas').innerText = "â€”";
    document.getElementById('detVolumen').innerText = "$ â€”";
    document.getElementById('detUltimaAct').innerText = "Cargando...";

    const tbodyMov = document.getElementById('tablaMovimientosCliente');
    tbodyMov.innerHTML = '<tr><td colspan="4" class="text-center text-muted p-3">Buscando actividad reciente...</td></tr>';

    modalMovimientos.show();

    try {
        const resp = await apiFetch(`${LOGS_BASE}?companyId=${id}&limit=100`);
        if (!resp || !resp.ok) return;

        const logsCliente = await resp.json();

        document.getElementById('detTotalVentas').innerText = logsCliente.length;
        document.getElementById('detUltimaAct').innerText = logsCliente.length > 0
            ? new Date(logsCliente[0].timestamp).toLocaleString()
            : 'Sin actividad reciente';

        if (logsCliente.length === 0) {
            tbodyMov.innerHTML = '<tr><td colspan="4" class="text-center text-muted p-4">No se registran movimientos recientes.</td></tr>';
            return;
        }

        tbodyMov.innerHTML = logsCliente.map(log => {
            let badgeClass = 'bg-primary text-primary';
            if (log.level === 'ERROR') badgeClass = 'bg-danger text-danger';
            if (log.level === 'WARNING') badgeClass = 'bg-warning text-warning';

            return `
                <tr>
                    <td class="text-muted small">${new Date(log.timestamp).toLocaleString()}</td>
                    <td><span class="badge ${badgeClass} bg-opacity-10 border border-opacity-25">${escapeHTML(log.action)}</span></td>
                    <td class="text-white-50 small">${escapeHTML(log.description)}</td>
                    <td class="text-end text-primary small">${escapeHTML(log.userEmail || 'Sistema')}</td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("Error al obtener movimientos:", err);
        tbodyMov.innerHTML = '<tr><td colspan="4" class="text-center text-danger p-3">Error al cargar el historial.</td></tr>';
    }
}

// LOGS GLOBALES CON PAGINACIÓN DINÁMICA DE 20
async function cargarLogs() {
    try {
        // Obtenemos los últimos 500 registros para permitir paginación fluida
        const resp = await apiFetch(`${LOGS_BASE}?limit=500`);
        if (!resp || !resp.ok) return;

        todosLosLogs = await resp.json();
        paginaActualLogs = 1;
        renderizarTablaLogsPaginada();
    } catch (err) {
        console.error("Error al obtener logs globales:", err);
    }
}

function renderizarTablaLogsPaginada() {
    const tbodyLogs = document.getElementById('tablaLogsCompleta');
    if (!tbodyLogs) return;

    if (!todosLosLogs || todosLosLogs.length === 0) {
        tbodyLogs.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-muted">No hay registros en la bitácora.</td></tr>';
        renderizarControlesPaginacionLogs(0);
        return;
    }

    const totalRegistros = todosLosLogs.length;
    const totalPaginas = Math.ceil(totalRegistros / LOGS_POR_PAGINA);

    if (paginaActualLogs > totalPaginas) paginaActualLogs = totalPaginas;
    if (paginaActualLogs < 1) paginaActualLogs = 1;

    const inicio = (paginaActualLogs - 1) * LOGS_POR_PAGINA;
    const fin = Math.min(inicio + LOGS_POR_PAGINA, totalRegistros);
    const logsPagina = todosLosLogs.slice(inicio, fin);

    tbodyLogs.innerHTML = logsPagina.map(log => {
        const fecha = new Date(log.timestamp).toLocaleString();
        let colorBadge = 'bg-info text-info';

        if (log.level === 'ERROR' || (log.action && log.action.includes('ELIMINAR'))) {
            colorBadge = 'bg-danger text-danger';
        } else if (log.level === 'WARNING') {
            colorBadge = 'bg-warning text-warning';
        } else if (log.action && log.action.includes('ALTA')) {
            colorBadge = 'bg-success text-success';
        }

        return `
            <tr>
                <td class="ps-3 text-muted small">${fecha}</td>
                <td><span class="badge ${colorBadge} bg-opacity-10 border border-opacity-25 px-2.5 py-1">${escapeHTML(log.action || 'EVENTO')}</span></td>
                <td class="text-white small fw-bold">${escapeHTML(log.companyName || 'GLOBAL')}</td>
                <td class="text-white-50 small">${escapeHTML(log.description)}</td>
                <td class="text-end pe-3 text-primary small">${escapeHTML(log.userEmail || 'Sistema')}</td>
            </tr>
        `;
    }).join('');

    renderizarControlesPaginacionLogs(totalPaginas, inicio + 1, fin, totalRegistros);
}

function renderizarControlesPaginacionLogs(totalPaginas, desde = 0, hasta = 0, total = 0) {
    const container = document.getElementById('paginacionLogs');
    const infoText = document.getElementById('infoPaginacionLogs');

    if (infoText) {
        infoText.innerText = total > 0
            ? `Mostrando ${desde} - ${hasta} de ${total} logs`
            : 'Mostrando 0 - 0 de 0 logs';
    }

    if (!container) return;

    if (totalPaginas <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '';

    // Botón Anterior
    html += `
        <li class="page-item ${paginaActualLogs === 1 ? 'disabled' : ''}">
            <button class="page-link bg-dark text-white border-secondary border-opacity-25" onclick="cambiarPaginaLogs(${paginaActualLogs - 1})">
                <i class="bi bi-chevron-left"></i>
            </button>
        </li>
    `;

    // Generar números de página (1, 2, 3...)
    for (let i = 1; i <= totalPaginas; i++) {
        const active = i === paginaActualLogs ? 'active bg-primary text-dark fw-bold border-primary' : 'bg-dark text-white border-secondary border-opacity-25';
        html += `
            <li class="page-item ${i === paginaActualLogs ? 'active' : ''}">
                <button class="page-link ${active}" onclick="cambiarPaginaLogs(${i})">${i}</button>
            </li>
        `;
    }

    // Botón Siguiente
    html += `
        <li class="page-item ${paginaActualLogs === totalPaginas ? 'disabled' : ''}">
            <button class="page-link bg-dark text-white border-secondary border-opacity-25" onclick="cambiarPaginaLogs(${paginaActualLogs + 1})">
                <i class="bi bi-chevron-right"></i>
            </button>
        </li>
    `;

    container.innerHTML = html;
}

function cambiarPaginaLogs(nuevaPagina) {
    const totalPaginas = Math.ceil(todosLosLogs.length / LOGS_POR_PAGINA);
    if (nuevaPagina < 1 || nuevaPagina > totalPaginas) return;

    paginaActualLogs = nuevaPagina;
    renderizarTablaLogsPaginada();
}

async function eliminarEmpresa(id) {
    const confirmar = typeof Swal !== 'undefined'
        ? (await Swal.fire({
            title: '¿ESTÁS SEGURO?',
            text: "Se desactivará el comercio y sus accesos asociados.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#f87171',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'SÍ, ELIMINAR',
            cancelButtonText: 'Cancelar'
        })).isConfirmed
        : confirm("¿ESTÁS SEGURO? Se desactivará el comercio.");

    if (confirmar) {
        await ejecutarEliminacion(id);
    }
}

async function ejecutarEliminacion(id) {
    try {
        const resp = await apiFetch(`${API_BASE}/${id}`, { method: 'DELETE' });
        if (resp && resp.ok) {
            if (typeof Swal !== 'undefined') Swal.fire('Eliminado', 'Comercio desactivado con éxito.', 'success');
            cargarTodo();
        } else {
            const msg = await extraerMensajeError(resp);
            if (typeof Swal !== 'undefined') Swal.fire('Error', msg, 'error');
        }
    } catch (err) {
        console.error("Error al eliminar empresa:", err);
    }
}

function filtrarEmpresas(termino) {
    const t = termino.toLowerCase().trim();
    if (!t) {
        renderizarTabla(todasLasEmpresas);
        return;
    }
    const filtradas = todasLasEmpresas.filter(empresa =>
        (empresa.name && empresa.name.toLowerCase().includes(t)) ||
        (empresa.adminName && empresa.adminName.toLowerCase().includes(t)) ||
        (empresa.ownerName && empresa.ownerName.toLowerCase().includes(t)) ||
        (empresa.email && empresa.email.toLowerCase().includes(t)) ||
        (empresa.taxId && empresa.taxId.toLowerCase().includes(t))
    );
    renderizarTabla(filtradas);
}

// Exposición global
window.renovarSuscripcion = renovarSuscripcion;
window.verMovimientos = verMovimientos;
window.prepararEdicion = prepararEdicion;
window.eliminarEmpresa = eliminarEmpresa;
window.cargarLogs = cargarLogs;
window.cambiarPaginaLogs = cambiarPaginaLogs;