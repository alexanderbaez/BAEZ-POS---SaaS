/**
 * BÁEZ POS - PANEL MAESTRO SUPER ADMIN (SaaS)
 * Alexander Baez - 2026
 * Control Central de Empresas / Clientes Multi-Tenant
 */

// URL base de tu backend en Render
const BACKEND_URL = "https://baez-pos-saas.onrender.com";

// Rutas completas apuntando a la nube
const API_BASE = `${BACKEND_URL}/super-admin/companies`;
const LOGS_BASE = `${BACKEND_URL}/logs`;

let modalEdicion;
let modalMovimientos;
let todasLasEmpresas = [];

document.addEventListener('DOMContentLoaded', () => {
    const role = (localStorage.getItem('baezpos_user_role') || '').toUpperCase().trim();
    const esSuperAdmin = role === 'SUPER_ADMIN' || role === 'SUPERADMIN';

    if (!esSuperAdmin) {
        console.error("Acceso denegado: Se requiere rol SUPER_ADMIN.");
        window.location.href = 'login.html';
        return;
    }

    setInterval(() => {
        cargarLogs();
    }, 30000);

    const elModalEdit = document.getElementById('modalEditar');
    if (elModalEdit) modalEdicion = new bootstrap.Modal(elModalEdit);

    const elModalMov = document.getElementById('modalMovimientos');
    if (elModalMov) modalMovimientos = new bootstrap.Modal(elModalMov);

    const buscador = document.getElementById('buscadorEmpresas');
    if (buscador) {
        buscador.addEventListener('input', (e) => filtrarEmpresas(e.target.value));
    }

    cargarTodo();
});

function cargarTodo() {
    cargarEmpresas();
    cargarLogs();
}

async function cargarEmpresas() {
    try {
        const resp = await apiFetch(API_BASE);
        if (!resp.ok) return;

        const empresas = await resp.json();
        todasLasEmpresas = empresas;
        renderizarTabla(empresas);
        actualizarKpis(empresas);
    } catch (err) {
        console.error("Error al cargar empresas:", err);
    }
}

