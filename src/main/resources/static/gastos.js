// ==========================================
// 1. CONFIGURACIÓN Y VARIABLES GLOBALES
// ==========================================
const API_EXPENSES = '/expenses';

// ==========================================
// 2. INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    cargarGastos();

    const formGasto = document.getElementById('formGasto');
    if (formGasto) {
        formGasto.addEventListener('submit', guardarGasto);
    }
});

// ==========================================
// 3. LÓGICA DE DATOS (API)
// ==========================================

async function cargarGastos() {
    try {
        const res = await apiFetch(API_EXPENSES);
        if (!res.ok) throw new Error("Error al obtener la lista de gastos");

        const gastos = await res.json();
        renderizarGastos(gastos);
        calcularResumenGastos(gastos);
    } catch (err) {
        console.error("Error cargando gastos:", err);
        const tbody = document.getElementById('listaGastos');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger p-4"><i class="bi bi-exclamation-triangle me-2"></i> Error al conectar con el servidor.</td></tr>';
        }
    }
}

function renderizarGastos(gastos) {
    const tbody = document.getElementById('listaGastos');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!gastos || gastos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center p-5 text-muted">No hay gastos registrados en este período.</td></tr>';
        return;
    }

    gastos.sort((a, b) => b.id - a.id).forEach(g => {
        const fechaObj = g.date ? new Date(g.date) : new Date();
        const fechaFormateada = fechaObj.toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) + ' hs';

        let badgeClass = 'bg-light text-dark border';
        if (g.category === 'PROVEEDOR') badgeClass = 'bg-primary-subtle text-primary border-primary';
        if (g.category === 'SERVICIOS') badgeClass = 'bg-warning-subtle text-warning-emphasis border-warning';
        if (g.category === 'SUELDOS') badgeClass = 'bg-info-subtle text-info-emphasis border-info';
        if (g.category === 'MANTENIMIENTO') badgeClass = 'bg-secondary-subtle text-secondary-emphasis border-secondary';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="ps-4 text-muted" style="font-size: 13px;">${fechaFormateada}</td>
            <td class="fw-bold text-dark text-uppercase">${g.description}</td>
            <td><span class="badge ${badgeClass}" style="font-size: 11px;">${g.category}</span></td>
            <td class="text-end fw-bold text-danger" style="font-size: 15px;">
                -$${(g.amount || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </td>
            <td class="text-center pe-4">
                <button class="btn btn-sm btn-light border" title="Eliminar gasto" onclick="confirmarEliminarGasto(${g.id})">
                    <i class="bi bi-trash text-danger"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function calcularResumenGastos(gastos) {
    const total = (gastos || []).reduce((acc, g) => acc + (parseFloat(g.amount) || 0), 0);
    const txtTotal = document.getElementById('txtTotalGastos');
    if (txtTotal) {
        txtTotal.innerText = `$${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
    }
}

async function guardarGasto(e) {
    e.preventDefault();

    const montoInput = document.getElementById('montoGasto');
    const descInput = document.getElementById('descGasto');
    const catInput = document.getElementById('catGasto');

    const monto = parseFloat(montoInput.value);

    if (isNaN(monto) || monto <= 0) {
        return Swal.fire({
            icon: 'warning',
            title: 'Monto inválido',
            text: 'Por favor, ingresá un monto mayor a cero.',
            confirmButtonColor: '#dc3545'
        });
    }

    const btnGuardar = e.target.querySelector('button[type="submit"]');
    const originalText = btnGuardar.innerHTML;
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...';

    const nuevoGasto = {
        description: descInput.value.trim(),
        amount: monto,
        category: catInput.value,
        date: new Date().toISOString()
    };

    try {
        const res = await apiFetch(API_EXPENSES, {
            method: 'POST',
            body: JSON.stringify(nuevoGasto)
        });

        if (res.ok) {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Gasto registrado correctamente',
                showConfirmButton: false,
                timer: 2000,
                timerProgressBar: true
            });

            document.getElementById('formGasto').reset();

            const modalEl = document.getElementById('modalNuevoGasto');
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) modalInstance.hide();

            cargarGastos();
        } else {
            const errorData = await res.json();
            throw new Error(errorData.message || "No se pudo procesar el registro.");
        }
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Error al guardar',
            text: err.message,
            confirmButtonColor: '#dc3545'
        });
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = originalText;
    }
}

async function confirmarEliminarGasto(id) {
    const result = await Swal.fire({
        title: '¿Eliminar registro de gasto?',
        text: "Esta acción descontará el gasto y actualizará la caja diaria.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            const res = await apiFetch(`${API_EXPENSES}/${id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                Swal.fire('Eliminado', 'El gasto ha sido eliminado.', 'success');
                cargarGastos();
            } else {
                const errData = await res.json();
                Swal.fire('Error', errData.message || 'No se pudo eliminar el gasto.', 'error');
            }
        } catch (err) {
            Swal.fire('Error de conexión', 'No se pudo conectar con el servidor.', 'error');
        }
    }
}