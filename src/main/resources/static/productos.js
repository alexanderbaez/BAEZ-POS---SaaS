/**
 * BÁEZ POS - GESTIÓN DE INVENTARIO (SAAS MULTITENANT)
 */

// Rutas relativas del módulo
const ENDPOINT_PRODUCTS = '/products';
const ENDPOINT_CATEGORIES = '/categories';

// Estado global local
let PRODUCTOS_LOCAL = [];
let PRODUCTOS_FILTRADOS = [];
let paginaActual = 1;
const LIMITE_POR_PAGINA = 20;

// Formateador de moneda reutilizable
const fmtARS = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2
});

// Helper para generar un código de barras 100% numérico de 12 dígitos
function generarCodigoInterno() {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(100 + Math.random() * 900);
    return `20${timestamp}${random}`;
}

// ==========================================
// 1. INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    listarProductos();
    cargarCategorias();

    const form = document.getElementById('formProducto');
    if (form) form.addEventListener('submit', guardarProducto);

    // Eventos de búsqueda y filtrado
    const buscador = document.getElementById('buscador');
    const filtroCat = document.getElementById('filtroCategoria');

    if (buscador) buscador.addEventListener('input', filtrarProductos);
    if (filtroCat) filtroCat.addEventListener('change', filtrarProductos);

    // Receptor de Scanner / Búsqueda Externa vía URL
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

