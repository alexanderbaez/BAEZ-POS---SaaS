/**
 * BÁEZ POS - MÓDULO DE AUTENTICACIÓN Y LOGIN (SaaS)
 * Alexander Baez - 2026
 */

let modalRecuperacionInstance;

// 1. Verificación de Setup Inicial al cargar la página
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Usa apiFetch para derivar automáticamente a Render/Localhost
        const res = await apiFetch('/auth/setup-status');
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

    // Limpieza preventiva total de cualquier sesión previa
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
        // Llamada segura vía apiFetch para apuntar al backend real mediante POST
        const response = await apiFetch('/auth/authenticate', {
            method: 'POST',
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

// --- 3. RECUPERACIÓN DE CONTRASEÑA VÍA EMAIL (SOLO ADMIN) ---

function abrirModalRecuperacion() {
    const modalEl = document.getElementById('modalRecuperacion');
    if (!modalRecuperacionInstance && modalEl) {
        modalRecuperacionInstance = new bootstrap.Modal(modalEl);
    }

    const emailRecup = document.getElementById('emailRecuperacion');
    const msgRecup = document.getElementById('msgRecuperacion');

    if (emailRecup) emailRecup.value = '';
    if (msgRecup) msgRecup.innerHTML = '';

    if (modalRecuperacionInstance) modalRecuperacionInstance.show();
}

async function enviarRecuperacion() {
    const emailInput = document.getElementById('emailRecuperacion');
    const msgRecup = document.getElementById('msgRecuperacion');
    const btn = document.getElementById('btnEnviarRecuperacion');
    const txtBtn = document.getElementById('txtBtnRecup');
    const loader = document.getElementById('loaderRecup');

    if (!emailInput || !emailInput.value.trim()) {
        if (msgRecup) msgRecup.innerHTML = `<div class="alert alert-warning py-2 mb-3"><i class="bi bi-exclamation-circle me-1"></i>Por favor ingresá un email válido.</div>`;
        return;
    }

    const email = emailInput.value.trim();

    if (msgRecup) msgRecup.innerHTML = '';
    if (txtBtn) txtBtn.classList.add('d-none');
    if (loader) loader.classList.remove('d-none');
    if (btn) btn.classList.add('disabled');

    try {
        const response = await apiFetch('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email: email })
        });

        const data = await response.json();

        if (response.ok) {
            if (msgRecup) {
                msgRecup.innerHTML = `<div class="alert alert-success py-2 mb-3"><i class="bi bi-check-circle me-1"></i>${data.message || 'Se ha enviado una nueva contraseña temporal a su correo.'}</div>`;
            }
            setTimeout(() => {
                if (modalRecuperacionInstance) modalRecuperacionInstance.hide();
            }, 3000);
        } else {
            const errorMsg = data.message || 'No se pudo procesar la solicitud.';
            if (msgRecup) {
                msgRecup.innerHTML = `<div class="alert alert-danger py-2 mb-3"><i class="bi bi-exclamation-triangle me-1"></i>${errorMsg}</div>`;
            }
        }
    } catch (e) {
        console.error("Error al enviar solicitud de recuperación:", e);
        if (msgRecup) {
            msgRecup.innerHTML = `<div class="alert alert-danger py-2 mb-3"><i class="bi bi-wifi-off me-1"></i>Error de conexión con el servidor.</div>`;
        }
    } finally {
        if (txtBtn) txtBtn.classList.remove('d-none');
        if (loader) loader.classList.add('d-none');
        if (btn) btn.classList.remove('disabled');
    }
}