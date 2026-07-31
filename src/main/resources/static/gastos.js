/**
 * BÁEZ POS - MÓDULO DE GESTIÓN DE EGRESOS (SaaS)
 * Alexander Baez - 2026
 */

// ==========================================
// 1. ESTADO GLOBAL Y CONFIGURACIÓN
// ==========================================
let gastosGlobales = [];

// Formateador de moneda optimizado para reutilización
const fmtARS = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2
});

// ==========================================
// 2. INICIALIZACIÓN Y EVENT LISTENERS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    cargarGastos();

    const formGasto = document.getElementById('formGasto');
    if (formGasto) {
        formGasto.addEventListener('submit', guardarGasto);
    }

    // Filtros dinámicos en tiempo real
    const filtroTexto = document.getElementById('filtroTexto');
    const filtroCategoria = document.getElementById('filtroCategoria');
    const filtroMetodo = document.getElementById('filtroMetodoPago');

    if (filtroTexto) filtroTexto.addEventListener('input', aplicarFiltros);
    if (filtroCategoria) filtroCategoria.addEventListener('change', aplicarFiltros);
    if (filtroMetodo) filtroMetodo.addEventListener('change', aplicarFiltros);
});

// ==========================================
// 3. CAPTURA Y CARGA DE DATOS (API)
// ==========================================
async function cargarGastos() {
    try {
        const res = await apiFetch('/expenses');
        if (!res || !res.ok) throw new Error("Error al obtener la lista de gastos del servidor.");

        gastosGlobales = await res.json();
        renderizarGastos(gastosGlobales);
        calcularResumenGastos(gastosGlobales);
    } catch (err) {
        console.error("Error cargando gastos:", err);
        const tbody = document.getElementById('listaGastos');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger p-5"><i class="bi bi-exclamation-triangle fs-3 d-block mb-2"></i> Error al conectar con el servidor backend.</td></tr>';
        }
    }
}

// ==========================================
// 4. FILTRADO Y RENDERIZADO VISUAL
// ==========================================
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
}

function limpiarFiltros() {
    if (document.getElementById('filtroTexto')) document.getElementById('filtroTexto').value = '';
    if (document.getElementById('filtroCategoria')) document.getElementById('filtroCategoria').value = '';
    if (document.getElementById('filtroMetodoPago')) document.getElementById('filtroMetodoPago').value = '';
    renderizarGastos(gastosGlobales);
}

