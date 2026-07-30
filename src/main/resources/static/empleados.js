/**
 * BÁEZ POS - MÓDULO DE EMPLEADOS (SaaS)
 * Alexander Baez - 2026
 */

// URL base de tu backend en Render
const BACKEND_URL = 'https://baez-pos-saas.onrender.com';

/**
 * FUNCIÓN HELPER API-FETCH INTELIGENTE
 * Añade automáticamente el prefijo /api/v1 y el token de autenticación del SaaS.
 */
async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem('baezpos_token') || '';

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...(options.headers || {})
    };

    let url;
    if (endpoint.startsWith('http')) {
        url = endpoint;
    } else {
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        url = `${BACKEND_URL}/api/v1${cleanEndpoint}`;
    }

    return await fetch(url, { ...options, headers });
}

document.addEventListener('DOMContentLoaded', () => {
    // Verificar si es ADMIN
    const userRole = localStorage.getItem('baezpos_user_role');
    if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
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

    cargarEmpleados();
});

let modalForm = null;

async function cargarEmpleados() {
    try {
        const res = await apiFetch('/users');
        const usuarios = await res.json();

        const tbody = document.getElementById('tablaEmpleados');
        tbody.innerHTML = '';

        usuarios.forEach(user => {
            let badgeClass = 'bg-light';
            if (user.role === 'ADMIN') badgeClass = 'bg-danger';
            if (user.role === 'VENDEDOR') badgeClass = 'bg-primary';
            if (user.role === 'CAJERO') badgeClass = 'bg-success';

            tbody.innerHTML += `
                <tr>
                    <td>
                        <div class="d-flex align-items-center gap-3">
                            <div class="bg-primary rounded-circle d-flex align-items-center justify-content-center fw-bold text-white shadow-sm" style="width: 38px; height: 38px;">
                                ${(user.name || 'Usuario').charAt(0).toUpperCase()}
                            </div>
                            <span class="fw-bold">${user.name || 'Sin Nombre'}</span>
                        </div>
                    </td>
                    <td class="text-secondary align-middle">${user.email}</td>
                    <td class="align-middle"><span class="badge ${badgeClass} rounded-pill">${user.role}</span></td>
                    <td class="text-end align-middle">
                        <button class="btn btn-sm btn-outline-secondary rounded-circle me-2" onclick='abrirEdicion(${JSON.stringify(user)})' title="Editar"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger rounded-circle" onclick="eliminarEmpleado(${user.id}, '${user.name}', '${user.role}')" title="Eliminar"><i class="bi bi-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    } catch (e) {
        console.error("Error al cargar empleados", e);
        Swal.fire('Error', 'No se pudieron cargar los empleados', 'error');
    }
}

document.getElementById('formEmpleado').addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('empleadoId').value;
    const isEditing = id !== "";

    const payload = {
        name: document.getElementById('empNombre').value,
        email: document.getElementById('empEmail').value,
        role: document.getElementById('empRol').value
    };

    const password = document.getElementById('empPassword').value;
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

        if (res.ok) {
            Swal.fire({
                title: 'Éxito',
                text: isEditing ? 'Empleado actualizado.' : 'Nuevo empleado creado.',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            });
            modalForm.hide();
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
                text: errorMessage.includes('ya existe')
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

function abrirEdicion(user) {
    document.getElementById('empleadoId').value = user.id;
    document.getElementById('empNombre').value = user.name;
    document.getElementById('empEmail').value = user.email;
    document.getElementById('empRol').value = user.role;
    document.getElementById('empPassword').value = '';
    document.getElementById('passwordContainer').querySelector('small').classList.remove('d-none');

    if (!modalForm) modalForm = new bootstrap.Modal(document.getElementById('modalEmpleado'));
    modalForm.show();
}

// Limpiar modal al cerrarlo para cuando quieran crear uno nuevo
document.getElementById('modalEmpleado').addEventListener('hidden.bs.modal', () => {
    document.getElementById('formEmpleado').reset();
    document.getElementById('empleadoId').value = '';
    document.getElementById('passwordContainer').querySelector('small').classList.add('d-none');
});

// Inicializar bootstrap modal
document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('modalEmpleado');
    if(el) {
        modalForm = new bootstrap.Modal(el);
        document.getElementById('passwordContainer').querySelector('small').classList.add('d-none');
    }
});

async function eliminarEmpleado(id, name, rol) {
    if(rol === 'ADMIN' && id === 1) {
        Swal.fire('Denegado', 'No puedes eliminar al Administrador Principal.', 'error');
        return;
    }

    const { isConfirmed } = await Swal.fire({
        title: '¿Eliminar a ' + name + '?',
        text: "Esta acción no se puede deshacer y el empleado no podrá ingresar al sistema.",
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
            if (res.ok) {
                Swal.fire('Eliminado!', 'El empleado ha sido removido.', 'success');
                cargarEmpleados();
            } else {
                Swal.fire('Error', 'No se pudo eliminar al empleado.', 'error');
            }
        } catch(e) {
             console.error("Error al eliminar", e);
        }
    }
}