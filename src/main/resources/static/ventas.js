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

    inicializarBuscadorProductos();
    inicializarBuscadorClientes();
    inicializarListenersInterfaz();
    inicializarAtajosTecladoGlobales();

    // Verificación inicial de caja al cargar el módulo
    await verificarEstadoCaja();
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
        if (!res || !res.ok) return;
        PRODUCTOS_DB = await res.json();
    } catch (err) {
        console.error("Error de conexión al cargar productos:", err);
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

        return `
            <button type="button"
                    class="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-3 border-bottom shadow-sm"
                    onclick='seleccionarProducto(${JSON.stringify(p)})'
                    style="cursor: pointer;">
                <div class="text-start">
                    <div class="fw-bold text-primary mb-0">
                        <i class="bi bi-box-seam me-2"></i>${p.name.toUpperCase()}
                    </div>
                    <small class="text-muted">
                        Stock: <span class="badge ${badgeColor}">${p.stock}</span>
                        | Cód: ${p.barcode || 'S/C'}
                        ${categoriaHtml}
                    </small>
                </div>
                <div class="text-end">
                    <span class="h6 mb-0 fw-bold text-dark">$${(p.price || 0).toFixed(2)}</span>
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

function cambiarCant(index, valor) {
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

    item.cantidad = nuevaCant;
    if (item.cantidad <= 0) CARRITO.splice(index, 1);
    renderizarCarrito();
}

function eliminarItem(index) {
    if (sistemaBloqueado) return;
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

function cancelarVenta() {
    if (sistemaBloqueado || CARRITO.length === 0) return;
    CARRITO = [];
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
        isFiscal: String(datosEmpresaContext.hasTaxData) === "true",
        amountPaid: METODO_PAGO === 'EFECTIVO' ? (pagaCon > 0 ? pagaCon : totalFinal) : totalFinal
    };

    const btnFinalizar = document.getElementById('btnFinalizarVenta');
    if (btnFinalizar) btnFinalizar.disabled = true;

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
            // Manejo específico si el backend rechaza por caja cerrada
            if (res.status === 400 || res.status === 409) {
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
            text: METODO_PAGO === 'CUENTA_CORRIENTE'
                ? `Cargado $${utilFormatearMoneda(totalFinal)} a ${clienteSeleccionado.name} (${numTicketVisual})`
                : `Comprobante ${numTicketVisual}`,
            showCancelButton: true,
            confirmButtonText: '<i class="bi bi-printer"></i> Imprimir Ticket',
            cancelButtonText: 'No imprimir',
            confirmButtonColor: '#28a745',
            cancelButtonColor: '#6c757d',
            reverseButtons: true
        }).then((result) => {
            if (result.isConfirmed && typeof imprimirTicket === 'function') {
                imprimirTicket(data);
            }
        });

        // Limpieza de estado del carrito
        CARRITO = [];
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
// 11. IMPRESIÓN DE TICKETS Y TICKETERA
// ==========================================
function fmtCantidadTicket(item) {
    const qty = parseFloat(item.quantity || item.cantidad || 1);
    const nombreProd = (item.productName || item.nombre || '').toUpperCase();

    const palabrasPesables = ['PAN', 'QUESO', 'CARNE', 'POLLO', 'ASADO', 'FIAMBRE', 'PALETA', 'JAMON', 'MILANESA', 'FRUTA', 'VERDURA', 'VERDURAS', 'FRUTAS', 'KG', 'KILO'];
    const coincideNombre = palabrasPesables.some(function verificarPalabraPesable(p) {
        return nombreProd.includes(p);
    });

    const esFraccionado = Boolean(
        item.isFractional ||
        item.unitOfMeasure === 'KG' ||
        item.unitOfMeasure === 'GRAM' ||
        item.unitType === 'KG' ||
        coincideNombre ||
        (qty % 1 !== 0)
    );

    if (esFraccionado) {
        if (qty < 1 && qty > 0) {
            const gramos = Math.round(qty * 1000);
            return `${gramos} gr `;
        }
        const qtyFormatted = qty.toLocaleString('es-AR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 3
        });
        return `${qtyFormatted} Kg `;
    }

    return `${qty} `;
}

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

    const tipoComprobante = fiscalActivo
        ? (venta.tipoComprobante || infoEmpresa.tipoComprobante || 'FACTURA C').toUpperCase()
        : (venta.tipoComprobante || 'TICKET INTERNO');

    const cae = venta.cae || '';
    const caeVto = venta.caeVto || '';

    // Si nroComprobante viene de Java (Ej: "00001-00000001"), lo respeta.
    // Si no, lo genera con nroTicket / id.
    const nroComprobante = venta.nroComprobante || `00001-${String(venta.numeroTicket || venta.id || 1).padStart(8, '0')}`;
    const fechaVenta = venta.saleDate ? new Date(venta.saleDate).toLocaleString('es-AR') : new Date().toLocaleString('es-AR');
    const metodoPago = (venta.paymentMethod || 'EFECTIVO').replace(/_/g, ' ').toUpperCase();

    const nombreCliente = (venta.clienteNombre || (typeof clienteSeleccionado !== 'undefined' && clienteSeleccionado ? clienteSeleccionado.name : 'CONSUMIDOR FINAL')).toUpperCase();
    const cuitCliente = venta.clienteCuit || (typeof clienteSeleccionado !== 'undefined' && clienteSeleccionado ? clienteSeleccionado.cuit : '') || '';

    const recargoMonto = parseFloat(venta.surcharge) || 0;
    const recargoPorcentaje = parseFloat(venta.surchargeRate) || 0;
    const descuentoMonto = parseFloat(venta.discount) || 0;
    const totalFinal = parseFloat(venta.total) || 0;
    const subtotalProductos = (totalFinal - recargoMonto) + descuentoMonto;

    let qrText = '';
    if (fiscalActivo && cae) {
        const cuitLimpio = cuitLocal.replace(/\D/g, '');
        const cuitClienteLimpio = cuitCliente.replace(/\D/g, '');

        // Extraemos solo el número secuencial del comprobante "00001-00000005" -> 5
        const numeroComprobanteEntero = venta.nroComprobante
            ? parseInt(venta.nroComprobante.split('-')[1], 10)
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
        const prefijoCantidad = fmtCantidadTicket(item);

        return `
            <div class="item-row">
                <span class="item-qty-name">${prefijoCantidad}${(item.productName || item.nombre || '').toUpperCase()}</span>
                <span class="item-price">$${utilFormatearMoneda(parseFloat(subtotalItem))}</span>
            </div>
        `;
    }).join('') : '';

    return {
        html: `
        <!DOCTYPE html>
        <html>
            <head>
                <title>Ticket #${venta.id || ''}</title>
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css">
                <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
                    @page { margin: 0; }
                    body { font-family: 'Inter', sans-serif; width: 58mm; padding: 8px; margin: 0; color: #0f172a; background: #fff; line-height: 1.25; }
                    .center { text-align: center; }
                    .ticket-header { border-bottom: 1px dashed #94a3b8; padding-bottom: 8px; margin-bottom: 8px; }
                    .shop-icon-container { display: flex; justify-content: center; align-items: center; margin-bottom: 4px; }
                    .shop-icon-container svg { width: 32px; height: 32px; fill: #3b82f6; }
                    .business-name { font-weight: 900; font-size: 14px; margin: 2px 0; text-transform: uppercase; letter-spacing: -0.2px; }
                    .small-info { font-size: 9.5px; color: #334155; margin: 1.5px 0; }
                    .fiscal-header { font-size: 8.5px; color: #334155; text-align: left; background: #f1f5f9; padding: 4px 6px; border-radius: 4px; margin-top: 5px; }
                    .item-row { display: flex; justify-content: space-between; align-items: flex-start; font-size: 10px; margin-bottom: 5px; word-break: break-word; }
                    .item-qty-name { font-weight: 700; text-transform: uppercase; flex: 1; padding-right: 6px; }
                    .item-price { font-weight: 700; white-space: nowrap; }
                    .line { border-top: 1px dashed #94a3b8; margin: 8px 0; }
                    .total-container { border-top: 2px solid #0f172a; margin-top: 8px; padding-top: 6px; display: flex; justify-content: space-between; align-items: center; }
                    .total-label { font-weight: 900; font-size: 15px; }
                    .total-amount { font-weight: 900; font-size: 15px; color: #0f172a; }
                    .arca-container { border-top: 1px solid #0f172a; margin-top: 10px; padding-top: 8px; text-align: center; }
                    .arca-logo { font-weight: 900; font-size: 11px; letter-spacing: 2px; }
                    .qr-box { display: flex; justify-content: center; margin: 6px 0; }
                    .cae-info { font-size: 8.5px; font-weight: 700; text-align: left; }
                    .ticket-footer { text-align: center; margin-top: 10px; border-top: 1px dashed #94a3b8; padding-top: 8px; }
                    .msg-pie { font-style: italic; font-size: 10px; color: #475569; margin-bottom: 6px; display: block; }
                    .payment-method { font-weight: 800; font-size: 9.5px; border: 1px solid #cbd5e1; padding: 3px 6px; display: inline-block; border-radius: 4px; margin-bottom: 6px; }
                    .powered { font-size: 7px; font-weight: 700; opacity: 0.5; margin-top: 6px; letter-spacing: 0.5px; }
                </style>
            </head>
            <body>
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
                    <div class="small-info"><strong>${tipoComprobante} N° ${nroComprobante}</strong></div>
                    <div class="small-info">Fecha: ${fechaVenta}</div>
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
                        <div class="item-row" style="color: #64748b; font-size: 8.5px;">
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
                ${(fiscalActivo && cae) ? `
                    <div class="arca-container">
                        <div class="arca-logo">ARCA / AFIP</div>
                        <div class="small-info" style="font-size: 8px;">Comprobante Autorizado Electrónicamente</div>
                        <div class="qr-box" id="qrcode"></div>
                        <div class="cae-info">CAE: ${cae}</div>
                        <div class="cae-info">Vto. CAE: ${caeVto}</div>
                    </div>
                ` : ''}
                <div class="ticket-footer">
                    <div class="payment-method">FORMA DE PAGO: ${metodoPago}</div>
                    <span class="msg-pie">${mensajePie}</span>
                    <div class="powered">BAEZPOS v3.5 - POWERED BY BAEZ ALEXANDER</div>
                </div>
                <script>
                    if (${Boolean(fiscalActivo && cae && qrText)}) {
                        try {
                            new QRCode(document.getElementById("qrcode"), {
                                text: "${qrText}",
                                width: 85,
                                height: 85,
                                colorDark : "#000000",
                                colorLight : "#ffffff",
                                correctLevel : QRCode.CorrectLevel.M
                            });
                        } catch(e) {}
                    }
                    setTimeout(function ejecutarImpresionScript() {
                        window.print();
                        window.close();
                    }, 500);
                </script>
            </body>
        </html>
    `,
        qrText: qrText
    };
}

function imprimirTicket(venta) {
    if (!venta) return;

    const ventana = window.open('', 'PRINT', 'height=700,width=400');
    if (!ventana) {
        Swal.fire({ icon: 'warning', title: 'Popup bloqueado', text: 'Permití las ventanas emergentes en tu navegador.' });
        return;
    }

    const plantilla = generarPlantillaHTMLTicket(venta);
    ventana.document.write(plantilla.html);
    ventana.document.close();
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
 * Consulta al backend si existe una caja abierta para la sesión actual.
 */
async function verificarEstadoCaja() {
    try {
        const response = await apiFetch('/cash-register/active');

        if (response && response.ok) {
            const data = await response.json();
            if (data && (data.id || data.status === 'OPEN')) {
                SESION_CAJA_ACTIVA = data;
                actualizarUICaja(true);
                return;
            }
        }

        SESION_CAJA_ACTIVA = null;
        actualizarUICaja(false);
    } catch (error) {
        console.error("[CashRegister] Error al verificar estado de caja:", error);
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
 * Modal Responsive SweetAlert2 para CIERRE DE CAJA (Arqueo)
 */
async function modalCerrarCaja() {
    if (!SESION_CAJA_ACTIVA) {
        Swal.fire('Atención', 'No hay ninguna sesión de caja activa para cerrar.', 'warning');
        return;
    }

    let report = {};
    try {
        const resReport = await apiFetch('/sales/box-report');
        if (resReport && resReport.ok) {
            report = await resReport.json();
        }
    } catch (e) {
        console.warn("[CashRegister] No se pudo obtener el reporte de caja previo:", e);
    }

    const fondoInicial = parseFloat(report.activeInitialAmount ?? report.initialAmount ?? SESION_CAJA_ACTIVA.initialAmount ?? 0);
    const ventasEfectivo = parseFloat(report.activeCashSales ?? report.cashSalesToday ?? SESION_CAJA_ACTIVA.totalCashSales ?? 0);
    const cobrosCtaCte = parseFloat(report.activeCustomerPayments ?? report.customerPaymentsToday ?? SESION_CAJA_ACTIVA.totalCustomerPayments ?? 0);
    const gastosEfectivo = parseFloat(report.activeExpenses ?? report.expensesToday ?? SESION_CAJA_ACTIVA.totalExpenses ?? 0);

    const { value: formValues } = await Swal.fire({
        title: '<span class="fs-6 fs-sm-5 fw-bold text-dark">🔒 Cierre de Caja & Arqueo</span>',
        width: '100%',
        customClass: {
            container: 'p-1 p-sm-3',
            popup: 'rounded-4 shadow-lg border-0 my-2 mx-auto',
            htmlContainer: 'mx-0 my-1 px-2 px-sm-3 text-start'
        },
        html: `
            <!-- Card Compacta de Resumen del Turno -->
            <div class="bg-light p-2.5 p-sm-3 rounded-3 border mb-2.5">
                <div class="row g-2 align-items-center fs-7">
                    <div class="col-6 d-flex flex-column">
                        <span class="text-muted small">Fondo Inicial:</span>
                        <span class="fw-bold text-dark">$${formatearMonedaSegura(fondoInicial)}</span>
                    </div>
                    <div class="col-6 d-flex flex-column text-end">
                        <span class="text-muted small">Ventas Efectivo:</span>
                        <span class="fw-bold text-success">+$${formatearMonedaSegura(ventasEfectivo)}</span>
                    </div>
                    <div class="col-6 d-flex flex-column">
                        <span class="text-muted small">Cobros Cta. Cte.:</span>
                        <span class="fw-bold text-primary">+$${formatearMonedaSegura(cobrosCtaCte)}</span>
                    </div>
                    <div class="col-6 d-flex flex-column text-end">
                        <span class="text-muted small">Gastos Efectivo:</span>
                        <span class="fw-bold text-danger">-$${formatearMonedaSegura(gastosEfectivo)}</span>
                    </div>
                </div>
            </div>

            <!-- Input de Monto Contado -->
            <div class="mb-2">
                <label class="form-label small fw-bold text-dark mb-1">Efectivo Real Físico en Cajón ($) *</label>
                <div class="input-group">
                    <span class="input-group-text bg-success-subtle text-success fw-bold fs-6">$</span>
                    <input id="swal-monto-declarado" type="number" step="0.01" inputmode="decimal" class="form-control fw-bold text-success fs-5" placeholder="0.00">
                </div>
                <div class="form-text text-muted" style="font-size: 0.72rem;">Conteo físico del dinero en caja.</div>
            </div>

            <!-- Observaciones -->
            <div class="mb-1">
                <label class="form-label small fw-bold text-secondary mb-1">Notas / Observaciones</label>
                <textarea id="swal-notas-cierre" class="form-control form-control-sm" rows="2" placeholder="Opcional: Aclaraciones del turno..."></textarea>
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
    let titleHeader = '¡Caja Cerrada!';
    let diffBadge = `<span class="badge bg-success-subtle text-success fs-7 border border-success-subtle px-2.5 py-1.5 rounded-pill">Diferencia: $0,00</span>`;
    let estadoTexto = 'El dinero físico coincide con el cálculo del sistema.';

    if (diferencia < 0) {
        iconType = 'warning';
        titleHeader = 'Cierre con FALTANTE';
        diffBadge = `<span class="badge bg-danger-subtle text-danger fs-7 border border-danger-subtle px-2.5 py-1.5 rounded-pill">Faltante: -$${formatearMonedaSegura(Math.abs(diferencia))}</span>`;
        estadoTexto = 'Se detectó un faltante de dinero respecto al sistema.';
    } else if (diferencia > 0) {
        iconType = 'info';
        titleHeader = 'Cierre con SOBRANTE';
        diffBadge = `<span class="badge bg-primary-subtle text-primary fs-7 border border-primary-subtle px-2.5 py-1.5 rounded-pill">Sobrante: +$${formatearMonedaSegura(diferencia)}</span>`;
        estadoTexto = 'Se registró más efectivo que el calculado por el sistema.';
    }

    await Swal.fire({
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

            <!-- Comparativa Principal -->
            <div class="bg-light p-2.5 p-sm-3 rounded-3 border mb-2.5 fs-7">
                <div class="d-flex justify-content-between align-items-center mb-1.5">
                    <span class="text-secondary">Efectivo Esperado:</span>
                    <span class="fw-bold text-dark">$${formatearMonedaSegura(sistema)}</span>
                </div>
                <div class="d-flex justify-content-between align-items-center mb-1.5">
                    <span class="text-secondary">Efectivo Declarado:</span>
                    <span class="fw-bold text-success">$${formatearMonedaSegura(declarado)}</span>
                </div>
                <hr class="my-1.5">
                <div class="d-flex justify-content-between align-items-center">
                    <span class="fw-bold text-dark">Resultado Arqueo:</span>
                    <span class="fw-bold fs-6 ${diferencia < 0 ? 'text-danger' : (diferencia > 0 ? 'text-primary' : 'text-success')}">
                        ${diferencia > 0 ? '+' : ''}$${formatearMonedaSegura(diferencia)}
                    </span>
                </div>
            </div>

            <!-- Resumen Operativo en Lista Flex (Zero-Break Overflow) -->
            <div class="bg-white p-2.5 rounded-3 border text-start fs-7">
                <span class="fw-bold text-secondary d-block mb-1.5" style="font-size: 0.75rem;">Resumen Operativo del Turno:</span>

                <div class="d-flex justify-content-between align-items-center py-0.5 border-bottom border-light">
                    <span class="text-muted small">+ Fondo Inicial:</span>
                    <span class="fw-semibold text-dark">$${formatearMonedaSegura(dto.initialAmount)}</span>
                </div>
                <div class="d-flex justify-content-between align-items-center py-0.5 border-bottom border-light">
                    <span class="text-muted small">+ Ventas Efec.:</span>
                    <span class="fw-semibold text-dark">$${formatearMonedaSegura(dto.totalCashSales)}</span>
                </div>
                <div class="d-flex justify-content-between align-items-center py-0.5 border-bottom border-light">
                    <span class="text-muted small">+ Cobros Cta. Cte.:</span>
                    <span class="fw-semibold text-dark">$${formatearMonedaSegura(dto.totalCustomerPayments)}</span>
                </div>
                <div class="d-flex justify-content-between align-items-center py-0.5">
                    <span class="text-muted small">- Gastos Efec.:</span>
                    <span class="fw-semibold text-danger">-$${formatearMonedaSegura(dto.totalExpenses)}</span>
                </div>
            </div>
        `,
        confirmButtonText: '<i class="bi bi-check-circle-fill me-1"></i> Entendido',
        confirmButtonColor: '#0d6efd',
        allowOutsideClick: false
    });
}