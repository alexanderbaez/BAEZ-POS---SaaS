/**
 * BAEZ POS - MÓDULO DE GESTIÓN DE EGRESOS (SaaS Multi-tenant)
 * Alexander Baez - 2026
 */

let gastosGlobales = [];
let proveedoresDisponibles = [];
let debounceTimer = null;

// Formateador estándar de moneda local (ARS)
const fmtARS = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2
});

document.addEventListener('DOMContentLoaded', () => {
    cargarGastos();
    cargarProveedoresParaSelect();

    const formGasto = document.getElementById('formGasto');
    if (formGasto) {
        formGasto.addEventListener('submit', guardarGasto);
    }

    // Regla de Negocio UI: Actualizar feedback contextual según el medio de pago
    const metodoPagoGasto = document.getElementById('metodoPagoGasto');
    const deductFromBox = document.getElementById('deductFromBox');

    if (metodoPagoGasto && deductFromBox) {
        metodoPagoGasto.addEventListener('change', (e) => {
            actualizarEstadoDeductFromBox(e.target.value, deductFromBox);
        });

        // Ejecución inicial para el estado por defecto del select
        actualizarEstadoDeductFromBox(metodoPagoGasto.value, deductFromBox);
    }

    // Regla de Negocio UI: Mostrar/Ocultar campos de Proveedor según categoría
    const catGasto = document.getElementById('catGasto');
    if (catGasto) {
        catGasto.addEventListener('change', (e) => {
            toggleSeccionProveedor(e.target.value);
        });
        toggleSeccionProveedor(catGasto.value);
    }

    // Filtros con Debounce para optimizar re-renders
    const filtroTexto = document.getElementById('filtroTexto');
    const filtroCategoria = document.getElementById('filtroCategoria');
    const filtroMetodo = document.getElementById('filtroMetodoPago');

    if (filtroTexto) {
        filtroTexto.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(aplicarFiltros, 250);
        });
    }
    if (filtroCategoria) filtroCategoria.addEventListener('change', aplicarFiltros);
    if (filtroMetodo) filtroMetodo.addEventListener('change', aplicarFiltros);
});

/**
 * Carga los proveedores activos para el selector de compras a proveedores
 */
async function cargarProveedoresParaSelect() {
    try {
        const res = await apiFetch('/providers');
        if (res && res.ok) {
            proveedoresDisponibles = await res.json();
            poblarSelectProveedores();
        }
    } catch (e) {
        console.warn("No se pudieron precargar proveedores:", e);
    }
}

function poblarSelectProveedores() {
    const select = document.getElementById('provGasto');
    if (!select) return;
    select.innerHTML = '<option value="">-- Seleccionar Proveedor --</option>';
    proveedoresDisponibles.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        const saldo = parseFloat(p.currentBalance) || 0;
        opt.textContent = `${p.businessName} (Deuda: ${fmtARS.format(saldo)})`;
        select.appendChild(opt);
    });
}

function toggleSeccionProveedor(categoria) {
    const seccionProv = document.getElementById('seccionProveedor');
    const provGasto = document.getElementById('provGasto');
    if (!seccionProv) return;

    if (categoria === 'PROVEEDOR') {
        seccionProv.classList.remove('d-none');
        if (proveedoresDisponibles.length === 0) {
            cargarProveedoresParaSelect();
        } else {
            poblarSelectProveedores();
        }
    } else {
        seccionProv.classList.add('d-none');
        if (provGasto) provGasto.value = '';
        const nroFactura = document.getElementById('nroFacturaGasto');
        if (nroFactura) nroFactura.value = '';
    }
}

/**
 * Controla la accesibilidad, estado y feedback contextual del switch 'Descontar de Caja'
 */
