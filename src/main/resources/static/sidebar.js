/**
 * BÁEZ POS - COMPONENTE SIDEBAR Y NAVBAR DINÁMICO (SaaS Multi-tenant)
 * Alexander Baez - 2026
 */

(function renderSidebarInstantaneo() {
    // 1. Inyectar estilos CSS globales de inmediato
    if (!document.getElementById('sidebar-styles')) {
        const estilos = document.createElement('style');
        estilos.id = 'sidebar-styles';
        estilos.innerHTML = `
            @media (min-width: 769px) {
                body {
                    background-color: #f8fafc;
                }
                /* Empujamos únicamente el contenedor principal o el body con margen izquierdo limpio (sincronizado a 250px) */
                body > *:not(#sidebar):not(#sidebar-overlay) {
                    margin-left: 250px !important;
                }
            }
            #sidebar {
                width: 250px;
                height: 100vh;
                position: fixed;
                top: 0;
                left: 0;
                background: #1e293b !important;
                z-index: 1050 !important;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                transition: left 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .nav-link-custom {
                color: #94a3b8 !important;
                padding: 10px 16px;
                border-radius: 8px;
                margin: 2px 12px;
                display: flex;
                align-items: center;
                text-decoration: none;
                font-size: 0.95rem;
                font-weight: 500;
                transition: all 0.2s ease;
            }
            .nav-link-custom:hover {
                color: #ffffff !important;
                background: rgba(255, 255, 255, 0.08) !important;
                transform: translateX(3px);
            }
            .nav-link-custom.active-page {
                background-color: #2563eb !important;
                color: #ffffff !important;
                font-weight: 600;
                box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
            }
            .user-badge {
                background: rgba(255, 255, 255, 0.05);
                border-radius: 12px;
                padding: 10px 15px;
                margin: 10px 12px;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            .sidebar-backdrop {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.5);
                z-index: 1040 !important;
                display: none;
                opacity: 0;
                transition: opacity 0.3s ease;
                backdrop-filter: blur(2px);
                -webkit-backdrop-filter: blur(2px);
            }
            .sidebar-backdrop.show {
                display: block;
                opacity: 1;
            }

            @media (max-width: 768px) {
                body > *:not(#sidebar):not(.sidebar-backdrop) { margin-left: 0 !important; }
                #sidebar { left: -250px !important; }
                #sidebar.active { left: 0 !important; }
            }
        `;
        document.head.appendChild(estilos);
    }

    // 2. Recuperar y sanitizar datos de sesión
    const rawRole = (localStorage.getItem('baezpos_user_role') || 'EMPLEADO').toUpperCase().trim();
    const rawName = localStorage.getItem('baezpos_user_name') || 'Usuario';
    const rawTenant = localStorage.getItem('baezpos_tenant_name') || rawName;

    const userRole = escapeHTML(rawRole);
    const userName = escapeHTML(rawName);
    const tenantName = escapeHTML(rawTenant);

    // BLINDAJE DE ROL
    const isSuperAdmin = (rawRole === 'SUPER_ADMIN');
    const isAdmin = isSuperAdmin || rawRole === 'ADMIN' || rawRole === 'ADMINISTRADOR' || rawRole === 'OWNER';

    const paginaActual = window.location.pathname.split("/").pop() || "dashboard.html";

    // 3. Inyección del menú
    function inyectarHTML() {
        const sidebarContainer = document.getElementById('sidebar-container');
        if (!sidebarContainer) return;

        sidebarContainer.innerHTML = `
            <nav id="sidebar" class="shadow">
              <div>
                <!-- Header del Sidebar -->
                <div class="p-3 text-center border-bottom border-secondary border-opacity-25">
                  <h3 class="text-white fw-bold m-0" style="letter-spacing: -0.5px;">BaezPOS</h3>
                  <small class="text-primary fw-semibold" style="font-size: 0.75rem;">SaaS Cloud Edition</small>
                </div>

                <!-- Menú de Navegación -->
                <div class="nav flex-column px-1 gap-1 mt-3">
                  ${isSuperAdmin ? `
                  <a href="admin-maestro.html" class="nav-link-custom bg-warning bg-opacity-20 text-warning ${paginaActual === 'admin-maestro.html' ? 'active-page' : ''}">
                    <i class="bi bi-shield-lock me-3 fs-5"></i> Panel Maestro SaaS
                  </a>` : ''}

                  ${isAdmin ? `
                  <a href="dashboard.html" class="nav-link-custom ${paginaActual === 'dashboard.html' ? 'active-page' : ''}">
                    <i class="bi bi-speedometer2 me-3 fs-5"></i> Dashboard
                  </a>` : ''}

                  <a href="ventas.html" class="nav-link-custom ${paginaActual === 'ventas.html' ? 'active-page' : ''}">
                    <i class="bi bi-cart me-3 fs-5"></i> Punto de Venta
                  </a>

                  ${isAdmin ? `
                  <a href="productos.html" class="nav-link-custom ${paginaActual === 'productos.html' ? 'active-page' : ''}">
                    <i class="bi bi-box-seam me-3 fs-5"></i> Productos
                  </a>` : ''}

                  <a href="clientes.html" class="nav-link-custom ${paginaActual === 'clientes.html' ? 'active-page' : ''}">
                    <i class="bi bi-people me-3 fs-5"></i> Clientes (Cta. Cte)
                  </a>

                  ${isAdmin ? `
                  <a href="proveedores.html" class="nav-link-custom ${paginaActual === 'proveedores.html' ? 'active-page' : ''}">
                    <i class="bi bi-truck me-3 fs-5"></i> Proveedores
                  </a>` : ''}

                  ${isAdmin ? `
                  <a href="gastos.html" class="nav-link-custom ${paginaActual === 'gastos.html' ? 'active-page' : ''}">
                    <i class="bi bi-wallet2 me-3 fs-5"></i> Gastos
                  </a>` : ''}

                  ${isAdmin ? `
                  <a href="historial.html" class="nav-link-custom ${paginaActual === 'historial.html' ? 'active-page' : ''}">
                    <i class="bi bi-clock-history me-3 fs-5"></i> Historial Ventas
                  </a>` : ''}

                  ${isAdmin ? `
                  <a href="empleados.html" class="nav-link-custom ${paginaActual === 'empleados.html' ? 'active-page' : ''}">
                    <i class="bi bi-person-badge me-3 fs-5"></i> Empleados
                  </a>` : ''}

                  ${isAdmin ? `
                  <a href="perfil.html" class="nav-link-custom ${paginaActual === 'perfil.html' ? 'active-page' : ''}">
                    <i class="bi bi-shop me-3 fs-5"></i> Mi Negocio
                  </a>` : ''}
                </div>
              </div>

              <!-- Footer: Usuario Logueado -->
              <div class="pb-3">
                <div class="user-badge text-white">
                    <div class="d-flex align-items-center">
                        <i class="bi bi-person-circle fs-3 me-2 text-primary"></i>
                        <div class="text-truncate">
                            <div class="fw-bold text-truncate" style="font-size: 0.85rem;">${tenantName}</div>
                            <span class="badge bg-secondary" style="font-size: 0.65rem;">${userRole}</span>
                        </div>
                    </div>
                </div>

                <a href="#" id="btnCerrarSesion" class="nav-link-custom text-danger">
                  <i class="bi bi-box-arrow-left me-3 fs-5"></i> Cerrar Sesión
                </a>
              </div>
            </nav>
        `;

        // Sincronizar Navbar Superior
        const elUserName = document.getElementById('userName');
        const elUserRoleBadge = document.getElementById('userRoleBadge');

        if (elUserName) {
            elUserName.textContent = rawTenant;
        }
        if (elUserRoleBadge) {
            elUserRoleBadge.textContent = rawRole;
            elUserRoleBadge.className = `badge text-uppercase ${isSuperAdmin ? 'bg-warning text-dark' : (isAdmin ? 'bg-primary' : 'bg-secondary')}`;
            elUserRoleBadge.style.fontSize = '0.65rem';
        }

        inicializarGestosSidebar();
    }

    if (document.getElementById('sidebar-container')) {
        inyectarHTML();
    } else {
        document.addEventListener('DOMContentLoaded', inyectarHTML);
    }
})();