// ==========================================
// 2. GESTIÓN DE CATEGORÍAS
// ==========================================
async function cargarCategorias() {
    try {
        const res = await apiFetch(ENDPOINT_CATEGORIES);
        if (!res || !res.ok) return [];
        const categorias = await res.json();

        const selectModal = document.getElementById('prodCategoria');
        const selectFiltro = document.getElementById('filtroCategoria');

        let options = '<option value="">Seleccionar...</option>';
        let optionsFiltro = '<option value="">Todas las categorías</option>';

        categorias.forEach(c => {
            const nameSeguro = (c.name || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const opt = `<option value="${c.id}">${nameSeguro}</option>`;
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
            ${categorias.map(c => {
                const nameSeguro = (c.name || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
                const nameEscapado = (c.name || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                return `
                <div class="list-group-item d-flex justify-content-between align-items-center bg-light rounded-3 mb-2 border-0">
                    <span class="fw-bold" id="cat-label-${c.id}">${nameSeguro}</span>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary border-0" onclick="prepararEdicionCat(${c.id}, '${nameEscapado}')"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-outline-danger border-0" onclick="eliminarCategoria(${c.id})"><i class="bi bi-trash"></i></button>
                    </div>
                </div>`;
            }).join('')}
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
    if (document.getElementById('editCatId')) document.getElementById('editCatId').value = id;
    if (document.getElementById('swalCatNombre')) document.getElementById('swalCatNombre').value = nombre;
    if (document.getElementById('btnGuardarCat')) document.getElementById('btnGuardarCat').innerText = "Actualizar Nombre";
    if (document.getElementById('swalCatNombre')) document.getElementById('swalCatNombre').focus();
}

async function guardarCategoria() {
    const id = document.getElementById('editCatId')?.value;
    const nombreInput = document.getElementById('swalCatNombre');
    const nombre = nombreInput ? nombreInput.value.trim() : "";

    if (!nombre) return Swal.fire('Atención', "Escribe un nombre para la categoría", 'warning');

    try {
        const url = id ? `${ENDPOINT_CATEGORIES}/${id}` : ENDPOINT_CATEGORIES;
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
            const res = await apiFetch(`${ENDPOINT_CATEGORIES}/${id}`, { method: 'DELETE' });
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

// ==========================================
// UTILS & HELPERS DE PRESENTACIÓN
// ==========================================
function formatStockDisplay(stock, isFractional) {
    const val = parseFloat(stock) || 0;
    if (isFractional) {
        if (val < 1 && val > 0) {
            const gramos = Math.round(val * 1000);
            return `${gramos} grs.`;
        }
        return `${val.toFixed(3).replace(/\.?0+$/, '')} kg.`;
    }
    return `${Math.floor(val)} un.`;
}

// ==========================================
// ==========================================
// 3. GESTIÓN DE PRODUCTOS Y PAGINACIÓN
// ==========================================
let totalPaginasBackend = 1;
let totalElementosBackend = 0;
let debounceBuscarTimer = null;

async function listarProductos(pagina = 0) {
    try {
        const res = await apiFetch(`${ENDPOINT_PRODUCTS}?page=${pagina}&size=${LIMITE_POR_PAGINA}&sort=name,asc`);
        if (!res || !res.ok) return;

        const data = await res.json();

        if (data && Array.isArray(data.content)) {
            PRODUCTOS_LOCAL = data.content;
            PRODUCTOS_FILTRADOS = [...PRODUCTOS_LOCAL];
            paginaActual = data.number + 1;
            totalPaginasBackend = data.totalPages || 1;
            totalElementosBackend = data.totalElements || 0;
        } else if (Array.isArray(data)) {
            // Fallback compatibilidad
            PRODUCTOS_LOCAL = data;
            PRODUCTOS_FILTRADOS = [...PRODUCTOS_LOCAL];
            paginaActual = 1;
            totalPaginasBackend = 1;
            totalElementosBackend = data.length;
        }

        renderizarTabla(PRODUCTOS_FILTRADOS);
        const inicio = (paginaActual - 1) * LIMITE_POR_PAGINA;
        const fin = inicio + PRODUCTOS_FILTRADOS.length;
        renderizarControlesPaginacion(totalElementosBackend, totalPaginasBackend, inicio, fin);
    } catch (err) {
        console.error("Error al listar productos:", err);
    } finally {
        if (typeof ocultarPantallaDeCarga === 'function') {
            ocultarPantallaDeCarga();
        }
    }
}

function filtrarProductos() {
    clearTimeout(debounceBuscarTimer);
    debounceBuscarTimer = setTimeout(async () => {
        const texto = (document.getElementById('buscador')?.value || '').trim();
        const catId = document.getElementById('filtroCategoria')?.value || '';

        if (!texto && !catId) {
            listarProductos(0);
            return;
        }

        try {
            const url = texto ? `${ENDPOINT_PRODUCTS}/search?q=${encodeURIComponent(texto)}&limit=100` : `${ENDPOINT_PRODUCTS}?page=0&size=100&sort=name,asc`;
            const res = await apiFetch(url);
            if (!res || !res.ok) return;

            let lista = await res.json();
            if (lista && Array.isArray(lista.content)) {
                lista = lista.content;
            }

            if (catId) {
                lista = lista.filter(p => p.categoryId == catId);
            }

            PRODUCTOS_LOCAL = lista;
            PRODUCTOS_FILTRADOS = lista;
            paginaActual = 1;
            totalPaginasBackend = 1;
            totalElementosBackend = lista.length;

            renderizarTabla(PRODUCTOS_FILTRADOS);
            renderizarControlesPaginacion(totalElementosBackend, totalPaginasBackend, 0, PRODUCTOS_FILTRADOS.length);
        } catch (err) {
            console.error("Error buscando productos:", err);
        }
    }, 300);
}

function renderizarTabla(lista) {
    const tabla = document.getElementById('listaProductos');
    if (!tabla) return;
    tabla.innerHTML = '';

    if (!lista || lista.length === 0) {
        tabla.innerHTML = '<tr><td colspan="7" class="text-center p-5 text-muted">No se encontraron productos en el inventario.</td></tr>';
        return;
    }

    const fragment = document.createDocumentFragment();

    lista.forEach(p => {
        const nombreSeguro = (p.name || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const barcodeSeguro = (p.barcode || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const catName = (p.categoryName || 'S/C').replace(/</g, "&lt;").replace(/>/g, "&gt;");

        const stockClase = p.stock <= p.minStock ? 'bg-danger bg-opacity-10 text-danger' : 'bg-success bg-opacity-10 text-success';
        const costo = parseFloat(p.cost) || 0;
        const precio = parseFloat(p.price) || 0;
        const margen = costo > 0 ? (((precio - costo) / costo) * 100).toFixed(0) : 0;
        const stockFormateado = formatStockDisplay(p.stock, p.isFractional);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="ps-3">
                <p class="product-name fw-bold mb-0">${nombreSeguro}</p>
                <span class="product-code text-muted small"><i class="bi bi-barcode me-1"></i>${barcodeSeguro || 'Sin código'}</span>
            </td>
            <td class="d-none d-md-table-cell"><span class="badge bg-light text-dark border p-2 px-3 rounded-pill">${catName}</span></td>
            <td class="text-muted amount-num d-none d-lg-table-cell">${fmtARS.format(costo)}</td>
            <td class="fw-bold text-dark amount-num">${fmtARS.format(precio)}</td>
            <td class="d-none d-lg-table-cell"><span class="text-success small fw-bold">+${margen}%</span></td>
            <td><span class="badge ${stockClase} p-2 px-3 rounded-pill">${stockFormateado}</span></td>
            <td class="text-end pe-3">
                <div class="btn-group shadow-sm rounded-3">
                    <button class="btn btn-white btn-sm border-end" title="Imprimir Etiqueta POS80" onclick="imprimirEtiquetaPos80(${p.id})"><i class="bi bi-printer text-primary"></i></button>
                    <button class="btn btn-white btn-sm border-end" title="Imprimir Hoja Masiva A4" onclick="imprimirEtiquetasMultiples(${p.id})"><i class="bi bi-grid-3x3-gap text-success"></i></button>
                    <button class="btn btn-white btn-sm border-end" title="Editar" onclick="editarProducto(${p.id})"><i class="bi bi-pencil-square text-primary"></i></button>
                    <button class="btn btn-white btn-sm" title="Eliminar" onclick="eliminarProducto(${p.id})"><i class="bi bi-trash3 text-danger"></i></button>
                </div>
            </td>
        `;
        fragment.appendChild(tr);
    });

    tabla.appendChild(fragment);
}

function renderizarControlesPaginacion(totalItems, totalPaginas, inicio, fin) {
    const infoText = document.getElementById('infoPaginacion');
    const contenedor = document.getElementById('paginacionContenedor');

    if (infoText) {
        if (totalItems === 0) {
            infoText.innerText = "Mostrando 0 productos";
        } else {
            const limiteSuperior = fin > totalItems ? totalItems : fin;
            infoText.innerText = `Mostrando ${inicio + 1} - ${limiteSuperior} de ${totalItems} productos`;
        }
    }

    if (!contenedor) return;
    contenedor.innerHTML = '';

    if (totalPaginas <= 1) return;

    let html = '';

    // Botón Anterior
    html += `
        <li class="page-item ${paginaActual === 1 ? 'disabled' : ''}">
            <button class="page-link" onclick="cambiarPagina(${paginaActual - 1})"><i class="bi bi-chevron-left"></i></button>
        </li>
    `;

    // Algoritmo de rango dinámico para evitar renderizar decenas de números
    const maxPaginasVisibles = 5;
    let pagInicio = Math.max(1, paginaActual - Math.floor(maxPaginasVisibles / 2));
    let pagFin = Math.min(totalPaginas, pagInicio + maxPaginasVisibles - 1);

    if (pagFin - pagInicio + 1 < maxPaginasVisibles) {
        pagInicio = Math.max(1, pagFin - maxPaginasVisibles + 1);
    }

    if (pagInicio > 1) {
        html += `<li class="page-item"><button class="page-link" onclick="cambiarPagina(1)">1</button></li>`;
        if (pagInicio > 2) html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
    }

    for (let i = pagInicio; i <= pagFin; i++) {
        html += `
            <li class="page-item ${i === paginaActual ? 'active' : ''}">
                <button class="page-link" onclick="cambiarPagina(${i})">${i}</button>
            </li>
        `;
    }

    if (pagFin < totalPaginas) {
        if (pagFin < totalPaginas - 1) html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        html += `<li class="page-item"><button class="page-link" onclick="cambiarPagina(${totalPaginas})">${totalPaginas}</button></li>`;
    }

    // Botón Siguiente
    html += `
        <li class="page-item ${paginaActual === totalPaginas ? 'disabled' : ''}">
            <button class="page-link" onclick="cambiarPagina(${paginaActual + 1})"><i class="bi bi-chevron-right"></i></button>
        </li>
    `;

    contenedor.innerHTML = html;
}

function cambiarPagina(nuevaPagina) {
    if (nuevaPagina < 1 || nuevaPagina > totalPaginasBackend) return;
    const texto = (document.getElementById('buscador')?.value || '').trim();
    if (texto) {
        // En modo búsqueda, mantener
        return;
    }
    listarProductos(nuevaPagina - 1);
}

function autogenerarCodigoInput() {
    const inputBarcode = document.getElementById('prodBarcode');
    if (inputBarcode) {
        inputBarcode.value = generarCodigoInterno();
    }
}

async function guardarProducto(e) {
    e.preventDefault();
    const id = document.getElementById('prodId').value;

    const nombre = document.getElementById('prodNombre').value.trim();
    const categoriaId = document.getElementById('prodCategoria').value;
    let barcode = document.getElementById('prodBarcode').value.trim();

    if (!nombre) return Swal.fire('Error', 'El nombre es obligatorio', 'warning');
    if (!categoriaId) return Swal.fire('Error', 'Selecciona una categoría', 'warning');

    if (!barcode) {
        barcode = generarCodigoInterno();
    }

    const body = {
        name: nombre,
        // Captura el valor del campo de descripción del modal
        description: document.getElementById('prodDescripcion')?.value.trim() || "",
        barcode: barcode,
        cost: parseFloat(document.getElementById('prodCosto').value) || 0,
        price: parseFloat(document.getElementById('prodPrecio').value) || 0,
        stock: parseFloat(document.getElementById('prodStock').value) || 0,
        minStock: parseFloat(document.getElementById('prodMinStock').value) || 0,
        categoryId: parseInt(categoriaId),
        isFractional: document.getElementById('prodIsFractional')?.checked || false
    };

    try {
        const url = id ? `${ENDPOINT_PRODUCTS}/${id}` : ENDPOINT_PRODUCTS;
        const res = await apiFetch(url, {
            method: id ? 'PUT' : 'POST',
            body: JSON.stringify(body)
        });

        if (res && res.ok) {
            const modalEl = document.getElementById('modalProducto');
            if (modalEl) {
                const modalInstance = bootstrap.Modal.getInstance(modalEl);
                if (modalInstance) modalInstance.hide();
            }

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
    const form = document.getElementById('formProducto');
    if (form) form.reset();
    if (document.getElementById('prodId')) document.getElementById('prodId').value = '';
    // Limpieza explícita del campo de descripción al crear un producto nuevo
    if (document.getElementById('prodDescripcion')) document.getElementById('prodDescripcion').value = '';
    if (document.getElementById('prodIsFractional')) document.getElementById('prodIsFractional').checked = false;
    if (document.getElementById('modalTitulo')) document.getElementById('modalTitulo').innerText = "Nuevo Producto";

    const modalEl = document.getElementById('modalProducto');
    if (modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

function editarProducto(id) {
    const p = PRODUCTOS_LOCAL.find(prod => prod.id === id);
    if (!p) return;

    if (document.getElementById('prodId')) document.getElementById('prodId').value = p.id;
    if (document.getElementById('prodNombre')) document.getElementById('prodNombre').value = p.name || '';
    // Carga de la descripción existente en el formulario
    if (document.getElementById('prodDescripcion')) document.getElementById('prodDescripcion').value = p.description || '';
    if (document.getElementById('prodBarcode')) document.getElementById('prodBarcode').value = p.barcode || '';
    if (document.getElementById('prodCosto')) document.getElementById('prodCosto').value = p.cost || 0;
    if (document.getElementById('prodPrecio')) document.getElementById('prodPrecio').value = p.price || 0;
    if (document.getElementById('prodStock')) document.getElementById('prodStock').value = p.stock || 0;
    if (document.getElementById('prodMinStock')) document.getElementById('prodMinStock').value = p.minStock || 0;
    if (document.getElementById('prodIsFractional')) document.getElementById('prodIsFractional').checked = !!p.isFractional;

    const selectCat = document.getElementById('prodCategoria');
    if (selectCat) selectCat.value = p.categoryId || "";

    if (document.getElementById('modalTitulo')) document.getElementById('modalTitulo').innerText = "Editar Producto";

    const modalEl = document.getElementById('modalProducto');
    if (modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

async function eliminarProducto(id) {
    const result = await Swal.fire({
        title: '¿Mover a la papelera?',
        text: "Podrás restaurarlo en cualquier momento.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, borrar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            const res = await apiFetch(`${ENDPOINT_PRODUCTS}/${id}`, { method: 'DELETE' });
            if (res && res.ok) {
                await listarProductos();
                Swal.fire('Eliminado', 'Producto movido a la papelera', 'success');
            }
        } catch (err) {
            console.error("Error eliminando producto:", err);
        }
    }
}

// ==========================================
// 4. PAPELERA Y RESTAURACIÓN
// ==========================================
async function abrirPapelera() {
    try {
        const res = await apiFetch(`${ENDPOINT_PRODUCTS}/deleted`);
        if (!res || !res.ok) return;
        const borrados = await res.json();
        const tabla = document.getElementById('listaBorrados');
        if (!tabla) return;

        tabla.innerHTML = '';

        if (!borrados || borrados.length === 0) {
            tabla.innerHTML = '<tr><td colspan="2" class="text-center p-4 text-muted">La papelera está vacía</td></tr>';
        } else {
            const fragment = document.createDocumentFragment();
            borrados.forEach(p => {
                const nameSeguro = (p.name || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="ps-3"><b>${nameSeguro}</b><br><small class="text-muted">${p.barcode || 'S/C'}</small></td>
                    <td class="text-end pe-3">
                        <button class="btn btn-sm btn-success fw-bold" onclick="restaurarProducto(${p.id})">Restaurar</button>
                    </td>
                `;
                fragment.appendChild(tr);
            });
            tabla.appendChild(fragment);
        }

        const modalEl = document.getElementById('modalPapelera');
        if (modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).show();
    } catch (err) {
        console.error("Error leyendo papelera:", err);
    }
}

async function restaurarProducto(id) {
    try {
        const res = await apiFetch(`${ENDPOINT_PRODUCTS}/${id}/activate`, { method: 'PATCH' });
        if (res && res.ok) {
            const modalEl = document.getElementById('modalPapelera');
            if (modalEl) {
                const instance = bootstrap.Modal.getInstance(modalEl);
                if (instance) instance.hide();
            }

            await listarProductos();
            Swal.fire('Restaurado', 'El producto vuelve a estar activo', 'success');
        }
    } catch (err) {
        console.error("Error restaurando producto:", err);
    }
}

// ==========================================
// 5. TECLADO Y ESCANEO
// ==========================================
document.addEventListener('keydown', (e) => {
    const buscador = document.getElementById('buscador');
    const modalProducto = document.getElementById('modalProducto');
    const inputCodigo = document.getElementById('prodBarcode');

    if (modalProducto && modalProducto.classList.contains('show')) {
        if (e.key === 'Enter' && document.activeElement === inputCodigo) {
            e.preventDefault();
            const inputNombre = document.getElementById('prodNombre');
            if (inputNombre) inputNombre.focus();
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

// ==========================================
// 6. IMPRESIÓN DE ETIQUETA / TICKET MEJORADA
// ==========================================
/**
 * Motor de impresión nativo mediante CSS @media print y #print-section.
 * Sincroniza la carga de imágenes antes de invocar window.print().
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

/**
 * Renderiza un código de barras CODE128 en un canvas en memoria y devuelve su DataURL (image/png).
 * Soporta rotación de 90Â° para impresión térmica vertical POS80 sin deformación de barras.
 */
function generarBarcodeDataURL(codigo, options = {}) {
    if (!codigo) return null;
    try {
        const canvas = document.createElement('canvas');
        if (typeof JsBarcode === 'undefined') {
            console.error("JsBarcode no se encuentra cargado en el entorno.");
            return null;
        }
        JsBarcode(canvas, String(codigo).trim(), {
            format: "CODE128",
            width: options.width || 2,
            height: options.height || 48,
            displayValue: options.displayValue !== undefined ? options.displayValue : true,
            fontSize: options.fontSize || 12,
            fontOptions: "bold",
            textMargin: 2,
            margin: options.margin !== undefined ? options.margin : 2,
            background: "#ffffff",
            lineColor: "#000000"
        });

        if (options.rotar90) {
            const rotCanvas = document.createElement('canvas');
            rotCanvas.width = canvas.height;
            rotCanvas.height = canvas.width;
            const ctx = rotCanvas.getContext('2d');
            ctx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
            ctx.rotate(90 * Math.PI / 180);
            ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
            return rotCanvas.toDataURL("image/png");
        }

        return canvas.toDataURL("image/png");
    } catch (e) {
        console.error("Error generando código de barras CODE128:", e);
        return null;
    }
}

async function imprimirEtiquetaPos80(productoId) {
    console.log("Generando etiqueta POS80 para ID: ", productoId);

    let p = PRODUCTOS_LOCAL.find(prod => prod.id === productoId);
    if (!p) {
        console.error("Producto no encontrado localmente con ID:", productoId);
        return;
    }

    // 1. Solicitud de cantidad dinámica
    let cantidad = 1;
    if (typeof Swal !== 'undefined') {
        const { value: cantInput } = await Swal.fire({
            title: 'Impresión de Etiquetas POS80',
            text: `¿Cuántas etiquetas de "${p.name}" deseas imprimir?`,
            input: 'number',
            inputValue: 1,
            inputAttributes: { min: 1, max: 100, step: 1 },
            showCancelButton: true,
            confirmButtonText: '<i class="bi bi-printer"></i> Imprimir',
            cancelButtonText: 'Cancelar',
            customClass: { popup: 'rounded-4' }
        });
        if (!cantInput || cantInput <= 0) return;
        cantidad = parseInt(cantInput, 10) || 1;
    } else {
        const raw = prompt("Cantidad de etiquetas:", "1");
        if (!raw) return;
        cantidad = parseInt(raw, 10) || 1;
    }

    let barcodeParaImprimir = p.barcode;
    if (!barcodeParaImprimir) {
        barcodeParaImprimir = generarCodigoInterno();
        p.barcode = barcodeParaImprimir;

        try {
            await apiFetch(`${ENDPOINT_PRODUCTS}/${p.id}`, {
                method: 'PUT',
                body: JSON.stringify({ ...p, barcode: barcodeParaImprimir })
            });
            listarProductos();
        } catch (err) {
            console.error("Error al asignar código automático:", err);
        }
    }

    // 2. Generar imagen del código de barras horizontal (sin rotar)
    const barcodeImgData = generarBarcodeDataURL(barcodeParaImprimir, {
        width: 2.0,
        height: 48,
        displayValue: true,
        fontSize: 11,
        margin: 2,
        rotar90: false
    });

    if (!barcodeImgData) {
        if (typeof Swal !== 'undefined') {
            Swal.fire('Error', 'No se pudo generar el código de barras gráfico.', 'error');
        }
        return;
    }

    const altoEtiqueta = 45;
    const precioNum = parseFloat(p.price || p.precio) || 0;
    const precioFormateado = "$" + precioNum.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const nombreProd = (p.name || 'PRODUCTO').toUpperCase();

    // 3. Instanciar jsPDF con dimensionamiento dinámico [80, altoEtiqueta * cantidad]
    let JsPdfClass = null;
    if (window.jspdf && window.jspdf.jsPDF) {
        JsPdfClass = window.jspdf.jsPDF;
    } else if (typeof jsPDF === 'function') {
        JsPdfClass = jsPDF;
    }

    if (JsPdfClass) {
        const pdf = new JsPdfClass({
            orientation: 'portrait',
            unit: 'mm',
            format: [80, altoEtiqueta * cantidad]
        });

        pdf.setTextColor(0, 0, 0);

        for (let i = 0; i < cantidad; i++) {
            let yOffset = i * altoEtiqueta;

            // Textos centrados (Nombre y Precio)
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(10);
            pdf.text(nombreProd, 40, yOffset + 10, { align: 'center', maxWidth: 70 });

            pdf.setFontSize(12);
            pdf.text(precioFormateado, 40, yOffset + 17, { align: 'center' });

            // Código de barras horizontal (X: 5mm, Y: ajustado al offset, Ancho: 70mm, Alto: 18mm)
            pdf.addImage(barcodeImgData, 'PNG', 5, yOffset + 20, 70, 18);
        }

        // 4. Apertura Forzada en el navegador
        const blobUrl = pdf.output('bloburl');
        const win = window.open(blobUrl, '_blank');
        if (!win || win.closed || typeof win.closed === 'undefined') {
            const a = document.createElement('a');
            a.href = blobUrl;
            a.target = '_blank';
            a.click();
        }
    } else {
        console.warn("jsPDF no disponible, usando iframe print de respaldo...");
        const nameSeguro = (p.name || '').replace(/"/g, '&quot;');
        let etiquetasHTML = '';
        for (let i = 0; i < cantidad; i++) {
            etiquetasHTML += `
                <div class="etiqueta-pos80" style="width: 72mm; height: 43mm; border: 1px dashed #888; border-radius: 4px; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 2mm; box-sizing: border-box; text-align: center; margin-bottom: 2mm; background: #fff;">
                    <div style="font-size: 10pt; font-weight: bold; margin-bottom: 1mm; max-width: 68mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${nameSeguro.toUpperCase()}</div>
                    <div style="font-size: 12pt; font-weight: bold; margin-bottom: 1mm;">${precioFormateado}</div>
                    <div style="width: 70mm; display: flex; justify-content: center;">
                        <img src="${barcodeImgData}" style="max-width: 70mm; max-height: 18mm; display: block;" alt="${barcodeParaImprimir}" />
                    </div>
                </div>
            `;
        }

        const htmlEtiqueta = `
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Etiquetas POS80 - ${nameSeguro}</title>
                    <style>
                        @page { size: 80mm ${altoEtiqueta * cantidad}mm; margin: 0; }
                        * { box-sizing: border-box; }
                        body { margin: 0; padding: 0; background-color: #fff; font-family: Arial, Helvetica, sans-serif; display: flex; flex-direction: column; align-items: center; }
                        @media print { body { margin: 0; } }
                    </style>
                </head>
                <body>
                    <div class="layout-ticket">
                        ${etiquetasHTML}
                    </div>
                </body>
            </html>
        `;
        imprimirHTMLConIframe(htmlEtiqueta);
    }
}

// Alias para compatibilidad
const imprimirEtiqueta = imprimirEtiquetaPos80;

if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
    bootstrap.Modal.prototype._enforceFocus = function() {};
}

document.addEventListener('focusin', (e) => {
    if (e.target.closest(".swal2-container")) {
        e.stopImmediatePropagation();
    }
}, true);

async function imprimirEtiquetasMultiples(id) {
    let p = PRODUCTOS_LOCAL.find(prod => prod.id === id);
    if (!p) return;

    let barcodeParaImprimir = p.barcode;
    if (!barcodeParaImprimir) {
        barcodeParaImprimir = generarCodigoInterno();
        p.barcode = barcodeParaImprimir;

        try {
            await apiFetch(`${ENDPOINT_PRODUCTS}/${p.id}`, {
                method: 'PUT',
                body: JSON.stringify({ ...p, barcode: barcodeParaImprimir })
            });
            listarProductos();
        } catch (err) {
            console.error("Error al asignar código automático:", err);
        }
    }

    const { value: cantidad } = await Swal.fire({
        title: 'Impresión Masiva de Etiquetas',
        text: `¿Cuántas etiquetas de "${p.name}" querés generar? (Página A4 completa = 24 etiquetas)`,
        input: 'number',
        inputValue: 24,
        inputAttributes: {
            min: 1,
            max: 240,
            step: 1
        },
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-printer"></i> Generar Hoja A4',
        cancelButtonText: 'Cancelar',
        customClass: { popup: 'rounded-4' }
    });

    if (!cantidad || cantidad <= 0) return;

    // Código de barras horizontal estándar optimizado para celdas A4 de 62x33.5mm
    const barcodeImgData = generarBarcodeDataURL(barcodeParaImprimir, {
        width: 2.0,
        height: 48,
        displayValue: true,
        fontSize: 11,
        margin: 1,
        rotar90: false
    });

    if (!barcodeImgData) {
        if (typeof Swal !== 'undefined') {
            Swal.fire('Error', 'No se pudo generar el código de barras gráfico.', 'error');
        }
        return;
    }

    const nameSeguro = (p.name || '').replace(/"/g, '&quot;');

    let etiquetasHTML = '';
    for (let i = 0; i < cantidad; i++) {
        etiquetasHTML += `
            <div class="etiqueta">
                <div class="nombre">${nameSeguro.toUpperCase()}</div>
                <div class="barcode-container">
                    <img class="barcode-img" src="${barcodeImgData}" alt="${barcodeParaImprimir}" />
                </div>
            </div>
        `;
    }

    const htmlHoja = `
        <!DOCTYPE html>
        <html>
            <head>
                <title>Hoja Etiquetas A4 - ${nameSeguro}</title>
                <style>
                    @page {
                        size: 210mm 297mm;
                        margin: 10mm;
                    }
                    * {
                        box-sizing: border-box;
                    }
                    body {
                        font-family: Arial, Helvetica, sans-serif;
                        margin: 0;
                        padding: 0;
                        background-color: #fff;
                    }
                    .grid-container {
                        display: grid;
                        grid-template-columns: repeat(3, 62mm);
                        grid-auto-rows: 33.5mm;
                        gap: 1.5mm 2mm;
                        width: 190mm;
                        margin: 0 auto;
                        justify-content: center;
                    }
                    .etiqueta {
                        width: 62mm;
                        height: 33.5mm;
                        border: 1px dashed #999;
                        border-radius: 4px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        padding: 2mm 1.5mm;
                        text-align: center;
                        page-break-inside: avoid;
                        overflow: hidden;
                        background: #fff;
                        box-sizing: border-box;
                    }
                    .nombre {
                        font-size: 10pt;
                        font-weight: bold;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        max-width: 58mm;
                        color: #000;
                        line-height: 1.2;
                        margin-bottom: 1.5mm;
                    }
                    .barcode-container {
                        width: 100%;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                    }
                    .barcode-img {
                        width: 88%;
                        max-width: 56mm;
                        max-height: 20mm;
                        height: auto;
                        object-fit: contain;
                        display: block;
                        margin: 0 auto;
                    }

                    @media print {
                        body { margin: 0; }
                        .etiqueta { border: 1px dashed #777; }
                    }
                </style>
            </head>
            <body>
                <div class="grid-container layout-a4">
                    ${etiquetasHTML}
                </div>
            </body>
        </html>
    `;
    imprimirHTMLConIframe(htmlHoja);
}

// ==========================================
// 7. EXPOSICIÓN AL SCOPE GLOBAL
// ==========================================
window.abrirModalCategoria = abrirModalCategoria;
window.prepararEdicionCat = prepararEdicionCat;
window.guardarCategoria = guardarCategoria;
window.eliminarCategoria = eliminarCategoria;
window.prepararFormulario = prepararFormulario;
window.editarProducto = editarProducto;
window.eliminarProducto = eliminarProducto;
window.abrirPapelera = abrirPapelera;
window.restaurarProducto = restaurarProducto;
window.imprimirEtiqueta = imprimirEtiquetaPos80;
window.imprimirEtiquetaPos80 = imprimirEtiquetaPos80;
window.imprimirEtiquetasMultiples = imprimirEtiquetasMultiples;
window.filtrarProductos = filtrarProductos;
window.autogenerarCodigoInput = autogenerarCodigoInput;
window.cambiarPagina = cambiarPagina;