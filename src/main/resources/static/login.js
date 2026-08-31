/**
 * BÃEZ POS - MÃ“DULO DE AUTENTICACIÃ“N Y LOGIN (SaaS)
 * Alexander Baez - 2026
 */

let modalRecuperacionInstance;

// 1. VerificaciÃ³n de Setup Inicial al cargar la pÃ¡gina
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Usa apiFetch para derivar automÃ¡ticamente a Render/Localhost
        const res = await apiFetch('/auth/setup-status');
        if (res.ok) {
            const data = await res.json();
            if (data.isSetupRequired === true) {
                window.location.href = 'setup.html';
            }
        }
    } catch (e) {
        console.error("Error de conexiÃ³n al verificar el estado inicial:", e);
    }
});

// 2. Manejo del Formulario de AutenticaciÃ³n
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    // Limpieza preventiva total de cualquier sesiÃ³n previa
    sessionStorage.clear();
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
        // Llamada segura vÃ­a apiFetch para apuntar al backend real mediante POST
        const response = await apiFetch('/auth/authenticate', {
            method: 'POST',
            body: JSON.stringify({ email: email, password: password })
        });

        if (response.ok) {
            const data = await response.json();

            // NormalizaciÃ³n flexible y estricta del Rol
            let rawRole = "";
            if (Array.isArray(data.roles) && data.roles.length > 0) {
                rawRole = data.roles[0];
            } else if (data.role) {
                rawRole = data.role;
            }

            let cleanRole = rawRole.replace('ROLE_', '').trim().toUpperCase();
            if (cleanRole === 'SUPERADMIN') cleanRole = 'SUPER_ADMIN';

            // Almacenamiento volÃ¡til y seguro en SessionStorage
            sessionStorage.setItem('baezpos_token', data.token);
            sessionStorage.setItem('baezpos_user_role', cleanRole);
            sessionStorage.setItem('baezpos_user_name', data.name || data.username || "Usuario");

            if (data.companyId) {
                sessionStorage.setItem('baezpos_company_id', data.companyId);
            } else if (data.company && data.company.id) {
                sessionStorage.setItem('baezpos_company_id', data.company.id);
            }

            // Mapeo de variables de estado de la empresa
            const companyObj = data.company || data;
            const isTenantActive = companyObj.active !== undefined ? companyObj.active !== false : true;
            const expirationDate = companyObj.expirationDate || companyObj.expiration || '';

            sessionStorage.setItem('baezpos_tenant_active', isTenantActive ? 'true' : 'false');
            sessionStorage.setItem('baezpos_tenant_expiration', expirationDate);

            messageContainer.innerHTML = `<div class="alert alert-success custom-alert mb-3"><i class="bi bi-check-circle me-2"></i>Iniciando sesiÃ³n...</div>`;

            // RedirecciÃ³n controlada por rol
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
        console.error("Error en la peticiÃ³n de autenticaciÃ³n:", error);
        messageContainer.innerHTML = `<div class="alert alert-warning custom-alert mb-3"><i class="bi bi-wifi-off me-2"></i>Servidor de autenticaciÃ³n no disponible</div>`;
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

// --- 3. RECUPERACIÃ“N DE CONTRASEÃ‘A VÃA EMAIL (SOLO ADMIN) ---

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
    setTimeout(() => {
        if (emailRecup) emailRecup.focus();
    }, 350);
}