function renderizarGastos(gastos) {
    const tbody = document.getElementById('listaGastos');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!gastos || gastos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center p-5 text-muted"><i class="bi bi-inbox fs-3 d-block mb-2"></i>No se encontraron registros de egresos con los filtros seleccionados.</td></tr>';
        return;
    }

    // Usar fragmento para minimizar reflows del DOM
    const fragment = document.createDocumentFragment();

    gastos.sort((a, b) => b.id - a.id).forEach(g => {
        const fechaObj = g.date ? new Date(g.date) : new Date();
        const fechaFormateada = fechaObj.toLocaleDateString('es-AR', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }) + ' hs';

        // Sanitización contra inyección XSS
        const descSegura = (g.description || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const refSegura = (g.reference || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");

        // Estilos para categorías
        let badgeClass = 'bg-light text-dark border';
        if (g.category === 'PROVEEDOR') badgeClass = 'bg-primary-subtle text-primary border-primary-subtle';
        else if (g.category === 'SERVICIOS') badgeClass = 'bg-warning-subtle text-warning-emphasis border-warning-subtle';
        else if (g.category === 'LOGISTICA') badgeClass = 'bg-info-subtle text-info-emphasis border-info-subtle';
        else if (g.category === 'SUELDOS') badgeClass = 'bg-success-subtle text-success-emphasis border-success-subtle';
        else if (g.category === 'MANTENIMIENTO') badgeClass = 'bg-secondary-subtle text-secondary-emphasis border-secondary-subtle';
        else if (g.category === 'CAJA_CHICA') badgeClass = 'bg-danger-subtle text-danger-emphasis border-danger-subtle';

        // Etiquetas amigables para medios de pago
        let metodoTexto = 'Efectivo Caja';
        let iconoMetodo = 'bi-cash-coin text-success';
        if (g.paymentMethod === 'TRANSFERENCIA') {
            metodoTexto = 'Transferencia';
            iconoMetodo = 'bi-bank text-primary';
        } else if (g.paymentMethod === 'TARJETA') {
            metodoTexto = 'Tarjeta Débito';
            iconoMetodo = 'bi-credit-card text-info';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="ps-3 text-muted small">${fechaFormateada}</td>
            <td>
                <span class="fw-bold text-dark d-block">${descSegura}</span>
                ${refSegura ? `<small class="text-muted"><i class="bi bi-receipt me-1"></i>Ref: ${refSegura}</small>` : ''}
            </td>
            <td><span class="badge ${badgeClass} px-2 py-1" style="font-size: 11px;">${g.category}</span></td>
            <td><span class="small text-secondary"><i class="bi ${iconoMetodo} me-1"></i>${metodoTexto}</span></td>
            <td class="text-end fw-bold text-danger fs-6">
                -${fmtARS.format(g.amount || 0)}
            </td>
            <td class="text-center pe-3">
                <button class="btn btn-sm btn-light border" title="Eliminar registro" onclick="confirmarEliminarGasto(${g.id})">
                    <i class="bi bi-trash text-danger"></i>
                </button>
            </td>
        `;
        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
}

// ==========================================
// 5. CÁLCULO DE KPIs FINANCIEROS
// ==========================================
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
    if (document.getElementById('txtCantidadGastos')) document.getElementById('txtCantidadGastos').innerText = `${lista.length} operaciones registradas`;
    if (document.getElementById('txtTotalProveedores')) document.getElementById('txtTotalProveedores').innerText = fmtARS.format(totalProveedores);
    if (document.getElementById('txtTotalOperativos')) document.getElementById('txtTotalOperativos').innerText = fmtARS.format(totalOperativos);
}

// ==========================================
// 6. ACCIONES DE GUARDADO Y ELIMINACIÓN
// ==========================================
async function guardarGasto(e) {
    e.preventDefault();

    const montoInput = document.getElementById('montoGasto').value;
    // Reemplaza coma por punto por si el usuario escribe en formato local
    const monto = parseFloat(montoInput.replace(',', '.'));

    if (isNaN(monto) || monto <= 0) {
        return Swal.fire({
            icon: 'warning',
            title: 'Monto inválido',
            text: 'Por favor, ingresá un monto numérico superior a cero.',
            confirmButtonColor: '#dc3545'
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
                title: 'Egreso registrado correctamente',
                showConfirmButton: false, timer: 2000, timerProgressBar: true
            });

            document.getElementById('formGasto').reset();

            const modalEl = document.getElementById('modalNuevoGasto');
            if (modalEl) {
                const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
                modalInstance.hide();
            }

            cargarGastos();
        } else {
            let errorMsg = "No se pudo procesar el registro del egreso.";
            try {
                const errorData = await res.json();
                errorMsg = errorData.message || errorData.error || errorMsg;
            } catch (e) { /* Fallback al default */ }
            throw new Error(errorMsg);
        }
    } catch (err) {
        Swal.fire({
            icon: 'error', title: 'Error al registrar', text: err.message, confirmButtonColor: '#dc3545'
        });
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = originalText;
    }
}

async function confirmarEliminarGasto(id) {
    const result = await Swal.fire({
        title: '¿Eliminar este registro?',
        text: "Esta acción ajustará las métricas y el balance de caja correspondiente de forma irreversible.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            const res = await apiFetch(`/expenses/${id}`, { method: 'DELETE' });

            if (res && res.ok) {
                Swal.fire({
                    toast: true, position: 'top-end', icon: 'success',
                    title: 'Gasto eliminado con éxito',
                    showConfirmButton: false, timer: 2000
                });
                cargarGastos();
            } else {
                let errorMsg = 'No se pudo eliminar el gasto.';
                try {
                    const errData = await res.json();
                    errorMsg = errData.message || errData.error || errorMsg;
                } catch (e) { /* Ignorar parse error */ }
                Swal.fire('Error', errorMsg, 'error');
            }
        } catch (err) {
            console.error("Error al eliminar gasto:", err);
            Swal.fire('Error de conexión', 'No se pudo conectar con el servidor.', 'error');
        }
    }
}

// Exposición en el scope global para los eventos en el HTML
window.confirmarEliminarGasto = confirmarEliminarGasto;
window.limpiarFiltros = limpiarFiltros;