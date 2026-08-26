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
