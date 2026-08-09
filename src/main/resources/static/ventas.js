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
});


// ==========================================
// 4. CONFIGURACIÓN DE LISTENERS E INTERFAZ
// ==========================================
function inicializarBuscadorProductos() {
    const buscador = document.getElementById('buscadorVenta');
    const sugerenciasDiv = document.getElementById('listaSugerencias');

    if (!buscador) return;

    buscador.focus();

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
            const buscador = document.getElementById('buscadorVenta');
            if (buscador) buscador.focus();

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
        const buscador = document.getElementById('buscadorVenta');
        if (buscador) buscador.focus();
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
        setTimeout(function enfocarClientePos() {
            const bCli = document.getElementById('buscarClientePos');
            if (bCli) bCli.focus();
        }, 100);
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

        const buscadorVenta = document.getElementById('buscadorVenta');
        if (buscadorVenta) buscadorVenta.focus();
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

    const buscador = document.getElementById('buscadorVenta');
    const sugerencias = document.getElementById('listaSugerencias');
    if (buscador) {
        buscador.value = '';
        if (sugerencias) sugerencias.style.display = 'none';
        setTimeout(function enfocarBuscadorVenta() { buscador.focus(); }, 50);
    }
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

    const buscadorVenta = document.getElementById('buscadorVenta');
    if (buscadorVenta) buscadorVenta.focus();
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
        Swal.fire('Atención', 'No hay productos en el catálogo para venta fraccionada.', 'warning');
        return;
    }

    Swal.fire({
        title: '<i class="bi bi-scale me-2 text-primary"></i>Venta por Peso / Importe',
        html: `
            <div class="position-relative text-start mb-3">
                <label class="small text-muted mb-1">Buscar producto pesable/granel:</label>
                <input id="pesableNombreBusqueda" class="swal2-input m-0 w-100" placeholder="Ej: Queso, Pan, Harina..." autocomplete="off">
                <div id="sugerenciasPesables" class="list-group position-absolute w-100 shadow-lg d-none"
                     style="z-index: 9999; max-height: 200px; overflow-y: auto;">
                </div>
            </div>
        `,
        showCancelButton: true,
        showConfirmButton: false,
        cancelButtonText: 'Cancelar',
        didOpen: function handleModalPesablesOpen() {
            const inputBusqueda = document.getElementById('pesableNombreBusqueda');
            const contenedorSugerencias = document.getElementById('sugerenciasPesables');

            if (inputBusqueda) inputBusqueda.focus();

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
                                btn.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center py-2';
                                btn.style.fontSize = '0.9rem';
                                btn.innerHTML = `
                                    <span><i class="bi bi-tag-fill me-2 text-primary"></i>${p.name.toUpperCase()} ${p.isFractional ? '<span class="badge bg-info text-dark ms-1">⚖️ Kg</span>' : ''}</span>
                                    <span class="badge bg-light text-dark border">$${(p.price || 0).toFixed(2)}/Kg</span>
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
        Swal.fire('Atención', 'El producto debe tener un precio de venta mayor a 0 para calcular fraccionado.', 'warning');
        return;
    }

    let modoActual = 'PESO';

    Swal.fire({
        title: `<div class="d-flex align-items-center justify-content-center text-primary"><i class="bi bi-speedometer2 me-2"></i><span>Venta Fraccionada</span></div>`,
        html: `
            <div class="text-start mb-3 bg-light p-3 rounded-3 border">
                <div class="fw-bold fs-5 text-dark mb-1">${p.name.toUpperCase()}</div>
                <div class="d-flex justify-content-between small text-muted">
                    <span>Precio x Kg/Unid: <strong class="text-success fs-6">$${utilFormatearMoneda(salePrice)}</strong></span>
                    <span>Stock actual: <strong class="${p.stock > 0 ? 'text-primary' : 'text-danger'}">${p.stock} Kg</strong></span>
                </div>
            </div>

            <!-- Botones de Modo -->
            <div class="btn-group w-100 mb-3" role="group">
                <button type="button" id="btnModoPeso" class="btn btn-primary fw-bold" onclick="switchModoFraccionado('PESO')">
                    ⚖️ Por Peso / Cantidad
                </button>
                <button type="button" id="btnModoImporte" class="btn btn-outline-primary fw-bold" onclick="switchModoFraccionado('IMPORTE')">
                    💵 Por Importe $
                </button>
            </div>

            <!-- Input Modo PESO (Escenario A) -->
            <div id="seccionModoPeso" class="text-start">
                <label class="form-label small fw-bold text-muted mb-1">Ingresar Peso / Cantidad (Kg):</label>
                <div class="input-group input-group-lg mb-2">
                    <input id="inputPesoCantidad" type="number" step="0.001" min="0.001" class="form-control fw-bold text-primary" placeholder="Ej: 0.250">
                    <span class="input-group-text fw-bold">Kg</span>
                </div>
                <div class="d-flex justify-content-between align-items-center bg-primary bg-opacity-10 p-2 rounded border border-primary border-opacity-25">
                    <span class="small fw-bold text-primary">TOTAL A COBRAR:</span>
                    <span id="displayTotalPeso" class="fs-4 fw-bold text-primary">$0.00</span>
                </div>
            </div>

            <!-- Input Modo IMPORTE (Escenario B) -->
            <div id="seccionModoImporte" class="text-start d-none">
                <label class="form-label small fw-bold text-muted mb-1">Ingresar Importe Monetario ($):</label>
                <div class="input-group input-group-lg mb-2">
                    <span class="input-group-text fw-bold">$</span>
                    <input id="inputImporteMoneda" type="number" step="1" min="1" class="form-control fw-bold text-success" placeholder="Ej: 2500">
                </div>
                <div class="d-flex justify-content-between align-items-center bg-success bg-opacity-10 p-2 rounded border border-success border-opacity-25">
                    <span class="small fw-bold text-success">PESO EQUIVALENTE:</span>
                    <span id="displayKilosImporte" class="fs-4 fw-bold text-success">0.000 Kg</span>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-cart-plus me-1"></i> Agregar al Carrito',
        cancelButtonText: 'Cancelar',
        didOpen: function handleModalFraccionadoOpen() {
            const inputPeso = document.getElementById('inputPesoCantidad');
            const inputImporte = document.getElementById('inputImporteMoneda');
            const displayTotal = document.getElementById('displayTotalPeso');
            const displayKilos = document.getElementById('displayKilosImporte');

            if (inputPeso) {
                inputPeso.focus();
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
                    if (btnPeso) btnPeso.className = 'btn btn-primary fw-bold';
                    if (btnImporte) btnImporte.className = 'btn btn-outline-primary fw-bold';
                    if (secPeso) secPeso.classList.remove('d-none');
                    if (secImporte) secImporte.classList.add('d-none');
                    if (inputPeso) { inputPeso.focus(); inputPeso.select(); }
                } else {
                    if (btnImporte) btnImporte.className = 'btn btn-success fw-bold';
                    if (btnPeso) btnPeso.className = 'btn btn-outline-primary fw-bold';
                    if (secImporte) secImporte.classList.remove('d-none');
                    if (secPeso) secPeso.classList.add('d-none');
                    if (inputImporte) { inputImporte.focus(); inputImporte.select(); }
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
                    text: `El stock actual es ${p.stock} Kg. Ya tenías ${cantActualEnCarrito} Kg en el carrito.`
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
                buscador.focus();
            }
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
        buscador.focus();
    }
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

    if (!CARRITO || CARRITO.length === 0) {
        Swal.fire('Carrito vacío', 'Agrega productos para cobrar', 'info');
        return;
    }

    const totalVentaEl = document.getElementById('totalVenta');
    const totalRaw = totalVentaEl ? totalVentaEl.innerText : '0';
    let total = utilParsearMontoTextual(totalRaw);

    const pagaConInputEl = document.getElementById('pagaCon');
    const pagaConInput = pagaConInputEl ? pagaConInputEl.value : '0';
    const pagaCon = utilParsearMontoTextual(pagaConInput);

    if (METODO_PAGO === 'EFECTIVO' && pagaCon < total) {
        Swal.fire('Atención', 'El monto recibido es insuficiente', 'warning');
        return;
    }

    let porcentajeRecargo = 0;
    let montoRecargo = 0;

    if (METODO_PAGO === 'CUENTA_CORRIENTE') {
        if (!clienteSeleccionado) {
            Swal.fire('Atención', 'Debes seleccionar un cliente para vender a la libreta', 'warning');
            return;
        }

        const { value: recargoIngresado, isConfirmed } = await Swal.fire({
            title: '📈 Recargo por Libreta',
            html: `Monto base: <b>$${utilFormatearMoneda(total)}</b><br><br>Ingresa el % de recargo:`,
            input: 'number',
            inputValue: 0,
            inputAttributes: { min: 0, max: 200, step: 'any' },
            showCancelButton: true,
            confirmButtonText: 'Confirmar y Cobrar',
            cancelButtonText: 'Cancelar',
            preConfirm: function handleValidarRecargo(value) {
                const val = parseFloat(value);
                if (isNaN(val) || val < 0) {
                    Swal.showValidationMessage('El porcentaje no puede ser negativo');
                    return false;
                }
                return val;
            }
        });

        if (!isConfirmed) return;

        porcentajeRecargo = recargoIngresado || 0;
        if (porcentajeRecargo > 0) {
            montoRecargo = (total * porcentajeRecargo) / 100;
            total = total + montoRecargo;
        }

        if (clienteSeleccionado.creditLimit && (clienteSeleccionado.currentBalance + total) > clienteSeleccionado.creditLimit) {
            Swal.fire({
                icon: 'error',
                title: 'Límite de Crédito Excedido',
                text: `El cliente no puede deber más de $${utilFormatearMoneda(clienteSeleccionado.creditLimit)}. Con recargo el total queda en $${utilFormatearMoneda(total)}`
            });
            return;
        }
    }

    const configLocal = JSON.parse(localStorage.getItem('config_comercio') || '{}');
    const datosEmpresaContext = (typeof DATOS_EMPRESA !== 'undefined' && DATOS_EMPRESA) ? DATOS_EMPRESA : configLocal;
    const esFiscalActivo = String(datosEmpresaContext.hasTaxData) === "true";

    const saleRequestDTO = {
        items: CARRITO.map(function mapItemParaDTO(item) {
            return {
                productId: typeof item.id === 'number' ? item.id : null,
                productName: item.name,
                quantity: item.cantidad,
                price: item.price,
                unitPrice: item.price
            };
        }),
        total: total,
        discount: typeof DESCUENTO_FINAL_PESOS !== 'undefined' ? DESCUENTO_FINAL_PESOS : 0,
        surcharge: montoRecargo,
        surchargeRate: porcentajeRecargo,
        paymentMethod: METODO_PAGO,
        customerId: clienteSeleccionado ? clienteSeleccionado.id : null,
        isFiscal: esFiscalActivo,
        amountPaid: METODO_PAGO === 'EFECTIVO' ? (pagaCon > 0 ? pagaCon : total) : total
    };

    const btnFinalizar = document.getElementById('btnFinalizarVenta') || document.querySelector('.btn-primary.btn-lg.w-100.py-3');
    if (btnFinalizar) btnFinalizar.disabled = true;

    try {
        const res = await apiFetch('/sales', {
            method: 'POST',
            body: JSON.stringify(saleRequestDTO)
        });

        if (res.status === 401 || res.status === 403) return;

        let data = {};
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            data = await res.json();
        }

        if (res.ok) {
            ULTIMA_VENTA_EXITOSA = data;
            if (window.sndSuccess) window.sndSuccess.play().catch(function silencioso(){});

            Swal.fire({
                icon: 'success',
                title: '¡Venta Realizada!',
                text: METODO_PAGO === 'CUENTA_CORRIENTE'
                    ? `Cargado $${utilFormatearMoneda(total)} a la cuenta de ${clienteSeleccionado.name} (Op #${data.id || 'OK'})`
                    : `Operación #${data.id || 'Exitosa'}`,
                showCancelButton: true,
                confirmButtonText: '<i class="bi bi-printer"></i> Imprimir Ticket',
                cancelButtonText: 'No imprimir',
                confirmButtonColor: '#28a745',
                cancelButtonColor: '#6c757d',
                reverseButtons: true
            }).then(function handleRespuestaTicketModal(result) {
                if (result.isConfirmed && typeof imprimirTicket === 'function') {
                    imprimirTicket(data);
                }
            });

            CARRITO = [];
            clienteSeleccionado = null;
            const infoCli = document.getElementById('infoClienteSeleccionado');
            if (infoCli) infoCli.classList.add('d-none');

            if (pagaConInputEl) pagaConInputEl.value = '';
            const inputDesc = document.getElementById('inputDescuento');
            if (inputDesc) inputDesc.value = '';

            renderizarCarrito();
            if (typeof cargarProductos === 'function') await cargarProductos();

        } else {
            throw new Error(data.message || `Error ${res.status}: No se pudo procesar la venta en el servidor.`);
        }
    } catch (err) {
        console.error("Error en finalizarVenta:", err);
        if (window.sndError) window.sndError.play().catch(function silencioso(){});
        Swal.fire('Error', err.message || 'No se pudo conectar con el servidor.', 'error');
    } finally {
        if (btnFinalizar) btnFinalizar.disabled = false;
        const buscador = document.getElementById('buscadorVenta');
        if (buscador) buscador.focus();
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

    const nroComprobante = venta.nroComprobante || `00001-${String(venta.id || 1).padStart(8, '0')}`;
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

        const datosQr = {
            ver: 1,
            fecha: fechaVenta.split(' ')[0],
            cuit: Number(cuitLimpio),
            ptoVta: 1,
            tipoCmp: tipoComprobante.includes('A') ? 1 : 11,
            nroCmp: venta.id || 1,
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