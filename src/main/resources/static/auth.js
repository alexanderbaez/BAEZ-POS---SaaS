/**
 * BÁEZ POS - CENTINELA DE SEGURIDAD Y VERIFICACIÓN EN TIEMPO REAL (SaaS)
 * Alexander Baez - 2026
 */

const BASE_URL = '/api/v1';
const API_STATUS = '/api/v1/auth/setup-status'; // O tu endpoint de estado de licencia
const MI_WHATSAPP = "5491112345678"; // <--- PONÉ TU NÚMERO ACÁ (sin espacios ni +)

let sistemaBloqueado = false;
let carteBloqueoAbierto = false;

// 1. Verificación básica de Token al ingresar
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
        }
    } catch (e) {
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
        if (response.status === 401) {
            localStorage.clear();
            window.location.href = 'login.html';
        }
        return response;
    } catch (err) {
        console.error(`Error de conexión con el backend: ${url}`, err);
        throw err;
    }
}

// 3. CHEQUEO EN TIEMPO REAL DE SUSPENSIÓN Y VENCIMIENTO (CADA 15 SEGUNDOS)
// En auth.js, dentro de chequearEstadoLicencia():
async function chequearEstadoLicencia() {
    if (window.location.pathname.endsWith('login.html')) return;

    const userRole = (localStorage.getItem('baezpos_user_role') || '').toUpperCase().trim();
    if (userRole === 'SUPER_ADMIN' && window.location.pathname.includes('admin-maestro.html')) {
        return;
    }

    try {
        // RUTA REAL DEL CONTROLLER DE JAVA
        const res = await apiFetch('/admin/my-company/check-status');

        if (res && res.ok) {
            const data = await res.json();

            // A) Si está suspendido o inactivo o vencido -> Bloqueo SweetAlert
            if (data.active === false || data.vencido === true) {
                mostrarCartelBloqueo(data.message || "Tu suscripción/licencia se encuentra vencida.");
                return;
            }

            // B) Notificación si quedan 5 días o menos
            if (data.diasRestantes !== undefined && data.diasRestantes <= 5 && data.diasRestantes >= 0) {
                mostrarNotificacionVencimientoGlobal(data.diasRestantes);
            } else {
                removerNotificacionVencimiento();
            }
        }
    } catch (err) {
        console.warn("Error consultando estado de licencia en vivo:", err);
    }
}

// Bloqueo total modal con SweetAlert2
function mostrarCartelBloqueo(mensaje) {
    if (carteBloqueoAbierto) return;
    carteBloqueoAbierto = true;

    // Vaciamos el carrito si estamos en el punto de venta
    if (typeof CARRITO !== 'undefined') {
        CARRITO = [];
        if (typeof renderizarCarrito === 'function') renderizarCarrito();
    }

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: '¡SERVICIO SUSPENDIDO!',
            html: `<p class="mb-2">${mensaje}</p><b>Ponte en contacto para reactivar tu Punto de Venta inmediatamente.</b>`,
            icon: 'error',
            allowOutsideClick: false,
            allowEscapeKey: false,
            confirmButtonColor: '#25D366',
            confirmButtonText: '<i class="bi bi-whatsapp"></i> Hablar con Administración',
        }).then((result) => {
            if (result.isConfirmed) {
                window.open(`https://wa.me/${MI_WHATSAPP}?text=Hola Alexander, mi sistema BaezPOS aparece como suspendido.`);
                carteBloqueoAbierto = false;
                setTimeout(() => mostrarCartelBloqueo(mensaje), 1000);
            }
        });
    } else {
        alert("SERVICIO SUSPENDIDO: " + mensaje);
    }
}

// Notificación permanente flotante superior para TODAS las pantallas
function mostrarNotificacionVencimientoGlobal(dias) {
    let banner = document.getElementById('baezpos-vencimiento-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'baezpos-vencimiento-banner';
        banner.style.cssText = `
            position: fixed;
            top: 12px;
            right: 20px;
            z-index: 999999;
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
        `;
        document.body.appendChild(banner);
    }

    banner.innerHTML = `
        <i class="bi bi-exclamation-triangle-fill text-danger fs-6"></i>
        <span>Atención: Tu suscripción vence en <strong>${dias} ${dias === 1 ? 'día' : 'días'}</strong>. Recordá regularizar el pago.</span>
    `;
}

// Iniciar chequeo inmediato y repetirlo cada 15 segundos en tiempo real
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