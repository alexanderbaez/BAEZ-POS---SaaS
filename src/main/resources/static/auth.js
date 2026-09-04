/**
 * BÁEZ POS - CENTINELA DE SEGURIDAD Y LICENCIAMIENTO QUIRÚRGICO (SaaS)
 * Alexander Baez - 2026
 */

// Detecta si se está ejecutando en entorno de desarrollo local
const IS_LOCAL = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

/**
 * Resolución directa de BACKEND_URL:
 * 1. Override de desarrollo persistido en localStorage ('baezpos_backend_url')
 * 2. Si es localhost, apunta a http://localhost:8080
 * 3. Si no es local (!IS_LOCAL), apunta directamente al backend de Render: https://baez-pos-saas.onrender.com
 */
function resolveBackendUrl() {
    if (typeof sessionStorage !== 'undefined') {
        const customUrl = sessionStorage.getItem('baezpos_backend_url') || (typeof localStorage !== 'undefined' ? localStorage.getItem('baezpos_backend_url') : null);
        if (customUrl) return customUrl.trim();
    }

    if (IS_LOCAL) {
        return 'http://localhost:8080';
    }

    return 'https://baez-pos-saas.onrender.com';
}

const BACKEND_URL = resolveBackendUrl();

// BASE_URL Centralizado: Mantiene el prefijo /api/v1 para todo el sistema
const BASE_URL = BACKEND_URL.endsWith('/api/v1') 
    ? BACKEND_URL 
    : `${BACKEND_URL.replace(/\/+$/, '')}/api/v1`;

const MI_WHATSAPP = "5492645468570";

// Auxiliar robusto para detectar si la vista actual es el Login (URL o DOM)
function esVistaLogin() {
    const path = window.location.pathname.toLowerCase();
    const esUrlLogin = path.endsWith('login.html') || path.endsWith('/login');

    const tieneFormLogin = !!(
        document.getElementById('loginForm') ||
        document.querySelector('form[action*="login"]') ||
        (document.querySelector('input[type="password"]') && !document.getElementById('main-content'))
    );

    return esUrlLogin || tieneFormLogin;
}

// 1. Verificación, decodificación estricta del Token JWT y Sincronización de Identidad
(function verificarSesionInicial() {
    if (esVistaLogin()) return;

    const token = sessionStorage.getItem('baezpos_token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));

        if (Date.now() >= payload.exp * 1000) {
            sessionStorage.clear();
            localStorage.clear();
            window.location.href = 'login.html';
            return;
        }

        const rolBackend = payload.role || payload.roles || 'EMPLEADO';
        const rolLimpio = Array.isArray(rolBackend) ? rolBackend[0] : rolBackend;
        sessionStorage.setItem('baezpos_user_role', rolLimpio.replace('ROLE_', '').toUpperCase().trim());

        if (payload.sub) {
            sessionStorage.setItem('baezpos_user_email', payload.sub);
        }
        if (payload.name || payload.userName) {
            sessionStorage.setItem('baezpos_user_name', payload.name || payload.userName);
        }

    } catch (e) {
        console.error("Token inválido o corrupto:", e);
        sessionStorage.clear();
        localStorage.clear();
        window.location.href = 'login.html';
    }
})();

