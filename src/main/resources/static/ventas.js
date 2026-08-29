/**
 * ============================================================================
 * BÁEZ POS - MÓDULO DE VENTAS Y CAJA (SaaS Multi-tenant)
 * Alexander Baez - 2026
 * ============================================================================
 */

// ==========================================
// 1. ESTADO GLOBAL DE LA APLICACIÓN
// ==========================================
let sistemaBloqueado = false;
let mensajeTicketServidor = "";
let SESION_CAJA_ACTIVA = null;

// Recursos de Audio
const sndSuccess = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
const sndError = new Audio('https://assets.mixkit.co/active_storage/sfx/2573/2573-preview.mp3');

// Estado Transaccional POS
let PRODUCTOS_DB = [];
let CARRITO = [];
let METODO_PAGO = 'EFECTIVO';
let SUBTOTAL_VENTA = 0;
let DESCUENTO_FINAL_PESOS = 0;
let clienteSeleccionado = null;
let indiceSeleccionado = -1;
let ULTIMA_VENTA_EXITOSA = null;
let DATOS_EMPRESA = null;

// Handler para la referencia global del evento fuera del modal
let handlerClickFueraPesables = null;


// ==========================================
// 2. HELPERS Y UTILIDADES NUMÉRICAS
// ==========================================
function utilRedondearTresDecimales(numero) {
    return Math.round((numero + Number.EPSILON) * 1000) / 1000;
}

function utilParsearMontoTextual(texto) {
    if (!texto) return 0;
    const limpio = texto.replace('$', '').replace(/\./g, '').replace(',', '.').trim();
    return parseFloat(limpio) || 0;
}

function utilFormatearMoneda(monto) {
    return monto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Controla el foco del buscador evitando desplegar el teclado en dispositivos móviles/táctiles.
 */
function enfocarBuscadorInteligente() {
    const esMovil = window.innerWidth <= 991 || ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

    if (esMovil) {
        // En móviles, cerramos el teclado activo quitando el foco actual
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }
    } else {
        // En PC/Escritorio, mantenemos el foco para escáneres de barras
        const buscador = document.getElementById('buscadorVenta');
        if (buscador) buscador.focus();
    }
}


// ==========================================
// 3. CICLO DE VIDA E INICIALIZACIÓN (DOM)
// ==========================================
document.addEventListener('DOMContentLoaded', async function inicializarModuloVentas() {
    await serviceCargarInfoEmpresa();
    await serviceCargarProductos();

    // Recuperar estado persistido del carrito en localStorage
    const savedCart = localStorage.getItem('baezpos_cart');
    if (savedCart) {
        try {
            const parsed = JSON.parse(savedCart);
            if (Array.isArray(parsed) && parsed.length > 0) {
                CARRITO = parsed;
                renderizarCarrito();
            }
        } catch (e) {
            console.error("Error al restaurar carrito desde localStorage:", e);
        }
    }

    inicializarBuscadorProductos();
    inicializarBuscadorClientes();
    inicializarListenersInterfaz();
    inicializarAtajosTecladoGlobales();

    // Verificación inicial de caja al cargar el módulo
    await verificarEstadoCaja();

    // Actualizar contador y sincronizar ventas offline pendientes si hay conexión
    if (typeof actualizarIndicadorVentasPendientes === 'function') {
        await actualizarIndicadorVentasPendientes();
    }
    if (navigator.onLine && typeof syncPendingSales === 'function') {
        syncPendingSales();
    }
});