function renderizarTabla(empresas) {
    const tbody = document.getElementById('tablaEmpresas');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (empresas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-muted">No hay comercios registrados aún.</td></tr>';
        return;
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    empresas.forEach(empresa => {
        let rowClass = "";
        let badge = "";

        const fechaVenc = empresa.expirationDate ? new Date(empresa.expirationDate) : null;
        if (fechaVenc) fechaVenc.setHours(23, 59, 59, 999);
        const estaVencida = fechaVenc && fechaVenc < hoy;

        if (!empresa.active || estaVencida) {
            rowClass = "row-vencido";
            badge = `<span class="badge rounded-pill bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-3 py-1"><i class="bi bi-x-circle me-1"></i>SUSPENDIDO</span>`;
        } else {
            badge = `<span class="badge rounded-pill bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-3 py-1"><i class="bi bi-check-all me-1"></i>ACTIVO</span>`;
        }

        const cleanPhone = empresa.phone ? empresa.phone.replace(/\D/g, '') : '';
        const msgWS = encodeURIComponent(`Hola ${empresa.name}, te contacto desde la administración central de BaezPOS...`);

        tbody.innerHTML += `
            <tr class="${rowClass}">
                <td class="ps-3">
                    <div class="d-flex align-items-center gap-3">
                        <div class="rounded-3 bg-primary bg-opacity-10 p-2 text-primary">
                            <i class="bi bi-building fs-5"></i>
                        </div>
                        <div>
                            <div class="fw-bold text-white">${empresa.name}</div>
                            <div class="text-muted" style="font-size: 0.75rem;">CUIT: ${empresa.taxId || 'N/A'}</div>
                        </div>
                    </div>
                </td>
                <td><span class="text-muted small">${empresa.email}</span></td>
                <td><div class="fw-bold small text-white">${empresa.expirationDate || 'Sin Fecha'}</div></td>
                <td>${badge}</td>
                <td class="text-end pe-3">
                    <div class="d-flex justify-content-end gap-1">
                        <button class="btn-action bg-dark text-warning border border-warning border-opacity-25" title="Renovar +30 Días" onclick="renovarSuscripcion(${empresa.id})"><i class="bi bi-calendar-plus-fill"></i></button>
                        <button class="btn-action bg-dark text-success border border-success border-opacity-25" title="Ver Movimientos y Actividad" onclick="verMovimientos(${empresa.id}, '${empresa.name}')"><i class="bi bi-eye-fill"></i></button>
                        <button class="btn-action bg-dark text-info border border-info border-opacity-25" title="Editar Comercio" onclick="prepararEdicion(${empresa.id})"><i class="bi bi-pencil-fill"></i></button>
                        <button class="btn-action bg-dark text-success border border-success border-opacity-25" title="WhatsApp" onclick="window.open('https://wa.me/${cleanPhone}?text=${msgWS}')"><i class="bi bi-whatsapp"></i></button>
                        <button class="btn-action bg-dark text-danger border border-danger border-opacity-25" title="Eliminar" onclick="eliminarEmpresa(${empresa.id})"><i class="bi bi-trash3"></i></button>
                    </div>
                </td>
            </tr>
        `;
    });
}

// 🚀 Función para sumar 30 días de suscripción con un solo clic y alerta blindada
async function renovarSuscripcion(id) {
    const empresa = todasLasEmpresas.find(e => e.id === id);
    if (!empresa) return;

    let baseDate = new Date();
    if (empresa.expirationDate) {
        const currentExp = new Date(empresa.expirationDate);
        if (currentExp >= baseDate) {
            baseDate = currentExp;
        }
    }

    baseDate.setDate(baseDate.getDate() + 30);
    const nuevaFechaStr = baseDate.toISOString().split('T')[0];

    if (typeof Swal !== 'undefined') {
        const result = await Swal.fire({
            title: '¿Extender suscripción?',
            text: `Se actualizará el vencimiento de "${empresa.name}" al ${nuevaFechaStr} (+30 días) y se activará automáticamente.`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#10b981',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'SÍ, RENOVAR',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            await procesarRenovacion(id, empresa, nuevaFechaStr);
        }
    } else {
        if (confirm(`¿Extender suscripción de "${empresa.name}" al ${nuevaFechaStr}?`)) {
            await procesarRenovacion(id, empresa, nuevaFechaStr);
        }
    }
}

async function procesarRenovacion(id, empresa, nuevaFechaStr) {
    const payload = {
        name: empresa.name,
        taxId: empresa.taxId,
        email: empresa.email,
        phone: empresa.phone,
        address: empresa.address,
        expirationDate: nuevaFechaStr,
        ticketMessage: empresa.ticketMessage,
        active: true
    };

    try {
        const resp = await apiFetch(`${API_BASE}/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });

        if (resp.ok) {
            if (typeof Swal !== 'undefined') {
                Swal.fire('¡Renovado!', 'La suscripción se extendió por 30 días exitosamente.', 'success');
            }
            cargarTodo();
        } else {
            if (typeof Swal !== 'undefined') Swal.fire('Error', 'No se pudo actualizar la suscripción.', 'error');
        }
    } catch (err) {
        if (typeof Swal !== 'undefined') Swal.fire('Error', 'Fallo en la comunicación con el servidor.', 'error');
    }
}

function actualizarKpis(empresas) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    let activos = 0;
    let vencidos = 0;
    let prontoVencer = 0;

    empresas.forEach(e => {
        const fechaVenc = e.expirationDate ? new Date(e.expirationDate) : null;
        if (fechaVenc) fechaVenc.setHours(23, 59, 59, 999);
        const diasRestantes = fechaVenc ? Math.ceil((fechaVenc - hoy) / (1000 * 60 * 60 * 24)) : 999;

        if (!e.active || (fechaVenc && fechaVenc < hoy)) {
            vencidos++;
        } else if (diasRestantes <= 7) {
            prontoVencer++;
            activos++;
        } else {
            activos++;
        }
    });

    if (document.getElementById('kpiTotal')) document.getElementById('kpiTotal').innerText = empresas.length;
    if (document.getElementById('kpiActivos')) document.getElementById('kpiActivos').innerText = activos;
    if (document.getElementById('kpiProntoVencer')) document.getElementById('kpiProntoVencer').innerText = prontoVencer;
    if (document.getElementById('kpiVencidos')) document.getElementById('kpiVencidos').innerText = vencidos;
}

// Alta de Comercio
const formNueva = document.getElementById('formNuevaEmpresa');
if (formNueva) {
    formNueva.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSubmit = e.target.querySelector('button[type="submit"]');
        btnSubmit.disabled = true;

        const nuevaEmpresaRequest = {
            companyName: document.getElementById('masterNombre').value,
            taxId: document.getElementById('masterTaxId').value,
            phone: document.getElementById('masterTelefono').value,
            address: document.getElementById('masterDireccion').value,
            ownerName: document.getElementById('masterNombre').value,
            ownerEmail: document.getElementById('masterEmail').value,
            ownerPassword: document.getElementById('masterPass').value,
            expirationDate: document.getElementById('masterVenc').value || null
        };

        try {
            const resp = await apiFetch(API_BASE, {
                method: 'POST',
                body: JSON.stringify(nuevaEmpresaRequest)
            });

            if (resp.ok) {
                if (typeof Swal !== 'undefined') Swal.fire('¡Registrado!', 'Comercio creado con éxito.', 'success');
                cargarTodo();
                e.target.reset();
            } else {
                if (typeof Swal !== 'undefined') Swal.fire('Error', 'No se pudo crear el comercio.', 'error');
            }
        } catch (err) {
            if (typeof Swal !== 'undefined') Swal.fire('Error de Red', 'Fallo en la comunicación.', 'error');
        } finally {
            btnSubmit.disabled = false;
        }
    });
}

function prepararEdicion(id) {
    const empresa = todasLasEmpresas.find(e => e.id === id);
    if (!empresa) return;

    document.getElementById('editId').value = empresa.id;
    document.getElementById('editNombre').value = empresa.name || '';
    document.getElementById('editTaxId').value = empresa.taxId || '';
    document.getElementById('editEmail').value = empresa.email || '';
    document.getElementById('editPhone').value = empresa.phone || '';
    document.getElementById('editAddress').value = empresa.address || '';
    document.getElementById('editVencimiento').value = empresa.expirationDate || '';
    document.getElementById('editTicketMessage').value = empresa.ticketMessage || '';
    if (document.getElementById('editPass')) document.getElementById('editPass').value = '';
    if (document.getElementById('editActive')) document.getElementById('editActive').value = empresa.active !== false ? "true" : "false";

    modalEdicion.show();
}

const formEdit = document.getElementById('formEditarEmpresa');
if (formEdit) {
    formEdit.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('editId').value;
        const newPass = document.getElementById('editPass').value.trim();

        const payload = {
            name: document.getElementById('editNombre').value,
            taxId: document.getElementById('editTaxId').value,
            email: document.getElementById('editEmail').value,
            phone: document.getElementById('editPhone').value,
            address: document.getElementById('editAddress').value,
            expirationDate: document.getElementById('editVencimiento').value,
            ticketMessage: document.getElementById('editTicketMessage').value,
            active: document.getElementById('editActive').value === "true"
        };

        try {
            const resp = await apiFetch(`${API_BASE}/${id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });

            if (resp.ok) {
                if (newPass) {
                    await apiFetch(`${API_BASE}/${id}/reset-password`, {
                        method: 'PATCH',
                        body: JSON.stringify({ password: newPass })
                    }).catch(err => console.warn(err));
                }
                modalEdicion.hide();
                if (typeof Swal !== 'undefined') Swal.fire('¡Actualizado!', 'Datos guardados correctamente.', 'success');
                cargarTodo();
            } else {
                if (typeof Swal !== 'undefined') Swal.fire('Error', 'No se pudo guardar la información.', 'error');
            }
        } catch (err) {
            if (typeof Swal !== 'undefined') Swal.fire('Error', 'Fallo al guardar.', 'error');
        }
    });
}