// 2. Fetch Helper Universal (Construye las URLs usando BASE_URL = /api/v1)
async function apiFetch(path, options = {}) {
    const headers = options.headers ? new Headers(options.headers) : new Headers();
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }

    const currentToken = sessionStorage.getItem('baezpos_token');
    if (currentToken) {
        headers.set('Authorization', `Bearer ${currentToken}`);
    }

    let cleanPath = path.startsWith('/') ? path : `/${path}`;
    if (cleanPath.startsWith('/api/v1/')) {
        cleanPath = cleanPath.substring('/api/v1'.length);
    } else if (cleanPath === '/api/v1') {
        cleanPath = '';
    }
    if (cleanPath.endsWith('/') && cleanPath.length > 1) {
        cleanPath = cleanPath.slice(0, -1);
    }

    const url = path.startsWith('http') ? path : `${BASE_URL}${cleanPath}`;
    const config = { ...options, headers };

    try {
        const response = await fetch(url, config);

        if (response.status === 401) {
            if (!esVistaLogin()) {
                sessionStorage.clear();
                localStorage.clear();
                if (!window.__baezpos_session_expired_alerted) {
                    window.__baezpos_session_expired_alerted = true;
                    alert("Tu sesión fue cerrada porque se inició en otro dispositivo.");
                }
                window.location.href = 'login.html';
                return response;
            }
        }

        if (response.status === 403) {
            try {
                const clonedRes = response.clone();
                const errorData = await clonedRes.json();

                if (errorData && (errorData.error === 'CUENTA_SUSPENDIDA' || errorData.error === 'CUENTA_DESACTIVADA')) {
                    const mensaje = errorData.message || 'Su suscripción se encuentra inhabilitada o vencida.';

                    if (typeof Swal !== 'undefined') {
                        Swal.fire({
                            icon: 'error',
                            title: 'Acción Bloqueada',
                            text: mensaje,
                            confirmButtonColor: '#e11d48',
                            confirmButtonText: 'Entendido'
                        });
                    }

                    if (typeof bloquearPantallaVentas === 'function') {
                        bloquearPantallaVentas(mensaje);
                    }

                    if (typeof chequearEstadoLicencia === 'function') {
                        chequearEstadoLicencia();
                    }

                    throw new Error(`[CUENTA_SUSPENDIDA] ${mensaje}`);
                }
            } catch (e) {
                if (e.message && e.message.startsWith('[CUENTA_SUSPENDIDA]')) {
                    throw e;
                }
            }
        }

        return response;
    } catch (err) {
        if (!err.message || !err.message.startsWith('[CUENTA_SUSPENDIDA]')) {
            console.error(`Error de conexión con el backend: ${url}`, err);
        }
        throw err;
    }
}

// 3. CHEQUEO DE ESTADO DE LICENCIA (MULTI-TENANT GUARD)
async function chequearEstadoLicencia() {
    if (esVistaLogin()) {
        removerNotificacionVencimiento();
        removerBloqueoVentas();
        return;
    }

    const currentToken = sessionStorage.getItem('baezpos_token');
    if (!currentToken) {
        removerNotificacionVencimiento();
        removerBloqueoVentas();
        return;
    }

    const userRole = (sessionStorage.getItem('baezpos_user_role') || '').toUpperCase().trim();
    if (userRole === 'SUPER_ADMIN') return;

    const currentPath = window.location.pathname.toLowerCase();
    const esPaginaPOS = currentPath.includes('ventas.html') ||
                        currentPath.endsWith('/pos') ||
                        currentPath.endsWith('/pos.html') ||
                        currentPath === '/' ||
                        currentPath.endsWith('/index.html');

    try {
        const res = await apiFetch('/admin/my-company/check-status');

        if (esVistaLogin()) {
            removerNotificacionVencimiento();
            removerBloqueoVentas();
            return;
        }

        if (res && res.ok) {
            const data = await res.json();

            // Evaluar y mostrar el banner global según la jerarquía estricta de negocio
            mostrarBannerSuscripcion(data);

            if (data.active === false || data.vencido === true || (data.diasRestantes !== undefined && Number(data.diasRestantes) < 0)) {
                if (esPaginaPOS) {
                    bloquearPantallaVentas(data.message || "Tu suscripción/licencia se encuentra vencida.");
                } else {
                    removerBloqueoVentas();
                }
            } else {
                removerBloqueoVentas();
            }
        } else if (res && res.status === 403) {
            mostrarBannerSuscripcion({ activo: false, estado: 'INACTIVO' });
            if (esPaginaPOS) {
                bloquearPantallaVentas("Su suscripción se encuentra inhabilitada por administración.");
            } else {
                removerBloqueoVentas();
            }
        }
    } catch (err) {
        console.warn("Error consultando estado de licencia:", err);
    }
}

/**
 * BLOQUEO ESTRUCTURAL DE PANTALLA
 */
