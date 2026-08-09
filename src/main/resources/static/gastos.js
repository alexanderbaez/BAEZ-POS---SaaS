/**
 * BÁEZ POS - MÓDULO DE GESTIÓN DE EGRESOS (SaaS)
 * Archivo Refactorizado Senior Full-Stack
 */

let gastosGlobales = [];
let debounceTimer = null;

// Formateador estándar de moneda local (ARS)
const fmtARS = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2
});

document.addEventListener('DOMContentLoaded', () => {
    cargarGastos();

    const formGasto = document.getElementById('formGasto');
    if (formGasto) {
        formGasto.addEventListener('submit', guardarGasto);
    }

    // Regla UI: Si no es Efectivo, desactivar por defecto 'Descontar de Caja'
    const metodoPagoGasto = document.getElementById('metodoPagoGasto');
    const deductFromBox = document.getElementById('deductFromBox');

    if (metodoPagoGasto && deductFromBox) {
        metodoPagoGasto.addEventListener('change', (e) => {
            const esEfectivo = e.target.value === 'EFECTIVO_CAJA';
            deductFromBox.checked = esEfectivo;
        });
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
        const matchTexto = (g.description || '').toLowerCase().includes(texto) || (g.reference || '').toLowerCase().includes(texto);
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

    const fragment = document.createDocumentFragment();

    // Ordenar de más reciente a más antiguo
    const listaOrdenada = [...gastos].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    listaOrdenada.forEach(g => {
        const fechaObj = g.date ? new Date(g.date) : new Date();
        const fechaFormateada = fechaObj.toLocaleDateString('es-AR', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
        const horaFormateada = fechaObj.toLocaleTimeString('es-AR', {
            hour: '2-digit', minute: '2-digit'
        });

        const descSegura = escapeHTML(g.description || 'Sin concepto');
        const refSegura = escapeHTML(g.reference || '');

        let badgeCatClass = 'bg-slate-100 text-slate-700 border';
        if (g.category === 'PROVEEDOR') badgeCatClass = 'bg-primary-subtle text-primary border border-primary-subtle';
        else if (g.category === 'SERVICIOS') badgeCatClass = 'bg-warning-subtle text-warning-emphasis border border-warning-subtle';
        else if (g.category === 'LOGISTICA') badgeCatClass = 'bg-info-subtle text-info-emphasis border border-info-subtle';
        else if (g.category === 'SUELDOS') badgeCatClass = 'bg-success-subtle text-success-emphasis border border-success-subtle';
        else if (g.category === 'CAJA_CHICA') badgeCatClass = 'bg-danger-subtle text-danger border border-danger-subtle';

        let metodoTexto = 'Efectivo';
        let iconoMetodo = 'bi-cash-stack text-success';
        if (g.paymentMethod === 'TRANSFERENCIA') {
            metodoTexto = 'Transferencia';
            iconoMetodo = 'bi-bank text-primary';
        } else if (g.paymentMethod === 'TARJETA') {
            metodoTexto = 'Tarjeta';
            iconoMetodo = 'bi-credit-card text-info';
        }

        const badgeCaja = g.deductFromBox
            ? '<span class="badge bg-danger-subtle text-danger ms-1" style="font-size: 10px;" title="Descontado del turno de caja">-Caja</span>'
            : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="ps-3">
                <span class="d-block fw-semibold text-dark">${fechaFormateada}</span>
                <small class="text-muted" style="font-size: 0.75rem;">${horaFormateada} hs</small>
            </td>
            <td>
                <span class="fw-semibold text-dark d-block">${descSegura}</span>
                ${refSegura ? `<small class="text-muted"><i class="bi bi-receipt me-1"></i>Ref: ${refSegura}</small>` : ''}
            </td>
            <td><span class="badge ${badgeCatClass} px-2 py-1" style="font-size: 11px;">${g.category}</span></td>
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

    const btnGuardar = e.target.querySelector('button[type="submit"]');
    const originalText = btnGuardar.innerHTML;
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Guardando...';

    const nuevoGasto = {
        description: document.getElementById('descGasto').value.trim(),
        amount: monto,
        category: document.getElementById('catGasto').value,
        paymentMethod: document.getElementById('metodoPagoGasto').value,
        reference: document.getElementById('refComprobante').value.trim(),
        deductFromBox: document.getElementById('deductFromBox').checked,
        date: new Date().toISOString()
    };

    try {
        const res = await apiFetch('/expenses', {
            method: 'POST',
            body: JSON.stringify(nuevoGasto)
        });

        if (res && res.ok) {
            Swal.fire({
                toast: true, position: 'top-end', icon: 'success',
                title: 'Egreso asentado correctamente',
                showConfirmButton: false, timer: 2000, timerProgressBar: true
            });

            document.getElementById('formGasto').reset();

            const modalEl = document.getElementById('modalNuevoGasto');
            if (modalEl) {
                const modalInstance = bootstrap.Modal.getInstance(modalEl);
                if (modalInstance) modalInstance.hide();
            }

            cargarGastos();
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

// Helper para sanear HTML y prevenir XSS
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g,
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