// ==========================================
// 4. CONFIGURACIÓN DE LISTENERS E INTERFAZ
// ==========================================
function inicializarBuscadorProductos() {
    const buscador = document.getElementById('buscadorVenta');
    const sugerenciasDiv = document.getElementById('listaSugerencias');

    if (!buscador) return;

    // Foco condicional sólo si no estamos en pantalla táctil/móvil
    enfocarBuscadorInteligente();

    buscador.addEventListener('input', function handleInputBuscadorProductos(e) {
        if (sistemaBloqueado) return;
        const term = e.target.value.toLowerCase().trim();
        indiceSeleccionado = -1;

        if (!sugerenciasDiv) return;

        if (term.length === 0) {
            sugerenciasDiv.style.display = 'none';
            sugerenciasDiv.innerHTML = '';
            return;
        }

        const filtrados = PRODUCTOS_DB.filter(function filtrarProductos(p) {
            return (p.name && p.name.toLowerCase().includes(term)) ||
                   (p.description && p.description.toLowerCase().includes(term)) ||
                   (p.barcode && p.barcode.includes(term));
        }).slice(0, 8);

        uiRenderizarSugerenciasProductos(filtrados);
    });

    buscador.addEventListener('keydown', function handleKeydownBuscadorProductos(e) {
        if (sistemaBloqueado) return;
        const items = sugerenciasDiv ? sugerenciasDiv.querySelectorAll('.list-group-item') : [];

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (items.length > 0) {
                indiceSeleccionado = (indiceSeleccionado + 1) % items.length;
                uiActualizarFocoSugerencia(items);
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (items.length > 0) {
                indiceSeleccionado = (indiceSeleccionado - 1 + items.length) % items.length;
                uiActualizarFocoSugerencia(items);
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (indiceSeleccionado > -1 && items[indiceSeleccionado]) {
                items[indiceSeleccionado].click();
            } else {
                const term = buscador.value.trim();
                buscarYAgregar(term);
            }
            if (sugerenciasDiv) sugerenciasDiv.style.display = 'none';
        }
    });
}

function inicializarBuscadorClientes() {
    const buscadorCli = document.getElementById('buscarClientePos');
    if (!buscadorCli) return;

    buscadorCli.addEventListener('input', async function handleInputBuscadorClientes(e) {
        if (sistemaBloqueado) return;
        const term = e.target.value.trim();
        const sugCli = document.getElementById('sugerenciasClientes');
        if (!sugCli) return;

        if (term.length < 2) {
            sugCli.style.display = 'none';
            return;
        }

        try {
            const res = await apiFetch('/customers');
            if (!res || !res.ok) return;

            const todos = await res.json();
            const filtrados = todos.filter(function filtrarClientes(c) {
                return c.name.toLowerCase().includes(term.toLowerCase());
            }).slice(0, 5);

            uiRenderizarSugerenciasClientes(filtrados, sugCli);
        } catch (err) {
            console.error("Error buscando clientes:", err);
        }
    });
}

function inicializarListenersInterfaz() {
    const inputPagaCon = document.getElementById('pagaCon');
    if (inputPagaCon) {
        inputPagaCon.addEventListener('input', function handleInputPagaCon() {
            calcularVuelto();
        });
    }

    const inputDesc = document.getElementById('inputDescuento');
    if (inputDesc) {
        inputDesc.addEventListener('input', function handleInputDescuento() {
            renderizarCarrito();
        });
    }

    const tipoDesc = document.getElementById('tipoDescuento');
    if (tipoDesc) {
        tipoDesc.addEventListener('change', function handleChangeTipoDescuento() {
            renderizarCarrito();
        });
    }
}

function inicializarAtajosTecladoGlobales() {
    document.addEventListener('keydown', function handleAtajosGlobales(e) {
        if (sistemaBloqueado) return;

        if (e.key === 'F12') {
            e.preventDefault();
            if (typeof finalizarVenta === 'function') finalizarVenta();
        }
        if (e.key === 'F4') {
            e.preventDefault();
            const p = document.getElementById('pagaCon');
            if (p) p.focus();
        }
        if (e.key === 'F2') {
            e.preventDefault();
            cancelarVenta();
        }
        if (e.key === 'Escape') {
            enfocarBuscadorInteligente();

            const sugerenciasDiv = document.getElementById('listaSugerencias');
            if (sugerenciasDiv) sugerenciasDiv.style.display = 'none';

            const sugCli = document.getElementById('sugerenciasClientes');
            if (sugCli) sugCli.style.display = 'none';
        }
        if (e.key === 'F8') {
            e.preventDefault();
            if (typeof agregarProductoManual === 'function') agregarProductoManual();
        }
    });
}


// ==========================================
// 5. SERVICIOS Y COMUNICACIÓN API
// ==========================================
async function serviceCargarInfoEmpresa() {
    try {
        const resp = await apiFetch('/admin/my-company/profile');
        if (resp && resp.ok) {
            DATOS_EMPRESA = await resp.json();
            localStorage.setItem('config_comercio', JSON.stringify(DATOS_EMPRESA));
            localStorage.setItem('DATOS_EMPRESA', JSON.stringify(DATOS_EMPRESA));
        } else {
            const dataGuardada = localStorage.getItem('config_comercio') || localStorage.getItem('DATOS_EMPRESA');
            if (dataGuardada) DATOS_EMPRESA = JSON.parse(dataGuardada);
        }
    } catch (err) {
        console.error("Error de conexión al cargar datos de empresa:", err);
    }
}

async function serviceCargarProductos() {
    try {
        const res = await apiFetch('/products');
        if (res && res.ok) {
            PRODUCTOS_DB = await res.json();
            localStorage.setItem('baezpos_cached_products', JSON.stringify(PRODUCTOS_DB));
        } else {
            const cached = localStorage.getItem('baezpos_cached_products');
            if (cached) PRODUCTOS_DB = JSON.parse(cached);
        }
    } catch (err) {
        console.warn("[OfflinePOS] Error de red al cargar productos, usando catálogo local persistido:", err);
        const cached = localStorage.getItem('baezpos_cached_products');
        if (cached) {
            try { PRODUCTOS_DB = JSON.parse(cached); } catch (e) {}
        }
    }
}


// ==========================================
// 6. RENDERIZADO Y CONTROLADORES DE INTERFAZ
// ==========================================
function uiActualizarFocoSugerencia(items) {
    items.forEach(function iterarFocoItem(item, index) {
        if (index === indiceSeleccionado) {
            item.classList.add('active');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('active');
        }
    });
}

function uiRenderizarSugerenciasClientes(filtrados, elementoContenedor) {
    elementoContenedor.innerHTML = filtrados.map(function mapClienteItem(c) {
        const balance = c.currentBalance || 0;
        const limit = c.creditLimit || 0;
        const colorClase = balance >= limit ? 'text-danger' : 'text-success';

        return `
            <button type="button" class="list-group-item list-group-item-action small" onclick='seleccionarCliente(${JSON.stringify(c)})'>
                <div class="d-flex justify-content-between">
                    <span>${c.name}</span>
                    <span class="${colorClase} fw-bold">$${balance.toFixed(2)}</span>
                </div>
            </button>
        `;
    }).join('');

    elementoContenedor.style.display = filtrados.length > 0 ? 'block' : 'none';
}

function uiRenderizarSugerenciasProductos(productos) {
    const div = document.getElementById('listaSugerencias');
    if (!div) return;

    if (!productos || productos.length === 0) {
        div.style.display = 'none';
        return;
    }

    div.innerHTML = productos.map(function mapProductoItem(p) {
        const badgeColor = p.stock > 5 ? 'bg-light text-dark' : 'bg-danger';
        const categoriaHtml = p.categoryName ? ` | <i class="bi bi-tag small"></i> ${p.categoryName}` : '';
        const descTexto = p.description || p.descripcion || 'Sin descripción';
        const precioFormateado = (p.price || 0).toFixed(2);

        return `
            <button type="button"
                    class="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-2.5 border-bottom shadow-sm"
                    onclick='seleccionarProducto(${JSON.stringify(p)})'
                    style="cursor: pointer;">
                <div class="text-start item-busqueda me-2">
                    <div class="fw-bold text-primary mb-0">
                        <i class="bi bi-box-seam me-2"></i>${p.name.toUpperCase()} - $${precioFormateado}
                    </div>
                    <div class="text-muted small" style="font-style: italic; font-size: 0.8rem;">${descTexto}</div>
                    <small class="text-muted" style="font-size: 0.75rem;">
                        Stock: <span class="badge ${badgeColor}">${p.stock}</span>
                        | Cód: ${p.barcode || 'S/C'}
                        ${categoriaHtml}
                    </small>
                </div>
                <div class="text-end text-nowrap">
                    <span class="h6 mb-0 fw-bold text-dark">$${precioFormateado}</span>
                </div>
            </button>
        `;
    }).join('');

    div.style.display = 'block';
}


// ==========================================
// 7. LÓGICA DE NEGOCIO Y CARRITO
// ==========================================
function renderizarCarrito() {
    const body = document.getElementById('carritoBody');
    if (!body) return;
    body.innerHTML = '';
    SUBTOTAL_VENTA = 0;

    // Persistencia continua en localStorage
    if (CARRITO && CARRITO.length > 0) {
        localStorage.setItem('baezpos_cart', JSON.stringify(CARRITO));
    } else {
        localStorage.removeItem('baezpos_cart');
    }

    CARRITO.forEach(function procesarItemCarrito(item, index) {
        const subtotal = item.price * item.cantidad;
        SUBTOTAL_VENTA += subtotal;

        const precioFmt = utilFormatearMoneda(item.price);
        const subtotalFmt = utilFormatearMoneda(subtotal);
        const cantFmt = (typeof item.cantidad === 'number' && item.cantidad % 1 !== 0)
            ? item.cantidad.toFixed(3)
            : item.cantidad;

        const pesableBadge = item.isFractional ? ' | <i class="bi bi-scale"></i> Pesable' : '';

        body.innerHTML += `
            <tr class="animate__animated animate__fadeIn">
                <td>
                    <div class="fw-bold">${item.name}</div>
                    <small class="text-muted text-uppercase" style="font-size: 0.7rem;">${item.barcode || 'S/C'}${pesableBadge}</small>
                </td>
                <td class="text-center">
                    <div class="btn-group btn-group-sm border rounded-pill overflow-hidden bg-white shadow-sm">
                        <button class="btn btn-light border-0 px-2" onclick="cambiarCant(${index}, -1)"><i class="bi bi-dash"></i></button>
                        <span class="btn btn-white border-0 disabled fw-bold" style="min-width: 55px">${cantFmt}</span>
                        <button class="btn btn-light border-0 px-2" onclick="cambiarCant(${index}, 1)"><i class="bi bi-plus"></i></button>
                    </div>
                </td>
                <td class="text-end text-muted">$${precioFmt}</td>
                <td class="text-end fw-bold text-dark">$${subtotalFmt}</td>
                <td class="text-end">
                    <button class="btn btn-link text-danger p-0" onclick="eliminarItem(${index})">
                        <i class="bi bi-trash3 fs-6"></i>
                    </button>
                </td>
            </tr>`;
    });

    const inputDesc = document.getElementById('inputDescuento');
    const tipoDesc = document.getElementById('tipoDescuento');
    let valorIngresado = parseFloat(inputDesc?.value) || 0;

    if (tipoDesc && tipoDesc.value === 'PORCENTAJE') {
        DESCUENTO_FINAL_PESOS = SUBTOTAL_VENTA * (valorIngresado / 100);
    } else {
        DESCUENTO_FINAL_PESOS = valorIngresado;
    }

    if (DESCUENTO_FINAL_PESOS > SUBTOTAL_VENTA) DESCUENTO_FINAL_PESOS = SUBTOTAL_VENTA;

    const totalConDescuento = SUBTOTAL_VENTA - DESCUENTO_FINAL_PESOS;
    const totalVentaEl = document.getElementById('totalVenta');
    if (totalVentaEl) totalVentaEl.innerText = `$${utilFormatearMoneda(totalConDescuento)}`;

    calcularVuelto();

    const activeEl = document.activeElement ? document.activeElement.id : '';
    if (activeEl !== 'pagaCon' && activeEl !== 'inputDescuento' && activeEl !== 'buscarClientePos') {
        enfocarBuscadorInteligente();
    }
}

function calcularVuelto() {
    const totalVentaEl = document.getElementById('totalVenta');
    if (!totalVentaEl) return;

    const total = utilParsearMontoTextual(totalVentaEl.innerText);
    const pagaConInput = document.getElementById('pagaCon');
    const pagaCon = pagaConInput ? (parseFloat(pagaConInput.value) || 0) : 0;
    const vuelto = pagaCon - total;
    const txtVuelto = document.getElementById('vueltoVenta');

    if (txtVuelto) {
        if (vuelto < 0 || pagaCon === 0) {
            txtVuelto.innerText = "$0.00";
            txtVuelto.classList.remove('text-success');
            txtVuelto.classList.add('text-danger');
        } else {
            txtVuelto.innerText = `$${utilFormatearMoneda(vuelto)}`;
            txtVuelto.classList.remove('text-danger');
            txtVuelto.classList.add('text-success');
        }
    }
}

// ==========================================
// 7.1 AUTORIZACIÓN POR PIN DE SUPERVISOR
// ==========================================
async function solicitarPinSupervisorSiEsVendedor(motivo = "realizar esta acción") {
    const rawRole = (localStorage.getItem('baezpos_user_role') || 'VENDEDOR').toUpperCase().trim();
    const esAdminOSuper = (rawRole === 'ADMIN' || rawRole === 'SUPER_ADMIN' || rawRole === 'SUPERVISOR' || rawRole === 'OWNER' || rawRole === 'ADMINISTRADOR');

    // Si ya es Admin o Supervisor, no requiere autorización
    if (esAdminOSuper) {
        return true;
    }

    // Modal para solicitar PIN de Supervisor
    const { value: pin, isConfirmed } = await Swal.fire({
        title: '<span class="fs-5 fw-bold text-dark">🔐 PIN de Supervisor Requerido</span>',
        html: `
            <p class="text-muted small mb-3">Se requiere autorización de un Administrador o Supervisor para <strong>${motivo}</strong>.</p>
            <div class="mb-2">
                <input type="password" id="swal-input-pin" class="form-control text-center fs-3 fw-bold tracking-widest" 
                       maxlength="6" inputmode="numeric" pattern="[0-9]*" placeholder="••••" autocomplete="off" style="letter-spacing: 0.5rem;">
            </div>
            <small class="text-muted" style="font-size: 0.75rem;">Ingrese el PIN de 4 a 6 dígitos</small>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-shield-check me-1"></i> Autorizar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#64748b',
        allowOutsideClick: false,
        didOpen: () => {
            const input = document.getElementById('swal-input-pin');
            if (input) input.focus();
        },
        preConfirm: () => {
            const input = document.getElementById('swal-input-pin');
            const val = input ? input.value.trim() : '';
            if (!val || val.length < 4) {
                Swal.showValidationMessage('Ingrese un PIN de al menos 4 dígitos');
                return false;
            }
            return val;
        }
    });

    if (!isConfirmed || !pin) {
        return false;
    }

    const pinIngresado = String(pin || (document.getElementById('swal-input-pin') ? document.getElementById('swal-input-pin').value : '')).trim();
    if (!pinIngresado) {
        return false;
    }

    try {
        Swal.fire({
            title: 'Verificando autorización...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        const res = await apiFetch('/users/validate-pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: String(pinIngresado).trim() })
        });

        if (!res.ok) {
            throw new Error(`Error de red (${res.status}) al verificar el PIN`);
        }

        const data = await res.json();
        const esValido = (data && data.valid === true) || data === true || data === 'true';

        if (esValido) {
            Swal.close();
            return true;
        } else {
            console.error("Fallo de PIN:", data ? data.debug_message : "Respuesta inválida");
            if (sndError) sndError.play().catch(() => {});
            await Swal.fire('Auditoría de PIN', 'Error interno: ' + (data && data.debug_message ? data.debug_message : 'PIN no autorizado'), 'error');
            return false;
        }
    } catch (error) {
        console.error("[PIN Supervisor] Error al validar:", error);
        if (sndError) sndError.play().catch(() => {});
        await Swal.fire({
            icon: 'error',
            title: 'Error de Validación',
            text: 'No se pudo verificar el PIN de supervisor. Intente nuevamente.',
            confirmButtonColor: '#ef4444'
        });
        return false;
    }
}

async function cambiarCant(index, valor) {
    if (sistemaBloqueado) return;
    const item = CARRITO[index];
    const original = PRODUCTOS_DB.find(function buscarStockOriginal(p) { return p.id === item.id; });

    const isDecimal = item.isFractional || (typeof item.cantidad === 'number' && item.cantidad % 1 !== 0);
    const step = isDecimal ? 0.100 : 1;
    const nuevaCant = utilRedondearTresDecimales(item.cantidad + valor * step);

    if (valor > 0 && original && nuevaCant > original.stock) {
        if (sndError) sndError.play().catch(function silencioso(){});
        Swal.fire({
            icon: 'info',
            title: 'Límite alcanzado',
            text: 'No hay más stock disponible',
            toast: true,
            position: 'top-end',
            timer: 2000,
            showConfirmButton: false
        });
        return;
    }

    if (nuevaCant <= 0) {
        const autorizado = await solicitarPinSupervisorSiEsVendedor(`eliminar ${item.name} del carrito`);
        if (!autorizado) return;
        CARRITO.splice(index, 1);
    } else {
        item.cantidad = nuevaCant;
    }
    renderizarCarrito();
}

async function eliminarItem(index) {
    if (sistemaBloqueado) return;
    const item = CARRITO[index];
    const nombreProd = item ? item.name : 'este producto';
    const autorizado = await solicitarPinSupervisorSiEsVendedor(`eliminar "${nombreProd}" del carrito`);
    if (!autorizado) return;

    CARRITO.splice(index, 1);
    renderizarCarrito();
}

function setMetodo(metodo, el) {
    if (sistemaBloqueado) return;
    METODO_PAGO = metodo;
    document.querySelectorAll('.metodo-pago').forEach(function removerClaseActiva(d) { d.classList.remove('active'); });
    if (el) el.classList.add('active');

    const divCli = document.getElementById('seccionClienteFiado');
    const divVue = document.getElementById('seccionVuelto');

    if (metodo === 'CUENTA_CORRIENTE') {
        if (divCli) divCli.classList.remove('d-none');
        if (divVue) divVue.classList.add('d-none');

        // En móviles no enfocamos automáticamente el input de cliente para evitar abrir el teclado
        const esMovil = window.innerWidth <= 991 || ('ontouchstart' in window);
        if (!esMovil) {
            setTimeout(function enfocarClientePos() {
                const bCli = document.getElementById('buscarClientePos');
                if (bCli) bCli.focus();
            }, 100);
        }
    } else {
        if (divCli) divCli.classList.add('d-none');
        if (divVue) divVue.classList.remove('d-none');
        clienteSeleccionado = null;

        const infoCli = document.getElementById('infoClienteSeleccionado');
        if (infoCli) infoCli.classList.add('d-none');

        const pagaConEl = document.getElementById('pagaCon');
        const totalVentaEl = document.getElementById('totalVenta');

        if (metodo === 'TRANSFERENCIA' && totalVentaEl && pagaConEl) {
            pagaConEl.value = totalVentaEl.innerText.replace('$', '').trim();
            calcularVuelto();
        } else if (pagaConEl) {
            pagaConEl.value = '';
            const vueltoEl = document.getElementById('vueltoVenta');
            if (vueltoEl) vueltoEl.innerText = "$0.00";
        }

        // Cierra el teclado si estaba abierto y evita redelegar foco
        enfocarBuscadorInteligente();
    }
}

async function cancelarVenta() {
    if (sistemaBloqueado || CARRITO.length === 0) return;
    const autorizado = await solicitarPinSupervisorSiEsVendedor("vaciar todo el carrito");
    if (!autorizado) return;

    CARRITO = [];
    localStorage.removeItem('baezpos_cart');
    const pagaConEl = document.getElementById('pagaCon');
    if (pagaConEl) pagaConEl.value = '';
    const inputDesc = document.getElementById('inputDescuento');
    if (inputDesc) inputDesc.value = '';
    renderizarCarrito();
}

function seleccionarProducto(p) {
    if (sistemaBloqueado) return;

    // Limpiar el buscador y ocultar sugerencias de entrada
    const buscador = document.getElementById('buscadorVenta');
    const sugerencias = document.getElementById('listaSugerencias');
    if (buscador) buscador.value = '';
    if (sugerencias) sugerencias.style.display = 'none';

    if (p.isFractional) {
        abrirModalCalculoFraccionado(p);
        return;
    }

    const itemEnCarrito = CARRITO.find(function buscarEnCarrito(item) { return item.id === p.id; });
    const cantActual = itemEnCarrito ? itemEnCarrito.cantidad : 0;

    if (p.stock <= cantActual) {
        if (sndError) sndError.play().catch(function silencioso(){});
        Swal.fire({
            icon: 'warning',
            title: 'Sin Stock',
            text: `No hay más unidades disponibles de ${p.name}`,
            toast: true,
            position: 'top-end',
            timer: 2500,
            showConfirmButton: false
        });
    } else {
        if (sndSuccess) sndSuccess.play().catch(function silencioso(){});

        if (itemEnCarrito) {
            itemEnCarrito.cantidad++;
        } else {
            CARRITO.push({
                id: p.id,
                name: p.name,
                price: p.price,
                barcode: p.barcode,
                cantidad: 1,
                isFractional: false
            });
        }
        renderizarCarrito();
    }

    // Usar la función inteligente en lugar de `setTimeout` con `.focus()` directo
    enfocarBuscadorInteligente();
}

function seleccionarCliente(c) {
    if (sistemaBloqueado) return;
    clienteSeleccionado = c;

    const inputIdCli = document.getElementById('idClienteSeleccionado');
    if (inputIdCli) inputIdCli.value = c.id;

    const nombreCliPos = document.getElementById('nombreClientePos');
    if (nombreCliPos) nombreCliPos.innerText = c.name;

    const saldoCliPos = document.getElementById('saldoClientePos');
    if (saldoCliPos) saldoCliPos.innerText = `$${(c.currentBalance || 0).toFixed(2)}`;

    const infoCliSel = document.getElementById('infoClienteSeleccionado');
    if (infoCliSel) infoCliSel.classList.remove('d-none');

    const sugClientes = document.getElementById('sugerenciasClientes');
    if (sugClientes) sugClientes.style.display = 'none';

    const buscarCliPos = document.getElementById('buscarClientePos');
    if (buscarCliPos) buscarCliPos.value = '';

    enfocarBuscadorInteligente();
}


// ==========================================
// 8. MODALES Y VENTAS POR PESO / IMPORTE
// ==========================================
function venderPorPesoOImporte(productoBase = null) {
    if (sistemaBloqueado) return;

    if (productoBase) {
        abrirModalCalculoFraccionado(productoBase);
        return;
    }

    const pesables = PRODUCTOS_DB.filter(function filtrarPesables(p) {
        return p.isFractional || parseFloat(p.price) > 0;
    });

    if (pesables.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Atención',
            text: 'No hay productos en el catálogo para venta fraccionada.',
            confirmButtonColor: '#0d6efd'
        });
        return;
    }

    Swal.fire({
        title: '<div class="d-flex align-items-center justify-content-center gap-2 fs-5 fw-bold text-dark"><i class="bi bi-scale text-primary fs-4"></i>Venta por Peso / Importe</div>',
        html: `
            <div class="position-relative text-start my-2">
                <label class="form-label small fw-semibold text-secondary mb-1">Buscar producto pesable/granel:</label>
                <div class="input-group">
                    <span class="input-group-text bg-white border-end-0 text-muted"><i class="bi bi-search"></i></span>
                    <input id="pesableNombreBusqueda" class="form-control border-start-0 ps-0 shadow-none py-2" placeholder="Ej: Queso, Pan, Harina..." autocomplete="off">
                </div>
                <div id="sugerenciasPesables" class="list-group position-absolute w-100 shadow-lg rounded-3 border mt-1 d-none overflow-hidden"
                     style="z-index: 9999; max-height: 220px; overflow-y: auto;">
                </div>
            </div>
        `,
        showCancelButton: true,
        showConfirmButton: false,
        cancelButtonText: 'Cancelar',
        customClass: {
            popup: 'rounded-4 border-0 shadow-lg p-3',
            cancelButton: 'btn btn-light px-4 fw-semibold text-secondary'
        },
        didOpen: function handleModalPesablesOpen() {
            const inputBusqueda = document.getElementById('pesableNombreBusqueda');
            const contenedorSugerencias = document.getElementById('sugerenciasPesables');

            // Solo hacemos foco automático en el modal si no es un móvil
            const esMovil = window.innerWidth <= 991 || ('ontouchstart' in window);
            if (inputBusqueda && !esMovil) inputBusqueda.focus();

            if (inputBusqueda && contenedorSugerencias) {
                inputBusqueda.addEventListener('input', function handleInputPesables() {
                    const search = inputBusqueda.value.toUpperCase().trim();
                    contenedorSugerencias.innerHTML = '';

                    if (search.length > 0) {
                        const filtrados = pesables.filter(function filtrarItemPesable(p) {
                            return p.name.toUpperCase().includes(search) || (p.barcode && p.barcode.includes(search));
                        });

                        if (filtrados.length > 0) {
                            contenedorSugerencias.classList.remove('d-none');
                            filtrados.forEach(function renderizarItemPesable(p) {
                                const btn = document.createElement('button');
                                btn.type = 'button';
                                btn.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center py-2 px-3 border-0 border-bottom';
                                btn.style.fontSize = '0.875rem';
                                btn.innerHTML = `
                                    <div class="text-start me-2">
                                        <div class="fw-bold text-dark mb-0">${p.name.toUpperCase()}</div>
                                        ${p.isFractional ? '<span class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill" style="font-size:0.65rem;">⚖️ Pesable</span>' : ''}
                                    </div>
                                    <span class="badge bg-light text-dark border fw-bold fs-6">$${(p.price || 0).toFixed(2)}/Kg</span>
                                `;
                                btn.onclick = function handleClickItemPesable() {
                                    Swal.close();
                                    abrirModalCalculoFraccionado(p);
                                };
                                contenedorSugerencias.appendChild(btn);
                            });
                        } else {
                            contenedorSugerencias.classList.add('d-none');
                        }
                    } else {
                        contenedorSugerencias.classList.add('d-none');
                    }
                });
            }

            handlerClickFueraPesables = function handleClickFueraModalPesables(e) {
                if (inputBusqueda && contenedorSugerencias && e.target !== inputBusqueda && !contenedorSugerencias.contains(e.target)) {
                    contenedorSugerencias.classList.add('d-none');
                }
            };
            document.addEventListener('click', handlerClickFueraPesables);
        },
        willClose: function handleModalPesablesClose() {
            if (handlerClickFueraPesables) {
                document.removeEventListener('click', handlerClickFueraPesables);
                handlerClickFueraPesables = null;
            }
        }
    });
}

function abrirModalCalculoFraccionado(p) {
    const salePrice = p.price || 0;
    if (salePrice <= 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Atención',
            text: 'El producto debe tener un precio de venta mayor a 0 para calcular fraccionado.',
            confirmButtonColor: '#0d6efd'
        });
        return;
    }

    let modoActual = 'PESO';

    Swal.fire({
        width: '100%',
        padding: '0',
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-cart-plus-fill me-1"></i> AGREGAR AL CARRITO',
        cancelButtonText: 'Cancelar',
        buttonsStyling: false,
        customClass: {
            popup: 'vfr-popup-container border-0 shadow-lg overflow-hidden',
            htmlContainer: 'p-0 m-0',
            actions: 'vfr-actions-wrapper p-3 bg-light border-top d-flex gap-2 m-0',
            confirmButton: 'btn btn-primary vfr-btn-confirm flex-fill fw-bold py-2 fs-6 shadow-sm',
            cancelButton: 'btn btn-outline-secondary vfr-btn-cancel py-2 fw-semibold'
        },
        title: '', // Título nativo vacío para evitar huecos blancos
        html: `
            <style>
                /* Contenedor Principal */
                .vfr-popup-container {
                    max-width: 400px !important;
                    border-radius: 16px !important;
                    background: #ffffff;
                }

                /* Eliminar botones numéricos nativos */
                .vfr-numeric-input::-webkit-outer-spin-button,
                .vfr-numeric-input::-webkit-inner-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
                .vfr-numeric-input { -moz-appearance: textfield; }

                /* Header Integrado BaezPOS */
                .vfr-header-banner {
                    background: linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%);
                    padding: 14px 16px;
                }

                /* Segmented Control Moderno */
                .vfr-segmented-control {
                    background: #f1f5f9;
                    padding: 3px;
                    border-radius: 10px;
                    display: flex;
                    gap: 4px;
                    border: 1px solid #e2e8f0;
                }
                .vfr-segment-btn {
                    flex: 1;
                    border: none;
                    background: transparent;
                    padding: 8px 10px;
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: #64748b;
                    border-radius: 7px;
                    transition: all 0.2s ease;
                    white-space: nowrap;
                }
                .vfr-segment-btn.active-peso {
                    background: #0d6efd;
                    color: #ffffff;
                    box-shadow: 0 2px 4px rgba(13, 110, 253, 0.2);
                }
                .vfr-segment-btn.active-importe {
                    background: #198754;
                    color: #ffffff;
                    box-shadow: 0 2px 4px rgba(25, 135, 84, 0.2);
                }

                /* Display de Balanza Limpio */
                .vfr-display-box {
                    background: #f8fafc;
                    border: 2px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 10px 14px;
                    transition: all 0.2s ease;
                }
                .vfr-display-box.primary-active {
                    border-color: #93c5fd;
                    background: #eff6ff;
                }
                .vfr-display-box.success-active {
                    border-color: #86efac;
                    background: #f0fdf4;
                }

                .vfr-label-title {
                    color: #64748b;
                    font-size: 0.7rem;
                    font-weight: 700;
                    letter-spacing: 0.05em;
                    text-transform: uppercase;
                }
                .vfr-value-primary {
                    color: #0d6efd;
                    font-size: 1.85rem;
                    font-weight: 800;
                    line-height: 1.1;
                }
                .vfr-value-success {
                    color: #198754;
                    font-size: 1.85rem;
                    font-weight: 800;
                    line-height: 1.1;
                }

                /* Optimización Móvil en Acciones */
                @media (max-width: 576px) {
                    .vfr-actions-wrapper {
                        flex-direction: column-reverse;
                    }
                    .vfr-btn-confirm, .vfr-btn-cancel {
                        width: 100% !important;
                    }
                }
            </style>

            <!-- Cabecera Integrada (Azul BaezPOS sin espacios en blanco) -->
            <div class="vfr-header-banner text-white d-flex align-items-center justify-content-between">
                <div class="d-flex align-items-center gap-2">
                    <i class="bi bi-scale fs-5"></i>
                    <span class="fw-bold fs-6 mb-0">Venta Fraccionada</span>
                </div>
                <span class="badge bg-white text-primary fw-bold rounded-pill px-2 py-1" style="font-size: 0.7rem;">⚖️ GRANEL</span>
            </div>

            <!-- Cuerpo del Modal -->
            <div class="p-3 text-start">

                <!-- Tarjeta del Producto -->
                <div class="bg-light border rounded-3 p-2 mb-3">
                    <div class="fw-bold text-dark fs-6 text-truncate mb-1">${p.name.toUpperCase()}</div>
                    <div class="d-flex justify-content-between align-items-center pt-1 border-top" style="font-size: 0.8rem;">
                        <span class="text-muted">Precio/Kg: <strong class="text-dark">$${utilFormatearMoneda(salePrice)}</strong></span>
                        <span class="text-muted">Stock: <strong class="${p.stock > 0 ? 'text-success' : 'text-danger'}">${p.stock} Kg</strong></span>
                    </div>
                </div>

                <!-- Selector Modo (Por Peso / Por Importe) -->
                <div class="vfr-segmented-control mb-3">
                    <button type="button" id="btnModoPeso" class="vfr-segment-btn active-peso" onclick="switchModoFraccionado('PESO')">
                        <i class="bi bi-scale me-1"></i> Por Peso (Kg)
                    </button>
                    <button type="button" id="btnModoImporte" class="vfr-segment-btn" onclick="switchModoFraccionado('IMPORTE')">
                        <i class="bi bi-currency-dollar me-1"></i> Por Importe ($)
                    </button>
                </div>

                <!-- MODO A: INGRESO POR PESO -->
                <div id="seccionModoPeso">
                    <label class="form-label text-secondary fw-semibold mb-1" style="font-size: 0.775rem;">Cantidad a Pesar:</label>
                    <div class="input-group input-group-lg mb-2">
                        <input id="inputPesoCantidad" type="number" step="0.001" min="0.001" class="form-control fw-bold text-dark fs-4 vfr-numeric-input py-2" placeholder="0.000">
                        <span class="input-group-text bg-light text-muted fw-bold fs-6">Kg</span>
                    </div>

                    <div class="vfr-display-box primary-active text-center">
                        <div class="vfr-label-title mb-1">Total a cobrar</div>
                        <div id="displayTotalPeso" class="vfr-value-primary">$0,00</div>
                    </div>
                </div>

                <!-- MODO B: INGRESO POR IMPORTE -->
                <div id="seccionModoImporte" class="d-none">
                    <label class="form-label text-secondary fw-semibold mb-1" style="font-size: 0.775rem;">Monto a cobrar ($):</label>
                    <div class="input-group input-group-lg mb-2">
                        <span class="input-group-text bg-light text-muted fw-bold fs-5">$</span>
                        <input id="inputImporteMoneda" type="number" step="1" min="1" class="form-control fw-bold text-dark fs-4 vfr-numeric-input py-2" placeholder="0">
                    </div>

                    <div class="vfr-display-box success-active text-center">
                        <div class="vfr-label-title mb-1">Peso Equivalente</div>
                        <div id="displayKilosImporte" class="vfr-value-success">0.000 Kg</div>
                    </div>
                </div>

            </div>
        `,
        didOpen: function handleModalFraccionadoOpen() {
            const inputPeso = document.getElementById('inputPesoCantidad');
            const inputImporte = document.getElementById('inputImporteMoneda');
            const displayTotal = document.getElementById('displayTotalPeso');
            const displayKilos = document.getElementById('displayKilosImporte');

            const esMovil = window.innerWidth <= 991 || ('ontouchstart' in window);

            if (inputPeso) {
                // Solo enfocar en escritorio para no abrir teclado en móviles
                if (!esMovil) inputPeso.focus();

                inputPeso.addEventListener('input', function handleInputModoPeso() {
                    const cantKg = parseFloat(inputPeso.value) || 0;
                    const totalCalculado = cantKg * salePrice;
                    if (displayTotal) {
                        displayTotal.innerText = `$${utilFormatearMoneda(totalCalculado)}`;
                    }
                });
                inputPeso.addEventListener('keydown', function handleKeydownPeso(e) {
                    if (e.key === 'Enter') Swal.clickConfirm();
                });
            }

            if (inputImporte) {
                inputImporte.addEventListener('input', function handleInputModoImporte() {
                    const monto = parseFloat(inputImporte.value) || 0;
                    const kilosEq = salePrice > 0 ? (monto / salePrice) : 0;
                    if (displayKilos) {
                        displayKilos.innerText = `${kilosEq.toFixed(3)} Kg`;
                    }
                });
                inputImporte.addEventListener('keydown', function handleKeydownImporte(e) {
                    if (e.key === 'Enter') Swal.clickConfirm();
                });
            }

            window.switchModoFraccionado = function switchModoFraccionado(modo) {
                modoActual = modo;
                const btnPeso = document.getElementById('btnModoPeso');
                const btnImporte = document.getElementById('btnModoImporte');
                const secPeso = document.getElementById('seccionModoPeso');
                const secImporte = document.getElementById('seccionModoImporte');

                if (modo === 'PESO') {
                    if (btnPeso) btnPeso.className = 'vfr-segment-btn active-peso';
                    if (btnImporte) btnImporte.className = 'vfr-segment-btn';
                    if (secPeso) secPeso.classList.remove('d-none');
                    if (secImporte) secImporte.classList.add('d-none');
                    if (inputPeso) {
                        if (!esMovil) { inputPeso.focus(); inputPeso.select(); }
                    }
                } else {
                    if (btnImporte) btnImporte.className = 'vfr-segment-btn active-importe';
                    if (btnPeso) btnPeso.className = 'vfr-segment-btn';
                    if (secImporte) secImporte.classList.remove('d-none');
                    if (secPeso) secPeso.classList.add('d-none');
                    if (inputImporte) {
                        if (!esMovil) { inputImporte.focus(); inputImporte.select(); }
                    }
                }
            };
        },
        preConfirm: function handlePreConfirmFraccionado() {
            let cantidadFinal = 0;

            if (modoActual === 'PESO') {
                const inputPeso = document.getElementById('inputPesoCantidad');
                cantidadFinal = parseFloat(inputPeso?.value) || 0;
                if (cantidadFinal <= 0) {
                    Swal.showValidationMessage('Ingresa un peso/cantidad válido mayor a 0');
                    return false;
                }
            } else {
                const inputImporte = document.getElementById('inputImporteMoneda');
                const monto = parseFloat(inputImporte?.value) || 0;
                if (monto <= 0) {
                    Swal.showValidationMessage('Ingresa un importe en dinero mayor a 0');
                    return false;
                }
                cantidadFinal = salePrice > 0 ? (monto / salePrice) : 0;
            }

            cantidadFinal = utilRedondearTresDecimales(cantidadFinal);

            if (cantidadFinal <= 0) {
                Swal.showValidationMessage('La cantidad calculada no es válida.');
                return false;
            }

            return cantidadFinal;
        }
    }).then(function handleResultadoFraccionado(result) {
        if (result.isConfirmed && result.value) {
            const qty = result.value;

            const itemEnCarrito = CARRITO.find(function buscarEnCarrito(item) { return item.id === p.id; });
            const cantActualEnCarrito = itemEnCarrito ? itemEnCarrito.cantidad : 0;
            const cantTotalPedida = cantActualEnCarrito + qty;

            if (p.stock < cantTotalPedida) {
                if (sndError) sndError.play().catch(function silencioso(){});
                Swal.fire({
                    icon: 'warning',
                    title: 'Stock Insuficiente',
                    text: `El stock actual es ${p.stock} Kg. Ya tenías ${cantActualEnCarrito} Kg en el carrito.`,
                    confirmButtonColor: '#0d6efd'
                });
                return;
            }

            if (itemEnCarrito) {
                itemEnCarrito.cantidad = utilRedondearTresDecimales(itemEnCarrito.cantidad + qty);
            } else {
                CARRITO.push({
                    id: p.id,
                    name: p.name,
                    price: p.price,
                    barcode: p.barcode,
                    cantidad: qty,
                    isFractional: true
                });
            }

            if (sndSuccess) sndSuccess.play().catch(function silencioso(){});
            renderizarCarrito();

            const buscador = document.getElementById('buscadorVenta');
            if (buscador) {
                buscador.value = '';
            }
            enfocarBuscadorInteligente();
        }
    });
}

/**
 * ============================================================================
 * BÁEZ POS - MÓDULO DE VENTAS Y CAJA (Parte 2: Búsqueda, Cobro e Impresión)
 * Alexander Baez - 2026
 * ============================================================================
 */

// ==========================================
// 9. MOTOR DE BÚSQUEDA Y LECTORA DE CÓDIGOS
// ==========================================
async function buscarYAgregar(query) {
    if (!query) return;
    const term = query.toLowerCase().trim();

    if (typeof PRODUCTOS_DB === 'undefined' || !Array.isArray(PRODUCTOS_DB)) {
        PRODUCTOS_DB = [];
    }

    const productoLocal = PRODUCTOS_DB.find(function buscarProductoLocal(prod) {
        return (prod.barcode && prod.barcode.toLowerCase() === term) ||
               (prod.name && prod.name.toLowerCase().includes(term));
    });

    if (productoLocal) {
        seleccionarProducto(productoLocal);
    } else {
        if (/^\d{7,14}$/.test(term)) {
            await serviceConsultarOpenFoodFacts(term);
        } else {
            uiMostrarNotificacionProductoNoEncontrado(term);
        }
    }

    const buscador = document.getElementById('buscadorVenta');
    if (buscador) {
        buscador.value = '';
    }
    enfocarBuscadorInteligente();
}

async function serviceConsultarOpenFoodFacts(codigoBarras) {
    try {
        const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${codigoBarras}.json?fields=product_name,product_name_es,brands,quantity`);
        const data = await response.json();

        if (data.status === 1 && data.product) {
            const nombreAPI = data.product.product_name_es || data.product.product_name || "";
            const marcaAPI = data.product.brands || "";
            const cantidadAPI = data.product.quantity || "";
            const nombreFinalParaEnviar = `${nombreAPI} ${marcaAPI} ${cantidadAPI}`.trim().toUpperCase();

            Swal.fire({
                icon: 'info',
                title: '¡Encontrado en la Red!',
                html: `<b>${nombreFinalParaEnviar}</b><br><br>¿Cargar al sistema?`,
                showCancelButton: true,
                confirmButtonText: 'Sí, ir a cargar'
            }).then(function handleConfirmarCargaExterna(result) {
                if (result.isConfirmed) {
                    window.location.href = `productos.html?nuevoCodigo=${codigoBarras}&nuevoNombre=${encodeURIComponent(nombreFinalParaEnviar)}`;
                }
            });
            return;
        }
    } catch (err) {
        console.error("Error al consultar API externa OpenFoodFacts:", err);
    }

    uiMostrarNotificacionProductoNoEncontrado(codigoBarras);
}