// Ver Movimientos y Auditoría del Cliente Específico
async function verMovimientos(id, nombreComercio) {
    document.getElementById('lblClienteMov').innerText = nombreComercio;
    document.getElementById('detTotalVentas').innerText = "—";
    document.getElementById('detVolumen').innerText = "$ —";
    document.getElementById('detUltimaAct').innerText = "Cargando...";

    const tbodyMov = document.getElementById('tablaMovimientosCliente');
    tbodyMov.innerHTML = '<tr><td colspan="3" class="text-center text-muted p-3">Buscando actividad reciente...</td></tr>';

    modalMovimientos.show();

    try {
        const resp = await apiFetch(LOGS_BASE);
        if (!resp.ok) return;

        const logs = await resp.json();
        const logsCliente = logs.filter(l =>
            (l.description && l.description.toLowerCase().includes(nombreComercio.toLowerCase())) ||
            (l.userEmail && l.userEmail.toLowerCase().includes(nombreComercio.toLowerCase()))
        );

        document.getElementById('detTotalVentas').innerText = logsCliente.length;
        document.getElementById('detUltimaAct').innerText = logsCliente.length > 0 ? new Date(logsCliente[0].timestamp).toLocaleString() : 'Sin actividad reciente';

        if (logsCliente.length === 0) {
            tbodyMov.innerHTML = '<tr><td colspan="3" class="text-center text-muted p-4">No se registran movimientos recientes para este comercio.</td></tr>';
            return;
        }

        tbodyMov.innerHTML = logsCliente.map(log => `
            <tr>
                <td class="text-muted small">${new Date(log.timestamp).toLocaleString()}</td>
                <td><span class="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25">${log.action}</span></td>
                <td class="text-white-50 small">${log.description}</td>
            </tr>
        `).join('');

    } catch (err) {
        console.error("Error al obtener movimientos:", err);
        tbodyMov.innerHTML = '<tr><td colspan="3" class="text-center text-danger p-3">Error al cargar el historial.</td></tr>';
    }
}