function bloquearPantallaVentas(mensaje) {
    if (esVistaLogin()) return;
    if (document.getElementById('bloqueo-pos-overlay')) return;

    if (typeof CARRITO !== 'undefined') {
        CARRITO = [];
        if (typeof renderizarCarrito === 'function') renderizarCarrito();
    }

    const mobileBottomBar = document.querySelector('.mobile-bottom-bar');
    if (mobileBottomBar) {
        mobileBottomBar.style.setProperty('display', 'none', 'important');
    }

    let styleElem = document.getElementById('baezpos-bloqueo-styles');
    if (!styleElem) {
        styleElem = document.createElement('style');
        styleElem.id = 'baezpos-bloqueo-styles';
        styleElem.innerHTML = `
            .navbar, header, nav {
                z-index: 1030 !important;
            }

            .sidebar, #sidebar, .offcanvas, .sidebar-wrapper, [class*="sidebar"] {
                z-index: 1060 !important;
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
                filter: none !important;
            }

            .sidebar-backdrop, .sidebar-overlay {
                z-index: 1050 !important;
            }

            #bloqueo-pos-overlay {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                background-color: #0f172a !important;
                z-index: 10 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 20px !important;
                box-sizing: border-box !important;
                overflow: hidden !important;
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
            }

            @media (max-width: 768px) {
                #bloqueo-pos-overlay {
                    top: 56px !important;
                    height: calc(100vh - 56px) !important;
                }
            }
        `;
        document.head.appendChild(styleElem);
    }

    const overlay = document.createElement('div');
    overlay.id = 'bloqueo-pos-overlay';

    overlay.innerHTML = `
        <div class="card p-4 p-md-5 text-center shadow-lg border-0" style="
            max-width: 480px;
            width: 100%;
            border-radius: 20px;
            background: #ffffff;
            position: relative;
            z-index: 11;
        ">
            <div class="mb-3 text-danger">
                <i class="bi bi-shield-lock-fill display-3"></i>
            </div>
            <h3 class="fw-bold text-dark mb-2 fs-4 fs-md-3">Punto de Venta Bloqueado</h3>
            <p class="text-muted mb-4 small fs-md-6" style="line-height: 1.5;">
                ${mensaje}<br><br>
                <strong>El módulo de emisión de ventas se encuentra inhabilitado por falta de pago. Regulariza tu abono para volver a cobrar.</strong>
            </p>
            <a href="https://wa.me/${MI_WHATSAPP}?text=Hola Alexander, mi Punto de Venta en BaezPOS se encuentra bloqueado por suscripción."
               target="_blank"
               class="btn btn-success btn-lg fw-bold py-3 rounded-pill shadow mb-3 w-100 d-flex align-items-center justify-content-center gap-2">
                <i class="bi bi-whatsapp fs-5"></i> Regularizar Pago por WhatsApp
            </a>
            <div class="p-3 rounded bg-light border">
                <small class="text-secondary fw-semibold d-block" style="font-size: 0.78rem;">
                    <i class="bi bi-info-circle me-1"></i> Puedes seguir utilizando la barra lateral para consultar Dashboard, Productos, Clientes y Reportes.
                </small>
            </div>
        </div>
    `;

    // Ocultar botones de acción de caja en el header para evitar apertura de modales durante suspensión
    const controlesCaja = document.querySelectorAll('#btnAbrirCajaUI, #btnCerrarCajaUI, #btnAbrirCajaHeader, #btnCerrarCajaHeader, #badgeEstadoCaja, #btnSyncPendingSales, #btn-abrir-caja, #btn-cerrar-caja, .caja-controls-container, [data-bs-target="#modalAperturaCaja"], [data-bs-target="#modalAbrirCaja"], [data-bs-target="#modalCerrarCaja"], [onclick*="modalAbrirCaja"], [onclick*="modalCerrarCaja"]');
    controlesCaja.forEach(control => {
        control.style.setProperty('display', 'none', 'important');
    });

    const contenedorCaja = document.getElementById('btnAbrirCajaUI')?.closest?.('.border-end') || document.getElementById('badgeEstadoCaja')?.closest?.('.border-end');
    if (contenedorCaja) {
        contenedorCaja.style.setProperty('display', 'none', 'important');
    }

    document.body.appendChild(overlay);
}

function removerBloqueoVentas() {
    const overlay = document.getElementById('bloqueo-pos-overlay');
    if (overlay) overlay.remove();

    const styleElem = document.getElementById('baezpos-bloqueo-styles');
    if (styleElem) styleElem.remove();

    const mobileBottomBar = document.querySelector('.mobile-bottom-bar');
    if (mobileBottomBar) mobileBottomBar.style.display = '';

    // Restaurar controles de caja al desbloquear
    const contenedorCaja = document.getElementById('btnAbrirCajaUI')?.closest?.('.border-end') || document.getElementById('badgeEstadoCaja')?.closest?.('.border-end');
    if (contenedorCaja) {
        contenedorCaja.style.removeProperty('display');
    }

    const controlesCaja = document.querySelectorAll('#btnAbrirCajaUI, #btnCerrarCajaUI, #btnAbrirCajaHeader, #btnCerrarCajaHeader, #badgeEstadoCaja, #btnSyncPendingSales, #btn-abrir-caja, #btn-cerrar-caja, .caja-controls-container, [data-bs-target="#modalAperturaCaja"], [data-bs-target="#modalAbrirCaja"], [data-bs-target="#modalCerrarCaja"], [onclick*="modalAbrirCaja"], [onclick*="modalCerrarCaja"]');
    controlesCaja.forEach(control => {
        control.style.removeProperty('display');
    });

    if (typeof actualizarUICaja === 'function' && typeof SESION_CAJA_ACTIVA !== 'undefined') {
        actualizarUICaja(!!SESION_CAJA_ACTIVA);
    }
}