function uiMostrarNotificacionProductoNoEncontrado(termino) {
    Swal.fire({
        icon: 'error',
        title: 'No encontrado',
        text: `El código o producto "${termino}" no existe. ¿Cargar manual?`,
        showCancelButton: true,
        confirmButtonText: 'Cargar ahora'
    }).then(function handleConfirmarRedireccionManual(result) {
        if (result.isConfirmed) {
            window.location.href = `productos.html?nuevoCodigo=${termino}`;
        }
    });
}

// ==========================================
// 10. FINALIZACIÓN Y COBRO DE VENTAS
// ==========================================
async function finalizarVenta() {
    const overlayBloqueo = document.getElementById('bloqueo-pos-overlay');
    if (overlayBloqueo || (typeof sistemaBloqueado !== 'undefined' && sistemaBloqueado)) {
        if (typeof mostrarCartelBloqueo === 'function') mostrarCartelBloqueo();
        return;
    }

    // 1. Guardia de Caja local
    if (!SESION_CAJA_ACTIVA) {
        if (window.sndError) window.sndError.play().catch(() => {});
        Swal.fire({
            icon: 'warning',
            title: 'Caja Cerrada',
            text: 'No hay una sesión de caja abierta. Debe abrir la caja para poder cobrar.',
            confirmButtonText: '<i class="bi bi-unlock-fill me-1"></i> Abrir Caja Ahora',
            confirmButtonColor: '#0d6efd',
            showCancelButton: true,
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) modalAbrirCaja();
        });
        return;
    }

    // 2. Validación de Carrito
    if (!Array.isArray(CARRITO) || CARRITO.length === 0) {
        Swal.fire('Carrito vacío', 'Agrega productos para cobrar', 'info');
        return;
    }

    const totalVentaEl = document.getElementById('totalVenta');
    let totalBase = utilParsearMontoTextual(totalVentaEl ? totalVentaEl.innerText : '0');

    const pagaConInputEl = document.getElementById('pagaCon');
    const pagaCon = utilParsearMontoTextual(pagaConInputEl ? pagaConInputEl.value : '0');

    if (METODO_PAGO === 'EFECTIVO' && pagaCon < totalBase) {
        Swal.fire('Atención', 'El monto recibido es insuficiente', 'warning');
        return;
    }

    let porcentajeRecargo = 0;
    let montoRecargo = 0;
    let totalFinal = totalBase;

    if (METODO_PAGO === 'CUENTA_CORRIENTE') {
        if (!clienteSeleccionado || !clienteSeleccionado.id) {
            Swal.fire('Atención', 'Debes seleccionar un cliente válido para vender a la libreta', 'warning');
            return;
        }

        const { value: recargoIngresado, isConfirmed } = await Swal.fire({
            title: '📈 Recargo por Libreta',
            html: `Monto base: <b>$${utilFormatearMoneda(totalBase)}</b><br><br>Ingresa el % de recargo:`,
            input: 'number',
            inputValue: 0,
            inputAttributes: { min: 0, max: 200, step: 'any' },
            showCancelButton: true,
            confirmButtonText: 'Confirmar y Cobrar',
            cancelButtonText: 'Cancelar',
            preConfirm: (value) => {
                const val = parseFloat(value);
                if (isNaN(val) || val < 0) {
                    Swal.showValidationMessage('El porcentaje debe ser un número igual o mayor a 0');
                    return false;
                }
                return val;
            }
        });

        if (!isConfirmed) return;

        porcentajeRecargo = recargoIngresado || 0;
        if (porcentajeRecargo > 0) {
            montoRecargo = utilRedondearTresDecimales((totalBase * porcentajeRecargo) / 100);
            totalFinal = totalBase + montoRecargo;
        }

        const saldoProyectado = (clienteSeleccionado.currentBalance || 0) + totalFinal;
        if (clienteSeleccionado.creditLimit && saldoProyectado > clienteSeleccionado.creditLimit) {
            Swal.fire({
                icon: 'error',
                title: 'Límite de Crédito Excedido',
                text: `El límite es $${utilFormatearMoneda(clienteSeleccionado.creditLimit)}. Deuda proyectada: $${utilFormatearMoneda(saldoProyectado)}`
            });
            return;
        }
    }

    const configLocal = JSON.parse(localStorage.getItem('config_comercio') || '{}');
    const datosEmpresaContext = (typeof DATOS_EMPRESA !== 'undefined' && DATOS_EMPRESA) ? DATOS_EMPRESA : configLocal;

    const chkEmitirFiscal = document.getElementById('chkEmitirFactura');
    const emitirComprobanteFiscal = chkEmitirFiscal ? chkEmitirFiscal.checked : (String(datosEmpresaContext.hasTaxData) === "true");

    // DTO Sanitizado
    const saleRequestDTO = {
        cashRegisterId: SESION_CAJA_ACTIVA ? SESION_CAJA_ACTIVA.id : null,
        items: CARRITO.map(item => ({
            productId: typeof item.id === 'number' ? item.id : null,
            productName: String(item.name).trim(),
            quantity: item.isFractional ? utilRedondearTresDecimales(item.cantidad) : parseInt(item.cantidad, 10),
            unitPrice: parseFloat(item.price)
        })),
        subtotal: totalBase,
        total: totalFinal,
        discount: typeof DESCUENTO_FINAL_PESOS !== 'undefined' ? DESCUENTO_FINAL_PESOS : 0,
        surcharge: montoRecargo,
        surchargeRate: porcentajeRecargo,
        paymentMethod: METODO_PAGO,
        customerId: clienteSeleccionado ? clienteSeleccionado.id : null,
        isFiscal: emitirComprobanteFiscal,
        emitInvoice: emitirComprobanteFiscal,
        amountPaid: METODO_PAGO === 'EFECTIVO' ? (pagaCon > 0 ? pagaCon : totalFinal) : totalFinal
    };

    const btnFinalizar = document.getElementById('btnFinalizarVenta') || document.querySelector('.mobile-bottom-bar button');
    if (btnFinalizar) btnFinalizar.disabled = true;

    // ==========================================
    // 10.1 ARQUITECTURA OFFLINE-FIRST: INTERCEPTACIÓN
    // ==========================================
    if (!navigator.onLine) {
        try {
            const offlineSaleId = (typeof savePendingSale === 'function')
                ? await savePendingSale(saleRequestDTO)
                : Date.now();

            const offlineSaleData = {
                ...saleRequestDTO,
                id: offlineSaleId,
                numeroTicket: `OFF-${offlineSaleId}`,
                nroComprobante: `OFF-${String(offlineSaleId).padStart(6, '0')}`,
                saleDate: new Date().toISOString(),
                isOffline: true,
                userName: (typeof localStorage !== 'undefined' ? localStorage.getItem('baezpos_user_name') : '') || 'Cajero',
                clienteNombre: clienteSeleccionado ? clienteSeleccionado.name : 'CONSUMIDOR FINAL'
            };

            ULTIMA_VENTA_EXITOSA = offlineSaleData;
            if (window.sndSuccess) window.sndSuccess.play().catch(() => {});

            Swal.fire({
                icon: 'success',
                title: '¡Venta Guardada Offline!',
                html: `
                    <div class="text-center">
                        <div class="badge bg-warning text-dark fs-6 px-3 py-1.5 mb-2 rounded-pill shadow-sm">
                            <i class="bi bi-wifi-off me-1"></i> Pendiente de Sincronización
                        </div>
                        <p class="text-secondary small mb-3">La venta ha sido registrada de forma segura en la memoria del dispositivo.</p>
                        <div class="d-flex flex-column gap-2 mt-2">
                            <button type="button" id="btnOffPrintTicket" class="btn btn-dark fw-bold py-2 rounded-3 w-100 shadow-sm">
                                <i class="bi bi-receipt me-1"></i> Imprimir Ticket (80mm)
                            </button>
                            <button type="button" id="btnOffPrintA4" class="btn btn-outline-primary fw-bold py-2 rounded-3 w-100 shadow-sm">
                                <i class="bi bi-file-earmark-pdf me-1"></i> Exportar Factura A4 / PDF
                            </button>
                        </div>
                    </div>
                `,
                showConfirmButton: false,
                showCancelButton: true,
                cancelButtonText: 'Cerrar',
                cancelButtonColor: '#6c757d',
                customClass: { popup: 'rounded-4' },
                didOpen: () => {
                    const bTicket = document.getElementById('btnOffPrintTicket');
                    const bA4 = document.getElementById('btnOffPrintA4');
                    if (bTicket) {
                        bTicket.addEventListener('click', () => {
                            imprimirTicket(offlineSaleData);
                            Swal.close();
                        });
                    }
                    if (bA4) {
                        bA4.addEventListener('click', () => {
                            imprimirFacturaA4(offlineSaleData);
                            Swal.close();
                        });
                    }
                }
            });

            // Limpieza de estado del carrito
            CARRITO = [];
            localStorage.removeItem('baezpos_cart');
            clienteSeleccionado = null;
            const infoCli = document.getElementById('infoClienteSeleccionado');
            if (infoCli) infoCli.classList.add('d-none');

            if (pagaConInputEl) pagaConInputEl.value = '';
            const inputDesc = document.getElementById('inputDescuento');
            if (inputDesc) inputDesc.value = '';

            renderizarCarrito();
            if (typeof actualizarIndicadorVentasPendientes === 'function') {
                await actualizarIndicadorVentasPendientes();
            }
            return;

        } catch (errOffline) {
            console.error("[OfflinePOS] Error al guardar venta local:", errOffline);
            Swal.fire('Error', 'No se pudo guardar la venta en la base de datos local.', 'error');
            return;
        } finally {
            if (btnFinalizar) btnFinalizar.disabled = false;
            const buscador = document.getElementById('buscadorVenta');
            if (buscador) buscador.value = '';
            enfocarBuscadorInteligente();
        }
    }

    try {
        const res = await apiFetch('/sales', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(saleRequestDTO)
        });

        if (res.status === 401 || res.status === 403) return;

        const contentType = res.headers.get("content-type");
        const data = (contentType && contentType.includes("application/json")) ? await res.json() : {};

        if (!res.ok) {
            if (res.status === 409) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Transacción Concurrente',
                    text: data.message || 'Transacción en curso por otro usuario. Por favor, reintente en un segundo.'
                });
                return;
            }
            if (res.status === 400 && data.message && data.message.toLowerCase().includes('caja')) {
                SESION_CAJA_ACTIVA = null;
                actualizarUICaja(false);
            }
            throw new Error(data.message || `Error ${res.status}: No se pudo procesar la venta.`);
        }

        ULTIMA_VENTA_EXITOSA = data;
        if (window.sndSuccess) window.sndSuccess.play().catch(() => {});

        const numTicketVisual = data.nroComprobante || (data.numeroTicket ? `#${data.numeroTicket}` : `Op #${data.id || 'OK'}`);

        Swal.fire({
            icon: 'success',
            title: '¡Venta Realizada!',
            html: `
                <div class="text-center mb-3">
                    <p class="fs-5 fw-bold text-primary mb-1">${numTicketVisual}</p>
                    <p class="text-muted small mb-0">${METODO_PAGO === 'CUENTA_CORRIENTE' ? `Cargado a ${clienteSeleccionado.name}` : `Total: $${utilFormatearMoneda(totalFinal)}`}</p>
                </div>
                <div class="d-flex flex-column gap-2 mt-3">
                    <button type="button" id="btnSalePrintTicket" class="btn btn-dark fw-bold py-2.5 rounded-3 w-100 shadow-sm">
                        <i class="bi bi-receipt me-1"></i> Imprimir Ticket (80mm)
                    </button>
                    <button type="button" id="btnSalePrintA4" class="btn btn-outline-primary fw-bold py-2.5 rounded-3 w-100 shadow-sm">
                        <i class="bi bi-file-earmark-pdf me-1"></i> Exportar Factura A4 / PDF
                    </button>
                </div>
            `,
            showConfirmButton: false,
            showCancelButton: true,
            cancelButtonText: 'Cerrar sin imprimir',
            cancelButtonColor: '#6c757d',
            customClass: { popup: 'rounded-4' },
            didOpen: () => {
                const bTicket = document.getElementById('btnSalePrintTicket');
                const bA4 = document.getElementById('btnSalePrintA4');
                if (bTicket) {
                    bTicket.addEventListener('click', () => {
                        imprimirTicket(data);
                        Swal.close();
                    });
                }
                if (bA4) {
                    bA4.addEventListener('click', () => {
                        imprimirFacturaA4(data);
                        Swal.close();
                    });
                }
            }
        });

        // Limpieza de estado del carrito
        CARRITO = [];
        localStorage.removeItem('baezpos_cart');
        clienteSeleccionado = null;
        const infoCli = document.getElementById('infoClienteSeleccionado');
        if (infoCli) infoCli.classList.add('d-none');

        if (pagaConInputEl) pagaConInputEl.value = '';
        const inputDesc = document.getElementById('inputDescuento');
        if (inputDesc) inputDesc.value = '';

        renderizarCarrito();
        if (typeof cargarProductos === 'function') await cargarProductos();

    } catch (err) {
        console.error("[SalesModule] Error al finalizar venta:", err);
        // Si el fallo fue por corte súbito de conexión a internet, guardar offline
        if (!navigator.onLine || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
            try {
                const offlineSaleId = (typeof savePendingSale === 'function')
                    ? await savePendingSale(saleRequestDTO)
                    : Date.now();

                const offlineSaleData = {
                    ...saleRequestDTO,
                    id: offlineSaleId,
                    numeroTicket: `OFF-${offlineSaleId}`,
                    nroComprobante: `OFF-${String(offlineSaleId).padStart(6, '0')}`,
                    saleDate: new Date().toISOString(),
                    isOffline: true,
                    userName: (typeof localStorage !== 'undefined' ? localStorage.getItem('baezpos_user_name') : '') || 'Cajero',
                    clienteNombre: clienteSeleccionado ? clienteSeleccionado.name : 'CONSUMIDOR FINAL'
                };

                ULTIMA_VENTA_EXITOSA = offlineSaleData;
                if (window.sndSuccess) window.sndSuccess.play().catch(() => {});

                Swal.fire({
                    icon: 'warning',
                    title: 'Sin Conexión: Guardada Offline',
                    html: `
                        <p class="small text-secondary mb-1">Se interrumpió la conexión al servidor. La venta se almacenó localmente con éxito.</p>
                        <div class="badge bg-warning text-dark fs-7 mb-3">Se sincronizará automáticamente</div>
                        <div class="d-flex flex-column gap-2 mt-2">
                            <button type="button" id="btnFallbackPrintTicket" class="btn btn-dark fw-bold py-2 rounded-3 w-100 shadow-sm">
                                <i class="bi bi-receipt me-1"></i> Imprimir Ticket (80mm)
                            </button>
                            <button type="button" id="btnFallbackPrintA4" class="btn btn-outline-primary fw-bold py-2 rounded-3 w-100 shadow-sm">
                                <i class="bi bi-file-earmark-pdf me-1"></i> Exportar Factura A4 / PDF
                            </button>
                        </div>
                    `,
                    showConfirmButton: false,
                    showCancelButton: true,
                    cancelButtonText: 'Continuar',
                    cancelButtonColor: '#6c757d',
                    customClass: { popup: 'rounded-4' },
                    didOpen: () => {
                        const bTicket = document.getElementById('btnFallbackPrintTicket');
                        const bA4 = document.getElementById('btnFallbackPrintA4');
                        if (bTicket) {
                            bTicket.addEventListener('click', () => {
                                imprimirTicket(offlineSaleData);
                                Swal.close();
                            });
                        }
                        if (bA4) {
                            bA4.addEventListener('click', () => {
                                imprimirFacturaA4(offlineSaleData);
                                Swal.close();
                            });
                        }
                    }
                });

                CARRITO = [];
                clienteSeleccionado = null;
                const infoCli = document.getElementById('infoClienteSeleccionado');
                if (infoCli) infoCli.classList.add('d-none');
                renderizarCarrito();
                if (typeof actualizarIndicadorVentasPendientes === 'function') {
                    await actualizarIndicadorVentasPendientes();
                }
                return;
            } catch (errFallback) {
                console.error("[SalesModule] Falló respaldo offline:", errFallback);
            }
        }

        if (window.sndError) window.sndError.play().catch(() => {});
        Swal.fire('Error', err.message || 'No se pudo conectar con el servidor.', 'error');
    } finally {
        if (btnFinalizar) btnFinalizar.disabled = false;
        const buscador = document.getElementById('buscadorVenta');
        if (buscador) buscador.value = '';
        enfocarBuscadorInteligente();
    }
}

