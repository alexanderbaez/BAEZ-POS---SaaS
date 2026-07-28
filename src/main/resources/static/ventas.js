const API_BASE = '/sales';
const API_PRODUCTS = '/products';
const API_CUSTOMERS = '/customers';
const companyId = localStorage.getItem('baezpos_company_id');

// --- CORRECCIÓN AQUÍ: Solo una vez y con /status al final ---
const API_STATUS = '/admin/my-company/status';

// --- EL CANDADO DE ALEXANDER ---
let sistemaBloqueado = false;
const MI_WHATSAPP = "5492645468570";
let mensajeTicketServidor = "";

// RECURSOS DE AUDIO
const sndSuccess = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
const sndError = new Audio('https://assets.mixkit.co/active_storage/sfx/2573/2573-preview.mp3');

let PRODUCTOS_DB = [];
let CARRITO = [];
let METODO_PAGO = 'EFECTIVO';
let SUBTOTAL_VENTA = 0;
let DESCUENTO_FINAL_PESOS = 0;
let clienteSeleccionado = null;
let indiceSeleccionado = -1;
let ULTIMA_VENTA_EXITOSA = null;
let DATOS_EMPRESA = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. CARGA DE IDENTIDAD
    await cargarInfoEmpresa();

    // Info del Token manejado por auth.js
    await chequearEstadoLicencia();
    await cargarProductos();

    const buscador = document.getElementById('buscadorVenta');
    const sugerenciasDiv = document.getElementById('listaSugerencias');

    if (buscador) {
        buscador.focus();

        // Buscador Reactivo de Productos
        buscador.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase().trim();
            indiceSeleccionado = -1;
            if (term.length === 0) {
                sugerenciasDiv.style.display = 'none';
                return;
            }
            const filtrados = PRODUCTOS_DB.filter(p =>
                (p.name && p.name.toLowerCase().includes(term)) ||
                (p.barcode && p.barcode.includes(term))
            ).slice(0, 8);
            renderizarSugerencias(filtrados);
        });

        // Navegación por teclado (Flechas y Enter)
        buscador.addEventListener('keydown', (e) => {
            const items = sugerenciasDiv.querySelectorAll('.list-group-item');
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                indiceSeleccionado = (indiceSeleccionado + 1) % items.length;
                actualizarFocoSugerencia(items);
            }
            else if (e.key === 'ArrowUp') {
                e.preventDefault();
                indiceSeleccionado = (indiceSeleccionado - 1 + items.length) % items.length;
                actualizarFocoSugerencia(items);
            }
            else if (e.key === 'Enter') {
                e.preventDefault();
                if (indiceSeleccionado > -1 && items[indiceSeleccionado]) {
                    items[indiceSeleccionado].click();
                } else {
                    const term = buscador.value.toLowerCase().trim();
                    const p = PRODUCTOS_DB.find(prod =>
                        (prod.barcode && prod.barcode.toLowerCase() === term) ||
                        (prod.name && prod.name.toLowerCase() === term)
                    );
                    if (p) seleccionarProducto(p);
                }
                sugerenciasDiv.style.display = 'none';
            }
        });
    }

    // --- BUSCADOR DE CLIENTES ---
    const buscadorCli = document.getElementById('buscarClientePos');
    if (buscadorCli) {
        buscadorCli.addEventListener('input', async (e) => {
            const term = e.target.value.trim();
            const sugCli = document.getElementById('sugerenciasClientes');
            if (term.length < 2) { sugCli.style.display = 'none'; return; }

            try {
                const res = await apiFetch(`${API_CUSTOMERS}`);
                const todos = await res.json();
                const filtrados = todos.filter(c =>
                    c.name.toLowerCase().includes(term.toLowerCase())
                ).slice(0, 5);

                sugCli.innerHTML = filtrados.map(c => `
                    <button type="button" class="list-group-item list-group-item-action small" onclick='seleccionarCliente(${JSON.stringify(c)})'>
                        <div class="d-flex justify-content-between">
                            <span>${c.name}</span>
                            <span class="${c.currentBalance >= c.creditLimit ? 'text-danger' : 'text-success'} fw-bold">$${c.currentBalance.toFixed(2)}</span>
                        </div>
                    </button>
                `).join('');
                sugCli.style.display = filtrados.length > 0 ? 'block' : 'none';
            } catch (err) { console.error("Error buscando clientes", err); }
        });
    }

    // Listeners de Interfaz
    const inputPagaCon = document.getElementById('pagaCon');
    if (inputPagaCon) inputPagaCon.addEventListener('input', calcularVuelto);

    const inputDesc = document.getElementById('inputDescuento');
    if (inputDesc) inputDesc.addEventListener('input', renderizarCarrito);

    const tipoDesc = document.getElementById('tipoDescuento');
    if (tipoDesc) tipoDesc.addEventListener('change', renderizarCarrito);

    // Atajos Globales (F12, F4, F2, F8, Escape)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'F12') { e.preventDefault(); finalizarVenta(); }
        if (e.key === 'F4') { e.preventDefault(); document.getElementById('pagaCon').focus(); }
        if (e.key === 'F2') { e.preventDefault(); cancelarVenta(); }
        if (e.key === 'Escape') {
            document.getElementById('buscadorVenta').focus();
            sugerenciasDiv.style.display = 'none';
            if(document.getElementById('sugerenciasClientes')) {
                document.getElementById('sugerenciasClientes').style.display = 'none';
            }
        }
        if (e.key === 'F8') { e.preventDefault(); agregarProductoManual(); }
    });
});

