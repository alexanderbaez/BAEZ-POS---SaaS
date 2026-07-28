/**
 * BÁEZ POS - COMPONENTE SIDEBAR DINÁMICO (SaaS)
 * Alexander Baez - 2026
 */

document.addEventListener('DOMContentLoaded', () => {
    const sidebarContainer = document.getElementById('sidebar-container');
    if (!sidebarContainer) return;

    const paginaActual = window.location.pathname.split("/").pop() || "dashboard.html";

    // Recuperar datos de sesión guardados con fallback seguro
    const userRole = (localStorage.getItem('baezpos_user_role') || 'EMPLEADO').toUpperCase().trim();
    const userName = localStorage.getItem('baezpos_user_name') || 'Usuario';

    // BLINDAJE DE ROL: Solo es SuperAdmin si el rol es exactamente SUPER_ADMIN
    const isSuperAdmin = (userRole === 'SUPER_ADMIN' || userRole === 'ROLE_SUPER_ADMIN');
    const isAdmin = isSuperAdmin || userRole === 'ADMIN' || userRole === 'ROLE_ADMIN' || userRole === 'ADMINISTRADOR' || userRole === 'OWNER';

    // Inyectar estilos CSS
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

    // Inyectar HTML del Menú (CON BLINDAJE DE ROL ABSOLUTO)
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

              <!-- Punto de Venta (Accesible para todos los empleados/admins) -->
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
                        <div class="fw-bold text-truncate" style="font-size: 0.85rem;">${userName}</div>
                        <span class="badge bg-secondary" style="font-size: 0.65rem;">${userRole}</span>
                    </div>
                </div>
            </div>

            <a href="#" class="nav-link-custom text-danger" onclick="cerrarSesion(event)">
              <i class="bi bi-box-arrow-left me-3 fs-5"></i> Cerrar Sesión
            </a>
          </div>
        </nav>
    `;
});