async function solicitarRecuperacion() {
    const emailInput = document.getElementById('emailRecuperacion');
    const msgRecup = document.getElementById('msgRecuperacion');
    const btn = document.getElementById('btnEnviarRecuperacion');
    const txtBtn = document.getElementById('btnRecuperarText') || document.getElementById('txtBtnRecup');
    const loader = document.getElementById('loaderRecuperar') || document.getElementById('loaderRecup');

    if (!emailInput || !emailInput.value.trim()) {
        if (msgRecup) {
            msgRecup.innerHTML = `
                <div class="alert alert-warning py-2 mb-3 d-flex align-items-center">
                    <i class="bi bi-exclamation-triangle-fill me-2 fs-5"></i>
                    <span>Por favor ingresÃ¡ un email vÃ¡lido.</span>
                </div>`;
        }
        if (emailInput) emailInput.focus();
        return;
    }

    const email = emailInput.value.trim();

    // 1. Estado de carga visual (Spinner y bloqueo)
    if (msgRecup) msgRecup.innerHTML = '';
    if (txtBtn) txtBtn.classList.add('d-none');
    if (loader) loader.classList.remove('d-none');
    if (btn) {
        btn.disabled = true;
        btn.classList.add('disabled');
    }

    try {
        const response = await apiFetch('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email: email })
        });

        let data = {};
        try {
            data = await response.json();
        } catch (jsonErr) {
            data = {};
        }

        if (response.ok) {
            const successMsg = data.message || 'Se ha enviado una nueva contraseÃ±a temporal a tu correo electrÃ³nico.';
            
            if (msgRecup) {
                msgRecup.innerHTML = `
                    <div class="alert alert-success py-3 mb-3 d-flex align-items-center">
                        <i class="bi bi-check-circle-fill me-2 fs-4 text-success"></i>
                        <div>
                            <strong>Â¡Correo enviado!</strong><br>
                            <span>${successMsg}</span>
                        </div>
                    </div>`;
            }

            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'success',
                    title: 'Â¡Correo Enviado!',
                    text: 'RevisÃ¡ tu bandeja de entrada (y spam). Te enviamos una contraseÃ±a provisoria.',
                    confirmButtonColor: '#2563eb',
                    timer: 5000
                });
            }

            setTimeout(() => {
                if (modalRecuperacionInstance) modalRecuperacionInstance.hide();
                if (msgRecup) msgRecup.innerHTML = '';
                if (emailInput) emailInput.value = '';
            }, 3000);

        } else {
            const errorMsg = data.message || 'No se encontrÃ³ un usuario con ese correo o no se pudo procesar la solicitud.';
            if (msgRecup) {
                msgRecup.innerHTML = `
                    <div class="alert alert-danger py-2 mb-3 d-flex align-items-center">
                        <i class="bi bi-x-circle-fill me-2 fs-5"></i>
                        <span>${errorMsg}</span>
                    </div>`;
            }

            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'error',
                    title: 'Error de RecuperaciÃ³n',
                    text: errorMsg,
                    confirmButtonColor: '#2563eb'
                });
            }
        }
    } catch (e) {
        console.error("Error al enviar solicitud de recuperaciÃ³n:", e);
        if (msgRecup) {
            msgRecup.innerHTML = `
                <div class="alert alert-danger py-2 mb-3 d-flex align-items-center">
                    <i class="bi bi-wifi-off me-2 fs-5"></i>
                    <span>Error de conexiÃ³n con el servidor. VerificÃ¡ tu red.</span>
                </div>`;
        }
    } finally {
        // Restaurar estado del botÃ³n
        if (txtBtn) txtBtn.classList.remove('d-none');
        if (loader) loader.classList.add('d-none');
        if (btn) {
            btn.disabled = false;
            btn.classList.remove('disabled');
        }
    }
}

// Alias para compatibilidad de llamadas
const enviarRecuperacion = solicitarRecuperacion;

// Listener para disparar recuperaciÃ³n con la tecla Enter en el input
document.addEventListener('DOMContentLoaded', () => {
    const emailRecupInput = document.getElementById('emailRecuperacion');
    if (emailRecupInput) {
        emailRecupInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                solicitarRecuperacion();
            }
        });
    }

    const btnRecup = document.getElementById('btnEnviarRecuperacion');
    if (btnRecup) {
        btnRecup.addEventListener('click', (e) => {
            e.preventDefault();
            solicitarRecuperacion();
        });
    }
});