async function cargarInfoEmpresa() {
    try {
        const resp = await apiFetch('/admin/my-company/profile');

        if (resp.ok) {
            DATOS_EMPRESA = await resp.json();
            // Guardamos en ambas claves para sincronizar con perfil.js
            localStorage.setItem('config_comercio', JSON.stringify(DATOS_EMPRESA));
            localStorage.setItem('DATOS_EMPRESA', JSON.stringify(DATOS_EMPRESA));
            console.log("Datos cargados de la API:", DATOS_EMPRESA.name);
        } else {
            const dataGuardada = localStorage.getItem('config_comercio') || localStorage.getItem('DATOS_EMPRESA');
            if (dataGuardada) {
                DATOS_EMPRESA = JSON.parse(dataGuardada);
                console.log("Datos recuperados localmente para el vendedor");
            }
        }
    } catch (err) {
        console.error("Error de conexión:", err);
    }
}

function actualizarFocoSugerencia(items) {
    items.forEach((item, index) => {
        if (index === indiceSeleccionado) {
            item.classList.add('active');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('active');
        }
    });
}

async function cargarProductos() {
    try {
        const res = await apiFetch(API_PRODUCTS);

        if (res.status === 403) {
            console.warn("Error 403: El vendedor no tiene permiso para ver productos.");
            return;
        }

        if (res.status === 401) {
            localStorage.removeItem('baezpos_token');
            window.location.href = 'login.html?error=expired';
            return;
        }

        if (!res.ok) throw new Error("Error al obtener productos");

        PRODUCTOS_DB = await res.json();

    } catch (err) {
        console.error("Error de conexión:", err);
    }
}