function actualizarEstadoDeductFromBox(metodoSeleccionado, elementSwitch) {
    const esEfectivo = (metodoSeleccionado === 'EFECTIVO_CAJA' || metodoSeleccionado === 'EFECTIVO');
    const esCtaCte = (metodoSeleccionado === 'CUENTA_CORRIENTE');
    const lblAyuda = document.getElementById('lblAyudaDeduct');

    if (esCtaCte) {
        elementSwitch.checked = false;
        elementSwitch.disabled = true;
        if (lblAyuda) {
            lblAyuda.innerHTML = `<i class="bi bi-clock-history text-warning me-1"></i> <strong>Cuenta Corriente:</strong> No descuenta dinero de caja física. Se acumula automáticamente en el saldo deudor del proveedor.`;
            lblAyuda.className = "text-warning d-block mt-1 style-subtext";
        }
        return;
    }

    elementSwitch.disabled = false;

    if (lblAyuda) {
        if (esEfectivo) {
            lblAyuda.innerHTML = `Si está activo, se restará del <strong>Efectivo Físico en Caja</strong>. Desactivalo únicamente si fue abonado con fondos personales por fuera del negocio.`;
            lblAyuda.className = "text-muted d-block mt-1 style-subtext";
        } else {
            lblAyuda.innerHTML = `<i class="bi bi-info-circle-fill text-primary me-1"></i> Si está activo, se descontará del acumulado <strong>Digital (Transferencia/QR)</strong> del Dashboard. Desactivalo si el pago salió de una cuenta personal.`;
            lblAyuda.className = "text-primary d-block mt-1 style-subtext";
        }
    }
}

async function cargarGastos() {
    const tbody = document.getElementById('listaGastos');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center p-5">
                    <div class="spinner-border text-secondary spinner-border-sm me-2" role="status"></div>
                    <span class="text-muted">Cargando movimientos de gastos...</span>
                </td>
            </tr>`;
    }

    try {
        const res = await apiFetch('/expenses');
        if (!res || !res.ok) throw new Error("Error al comunicarse con la API de Gastos.");

        gastosGlobales = await res.json();
        renderizarGastos(gastosGlobales);
        calcularResumenGastos(gastosGlobales);
    } catch (err) {
        console.error("Error al cargar gastos:", err);
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-danger p-4">
                        <i class="bi bi-exclamation-triangle fs-4 d-block mb-2"></i>
                        No se pudieron obtener los datos. Verifique su conexión o autenticación.
                    </td>
                </tr>`;
        }
    }
}

function aplicarFiltros() {
    const texto = (document.getElementById('filtroTexto')?.value || '').toLowerCase().trim();
    const cat = document.getElementById('filtroCategoria')?.value || '';
    const metodo = document.getElementById('filtroMetodoPago')?.value || '';

    const filtrados = gastosGlobales.filter(g => {
        const matchTexto = (g.description || '').toLowerCase().includes(texto) ||
                           (g.reference || '').toLowerCase().includes(texto) ||
                           (g.invoiceNumber || '').toLowerCase().includes(texto);
        const matchCat = cat === '' || g.category === cat;
        const matchMetodo = metodo === '' || g.paymentMethod === metodo;
        return matchTexto && matchCat && matchMetodo;
    });

    renderizarGastos(filtrados);
    calcularResumenGastos(filtrados);
}

function limpiarFiltros() {
    if (document.getElementById('filtroTexto')) document.getElementById('filtroTexto').value = '';
    if (document.getElementById('filtroCategoria')) document.getElementById('filtroCategoria').value = '';
    if (document.getElementById('filtroMetodoPago')) document.getElementById('filtroMetodoPago').value = '';
    renderizarGastos(gastosGlobales);
    calcularResumenGastos(gastosGlobales);
}