// ==========================================
// 10.2 SINCRONIZACIÓN DE VENTAS OFFLINE
// ==========================================
let isSyncingSales = false;

async function syncPendingSales() {
    if (isSyncingSales) return;
    if (!navigator.onLine) {
        console.log('[Sync] No hay conexión a Internet para sincronizar ventas.');
        return;
    }
    if (typeof getPendingSales !== 'function') return;

    try {
        const pendingSales = await getPendingSales();
        if (!pendingSales || pendingSales.length === 0) {
            await actualizarIndicadorVentasPendientes();
            return;
        }

        isSyncingSales = true;
        let syncedCount = 0;
        let failedCount = 0;

        console.log(`[Sync] Iniciando sincronización de ${pendingSales.length} ventas offline...`);

        for (const sale of pendingSales) {
            try {
                const localId = sale.id;
                const payload = {
                    cashRegisterId: sale.cashRegisterId,
                    items: sale.items,
                    subtotal: sale.subtotal,
                    total: sale.total,
                    discount: sale.discount,
                    surcharge: sale.surcharge,
                    surchargeRate: sale.surchargeRate,
                    paymentMethod: sale.paymentMethod,
                    customerId: sale.customerId,
                    isFiscal: sale.isFiscal,
                    amountPaid: sale.amountPaid
                };

                const res = await apiFetch('/sales', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res && res.ok) {
                    if (typeof deletePendingSale === 'function') {
                        await deletePendingSale(localId);
                    }
                    syncedCount++;
                } else {
                    failedCount++;
                    console.warn(`[Sync] Venta #${localId} no pudo sincronizarse (HTTP ${res?.status})`);
                }
            } catch (errOne) {
                failedCount++;
                console.error('[Sync] Error sincronizando venta individual:', errOne);
                break;
            }
        }

        isSyncingSales = false;
        await actualizarIndicadorVentasPendientes();

        if (syncedCount > 0) {
            if (typeof showSaasToast === 'function') {
                showSaasToast('success', `¡${syncedCount} ${syncedCount === 1 ? 'venta offline sincronizada' : 'ventas offline sincronizadas'} con éxito!`);
            } else if (typeof Swal !== 'undefined') {
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: `Sincronizadas ${syncedCount} ventas offline`,
                    showConfirmButton: false,
                    timer: 3500
                });
            }

            if (typeof serviceCargarProductos === 'function') {
                await serviceCargarProductos();
            }
        }
    } catch (errSync) {
        console.error('[Sync] Error general de sincronización:', errSync);
        isSyncingSales = false;
    }
}

