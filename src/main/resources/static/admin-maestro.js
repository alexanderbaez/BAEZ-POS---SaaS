/**
 * BÁEZ POS - PANEL MAESTRO SUPER ADMIN (SaaS)
 * Alexander Baez - 2026
 * Control Central de Empresas / Clientes Multi-Tenant
 */

const API_BASE = "/super-admin/companies";
const LOGS_BASE = "/super-admin/logs";

let modalEdicion;
let todasLasEmpresas = [];

document.addEventListener('DOMContentLoaded', () => {

    // Validar Rol de SuperAdmin estrictamente
    const role = (localStorage.getItem('baezpos_user_role') || '').toUpperCase().trim();
    const esSuperAdmin = role === 'SUPER_ADMIN' || role === 'SUPERADMIN';

    if (!esSuperAdmin) {
        console.error("Acceso denegado: Se requiere rol SUPER_ADMIN.");
        window.location.href = 'login.html';
        return;
    }

    // Refresco automático de logs cada 30 segundos
    setInterval(() => {
        cargarLogs();
    }, 30000);

    // 1. Inicializar Modal de Bootstrap
    const modalElement = document.getElementById('modalEditar');
    if (modalElement) {
        modalEdicion = new bootstrap.Modal(modalElement);
    }

    // 2. Configurar Buscador de Comercios
    const buscador = document.getElementById('buscadorEmpresas');
    if (buscador) {
        buscador.addEventListener('input', (e) => filtrarEmpresas(e.target.value));
    }

    // 3. Cargar Datos Iniciales
    cargarTodo();
});

function cargarTodo() {
    cargarEmpresas();
    cargarLogs();
}

// --- 1. GESTIÓN DE EMPRESAS / COMERCIOS ---

async function cargarEmpresas() {
    try {
        const resp = await apiFetch(API_BASE);

        if (!resp.ok) {
            console.error("Error al obtener empresas:", resp.status);
            return;
        }

        const empresas = await resp.json();
        todasLasEmpresas = empresas;
        renderizarTabla(empresas);
        actualizarKpis(empresas);

    } catch (err) {
        console.error("Error de red al cargar empresas:", err);
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
            badge = `<span class="badge rounded-pill bg-danger shadow-sm"><i class="bi bi-x-circle me-1"></i>SUSPENDIDO</span>`;
        } else {
            badge = '<span class="badge rounded-pill bg-success shadow-sm"><i class="bi bi-check-all me-1"></i>ACTIVO</span>';
        }

        const cleanPhone = empresa.phone ? empresa.phone.replace(/\D/g, '') : '';
        const msgWS = encodeURIComponent(`Hola ${empresa.name}, te contacto desde la administración central de BaezPOS...`);

        tbody.innerHTML += `
            <tr class="align-middle ${rowClass}">
                <td class="ps-3">
                    <div class="d-flex align-items-center">
                        <div class="rounded-circle bg-primary bg-opacity-10 p-2 me-3 text-primary">
                            <i class="bi bi-building fs-5"></i>
                        </div>
                        <div>
                            <div class="fw-bold text-white">${empresa.name}</div>
                            <div class="text-muted" style="font-size: 0.65rem;">CUIT/TaxID: ${empresa.taxId || 'N/A'}</div>
                        </div>
                    </div>
                </td>
                <td><span class="text-muted small">${empresa.email}</span></td>
                <td><div class="fw-bold small text-white">${empresa.expirationDate || 'Sin Fecha'}</div></td>
                <td>${badge}</td>
                <td class="text-end pe-3">
                    <div class="d-flex justify-content-end gap-1">
                        <button class="btn btn-action btn-outline-info" title="Editar" onclick="prepararEdicion(${empresa.id})"><i class="bi bi-pencil-fill"></i></button>
                        <button class="btn btn-action btn-outline-success" title="WhatsApp" onclick="window.open('https://wa.me/${cleanPhone}?text=${msgWS}')"><i class="bi bi-whatsapp"></i></button>
                        <button class="btn btn-action btn-outline-danger" title="Eliminar" onclick="eliminarEmpresa(${empresa.id})"><i class="bi bi-trash3"></i></button>
                    </div>
                </td>
            </tr>
        `;
    });
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

