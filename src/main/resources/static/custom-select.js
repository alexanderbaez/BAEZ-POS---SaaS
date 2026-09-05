/**
 * ============================================================================
 * BAEZ POS - MOTOR DE DROPDOWNS PERSONALIZADOS (Bootstrap 5 Custom Selects)
 * ============================================================================
 * Reemplaza visualmente los selectores nativos (<select class="form-select">)
 * por dropdowns estilizados de Bootstrap 5 para evitar modales nativos en móviles
 * (Android/iOS) y mantener una experiencia homogénea con la versión de escritorio.
 * 
 * Cumple estrictamente con el patrón Proxy:
 * - Mantiene los <select> originales intactos en el DOM con sus IDs, nombres y eventos.
 * - Sincronización bidireccional inmediata en clicks y modificaciones programáticas.
 * - Observa mutaciones dinámicas (carga de opciones por AJAX o inserción en modales).
 */

(function inicializarMotorCustomSelect() {
    'use strict';

    // Estilos visuales del componente Custom Select
    const estilosCustomSelect = `
        /* Ocultamiento accesible del select original sin romper validación nativa */
        .custom-select-hidden {
            position: absolute !important;
            opacity: 0 !important;
            pointer-events: none !important;
            left: 0 !important;
            bottom: 0 !important;
            width: 100% !important;
            height: 1px !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            z-index: -1 !important;
        }

        /* Contenedor del Dropdown Custom */
        .custom-select-dropdown {
            position: relative;
            width: 100%;
        }

        /* Botón trigger con apariencia exacta a form-select de Bootstrap 5 */
        .custom-select-dropdown > .btn.form-select {
            background-color: #ffffff !important;
            color: #1e293b !important;
            border: 1px solid #cbd5e1 !important;
            border-radius: 0.375rem !important;
            padding: 0.55rem 0.85rem !important;
            font-size: 0.875rem !important;
            font-weight: 500 !important;
            text-align: left !important;
            width: 100% !important;
            cursor: pointer !important;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04) !important;
            transition: border-color 0.15s ease, box-shadow 0.15s ease !important;
            background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='%23343a40' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m2 5 6 6 6-6'/%3e%3c/svg%3e") !important;
            background-repeat: no-repeat !important;
            background-position: right 0.75rem center !important;
            background-size: 16px 12px !important;
            padding-right: 2.25rem !important;
            min-height: calc(1.5em + 1.1rem + 2px);
        }

        .custom-select-dropdown > .btn.form-select:hover {
            border-color: #94a3b8 !important;
            background-color: #ffffff !important;
        }

        .custom-select-dropdown > .btn.form-select:focus,
        .custom-select-dropdown > .btn.form-select.show {
            border-color: #3b82f6 !important;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15) !important;
            outline: 0 !important;
            background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='%230d6efd' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m2 11 6-6 6 6'/%3e%3c/svg%3e") !important;
        }

        /* Variantes de tamaño */
        .custom-select-dropdown > .btn.form-select.form-select-sm {
            padding: 0.35rem 0.65rem !important;
            padding-right: 2rem !important;
            font-size: 0.8125rem !important;
            min-height: calc(1.5em + 0.7rem + 2px);
            border-radius: 0.25rem !important;
            background-size: 14px 10px !important;
        }

        .custom-select-dropdown > .btn.form-select.form-select-lg {
            padding: 0.75rem 1rem !important;
            padding-right: 2.5rem !important;
            font-size: 1.05rem !important;
            min-height: calc(1.5em + 1.5rem + 2px);
            border-radius: 0.5rem !important;
        }

        /* Estado deshabilitado */
        .custom-select-dropdown > .btn.form-select:disabled,
        .custom-select-dropdown > .btn.form-select.disabled {
            background-color: #f1f5f9 !important;
            border-color: #e2e8f0 !important;
            color: #94a3b8 !important;
            cursor: not-allowed !important;
            opacity: 0.8 !important;
            box-shadow: none !important;
        }

        /* Estado inválido para validación de formularios */
        .custom-select-dropdown > .btn.form-select.is-invalid {
            border-color: #dc3545 !important;
            box-shadow: 0 0 0 3px rgba(220, 53, 69, 0.15) !important;
        }

        /* Menú desplegable del Custom Select */
        .custom-select-dropdown .dropdown-menu {
            width: 100% !important;
            min-width: 100% !important;
            max-height: 280px !important;
            overflow-y: auto !important;
            background-color: #ffffff !important;
            border: 1px solid rgba(0, 0, 0, 0.08) !important;
            border-radius: 0.5rem !important;
            padding: 0.35rem !important;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08) !important;
            z-index: 1070 !important;
        }

        /* Ítems del menú */
        .custom-select-dropdown .dropdown-item {
            font-size: 0.875rem !important;
            font-weight: 500 !important;
            color: #334155 !important;
            border-radius: 0.375rem !important;
            padding: 0.5rem 0.85rem !important;
            margin-bottom: 2px !important;
            transition: background-color 0.12s ease, color 0.12s ease !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            white-space: normal !important;
            word-break: break-word !important;
        }

        .custom-select-dropdown .dropdown-item:hover,
        .custom-select-dropdown .dropdown-item:focus {
            background-color: #f1f5f9 !important;
            color: #0f172a !important;
        }

        /* Indicador activo azul según guía de estilo */
        .custom-select-dropdown .dropdown-item.active,
        .custom-select-dropdown .dropdown-item:active {
            background-color: #0d6efd !important;
            color: #ffffff !important;
            font-weight: 600 !important;
        }

        .custom-select-dropdown .dropdown-item.active i {
            color: #ffffff !important;
        }

        .custom-select-dropdown .dropdown-item.disabled {
            color: #94a3b8 !important;
            opacity: 0.6 !important;
            cursor: not-allowed !important;
            pointer-events: none !important;
        }

        /* Integración armoniosa con Input Groups de Bootstrap */
        .input-group > .custom-select-dropdown {
            flex: 1 1 auto;
            width: 1%;
            min-width: 0;
        }

        .input-group > .custom-select-dropdown.has-prepend > .btn.form-select {
            border-top-left-radius: 0 !important;
            border-bottom-left-radius: 0 !important;
        }

        .input-group > .custom-select-dropdown.has-append > .btn.form-select {
            border-top-right-radius: 0 !important;
            border-bottom-right-radius: 0 !important;
        }

        /* Scrollbar elegante para listas largas de opciones */
        .custom-select-dropdown .dropdown-menu::-webkit-scrollbar {
            width: 6px;
        }
        .custom-select-dropdown .dropdown-menu::-webkit-scrollbar-track {
            background: #f8fafc;
            border-radius: 4px;
        }
        .custom-select-dropdown .dropdown-menu::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 4px;
        }
        .custom-select-dropdown .dropdown-menu::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
        }
    `;

    function inyectarEstilos() {
        if (document.getElementById('estilos-custom-select')) return;
        const styleEl = document.createElement('style');
        styleEl.id = 'estilos-custom-select';
        styleEl.textContent = estilosCustomSelect;
        document.head.appendChild(styleEl);
    }

    /**
     * Sincroniza el texto del botón y el estado activo del dropdown
     * a partir del estado actual del <select> original.
     */
    function syncFromSelect(select) {
        if (!select || !select._customSelectBtn || !select._customSelectUl) return;

        const btn = select._customSelectBtn;
        const ul = select._customSelectUl;
        const label = select._customSelectLabel;

        // 1. Obtener texto de la opción seleccionada
        const selectedOpt = select.options && select.selectedIndex >= 0
            ? select.options[select.selectedIndex]
            : null;

        const labelText = selectedOpt ? selectedOpt.textContent.trim() : '';
        if (label) {
            label.textContent = labelText || 'Seleccionar...';
        }

        // 2. Sincronizar ítems activos en la lista
        const items = ul.querySelectorAll('.dropdown-item');
        items.forEach((item) => {
            const itemVal = item.getAttribute('data-value');
            const isActive = (selectedOpt && String(itemVal) === String(selectedOpt.value));

            if (isActive) {
                item.classList.add('active');
                if (!item.querySelector('.custom-select-check')) {
                    const checkIcon = document.createElement('i');
                    checkIcon.className = 'bi bi-check2 ms-2 custom-select-check';
                    item.appendChild(checkIcon);
                }
            } else {
                item.classList.remove('active');
                const checkIcon = item.querySelector('.custom-select-check');
                if (checkIcon) checkIcon.remove();
            }
        });

        // 3. Sincronizar estado deshabilitado
        btn.disabled = Boolean(select.disabled);
        btn.classList.toggle('disabled', Boolean(select.disabled));

        // 4. Sincronizar validación (is-invalid / is-valid)
        btn.classList.toggle('is-invalid', select.classList.contains('is-invalid'));
        btn.classList.toggle('is-valid', select.classList.contains('is-valid'));
    }

    /**
     * Reconstruye las opciones del <ul> a partir de los elementos <option> y <optgroup>
     * presentes en el <select> original.
     */
    function buildOptions(select) {
        if (!select || !select._customSelectUl) return;

        const ul = select._customSelectUl;
        const btn = select._customSelectBtn;
        ul.innerHTML = '';

        if (!select.options || select.options.length === 0) {
            const li = document.createElement('li');
            li.innerHTML = '<span class="dropdown-item disabled text-muted small fst-italic">Sin opciones</span>';
            ul.appendChild(li);
            syncFromSelect(select);
            return;
        }

        // Iterar sobre los hijos directos para soportar optgroup y option
        Array.from(select.children).forEach((child) => {
            if (child.tagName.toLowerCase() === 'optgroup') {
                const headerLi = document.createElement('li');
                headerLi.className = 'dropdown-header text-uppercase small fw-bold text-muted px-3 py-1';
                headerLi.textContent = child.label || '';
                ul.appendChild(headerLi);

                Array.from(child.children).forEach((opt) => {
                    if (opt.tagName.toLowerCase() === 'option') {
                        ul.appendChild(crearItemOpcion(select, opt, btn));
                    }
                });
            } else if (child.tagName.toLowerCase() === 'option') {
                ul.appendChild(crearItemOpcion(select, child, btn));
            }
        });

        syncFromSelect(select);
    }

    /**
     * Crea un elemento <li> con el link del ítem del dropdown y su evento click.
     */
    function crearItemOpcion(select, optionEl, btn) {
        const li = document.createElement('li');
        const a = document.createElement('a');

        a.className = 'dropdown-item d-flex align-items-center justify-content-between';
        a.href = '#';
        a.setAttribute('data-value', optionEl.value);
        a.textContent = optionEl.textContent.trim();

        if (optionEl.disabled) {
            a.classList.add('disabled');
        }

        a.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (optionEl.disabled || a.classList.contains('disabled')) return;

            const selectedValue = optionEl.value;

            if (select.value !== selectedValue) {
                select.value = selectedValue;
                syncFromSelect(select);

                // Disparo de eventos nativos para que los listeners existentes reaccionen
                select.dispatchEvent(new Event('change', { bubbles: true }));
                select.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
                syncFromSelect(select);
            }

            // Ocultar dropdown mediante la instancia de Bootstrap 5
            if (typeof bootstrap !== 'undefined' && bootstrap.Dropdown) {
                const bsDropdown = bootstrap.Dropdown.getInstance(btn) || bootstrap.Dropdown.getOrCreateInstance(btn);
                if (bsDropdown) bsDropdown.hide();
            } else {
                btn.classList.remove('show');
                btn.nextElementSibling?.classList.remove('show');
            }
        });

        li.appendChild(a);
        return li;
    }

    /**
     * Intercepta la propiedad .value en la instancia del <select> para que,
     * si otro script altera programáticamente su valor, el custom select
     * se actualice en tiempo real sin requerir un evento 'change' manual.
     */
    function interceptarSetterValor(select) {
        if (select._hasCustomValueHook) return;
        select._hasCustomValueHook = true;

        const protoDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
        if (protoDesc && protoDesc.set) {
            const origSet = protoDesc.set;
            Object.defineProperty(select, 'value', {
                get() {
                    return protoDesc.get.call(this);
                },
                set(nuevoValor) {
                    origSet.call(this, nuevoValor);
                    syncFromSelect(select);
                },
                configurable: true
            });
        }
    }

    /**
     * Inicializa un elemento <select> convirtiéndolo en un Custom Select.
     */
    function initCustomSelect(select) {
        if (!select) return;

        // Omitir selects que no correspondan o que tengan exclusión explícita
        if (select.dataset.noCustomSelect || select.closest('.no-custom-select') || select.multiple) {
            return;
        }

        // Si ya está inicializado, únicamente refrescar opciones y sincronizar
        if (select.dataset.customSelectInit === 'true') {
            buildOptions(select);
            return;
        }

        select.dataset.customSelectInit = 'true';

        // 1. Ocultar el <select> original visualmente pero conservándolo en el layout
        select.classList.add('custom-select-hidden');

        // 2. Construir el contenedor Dropdown adyacente
        const wrapper = document.createElement('div');
        wrapper.className = 'dropdown custom-select-dropdown';

        // Detectar si está dentro de un input-group para respetar el flexbox y esquinas redondeadas
        const parentInputGroup = select.closest('.input-group');
        if (parentInputGroup) {
            wrapper.classList.add('flex-grow-1');
            if (select.previousElementSibling) {
                wrapper.classList.add('has-prepend');
            }
            if (select.nextElementSibling) {
                wrapper.classList.add('has-append');
            }
        }

        // 3. Construir el botón trigger de Bootstrap 5
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn form-select text-start d-flex justify-content-between align-items-center';
        btn.setAttribute('data-bs-toggle', 'dropdown');
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('data-bs-boundary', 'viewport'); // Previene recortes de Popper en modales

        // Clonar clases de tamaño si existen en el select original
        if (select.classList.contains('form-select-sm') || select.classList.contains('input-sm')) {
            btn.classList.add('form-select-sm');
        }
        if (select.classList.contains('form-select-lg') || select.classList.contains('input-lg')) {
            btn.classList.add('form-select-lg');
        }

        // Span interno para truncado elegante del texto
        const labelSpan = document.createElement('span');
        labelSpan.className = 'custom-select-label text-truncate me-2';
        btn.appendChild(labelSpan);

        // 4. Construir la lista <ul> del menú
        const ul = document.createElement('ul');
        ul.className = 'dropdown-menu w-100 shadow-sm';

        wrapper.appendChild(btn);
        wrapper.appendChild(ul);

        // 5. Insertar wrapper inmediatamente adyacente al select
        select.insertAdjacentElement('afterend', wrapper);

        // Vincular referencias cruzadas
        select._customSelectWrapper = wrapper;
        select._customSelectBtn = btn;
        select._customSelectUl = ul;
        select._customSelectLabel = labelSpan;

        // 6. Poblar opciones y sincronizar estado inicial
        buildOptions(select);
        interceptarSetterValor(select);

        // 7. Event listeners sobre el select original
        select.addEventListener('change', () => syncFromSelect(select));
        select.addEventListener('input', () => syncFromSelect(select));

        // Redirigir foco al botón custom si el select recibe foco programático
        select.addEventListener('focus', () => {
            btn.focus();
        });

        // Manejar evento de validación nativa sin provocar error de control no focusable
        select.addEventListener('invalid', (e) => {
            e.preventDefault();
            btn.classList.add('is-invalid');
            btn.focus();
        });

        // Asegurar sincronización fresca cada vez que se despliega el menú
        btn.addEventListener('show.bs.dropdown', () => {
            syncFromSelect(select);
        });

        // 8. Observar mutaciones en el select (cambios de <option> vía AJAX o atributos)
        const selectObserver = new MutationObserver((mutations) => {
            let optionsChanged = false;
            for (const m of mutations) {
                if (m.type === 'childList') {
                    optionsChanged = true;
                    break;
                } else if (m.type === 'attributes') {
                    syncFromSelect(select);
                }
            }
            if (optionsChanged) {
                buildOptions(select);
            }
        });

        selectObserver.observe(select, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['disabled', 'class', 'required']
        });

        select._customSelectObserver = selectObserver;
    }

    /**
     * API Pública Global para inicializar custom selects en cualquier contenedor
     */
    window.initCustomSelects = function (container = document) {
        if (!container || !container.querySelectorAll) return;
        const selects = container.querySelectorAll('select.form-select, select[data-custom-select]');
        selects.forEach((sel) => {
            initCustomSelect(sel);
        });
    };

    /**
     * Observador global para inicializar automáticamente elementos agregados al DOM
     */
    function iniciarObservadorGlobal() {
        if (!document.body) return;

        const bodyObserver = new MutationObserver((mutations) => {
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node.nodeType === 1) { // Node.ELEMENT_NODE
                        if (node.matches && (node.matches('select.form-select') || node.matches('select[data-custom-select]'))) {
                            initCustomSelect(node);
                        } else if (node.querySelectorAll) {
                            window.initCustomSelects(node);
                        }
                    }
                }
            }
        });

        bodyObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Re-sincronizar automáticamente en modales de Bootstrap al abrirse
        document.addEventListener('show.bs.modal', (e) => {
            window.initCustomSelects(e.target);
        });
        document.addEventListener('shown.bs.modal', (e) => {
            window.initCustomSelects(e.target);
        });
    }

    // Arranque ordenado según el ciclo de vida del DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            inyectarEstilos();
            window.initCustomSelects();
            iniciarObservadorGlobal();
        });
    } else {
        inyectarEstilos();
        window.initCustomSelects();
        iniciarObservadorGlobal();
    }
})();