async function actualizarIndicadorVentasPendientes() {
    if (typeof countPendingSales !== 'function') return;
    try {
        const count = await countPendingSales();
        const btnSync = document.getElementById('btnSyncPendingSales');
        const badgeCount = document.getElementById('syncBadgeCount');

        if (btnSync && badgeCount) {
            if (count > 0) {
                badgeCount.innerText = count;
                btnSync.classList.remove('d-none');
            } else {
                btnSync.classList.add('d-none');
            }
        }
    } catch (e) {
        console.warn('[Sync] No se pudo actualizar contador de ventas pendientes:', e);
    }
}

window.syncPendingSales = syncPendingSales;
window.actualizarIndicadorVentasPendientes = actualizarIndicadorVentasPendientes;


// ==========================================
// 11. IMPRESIÓN DE TICKETS Y TICKETERA
// ==========================================
function generarPlantillaHTMLTicket(venta) {
    const infoEmpresa = (typeof DATOS_EMPRESA !== 'undefined' && DATOS_EMPRESA !== null) ? DATOS_EMPRESA : {};
    const fiscalActivo = String(venta.isFiscal !== undefined ? venta.isFiscal : infoEmpresa.hasTaxData) === "true";

    const nombreLocal = (venta.companyName || infoEmpresa.name || 'MI NEGOCIO').toUpperCase();
    const direccionLocal = venta.companyAddress || infoEmpresa.address || '';
    const telefonoLocal = venta.companyPhone || infoEmpresa.phone || '';
    const emailLocal = venta.companyEmail || infoEmpresa.email || '';
    const mensajePie = venta.ticketMessage || infoEmpresa.ticketMessage || '¡Gracias por su compra!';

    const cuitLocal = venta.companyCuit || infoEmpresa.taxId || infoEmpresa.cuit || '';
    const iibbLocal = venta.companyIibb || infoEmpresa.iibb || '';
    const condicionIva = (venta.condicionIva || infoEmpresa.condicionIva || 'RESPONSABLE MONOTRIBUTO').toUpperCase();

    let inicioActividades = venta.inicioActividades || infoEmpresa.inicioActividades || infoEmpresa.inicioAct || '';
    if (inicioActividades && inicioActividades.includes('-')) {
        const parts = inicioActividades.split('-');
        if (parts.length === 3) {
            inicioActividades = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
    }

    const tipoComprobante = (venta.invoiceType || venta.tipoComprobante || infoEmpresa.tipoComprobante || (fiscalActivo ? 'FACTURA C' : 'TICKET INTERNO')).toUpperCase();

    const cae = venta.cae || '';
    const caeVto = venta.caeExpiration || venta.caeVto || '';

    // Si nroComprobante/invoiceNumber viene del backend, lo respeta.
    const nroComprobante = venta.invoiceNumber || venta.nroComprobante || `00001-${String(venta.numeroTicket || venta.id || 1).padStart(8, '0')}`;
    const fechaVenta = venta.saleDate ? new Date(venta.saleDate).toLocaleString('es-AR') : new Date().toLocaleString('es-AR');
    const cajeroNombre = escapeHtml(venta.sellerName || venta.userName || venta.cashierName || (typeof localStorage !== 'undefined' ? localStorage.getItem('baezpos_user_name') : '') || 'Admin').toUpperCase();
    const metodoPago = (venta.paymentMethod || 'EFECTIVO').replace(/_/g, ' ').toUpperCase();

    const nombreCliente = (venta.clienteNombre || (typeof clienteSeleccionado !== 'undefined' && clienteSeleccionado ? clienteSeleccionado.name : 'CONSUMIDOR FINAL')).toUpperCase();
    const cuitCliente = venta.clienteCuit || (typeof clienteSeleccionado !== 'undefined' && clienteSeleccionado ? clienteSeleccionado.cuit : '') || '';

    const recargoMonto = parseFloat(venta.surcharge) || 0;
    const recargoPorcentaje = parseFloat(venta.surchargeRate) || 0;
    const descuentoMonto = parseFloat(venta.discount) || 0;
    const totalFinal = parseFloat(venta.total) || 0;
    const subtotalProductos = (totalFinal - recargoMonto) + descuentoMonto;

    let qrText = '';
    if (cae) {
        const cuitLimpio = cuitLocal.replace(/\D/g, '');
        const cuitClienteLimpio = cuitCliente.replace(/\D/g, '');

        // Extraemos el número secuencial del comprobante "0001-00000005" -> 5
        const numeroComprobanteEntero = nroComprobante.includes('-')
            ? parseInt(nroComprobante.split('-')[1], 10)
            : (venta.numeroTicket || venta.id || 1);

        const datosQr = {
            ver: 1,
            fecha: fechaVenta.split(' ')[0],
            cuit: Number(cuitLimpio),
            ptoVta: 1,
            tipoCmp: tipoComprobante.includes('A') ? 1 : 11,
            nroCmp: numeroComprobanteEntero,
            importe: totalFinal,
            moneda: "ARS",
            ctz: 1,
            tipoDocRec: cuitClienteLimpio ? 80 : 99,
            nroDocRec: cuitClienteLimpio ? Number(cuitClienteLimpio) : 0,
            tipoCodAut: "E",
            codAut: Number(cae) || 0
        };
        try {
            qrText = `https://www.afip.gob.ar/fe/qr/?p=${btoa(JSON.stringify(datosQr))}`;
        } catch(e) {
            qrText = '';
        }
    }

    const itemsHTML = venta.items ? venta.items.map(function mapItemTicketHTML(item) {
        const subtotalItem = item.subtotal !== undefined
            ? item.subtotal
            : ((item.price || item.unitPrice || item.precio || 0) * (item.quantity || item.cantidad || 1));
        const cantidadVal = item.quantity !== undefined ? item.quantity : (item.cantidad !== undefined ? item.cantidad : 1);
        const isFractionalVal = Boolean(
            item.isFractional ||
            item.fraccionable ||
            item.unitType === 'KG' ||
            item.unit === 'KG' ||
            (item.producto && (item.producto.isFractional || item.producto.fraccionable)) ||
            (item.product && (item.product.isFractional || item.product.fraccionable)) ||
            (!Number.isInteger(parseFloat(cantidadVal)))
        );
        const cantFormatted = (typeof window.fmtCantidadTicket === 'function')
            ? window.fmtCantidadTicket(cantidadVal, isFractionalVal)
            : (cantidadVal + (isFractionalVal ? ' Kg' : ' un'));
        const prefijoCantidad = cantFormatted ? `${cantFormatted} ` : '';

        return `
            <div class="item-row">
                <span class="item-qty-name">${prefijoCantidad}${escapeHtml(item.productName || item.nombre || item.name || '').toUpperCase()}</span>
                <span class="item-price">$${window.fmtPrecioTicket ? window.fmtPrecioTicket(subtotalItem) : utilFormatearMoneda(parseFloat(subtotalItem))}</span>
            </div>
        `;
    }).join('') : '';

    const htmlTicket = `
        <!DOCTYPE html>
        <html>
            <head>
                <title>Ticket #${venta.id || ''}</title>
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css">
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
                    @page { margin: 0; size: auto; }
                    body {
                        font-family: 'Inter', sans-serif;
                        width: 100%;
                        max-width: 80mm;
                        padding: 4px;
                        margin: 0 auto;
                        color: #000000;
                        background: #ffffff;
                        line-height: 1.25;
                        font-size: 9pt;
                    }
                    .center { text-align: center; }
                    .ticket-header { border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
                    .shop-icon-container { display: flex; justify-content: center; align-items: center; margin-bottom: 4px; }
                    .shop-icon-container svg { width: 28px; height: 28px; fill: #000; }
                    .business-name { font-weight: 900; font-size: 12pt; margin: 2px 0; text-transform: uppercase; letter-spacing: -0.2px; }
                    .small-info { font-size: 8.5pt; color: #000; margin: 1.5px 0; }
                    .fiscal-header { font-size: 8pt; color: #000; text-align: left; background: #f8fafc; padding: 4px 6px; border-radius: 4px; margin-top: 4px; border: 1px solid #e2e8f0; }
                    .item-row { display: flex; justify-content: space-between; align-items: flex-start; font-size: 8.5pt; margin-bottom: 4px; word-break: break-word; }
                    .item-qty-name { font-weight: 700; text-transform: uppercase; flex: 1; padding-right: 6px; }
                    .item-price { font-weight: 700; white-space: nowrap; }
                    .line { border-top: 1px dashed #000; margin: 6px 0; }
                    .total-container { border-top: 2px solid #000; margin-top: 6px; padding-top: 6px; display: flex; justify-content: space-between; align-items: center; }
                    .total-label { font-weight: 900; font-size: 12pt; }
                    .total-amount { font-weight: 900; font-size: 12pt; color: #000; }
                    .arca-container { border-top: 1px solid #000; margin-top: 8px; padding-top: 6px; text-align: center; }
                    .arca-logo { font-weight: 900; font-size: 10pt; letter-spacing: 2px; }
                    .cae-info { font-size: 8pt; font-weight: 700; text-align: left; }
                    .ticket-footer { text-align: center; margin-top: 8px; border-top: 1px dashed #000; padding-top: 6px; }
                    .msg-pie { font-style: italic; font-size: 8.5pt; color: #000; margin-bottom: 4px; display: block; }
                    .payment-method { font-weight: 800; font-size: 8.5pt; border: 1px solid #000; padding: 2px 6px; display: inline-block; border-radius: 4px; margin-bottom: 4px; }
                    .powered { font-size: 7pt; font-weight: 700; opacity: 0.6; margin-top: 6px; letter-spacing: 0.5px; }
                </style>
            <body class="layout-ticket">
                <div class="layout-ticket">
                    <div class="ticket-header center">
                        <div class="shop-icon-container">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
                                <path d="M2.97 1.35A1 1 0 0 1 3.73 1h8.54a1 1 0 0 1 .76.35l2.609 3.044A1.5 1.5 0 0 1 16 5.37v.255a2.375 2.375 0 0 1-4.25 1.458A2.37 2.37 0 0 1 9.875 8 2.37 2.37 0 0 1 8 7.083 2.37 2.37 0 0 1 6.125 8a2.37 2.37 0 0 1-1.875-.917A2.375 2.375 0 0 1 0 5.625V5.37a1.5 1.5 0 0 1 .361-.976zm1.78 4.275a1.375 1.375 0 0 0 2.75 0 .5.5 0 0 1 1 0 1.375 1.375 0 0 0 2.75 0 .5.5 0 0 1 1 0 1.375 1.375 0 1 0 2.75 0V5.37a.5.5 0 0 0-.12-.325L12.27 2H3.73L1.12 5.045A.5.5 0 0 0 1 5.37v.255a1.375 1.375 0 0 0 2.75 0 .5.5 0 0 1 1 0M1.5 8.5A.5.5 0 0 1 2 9v6h12V9a.5.5 0 0 1 1 0v6.5a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5V9a.5.5 0 0 1 .5-.5M5 11a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5v4H5z"/>
                            </svg>
                        </div>
                        <div class="business-name">${nombreLocal}</div>
                        ${direccionLocal ? `<div class="small-info">${direccionLocal}</div>` : ''}
                        ${telefonoLocal ? `<div class="small-info">Tel: ${telefonoLocal}</div>` : ''}
                        ${emailLocal ? `<div class="small-info">${emailLocal}</div>` : ''}
                        ${fiscalActivo ? `
                            <div class="fiscal-header">
                                ${cuitLocal ? `<div><strong>CUIT:</strong> ${cuitLocal}</div>` : ''}
                                ${iibbLocal ? `<div><strong>Ing. Brutos:</strong> ${iibbLocal}</div>` : ''}
                                ${inicioActividades ? `<div><strong>Inic. Act.:</strong> ${inicioActividades}</div>` : ''}
                                ${condicionIva ? `<div><strong>Cond. IVA:</strong> ${condicionIva}</div>` : ''}
                            </div>
                        ` : ''}
                        <div class="line"></div>
                        ${(venta.isOffline || (typeof venta.numeroTicket === 'string' && venta.numeroTicket.startsWith('OFF-')) || (typeof venta.nroComprobante === 'string' && venta.nroComprobante.startsWith('OFF-'))) ? `
                            <div style="background: #fef2f2; color: #b91c1c; border: 1.5px dashed #dc2626; padding: 4px; border-radius: 4px; font-weight: 900; font-size: 8pt; text-align: center; margin: 4px 0;">
                                ⚠️ TICKET PENDIENTE DE SINCRONIZACIÓN
                            </div>
                        ` : ''}
                        <div class="small-info"><strong>${tipoComprobante} N° ${nroComprobante}</strong></div>
                        <div class="small-info">Fecha: ${fechaVenta}</div>
                        <div class="small-info">Cajero: ${cajeroNombre}</div>
                        <div class="small-info" style="text-align: left; margin-top: 4px;"><strong>A:</strong> ${nombreCliente} ${cuitCliente ? `(CUIT: ${cuitCliente})` : ''}</div>
                    </div>
                    <div class="ticket-body">
                        ${itemsHTML}
                        ${descuentoMonto > 0 ? `
                            <div class="line"></div>
                            <div class="item-row" style="color: #dc3545;">
                                <span class="item-qty-name">DESCUENTO:</span>
                                <span class="item-price">-$${utilFormatearMoneda(descuentoMonto)}</span>
                            </div>
                        ` : ''}
                        ${recargoMonto > 0 ? `
                            <div class="line"></div>
                            <div class="item-row" style="color: #64748b; font-size: 8pt;">
                                <span class="item-qty-name">SUBTOTAL PRODUCTOS:</span>
                                <span class="item-price">$${utilFormatearMoneda(subtotalProductos)}</span>
                            </div>
                            <div class="item-row" style="color: #d97706; font-weight: bold;">
                                <span class="item-qty-name">RECARGO LIBRETA (${recargoPorcentaje}%):</span>
                                <span class="item-price">+$${utilFormatearMoneda(recargoMonto)}</span>
                            </div>
                        ` : ''}
                        <div class="total-container">
                            <span class="total-label">TOTAL</span>
                            <span class="total-amount">$${utilFormatearMoneda(totalFinal)}</span>
                        </div>
                    </div>
                    ${cae ? `
                        <div class="arca-container" style="border-top: 1px dashed #000; margin-top: 8px; padding-top: 6px; text-align: center;">
                            <div class="arca-logo" style="text-align: center; font-weight: 900; font-size: 10pt; letter-spacing: 2px;">ARCA / AFIP</div>
                            <div class="small-info center" style="font-size: 7.5pt; margin-bottom: 4px; text-align: center;">Comprobante Autorizado Electrónicamente</div>
                            <div style="text-align: center; margin: 6px 0;">
                                <img src="https://quickchart.io/qr?text=${encodeURIComponent(qrText || `https://www.afip.gob.ar/fe/qr/?p=${btoa(JSON.stringify({ fecha: fechaVenta.split(' ')[0], cuit: Number(cuitLocal.replace(/\\D/g, '') || 301234559), ptoVta: 1, tipoCmp: tipoComprobante.includes('A') ? 1 : 11, nroCmp: 1, importe: totalFinal, tipoDocRec: 99, nroDocRec: 0, tipoCodAut: 'E', codAut: Number(cae) || 0 }))}`)}&size=120" style="width: 120px; height: 120px; display: inline-block;" alt="QR AFIP" />
                            </div>
                            <div class="cae-info" style="font-size: 8pt; font-weight: 700; text-align: left; margin-top: 4px;">CUIT: ${cuitLocal}</div>
                            <div class="cae-info" style="font-size: 8pt; font-weight: 700; text-align: left;">Comprobante: ${tipoComprobante} Nro: ${nroComprobante}</div>
                            <div class="cae-info" style="font-size: 8pt; font-weight: 700; text-align: left;">CAE: ${cae}</div>
                            <div class="cae-info" style="font-size: 8pt; font-weight: 700; text-align: left;">Vto. CAE: ${caeVto}</div>
                        </div>
                    ` : ''}
                    <div class="ticket-footer">
                        <div class="payment-method">FORMA DE PAGO: ${metodoPago}</div>
                        <span class="msg-pie">${mensajePie}</span>
                        <div class="powered">BAEZPOS v3.5 - POWERED BY BAEZ ALEXANDER</div>
                    </div>
                </div>
            </body>
        </html>
    `;

    return {
        html: htmlTicket,
        qrText: qrText
    };
}

/**
 * Generador formal de Factura / Documento Fiscal A4 Tabular.
 */
function generarFacturaA4HTML(venta) {
    if (!venta) return { html: '', qrText: '' };

    const infoEmpresa = (typeof DATOS_EMPRESA !== 'undefined' && DATOS_EMPRESA !== null) ? DATOS_EMPRESA : {};
    const fiscalActivo = String(venta.isFiscal !== undefined ? venta.isFiscal : infoEmpresa.hasTaxData) === "true";

    const nombreLocal = escapeHtml(venta.companyName || infoEmpresa.name || 'MI NEGOCIO').toUpperCase();
    const direccionLocal = escapeHtml(venta.companyAddress || infoEmpresa.address || '');
    const telefonoLocal = escapeHtml(venta.companyPhone || infoEmpresa.phone || '');
    const emailLocal = escapeHtml(venta.companyEmail || infoEmpresa.email || '');
    const mensajePie = escapeHtml(venta.ticketMessage || infoEmpresa.ticketMessage || '¡Gracias por su compra!');

    const cuitLocal = venta.companyCuit || infoEmpresa.taxId || infoEmpresa.cuit || '';
    const iibbLocal = venta.companyIibb || infoEmpresa.iibb || '';
    const condicionIva = (venta.condicionIva || infoEmpresa.condicionIva || 'RESPONSABLE MONOTRIBUTO').toUpperCase();

    let inicioActividades = venta.inicioActividades || infoEmpresa.inicioActividades || infoEmpresa.inicioAct || '';
    if (inicioActividades && inicioActividades.includes('-')) {
        const parts = inicioActividades.split('-');
        if (parts.length === 3) inicioActividades = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    const tipoComprobante = (venta.invoiceType || venta.tipoComprobante || infoEmpresa.tipoComprobante || (fiscalActivo ? 'FACTURA C' : 'DOCUMENTO NO FISCAL')).toUpperCase();

    let letra = 'C';
    let codigoComprobante = 'COD. 011';
    if (tipoComprobante.includes('FACTURA A') || tipoComprobante.includes('NOTA DE DÉBITO A') || tipoComprobante.includes('NOTA DE CRÉDITO A')) {
        letra = 'A';
        codigoComprobante = 'COD. 001';
    } else if (tipoComprobante.includes('FACTURA B') || tipoComprobante.includes('NOTA DE DÉBITO B') || tipoComprobante.includes('NOTA DE CRÉDITO B')) {
        letra = 'B';
        codigoComprobante = 'COD. 006';
    } else if (tipoComprobante.includes('FACTURA C') || tipoComprobante.includes('NOTA DE DÉBITO C') || tipoComprobante.includes('NOTA DE CRÉDITO C')) {
        letra = 'C';
        codigoComprobante = 'COD. 011';
    } else {
        letra = 'X';
        codigoComprobante = 'DOC. NO FISCAL';
    }

    const cae = venta.cae || '';
    const caeVto = venta.caeExpiration || venta.caeVto || '';

    const nroComprobante = venta.invoiceNumber || venta.nroComprobante || `00001-${String(venta.numeroTicket || venta.id || 1).padStart(8, '0')}`;
    const fechaVenta = venta.saleDate ? new Date(venta.saleDate).toLocaleString('es-AR') : new Date().toLocaleString('es-AR');
    const cajeroNombre = escapeHtml(venta.sellerName || venta.userName || venta.cashierName || (typeof localStorage !== 'undefined' ? localStorage.getItem('baezpos_user_name') : '') || 'Admin').toUpperCase();
    const metodoPago = (venta.paymentMethod || 'EFECTIVO').replace(/_/g, ' ').toUpperCase();

    const nombreCliente = escapeHtml((venta.clienteNombre || (typeof clienteSeleccionado !== 'undefined' && clienteSeleccionado ? clienteSeleccionado.name : 'CONSUMIDOR FINAL')).toUpperCase());
    const cuitCliente = venta.clienteCuit || (typeof clienteSeleccionado !== 'undefined' && clienteSeleccionado ? clienteSeleccionado.cuit : '') || '';

    const recargoMonto = parseFloat(venta.surcharge) || 0;
    const recargoPorcentaje = parseFloat(venta.surchargeRate) || 0;
    const descuentoMonto = parseFloat(venta.discount) || 0;
    const totalFinal = parseFloat(venta.total) || 0;
    const subtotalProductos = (totalFinal - recargoMonto) + descuentoMonto;

    let qrText = '';
    if (cae) {
        const cuitLimpio = cuitLocal.replace(/\D/g, '');
        const cuitClienteLimpio = cuitCliente.replace(/\D/g, '');
        const numeroComprobanteEntero = nroComprobante.includes('-')
            ? parseInt(nroComprobante.split('-')[1], 10)
            : (venta.numeroTicket || venta.id || 1);

        const datosQr = {
            ver: 1,
            fecha: fechaVenta.split(' ')[0],
            cuit: Number(cuitLimpio || 301234559),
            ptoVta: 1,
            tipoCmp: tipoComprobante.includes('A') ? 1 : 11,
            nroCmp: numeroComprobanteEntero,
            importe: totalFinal,
            moneda: "ARS",
            ctz: 1,
            tipoDocRec: cuitClienteLimpio ? 80 : 99,
            nroDocRec: cuitClienteLimpio ? Number(cuitClienteLimpio) : 0,
            tipoCodAut: "E",
            codAut: Number(cae) || 0
        };
        try {
            qrText = `https://www.afip.gob.ar/fe/qr/?p=${btoa(JSON.stringify(datosQr))}`;
        } catch(e) {
            qrText = '';
        }
    }

    const itemsHTML = venta.items ? venta.items.map(function mapItemA4(item) {
        const subtotalItem = item.subtotal !== undefined
            ? item.subtotal
            : ((item.price || item.unitPrice || item.precio || 0) * (item.quantity || item.cantidad || 1));
        const unitPrice = (item.price || item.unitPrice || item.precio || 0);
        const cantidadVal = item.quantity !== undefined ? item.quantity : (item.cantidad !== undefined ? item.cantidad : 1);
        const isFractionalVal = Boolean(
            item.isFractional ||
            item.fraccionable ||
            item.unitType === 'KG' ||
            item.unit === 'KG' ||
            (item.producto && (item.producto.isFractional || item.producto.fraccionable)) ||
            (item.product && (item.product.isFractional || item.product.fraccionable)) ||
            (!Number.isInteger(parseFloat(cantidadVal)))
        );
        const cantFormatted = (typeof window.fmtCantidadTicket === 'function')
            ? window.fmtCantidadTicket(cantidadVal, isFractionalVal)
            : (cantidadVal + (isFractionalVal ? ' Kg' : ' un'));

        return `
            <tr>
                <td style="text-align: center; font-weight: 700; border: 1px solid #cbd5e1; padding: 6px 8px;">${cantFormatted}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px 8px;"><strong>${escapeHtml(item.productName || item.nombre || item.name || '').toUpperCase()}</strong></td>
                <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px 8px;">$${window.fmtPrecioTicket ? window.fmtPrecioTicket(unitPrice) : unitPrice.toFixed(2)}</td>
                <td style="text-align: right; font-weight: 700; border: 1px solid #cbd5e1; padding: 6px 8px;">$${window.fmtPrecioTicket ? window.fmtPrecioTicket(subtotalItem) : subtotalItem.toFixed(2)}</td>
            </tr>
        `;
    }).join('') : '<tr><td colspan="4" style="text-align: center; color: #64748b; padding: 12px;">Sin productos detallados</td></tr>';

    const htmlA4 = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Factura ${nroComprobante}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
                @page {
                    size: A4 portrait;
                    margin: 8mm;
                }
                * { box-sizing: border-box; }
                body {
                    font-family: 'Inter', system-ui, -apple-system, sans-serif;
                    color: #0f172a;
                    background: #ffffff;
                    margin: 0;
                    padding: 0;
                    font-size: 9pt;
                    line-height: 1.35;
                }
                .layout-a4 {
                    width: 100%;
                    max-width: 194mm;
                    margin: 0 auto;
                    padding: 0;
                }
                .a4-header {
                    display: flex;
                    border: 1.5px solid #0f172a;
                    border-radius: 6px;
                    position: relative;
                    margin-bottom: 8px;
                    background: #ffffff;
                }
                .a4-col-empresa {
                    flex: 1;
                    padding: 10px 14px;
                    border-right: 1px solid #cbd5e1;
                }
                .a4-empresa-nombre {
                    font-size: 13pt;
                    font-weight: 800;
                    color: #0f172a;
                    margin: 0 0 4px 0;
                    text-transform: uppercase;
                    letter-spacing: -0.2px;
                }
                .a4-line {
                    font-size: 8.5pt;
                    color: #334155;
                    margin-bottom: 2px;
                }
                .a4-box-letra {
                    position: absolute;
                    top: 0;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 44px;
                    height: 48px;
                    background: #ffffff;
                    border: 1.5px solid #0f172a;
                    border-top: none;
                    border-radius: 0 0 6px 6px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    z-index: 10;
                }
                .a4-letra {
                    font-size: 18pt;
                    font-weight: 900;
                    color: #0f172a;
                    line-height: 1;
                }
                .a4-letra-cod {
                    font-size: 6pt;
                    font-weight: 700;
                    color: #475569;
                }
                .a4-col-comprobante {
                    flex: 1;
                    padding: 10px 14px 10px 28px;
                    text-align: right;
                }
                .a4-comp-titulo {
                    font-size: 12pt;
                    font-weight: 800;
                    color: #0f172a;
                    margin: 0 0 3px 0;
                    text-transform: uppercase;
                }
                .a4-comp-numero {
                    font-size: 11pt;
                    font-weight: 800;
                    color: #2563eb;
                    margin-bottom: 4px;
                }
                .a4-cliente-box {
                    border: 1.5px solid #0f172a;
                    border-radius: 6px;
                    padding: 8px 12px;
                    margin-bottom: 8px;
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                    background: #f8fafc;
                }
                .a4-row-split {
                    display: flex;
                    justify-content: space-between;
                    font-size: 8.5pt;
                }
                .a4-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 8px;
                    font-size: 8.5pt;
                }
                .a4-table th {
                    background: #0f172a;
                    color: #ffffff !important;
                    font-weight: 700;
                    padding: 6px 8px;
                    text-align: left;
                    border: 1px solid #0f172a;
                }
                .a4-table td {
                    padding: 6px 8px;
                    border: 1px solid #cbd5e1;
                    vertical-align: middle;
                }
                .a4-table tbody tr:nth-child(even) {
                    background: #f8fafc;
                }
                .a4-totales-container {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 16px;
                    margin-bottom: 8px;
                }
                .a4-obs-box {
                    flex: 1;
                    border: 1px dashed #94a3b8;
                    border-radius: 6px;
                    padding: 8px 10px;
                    font-size: 8pt;
                    color: #475569;
                }
                .a4-totales-box {
                    width: 260px;
                    border: 1.5px solid #0f172a;
                    border-radius: 6px;
                    overflow: hidden;
                }
                .a4-tot-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 4px 10px;
                    font-size: 8.5pt;
                    border-bottom: 1px solid #e2e8f0;
                }
                .a4-tot-row.final {
                    background: #0f172a;
                    color: #ffffff !important;
                    font-weight: 800;
                    font-size: 11pt;
                    border-bottom: none;
                    padding: 6px 10px;
                }
                .a4-tot-row.final * {
                    color: #ffffff !important;
                }
                .a4-fiscal-footer {
                    border: 1.5px solid #0f172a;
                    border-radius: 6px;
                    padding: 8px 12px;
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    margin-top: 6px;
                    background: #ffffff;
                }
                .a4-qr-img {
                    width: 100px;
                    height: 100px;
                    display: block;
                }
                .a4-cae-data {
                    flex: 1;
                    font-size: 8.5pt;
                }
                .a4-cae-title {
                    font-weight: 800;
                    font-size: 9.5pt;
                    letter-spacing: 0.5px;
                    margin-bottom: 3px;
                }
            </style>
        </head>
        <body class="layout-a4">
            <div class="layout-a4">
                <div class="a4-header">
                    <div class="a4-col-empresa">
                        <div class="a4-empresa-nombre">${nombreLocal}</div>
                        ${direccionLocal ? `<div class="a4-line">${direccionLocal}</div>` : ''}
                        ${telefonoLocal ? `<div class="a4-line">Tel: ${telefonoLocal}</div>` : ''}
                        ${emailLocal ? `<div class="a4-line">Email: ${emailLocal}</div>` : ''}
                        <div class="a4-line" style="font-weight: 700; margin-top: 3px;">IVA: ${condicionIva}</div>
                    </div>

                    <div class="a4-box-letra">
                        <div class="a4-letra">${letra}</div>
                        <div class="a4-letra-cod">${codigoComprobante}</div>
                    </div>

                    <div class="a4-col-comprobante">
                        <div class="a4-comp-titulo">${tipoComprobante}</div>
                        <div class="a4-comp-numero">N° ${nroComprobante}</div>
                        <div class="a4-line">Fecha de Emisión: <strong>${fechaVenta}</strong></div>
                        <div class="a4-line">CUIT: <strong>${cuitLocal || 'S/C'}</strong></div>
                        <div class="a4-line">Ingresos Brutos: <strong>${iibbLocal || 'Exento / S/C'}</strong></div>
                        <div class="a4-line">Inicio de Actividades: <strong>${inicioActividades || '-'}</strong></div>
                    </div>
                </div>

                <div class="a4-cliente-box">
                    <div class="a4-row-split">
                        <div><strong>Razón Social / Cliente:</strong> ${nombreCliente}</div>
                        <div><strong>CUIT / DNI:</strong> ${cuitCliente || 'Consumidor Final'}</div>
                    </div>
                    <div class="a4-row-split">
                        <div><strong>Condición IVA:</strong> ${cuitCliente ? 'IVA Responsable Inscripto / Monotributo' : 'Consumidor Final'}</div>
                        <div><strong>Condición de Venta:</strong> ${metodoPago}</div>
                        <div><strong>Cajero/a:</strong> ${cajeroNombre}</div>
                    </div>
                </div>

                <table class="a4-table">
                    <thead>
                        <tr>
                            <th style="width: 12%; text-align: center;">CANT.</th>
                            <th style="width: 53%;">DESCRIPCIÓN</th>
                            <th style="width: 17%; text-align: right;">P. UNITARIO</th>
                            <th style="width: 18%; text-align: right;">SUBTOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHTML}
                    </tbody>
                </table>

                <div class="a4-totales-container">
                    <div class="a4-obs-box">
                        <strong>Observaciones / Leyenda:</strong><br>
                        ${mensajePie}<br>
                        <span style="opacity: 0.7; font-size: 7.5pt; display: block; margin-top: 6px;">Documento generado a través de BÁEZ POS SaaS Platform.</span>
                    </div>
                    <div class="a4-totales-box">
                        ${descuentoMonto > 0 ? `
                            <div class="a4-tot-row" style="color: #dc2626;">
                                <span>Descuento:</span>
                                <span>-$${window.fmtPrecioTicket ? window.fmtPrecioTicket(descuentoMonto) : descuentoMonto.toFixed(2)}</span>
                            </div>
                        ` : ''}
                        ${recargoMonto > 0 ? `
                            <div class="a4-tot-row" style="color: #d97706;">
                                <span>Recargo (${recargoPorcentaje}%):</span>
                                <span>+$${window.fmtPrecioTicket ? window.fmtPrecioTicket(recargoMonto) : recargoMonto.toFixed(2)}</span>
                            </div>
                        ` : ''}
                        <div class="a4-tot-row final">
                            <span>TOTAL FINAL:</span>
                            <span>$${window.fmtPrecioTicket ? window.fmtPrecioTicket(totalFinal) : totalFinal.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                ${cae ? `
                    <div class="a4-fiscal-footer">
                        <div>
                            <img class="a4-qr-img" src="https://quickchart.io/qr?text=${encodeURIComponent(qrText || `https://www.afip.gob.ar/fe/qr/?p=${btoa(JSON.stringify({ fecha: fechaVenta.split(' ')[0], cuit: Number(cuitLocal.replace(/\\D/g, '') || 301234559), ptoVta: 1, tipoCmp: tipoComprobante.includes('A') ? 1 : 11, nroCmp: 1, importe: totalFinal, tipoDocRec: 99, nroDocRec: 0, tipoCodAut: 'E', codAut: Number(cae) || 0 }))}`)}&size=140" alt="QR AFIP" />
                        </div>
                        <div class="a4-cae-data">
                            <div class="a4-cae-title">ARCA / AFIP - Comprobante Autorizado Electrónicamente</div>
                            <div><strong>CAE N°:</strong> ${cae}</div>
                            <div><strong>Fecha de Vto. de CAE:</strong> ${caeVto}</div>
                            <div style="font-size: 7.5pt; color: #475569; margin-top: 3px;">Comprobante oficial válido como factura comercial. Verifique su autenticidad escaneando el código QR.</div>
                        </div>
                    </div>
                ` : ''}
            </div>
        </body>
        </html>
    `;

    return {
        html: htmlA4,
        qrText: qrText
    };
}

/**
 * Motor de impresión nativo mediante CSS @media print y #print-section.
 * Sincroniza la carga de imágenes (ej. códigos QR) antes de llamar a window.print().
 */
function imprimirHTMLConIframe(htmlContent) {
    let printSection = document.getElementById('print-section');
    if (!printSection) {
        printSection = document.createElement('div');
        printSection.id = 'print-section';
        document.body.appendChild(printSection);
    }
    printSection.innerHTML = htmlContent;

    const images = Array.from(printSection.querySelectorAll('img'));
    const pendingImages = images.filter(img => !img.complete);

    const ejecutarImpresion = () => {
        try {
            window.print();
        } finally {
            setTimeout(() => {
                if (printSection) printSection.innerHTML = '';
            }, 1000);
        }
    };

    if (pendingImages.length === 0) {
        ejecutarImpresion();
    } else {
        const imagePromises = pendingImages.map(img => {
            return new Promise(resolve => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
            });
        });

        const timeoutPromise = new Promise(resolve => setTimeout(resolve, 1500));

        Promise.race([Promise.all(imagePromises), timeoutPromise]).then(() => {
            ejecutarImpresion();
        });
    }
}