// ==========================================
// 5. BANNER GLOBAL DE SUSCRIPCIÓN (COMPORTAMIENTO VOLÁTIL Y JERARQUÍA ESTRICTA)
// ==========================================
// Memoria volátil en RAM: NUNCA se persiste en localStorage, sessionStorage ni cookies.
let bannerSuscripcionCerradoVolatil = false;
let ultimoMensajeBannerSuscripcion = null;

/**
 * Evalúa el estado de la cuenta según la jerarquía estricta de negocio:
 * 1. Bloqueo Administrativo (Prioridad 1): Si empresa.activo === false o empresa.estado === 'INACTIVO'
 * 2. Vencida (Prioridad 2): Si diasRestantes < 0
 * 3. Vence Hoy (Prioridad 3): Si diasRestantes === 0
 * 4. Alerta Preventiva (Prioridad 4): Si diasRestantes <= 5 y diasRestantes > 0
 * 
 * La primera condición que se cumpla anula a las demás.
 * 
 * @param {Object|number} empresa Datos de la empresa o respuesta del servidor (o número de días)
 * @param {number} [diasParam] Número de días restantes opcional
 * @returns {{ mensaje: string, tipo: 'alert-danger'|'alert-warning' } | null}
 */
function evaluarJerarquiaSuscripcion(empresa, diasParam) {
    if (empresa === undefined && diasParam === undefined) return null;

    let datos = {};
    if (typeof empresa === 'number') {
        diasParam = empresa;
    } else if (empresa && typeof empresa === 'object') {
        datos = empresa;
    }

    const activo = datos.activo !== undefined ? datos.activo : datos.active;
    const estado = (datos.estado || datos.status || '').toString().trim().toUpperCase();

    let diasRestantes = null;
    if (diasParam !== undefined && diasParam !== null) {
        diasRestantes = Number(diasParam);
    } else if (datos.diasRestantes !== undefined && datos.diasRestantes !== null) {
        diasRestantes = Number(datos.diasRestantes);
    }

    // 1. Bloqueo Administrativo (Prioridad 1): Si la cuenta está inactiva (empresa.activo === false o empresa.estado === 'INACTIVO')
    const esInactivoAdmin = activo === false || 
                            estado === 'INACTIVO' ||
                            (datos.active === false && !datos.vencido && (diasRestantes === null || diasRestantes >= 0));

    if (esInactivoAdmin) {
        return {
            mensaje: 'Atención: Esta cuenta ha sido suspendida administrativamente. Contacte a soporte.',
            tipo: 'alert-danger'
        };
    }

    // 2. Vencida (Prioridad 2): Si diasRestantes < 0
    if (diasRestantes !== null && diasRestantes < 0) {
        return {
            mensaje: 'Atención: Tu suscripción se encuentra vencida. Recordá regularizar el pago.',
            tipo: 'alert-danger'
        };
    }

    // 3. Vence Hoy (Prioridad 3): Si diasRestantes === 0
    if (diasRestantes !== null && diasRestantes === 0) {
        return {
            mensaje: 'Atención: Tu suscripción vence HOY. Recordá regularizar el pago.',
            tipo: 'alert-danger'
        };
    }

    // 4. Alerta Preventiva (Prioridad 4): Si diasRestantes <= 5 y diasRestantes > 0
    if (diasRestantes !== null && diasRestantes <= 5 && diasRestantes > 0) {
        return {
            mensaje: `Aviso: Tu suscripción vence en ${diasRestantes} días.`,
            tipo: 'alert-warning'
        };
    }

    // Si no cumple ninguna de las 4 condiciones prioritarias, no se muestra alerta
    return null;
}

/**
 * Inyecta el contenedor del banner en el DOM dentro del header superior.
 */
