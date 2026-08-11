/**
 * BÁEZ POS - CENTINELA DE SEGURIDAD Y LICENCIAMIENTO QUIRÚRGICO (SaaS)
 * Alexander Baez - 2026
 */
const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const BACKEND_URL = IS_LOCAL
    ? 'http://localhost:8080'
    : 'https://baez-pos-saas.onrender.com';

const BASE_URL = `${BACKEND_URL}/api/v1`;
const MI_WHATSAPP = "5492645468570";

// Auxiliar robusto para detectar si la vista actual es el Login (URL o DOM)
function esVistaLogin() {
    const path = window.location.pathname.toLowerCase();
    const esUrlLogin = path.endsWith('login.html') || path.endsWith('/login');

    // Si el DOM ya cargó, comprobamos elementos de la interfaz de login
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

// 2. Fetch Helper Universal
async function apiFetch(path, options = {}) {
    const headers = options.headers ? new Headers(options.headers) : new Headers();
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }

    const currentToken = localStorage.getItem('baezpos_token');
    if (currentToken) {
        headers.set('Authorization', `Bearer ${currentToken}`);
    }

    // Normalizar la ruta
    let cleanPath = path.startsWith('/') ? path : `/${path}`;
    if (cleanPath.endsWith('/') && cleanPath.length > 1) {
        cleanPath = cleanPath.slice(0, -1);
    }

    const url = path.startsWith('http') ? path : `${BASE_URL}${cleanPath}`;
    const config = { ...options, headers };

    try {
        const response = await fetch(url, config);

        // Si el token es inválido o no está autenticado (401), destruir sesión
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
    // Freno de mano: Si estamos en vista de login, limpiar cualquier residuo y abortar
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
    if (userRole === 'SUPER_ADMIN') return; // El super admin nunca se bloquea

    // Determinar si la vista actual corresponde estrictamente al Punto de Venta (POS)
    const currentPath = window.location.pathname.toLowerCase();
    const esPaginaPOS = currentPath.includes('ventas.html') ||
                        currentPath.endsWith('/pos') ||
                        currentPath.endsWith('/pos.html') ||
                        currentPath === '/' ||
                        currentPath.endsWith('/index.html');

    try {
        const res = await apiFetch('/admin/my-company/check-status');

        // Re-verificar estado por si cambió la vista mientras se ejecutaba el fetch async
        if (esVistaLogin()) {
            removerNotificacionVencimiento();
            removerBloqueoVentas();
            return;
        }

        if (res && res.ok) {
            const data = await res.json();

            // Si la empresa está inactiva o vencida
            if (data.active === false || data.vencido === true) {
                if (esPaginaPOS) {
                    bloquearPantallaVentas(data.message || "Tu suscripción/licencia se encuentra vencida.");
                } else {
                    removerBloqueoVentas();
                }
            } else {
                removerBloqueoVentas();
            }

            // Notificación global superior si el abono vence en 5 días o menos
            if (data.diasRestantes !== undefined && data.diasRestantes <= 5 && data.diasRestantes >= 0) {
                mostrarNotificacionVencimientoGlobal(data.diasRestantes);
            } else {
                removerNotificacionVencimiento();
            }
        } else if (res && res.status === 403) {
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

// Bloqueo estético MILIMÉTRICO enfocado EXCLUSIVAMENTE en el área de Ventas (sin tapar la Sidebar)
function bloquearPantallaVentas(mensaje) {
    if (esVistaLogin()) return;
    if (document.getElementById('bloqueo-pos-overlay')) return;

    if (typeof CARRITO !== 'undefined') {
        CARRITO = [];
        if (typeof renderizarCarrito === 'function') renderizarCarrito();
    }

    const overlay = document.createElement('div');
    overlay.id = 'bloqueo-pos-overlay';

    // Cálculo dinámico de borde
    const targetContainer = document.getElementById('main-content') ||
                            document.getElementById('content') ||
                            document.querySelector('main');

    let offsetLeft = '250px';
    if (targetContainer && window.innerWidth > 768) {
        const rect = targetContainer.getBoundingClientRect();
        offsetLeft = `${rect.left}px`;
    } else if (window.innerWidth <= 768) {
        offsetLeft = '0px';
    }

    overlay.style.cssText = `
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        left: ${offsetLeft};
        width: auto;
        height: 100vh;
        background: rgba(15, 23, 42, 0.96);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        box-sizing: border-box;
        transition: left 0.15s ease-out;
    `;

    overlay.innerHTML = `
        <div class="card p-5 text-center shadow-lg border-0" style="max-width: 520px; border-radius: 20px; background: #ffffff; z-index: 100000;">
            <div class="mb-3 text-danger">
                <i class="bi bi-shield-lock-fill display-3"></i>
            </div>
            <h3 class="fw-bold text-dark mb-2">Punto de Venta Bloqueado</h3>
            <p class="text-muted mb-3">${mensaje}<br><br><strong>El módulo de emisión de ventas se encuentra inhabilitado por falta de pago. Regulariza tu abono para volver a cobrar.</strong></p>
            <a href="https://wa.me/${MI_WHATSAPP}?text=Hola Alexander, mi Punto de Venta en BaezPOS se encuentra bloqueado por suscripción." target="_blank" class="btn btn-success btn-lg fw-bold py-3 rounded-pill shadow mb-3">
                <i class="bi bi-whatsapp me-2"></i> Regularizar Pago por WhatsApp
            </a>
            <div class="p-2 rounded bg-light border">
                <small class="text-secondary fw-semibold">
                    <i class="bi bi-info-circle me-1"></i> Puedes seguir utilizando la barra lateral para consultar Dashboard, Productos, Clientes y Reportes.
                </small>
            </div>
        </div>
    `;

    window.addEventListener('resize', ajustarOverlayBloqueo);
    document.body.appendChild(overlay);
}

function ajustarOverlayBloqueo() {
    const overlay = document.getElementById('bloqueo-pos-overlay');
    if (!overlay) {
        window.removeEventListener('resize', ajustarOverlayBloqueo);
        return;
    }

    const targetContainer = document.getElementById('main-content') ||
                            document.getElementById('content') ||
                            document.querySelector('main');

    if (targetContainer && window.innerWidth > 768) {
        const rect = targetContainer.getBoundingClientRect();
        overlay.style.left = `${rect.left}px`;
    } else {
        overlay.style.left = '0px';
    }
}

function removerBloqueoVentas() {
    const overlay = document.getElementById('bloqueo-pos-overlay');
    if (overlay) overlay.remove();
    window.removeEventListener('resize', ajustarOverlayBloqueo);
}

/**
 * NOTIFICACIÓN FLOTANTE DE VENCIMIENTO REUBICADA Y ADAPTADA AL LAYOUT RESPONSIVO
 */
function mostrarNotificacionVencimientoGlobal(dias) {
    if (esVistaLogin()) return; // Protección estricta

    let banner = document.getElementById('baezpos-vencimiento-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'baezpos-vencimiento-banner';

        const estilosBanner = document.createElement('style');
        estilosBanner.id = 'baezpos-vencimiento-styles';
        estilosBanner.innerHTML = `
            #baezpos-vencimiento-banner {
                position: fixed;
                top: 12px;
                right: 20px;
                z-index: 1040;
                background: #fff5f5;
                color: #c53030;
                border: 1px solid #feb2b2;
                padding: 8px 16px;
                border-radius: 30px;
                font-weight: 600;
                font-size: 0.85rem;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                display: flex;
                align-items: center;
                gap: 8px;
                animation: fadeInDown 0.3s ease;
            }
            @media (max-width: 768px) {
                #baezpos-vencimiento-banner {
                    top: 60px;
                    left: 15px;
                    right: 15px;
                    justify-content: center;
                    font-size: 0.78rem;
                }
            }
        `;
        if (!document.getElementById('baezpos-vencimiento-styles')) {
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
    // Si la vista es Login, desinfectar UI y no levantar polling
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