function imprimirTicket(venta) {
    if (!venta) return;
    const plantilla = generarPlantillaHTMLTicket(venta);
    imprimirHTMLConIframe(plantilla.html);
}

function imprimirFacturaA4(venta) {
    if (!venta) return;
    const plantilla = generarFacturaA4HTML(venta);
    imprimirHTMLConIframe(plantilla.html);
}

function imprimirTicketLocal(venta) {
    imprimirTicket(venta);
}

function reimprimirUltimoTicket() {
    if (typeof ULTIMA_VENTA_EXITOSA === 'undefined' || !ULTIMA_VENTA_EXITOSA) {
        Swal.fire('Atención', 'No hay ninguna venta reciente en esta sesión para reimprimir.', 'info');
        return;
    }
    if (typeof imprimirTicket === 'function') {
        imprimirTicket(ULTIMA_VENTA_EXITOSA);
    }
}

function reimprimirUltimaFacturaA4() {
    if (typeof ULTIMA_VENTA_EXITOSA === 'undefined' || !ULTIMA_VENTA_EXITOSA) {
        Swal.fire('Atención', 'No hay ninguna venta reciente en esta sesión para reimprimir.', 'info');
        return;
    }
    if (typeof imprimirFacturaA4 === 'function') {
        imprimirFacturaA4(ULTIMA_VENTA_EXITOSA);
    }
}