function inyectarBannerEnDOM(banner) {
    // 1. Ubicación preferida: dentro del header superior (.navbar .ms-auto)
    const navbarControls = document.querySelector('.navbar .ms-auto') || document.querySelector('nav.navbar .d-flex.ms-auto');
    if (navbarControls) {
        navbarControls.insertBefore(banner, navbarControls.firstChild);
        return;
    }

    // 2. Si hay navbar pero sin .ms-auto, dentro del container de la navbar
    const navbarContainer = document.querySelector('.navbar .container-fluid') || document.querySelector('.navbar');
    if (navbarContainer) {
        navbarContainer.appendChild(banner);
        return;
    }

    // 3. Fallback de contenedor
    const content = document.getElementById('content');
    if (content) {
        content.prepend(banner);
        return;
    }

    // Fallback a nivel de body
    if (document.body) {
        document.body.prepend(banner);
    }
}

/**
 * Muestra o actualiza el banner superior de suscripción.
 * Diseño de píldora compacta ubicada dentro del header superior.
 * El cierre es puramente visual y volátil en RAM (NUNCA en localStorage, sessionStorage ni cookies).
 */
function mostrarBannerSuscripcion(empresa, diasParam) {
    if (esVistaLogin()) {
        removerNotificacionVencimiento();
        return;
    }

    const evaluacion = evaluarJerarquiaSuscripcion(empresa, diasParam);

    if (!evaluacion) {
        removerNotificacionVencimiento();
        ultimoMensajeBannerSuscripcion = null;
        return;
    }

    const { mensaje, tipo } = evaluacion;

    // Si el estado o mensaje cambió respecto a la evaluación anterior, reactivamos la visibilidad
    if (ultimoMensajeBannerSuscripcion !== mensaje) {
        bannerSuscripcionCerradoVolatil = false;
        ultimoMensajeBannerSuscripcion = mensaje;
    }

    // Si fue cerrado visualmente por el usuario en esta vista actual, respetamos su cierre volátil
    if (bannerSuscripcionCerradoVolatil) {
        return;
    }

    let banner = document.getElementById('baezpos-vencimiento-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'baezpos-vencimiento-banner';
        inyectarBannerEnDOM(banner);
    } else if (!banner.parentElement) {
        inyectarBannerEnDOM(banner);
    }

    const colorClase = tipo.startsWith('alert-') ? tipo.replace('alert-', '') : tipo;

    banner.className = `alert alert-${colorClase} alert-dismissible fade show d-flex align-items-center m-0 py-1 px-3 rounded-3 shadow-sm position-relative`;
    banner.setAttribute('role', 'alert');
    banner.style.cssText = 'font-size: 0.8rem; line-height: 1.2; padding-right: 2.5rem !important;';

    banner.innerHTML = `
        <i class="bi bi-exclamation-triangle-fill me-2 fs-6"></i>
        <span class="fw-semibold text-start pe-3">${mensaje}</span>
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close" style="position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%); padding: 0.5rem; font-size: 0.7rem;"></button>
    `;

    // Escucha del evento de cierre de Bootstrap
    banner.addEventListener('close.bs.alert', () => {
        bannerSuscripcionCerradoVolatil = true;
    });

    const btnClose = banner.querySelector('.btn-close');
    if (btnClose) {
        btnClose.addEventListener('click', () => {
            bannerSuscripcionCerradoVolatil = true;
            banner.classList.remove('show');
            setTimeout(() => {
                if (banner) banner.remove();
            }, 150);
        });
    }
}

/**
 * Alias de compatibilidad hacia atrás
 */
function mostrarNotificacionVencimientoGlobal(dias) {
    mostrarBannerSuscripcion(null, dias);
}

function removerNotificacionVencimiento() {
    const banner = document.getElementById('baezpos-vencimiento-banner');
    if (banner) banner.remove();

    const estilosOld = document.getElementById('baezpos-vencimiento-styles');
    if (estilosOld) estilosOld.remove();
}

// Exposición en el objeto global window
window.evaluarJerarquiaSuscripcion = evaluarJerarquiaSuscripcion;
window.mostrarBannerSuscripcion = mostrarBannerSuscripcion;
window.mostrarNotificacionVencimientoGlobal = mostrarNotificacionVencimientoGlobal;
window.removerNotificacionVencimiento = removerNotificacionVencimiento;

