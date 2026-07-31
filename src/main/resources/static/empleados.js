/**
 * BÁEZ POS - MÓDULO DE EMPLEADOS (SaaS)
 * Alexander Baez - 2026
 */

let modalForm = null;

// ==========================================
// 1. INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Verificar si es ADMIN
    const userRole = (localStorage.getItem('baezpos_user_role') || '').toUpperCase().trim();
    if (userRole !== 'ADMIN' && !userRole.includes('SUPER_ADMIN')) {
        Swal.fire({
            title: 'Acceso Denegado',
            text: 'Solo los administradores pueden gestionar empleados.',
            icon: 'error',
            confirmButtonColor: '#3b82f6'
        }).then(() => {
            window.location.href = 'dashboard.html';
        });
        return;
    }

    const elModal = document.getElementById('modalEmpleado');
    if (elModal) {
        modalForm = bootstrap.Modal.getOrCreateInstance(elModal);
        const smallHint = document.querySelector('#passwordContainer small');
        if (smallHint) smallHint.classList.add('d-none');
    }

    cargarEmpleados();
});

// ==========================================
// 2. CARGA Y RENDERIZADO DE EMPLEADOS
// ==========================================
async function cargarEmpleados() {
    try {
        const res = await apiFetch('/users');
        if (!res || !res.ok) throw new Error("Error al obtener la lista de usuarios");

        const usuarios = await res.json();
        const tbody = document.getElementById('tablaEmpleados');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (!usuarios || usuarios.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-muted">No hay empleados registrados.</td></tr>';
            return;
        }

        usuarios.forEach(user => {
            let badgeClass = 'bg-light text-dark';
            const rol = (user.role || '').toUpperCase();
            if (rol === 'ADMIN' || rol.includes('SUPER')) badgeClass = 'bg-danger text-white';
            else if (rol === 'VENDEDOR') badgeClass = 'bg-primary text-white';
            else if (rol === 'CAJERO') badgeClass = 'bg-success text-white';

            const userJsonSeguro = JSON.stringify(user).replace(/"/g, '&quot;');
            const nombreSeguro = (user.name || 'Sin Nombre').replace(/'/g, "\\'").replace(/"/g, '&quot;');

            tbody.innerHTML += `
                <tr>
                    <td class="ps-3">
                        <div class="d-flex align-items-center gap-3">
                            <div class="bg-primary rounded-circle d-flex align-items-center justify-content-center fw-bold text-white shadow-sm" style="width: 38px; height: 38px;">
                                ${(user.name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <span class="fw-bold text-dark">${user.name || 'Sin Nombre'}</span>
                        </div>
                    </td>
                    <td class="text-secondary align-middle">${user.email}</td>
                    <td class="align-middle"><span class="badge ${badgeClass} rounded-pill px-3 py-1">${user.role}</span></td>
                    <td class="text-end align-middle pe-3">
                        <button class="btn btn-sm btn-outline-secondary rounded-circle me-1" onclick='abrirEdicion(${userJsonSeguro})' title="Editar"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger rounded-circle" onclick="eliminarEmpleado(${user.id}, '${nombreSeguro}', '${user.role}')" title="Eliminar"><i class="bi bi-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    } catch (e) {
        console.error("Error al cargar empleados:", e);
        Swal.fire('Error', 'No se pudieron cargar los empleados', 'error');
    }
}

// ==========================================
// 3. GESTIÓN DE FORMULARIO (ALTAS Y EDICIONES)
// ==========================================
const formEmpleado = document.getElementById('formEmpleado');
if (formEmpleado) {
    formEmpleado.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = document.getElementById('empleadoId').value;
        const isEditing = id !== "";

        const payload = {
            name: document.getElementById('empNombre').value.trim(),
            email: document.getElementById('empEmail').value.trim(),
            role: document.getElementById('empRol').value
        };

        const password = document.getElementById('empPassword').value.trim();
        if (password) {
            payload.password = password;
        } else if (!isEditing) {
            Swal.fire('Error', 'La contraseña es obligatoria para un usuario nuevo.', 'warning');
            return;
        }

        try {
            let res;
            if (isEditing) {
                res = await apiFetch(`/users/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
            } else {
                res = await apiFetch('/users', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
            }

            if (res && res.ok) {
                Swal.fire({
                    title: '¡Éxito!',
                    text: isEditing ? 'Empleado actualizado correctamente.' : 'Nuevo empleado creado con éxito.',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
                if (modalForm) modalForm.hide();
                cargarEmpleados();
            } else {
                let errorMessage = 'No se pudo guardar el empleado.';
                try {
                    const errData = await res.json();
                    errorMessage = errData.message || errData.error || errorMessage;
                } catch (errJson) {
                    const errText = await res.text();
                    if (errText) errorMessage = errText;
                }

                Swal.fire({
                    title: 'Atención',
                    text: errorMessage.toLowerCase().includes('ya existe') || errorMessage.toLowerCase().includes('duplicate')
                        ? `El correo ${payload.email} ya está registrado en el sistema. Utiliza otro email.`
                        : errorMessage,
                    icon: 'warning',
                    confirmButtonColor: '#0d6efd'
                });
            }

        } catch (e) {
            console.error("Error al guardar empleado:", e);
            Swal.fire('Error', 'Ocurrió un error inesperado al conectar con el servidor.', 'error');
        }
    });
}

function abrirEdicion(user) {
    document.getElementById('empleadoId').value = user.id;
    document.getElementById('empNombre').value = user.name || '';
    document.getElementById('empEmail').value = user.email || '';
    document.getElementById('empRol').value = user.role || 'VENDEDOR';
    document.getElementById('empPassword').value = '';

    const smallHint = document.querySelector('#passwordContainer small');
    if (smallHint) smallHint.classList.remove('d-none');

    const elModal = document.getElementById('modalEmpleado');
    if (elModal) {
        modalForm = bootstrap.Modal.getOrCreateInstance(elModal);
        modalForm.show();
    }
}

// Limpiar modal al cerrarlo para altas nuevas
const modalElement = document.getElementById('modalEmpleado');
if (modalElement) {
    modalElement.addEventListener('hidden.bs.modal', () => {
        if (formEmpleado) formEmpleado.reset();
        document.getElementById('empleadoId').value = '';
        const smallHint = document.querySelector('#passwordContainer small');
        if (smallHint) smallHint.classList.add('d-none');
    });
}

// ==========================================
// 4. ELIMINACIÓN DE EMPLEADOS
// ==========================================
async function eliminarEmpleado(id, name, rol) {
    if (rol === 'ADMIN' && id === 1) {
        Swal.fire('Denegado', 'No puedes eliminar al Administrador Principal del sistema.', 'error');
        return;
    }

    const { isConfirmed } = await Swal.fire({
        title: `¿Eliminar a ${name}?`,
        html: "Esta acción no se puede deshacer y el empleado perderá el acceso al sistema.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (isConfirmed) {
        try {
            const res = await apiFetch(`/users/${id}`, { method: 'DELETE' });
            if (res && res.ok) {
                Swal.fire({ icon: 'success', title: '¡Eliminado!', text: 'El empleado ha sido removido.', timer: 1500, showConfirmButton: false });
                cargarEmpleados();
            } else {
                Swal.fire('Error', 'No se pudo eliminar al empleado.', 'error');
            }
        } catch (e) {
            console.error("Error al eliminar empleado:", e);
            Swal.fire('Error', 'Problema de conexión con el servidor.', 'error');
        }
    }
}

// Exposición en window para compatibilidad estricta con eventos HTML
window.abrirEdicion = abrirEdicion;
window.eliminarEmpleado = eliminarEmpleado;