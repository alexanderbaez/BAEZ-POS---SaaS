/**
 * ==========================================================================
 * BÁEZ POS - UI HELPERS GLOBALES (SaaS Premium Suite)
 * Alexander Baez - 2026
 * ==========================================================================
 */

/**
 * Controla el estado de carga visual y bloqueo de interacción de cualquier botón.
 *
 * @param {HTMLElement|string} buttonElement - Elemento o selector CSS del botón.
 * @param {boolean} isLoading - true para activar el spinner y deshabilitar; false para restaurar.
 * @param {string} [loadingText="Procesando..."] - Texto a mostrar junto al spinner.
 */
function setButtonLoading(buttonElement, isLoading, loadingText = 'Procesando...') {
    const btn = (typeof buttonElement === 'string')
        ? document.querySelector(buttonElement)
        : buttonElement;

    if (!btn) return;

    if (isLoading) {
        if (!btn.dataset.originalContent) {
            btn.dataset.originalContent = btn.innerHTML;
        }
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span><span>${loadingText}</span>`;
    } else {
        if (btn.dataset.originalContent !== undefined) {
            btn.innerHTML = btn.dataset.originalContent;
            delete btn.dataset.originalContent;
        }
        btn.disabled = false;
    }
}

/**
 * Inyecta dinámicamente una vista de estado vacío (.empty-state) estilizada y profesional.
 * Soporta tanto contenedores genéricos (div) como tablas (tbody/table) adaptando el colSpan.
 *
 * @param {HTMLElement|string} container - Elemento o ID del contenedor donde se inyectará.
 * @param {string} [iconClass="bi-inbox"] - Clase del icono de Bootstrap Icons.
 * @param {string} [title="Sin registros disponibles"] - Título principal del estado vacío.
 * @param {string} [message="No se encontraron datos coincidentes para mostrar en este momento."] - Descripción o texto secundario.
 * @param {string} [actionHtml=""] - Código HTML opcional de botón o enlace de acción.
 * @param {number} [colSpan=6] - Cantidad de columnas si se renderiza dentro de un tbody.
 */
function renderEmptyState(container, iconClass = 'bi-inbox', title = 'Sin registros disponibles', message = 'No se encontraron datos coincidentes para mostrar en este momento.', actionHtml = '', colSpan = 6) {
    const el = (typeof container === 'string')
        ? (document.getElementById(container) || document.querySelector(container))
        : container;

    if (!el) return;

    const emptyStateHtml = `
        <div class="empty-state">
            <div class="empty-state-icon">
                <i class="bi ${iconClass}"></i>
            </div>
            <div class="empty-state-title">${title}</div>
            <p class="empty-state-message">${message}</p>
            ${actionHtml ? `<div class="empty-state-action">${actionHtml}</div>` : ''}
        </div>
    `;

    const isTableBody = (el.tagName && el.tagName.toLowerCase() === 'tbody');

    if (isTableBody) {
        el.innerHTML = `
            <tr>
                <td colspan="${colSpan}" class="p-0 border-0">
                    ${emptyStateHtml}
                </td>
            </tr>
        `;
    } else {
        el.innerHTML = emptyStateHtml;
    }
}

/**
 * Formateador de moneda local estándar para la aplicación
 */
const formatMoneyARS = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2
});

/**
 * Toast de notificación rápido con SweetAlert2 si está presente
 */
function showSaasToast(icon = 'success', title = 'Operación completada') {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: icon,
            title: title,
            showConfirmButton: false,
            timer: 2200,
            timerProgressBar: true
        });
    }
}

// Exportar funciones a ámbito global
window.setButtonLoading = setButtonLoading;
window.renderEmptyState = renderEmptyState;
window.formatMoneyARS = formatMoneyARS;
window.showSaasToast = showSaasToast;

/**
 * Formateador inteligente de cantidades para tickets y facturas (Kg, gr, un).
 */
window.fmtCantidadTicket = function(cantidad, isFractional) {
    let num = cantidad;
    let esFraccionario = isFractional;

    if (typeof cantidad === 'object' && cantidad !== null) {
        num = cantidad.quantity !== undefined ? cantidad.quantity : (cantidad.cantidad !== undefined ? cantidad.cantidad : (cantidad.weight || cantidad.peso || 1));
        if (esFraccionario === undefined) {
            esFraccionario = Boolean(
                cantidad.isFractional ||
                cantidad.fraccionable ||
                cantidad.unitType === 'KG' ||
                cantidad.unit === 'KG' ||
                (cantidad.product && (cantidad.product.isFractional || cantidad.product.fraccionable)) ||
                (cantidad.producto && (cantidad.producto.isFractional || cantidad.producto.fraccionable))
            );
        }
    }

    num = parseFloat(num);
    if (isNaN(num)) return "1";

    if (esFraccionario) {
        if (num > 0 && num < 1) {
            return (num * 1000) + " gr";
        } else {
            let formatted = Number.isInteger(num) ? num.toString() : num.toFixed(3).replace(/\.?0+$/, '');
            return formatted + " Kg";
        }
    } else {
        return parseInt(num).toString() + " un";
    }
};

/**
 * Formateador de importes monetarios para tickets térmicos POS.
 */
window.fmtPrecioTicket = function(monto) {
    const num = parseFloat(monto || 0);
    return isNaN(num) ? '0,00' : num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Funciones de compatibilidad global para formateo de moneda estándar
 */
if (typeof window.formatearMoneda !== 'function') {
    window.formatearMoneda = function(monto) {
        const num = parseFloat(monto || 0);
        return isNaN(num) ? '0,00' : num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
}
if (typeof window.utilFormatearMoneda !== 'function') {
    window.utilFormatearMoneda = window.formatearMoneda;
}
if (typeof window.formatearMonedaSegura !== 'function') {
    window.formatearMonedaSegura = window.formatearMoneda;
}

if (typeof window.escapeHtml !== 'function') {
    window.escapeHtml = function(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };
}
if (typeof window.escapeHTML !== 'function') {
    window.escapeHTML = window.escapeHtml;
}

/**
 * Motor de impresión nativo global mediante CSS @media print y #print-section.
 * Sincroniza la carga de imágenes antes de invocar window.print().
 */
window.imprimirHTMLConIframe = function(htmlContent) {
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
};


/**
 * ==========================================================================
 * DRAGGABLE MODALS GLOBALES
 * ==========================================================================
 * Convierte automáticamente todos los modales con cabecera en arrastrables.
 */
document.addEventListener('DOMContentLoaded', () => {
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;
    let activeModal = null;

    document.addEventListener('mousedown', (e) => {
        const header = e.target.closest('.modal-header');
        if (!header) return;

        const modal = header.closest('.modal-content');
        if (!modal) return;

        isDragging = true;
        activeModal = modal;
        
        const rect = modal.getBoundingClientRect();
        
        // Use inline transform or fallback to positioning
        const style = window.getComputedStyle(modal);
        const transform = style.transform;
        
        if (transform !== 'none') {
            const matrix = new DOMMatrix(transform);
            initialLeft = matrix.m41;
            initialTop = matrix.m42;
        } else {
            initialLeft = 0;
            initialTop = 0;
        }

        startX = e.clientX;
        startY = e.clientY;

        header.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging || !activeModal) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        activeModal.style.transform = `translate(${dx}px, ${dy}px)`;
    });

    document.addEventListener('mouseup', () => {
        if (isDragging && activeModal) {
            const header = activeModal.querySelector('.modal-header');
            if (header) header.style.cursor = 'grab';
        }
        isDragging = false;
        activeModal = null;
        document.body.style.userSelect = '';
    });
    
    // Add grab cursor to all existing and future modal headers
    const initCursors = () => {
        document.querySelectorAll('.modal-header').forEach(h => {
            if (h.style.cursor !== 'grab' && h.style.cursor !== 'grabbing') {
                h.style.cursor = 'grab';
            }
        });
    };
    
    initCursors();
    
    // Observe DOM for new modals
    const observer = new MutationObserver((mutations) => {
        for (let m of mutations) {
            if (m.addedNodes.length) initCursors();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
});