// --- 2. ALTA DE NUEVO COMERCIO ---
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
                const msgBienvenida = `👋 *¡Bienvenido a BaezPOS SaaS!*\n\nHola ${nuevaEmpresaRequest.ownerName}, tu comercio *${nuevaEmpresaRequest.companyName}* ha sido activado con éxito.\n\n🌐 *Acceso:* ${window.location.origin}/login.html\n📧 *Usuario:* ${nuevaEmpresaRequest.ownerEmail}\n🔑 *Contraseña:* ${nuevaEmpresaRequest.ownerPassword}\n\n¡Gracias por confiar en BaezPOS!`;

                Swal.fire({
                    icon: 'success',
                    title: '🎉 ¡Comercio Registrado con Éxito!',
                    html: `
                        <div class="text-start p-3 bg-dark bg-opacity-25 rounded border border-secondary border-opacity-25">
                            <p class="mb-1 text-white"><b>Comercio:</b> ${nuevaEmpresaRequest.companyName}</p>
                            <p class="mb-1 text-white"><b>Usuario Dueño:</b> ${nuevaEmpresaRequest.ownerEmail}</p>
                            <p class="mb-1 text-white"><b>Contraseña Inicial:</b> <code>${nuevaEmpresaRequest.ownerPassword}</code></p>
                        </div>
                        <p class="mt-3 small text-muted">Copiá este mensaje para enviárselo al cliente por WhatsApp o email:</p>
                    `,
                    showCancelButton: true,
                    confirmButtonText: '<i class="bi bi-whatsapp"></i> Copiar Mensaje de Bienvenida',
                    cancelButtonText: 'Cerrar',
                    confirmButtonColor: '#25D366'
                }).then((result) => {
                    if (result.isConfirmed) {
                        navigator.clipboard.writeText(msgBienvenida);
                        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Mensaje copiado al portapapeles', timer: 2000, showConfirmButton: false });
                    }
                });

                cargarTodo();
                e.target.reset();
            } else {
                let errorMsg = 'No se pudo crear el comercio. Verifique que el correo/TaxID no exista.';
                try {
                    const errJson = await resp.json();
                    if (errJson && errJson.message) errorMsg = errJson.message;
                } catch(e) {}
                Swal.fire('Error al crear comercio', errorMsg, 'error');
            }
        } catch (err) {
            Swal.fire('Error de Red', 'No se pudo conectar con el servidor.', 'error');
        } finally {
            btnSubmit.disabled = false;
        }
    });
}

// --- 3. EDICIÓN DE COMERCIO (MODAL) ---

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

    if (document.getElementById('editPass')) {
        document.getElementById('editPass').value = '';
    }

    if (document.getElementById('editActive')) {
        document.getElementById('editActive').value = empresa.active !== false ? "true" : "false";
    }

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
                    }).catch(err => console.warn("No se pudo actualizar clave:", err));
                }

                modalEdicion.hide();

                if (newPass) {
                    const msgClave = `🔐 *Aviso de Seguridad BaezPOS*\n\nHola ${payload.name}, tu contraseña de acceso ha sido actualizada por la administración central.\n\n📧 *Usuario:* ${payload.email}\n🔑 *Nueva Contraseña:* ${newPass}`;

                    Swal.fire({
                        icon: 'success',
                        title: '¡Datos y Contraseña Actualizados!',
                        text: 'Se ha guardado la nueva información y la nueva clave de acceso.',
                        showCancelButton: true,
                        confirmButtonText: '<i class="bi bi-whatsapp"></i> Copiar Aviso de Nueva Clave',
                        cancelButtonText: 'Cerrar',
                        confirmButtonColor: '#25D366'
                    }).then((result) => {
                        if (result.isConfirmed) {
                            navigator.clipboard.writeText(msgClave);
                            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Aviso copiado al portapapeles', timer: 2000, showConfirmButton: false });
                        }
                    });
                } else {
                    Swal.fire('¡Actualizado!', 'Empresa actualizada correctamente.', 'success');
                }

                cargarTodo();
            } else {
                Swal.fire('Error', 'No se pudo guardar la información.', 'error');
            }
        } catch (err) {
            Swal.fire('Error', 'Fallo al guardar cambios.', 'error');
        }
    });
}

// --- 4. BITÁCORA DE EVENTOS ---

async function cargarLogs() {
    try {
        const resp = await apiFetch(LOGS_BASE);
        if (!resp.ok) return;

        const logs = await resp.json();
        const contenedor = document.getElementById('listaLogs');
        if (!contenedor) return;

        contenedor.innerHTML = logs.map(log => {
            const fecha = new Date(log.timestamp).toLocaleString();
            let color = 'text-info';
            if (log.action && log.action.includes('ELIMINAR')) color = 'text-danger';
            if (log.action && log.action.includes('ALTA')) color = 'text-success';

            return `
                <div class="log-item p-3 border-bottom border-secondary border-opacity-10">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="fw-bold ${color} small uppercase">${log.action || 'EVENTO'}</span>
                        <span class="text-muted" style="font-size: 0.6rem;">${fecha}</span>
                    </div>
                    <div class="text-white-50" style="font-size: 0.72rem;">${log.description}</div>
                    <div class="text-primary" style="font-size: 0.6rem;">Comercio / Usuario: ${log.userEmail || 'Sistema'}</div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error("Error al obtener logs:", err);
    }
}

// --- 5. ELIMINAR COMERCIO ---

async function eliminarEmpresa(id) {
    const result = await Swal.fire({
        title: '¿ESTÁS SEGURO?',
        text: "Se eliminará el comercio y todos sus datos asociados permanentemente.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'SÍ, ELIMINAR'
    });

    if (result.isConfirmed) {
        try {
            const resp = await apiFetch(`${API_BASE}/${id}`, {
                method: 'DELETE'
            });

            if (resp.ok) {
                Swal.fire('Eliminado', 'Comercio eliminado con éxito.', 'success');
                cargarTodo();
            } else {
                Swal.fire('Error', 'No se pudo eliminar el comercio.', 'error');
            }
        } catch (err) {
            console.error(err);
        }
    }
}

// --- 6. AUXILIARES Y FILTROS ---

function filtrarEmpresas(termino) {
    const filas = document.querySelectorAll('#tablaEmpresas tr');
    const t = termino.toLowerCase().trim();
    filas.forEach(fila => {
        fila.style.display = fila.innerText.toLowerCase().includes(t) ? '' : 'none';
    });
}