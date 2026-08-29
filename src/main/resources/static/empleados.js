/**
 * BÁEZ POS - MÓDULO DE EMPLEADOS (SaaS)
 * Alexander Baez - 2026
 */

let modalForm = null;

// ==========================================
// 1. INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Verificar si es ADMIN o SUPER_ADMIN
    const userRole = (localStorage.getItem('baezpos_user_role') || '').toUpperCase().trim();
    if (userRole !== 'ADMIN' && !userRole.includes('SUPER_ADMIN')) {
        Swal.fire({
            title: 'Acceso Denegado',
            text: 'Solo los administradores pueden gestionar empleados.',
            icon: 'error',
            confirmButtonColor: '#0d6efd'
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

    ajustarOpcionesDeRolSegunPermisos();
    actualizarVisibilidadPin();

    const selectRol = document.getElementById('empRol');
    if (selectRol) {
        selectRol.addEventListener('change', actualizarVisibilidadPin);
    }
    const switchAsignarPin = document.getElementById('switchAsignarPin');
    if (switchAsignarPin) {
        switchAsignarPin.addEventListener('change', actualizarVisibilidadPin);
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

        if (!Array.isArray(usuarios)) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-warning fw-semibold">Respuesta no válida del servidor.</td></tr>';
            return;
        }

        // Filtrar registros inactivos
        const usuariosActivos = usuarios.filter(user => user && (user.active === true || user.active === undefined));

        if (usuariosActivos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-muted fw-semibold">No hay empleados activos registrados.</td></tr>';
            return;
        }

        usuariosActivos.forEach(user => {
            const rol = (user.role || 'VENDEDOR').toUpperCase();

            // Mapeo de badges alineado exactamente con la Enum de Java
            let badgeClass = 'vendedor';
            if (rol === 'ADMIN' || rol.includes('SUPER_ADMIN')) {
                badgeClass = 'admin';
            }

            const userJsonSeguro = JSON.stringify(user).replace(/"/g, '&quot;');
            const nombreSeguro = (user.name || 'Sin Nombre').replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const inicial = (user.name || 'U').charAt(0).toUpperCase();

            tbody.innerHTML += `
                <tr id="empleado-row-${user.id}">
                    <td>
                        <div class="mobile-card-top">
                            <div class="avatar-circle flex-shrink-0">${inicial}</div>
                            <div class="user-text-container">
                                <div class="fw-bold text-dark text-truncate">${user.name || 'Sin Nombre'}</div>
                                <small class="text-muted d-md-none text-truncate d-block">${user.email || '-'}</small>
                            </div>
                        </div>
                    </td>
                    <td class="d-none d-md-table-cell text-muted fw-semibold align-middle">
                        ${user.email || '-'}
                    </td>
                    <td class="align-middle">
                        <div class="mobile-card-middle">
                            <span class="text-muted small d-md-none fw-bold">ROL</span>
                            <span class="role-badge ${badgeClass}">${rol}</span>
                        </div>
                    </td>
                    <td class="align-middle text-end">
                        <div class="mobile-card-bottom">
                            <button class="btn-icon" onclick='abrirEdicion(${userJsonSeguro})' title="Editar">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn-icon delete" onclick="eliminarEmpleado(${user.id}, '${nombreSeguro}', '${user.role}')" title="Desactivar">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
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

        const role = document.getElementById('empRol').value;
        const payload = {
            name: document.getElementById('empNombre').value.trim(),
            email: document.getElementById('empEmail').value.trim(),
            role: role
        };

        const password = document.getElementById('empPassword').value.trim();
        if (password) {
            payload.password = password;
        } else if (!isEditing) {
            Swal.fire('Atención', 'La contraseña es obligatoria para registrar un nuevo usuario.', 'warning');
            return;
        }

        const switchAsignarPin = document.getElementById('switchAsignarPin');
        const pinInput = document.getElementById('empPin');
        const pinVal = pinInput ? pinInput.value.trim() : '';

        if (role === 'ADMIN') {
            if (pinVal) {
                payload.securityPin = pinVal;
            }
        } else {
            // VENDEDOR
            if (switchAsignarPin && switchAsignarPin.checked) {
                if (pinVal) {
                    payload.securityPin = pinVal;
                }
            } else if (isEditing) {
                payload.securityPin = '';
            }
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

                if (errorMessage.toLowerCase().includes('límite de empleados') || errorMessage.toLowerCase().includes('limite de empleados')) {
                    Swal.fire({
                        title: 'Límite de Plan Alcanzado',
                        text: 'Has alcanzado el límite de empleados de tu plan actual. Comunicate con soporte para hacer un upgrade.',
                        icon: 'warning',
                        confirmButtonColor: '#0d6efd'
                    });
                } else if (errorMessage.toLowerCase().includes('ya existe') || errorMessage.toLowerCase().includes('duplicate') || errorMessage.toLowerCase().includes('ya pertenece') || errorMessage.toLowerCase().includes('ya se encuentra registrado')) {
                    Swal.fire({
                        title: 'Atención',
                        text: `El correo ${payload.email} ya está registrado en el sistema.`,
                        icon: 'warning',
                        confirmButtonColor: '#0d6efd'
                    });
                } else {
                    Swal.fire({
                        title: 'Atención',
                        text: errorMessage,
                        icon: 'warning',
                        confirmButtonColor: '#0d6efd'
                    });
                }
            }

        } catch (e) {
            console.error("Error al guardar empleado:", e);
            Swal.fire('Error', 'Ocurrió un error inesperado al conectar con el servidor.', 'error');
        }
    });
}

function actualizarVisibilidadPin() {
    const selectRol = document.getElementById('empRol');
    const switchPinContainer = document.getElementById('switchPinContainer');
    const switchAsignarPin = document.getElementById('switchAsignarPin');
    const pinContainer = document.getElementById('pinContainer');
    const pinInput = document.getElementById('empPin');

    if (!selectRol || !pinContainer) return;

    const rolSeleccionado = (selectRol.value || '').toUpperCase().trim();

    if (rolSeleccionado === 'ADMIN' || rolSeleccionado === 'SUPER_ADMIN') {
        // Si el rol es ADMIN, el campo de PIN se muestra siempre y el Switch se oculta
        if (switchPinContainer) {
            switchPinContainer.classList.add('d-none');
            switchPinContainer.style.display = 'none';
        }
        pinContainer.classList.remove('d-none');
        pinContainer.style.display = 'block';
    } else {
        // Si el rol es VENDEDOR, el Switch se muestra
        if (switchPinContainer) {
            switchPinContainer.classList.remove('d-none');
            switchPinContainer.style.display = 'block';
        }
        // El campo de PIN permanece oculto hasta que el Admin active el Switch. Si lo desactiva, el campo se oculta y su valor se limpia ('')
        if (switchAsignarPin && switchAsignarPin.checked) {
            pinContainer.classList.remove('d-none');
            pinContainer.style.display = 'block';
        } else {
            pinContainer.classList.add('d-none');
            pinContainer.style.display = 'none';
            if (pinInput) pinInput.value = '';
        }
    }
}

function ajustarOpcionesDeRolSegunPermisos(targetUserRole = null) {
    const userRole = (localStorage.getItem('baezpos_user_role') || '').toUpperCase().trim();
    const isSuperAdmin = userRole.includes('SUPER_ADMIN');
    const selectRol = document.getElementById('empRol');
    if (!selectRol) return;

    const isEditingAdmin = targetUserRole && (targetUserRole === 'ADMIN' || targetUserRole === 'SUPER_ADMIN');

    Array.from(selectRol.options).forEach(opt => {
        const val = opt.value.toUpperCase();
        if (val === 'SUPERVISOR') {
            opt.remove();
        } else if (val === 'ADMIN') {
            if (isSuperAdmin || isEditingAdmin) {
                opt.style.display = '';
                opt.disabled = false;
            } else {
                opt.style.display = 'none';
                opt.disabled = true;
            }
        } else if (val === 'SUPER_ADMIN') {
            if (isSuperAdmin) {
                opt.style.display = '';
                opt.disabled = false;
            } else {
                opt.style.display = 'none';
                opt.disabled = true;
            }
        }
    });

    if (!isSuperAdmin && !isEditingAdmin && (selectRol.value === 'ADMIN' || selectRol.value === 'SUPER_ADMIN' || selectRol.value === 'SUPERVISOR')) {
        selectRol.value = 'VENDEDOR';
    }
}

function abrirEdicion(user) {
    document.getElementById('empleadoId').value = user.id;
    document.getElementById('empNombre').value = user.name || '';
    document.getElementById('empEmail').value = user.email || '';
    
    const userRole = (user.role || 'VENDEDOR').toUpperCase().trim();
    const selectRol = document.getElementById('empRol');

    // 1. Asegurar visibilidad de opciones antes de asignar el valor
    ajustarOpcionesDeRolSegunPermisos(userRole);

    // 2. Asignar correctamente el rol actual al select y aplicar regla de protección
    if (selectRol) {
        selectRol.value = userRole;

        // Regla de Protección Admin: Bloquear degradación accidental
        if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
            selectRol.disabled = true;
        } else {
            selectRol.disabled = false;
        }
    }
    
    document.getElementById('empPassword').value = '';
    if (document.getElementById('empPin')) {
        document.getElementById('empPin').value = '';
    }

    const switchAsignarPin = document.getElementById('switchAsignarPin');
    const hasPin = Boolean(user.securityPin && user.securityPin.trim().length > 0);
    if (switchAsignarPin) {
        switchAsignarPin.checked = hasPin;
    }

    // 3. Ejecutar lógica visual correspondiente
    actualizarVisibilidadPin();

    const smallHint = document.querySelector('#passwordContainer small');
    if (smallHint) smallHint.classList.remove('d-none');

    const elModal = document.getElementById('modalEmpleado');
    if (elModal) {
        modalForm = bootstrap.Modal.getOrCreateInstance(elModal);
        modalForm.show();
    }
}

// Limpiar y resetear modal
const modalElement = document.getElementById('modalEmpleado');
if (modalElement) {
    modalElement.addEventListener('hidden.bs.modal', () => {
        if (formEmpleado) formEmpleado.reset();
        document.getElementById('empleadoId').value = '';
        const selectRol = document.getElementById('empRol');
        if (selectRol) {
            selectRol.disabled = false;
            selectRol.value = 'VENDEDOR';
        }
        const switchAsignarPin = document.getElementById('switchAsignarPin');
        if (switchAsignarPin) switchAsignarPin.checked = false;
        ajustarOpcionesDeRolSegunPermisos();
        actualizarVisibilidadPin();
        const smallHint = document.querySelector('#passwordContainer small');
        if (smallHint) smallHint.classList.add('d-none');
    });

    modalElement.addEventListener('show.bs.modal', () => {
        const id = document.getElementById('empleadoId').value;
        if (!id) {
            const selectRol = document.getElementById('empRol');
            if (selectRol) {
                selectRol.disabled = false;
                selectRol.value = 'VENDEDOR';
            }
            const switchAsignarPin = document.getElementById('switchAsignarPin');
            if (switchAsignarPin) switchAsignarPin.checked = false;
            ajustarOpcionesDeRolSegunPermisos();
            actualizarVisibilidadPin();
        }
    });
}

// ==========================================
// 4. ELIMINACIÓN LÓGICA (DESACTIVAR)
// ==========================================
async function eliminarEmpleado(id, name, rol) {
    if (rol === 'ADMIN' && id === 1) {
        Swal.fire('Denegado', 'No puedes desactivar al Administrador Principal del sistema.', 'error');
        return;
    }

    const { isConfirmed } = await Swal.fire({
        title: `¿Desactivar a ${name}?`,
        html: "El empleado perderá el acceso al sistema y no aparecerá en la lista de usuarios activos.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (isConfirmed) {
        try {
            const res = await apiFetch(`/users/${id}`, { method: 'DELETE' });
            if (res && res.ok) {
                const fila = document.getElementById(`empleado-row-${id}`);
                if (fila) fila.remove();

                Swal.fire({
                    icon: 'success',
                    title: '¡Eliminado!',
                    text: 'El empleado ha sido removido.',
                    timer: 1500,
                    showConfirmButton: false
                });

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

// Exposición global
window.abrirEdicion = abrirEdicion;
window.eliminarEmpleado = eliminarEmpleado;