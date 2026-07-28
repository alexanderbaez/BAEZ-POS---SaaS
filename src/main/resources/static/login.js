/**
 * BÁEZ POS - MÓDULO DE AUTENTICACIÓN Y LOGIN (SaaS)
 * Alexander Baez - 2026
 */

// Variable global para el modal de recuperación
let modalRecuperacionInstance;
const API_AUTH_BASE = '/api/v1/auth';

// 1. Verificación de Setup Inicial al cargar la página
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch(`${API_AUTH_BASE}/setup-status`);
        if (res.ok) {
            const data = await res.json();
            if (data.isSetupRequired === true) {
                window.location.href = 'setup.html';
            }
        }
    } catch (e) {
        console.error("Error de conexión al verificar el estado inicial:", e);
    }
});

// 2. Manejo del Formulario de Autenticación
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    // Limpieza preventiva total de cualquier sesión previa en este navegador
    localStorage.clear();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const btn = document.getElementById('btnIngresar');
    const btnText = document.getElementById('btnText');
    const loader = document.getElementById('loader');
    const messageContainer = document.getElementById('messageContainer');

    messageContainer.innerHTML = '';
    btnText.classList.add('d-none');
    loader.classList.remove('d-none');
    btn.classList.add('disabled');

    try {
        const response = await fetch(`${API_AUTH_BASE}/authenticate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, password: password })
        });

        if (response.ok) {
            const data = await response.json();

            // Normalización flexible y estricta del Rol
            let rawRole = "";
            if (Array.isArray(data.roles) && data.roles.length > 0) {
                rawRole = data.roles[0];
            } else if (data.role) {
                rawRole = data.role;
            }

            let cleanRole = rawRole.replace('ROLE_', '').trim().toUpperCase();
            if (cleanRole === 'SUPERADMIN') cleanRole = 'SUPER_ADMIN';

            // Almacenamiento seguro en LocalStorage
            localStorage.setItem('baezpos_token', data.token);
            localStorage.setItem('baezpos_user_role', cleanRole);
            localStorage.setItem('baezpos_user_name', data.name || data.username || "Usuario");

            if (data.companyId) {
                localStorage.setItem('baezpos_company_id', data.companyId);
            } else if (data.company && data.company.id) {
                localStorage.setItem('baezpos_company_id', data.company.id);
            }

            // Mapeo de variables de estado de la empresa
            const companyObj = data.company || data;
            const isTenantActive = companyObj.active !== undefined ? companyObj.active !== false : true;
            const expirationDate = companyObj.expirationDate || companyObj.expiration || '';

            localStorage.setItem('baezpos_tenant_active', isTenantActive ? 'true' : 'false');
            localStorage.setItem('baezpos_tenant_expiration', expirationDate);

            messageContainer.innerHTML = `<div class="alert alert-success custom-alert mb-3"><i class="bi bi-check-circle me-2"></i>Iniciando sesión...</div>`;

            // Redirección controlada por rol
            setTimeout(() => {
                if (cleanRole === 'SUPER_ADMIN') {
                    window.location.href = 'admin-maestro.html';
                } else if (cleanRole === 'ADMIN' || cleanRole === 'ADMINISTRADOR' || cleanRole === 'OWNER') {
                    window.location.href = 'dashboard.html';
                } else {
                    window.location.href = 'ventas.html';
                }
            }, 600);

        } else {
            let mensajeError = "Credenciales incorrectas";
            try {
                const errorData = await response.json();
                if (errorData && errorData.message) {
                    mensajeError = errorData.message;
                }
            } catch (jsonErr) {
                console.warn("Respuesta sin formato JSON de error:", jsonErr);
            }

            messageContainer.innerHTML = `<div class="alert alert-danger custom-alert mb-3"><i class="bi bi-exclamation-triangle me-2"></i>${mensajeError}</div>`;
            resetButton();
        }
    } catch (error) {
        console.error("Error en la petición de autenticación:", error);
        messageContainer.innerHTML = `<div class="alert alert-warning custom-alert mb-3"><i class="bi bi-wifi-off me-2"></i>Servidor de autenticación no disponible</div>`;
        resetButton();
    }
});

function resetButton() {
    const btnText = document.getElementById('btnText');
    const loader = document.getElementById('loader');
    const btn = document.getElementById('btnIngresar');

    if (btnText) btnText.classList.remove('d-none');
    if (loader) loader.classList.add('d-none');
    if (btn) btn.classList.remove('disabled');
}

// --- 3. RECUPERACIÓN OFFLINE POR HARDWARE ID ---

async function abrirModalRecuperacion() {
    const modalEl = document.getElementById('modalRecuperacion');
    if (!modalRecuperacionInstance && modalEl) {
        modalRecuperacionInstance = new bootstrap.Modal(modalEl);
    }

    const inputLlave = document.getElementById('llaveMaestraInput');
    const pcDisplay = document.getElementById('pcIdDisplay');

    if (inputLlave) inputLlave.value = '';
    if (pcDisplay) pcDisplay.innerText = "OBTENIENDO HARDWARE ID...";

    if (modalRecuperacionInstance) modalRecuperacionInstance.show();

    try {
        const res = await fetch(`${API_AUTH_BASE}/pc-id`);
        if (res.ok) {
            const data = await res.json();
            if (pcDisplay) pcDisplay.innerText = data.pcId || data.id || "SIN ID";
        } else {
            if (pcDisplay) pcDisplay.innerText = "ERROR AL GENERAR ID DE HARDWARE";
        }
    } catch (e) {
        console.error("Error al obtener el PC ID:", e);
        if (pcDisplay) pcDisplay.innerText = "ERROR DE CONEXIÓN CON SERVIDOR LOCAL";
    }
}

function copiarId() {
    const pcDisplay = document.getElementById('pcIdDisplay');
    if (!pcDisplay) return;

    const idText = pcDisplay.innerText;
    if (idText.includes("ERROR") || idText.includes("OBTENIENDO")) return;

    navigator.clipboard.writeText(idText);

    if (typeof Swal !== 'undefined') {
        const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
        Toast.fire({ icon: 'success', title: 'ID copiado al portapapeles' });
    }
}

async function validarLlaveOffline() {
    const inputLlave = document.getElementById('llaveMaestraInput');
    if (!inputLlave) return;

    const llave = inputLlave.value.trim();

    if (llave.length < 5) {
        if (typeof Swal !== 'undefined') {
            Swal.fire('Atención', 'Por favor ingrese la llave de desbloqueo válida.', 'warning');
        }
        return;
    }

    const btnValidar = document.getElementById('btnValidarLlave');
    if (btnValidar) btnValidar.disabled = true;

    try {
        const res = await fetch(`${API_AUTH_BASE}/validar-llave-maestra`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ llave: llave })
        });

        if (res.ok) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: 'Acceso Restablecido',
                    text: 'La llave de seguridad es correcta. Su clave temporal de acceso es: admin123',
                    icon: 'success',
                    confirmButtonColor: '#2563eb'
                }).then(() => {
                    if (modalRecuperacionInstance) modalRecuperacionInstance.hide();
                    const passInput = document.getElementById('password');
                    if (passInput) passInput.value = 'admin123';
                });
            }
        } else {
            if (typeof Swal !== 'undefined') {
                Swal.fire('Acceso Denegado', 'La llave de desbloqueo no es válida para este equipo.', 'error');
            }
        }
    } catch (e) {
        if (typeof Swal !== 'undefined') {
            Swal.fire('Error de Red', 'No se pudo conectar con el servicio local.', 'error');
        }
    } finally {
        if (btnValidar) btnValidar.disabled = false;
    }
}