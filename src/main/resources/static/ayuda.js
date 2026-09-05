/**
 * ============================================================================
 * BAEZ POS - MOTOR DEL CENTRO DE AYUDA CONTEXTUAL GLOBAL
 * ============================================================================
 * Inyecta dinámicamente el botón flotante (FAB) y el panel lateral (Offcanvas)
 * con el manual operativo interactivo y auto-despliegue según la pantalla activa.
 */
(function inicializarCentroAyuda() {
    'use strict';

    // Evitar doble inyección si el script es invocado múltiples veces
    if (document.getElementById('btnAyudaGlobal') || document.getElementById('offcanvasAyuda')) {
        return;
    }

    // Estilos complementarios para el FAB y el panel de ayuda
    const estilosAyuda = `
        #btnAyudaGlobal {
            position: fixed;
            bottom: 25px;
            right: 25px;
            z-index: 9998;
            border-radius: 50px;
            padding: 10px 22px;
            font-size: 0.95rem;
            letter-spacing: 0.3px;
            margin-left: 0 !important;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 4px 16px rgba(13, 110, 253, 0.35);
        }
        #btnAyudaGlobal:hover {
            transform: translateY(-3px) scale(1.03);
            box-shadow: 0 8px 24px rgba(13, 110, 253, 0.45);
        }
        #btnAyudaGlobal:active {
            transform: translateY(0) scale(0.98);
        }
        @media (max-width: 768px) {
            #btnAyudaGlobal {
                bottom: 80px;
                right: 16px;
                padding: 8px 16px;
                font-size: 0.85rem;
            }
        }
        #offcanvasAyuda {
            width: min(560px, 94vw);
            z-index: 9999;
            margin-left: 0 !important;
        }
        #offcanvasAyuda .accordion-button:not(.collapsed) {
            background-color: rgba(13, 110, 253, 0.08);
            color: #0d6efd;
            font-weight: 700;
        }
        #offcanvasAyuda .accordion-button:focus {
            box-shadow: none;
            border-color: rgba(13, 110, 253, 0.2);
        }
        #offcanvasAyuda kbd {
            background-color: #212529;
            color: #fff;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 0.78rem;
            box-shadow: 0 1px 2px rgba(0,0,0,0.2);
        }
        .ayuda-step-num {
            width: 24px;
            height: 24px;
            background-color: #0d6efd;
            color: #fff;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 0.75rem;
            font-weight: bold;
            margin-right: 8px;
            flex-shrink: 0;
        }
    `;

    function inyectarEstilos() {
        const styleEl = document.createElement('style');
        styleEl.id = 'estilos-ayuda-contextual';
        styleEl.textContent = estilosAyuda;
        document.head.appendChild(styleEl);
    }

    function inyectarDOMAyuda() {
        // 1. Botón Flotante (FAB)
        const btnFAB = document.createElement('button');
        btnFAB.id = 'btnAyudaGlobal';
        btnFAB.type = 'button';
        btnFAB.className = 'btn btn-primary d-flex align-items-center gap-2 fw-bold text-white';
        btnFAB.setAttribute('aria-label', 'Abrir Centro de Ayuda');
        btnFAB.innerHTML = `
            <i class="bi bi-question-circle-fill fs-5"></i>
            <span>Ayuda</span>
        `;

        // 2. Offcanvas de Bootstrap
        const offcanvasEl = document.createElement('div');
        offcanvasEl.id = 'offcanvasAyuda';
        offcanvasEl.className = 'offcanvas offcanvas-end shadow-lg border-0';
        offcanvasEl.setAttribute('tabindex', '-1');
        offcanvasEl.setAttribute('aria-labelledby', 'offcanvasAyudaLabel');

        offcanvasEl.innerHTML = `
            <!-- Encabezado del Offcanvas -->
            <div class="offcanvas-header bg-primary text-white p-3 px-4">
                <div class="d-flex align-items-center gap-2">
                    <div class="p-2 bg-white bg-opacity-20 rounded-circle text-white d-flex align-items-center justify-content-center" style="width: 38px; height: 38px;">
                        <i class="bi bi-book-half fs-5"></i>
                    </div>
                    <div>
                        <h5 class="offcanvas-title fw-bold m-0 fs-6" id="offcanvasAyudaLabel">Centro de Ayuda BAEZ POS</h5>
                        <small class="text-white-50" style="font-size: 0.72rem;">Manual Operativo y Base de Conocimiento</small>
                    </div>
                </div>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="offcanvas" aria-label="Cerrar"></button>
            </div>

            <!-- Buscador Rápido de Ayuda -->
            <div class="p-3 bg-light border-bottom">
                <div class="input-group input-group-sm">
                    <span class="input-group-text bg-white border-end-0"><i class="bi bi-search text-muted"></i></span>
                    <input type="text" id="filtroTemasAyuda" class="form-control border-start-0" placeholder="Buscar tema, atajo o función (ej: arqueo, f2, fiado)...">
                </div>
            </div>

            <!-- Cuerpo del Offcanvas (Acordeón por Módulos) -->
            <div class="offcanvas-body p-3 p-md-4">
                <div class="accordion accordion-flush" id="accordionManualUsuario">

                    <!-- MÓDULO 1: DASHBOARD -->
                    <div class="accordion-item border rounded-3 mb-2 overflow-hidden" data-tema="dashboard metricas ganancias liquidez kpis turnos">
                        <h2 class="accordion-header" id="headingDashboard">
                            <button class="accordion-button collapsed py-3" type="button" data-bs-toggle="collapse" data-bs-target="#collapseDashboard" aria-expanded="false" aria-controls="collapseDashboard">
                                <i class="bi bi-speedometer2 text-primary me-2 fs-5"></i>
                                <span>1. Dashboard y Métricas</span>
                            </button>
                        </h2>
                        <div id="collapseDashboard" class="accordion-collapse collapse" aria-labelledby="headingDashboard" data-bs-parent="#accordionManualUsuario">
                            <div class="accordion-body small text-secondary">
                                <p class="fw-semibold text-dark mb-2">Panel gerencial y analítico para la toma de decisiones financieras en tiempo real.</p>

                                <div class="mb-3">
                                    <h6 class="fw-bold text-dark mb-1">A. Lectura de Métricas del Mes (Vista Gerencial)</h6>
                                    <ul class="list-unstyled ps-1 mb-2">
                                        <li class="mb-1"><strong>Ventas del Mes:</strong> Total facturado y número de tickets emitidos.</li>
                                        <li class="mb-1"><strong>Gastos del Mes:</strong> Salidas de dinero operativas registradas.</li>
                                        <li class="mb-1"><strong>Ganancia Neta:</strong> Resultado comercial directo (<code>Ventas - Gastos</code>).</li>
                                        <li class="mb-1"><strong>Evolución Semanal:</strong> Gráfico de los últimos 7 días con los picos de recaudación.</li>
                                    </ul>
                                </div>

                                <div class="mb-3">
                                    <h6 class="fw-bold text-dark mb-1">B. Auditoría de Liquidez (Análisis Detallado)</h6>
                                    <ol class="ps-3 mb-2">
                                        <li>Pase a la pestaña <em>Análisis Detallado</em> y elija un período (<em>Hoy, Este Mes</em> o fechas manuales).</li>
                                        <li>Presione <strong>Filtrar</strong>.</li>
                                        <li>Examine <strong>Liquidez Total (Plata en Mano)</strong>: efectivo real en cajón más saldo digital neto (Ventas - Gastos).</li>
                                        <li>Audite la tabla de <strong>Turnos de Caja</strong> para comparar el efectivo recaudado vs el conteo declarado por el cajero.</li>
                                    </ol>
                                </div>

                                <div class="table-responsive mt-2">
                                    <table class="table table-sm table-striped table-bordered align-middle">
                                        <thead class="table-light"><tr><th>Atajo</th><th>Acción</th></tr></thead>
                                        <tbody>
                                            <tr><td><kbd>Tab</kbd></td><td>Navegación entre filtros de fecha</td></tr>
                                            <tr><td><kbd>Enter ↵</kbd></td><td>Ejecuta la búsqueda de métricas</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- MÓDULO 2: PUNTO DE VENTA (POS) -->
                    <div class="accordion-item border rounded-3 mb-2 overflow-hidden" data-tema="ventas pos caja arqueo cobrar ticket pesables vuelto f2 f4 f8 scanner">
                        <h2 class="accordion-header" id="headingVentas">
                            <button class="accordion-button collapsed py-3" type="button" data-bs-toggle="collapse" data-bs-target="#collapseVentas" aria-expanded="false" aria-controls="collapseVentas">
                                <i class="bi bi-cart-check-fill text-success me-2 fs-5"></i>
                                <span>2. Punto de Venta (Terminal POS y Caja)</span>
                            </button>
                        </h2>
                        <div id="collapseVentas" class="accordion-collapse collapse" aria-labelledby="headingVentas" data-bs-parent="#accordionManualUsuario">
                            <div class="accordion-body small text-secondary">
                                <p class="fw-semibold text-dark mb-2">Terminal ultra-rápida optimizada para el mostrador. Diseñada para operar sin mouse.</p>

                                <div class="mb-3">
                                    <h6 class="fw-bold text-dark mb-1">A. Apertura de Caja</h6>
                                    <ol class="ps-3 mb-2">
                                        <li>Presione el botón superior <strong>Abrir Caja</strong>.</li>
                                        <li>Ingrese el fondo de cambio en <strong>Monto Inicial ($)</strong>.</li>
                                        <li>Presione <kbd>Enter ↵</kbd> para habilitar la facturación.</li>
                                    </ol>
                                </div>

                                <div class="mb-3">
                                    <h6 class="fw-bold text-dark mb-1">B. Proceso de Venta Ágil</h6>
                                    <ol class="ps-3 mb-2">
                                        <li>Presione <kbd>F2</kbd> para ir al buscador o escanee directamente el código de barras (el sistema atrapará los números).</li>
                                        <li>Navegue sugerencias con <kbd>↓</kbd> / <kbd>↑</kbd> y presione <kbd>Enter ↵</kbd> para sumar al carrito.</li>
                                        <li>Para artículos pesables, ingrese los gramos/kilos o el importe en dinero y confirme con <kbd>Enter ↵</kbd>.</li>
                                        <li>Elija el medio de pago: <em>Efectivo</em>, <em>Transferencia/QR</em> o <em>Cuenta Corriente (Fiado)</em>.</li>
                                        <li>En efectivo, escriba el valor entregado en <strong>Paga Con ($)</strong> para ver el vuelto gigante en pantalla.</li>
                                        <li>Presione <kbd>Enter ↵</kbd> o <kbd>F4</kbd> para cerrar la venta y emitir el ticket.</li>
                                    </ol>
                                </div>

                                <div class="mb-3">
                                    <h6 class="fw-bold text-dark mb-1">C. Cierre de Turno (Arqueo Ciego)</h6>
                                    <ol class="ps-3 mb-2">
                                        <li>Haga clic en el botón rojo <strong>Cerrar Caja</strong>.</li>
                                        <li>Cuente el dinero físico del cajón y digítelo en <strong>Efectivo Físico Contado</strong>.</li>
                                        <li>Presione <kbd>Enter ↵</kbd> para confirmar. El sistema auditará si hubo sobrante o faltante.</li>
                                    </ol>
                                </div>

                                <div class="table-responsive mt-2">
                                    <table class="table table-sm table-striped table-bordered align-middle">
                                        <thead class="table-light"><tr><th>Atajo</th><th>Función</th></tr></thead>
                                        <tbody>
                                            <tr><td><kbd>F2</kbd></td><td>Foco inmediato al buscador de productos</td></tr>
                                            <tr><td><kbd>F4</kbd></td><td>Confirmar y finalizar venta</td></tr>
                                            <tr><td><kbd>F8</kbd></td><td>Cancelar venta y vaciar carrito</td></tr>
                                            <tr><td><kbd>Escape</kbd></td><td>Cerrar listas de sugerencias y reenfocar</td></tr>
                                            <tr><td><kbd>Enter ↵</kbd></td><td>Confirmar cobro en input "Paga Con"</td></tr>
                                            <tr><td><kbd>0-9</kbd></td><td>Captura automática para lectores de código de barras</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- MÓDULO 3: PRODUCTOS -->
                    <div class="accordion-item border rounded-3 mb-2 overflow-hidden" data-tema="productos inventario stock precios ean codigo barras costo balanza papelera">
                        <h2 class="accordion-header" id="headingProductos">
                            <button class="accordion-button collapsed py-3" type="button" data-bs-toggle="collapse" data-bs-target="#collapseProductos" aria-expanded="false" aria-controls="collapseProductos">
                                <i class="bi bi-box-seam-fill text-info me-2 fs-5"></i>
                                <span>3. Catálogo e Inventario</span>
                            </button>
                        </h2>
                        <div id="collapseProductos" class="accordion-collapse collapse" aria-labelledby="headingProductos" data-bs-parent="#accordionManualUsuario">
                            <div class="accordion-body small text-secondary">
                                <p class="fw-semibold text-dark mb-2">Administración de precios, márgenes de utilidad, existencias y códigos de barra.</p>

                                <div class="mb-3">
                                    <h6 class="fw-bold text-dark mb-1">A. Alta de Producto</h6>
                                    <ol class="ps-3 mb-2">
                                        <li>Presione el botón <strong>+ Nuevo</strong>.</li>
                                        <li>Ingrese Nombre y Código de Barras (escanee o presione la <em>varita mágica</em> para generar un EAN interno).</li>
                                        <li>Complete <strong>Costo ($)</strong> y <strong>Precio Venta ($)</strong>: el sistema calculará el margen de ganancia automático.</li>
                                        <li>Defina <strong>Stock Actual</strong> y <strong>Stock Mínimo</strong> (alerta visual de reposición).</li>
                                        <li>Si se vende al peso, active el interruptor <em>Producto Pesable / Fracción</em>.</li>
                                        <li>Presione <kbd>Enter ↵</kbd> para guardar.</li>
                                    </ol>
                                </div>

                                <div class="mb-3">
                                    <h6 class="fw-bold text-dark mb-1">B. Etiquetas de Góndola y Papelera</h6>
                                    <ul class="list-unstyled ps-1 mb-2">
                                        <li class="mb-1"><strong>Imprimir Etiqueta:</strong> Haga clic en el ícono de código de barras en cualquier fila para imprimir la etiqueta para estanterías.</li>
                                        <li class="mb-1"><strong>Papelera:</strong> Los productos eliminados van a la papelera (baja lógica). Puede restaurarlos en cualquier momento sin perder historiales.</li>
                                    </ul>
                                </div>

                                <div class="table-responsive mt-2">
                                    <table class="table table-sm table-striped table-bordered align-middle">
                                        <thead class="table-light"><tr><th>Atajo</th><th>Función</th></tr></thead>
                                        <tbody>
                                            <tr><td><kbd>0-9</kbd></td><td>Foco al buscador de productos</td></tr>
                                            <tr><td><kbd>Enter ↵</kbd></td><td>Filtrar tabla / Guardar producto en modal</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- MÓDULO 4: CLIENTES -->
                    <div class="accordion-item border rounded-3 mb-2 overflow-hidden" data-tema="clientes libreta fiados deuda cobrar limite saldo whatsapp">
                        <h2 class="accordion-header" id="headingClientes">
                            <button class="accordion-button collapsed py-3" type="button" data-bs-toggle="collapse" data-bs-target="#collapseClientes" aria-expanded="false" aria-controls="collapseClientes">
                                <i class="bi bi-people-fill text-warning me-2 fs-5"></i>
                                <span>4. Clientes y Cuentas Corrientes</span>
                            </button>
                        </h2>
                        <div id="collapseClientes" class="accordion-collapse collapse" aria-labelledby="headingClientes" data-bs-parent="#accordionManualUsuario">
                            <div class="accordion-body small text-secondary">
                                <p class="fw-semibold text-dark mb-2">Control de clientes deudores, libreta de fiados y límites de crédito.</p>

                                <div class="mb-3">
                                    <h6 class="fw-bold text-dark mb-1">A. Crear Cliente con Límite</h6>
                                    <ol class="ps-3 mb-2">
                                        <li>Presione <strong>Nuevo Cliente</strong>.</li>
                                        <li>Complete Nombre, Teléfono/WhatsApp y <strong>Límite de Crédito ($)</strong> para evitar deudas excesivas.</li>
                                        <li>Guarde con <kbd>Enter ↵</kbd>.</li>
                                    </ol>
                                </div>

                                <div class="mb-3">
                                    <h6 class="fw-bold text-dark mb-1">B. Cobro de Fiado</h6>
                                    <ol class="ps-3 mb-2">
                                        <li>En la fila del cliente deudor, presione el botón verde <strong>Cobrar</strong>.</li>
                                        <li>Ingrese el monto que entrega y seleccione el destino: <em>Efectivo</em> (ingresa a caja del turno) o <em>Transferencia</em>.</li>
                                        <li>Presione <kbd>Enter ↵</kbd> para asentar el abono y reducir la deuda.</li>
                                    </ol>
                                </div>

                                <div class="mb-3">
                                    <h6 class="fw-bold text-dark mb-1">C. Enviar Libreta por WhatsApp</h6>
                                    <p class="mb-1">Abra el <strong>Historial / Libreta</strong> del cliente y haga clic en <em>Compartir por WhatsApp</em> para enviar el estado de cuenta formateado.</p>
                                </div>

                                <div class="table-responsive mt-2">
                                    <table class="table table-sm table-striped table-bordered align-middle">
                                        <thead class="table-light"><tr><th>Atajo</th><th>Función</th></tr></thead>
                                        <tbody>
                                            <tr><td><kbd>Enter ↵</kbd></td><td>Guardar cliente / Confirmar pago de deuda</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- MÓDULO 5: PROVEEDORES -->
                    <div class="accordion-item border rounded-3 mb-2 overflow-hidden" data-tema="proveedores ordenes compra pagar abono facturas pedidos whatsapp">
                        <h2 class="accordion-header" id="headingProveedores">
                            <button class="accordion-button collapsed py-3" type="button" data-bs-toggle="collapse" data-bs-target="#collapseProveedores" aria-expanded="false" aria-controls="collapseProveedores">
                                <i class="bi bi-truck text-secondary me-2 fs-5"></i>
                                <span>5. Proveedores y Órdenes de Compra</span>
                            </button>
                        </h2>
                        <div id="collapseProveedores" class="accordion-collapse collapse" aria-labelledby="headingProveedores" data-bs-parent="#accordionManualUsuario">
                            <div class="accordion-body small text-secondary">
                                <p class="fw-semibold text-dark mb-2">Administración de distribuidores mayoristas, pagos de facturas y pedidos de reposición.</p>

                                <div class="mb-3">
                                    <h6 class="fw-bold text-dark mb-1">A. Registrar Pago a Proveedor (Abono)</h6>
                                    <ol class="ps-3 mb-2">
                                        <li>Haga clic en <strong>Abonar</strong> en la fila del proveedor.</li>
                                        <li>Ingrese el importe y el medio de pago.</li>
                                        <li>Active <em>Descontar del Flujo / Arqueo</em> si el dinero salió de la caja física actual.</li>
                                        <li>Confirme con <kbd>Enter ↵</kbd>.</li>
                                    </ol>
                                </div>

                                <div class="mb-3">
                                    <h6 class="fw-bold text-dark mb-1">B. Generar Orden de Compra</h6>
                                    <ol class="ps-3 mb-2">
                                        <li>Presione <strong>Generar Orden de Compra</strong>.</li>
                                        <li>Elija el proveedor y busque productos en el catálogo interactivo.</li>
                                        <li>Ajuste cantidades y observe la columna <em>Stock Resultante</em>.</li>
                                        <li>Presione <kbd>Enter ↵</kbd> y elija <strong>WhatsApp</strong> para enviar el pedido armado.</li>
                                    </ol>
                                </div>

                                <div class="table-responsive mt-2">
                                    <table class="table table-sm table-striped table-bordered align-middle">
                                        <thead class="table-light"><tr><th>Atajo</th><th>Función</th></tr></thead>
                                        <tbody>
                                            <tr><td><kbd>Enter ↵</kbd></td><td>Guardar proveedor / Confirmar abono / Emitir orden</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- MÓDULO 6: GASTOS -->
                    <div class="accordion-item border rounded-3 mb-2 overflow-hidden" data-tema="gastos egresos salidas dinero alquiler servicios sueldos caja">
                        <h2 class="accordion-header" id="headingGastos">
                            <button class="accordion-button collapsed py-3" type="button" data-bs-toggle="collapse" data-bs-target="#collapseGastos" aria-expanded="false" aria-controls="collapseGastos">
                                <i class="bi bi-wallet2 text-danger me-2 fs-5"></i>
                                <span>6. Gastos y Egresos Operativos</span>
                            </button>
                        </h2>
                        <div id="collapseGastos" class="accordion-collapse collapse" aria-labelledby="headingGastos" data-bs-parent="#accordionManualUsuario">
                            <div class="accordion-body small text-secondary">
                                <p class="fw-semibold text-dark mb-2">Control contable de salidas de dinero (sueldos, servicios, alquiler, insumos).</p>

                                <div class="mb-3">
                                    <h6 class="fw-bold text-dark mb-1">A. Cargar un Nuevo Egreso</h6>
                                    <ol class="ps-3 mb-2">
                                        <li>Presione el botón rojo <strong>+ Registrar Gasto</strong>.</li>
                                        <li>Indique Monto, Categoría (<em>Servicios, Sueldos, Alquiler, etc.</em>) y Medio de Pago.</li>
                                        <li>Escriba el motivo detallado en <em>Concepto</em>.</li>
                                        <li>Si los billetes salieron de la registradora, mantenga activo <em>Descontar del Flujo</em>.</li>
                                        <li>Presione <kbd>Enter ↵</kbd> para asentar el gasto.</li>
                                    </ol>
                                </div>

                                <div class="table-responsive mt-2">
                                    <table class="table table-sm table-striped table-bordered align-middle">
                                        <thead class="table-light"><tr><th>Atajo</th><th>Función</th></tr></thead>
                                        <tbody>
                                            <tr><td><kbd>Enter ↵</kbd></td><td>Guardar y procesar asiento de gasto</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- MÓDULO 7: HISTORIAL -->
                    <div class="accordion-item border rounded-3 mb-2 overflow-hidden" data-tema="historial ventas tickets reimprimir factura a4 anular devolucion excel pdf">
                        <h2 class="accordion-header" id="headingHistorial">
                            <button class="accordion-button collapsed py-3" type="button" data-bs-toggle="collapse" data-bs-target="#collapseHistorial" aria-expanded="false" aria-controls="collapseHistorial">
                                <i class="bi bi-clock-history text-primary me-2 fs-5"></i>
                                <span>7. Historial y Auditoría de Ventas</span>
                            </button>
                        </h2>
                        <div id="collapseHistorial" class="accordion-collapse collapse" aria-labelledby="headingHistorial" data-bs-parent="#accordionManualUsuario">
                            <div class="accordion-body small text-secondary">
                                <p class="fw-semibold text-dark mb-2">Auditoría retrospectiva, reimpresión y anulación protegida de comprobantes.</p>

                                <div class="mb-3">
                                    <h6 class="fw-bold text-dark mb-1">A. Reimpresión de Comprobante</h6>
                                    <ol class="ps-3 mb-2">
                                        <li>Haga clic en <strong>Ver Detalle</strong> (ojo) en la venta deseada.</li>
                                        <li>Elija <strong>Imprimir Ticket (80mm)</strong> para comandera o <strong>Exportar A4 / PDF</strong> para factura formal.</li>
                                    </ol>
                                </div>

                                <div class="mb-3">
                                    <h6 class="fw-bold text-dark mb-1">B. Anulación Segura de Venta</h6>
                                    <ol class="ps-3 mb-2">
                                        <li>Presione el botón rojo de <strong>Anular</strong> en la fila del comprobante.</li>
                                        <li>Ingrese el <strong>PIN de Administrador</strong> si el sistema lo requiere.</li>
                                        <li>El stock se reingresará de inmediato y el dinero se restará de los totales de caja.</li>
                                    </ol>
                                </div>

                                <div class="table-responsive mt-2">
                                    <table class="table table-sm table-striped table-bordered align-middle">
                                        <thead class="table-light"><tr><th>Atajo</th><th>Función</th></tr></thead>
                                        <tbody>
                                            <tr><td><kbd>Enter ↵</kbd></td><td>Buscar comprobantes filtrados</td></tr>
                                            <tr><td><kbd>Escape</kbd></td><td>Cerrar visualizador de comprobante</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- MÓDULO 8: EMPLEADOS -->
                    <div class="accordion-item border rounded-3 mb-2 overflow-hidden" data-tema="empleados usuarios personal cajeros roles admin vendedor pin seguridad">
                        <h2 class="accordion-header" id="headingEmpleados">
                            <button class="accordion-button collapsed py-3" type="button" data-bs-toggle="collapse" data-bs-target="#collapseEmpleados" aria-expanded="false" aria-controls="collapseEmpleados">
                                <i class="bi bi-person-badge-fill text-dark me-2 fs-5"></i>
                                <span>8. Empleados y Seguridad (Roles/PIN)</span>
                            </button>
                        </h2>
                        <div id="collapseEmpleados" class="accordion-collapse collapse" aria-labelledby="headingEmpleados" data-bs-parent="#accordionManualUsuario">
                            <div class="accordion-body small text-secondary">
                                <p class="fw-semibold text-dark mb-2">Gobierno de accesos, roles diferenciados y PIN de autorización para caja.</p>

                                <div class="mb-3">
                                    <h6 class="fw-bold text-dark mb-1">A. Crear Usuario con PIN</h6>
                                    <ol class="ps-3 mb-2">
                                        <li>Presione <strong>+ Nuevo Empleado</strong>.</li>
                                        <li>Ingrese Nombre, Correo y Contraseña inicial.</li>
                                        <li>Asigne el Rol: <code>VENDEDOR</code> (solo Punto de Venta) o <code>ADMIN</code> (acceso total).</li>
                                        <li>Active <em>Asignar PIN de Seguridad</em> e ingrese 4 a 6 dígitos numéricos.</li>
                                        <li>Guarde con <kbd>Enter ↵</kbd>.</li>
                                    </ol>
                                </div>

                                <div class="table-responsive mt-2">
                                    <table class="table table-sm table-striped table-bordered align-middle">
                                        <thead class="table-light"><tr><th>Atajo</th><th>Función</th></tr></thead>
                                        <tbody>
                                            <tr><td><kbd>Enter ↵</kbd></td><td>Guardar empleado y PIN de seguridad</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- MÓDULO 9: MI NEGOCIO -->
                    <div class="accordion-item border rounded-3 mb-2 overflow-hidden" data-tema="perfil negocio configuracion afip arca fiscal cuit iibb ticket contraseña clave">
                        <h2 class="accordion-header" id="headingPerfil">
                            <button class="accordion-button collapsed py-3" type="button" data-bs-toggle="collapse" data-bs-target="#collapsePerfil" aria-expanded="false" aria-controls="collapsePerfil">
                                <i class="bi bi-gear-fill text-primary me-2 fs-5"></i>
                                <span>9. Mi Negocio y Parámetros Fiscales</span>
                            </button>
                        </h2>
                        <div id="collapsePerfil" class="accordion-collapse collapse" aria-labelledby="headingPerfil" data-bs-parent="#accordionManualUsuario">
                            <div class="accordion-body small text-secondary">
                                <p class="fw-semibold text-dark mb-2">Parámetros del comercio, membrete térmico, impuestos y contraseña.</p>

                                <div class="mb-3">
                                    <h6 class="fw-bold text-dark mb-1">A. Calibrar Ticket Térmico en Vivo</h6>
                                    <ol class="ps-3 mb-2">
                                        <li>Complete Nombre Comercial, CUIT, Teléfono, Dirección y <em>Mensaje al Pie</em>.</li>
                                        <li>Compruebe en tiempo real la columna derecha de <strong>Vista Previa del Ticket</strong> antes de imprimir.</li>
                                        <li>Guarde con el botón <strong>Guardar Configuración</strong>.</li>
                                    </ol>
                                </div>

                                <div class="mb-3">
                                    <h6 class="fw-bold text-dark mb-1">B. Datos Fiscales (ARCA / AFIP)</h6>
                                    <p class="mb-1">Active el interruptor fiscal y complete Nro. IIBB, Inicio de Actividades y Condición IVA para habilitar los bloques reglamentarios con QR.</p>
                                </div>

                                <div class="table-responsive mt-2">
                                    <table class="table table-sm table-striped table-bordered align-middle">
                                        <thead class="table-light"><tr><th>Atajo</th><th>Función</th></tr></thead>
                                        <tbody>
                                            <tr><td><kbd>Enter ↵</kbd></td><td>Guardar configuración del negocio</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- SECCIÓN CONSOLIDADA: CHEAT SHEET GLOBAL DE ATAJOS -->
                    <div class="accordion-item border rounded-3 mb-2 overflow-hidden" data-tema="atajos teclado hotkeys cheat sheet f2 f4 f8 enter escape">
                        <h2 class="accordion-header" id="headingAtajosGlobales">
                            <button class="accordion-button collapsed py-3" type="button" data-bs-toggle="collapse" data-bs-target="#collapseAtajosGlobales" aria-expanded="false" aria-controls="collapseAtajosGlobales">
                                <i class="bi bi-keyboard-fill text-danger me-2 fs-5"></i>
                                <span>Tabla Resumen de Atajos (Cheat Sheet)</span>
                            </button>
                        </h2>
                        <div id="collapseAtajosGlobales" class="accordion-collapse collapse" aria-labelledby="headingAtajosGlobales" data-bs-parent="#accordionManualUsuario">
                            <div class="accordion-body small text-secondary">
                                <p class="fw-semibold text-dark mb-2">Guía rápida de teclas maestras para operar a máxima velocidad en el mostrador:</p>
                                <div class="table-responsive">
                                    <table class="table table-sm table-striped table-bordered align-middle">
                                        <thead class="table-dark">
                                            <tr><th style="width: 25%;">Tecla</th><th>Acción Realizada</th><th>Pantalla</th></tr>
                                        </thead>
                                        <tbody>
                                            <tr><td><kbd class="bg-primary">F2</kbd></td><td>Enfocar buscador de productos</td><td>Punto de Venta</td></tr>
                                            <tr><td><kbd class="bg-success">F4</kbd></td><td>Confirmar y finalizar venta</td><td>Punto de Venta</td></tr>
                                            <tr><td><kbd class="bg-danger">F8</kbd></td><td>Cancelar venta / Vaciar carrito</td><td>Punto de Venta</td></tr>
                                            <tr><td><kbd>Escape</kbd></td><td>Cerrar sugerencias y modales</td><td>Global</td></tr>
                                            <tr><td><kbd>Enter ↵</kbd></td><td>Cerrar venta directa (en Paga Con)</td><td>Punto de Venta</td></tr>
                                            <tr><td><kbd>Enter ↵</kbd></td><td>Guardar formulario o modal</td><td>Todos los modales</td></tr>
                                            <tr><td><kbd>0-9</kbd></td><td>Captura automática para escaneo EAN</td><td>POS y Productos</td></tr>
                                            <tr><td><kbd>↓</kbd> / <kbd>↑</kbd></td><td>Navegar productos sugeridos</td><td>Punto de Venta</td></tr>
                                            <tr><td><kbd>Tab</kbd></td><td>Avanzar de campo en formularios</td><td>Global</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            <!-- Footer del Offcanvas con enlace a soporte -->
            <div class="offcanvas-footer p-3 bg-light border-top d-flex justify-content-between align-items-center">
                <small class="text-muted"><i class="bi bi-shield-check me-1 text-success"></i> BAEZ POS SaaS v2.0</small>
                <button type="button" class="btn btn-sm btn-outline-secondary" data-bs-dismiss="offcanvas">Cerrar Guía</button>
            </div>
        `;

        document.body.appendChild(btnFAB);
        document.body.appendChild(offcanvasEl);
    }

    /**
     * Mapea la ruta actual a su respectivo ID de acordeón
     */
    function resolverModuloContextual() {
        const path = (window.location.pathname || '').toLowerCase();
        if (path.includes('ventas')) return 'collapseVentas';
        if (path.includes('producto')) return 'collapseProductos';
        if (path.includes('cliente')) return 'collapseClientes';
        if (path.includes('proveedor')) return 'collapseProveedores';
        if (path.includes('gasto')) return 'collapseGastos';
        if (path.includes('historial')) return 'collapseHistorial';
        if (path.includes('empleado')) return 'collapseEmpleados';
        if (path.includes('perfil') || path.includes('negocio')) return 'collapsePerfil';
        if (path.includes('dashboard')) return 'collapseDashboard';
        return null;
    }

    /**
     * Auto-despliega suavemente la sección correspondiente al abrir el offcanvas
     */
    function desplegarModuloContextual() {
        const targetId = resolverModuloContextual();
        if (!targetId) return;

        const targetEl = document.getElementById(targetId);
        if (!targetEl) return;

        if (typeof bootstrap !== 'undefined' && bootstrap.Collapse) {
            const bsCollapse = bootstrap.Collapse.getOrCreateInstance(targetEl, { toggle: false });
            bsCollapse.show();
        } else {
            targetEl.classList.add('show');
        }

        setTimeout(() => {
            const cardParent = targetEl.closest('.accordion-item');
            if (cardParent) {
                cardParent.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 250);
    }

    /**
     * Inicializa los listeners de eventos para el FAB, el Offcanvas y el buscador rápido
     */
    function vincularEventos() {
        const btnFAB = document.getElementById('btnAyudaGlobal');
        const offcanvasEl = document.getElementById('offcanvasAyuda');

        if (!btnFAB || !offcanvasEl) return;

        // Abrir Offcanvas vía API de Bootstrap 5
        btnFAB.addEventListener('click', () => {
            if (typeof bootstrap !== 'undefined' && bootstrap.Offcanvas) {
                const instanciaOffcanvas = bootstrap.Offcanvas.getOrCreateInstance(offcanvasEl);
                instanciaOffcanvas.show();
            } else {
                offcanvasEl.classList.add('show');
            }
        });

        // Evento de apertura para auto-despliegue contextual
        offcanvasEl.addEventListener('shown.bs.offcanvas', () => {
            desplegarModuloContextual();
            const inputFiltro = document.getElementById('filtroTemasAyuda');
            if (inputFiltro) {
                inputFiltro.focus();
            }
        });

        // Buscador reactivo dentro del manual
        const inputFiltro = document.getElementById('filtroTemasAyuda');
        if (inputFiltro) {
            inputFiltro.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase().trim();
                const items = document.querySelectorAll('#accordionManualUsuario .accordion-item');

                items.forEach((item) => {
                    const dataTema = (item.getAttribute('data-tema') || '').toLowerCase();
                    const textContent = item.textContent.toLowerCase();

                    if (!term || dataTema.includes(term) || textContent.includes(term)) {
                        item.classList.remove('d-none');
                    } else {
                        item.classList.add('d-none');
                    }
                });
            });
        }
    }

    // Arranque ordenado según el ciclo de vida del DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            inyectarEstilos();
            inyectarDOMAyuda();
            vincularEventos();
        });
    } else {
        inyectarEstilos();
        inyectarDOMAyuda();
        vincularEventos();
    }
})();