// ==========================================
// 6. ARQUITECTURA OFFLINE-FIRST Y SERVICE WORKER
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((reg) => console.log('[SW] Service Worker registrado exitosamente con scope:', reg.scope))
            .catch((err) => console.warn('[SW] No se pudo registrar el Service Worker:', err));
    });
}

/**
 * Centinela de Estado de Red (Online / Offline)
 */
function actualizarEstadoRedGlobal() {
    const isOnline = navigator.onLine;
    let badgeOffline = document.getElementById('badgeModoOfflineGlobal');

    if (!isOnline) {
        if (typeof showSaasToast === 'function') {
            showSaasToast('warning', 'Modo Offline activo: Las ventas se guardarán localmente');
        } else if (typeof Swal !== 'undefined') {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'warning',
                title: 'Modo Offline: Sin conexión',
                showConfirmButton: false,
                timer: 3000
            });
        }

        if (!badgeOffline) {
            badgeOffline = document.createElement('span');
            badgeOffline.id = 'badgeModoOfflineGlobal';
            badgeOffline.className = 'badge bg-danger shadow-sm px-2.5 py-1.5 align-middle me-2 fw-bold';
            badgeOffline.innerHTML = '<i class="bi bi-wifi-off me-1"></i> Modo Offline';

            const navbarControls = document.querySelector('.navbar .ms-auto') || document.querySelector('.navbar');
            if (navbarControls) {
                navbarControls.insertBefore(badgeOffline, navbarControls.firstChild);
            }
        } else {
            badgeOffline.classList.remove('d-none');
        }
    } else {
        if (badgeOffline) {
            badgeOffline.classList.add('d-none');
        }

        // Si vuelve la conexión y hay función de sincronización, ejecutarla
        if (typeof window.syncPendingSales === 'function') {
            window.syncPendingSales();
        }
    }
}

window.addEventListener('online', () => {
    actualizarEstadoRedGlobal();
    if (typeof showSaasToast === 'function') {
        showSaasToast('success', 'Conexión a Internet restablecida');
    }
});

window.addEventListener('offline', () => {
    actualizarEstadoRedGlobal();
});

// Inicialización de ciclo de vida seguro
document.addEventListener('DOMContentLoaded', () => {
    if (esVistaLogin()) {
        removerNotificacionVencimiento();
        removerBloqueoVentas();
        ocultarPantallaDeCarga();
        return;
    }

    // Verificar estado de red inicial
    if (!navigator.onLine) {
        actualizarEstadoRedGlobal();
    }

    chequearEstadoLicencia();
    setInterval(chequearEstadoLicencia, 15000);
});

// ==========================================
// 6. SPLASH SCREEN GLOBAL (CONTROL DE ARRANQUE / COLD-START)
// ==========================================
function inyectarPantallaDeCarga() {
    if (esVistaLogin()) return;
    if (document.getElementById('baez-splash-screen')) return;

    const splash = document.createElement('div');
    splash.id = 'baez-splash-screen';
    splash.innerHTML = `
      <div class="splash-brand-container">
        <div class="splash-logo-badge">
          <i class="bi bi-cart3"></i>
        </div>
        <h1 class="splash-title">BAEZ POS</h1>
        <div class="splash-subtitle">Sistema de Punto de Venta</div>
        <div class="splash-loader-bar">
          <div class="splash-loader-progress"></div>
        </div>
        <div class="splash-status-text" id="splash-status-label">Iniciando aplicación...</div>
      </div>
    `;

    if (document.body) {
        document.body.prepend(splash);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            if (!document.getElementById('baez-splash-screen')) {
                document.body.prepend(splash);
            }
        });
    }

    // Timeout de seguridad estricto (8s) para no bloquear la interfaz
    setTimeout(() => {
        ocultarPantallaDeCarga();
    }, 8000);
}

function ocultarPantallaDeCarga() {
    const splash = document.getElementById('baez-splash-screen');
    if (!splash) return;

    splash.classList.add('fade-out');
    setTimeout(() => {
        if (splash && splash.parentNode) {
            splash.parentNode.removeChild(splash);
        }
    }, 500);
}

// Inyección anticipada en el flujo del script
if (typeof document !== 'undefined' && !esVistaLogin()) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inyectarPantallaDeCarga);
    } else {
        inyectarPantallaDeCarga();
    }
}

// Cierre de Sesión Universal
function cerrarSesion(e) {
    if (e) e.preventDefault();
    sessionStorage.clear();
    localStorage.clear();
    window.location.href = 'login.html';
}