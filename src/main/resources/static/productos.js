/**
 * BÁEZ POS - GESTIÓN DE INVENTARIO (SAAS MULTITENANT)
 */

const API_BASE = '/products';
const API_CAT = '/categories';

let PRODUCTOS_LOCAL = [];

document.addEventListener('DOMContentLoaded', () => {
    // 1. Carga inicial de datos multitenant
    listarProductos();
    cargarCategorias();

    const form = document.getElementById('formProducto');
    if (form) form.addEventListener('submit', guardarProducto);

    // 2. Receptor de Scanner / Búsqueda Externa vía URL
    const urlParams = new URLSearchParams(window.location.search);
    const nuevoCodigo = urlParams.get('nuevoCodigo');
    const nuevoNombre = urlParams.get('nuevoNombre');

    if (nuevoCodigo) {
        prepararFormulario();
        setTimeout(() => {
            const inputCodigo = document.getElementById('prodBarcode');
            const inputNombre = document.getElementById('prodNombre');

            if (inputCodigo) inputCodigo.value = nuevoCodigo;

            if (inputNombre && nuevoNombre) {
                const nombreLimpio = decodeURIComponent(nuevoNombre).trim().toUpperCase();
                inputNombre.value = nombreLimpio;
            }

            const inputCosto = document.getElementById('prodCosto');
            if (inputCosto) inputCosto.focus();

            window.history.replaceState({}, document.title, window.location.pathname);
        }, 600);
    }
});

// --- CATEGORÍAS ---
async function cargarCategorias() {
    try {
        const res = await apiFetch(API_CAT);
        if (!res || !res.ok) return [];
        const categorias = await res.json();

        const selectModal = document.getElementById('prodCategoria');
        const selectFiltro = document.getElementById('filtroCategoria');

        let options = '<option value="">Seleccionar...</option>';
        let optionsFiltro = '<option value="">Todas las categorías</option>';

        categorias.forEach(c => {
            const opt = `<option value="${c.id}">${c.name}</option>`;
            options += opt;
            optionsFiltro += opt;
        });

        if (selectModal) selectModal.innerHTML = options;
        if (selectFiltro) selectFiltro.innerHTML = optionsFiltro;

        return categorias;
    } catch (err) {
        console.error("Error al cargar categorías SaaS:", err);
        return [];
    }
}

async function abrirModalCategoria() {
    const categorias = await cargarCategorias();

    let listadoHtml = `
        <div class="list-group list-group-flush mb-3" style="max-height: 200px; overflow-y: auto;">
            ${categorias.length === 0 ? '<div class="text-center p-3 text-muted">Sin categorías registradas</div>' : ''}
            ${categorias.map(c => `
                <div class="list-group-item d-flex justify-content-between align-items-center bg-light rounded-3 mb-2 border-0">
                    <span class="fw-bold" id="cat-label-${c.id}">${c.name}</span>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary border-0" onclick="prepararEdicionCat(${c.id}, '${c.name.replace(/'/g, "\\'")}')"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-outline-danger border-0" onclick="eliminarCategoria(${c.id})"><i class="bi bi-trash"></i></button>
                    </div>
                </div>
            `).join('')}
        </div>
        <div class="p-3 bg-primary bg-opacity-10 rounded-4">
            <label class="form-label fw-bold small text-primary">NUEVA / EDITAR CATEGORÍA</label>
            <input type="hidden" id="editCatId" value="">
            <input type="text" id="swalCatNombre" class="form-control mb-2" placeholder="Nombre de categoría">
            <button class="btn btn-primary w-100 shadow-sm fw-bold" id="btnGuardarCat" onclick="guardarCategoria()">Confirmar Guardar</button>
        </div>
    `;

    Swal.fire({
        title: 'Gestión de Categorías',
        html: listadoHtml,
        showConfirmButton: false,
        showCloseButton: true,
        customClass: { popup: 'rounded-4' },
        didOpen: () => {
            const input = document.getElementById('swalCatNombre');
            if (input) {
                setTimeout(() => input.focus(), 100);
                input.addEventListener('keydown', (e) => e.stopPropagation());
            }
        }
    });
}