async function cargarLogs() {
    try {
        const resp = await apiFetch(LOGS_BASE);
        if (!resp.ok) return;

        const logs = await resp.json();
        const tbodyLogs = document.getElementById('tablaLogsCompleta');
        if (!tbodyLogs) return;

        if (!logs || logs.length === 0) {
            tbodyLogs.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-muted">No hay registros en la bitácora.</td></tr>';
            return;
        }

        tbodyLogs.innerHTML = logs.map(log => {
            const fecha = new Date(log.timestamp).toLocaleString();
            let colorBadge = 'bg-info text-info';
            if (log.action && log.action.includes('ELIMINAR')) colorBadge = 'bg-danger text-danger';
            if (log.action && log.action.includes('ALTA')) colorBadge = 'bg-success text-success';

            return `
                <tr>
                    <td class="ps-3 text-muted small">${fecha}</td>
                    <td><span class="badge ${colorBadge} bg-opacity-10 border border-opacity-25 px-2.5 py-1">${log.action || 'EVENTO'}</span></td>
                    <td class="text-white-50 small">${log.description}</td>
                    <td class="text-end pe-3 text-primary small">${log.userEmail || 'Sistema'}</td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error("Error al obtener logs:", err);
    }
}

// Función de eliminación con alerta SweetAlert2 totalmente blindada
async function eliminarEmpresa(id) {
    if (typeof Swal !== 'undefined') {
        const result = await Swal.fire({
            title: '¿ESTÁS SEGURO?',
            text: "Se eliminará el comercio y todos sus datos asociados permanentemente.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#f87171',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'SÍ, ELIMINAR',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            await ejecutarEliminacion(id);
        }
    } else {
        if (confirm("¿ESTÁS SEGURO? Se eliminará el comercio y todos sus datos asociados permanentemente.")) {
            await ejecutarEliminacion(id);
        }
    }
}

async function ejecutarEliminacion(id) {
    try {
        const resp = await apiFetch(`${API_BASE}/${id}`, { method: 'DELETE' });
        if (resp.ok) {
            if (typeof Swal !== 'undefined') {
                Swal.fire('Eliminado', 'Comercio eliminado con éxito.', 'success');
            }
            cargarTodo();
        } else {
            if (typeof Swal !== 'undefined') Swal.fire('Error', 'No se pudo eliminar.', 'error');
        }
    } catch (err) {
        console.error(err);
    }
}

function filtrarEmpresas(termino) {
    const filas = document.querySelectorAll('#tablaEmpresas tr');
    const t = termino.toLowerCase().trim();
    filas.forEach(fila => {
        fila.style.display = fila.innerText.toLowerCase().includes(t) ? '' : 'none';
    });
}