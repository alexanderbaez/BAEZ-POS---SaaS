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

// 1. Verificación, decodificación estricta del Token JWT y Sincronización de Identidad
(function verificarSesionInicial() {
    if (window.location.pathname.endsWith('login.html')) return;

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

    const config = { ...options, headers };
    const url = path.startsWith('http') ? path : `${BASE_URL}${path.startsWith('/') ? path : '/' + path}`;

    try {
        const response = await fetch(url, config);
        if (response.status === 401 || response.status === 403) {
            localStorage.clear();
            window.location.href = 'login.html';
        }
        return response;
    } catch (err) {
        console.error(`Error de conexión con el backend: ${url}`, err);
        throw err;
    }
}

// 3. CHEQUEO DE ESTADO DE LICENCIA (Diseño Quirúrgico Exclusivo para el Punto de Venta)
async function chequearEstadoLicencia() {
    if (window.location.pathname.endsWith('login.html')) return;

    const userRole = (localStorage.getItem('baezpos_user_role') || '').toUpperCase().trim();
    if (userRole === 'SUPER_ADMIN') return; // El super admin nunca se bloquea

    try {
        const res = await apiFetch('/admin/my-company/check-status');

        if (res && res.ok) {
            const data = await res.json();

            // Si la empresa está inactiva o vencida
            if (data.active === false || data.vencido === true) {
                if (window.location.pathname.includes('ventas.html')) {
                    bloquearPantallaVentas(data.message || "Tu suscripción/licencia se encuentra vencida.");
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
        }
    } catch (err) {
        console.warn("Error consultando estado de licencia:", err);
    }
}

// Bloqueo estético específico y bloqueante para el Punto de Venta
function bloquearPantallaVentas(mensaje) {
    const contentDiv = document.getElementById('content');
    if (!contentDiv) return;

    if (document.getElementById('bloqueo-pos-overlay')) return;

    if (typeof CARRITO !== 'undefined') {
        CARRITO = [];
        if (typeof renderizarCarrito === 'function') renderizarCarrito();
    }

    const overlay = document.createElement('div');
    overlay.id = 'bloqueo-pos-overlay';
    overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(15, 23, 42, 0.92);
        backdrop-filter: blur(8px);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
    `;

    overlay.innerHTML = `
        <div class="card p-5 text-center shadow-lg border-0" style="max-width: 550px; border-radius: 20px; background: white;">
            <div class="mb-3 text-danger">
                <i class="bi bi-shield-lock-fill display-3"></i>
            </div>
            <h3 class="fw-bold text-dark mb-2">Punto de Venta Bloqueado</h3>
            <p class="text-muted mb-4">${mensaje}<br><br><strong>El sistema se encuentra bloqueado por falta de pago de suscripción. Comunícate con la administración para abonar y restablecer las ventas de inmediato.</strong></p>
            <a href="https://wa.me/${MI_WHATSAPP}?text=Hola Alexander, mi sistema BaezPOS tiene el Punto de Venta bloqueado por suscripción." target="_blank" class="btn btn-success btn-lg fw-bold py-3 rounded-pill shadow">
                <i class="bi bi-whatsapp me-2"></i> Regularizar Pago por WhatsApp
            </a>
            <p class="small text-secondary mt-3 mb-0">Nota: Puedes seguir consultando reportes, clientes y gastos con normalidad.</p>
        </div>
    `;

    contentDiv.style.position = 'relative';
    contentDiv.appendChild(overlay);
}

function removerBloqueoVentas() {
    const overlay = document.getElementById('bloqueo-pos-overlay');
    if (overlay) overlay.remove();
}

/**
 * NOTIFICACIÓN FLOTANTE DE VENCIMIENTO REUBICADA Y ADAPTADA AL LAYOUT RESPONSIVO
 */
function mostrarNotificacionVencimientoGlobal(dias) {
    let banner = document.getElementById('baezpos-vencimiento-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'baezpos-vencimiento-banner';

        // CSS inyectado con responsive query para no colisionar con el Navbar ni con el Sidebar (250px)
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

// Iniciar chequeo inmediato y repetirlo cada 15 segundos
document.addEventListener('DOMContentLoaded', () => {
    chequearEstadoLicencia();
    setInterval(chequearEstadoLicencia, 15000);
});

// Función de Cierre de Sesión Universal
function cerrarSesion(e) {
    if (e) e.preventDefault();
    localStorage.clear();
    window.location.href = 'login.html';
}