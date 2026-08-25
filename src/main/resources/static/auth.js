/**
 * BÁEZ POS - CENTINELA DE SEGURIDAD Y LICENCIAMIENTO QUIRÚRGICO (SaaS)
 * Alexander Baez - 2026
 */

// Detecta si se está ejecutando en entorno de desarrollo local
const IS_LOCAL = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

/**
 * Resolución dinámica y desacoplada de BACKEND_URL:
 * 1. Variable global inyectada en runtime (window.__ENV__?.BACKEND_URL o window.BACKEND_URL)
 * 2. Placeholder reemplazado en la fase de build de AWS Amplify (__BACKEND_URL_PLACEHOLDER__)
 * 3. Override de desarrollo persistido en localStorage ('baezpos_backend_url')
 * 4. Si es localhost, apunta a http://localhost:8080
 * 5. Si es AWS Amplify (*.amplifyapp.com), apunta a la API de producción https://api.baezpos.com
 * 6. Fallback a cadena vacía para proxy inverso Nginx
 */
function resolveBackendUrl() {
    if (typeof window !== 'undefined' && window.__ENV__ && window.__ENV__.BACKEND_URL) {
        return window.__ENV__.BACKEND_URL.trim();
    }
    if (typeof window !== 'undefined' && window.BACKEND_URL) {
        return window.BACKEND_URL.trim();
    }

    const buildPlaceholder = '__BACKEND_URL_PLACEHOLDER__';
    if (buildPlaceholder && !buildPlaceholder.startsWith('__')) {
        return buildPlaceholder.trim();
    }

    if (typeof localStorage !== 'undefined') {
        const customUrl = localStorage.getItem('baezpos_backend_url');
        if (customUrl) return customUrl.trim();
    }

    if (IS_LOCAL) {
        return 'http://localhost:8080';
    }

    if (typeof window !== 'undefined' && window.location.hostname.includes('amplifyapp.com')) {
        return 'https://api.baezpos.com';
    }

    return '';
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

    const token = localStorage.getItem('baezpos_token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));

        if (Date.now() >= payload.exp * 1000) {
            localStorage.clear();
            window.location.href = 'login.html';
            return;
        }

        const rolBackend = payload.role || payload.roles || 'EMPLEADO';
        const rolLimpio = Array.isArray(rolBackend) ? rolBackend[0] : rolBackend;
        localStorage.setItem('baezpos_user_role', rolLimpio.replace('ROLE_', '').toUpperCase().trim());

        if (payload.sub) {
            localStorage.setItem('baezpos_user_email', payload.sub);
        }
        if (payload.name || payload.userName) {
            localStorage.setItem('baezpos_user_name', payload.name || payload.userName);
        }

    } catch (e) {
        console.error("Token inválido o corrupto:", e);
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

    const currentToken = localStorage.getItem('baezpos_token');
    if (currentToken) {
        headers.set('Authorization', `Bearer ${currentToken}`);
    }

    let cleanPath = path.startsWith('/') ? path : `/${path}`;
    if (cleanPath.endsWith('/') && cleanPath.length > 1) {
        cleanPath = cleanPath.slice(0, -1);
    }

    const url = path.startsWith('http') ? path : `${BASE_URL}${cleanPath}`;
    const config = { ...options, headers };

    try {
        const response = await fetch(url, config);

        if (response.status === 401) {
            if (!esVistaLogin()) {
                localStorage.clear();
                window.location.href = 'login.html';
            }
        }

        return response;
    } catch (err) {
        console.error(`Error de conexión con el backend: ${url}`, err);
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

    const currentToken = localStorage.getItem('baezpos_token');
    if (!currentToken) {
        removerNotificacionVencimiento();
        removerBloqueoVentas();
        return;
    }

    const userRole = (localStorage.getItem('baezpos_user_role') || '').toUpperCase().trim();
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

            if (data.active === false || data.vencido === true) {
                removerNotificacionVencimiento();
                if (esPaginaPOS) {
                    bloquearPantallaVentas(data.message || "Tu suscripción/licencia se encuentra vencida.");
                } else {
                    removerBloqueoVentas();
                }
            } else {
                removerBloqueoVentas();
                if (data.diasRestantes !== undefined && data.diasRestantes <= 5 && data.diasRestantes >= 0) {
                    mostrarNotificacionVencimientoGlobal(data.diasRestantes);
                } else {
                    removerNotificacionVencimiento();
                }
            }
        } else if (res && res.status === 403) {
            removerNotificacionVencimiento();
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
                z-index: 1050 !important;
            }

            .sidebar, #sidebar, .offcanvas, .sidebar-wrapper, [class*="sidebar"] {
                z-index: 10000 !important;
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
                filter: none !important;
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
                z-index: 1040 !important;
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
            z-index: 1041;
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

    document.body.appendChild(overlay);
}

function removerBloqueoVentas() {
    const overlay = document.getElementById('bloqueo-pos-overlay');
    if (overlay) overlay.remove();

    const styleElem = document.getElementById('baezpos-bloqueo-styles');
    if (styleElem) styleElem.remove();

    const mobileBottomBar = document.querySelector('.mobile-bottom-bar');
    if (mobileBottomBar) mobileBottomBar.style.display = '';
}

/**
 * NOTIFICACIÓN FLOTANTE DE VENCIMIENTO (BANNER SUPERIOR)
 */
function mostrarNotificacionVencimientoGlobal(dias) {
    if (esVistaLogin()) return;

    let banner = document.getElementById('baezpos-vencimiento-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'baezpos-vencimiento-banner';

        const estilosBanner = document.createElement('style');
        estilosBanner.id = 'baezpos-vencimiento-styles';
        estilosBanner.innerHTML = `
            #baezpos-vencimiento-banner {
                position: fixed;
                top: 10px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 1060;
                background: #fff5f5;
                color: #c53030;
                border: 1px solid #feb2b2;
                padding: 6px 16px;
                border-radius: 30px;
                font-weight: 600;
                font-size: 0.82rem;
                box-shadow: 0 4px 12px rgba(0,0,0,0.12);
                display: flex;
                align-items: center;
                gap: 8px;
                white-space: nowrap;
            }
            @media (max-width: 768px) {
                #baezpos-vencimiento-banner {
                    top: 60px;
                    width: 90%;
                    left: 5%;
                    transform: none;
                    white-space: normal;
                    text-align: center;
                    justify-content: center;
                    font-size: 0.75rem;
                }
            }
        `;
        if (!document.head.querySelector('#baezpos-vencimiento-styles')) {
            document.head.appendChild(estilosBanner);
        }

        document.body.appendChild(banner);
    }

    const textoDias = dias === 0 ? 'vence <strong>HOY</strong>' : `vence en <strong>${dias} ${dias === 1 ? 'día' : 'días'}</strong>`;

    banner.innerHTML = `
        <i class="bi bi-exclamation-triangle-fill text-danger fs-6"></i>
        <span>Atención: Tu suscripción ${textoDias}. Recordá regularizar el pago.</span>
    `;
}

function removerNotificacionVencimiento() {
    const banner = document.getElementById('baezpos-vencimiento-banner');
    if (banner) banner.remove();
}

// Inicialización de ciclo de vida seguro
document.addEventListener('DOMContentLoaded', () => {
    if (esVistaLogin()) {
        removerNotificacionVencimiento();
        removerBloqueoVentas();
        return;
    }

    chequearEstadoLicencia();
    setInterval(chequearEstadoLicencia, 15000);
});

// Cierre de Sesión Universal
function cerrarSesion(e) {
    if (e) e.preventDefault();
    localStorage.clear();
    window.location.href = 'login.html';
}