// ==========================================
// 12. CONTROL GLOBAL DE ENFOQUE (TECLADO)
// ==========================================
document.addEventListener('keydown', function handleCapturaFocoGlobal(e) {
    if (typeof sistemaBloqueado !== 'undefined' && sistemaBloqueado) return;

    // Si es un dispositivo táctil o móvil, ignoramos el autofocus por teclado global
    const esMovil = window.innerWidth <= 991 || ('ontouchstart' in window);
    if (esMovil) return;

    const buscador = document.getElementById('buscadorVenta');
    const idActivo = document.activeElement ? document.activeElement.id : '';
    const inputsLibres = ['pagaCon', 'inputDescuento', 'buscarClientePos', 'manualNombreBusqueda', 'manualPrecio'];

    if (!inputsLibres.includes(idActivo)) {
        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
            if (document.activeElement !== buscador && buscador) {
                buscador.focus();
            }
        }
    }
});

// ==========================================
// 13. APERTURA Y CIERRE DE CAJA (SaaS Multi-Tenant - Responsive)
// ==========================================

/**
 * Función Auxiliar Segura para Formato Moneda
 */
function formatearMonedaSegura(monto) {
    if (typeof utilFormatearMoneda === 'function') {
        return utilFormatearMoneda(monto);
    }
    const val = parseFloat(monto || 0);
    return val.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Consulta al backend si existe una caja abierta para la sesión actual de forma segura.
 */
async function verificarEstadoCaja() {
    try {
        const response = await apiFetch('/cash-register/active');

        // Si la API responde con un 404 o similar de forma controlada
        if (!response || !response.ok) {
            SESION_CAJA_ACTIVA = null;
            actualizarUICaja(false);
            return;
        }

        const data = await response.json();
        if (data && (data.id || data.status === 'OPEN')) {
            SESION_CAJA_ACTIVA = data;
            actualizarUICaja(true);
        } else {
            SESION_CAJA_ACTIVA = null;
            actualizarUICaja(false);
        }
    } catch (error) {
        // Un 404 lanzado como error por apiFetch se intercepta aquí de forma pacífica
        // Sin bloquear la interfaz ni hacer bucles infinitos.
        console.info("[CashRegister] Sesión sin caja abierta activa (estado normal).");
        SESION_CAJA_ACTIVA = null;
        actualizarUICaja(false);
    }
}

/**
 * Actualización de UI optimizada para Viewports Estrechos (UX Mobile-First)
 */
function actualizarUICaja(estaAbierta) {
    const badge = document.getElementById('badgeEstadoCaja');
    const btnAbrir = document.getElementById('btnAbrirCajaHeader') || document.getElementById('btnAbrirCajaUI');
    const btnCerrar = document.getElementById('btnCerrarCajaHeader') || document.getElementById('btnCerrarCajaUI');

    const inputBuscador = document.getElementById('buscadorVenta');
    const btnFinalizar = document.getElementById('btnFinalizarVenta');

    if (estaAbierta && SESION_CAJA_ACTIVA) {
        // En móviles ocultamos el badge secundario para evitar el colapso visual
        if (badge) {
            badge.className = "badge bg-success-subtle text-success border border-success-subtle px-2 py-1.5 rounded-pill fs-7 d-none d-md-inline-flex align-items-center";
            badge.innerHTML = `<i class="bi bi-circle-fill text-success fs-8 me-1"></i> Abierta (#${SESION_CAJA_ACTIVA.id || '1'})`;
        }

        if (btnAbrir) btnAbrir.classList.add('d-none');

        // Botón Cierre Limpio (No envuelve texto)
        if (btnCerrar) {
            btnCerrar.classList.remove('d-none');
            btnCerrar.className = "btn btn-outline-danger btn-sm rounded-pill px-2.5 py-1 fw-bold text-nowrap d-inline-flex align-items-center gap-1 shadow-sm fs-7";
            btnCerrar.innerHTML = `<i class="bi bi-lock-fill"></i> <span>Cerrar</span>`;
        }

        if (inputBuscador) {
            inputBuscador.disabled = false;
            inputBuscador.placeholder = "Escanea código o busca producto...";
        }
        if (btnFinalizar) btnFinalizar.disabled = false;

    } else {
        // Ocultamos badge para dar paso al CTA unificado
        if (badge) {
            badge.className = "d-none d-md-inline-flex badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1.5 rounded-pill fs-7 align-items-center";
            badge.innerHTML = `<i class="bi bi-x-circle-fill me-1"></i> Caja Cerrada`;
        }

        if (btnCerrar) btnCerrar.classList.add('d-none');

        // Botón de Apertura Unificado: Evita saltos de línea con 'text-nowrap'
        if (btnAbrir) {
            btnAbrir.classList.remove('d-none');
            btnAbrir.className = "btn btn-success btn-sm rounded-pill px-3 py-1.5 fw-bold text-nowrap d-inline-flex align-items-center gap-1.5 shadow-sm fs-7";
            btnAbrir.innerHTML = `<i class="bi bi-unlock-fill"></i><span>Abrir Caja</span>`;
        }

        if (inputBuscador) {
            inputBuscador.disabled = true;
            inputBuscador.placeholder = "🔒 Abra la caja para vender...";
        }
        if (btnFinalizar) btnFinalizar.disabled = true;
    }
}

/**
 * Modal Responsive SweetAlert2 para APERTURA DE CAJA
 */
async function modalAbrirCaja() {
    if (SESION_CAJA_ACTIVA) {
        Swal.fire('Atención', 'Ya existe una sesión de caja abierta.', 'info');
        return;
    }

    const { value: formValues } = await Swal.fire({
        title: '<span class="fs-5 fs-md-4">🚀 Apertura de Caja</span>',
        customClass: {
            container: 'p-2 p-sm-3',
            popup: 'rounded-4 shadow-lg border-0 mw-100',
            htmlContainer: 'mx-0 my-2 px-1 px-sm-3 text-start'
        },
        html: `
            <p class="text-muted small mb-3">Ingrese el monto inicial disponible en el cajón de dinero.</p>

            <div class="mb-3">
                <label class="form-label small fw-bold text-secondary">Monto Inicial / Fondo ($)</label>
                <div class="input-group input-group-lg">
                    <span class="input-group-text bg-light text-secondary fs-5">$</span>
                    <input id="swal-monto-inicial" type="number" step="0.01" inputmode="decimal" class="form-control fw-bold text-primary fs-4" placeholder="0.00" value="0.00">
                </div>
            </div>

            <div class="mb-2">
                <label class="form-label small fw-bold text-secondary">Notas / Observaciones (Opcional)</label>
                <textarea id="swal-notas-apertura" class="form-control form-control-sm" rows="2" placeholder="Ej: Cambio en billetes chicos..."></textarea>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-box-arrow-in-right me-1"></i> Abrir Caja',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#0d6efd',
        cancelButtonColor: '#6c757d',
        allowOutsideClick: false,
        didOpen: () => {
            const input = document.getElementById('swal-monto-inicial');
            if (input) {
                input.focus();
                input.select();
            }
        },
        preConfirm: () => {
            const elMonto = document.getElementById('swal-monto-inicial');
            const elNotas = document.getElementById('swal-notas-apertura');
            const monto = parseFloat(elMonto ? elMonto.value : 0);
            const notas = elNotas ? elNotas.value.trim() : '';

            if (isNaN(monto) || monto < 0) {
                Swal.showValidationMessage('Ingrese un monto inicial válido (mayor o igual a 0)');
                return false;
            }
            return { initialAmount: monto, notes: notas };
        }
    });

    if (formValues) {
        await ejecutarAperturaCaja(formValues);
    }
}

/**
 * Procesa el envío de Apertura de Caja al servidor mediante apiFetch
 */
async function ejecutarAperturaCaja(payload) {
    try {
        const response = await apiFetch('/cash-register/open', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response || !response.ok) {
            const errData = response ? await response.json().catch(() => ({})) : {};
            throw new Error(errData.message || 'Error al procesar la apertura de caja.');
        }

        SESION_CAJA_ACTIVA = await response.json();
        actualizarUICaja(true);

        if (window.sndSuccess) window.sndSuccess.play().catch(() => {});

        Swal.fire({
            icon: 'success',
            title: '¡Caja Abierta!',
            text: 'Turno iniciado correctamente. Ya puede registrar ventas.',
            timer: 2000,
            showConfirmButton: false
        });

        if (typeof enfocarBuscadorInteligente === 'function') {
            enfocarBuscadorInteligente();
        }

    } catch (error) {
        console.error("[CashRegister] Error de apertura:", error);
        if (window.sndError) window.sndError.play().catch(() => {});
        Swal.fire({
            icon: 'error',
            title: 'Error de Apertura',
            text: error.message || 'No se pudo conectar con el servidor.'
        });
    }
}

/**
 * Modal Responsive SweetAlert2 para CIERRE DE CAJA (Arqueo Ciego)
 * En el arqueo ciego, NO se muestra el dinero teórico al cajero.
 */
async function modalCerrarCaja() {
    if (!SESION_CAJA_ACTIVA) {
        Swal.fire('Atención', 'No hay ninguna sesión de caja activa para cerrar.', 'warning');
        return;
    }

    const { value: formValues } = await Swal.fire({
        title: '<span class="fs-5 fw-bold text-dark">🔒 Cierre de Caja & Arqueo Ciego</span>',
        width: 'min(480px, 94vw)',
        customClass: {
            container: 'p-2',
            popup: 'rounded-4 shadow-lg border-0 my-2 mx-auto',
            htmlContainer: 'mx-0 my-1 px-2 px-sm-3 text-start'
        },
        html: `
            <div class="text-center mb-3">
                <div class="p-2.5 bg-danger bg-opacity-10 text-danger rounded-circle d-inline-flex mb-2">
                    <i class="bi bi-safe fs-2"></i>
                </div>
                <h6 class="fw-bold text-dark mb-1">Arqueo Físico del Cajón</h6>
                <p class="text-muted small mb-0">Cuente el efectivo físico disponible en billetes y monedas.</p>
            </div>

            <!-- Input Proporcionado de Monto Contado (Arqueo Ciego) -->
            <div class="mb-3">
                <label class="form-label fw-bold text-dark small text-uppercase mb-2 text-center d-block">Efectivo Físico Contado *</label>
                <div class="input-group input-group-lg shadow-sm rounded-3 overflow-hidden border mx-auto" style="max-width: 300px;">
                    <span class="input-group-text bg-white border-0 text-success fw-bold fs-3 ps-3 pe-2">$</span>
                    <input id="swal-monto-declarado" type="number" step="0.01" inputmode="decimal" class="form-control form-control-lg border-0 fs-2 fw-bold text-dark text-center shadow-none amount-num" placeholder="0.00" autocomplete="off">
                </div>
                <div class="form-text text-muted text-center mt-1.5" style="font-size: 0.75rem;">
                    <i class="bi bi-shield-lock me-1 text-primary"></i> El sistema auditará la diferencia contra el cálculo teórico tras confirmar.
                </div>
            </div>

            <!-- Observaciones -->
            <div class="mb-1">
                <label class="form-label small fw-bold text-dark text-uppercase mb-1">Notas / Observaciones del Turno</label>
                <textarea id="swal-notas-cierre" class="form-control rounded-3 bg-light border p-2" rows="2" placeholder="Opcional: Aclaraciones del turno, retiros, etc..."></textarea>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-lock-fill me-1"></i> Confirmar Cierre',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        allowOutsideClick: false,
        didOpen: () => {
            const input = document.getElementById('swal-monto-declarado');
            if (input) {
                input.focus();
                input.select();
            }
        },
        preConfirm: () => {
            const elMonto = document.getElementById('swal-monto-declarado');
            const elNotas = document.getElementById('swal-notas-cierre');
            const montoDeclarado = parseFloat(elMonto ? elMonto.value : -1);
            const notas = elNotas ? elNotas.value.trim() : '';

            if (isNaN(montoDeclarado) || montoDeclarado < 0) {
                Swal.showValidationMessage('Ingrese un monto físico contado válido');
                return false;
            }
            return { declaredAmount: montoDeclarado, notes: notas };
        }
    });

    if (formValues) {
        await ejecutarCierreCaja(formValues);
    }
}

/**
 * Procesa el envío de Cierre de Caja al servidor mediante apiFetch y despliega el Informe Auditor
 */
async function ejecutarCierreCaja(payload) {
    try {
        const response = await apiFetch('/cash-register/close', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response || !response.ok) {
            const errData = response ? await response.json().catch(() => ({})) : {};
            throw new Error(errData.message || 'Error al procesar el cierre de caja.');
        }

        // DTO recibido del Backend: CashSessionResponseDTO
        const closedSession = await response.json();

        SESION_CAJA_ACTIVA = null;
        actualizarUICaja(false);

        if (window.sndSuccess) window.sndSuccess.play().catch(() => {});

        // Desplegar resultado de arqueo auditado
        await mostrarResultadoArqueoModal(closedSession);

    } catch (error) {
        console.error("[CashRegister] Error de cierre:", error);
        if (window.sndError) window.sndError.play().catch(() => {});
        Swal.fire({
            icon: 'error',
            title: 'Error al cerrar caja',
            text: error.message || 'No se pudo conectar con el servidor.'
        });
    }
}

/**
 * Modal Auditor para mostrar Sobrante / Faltante o Caja Cuadrada (UX Responsive)
 */
async function mostrarResultadoArqueoModal(dto) {
    const sistema = parseFloat(dto.systemAmount ?? 0);
    const declarado = parseFloat(dto.declaredAmount ?? 0);
    const diferencia = parseFloat(dto.difference ?? 0);

    let iconType = 'success';
    let titleHeader = '¡Caja Cerrada Exitosamente!';
    let diffBadge = `<span class="badge bg-success-subtle text-success fs-7 border border-success-subtle px-2.5 py-1.5 rounded-pill">Diferencia: $0,00 (Cuadrada)</span>`;
    let estadoTexto = 'El dinero físico coincide con el cálculo del sistema.';

    if (diferencia < 0) {
        iconType = 'warning';
        titleHeader = 'Cierre con FALTANTE';
        diffBadge = `<span class="badge bg-danger-subtle text-danger fs-7 border border-danger-subtle px-2.5 py-1.5 rounded-pill">Faltante: -$${formatearMonedaSegura(Math.abs(diferencia))}</span>`;
        estadoTexto = 'Se detectó un faltante de dinero respecto al cálculo del sistema.';
    } else if (diferencia > 0) {
        iconType = 'info';
        titleHeader = 'Cierre con SOBRANTE';
        diffBadge = `<span class="badge bg-primary-subtle text-primary fs-7 border border-primary-subtle px-2.5 py-1.5 rounded-pill">Sobrante: +$${formatearMonedaSegura(diferencia)}</span>`;
        estadoTexto = 'Se registró más efectivo que el calculado por el sistema.';
    }

    const resultado = await Swal.fire({
        icon: iconType,
        title: `<span class="fs-6 fs-sm-5 fw-bold text-dark">${titleHeader}</span>`,
        width: '100%',
        customClass: {
            container: 'p-1 p-sm-3',
            popup: 'rounded-4 shadow-lg border-0 my-2 mx-auto mw-100',
            htmlContainer: 'mx-0 my-1 px-2 px-sm-3 text-start'
        },
        html: `
            <div class="text-center mb-2.5">
                ${diffBadge}
                <p class="text-muted small mt-1.5 mb-0" style="font-size: 0.78rem;">${estadoTexto}</p>
            </div>

            <!-- Comparativa Principal (Auditoría Arqueo Ciego) -->
            <div class="bg-light p-2.5 p-sm-3 rounded-3 border mb-2.5 fs-7">
                <div class="d-flex justify-content-between align-items-center mb-1.5">
                    <span class="text-secondary">Efectivo Teórico (Sistema):</span>
                    <span class="fw-bold text-dark">$${formatearMonedaSegura(sistema)}</span>
                </div>
                <div class="d-flex justify-content-between align-items-center mb-1.5">
                    <span class="text-secondary">Efectivo Declarado (Físico):</span>
                    <span class="fw-bold text-success">$${formatearMonedaSegura(declarado)}</span>
                </div>
                <hr class="my-1.5">
                <div class="d-flex justify-content-between align-items-center">
                    <span class="fw-bold text-dark">Diferencia Final:</span>
                    <span class="fw-bold fs-6 ${diferencia < 0 ? 'text-danger' : (diferencia > 0 ? 'text-primary' : 'text-success')}">
                        ${diferencia > 0 ? '+' : ''}$${formatearMonedaSegura(diferencia)}
                    </span>
                </div>
            </div>

            <!-- Resumen Operativo en Lista Flex -->
            <div class="bg-white p-2.5 rounded-3 border text-start fs-7">
                <span class="fw-bold text-secondary d-block mb-1.5" style="font-size: 0.75rem;">Desglose del Turno:</span>

                <div class="d-flex justify-content-between align-items-center py-0.5 border-bottom border-light">
                    <span class="text-muted small">+ Fondo Inicial:</span>
                    <span class="fw-semibold text-dark">$${formatearMonedaSegura(dto.initialAmount)}</span>
                </div>
                <div class="d-flex justify-content-between align-items-center py-0.5 border-bottom border-light">
                    <span class="text-muted small">+ Ventas en Efectivo:</span>
                    <span class="fw-semibold text-dark">$${formatearMonedaSegura(dto.totalCashSales)}</span>
                </div>
                <div class="d-flex justify-content-between align-items-center py-0.5 border-bottom border-light">
                    <span class="text-muted small">+ Cobranza Cta. Cte. (Efectivo):</span>
                    <span class="fw-semibold text-dark">$${formatearMonedaSegura(dto.totalCustomerPayments)}</span>
                </div>
                <div class="d-flex justify-content-between align-items-center py-0.5">
                    <span class="text-muted small">- Gastos en Efectivo:</span>
                    <span class="fw-semibold text-danger">-$${formatearMonedaSegura(dto.totalExpenses)}</span>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-printer me-1"></i> Imprimir Comprobante',
        cancelButtonText: 'Finalizar',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#64748b',
        allowOutsideClick: false
    });

    if (resultado.isConfirmed) {
        imprimirTicketCierreCaja(dto);
    }
}

/**
 * Genera el ticket térmico oficial de cierre de caja con desglose de Teórico, Declarado y Diferencia
 */
function imprimirTicketCierreCaja(dto) {
    const empresa = DATOS_EMPRESA || { name: 'BÁEZ POS', address: '', phone: '', taxId: '' };
    const fechaCierre = dto.closedAt ? new Date(dto.closedAt).toLocaleString('es-AR') : new Date().toLocaleString('es-AR');
    const fechaApertura = dto.openedAt ? new Date(dto.openedAt).toLocaleString('es-AR') : '-';
    const cajero = dto.userName || localStorage.getItem('baezpos_user_name') || 'Admin';
    const inicial = parseFloat(dto.initialAmount ?? 0);
    const ventasEfe = parseFloat(dto.totalCashSales ?? 0);
    const cobrosEfe = parseFloat(dto.totalCustomerPayments ?? 0);
    const gastosEfe = parseFloat(dto.totalExpenses ?? 0);
    const teorico = parseFloat(dto.systemAmount ?? 0);
    const declarado = parseFloat(dto.declaredAmount ?? 0);
    const diferencia = parseFloat(dto.difference ?? 0);

    const diffLabel = diferencia >= 0 ? 'SOBRANTE:' : 'FALTANTE:';
    const diffText = `${diferencia >= 0 ? '+' : ''}$${formatearMonedaSegura(Math.abs(diferencia))}`;

    const htmlTicket = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="utf-8">
            <title>Ticket de Cierre de Caja - #${dto.sessionNumber || 1}</title>
            <style>
                @page { margin: 0; size: 80mm auto; }
                body {
                    font-family: 'Courier New', Courier, monospace;
                    font-size: 12px;
                    line-height: 1.3;
                    margin: 0;
                    padding: 10px;
                    width: 280px;
                    color: #000;
                    background: #fff;
                }
                .text-center { text-align: center; }
                .text-end { text-align: right; }
                .fw-bold { font-weight: bold; }
                .divider { border-top: 1px dashed #000; margin: 6px 0; }
                .row { display: flex; justify-content: space-between; margin: 3px 0; }
                .fs-lg { font-size: 13px; }
                .fs-title { font-size: 15px; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="text-center">
                <div class="fs-title">${(empresa.name || 'BÁEZ POS').toUpperCase()}</div>
                <div>${empresa.address || ''}</div>
                <div>CUIT: ${empresa.taxId || 'S/C'}</div>
                <div class="divider"></div>
                <div class="fw-bold">COMPROBANTE DE CIERRE DE CAJA</div>
                <div>Caja Turno #${dto.sessionNumber || 1}</div>
                <div class="divider"></div>
            </div>
            <div class="row"><span>Apertura:</span><span>${fechaApertura}</span></div>
            <div class="row"><span>Cierre:</span><span>${fechaCierre}</span></div>
            <div class="row"><span>Cajero/a:</span><span>${cajero}</span></div>
            <div class="divider"></div>
            <div class="row"><span>+ Fondo Inicial:</span><span>$${formatearMonedaSegura(inicial)}</span></div>
            <div class="row"><span>+ Ventas Efectivo:</span><span>$${formatearMonedaSegura(ventasEfe)}</span></div>
            <div class="row"><span>+ Cobranza Cta. Cte. (Efectivo):</span><span>$${formatearMonedaSegura(cobrosEfe)}</span></div>
            <div class="row"><span>- Gastos Efectivo:</span><span>-$${formatearMonedaSegura(gastosEfe)}</span></div>
            <div class="divider"></div>
            <div class="row fw-bold"><span>EFECTIVO TEÓRICO:</span><span>$${formatearMonedaSegura(teorico)}</span></div>
            <div class="row fw-bold"><span>EFECTIVO DECLARADO:</span><span>$${formatearMonedaSegura(declarado)}</span></div>
            <div class="divider"></div>
            <div class="row fw-bold fs-lg"><span>${diffLabel}</span><span>${diffText}</span></div>
            ${dto.notes ? `<div class="divider"></div><div><strong>Notas:</strong> ${dto.notes}</div>` : ''}
            <div class="divider"></div>
            <div class="text-center" style="margin-top: 25px;">
                <div>_____________________________</div>
                <div style="font-size: 10px; margin-top: 4px;">Firma del Responsable / Cajero</div>
            </div>
        </body>
        </html>
    `;

    imprimirHTMLConIframe(htmlTicket);
}

// Exposición global para interoperabilidad
window.imprimirTicket = imprimirTicket;
window.imprimirFacturaA4 = imprimirFacturaA4;
window.generarPlantillaHTMLTicket = generarPlantillaHTMLTicket;
window.generarFacturaA4HTML = generarFacturaA4HTML;
window.imprimirTicketLocal = imprimirTicketLocal;
window.imprimirTicketCierreCaja = imprimirTicketCierreCaja;
window.imprimirHTMLConIframe = imprimirHTMLConIframe;
window.reimprimirUltimoTicket = reimprimirUltimoTicket;
window.reimprimirUltimaFacturaA4 = reimprimirUltimaFacturaA4;