// Control de eventos globales, Backdrop y Swipe
document.addEventListener('DOMContentLoaded', () => {
    asegurarBackdropGlobal();
    inicializarGestosSidebar();
});

function asegurarBackdropGlobal() {
    let backdrop = document.querySelector('.sidebar-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.className = 'sidebar-backdrop';
        backdrop.id = 'sidebar-backdrop';
        document.body.appendChild(backdrop);
    }
    backdrop.onclick = cerrarSidebar;
    return backdrop;
}

// Variables para control de deslizamiento (Swipe)
let touchStartX = 0;
let touchStartY = 0;

function inicializarGestosSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar || sidebar.dataset.swipeAttached) return;
    sidebar.dataset.swipeAttached = "true";

    sidebar.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches.length > 0) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }
    }, { passive: true });

    sidebar.addEventListener('touchend', (e) => {
        if (e.changedTouches && e.changedTouches.length > 0) {
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            const diffX = touchStartX - touchEndX;
            const diffY = Math.abs(touchStartY - touchEndY);

            // Si el usuario desliza hacia la izquierda (diferencia de X > 50px)
            if (diffX > 50 && diffX > diffY) {
                cerrarSidebar();
            }
        }
    }, { passive: true });
}

document.addEventListener('click', (event) => {
    const btnToggle = event.target.closest('#sidebarCollapse, #btnToggleSidebar');
    if (btnToggle) {
        toggleSidebar();
        return;
    }

    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.classList.contains('active')) {
        const tocandoSidebar = event.target.closest('#sidebar');
        if (!tocandoSidebar) {
            cerrarSidebar();
        }
    }
});

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.classList.contains('active')) {
        cerrarSidebar();
    } else {
        abrirSidebar();
    }
}

function abrirSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = asegurarBackdropGlobal();
    if (sidebar) {
        sidebar.classList.add('active');
    }
    if (backdrop) {
        backdrop.classList.add('show');
    }
}

function cerrarSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.querySelector('.sidebar-backdrop');
    if (sidebar) {
        sidebar.classList.remove('active');
    }
    if (backdrop) {
        backdrop.classList.remove('show');
    }
}

// Interceptor de Cierre de Sesión
document.addEventListener('click', async (event) => {
    const btnLogout = event.target.closest('#btnCerrarSesion');
    if (!btnLogout) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();

    if (typeof Swal !== 'undefined') {
        const resultado = await Swal.fire({
            title: '¿Cerrar sesión?',
            text: 'Tendrás que volver a ingresar tus credenciales para acceder al sistema.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Sí, cerrar sesión',
            cancelButtonText: 'Cancelar'
        });

        if (resultado.isConfirmed) {
            ejecutarCierreDeSesion();
        }
    } else {
        if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
            ejecutarCierreDeSesion();
        }
    }
}, { capture: true });

function ejecutarCierreDeSesion() {
    localStorage.clear();
    window.location.href = 'login.html';
}

function escapeHTML(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}