async function buscarYAgregar(query) {
    if (!query) return;
    const term = query.toLowerCase().trim();

    if (typeof PRODUCTOS_DB === 'undefined') {
        PRODUCTOS_DB = [];
    }

    const p = PRODUCTOS_DB.find(prod =>
        (prod.barcode && prod.barcode.toLowerCase() === term) ||
        (prod.name && prod.name.toLowerCase().includes(term))
    );

    if (p) {
        seleccionarProducto(p);
    } else {
        if (/^\d{7,14}$/.test(term)) {
            try {
                const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${term}.json?fields=product_name,product_name_es,brands,quantity`);
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
                    }).then((result) => {
                        if (result.isConfirmed) {
                            window.location.href = `productos.html?nuevoCodigo=${term}&nuevoNombre=${encodeURIComponent(nombreFinalParaEnviar)}`;
                        }
                    });
                    return;
                }
            } catch (err) {
                console.error("Error fetch API:", err);
            }
        }

        Swal.fire({
            icon: 'error',
            title: 'No encontrado',
            text: `El código ${term} no existe. ¿Cargar manual?`,
            showCancelButton: true,
            confirmButtonText: 'Cargar ahora'
        }).then((result) => {
            if (result.isConfirmed) {
                window.location.href = `productos.html?nuevoCodigo=${term}`;
            }
        });
    }

    const buscador = document.getElementById('buscadorVenta');
    if (buscador) { buscador.value = ''; buscador.focus(); }
}

function renderizarCarrito() {
    const body = document.getElementById('carritoBody');
    if (!body) return;
    body.innerHTML = '';
    SUBTOTAL_VENTA = 0;

    CARRITO.forEach((item, index) => {
        const subtotal = item.price * item.cantidad;
        SUBTOTAL_VENTA += subtotal;

        const precioFmt = item.price.toLocaleString('es-AR', { minimumFractionDigits: 2 });
        const subtotalFmt = subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 });

        body.innerHTML += `
            <tr class="animate__animated animate__fadeIn">
                <td>
                    <div class="fw-bold">${item.name}</div>
                    <small class="text-muted text-uppercase" style="font-size: 0.7rem;">${item.barcode || 'S/C'}</small>
                </td>
                <td class="text-center">
                    <div class="btn-group btn-group-sm border rounded-pill overflow-hidden bg-white shadow-sm">
                        <button class="btn btn-light border-0 px-2" onclick="cambiarCant(${index}, -1)"><i class="bi bi-dash"></i></button>
                        <span class="btn btn-white border-0 disabled fw-bold" style="min-width: 45px">${item.cantidad}</span>
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

    document.getElementById('totalVenta').innerText = `$${totalConDescuento.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

    calcularVuelto();

    const activeEl = document.activeElement.id;
    if (activeEl !== 'pagaCon' && activeEl !== 'inputDescuento' && activeEl !== 'buscarClientePos') {
        document.getElementById('buscadorVenta').focus();
    }
}

function calcularVuelto() {
    let totalText = document.getElementById('totalVenta').innerText;
    let totalLimpio = totalText.replace('$', '').replace(/\./g, '').replace(',', '.');
    const total = parseFloat(totalLimpio) || 0;

    const pagaCon = parseFloat(document.getElementById('pagaCon').value) || 0;
    const vuelto = pagaCon - total;
    const txtVuelto = document.getElementById('vueltoVenta');

    if (txtVuelto) {
        if (vuelto < 0 || pagaCon === 0) {
            txtVuelto.innerText = "$0.00";
            txtVuelto.classList.remove('text-success');
            txtVuelto.classList.add('text-danger');
        } else {
            txtVuelto.innerText = `$${vuelto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            txtVuelto.classList.remove('text-danger');
            txtVuelto.classList.add('text-success');
        }
    }
}

function cambiarCant(index, valor) {
    const item = CARRITO[index];
    const original = PRODUCTOS_DB.find(p => p.id === item.id);
    if (valor > 0 && original && item.cantidad >= original.stock) {
        if(sndError) sndError.play().catch(()=>{});
        Swal.fire({ icon: 'info', title: 'Límite alcanzado', text: 'No hay más unidades en stock', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
        return;
    }
    item.cantidad += valor;
    if (item.cantidad <= 0) CARRITO.splice(index, 1);
    renderizarCarrito();
}

function eliminarItem(index) {
    CARRITO.splice(index, 1);
    renderizarCarrito();
}

function setMetodo(metodo, el) {
    METODO_PAGO = metodo;
    document.querySelectorAll('.metodo-pago').forEach(d => d.classList.remove('active'));
    el.classList.add('active');

    const divCli = document.getElementById('seccionClienteFiado');
    const divVue = document.getElementById('seccionVuelto');

    if (metodo === 'CUENTA_CORRIENTE') {
        divCli.classList.remove('d-none');
        divVue.classList.add('d-none');
        setTimeout(() => document.getElementById('buscarClientePos').focus(), 100);
    } else {
        divCli.classList.add('d-none');
        divVue.classList.remove('d-none');
        clienteSeleccionado = null;
        const infoCli = document.getElementById('infoClienteSeleccionado');
        if (infoCli) infoCli.classList.add('d-none');

        if (metodo === 'TRANSFERENCIA') {
            const total = document.getElementById('totalVenta').innerText.replace('$', '');
            document.getElementById('pagaCon').value = total;
            calcularVuelto();
        } else {
            document.getElementById('pagaCon').value = '';
            document.getElementById('vueltoVenta').innerText = "$0.00";
        }
        document.getElementById('buscadorVenta').focus();
    }
}

function cancelarVenta() {
    if (CARRITO.length === 0) return;
    CARRITO = [];
    document.getElementById('pagaCon').value = '';
    const inputDesc = document.getElementById('inputDescuento');
    if (inputDesc) inputDesc.value = '';
    renderizarCarrito();
}

async function finalizarVenta() {
    if (sistemaBloqueado) {
        mostrarCartelBloqueo();
        return;
    }

    if (CARRITO.length === 0) {
        Swal.fire('Carrito vacío', 'Agrega productos para cobrar', 'info');
        return;
    }

    const totalRaw = document.getElementById('totalVenta').innerText;
    const totalLimpio = totalRaw.replace('$', '').replace(/\./g, '').replace(',', '.').trim();
    let total = parseFloat(totalLimpio);

    const pagaConInput = document.getElementById('pagaCon').value;
    const pagaCon = parseFloat(pagaConInput.replace(/\./g, '').replace(',', '.')) || 0;

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
            html: `Monto base: <b>$${total.toLocaleString('es-AR', {minimumFractionDigits: 2})}</b><br><br>Ingresa el % de recargo (ej: 0, 10, 15, 20, 39):`,
            input: 'number',
            inputValue: 0,
            inputAttributes: { min: 0, max: 200, step: 'any' },
            showCancelButton: true,
            confirmButtonText: 'Confirmar y Cobrar',
            cancelButtonText: 'Cancelar',
            preConfirm: (value) => {
                if (value < 0) Swal.showValidationMessage('El porcentaje no puede ser negativo');
                return parseFloat(value) || 0;
            }
        });

        if (!isConfirmed) return;

        porcentajeRecargo = recargoIngresado;

        if (porcentajeRecargo > 0) {
            montoRecargo = (total * porcentajeRecargo) / 100;
            total = total + montoRecargo;
        }

        if ((clienteSeleccionado.currentBalance + total) > clienteSeleccionado.creditLimit) {
            Swal.fire({
                icon: 'error',
                title: 'Límite de Crédito Excedido',
                text: `El cliente no puede deber más de $${clienteSeleccionado.creditLimit}. Con recargo el total queda en $${total.toFixed(2)}`
            });
            return;
        }
    }

    // LECTURA DEL ESTADO FISCAL
    const configLocal = JSON.parse(localStorage.getItem('config_comercio') || localStorage.getItem('DATOS_EMPRESA') || '{}');
    const esFiscalActivo = (DATOS_EMPRESA && (DATOS_EMPRESA.hasTaxData === true || DATOS_EMPRESA.hasTaxData === "true")) ||
                           (configLocal.hasTaxData === true || configLocal.hasTaxData === "true");

    const saleRequestDTO = {
        items: CARRITO.map(item => ({
            productId: item.id,
            quantity: item.cantidad,
            price: item.price
        })),
        total: total,
        discount: DESCUENTO_FINAL_PESOS || 0,
        surcharge: montoRecargo,
        surchargeRate: porcentajeRecargo,
        paymentMethod: METODO_PAGO,
        customerId: clienteSeleccionado ? clienteSeleccionado.id : null,
        isFiscal: esFiscalActivo // 👈 AQUÍ ESTÁ EL CAMBIO CLAVE
    };

    const btnFinalizar = document.querySelector('.btn-primary.btn-lg.w-100.py-3');
    if (btnFinalizar) btnFinalizar.disabled = true;

    try {
        const res = await apiFetch(API_BASE, {
            method: 'POST',
            body: JSON.stringify(saleRequestDTO)
        });

        let data = {};
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            data = await res.json();
        }

        if (res.ok) {
            ULTIMA_VENTA_EXITOSA = data;
            if(window.sndSuccess) window.sndSuccess.play().catch(()=>{});

            Swal.fire({
                icon: 'success',
                title: '¡Venta Realizada!',
                text: METODO_PAGO === 'CUENTA_CORRIENTE'
                    ? `Cargado $${total.toLocaleString('es-AR', {minimumFractionDigits: 2})} a la cuenta de ${clienteSeleccionado.name} (Op #${data.id})`
                    : `Operación #${data.id || 'Exitosa'}`,
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

            CARRITO = [];
            clienteSeleccionado = null;
            const infoCli = document.getElementById('infoClienteSeleccionado');
            if(infoCli) infoCli.classList.add('d-none');
            document.getElementById('pagaCon').value = '';
            const inputDesc = document.getElementById('inputDescuento');
            if (inputDesc) inputDesc.value = '';

            renderizarCarrito();
            await cargarProductos();

        } else {
            throw new Error(data.message || "Error al procesar la venta");
        }
    } catch (err) {
        console.error("Error en finalizarVenta:", err);
        if(window.sndError) window.sndError.play().catch(()=>{});
        Swal.fire('Error', err.message, 'error');
    } finally {
        if (btnFinalizar) btnFinalizar.disabled = false;
        const buscador = document.getElementById('buscadorVenta');
        if(buscador) buscador.focus();
    }
}

function reimprimirUltimoTicket() {
    if (!ULTIMA_VENTA_EXITOSA) {
        Swal.fire('Atención', 'No hay ninguna venta reciente en esta sesión para reimprimir.', 'info');
        return;
    }

    if (typeof imprimirTicket === 'function') {
        imprimirTicket(ULTIMA_VENTA_EXITOSA);
    } else {
        console.error("La función imprimirTicket no está definida.");
    }
}

// --- FUNCIÓN DE IMPRESIÓN DINÁMICA ---
async function imprimirTicket(venta) {
    const ventana = window.open('', 'PRINT', 'height=700,width=400');

    if (!ventana) {
        Swal.fire({ icon: 'warning', title: 'Popup bloqueado', text: 'Permití las ventanas emergentes.' });
        return;
    }

    const infoEmpresa = (typeof DATOS_EMPRESA !== 'undefined' && DATOS_EMPRESA !== null) ? DATOS_EMPRESA : {};
    const fiscalActivo = infoEmpresa.hasTaxData === true || infoEmpresa.hasTaxData === "true";

    const nombreLocal = (infoEmpresa.name || venta.companyName || 'MI NEGOCIO').toUpperCase();
    const direccionLocal = infoEmpresa.address || venta.companyAddress || '';
    const telefonoLocal = infoEmpresa.phone || venta.companyPhone || '';
    const emailLocal = infoEmpresa.email || venta.companyEmail || '';
    const mensajePie = infoEmpresa.ticketMessage || venta.ticketMessage || '¡Gracias por su compra!';

    const cuitLocal = infoEmpresa.taxId || infoEmpresa.cuit || venta.companyCuit || '';
    const iibbLocal = infoEmpresa.iibb || venta.companyIibb || '';
    const condicionIva = (infoEmpresa.condicionIva || 'RESPONSABLE MONOTRIBUTO').toUpperCase();

    let inicioActividades = infoEmpresa.inicioActividades || infoEmpresa.inicioAct || '';
    if (inicioActividades.includes('-')) {
        const parts = inicioActividades.split('-');
        inicioActividades = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    const tipoComprobante = fiscalActivo
        ? (venta.tipoComprobante || infoEmpresa.tipoComprobante || 'FACTURA C').toUpperCase()
        : (venta.tipoComprobante || 'TICKET INTERNO');

    const cae = venta.cae || infoEmpresa.caePrueba || '';
    const caeVto = venta.caeVto || infoEmpresa.caeVtoPrueba || '';

    const nroComprobante = venta.nroComprobante || `00001-${String(venta.id || 1).padStart(8, '0')}`;
    const fechaVenta = venta.saleDate ? new Date(venta.saleDate).toLocaleString('es-AR') : new Date().toLocaleString('es-AR');
    const metodoPago = (venta.paymentMethod || 'EFECTIVO').replace('_', ' ').toUpperCase();

    const nombreCliente = (venta.clienteNombre || 'CONSUMIDOR FINAL').toUpperCase();
    const cuitCliente = venta.clienteCuit || '';

    // Parseo seguro de montos para evitar concatenaciones o NaN
    const recargoMonto = parseFloat(venta.surcharge) || 0;
    const recargoPorcentaje = parseFloat(venta.surchargeRate) || 0;
    const descuentoMonto = parseFloat(venta.discount) || 0;
    const totalFinal = parseFloat(venta.total) || 0;
    const subtotalProductos = (totalFinal - recargoMonto) + descuentoMonto;

    let qrText = '';
    if (fiscalActivo && cae) {
        // Limpieza de CUIT para evitar Integer Overflow de JavaScript
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
        qrText = `https://www.afip.gob.ar/fe/qr/?p=${btoa(JSON.stringify(datosQr))}`;
    }

    ventana.document.write(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>Ticket #${venta.id || ''}</title>
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css">
                <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
                    @page { margin: 0; }
                    body {
                        font-family: 'Inter', sans-serif;
                        width: 58mm;
                        padding: 10px;
                        margin: 0;
                        color: #1e293b;
                        background: #fff;
                        line-height: 1.2;
                    }
                    .center { text-align: center; }
                    .ticket-header { border-bottom: 1px dashed #cbd5e1; padding-bottom: 8px; margin-bottom: 8px; }
                    .business-name { font-weight: 900; font-size: 15px; margin: 3px 0; text-transform: uppercase; color: #0f172a; }
                    .small-info { font-size: 10px; color: #475569; margin: 2px 0; }
                    .fiscal-header { font-size: 9px; color: #334155; text-align: left; background: #f8fafc; padding: 4px; border-radius: 4px; margin-top: 5px; }
                    .item-row { display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 4px; }
                    .item-name { font-weight: 700; text-transform: uppercase; flex: 1; padding-right: 5px; }
                    .line { border-top: 1px dashed #cbd5e1; margin: 8px 0; }
                    .total-container {
                        border-top: 2px solid #0f172a;
                        margin-top: 8px;
                        padding-top: 8px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .total-label { font-weight: 900; font-size: 16px; color: #0f172a; }
                    .total-amount { font-weight: 900; font-size: 16px; color: #2563eb; }
                    .arca-container { border-top: 1px solid #0f172a; margin-top: 12px; padding-top: 10px; text-align: center; }
                    .arca-logo { font-weight: 900; font-size: 12px; letter-spacing: 2px; color: #0f172a; margin-bottom: 5px; }
                    .qr-box { display: flex; justify-content: center; margin: 8px 0; }
                    .cae-info { font-size: 9px; font-weight: 700; text-align: left; color: #0f172a; margin-top: 4px; }
                    .ticket-footer { text-align: center; margin-top: 10px; border-top: 1px dashed #cbd5e1; padding-top: 10px; }
                    .msg-pie { font-style: italic; font-size: 11px; color: #475569; margin-bottom: 8px; display: block; }
                    .payment-method { font-weight: 800; font-size: 10px; color: #0f172a; border: 1px solid #e2e8f0; padding: 3px; display: inline-block; border-radius: 4px; margin-bottom: 8px; }
                    .powered { font-size: 7px; font-weight: 700; opacity: 0.4; margin-top: 8px; letter-spacing: 1px; }
                    i.bi-shop { display: block; font-size: 20px; color: #2563eb; opacity: 0.5; }
                </style>
            </head>
            <body>
                <div class="ticket-header center">
                    <i class="bi bi-shop"></i>
                    <div class="business-name">${nombreLocal}</div>
                    ${direccionLocal ? `<div class="small-info">${direccionLocal}</div>` : ''}
                    ${telefonoLocal ? `<div class="small-info">Tel: ${telefonoLocal}</div>` : ''}
                    ${emailLocal ? `<div class="small-info">Email: ${emailLocal}</div>` : ''}

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
                    ${venta.items ? venta.items.map(item => {
                        const subtotalItem = item.subtotal !== undefined ? item.subtotal : ((item.price || item.precio || 0) * item.quantity);
                        return `
                            <div class="item-row">
                                <span class="item-name">${item.quantity}x ${(item.productName || item.nombre || '').toUpperCase()}</span>
                                <span style="font-weight:700;">$${parseFloat(subtotalItem).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                            </div>
                        `;
                    }).join('') : ''}

                    ${descuentoMonto > 0 ? `
                        <div class="line"></div>
                        <div class="item-row" style="color: #dc3545;">
                            <span class="item-name">DESCUENTO:</span>
                            <span>-$${descuentoMonto.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                        </div>
                    ` : ''}

                    ${recargoMonto > 0 ? `
                        <div class="line"></div>
                        <div class="item-row" style="color: #6c757d; font-size: 9px;">
                            <span class="item-name">SUBTOTAL PRODUCTOS:</span>
                            <span>$${subtotalProductos.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                        </div>
                        <div class="item-row" style="color: #d97706; font-weight: bold;">
                            <span class="item-name">RECARGO LIBRETA (${recargoPorcentaje}%):</span>
                            <span>+$${recargoMonto.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                        </div>
                    ` : ''}

                    <div class="total-container">
                        <span class="total-label">TOTAL</span>
                        <span class="total-amount">$${totalFinal.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
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
                    if (${Boolean(fiscalActivo && cae)}) {
                        new QRCode(document.getElementById("qrcode"), {
                            text: "${qrText}",
                            width: 90,
                            height: 90,
                            colorDark : "#000000",
                            colorLight : "#ffffff",
                            correctLevel : QRCode.CorrectLevel.M
                        });
                    }

                    setTimeout(() => {
                        window.print();
                        window.close();
                    }, 500);
                </script>
            </body>
        </html>
    `);
    ventana.document.close();
}

// Captura de foco sin interrupciones para inputs habilitados
document.addEventListener('keydown', (e) => {
    const buscador = document.getElementById('buscadorVenta');
    const idActivo = document.activeElement ? document.activeElement.id : '';

    const inputsLibres = ['pagaCon', 'inputDescuento', 'buscarClientePos', 'manualNombreBusqueda', 'manualPrecio'];

    if (!inputsLibres.includes(idActivo)) {
        if (e.key.length === 1 && !e.ctrlKey && !e.altKey) {
            if (document.activeElement !== buscador && buscador) {
                buscador.focus();
            }
        }
    }
});

function agregarProductoManual() {
    const productosSueltos = PRODUCTOS_DB.filter(p => parseFloat(p.price) === 0);

    if (productosSueltos.length === 0) {
        Swal.fire('Atención', 'No hay productos configurados con precio $0.', 'warning');
        return;
    }

    // Listener nombrado para poder removerlo limpiamente al cerrar el modal
    let onClickFuera = null;

    Swal.fire({
        title: '<i class="bi bi-box-seam me-2"></i>Venta de Sueltos',
        html: `
            <div class="position-relative text-start">
                <label class="small text-muted mb-1">Buscar producto:</label>
                <input id="manualNombreBusqueda" class="swal2-input m-0 w-100" placeholder="Ej: Pan, Queso..." autocomplete="off">
                <div id="sugerenciasSueltos" class="list-group position-absolute w-100 shadow-lg d-none"
                     style="z-index: 9999; max-height: 200px; overflow-y: auto;">
                </div>
            </div>

            <div class="text-start mt-3">
                <label class="small text-muted mb-1">Monto total ($):</label>
                <input id="manualPrecio" type="number" class="swal2-input m-0 w-100" placeholder="0.00" step="any" min="0">
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Agregar',
        didOpen: () => {
            const inputBusqueda = document.getElementById('manualNombreBusqueda');
            const inputPrecio = document.getElementById('manualPrecio');
            const contenedorSugerencias = document.getElementById('sugerenciasSueltos');

            inputBusqueda.focus();

            inputBusqueda.addEventListener('input', () => {
                const search = inputBusqueda.value.toUpperCase().trim();
                contenedorSugerencias.innerHTML = '';

                if (search.length > 0) {
                    const filtrados = productosSueltos.filter(p => p.name.toUpperCase().includes(search));

                    if (filtrados.length > 0) {
                        contenedorSugerencias.classList.remove('d-none');
                        filtrados.forEach(p => {
                            const btn = document.createElement('button');
                            btn.type = 'button';
                            btn.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center py-2';
                            btn.style.fontSize = '0.9rem';
                            btn.innerHTML = `
                                <span><i class="bi bi-tag-fill me-2 text-primary"></i>${p.name.toUpperCase()}</span>
                                <span class="badge bg-light text-dark border">${p.categoryName || 'Suelto'}</span>
                            `;
                            btn.onclick = () => {
                                inputBusqueda.value = p.name.toUpperCase();
                                contenedorSugerencias.classList.add('d-none');
                                inputPrecio.focus();
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

            // Evitar acumular listeners en el documento
            onClickFuera = (e) => {
                if (e.target !== inputBusqueda && !contenedorSugerencias.contains(e.target)) {
                    contenedorSugerencias.classList.add('d-none');
                }
            };
            document.addEventListener('click', onClickFuera);

            inputPrecio.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') Swal.clickConfirm();
            });
        },
        willClose: () => {
            // Se remueve el listener cuando el modal se destruye
            if (onClickFuera) {
                document.removeEventListener('click', onClickFuera);
            }
        },
        preConfirm: () => {
            const nombre = document.getElementById('manualNombreBusqueda').value.toUpperCase().trim();
            const precio = parseFloat(document.getElementById('manualPrecio').value);
            const pEncontrado = productosSueltos.find(p => p.name.toUpperCase() === nombre);

            if (!nombre) return Swal.showValidationMessage('Escribí o seleccioná un producto');
            if (isNaN(precio) || precio <= 0) return Swal.showValidationMessage('Ingresá un monto válido mayor a 0');

            const comodin = PRODUCTOS_DB.find(p => p.barcode === 'MANUAL');

            return {
                id: pEncontrado ? pEncontrado.id : (comodin ? comodin.id : 0),
                name: nombre,
                price: precio
            };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            CARRITO.push({
                id: result.value.id,
                name: result.value.name,
                price: result.value.price,
                barcode: 'SUELTO',
                cantidad: 1
            });
            renderizarCarrito();
            if (window.sndSuccess) window.sndSuccess.play().catch(() => {});
        }
    });
}

function renderizarSugerencias(productos) {
    const div = document.getElementById('listaSugerencias');
    if (productos.length === 0) {
        div.style.display = 'none';
        return;
    }

    div.innerHTML = productos.map(p => `
        <button type="button"
                class="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-3 border-bottom shadow-sm"
                onclick='seleccionarProducto(${JSON.stringify(p)})'
                style="cursor: pointer;">
            <div class="text-start">
                <div class="fw-bold text-primary mb-0">
                    <i class="bi bi-box-seam me-2"></i>${p.name.toUpperCase()}
                </div>
                <small class="text-muted">
                    Stock: <span class="badge ${p.stock > 5 ? 'bg-light text-dark' : 'bg-danger'}">${p.stock}</span>
                    | Cód: ${p.barcode || 'S/C'}
                    ${p.categoryName ? ' | <i class="bi bi-tag small"></i> ' + p.categoryName : ''}
                </small>
            </div>
            <div class="text-end">
                <span class="h6 mb-0 fw-bold text-dark">$${p.price.toFixed(2)}</span>
            </div>
        </button>
    `).join('');

    div.style.display = 'block';
}

function seleccionarProducto(p) {
    if (sistemaBloqueado) return;

    const itemEnCarrito = CARRITO.find(item => item.id === p.id);
    const cantActual = itemEnCarrito ? itemEnCarrito.cantidad : 0;

    if (p.stock <= cantActual) {
        if(sndError) sndError.play().catch(()=>{});
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
        if(sndSuccess) sndSuccess.play().catch(()=>{});

        if (itemEnCarrito) {
            itemEnCarrito.cantidad++;
        } else {
            CARRITO.push({
                id: p.id,
                name: p.name,
                price: p.price,
                barcode: p.barcode,
                cantidad: 1
            });
        }
        renderizarCarrito();
    }

    const buscador = document.getElementById('buscadorVenta');
    const sugerencias = document.getElementById('listaSugerencias');

    buscador.value = '';
    if (sugerencias) sugerencias.style.display = 'none';

    setTimeout(() => buscador.focus(), 50);
}

function seleccionarCliente(c) {
    clienteSeleccionado = c;
    document.getElementById('idClienteSeleccionado').value = c.id;
    document.getElementById('nombreClientePos').innerText = c.name;
    document.getElementById('saldoClientePos').innerText = `$${c.currentBalance.toFixed(2)}`;
    document.getElementById('infoClienteSeleccionado').classList.remove('d-none');
    document.getElementById('sugerenciasClientes').style.display = 'none';
    document.getElementById('buscarClientePos').value = '';

    document.getElementById('buscadorVenta').focus();
}

async function chequearEstadoLicencia() {
    try {
        const res = await apiFetch(API_STATUS);
        if (!res || !res.ok) return;

        const data = await res.json();

        // Si la suscripción venció o la empresa está inactiva
        if (data.vencido === true || data.active === false) {
            sistemaBloqueado = true;
            mostrarCartelBloqueo(data.message || "Tu suscripción/licencia se encuentra vencida.");
        } else {
            sistemaBloqueado = false;
        }
    } catch (err) {
        console.error("Error al verificar estado de la licencia SaaS:", err);
    }
}

function mostrarCartelBloqueo() {
    sistemaBloqueado = true;

    Swal.fire({
        title: '¡SISTEMA SUSPENDIDO!',
        html: `Tu suscripción ha vencido o tu cuenta está inactiva.<br><b>Contacta a Alexander Báez para habilitar el servicio.</b>`,
        icon: 'error',
        allowOutsideClick: false,
        allowEscapeKey: false,
        confirmButtonColor: '#25D366',
        confirmButtonText: '<i class="bi bi-whatsapp"></i> Hablar con Alexander',
    }).then((result) => {
        if (result.isConfirmed) {
            window.open(`https://wa.me/${MI_WHATSAPP}?text=Hola Alexander, mi sistema aparece como suspendido.`);
            setTimeout(mostrarCartelBloqueo, 500);
        }
    });

    CARRITO = [];
    renderizarCarrito();
}

setInterval(chequearEstadoLicencia, 30000);