function renderizarGastos(gastos) {
    const tbody = document.getElementById('listaGastos');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!gastos || gastos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center p-5 text-muted">
                    <i class="bi bi-inbox fs-3 d-block mb-1 text-slate-400"></i>
                    Sin registros de egresos para el criterio seleccionado.
                </td>
            </tr>`;
        return;
    }

    const mapaCategorias = {
        'PROVEEDOR': { label: 'Proveedor', class: 'bg-primary text-white' },
        'SERVICIOS': { label: 'Servicios', class: 'bg-warning text-dark' },
        'LOGISTICA': { label: 'Logística / Flete', class: 'bg-info text-dark' },
        'SUELDOS': { label: 'Sueldos', class: 'bg-success text-white' },
        'MANTENIMIENTO': { label: 'Mantenimiento', class: 'bg-secondary text-white' },
        'CAJA_CHICA': { label: 'Caja Chica', class: 'bg-danger text-white' },
        'VARIOS_RETIRO': { label: 'Retiro / Varios', class: 'bg-dark text-white' }
    };

    const fragment = document.createDocumentFragment();
    const listaOrdenada = [...gastos].sort((a, b) => parsearFecha(b.date) - parsearFecha(a.date));

    listaOrdenada.forEach(g => {
        const fechaObj = parsearFecha(g.date);
        const fechaFormateada = fechaObj.toLocaleDateString('es-AR', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
        const horaFormateada = fechaObj.toLocaleTimeString('es-AR', {
            hour: '2-digit', minute: '2-digit'
        });

        const descSegura = escapeHTML(g.description || 'Sin concepto');
        const refSegura = escapeHTML(g.reference || '');
        const invSegura = escapeHTML(g.invoiceNumber || '');

        const catKey = g.category ? g.category.toUpperCase() : 'VARIOS_RETIRO';
        const catConfig = mapaCategorias[catKey] || { label: g.category || 'Varios', class: 'bg-secondary text-white' };

        let metodoTexto = 'Efectivo';
        let iconoMetodo = 'bi-cash-stack text-success';
        if (g.paymentMethod === 'TRANSFERENCIA') {
            metodoTexto = 'Transferencia';
            iconoMetodo = 'bi-bank text-primary';
        } else if (g.paymentMethod === 'TARJETA') {
            metodoTexto = 'Tarjeta';
            iconoMetodo = 'bi-credit-card text-info';
        } else if (g.paymentMethod === 'CUENTA_CORRIENTE') {
            metodoTexto = 'Cta. Corriente';
            iconoMetodo = 'bi-journal-text text-danger';
        }

        // LÓGICA DE BADGES SEPARADOS (EFECTIVO VS DIGITAL VS CTA CTE)
        const esEfectivo = (g.paymentMethod === 'EFECTIVO_CAJA' || g.paymentMethod === 'EFECTIVO');
        const esCtaCte = (g.paymentMethod === 'CUENTA_CORRIENTE');
        let badgeCaja = '';

        if (esCtaCte) {
            badgeCaja = '<span class="badge bg-warning-subtle text-dark border border-warning ms-1" style="font-size: 10px;" title="Deuda con Proveedor"><i class="bi bi-clock-history me-1"></i>Deuda Cta. Cte</span>';
        } else if (g.deductFromBox) {
            if (esEfectivo) {
                badgeCaja = '<span class="badge bg-danger-subtle text-danger border border-danger-subtle ms-1" style="font-size: 10px;" title="Restado del efectivo físico en caja">Descuenta Caja (Efectivo)</span>';
            } else {
                badgeCaja = '<span class="badge bg-primary-subtle text-primary border border-primary-subtle ms-1" style="font-size: 10px;" title="Descontado del acumulado digital del Dashboard">Descuenta Digital</span>';
            }
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="ps-3">
                <span class="d-block fw-semibold text-dark">${fechaFormateada}</span>
                <small class="text-muted" style="font-size: 0.75rem;">${horaFormateada} hs</small>
            </td>
            <td>
                <span class="fw-semibold text-dark d-block">${descSegura}</span>
                <div class="d-flex flex-wrap gap-2 mt-1">
                    ${invSegura ? `<small class="text-primary fw-semibold"><i class="bi bi-file-earmark-text me-1"></i>Fac: ${invSegura}</small>` : ''}
                    ${refSegura ? `<small class="text-muted"><i class="bi bi-receipt me-1"></i>Ref: ${refSegura}</small>` : ''}
                </div>
            </td>
            <td>
                <span class="badge ${catConfig.class} px-2 py-1 fw-semibold" style="font-size: 11px;">
                    ${catConfig.label}
                </span>
            </td>
            <td>
                <span class="small text-secondary"><i class="bi ${iconoMetodo} me-1"></i>${metodoTexto}</span>
                ${badgeCaja}
            </td>
            <td class="text-end amount-num text-danger fs-6">
                -${fmtARS.format(g.amount || 0)}
            </td>
            <td class="text-center pe-3">
                <button class="btn btn-sm btn-light border text-danger" title="Eliminar este gasto" onclick="confirmarEliminarGasto(${g.id})">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
}

function calcularResumenGastos(gastos) {
    const lista = gastos || [];
    let total = 0, totalProveedores = 0, totalOperativos = 0;

    for (let i = 0; i < lista.length; i++) {
        const monto = parseFloat(lista[i].amount) || 0;
        total += monto;
        if (lista[i].category === 'PROVEEDOR') {
            totalProveedores += monto;
        } else {
            totalOperativos += monto;
        }
    }

    if (document.getElementById('txtTotalGastos')) document.getElementById('txtTotalGastos').innerText = fmtARS.format(total);
    if (document.getElementById('txtCantidadGastos')) document.getElementById('txtCantidadGastos').innerText = `${lista.length} registro(s)`;
    if (document.getElementById('txtTotalProveedores')) document.getElementById('txtTotalProveedores').innerText = fmtARS.format(totalProveedores);
    if (document.getElementById('txtTotalOperativos')) document.getElementById('txtTotalOperativos').innerText = fmtARS.format(totalOperativos);
}

async function guardarGasto(e) {
    e.preventDefault();

    const montoInput = document.getElementById('montoGasto').value;
    const monto = parseFloat(montoInput.replace(',', '.'));

    if (isNaN(monto) || monto <= 0) {
        return Swal.fire({
            icon: 'warning',
            title: 'Monto inválido',
            text: 'Ingrese un importe válido mayor a cero.',
            confirmButtonColor: '#e11d48'
        });
    }

    const categoria = document.getElementById('catGasto').value;
    const metodo = document.getElementById('metodoPagoGasto').value;
    const provIdVal = document.getElementById('provGasto')?.value;
    const providerId = (categoria === 'PROVEEDOR' && provIdVal) ? parseInt(provIdVal) : null;
    const invoiceNumber = document.getElementById('nroFacturaGasto')?.value.trim() || null;

    if (categoria === 'PROVEEDOR' && metodo === 'CUENTA_CORRIENTE' && !providerId) {
        return Swal.fire({
            icon: 'warning',
            title: 'Proveedor Requerido',
            text: 'Para registrar un gasto en Cuenta Corriente, debe seleccionar a qué proveedor se le sumará la deuda.',
            confirmButtonColor: '#e11d48'
        });
    }

    const btnGuardar = e.target.querySelector('button[type="submit"]');
    const originalText = btnGuardar.innerHTML;
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Guardando...';

    const elementDeduct = document.getElementById('deductFromBox');
    const deductFromBoxValue = (metodo === 'CUENTA_CORRIENTE') ? false : (elementDeduct ? elementDeduct.checked : true);

    const nuevoGasto = {
        description: document.getElementById('descGasto').value.trim(),
        amount: monto,
        category: categoria,
        paymentMethod: metodo,
        reference: document.getElementById('refComprobante').value.trim() || null,
        providerId: providerId,
        invoiceNumber: invoiceNumber,
        deductFromBox: deductFromBoxValue
    };

    try {
        const res = await apiFetch('/expenses', {
            method: 'POST',
            body: JSON.stringify(nuevoGasto)
        });

        if (res && (res.ok || res.status === 201)) {
            Swal.fire({
                toast: true, position: 'top-end', icon: 'success',
                title: 'Egreso asentado correctamente',
                showConfirmButton: false, timer: 2000, timerProgressBar: true
            });

            document.getElementById('formGasto').reset();

            if (metodoPagoGasto && elementDeduct) {
                actualizarEstadoDeductFromBox(metodoPagoGasto.value, elementDeduct);
            }
            toggleSeccionProveedor(document.getElementById('catGasto').value);

            const modalEl = document.getElementById('modalNuevoGasto');
            if (modalEl) {
                const modalInstance = bootstrap.Modal.getInstance(modalEl);
                if (modalInstance) modalInstance.hide();
            }

            cargarGastos();
            cargarProveedoresParaSelect();
        } else {
            let errorMsg = "Ocurrió un problema al asentar el gasto.";
            try {
                const errorData = await res.json();
                errorMsg = errorData.message || errorData.error || errorMsg;
            } catch (e) { /* Fallback */ }
            throw new Error(errorMsg);
        }
    } catch (err) {
        Swal.fire({
            icon: 'error', title: 'Error al registrar', text: err.message, confirmButtonColor: '#e11d48'
        });
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = originalText;
    }
}

async function confirmarEliminarGasto(id) {
    const result = await Swal.fire({
        title: '¿Eliminar egreso?',
        text: "Esta acción anulará el registro y recalculará los balances de caja.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e11d48',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            const res = await apiFetch(`/expenses/${id}`, { method: 'DELETE' });

            if (res && res.ok) {
                Swal.fire({
                    toast: true, position: 'top-end', icon: 'success',
                    title: 'Registro eliminado',
                    showConfirmButton: false, timer: 1800
                });
                cargarGastos();
            } else {
                Swal.fire('Error', 'No se pudo eliminar el registro seleccionado.', 'error');
            }
        } catch (err) {
            Swal.fire('Error de red', 'No hubo respuesta del servidor.', 'error');
        }
    }
}

function parsearFecha(fechaCadena) {
    if (!fechaCadena) return new Date();
    const fecha = new Date(fechaCadena);
    return isNaN(fecha.getTime()) ? new Date() : fecha;
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

window.confirmarEliminarGasto = confirmarEliminarGasto;
window.limpiarFiltros = limpiarFiltros;