function prepararEdicionCat(id, nombre) {
    document.getElementById('editCatId').value = id;
    document.getElementById('swalCatNombre').value = nombre;
    document.getElementById('btnGuardarCat').innerText = "Actualizar Nombre";
    document.getElementById('swalCatNombre').focus();
}

async function guardarCategoria() {
    const id = document.getElementById('editCatId').value;
    const nombreInput = document.getElementById('swalCatNombre');
    const nombre = nombreInput ? nombreInput.value.trim() : "";

    if (!nombre) return Swal.fire('Atención', "Escribe un nombre para la categoría", 'warning');

    try {
        const url = id ? `${API_CAT}/${id}` : API_CAT;
        const metodo = id ? 'PUT' : 'POST';

        const res = await apiFetch(url, {
            method: metodo,
            body: JSON.stringify({ name: nombre, description: "" })
        });

        if (res && res.ok) {
            await cargarCategorias();
            Swal.fire({
                icon: 'success',
                title: id ? 'Actualizada' : 'Creada',
                timer: 1000,
                showConfirmButton: false
            }).then(() => {
                abrirModalCategoria();
            });
        } else if (res) {
            const errorData = await res.json().catch(() => ({}));
            Swal.fire('Error', errorData.message || 'Error en la operación', 'error');
        }
    } catch (err) {
        console.error("Error guardando categoría:", err);
    }
}

async function eliminarCategoria(id) {
    const confirm = await Swal.fire({
        title: '¿Eliminar categoría?',
        text: "Si tiene productos asociados, no podrá eliminarse.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, borrar',
        cancelButtonText: 'Cancelar'
    });

    if (confirm.isConfirmed) {
        try {
            const res = await apiFetch(`${API_CAT}/${id}`, { method: 'DELETE' });
            if (res && res.ok) {
                await cargarCategorias();
                abrirModalCategoria();
            } else {
                Swal.fire('Error', 'La categoría tiene productos asociados o no existe.', 'error');
            }
        } catch (err) {
            console.error("Error al borrar categoría:", err);
        }
    }
}

// --- PRODUCTOS ---
async function listarProductos() {
    try {
        const res = await apiFetch(API_BASE);
        if (!res || !res.ok) return;
        PRODUCTOS_LOCAL = await res.json();
        renderizarTabla(PRODUCTOS_LOCAL);
    } catch (err) {
        console.error("Error al listar productos:", err);
    }
}

function renderizarTabla(lista) {
    const tabla = document.getElementById('listaProductos');
    if (!tabla) return;
    tabla.innerHTML = '';

    if (!lista || lista.length === 0) {
        tabla.innerHTML = '<tr><td colspan="7" class="text-center p-5 text-muted">No se encontraron productos en el inventario.</td></tr>';
        return;
    }

    lista.forEach(p => {
        const catName = p.categoryName || 'S/C';
        const stockClase = p.stock <= p.minStock ? 'bg-danger bg-opacity-10 text-danger' : 'bg-success bg-opacity-10 text-success';
        const costo = parseFloat(p.cost) || 0;
        const precio = parseFloat(p.price) || 0;
        const margen = costo > 0 ? (((precio - costo) / costo) * 100).toFixed(0) : 0;

        tabla.innerHTML += `
            <tr>
                <td class="ps-4">
                    <p class="product-name">${p.name}</p>
                    <span class="product-code"><i class="bi bi-barcode me-1"></i>${p.barcode || 'Sin código'}</span>
                </td>
                <td><span class="badge bg-light text-dark border-0 p-2 px-3 rounded-pill">${catName}</span></td>
                <td class="text-muted">$${costo.toFixed(2)}</td>
                <td class="fw-bold text-dark">$${precio.toFixed(2)}</td>
                <td><span class="text-success small fw-bold">+${margen}%</span></td>
                <td><span class="badge ${stockClase} p-2 px-3 rounded-pill" style="font-size: 0.8rem;">${p.stock} un.</span></td>
                <td class="text-end pe-4">
                    <div class="btn-group shadow-sm rounded-3">
                        <button class="btn btn-white btn-sm border-end" title="Etiqueta" onclick="imprimirEtiqueta(${p.id})"><i class="bi bi-printer text-primary"></i></button>
                        <button class="btn btn-white btn-sm border-end" title="Editar" onclick="editarProducto(${p.id})"><i class="bi bi-pencil-square text-primary"></i></button>
                        <button class="btn btn-white btn-sm" title="Eliminar" onclick="eliminarProducto(${p.id})"><i class="bi bi-trash3 text-danger"></i></button>
                    </div>
                </td>
            </tr>`;
    });
}

