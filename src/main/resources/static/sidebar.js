/**
 * BÁEZ POS - COMPONENTE SIDEBAR Y NAVBAR DINÁMICO (SaaS)
 * Alexander Baez - 2026
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Recuperar datos de sesión limpios sincronizados por el token
    const userRole = (localStorage.getItem('baezpos_user_role') || 'EMPLEADO').toUpperCase().trim();
    const userName = localStorage.getItem('baezpos_user_name') || 'Usuario';
    const tenantName = localStorage.getItem('baezpos_tenant_name') || userName; // Nombre del comercio/negocio

    // BLINDAJE ABSOLUTO DE ROL
    const isSuperAdmin = (userRole === 'SUPER_ADMIN');
    const isAdmin = isSuperAdmin || userRole === 'ADMIN' || userRole === 'ADMINISTRADOR' || userRole === 'OWNER';

    // 2. SINCRONIZAR AUTOMÁTICAMENTE LA NAVBAR SUPERIOR
    const elUserName = document.getElementById('userName');
    const elUserRoleBadge = document.getElementById('userRoleBadge');

    if (elUserName) {
        elUserName.textContent = tenantName;
    }
    if (elUserRoleBadge) {
        elUserRoleBadge.textContent = userRole;
        elUserRoleBadge.className = `badge text-uppercase ${isSuperAdmin ? 'bg-warning text-dark' : (isAdmin ? 'bg-primary' : 'bg-secondary')}`;
        elUserRoleBadge.style.fontSize = '0.65rem';
    }

    // 3. INYECTAR SIDEBAR DINÁMICO
    const sidebarContainer = document.getElementById('sidebar-container');
    if (!sidebarContainer) return;

    const paginaActual = window.location.pathname.split("/").pop() || "dashboard.html";

    // Inyectar estilos CSS del Sidebar
    const estilos = document.createElement('style');
    estilos.innerHTML = `
        #sidebar {
            width: 250px;
            height: 100vh;
            position: fixed;
            top: 0;
            left: 0;
            background: #1e293b !important;
            z-index: 1000;
            transition: all 0.3s ease;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
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
        @media (max-width: 768px) {
            #sidebar { left: -250px !important; }
            #sidebar.active { left: 0 !important; }
        }
    `;
    document.head.appendChild(estilos);

    // Inyectar HTML del Menú
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

          <!-- Footer: Usuario Logueado Real -->
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

            <!-- Botón con ID y data-action para control absoluto -->
            <a href="#" id="btnCerrarSesion" class="nav-link-custom text-danger">
              <i class="bi bi-box-arrow-left me-3 fs-5"></i> Cerrar Sesión
            </a>
          </div>
        </nav>
    `;
});

/**
 * Interceptor en fase de CAPTURA (true):
 * Esto frena el clic antes de que cualquier otro script de la página o del navegador lo reciba.
 */
document.addEventListener('click', async (event) => {
    const btnLogout = event.target.closest('#btnCerrarSesion');
    if (!btnLogout) return;

    // Detenemos absolutamente cualquier comportamiento nativo o propagación externa
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();

    // Verificamos SweetAlert2
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
        // Respaldo nativo estricto
        if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
            ejecutarCierreDeSesion();
        }
    }
}, { capture: true }); // <--- CLAVE: El parámetro 'capture: true' intercepta el evento primero que nadie.

// Función auxiliar interna para limpiar y redirigir
function ejecutarCierreDeSesion() {
    localStorage.clear();
    window.location.href = 'index.html';
}