function filtrarProductos() {
    const texto = document.getElementById('buscador').value.toLowerCase().trim();
    const catId = document.getElementById('filtroCategoria').value;

    const filtrados = PRODUCTOS_LOCAL.filter(p => {
        const coincideTexto = p.name.toLowerCase().includes(texto) || (p.barcode && p.barcode.toLowerCase().includes(texto));
        const coincideCat = catId === "" || p.categoryId == catId;
        return coincideTexto && coincideCat;
    });
    renderizarTabla(filtrados);
}

async function guardarProducto(e) {
    e.preventDefault();
    const id = document.getElementById('prodId').value;

    const nombre = document.getElementById('prodNombre').value.trim();
    const categoriaId = document.getElementById('prodCategoria').value;
    const barcode = document.getElementById('prodBarcode').value.trim();

    if (!nombre) return Swal.fire('Error', 'El nombre es obligatorio', 'warning');
    if (!categoriaId) return Swal.fire('Error', 'Selecciona una categoría', 'warning');

    const body = {
        name: nombre,
        description: "Producto registrado",
        barcode: barcode || (nombre.substring(0, 5).toUpperCase() + Date.now().toString().slice(-5)),
        cost: parseFloat(document.getElementById('prodCosto').value) || 0,
        price: parseFloat(document.getElementById('prodPrecio').value) || 0,
        stock: parseInt(document.getElementById('prodStock').value) || 0,
        minStock: parseInt(document.getElementById('prodMinStock').value) || 0,
        categoryId: parseInt(categoriaId)
    };

    try {
        const res = await apiFetch(id ? `${API_BASE}/${id}` : API_BASE, {
            method: id ? 'PUT' : 'POST',
            body: JSON.stringify(body)
        });

        if (res && res.ok) {
            const modalEl = document.getElementById('modalProducto');
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) modalInstance.hide();

            await listarProductos();
            Swal.fire({ icon: 'success', title: id ? 'Actualizado' : 'Creado', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
        } else if (res) {
            const errorData = await res.json().catch(() => ({}));
            Swal.fire('Error', errorData.message || 'Error al guardar el producto.', 'error');
        }
    } catch (err) {
        console.error("Error al guardar producto:", err);
    }
}

function prepararFormulario() {
    document.getElementById('formProducto').reset();
    document.getElementById('prodId').value = '';
    document.getElementById('modalTitulo').innerText = "Nuevo Producto";
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalProducto')).show();
}

function editarProducto(id) {
    const p = PRODUCTOS_LOCAL.find(prod => prod.id === id);
    if (!p) return;

    document.getElementById('prodId').value = p.id;
    document.getElementById('prodNombre').value = p.name || '';
    document.getElementById('prodBarcode').value = p.barcode || '';
    document.getElementById('prodCosto').value = p.cost || 0;
    document.getElementById('prodPrecio').value = p.price || 0;
    document.getElementById('prodStock').value = p.stock || 0;
    document.getElementById('prodMinStock').value = p.minStock || 0;

    const selectCat = document.getElementById('prodCategoria');
    if (selectCat) selectCat.value = p.categoryId || "";

    document.getElementById('modalTitulo').innerText = "Editar Producto";
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalProducto')).show();
}

async function eliminarProducto(id) {
    const result = await Swal.fire({
        title: '¿Mover a la papelera?',
        text: "Podrás restaurarlo en cualquier momento",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, borrar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            const res = await apiFetch(`${API_BASE}/${id}`, { method: 'DELETE' });
            if (res && res.ok) {
                await listarProductos();
                Swal.fire('Eliminado', 'Producto movido a la papelera', 'success');
            }
        } catch (err) {
            console.error("Error eliminando producto:", err);
        }
    }
}

async function abrirPapelera() {
    try {
        const res = await apiFetch(`${API_BASE}/deleted`);
        if (!res || !res.ok) return;
        const borrados = await res.json();
        const tabla = document.getElementById('listaBorrados');
        tabla.innerHTML = '';

        if (!borrados || borrados.length === 0) {
            tabla.innerHTML = '<tr><td colspan="2" class="text-center p-4 text-muted">La papelera está vacía</td></tr>';
        } else {
            borrados.forEach(p => {
                tabla.innerHTML += `
                    <tr>
                        <td class="ps-3"><b>${p.name}</b><br><small class="text-muted">${p.barcode || 'S/C'}</small></td>
                        <td class="text-end pe-3">
                            <button class="btn btn-sm btn-success fw-bold" onclick="restaurarProducto(${p.id})">Restaurar</button>
                        </td>
                    </tr>`;
            });
        }
        bootstrap.Modal.getOrCreateInstance(document.getElementById('modalPapelera')).show();
    } catch (err) {
        console.error("Error leyendo papelera:", err);
    }
}

async function restaurarProducto(id) {
    try {
        const res = await apiFetch(`${API_BASE}/${id}/activate`, { method: 'PATCH' });
        if (res && res.ok) {
            const modalEl = document.getElementById('modalPapelera');
            const instance = bootstrap.Modal.getInstance(modalEl);
            if (instance) instance.hide();

            await listarProductos();
            Swal.fire('Restaurado', 'El producto vuelve a estar activo', 'success');
        }
    } catch (err) {
        console.error("Error restaurando producto:", err);
    }
}

// --- TECLADO Y ESCANEO ---
document.addEventListener('keydown', (e) => {
    const buscador = document.getElementById('buscador');
    const modalProducto = document.getElementById('modalProducto');
    const inputCodigo = document.getElementById('prodBarcode');

    if (modalProducto && modalProducto.classList.contains('show')) {
        if (e.key === 'Enter' && document.activeElement === inputCodigo) {
            e.preventDefault();
            document.getElementById('prodNombre').focus();
        }
    } else {
        if (/[0-9]/.test(e.key) && document.activeElement !== buscador) {
            if (buscador) buscador.focus();
        }
        if (e.key === 'Enter' && document.activeElement === buscador) {
            filtrarProductos();
        }
    }
});

// --- IMPRESIÓN DE ETIQUETA ---
function imprimirEtiqueta(id) {
    const p = PRODUCTOS_LOCAL.find(prod => prod.id === id);
    if (!p || !p.barcode) return Swal.fire('Atención', 'El producto no tiene un código de barras registrado', 'warning');

    const ventana = window.open('', 'PRINT', 'height=400,width=600');
    const precio = parseFloat(p.price) || 0;

    ventana.document.write(`
        <html>
            <head>
                <title>Etiqueta - ${p.name}</title>
                <style>
                    body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; }
                    .etiqueta {
                        width: 50mm; height: 25mm; border: 1px solid #ddd;
                        display: flex; flex-direction: column; align-items: center; justify-content: center;
                        padding: 4px; box-sizing: border-box; text-align: center;
                    }
                    .nombre { font-size: 10px; font-family: sans-serif; font-weight: bold; margin-bottom: 2px; }
                    .barcode { width: 100%; max-height: 40px; }
                    .precio { font-size: 13px; font-family: sans-serif; font-weight: bold; margin-top: 2px; }
                </style>
            </head>
            <body>
                <div class="etiqueta">
                    <div class="nombre">${p.name.toUpperCase()}</div>
                    <svg id="barcode-svg" class="barcode"></svg>
                    <div class="precio">$${precio.toFixed(2)}</div>
                </div>
                <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
                <script>
                    window.onload = function() {
                        JsBarcode("#barcode-svg", "${p.barcode}", {
                            format: "CODE128", width: 1.5, height: 40, displayValue: true, fontSize: 10
                        });
                        setTimeout(() => { window.print(); window.close(); }, 500);
                    };
                </script>
            </body>
        </html>
    `);
    ventana.document.close();
}

// Previene bloqueos de foco con modales de Bootstrap & SweetAlert2
if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
    bootstrap.Modal.prototype._enforceFocus = function() {};
}

document.addEventListener('focusin', (e) => {
    if (e.target.closest(".swal2-container")) {
        e.stopImmediatePropagation();
    }
}, true);