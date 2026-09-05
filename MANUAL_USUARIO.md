# BAEZ POS — Manual Integral de Usuario y Base de Conocimiento Operativa

Bienvenido al Manual Operativo Oficial de **BAEZ POS (SaaS Multi-tenant)**. Este documento fue diseñado como la base de conocimiento de referencia para cajeros, encargados de sucursal, administradores y propietarios de comercio. En él se describen paso a paso las operaciones comerciales críticas, el comportamiento de los algoritmos de cálculo, la gestión de inventario y los atajos de teclado para agilizar la operatoria en mostrador.

---

## Tabla de Contenidos
1. [Arquitectura y Conceptos Generales](#arquitectura-y-conceptos-generales)
2. [Módulo 1: Dashboard (Panel de Control y Analítica)](#módulo-1-dashboard-panel-de-control-y-analítica)
3. [Módulo 2: Punto de Venta (Terminal POS y Caja)](#módulo-2-punto-de-venta-terminal-pos-y-caja)
4. [Módulo 3: Productos (Catálogo, Precios e Inventario)](#módulo-3-productos-catálogo-precios-e-inventario)
5. [Módulo 4: Clientes (Cuentas Corrientes y Libreta)](#módulo-4-clientes-cuentas-corrientes-y-libreta)
6. [Módulo 5: Proveedores (Abonos y Órdenes de Compra)](#módulo-5-proveedores-abonos-y-órdenes-de-compra)
7. [Módulo 6: Gastos (Egresos Operativos de Dinero)](#módulo-6-gastos-egresos-operativos-de-dinero)
8. [Módulo 7: Historial (Ventas, Comprobantes y Anulaciones)](#módulo-7-historial-ventas-comprobantes-y-anulaciones)
9. [Módulo 8: Empleados (Seguridad, Roles y PIN)](#módulo-8-empleados-seguridad-roles-y-pin)
10. [Módulo 9: Mi Negocio (Configuración y Facturación Fiscal)](#módulo-9-mi-negocio-configuración-y-facturación-fiscal)
11. [Cheat Sheet Global de Atajos de Teclado](#cheat-sheet-global-de-atajos-de-teclado)

---

## Arquitectura y Conceptos Generales

BAEZ POS opera bajo un modelo SaaS multi-empresa con persistencia relacional en backend y una interfaz web reactiva. Entre sus características operativas clave destacan:
- **Autofocus Inteligente:** Al abrir cualquier ventana modal, el cursor se sitúa de forma automática en el primer campo editable para comenzar a escribir sin utilizar el ratón.
- **Confirmación Nativa con <kbd>Enter ↵</kbd>:** Todos los formularios de captura y modales de confirmación procesan el guardado presionando la tecla <kbd>Enter ↵</kbd>.
- **Sincronización Híbrida Offline:** El Punto de Venta continúa registrando operaciones ante caídas momentáneas del suministro de internet mediante almacenamiento local indexado (`IndexedDB`), sincronizándolas automáticamente al restaurarse la conectividad.

---

## Módulo 1: Dashboard (Panel de Control y Analítica)

### Descripción Funcional
El Dashboard centraliza el pulso financiero y transaccional del negocio. No requiere recargar la página para actualizarse: recopila en tiempo real las ventas de caja, los egresos de dinero, la rentabilidad neta acumulada y los turnos de auditoría de los empleados.

Se divide en dos entornos de trabajo:
1. **Vista Gerencial:** Diseñada para una lectura rápida del estado del negocio en el mes en curso.
2. **Análisis Detallado:** Diseñada para realizar auditorías contables, consultar liquidez inmediata ("plata en mano") y fiscalizar los arqueos de turnos pasados.

---

### Operaciones Paso a Paso

#### Operación 1: Auditoría Rápida de Salud Financiera (Vista Gerencial)
1. Ingrese a la plataforma. Por defecto, el sistema lo ubicará en la pestaña **Vista Gerencial**.
2. Examine las cuatro tarjetas métricas superiores (KPIs):
   - **Ventas del Mes:** Indica el dinero total facturado en el mes calendario y el conteo de tickets cerrados.
   - **Gastos del Mes:** Importe acumulado de egresos operativos (sueldos, servicios, mercadería) y cantidad de asientos registrados.
   - **Ganancia Neta:** Resultado matemático directo (`Ventas - Gastos`). Si el valor se visualiza en verde, el comercio opera con superávit financiero.
   - **Deuda Proveedores:** Dinero adeudado actualmente a distribuidores comerciales.
3. Observe el gráfico **Evolución Semanal de Facturación**:
   - Cada barra vertical representa la recaudación diaria de los últimos 7 días.
   - Pase el cursor sobre una barra para ver la fecha exacta y el monto facturado. Este gráfico permite identificar los días de mayor afluencia comercial para planificar refuerzos de personal o compras mayoristas.
4. Revise las tablas comparativas al pie:
   - **Top 5 Productos Más Vendidos:** Permite conocer qué artículos no pueden faltar en stock. Puede hacer clic en el enlace *"Ver inventario"* para dirigirse directamente al catálogo.
   - **Últimos 5 Movimientos:** Muestra las ventas o egresos más recientes del negocio con su respectivo medio de pago.

---

#### Operación 2: Conciliación de Liquidez y Turnos de Caja (Análisis Detallado)
1. En la parte superior del Dashboard, haga clic en el botón de pestaña **Análisis Detallado**.
2. En la barra de filtros superior, defina el período que desea auditar:
   - Utilice el selector de presets para seleccionar opciones automáticas: **Hoy**, **Ayer**, **Este Mes**, **Mes Pasado**, **Últimos 3 Meses**, **Año Actual** o **Año Pasado**.
   - O bien, ingrese fechas específicas en los campos **Desde** y **Hasta**.
3. Presione el botón azul **Filtrar** (o presione <kbd>Enter ↵</kbd> sobre el botón).
4. Analice la tarjeta destacada **Liquidez Total (Plata en Mano)**:
   > [!NOTE]
   > La **Liquidez Total** representa el dinero genuino y disponible en el acto. Se calcula sumando el efectivo físico que debe estar en el cajón más el saldo digital cobrado por transferencias bancarias o billeteras virtuales (Mercado Pago), deduciendo los gastos y egresos del período.
5. Verifique el desglose de **Ingresos por Medio de Pago**:
   - **Efectivo Caja:** Monto neto en billetes generado por ventas más cobranzas de cuentas corrientes, descontando los gastos pagados desde la gaveta.
   - **Transferencias / QR:** Dinero digital ingresado a cuentas bancarias o billeteras virtuales.
   - **Fiados Cobrados:** Efectivo que ingresó al negocio proveniente de clientes que adeudaban compras pasadas (recupero de cartera).
   - **Fiado Emitido:** Mercadería despachada que aún no ingresó en dinero físico ni digital.
6. Desplácese a la sección **Turnos de Caja del Período**:
   - Cada fila detalla: Cajero responsable, hora exacta de apertura y hora de cierre, monto inicial de cambio, ventas en efectivo, cobros de libreta y gastos salidos del cajón.
   - **Total Cierre / Físico:** Muestra el dinero que el cajero declaró contar físicamente durante el arqueo ciego, permitiendo cotejar si existió sobrante o faltante de dinero respecto a las ventas del sistema.

---

### Atajos de Teclado del Dashboard
| Atajo | Acción | Contexto |
| :--- | :--- | :--- |
| <kbd>Tab</kbd> / <kbd>Shift+Tab</kbd> | Alterna entre los selectores de fechas y botones | Barra de filtros |
| <kbd>Enter ↵</kbd> | Dispara la consulta y actualiza las métricas | En el botón "Filtrar" |

---

## Módulo 2: Punto de Venta (Terminal POS y Caja)

### Descripción Funcional
El Punto de Venta (POS) es la interfaz operativa principal para el despacho ágil en mostrador. Ha sido optimizado para trabajar al 100% mediante atajos de teclado y lectores de código de barras láser/USB, prescindiendo por completo del ratón durante horas pico.

Soporta ventas con múltiples medios de pago, control de clientes fiados con validación de límite de crédito, productos por peso/balanza, emisión de tickets térmicos de 80mm y régimen de arqueo de caja ciego.

---

### Operaciones Paso a Paso

#### Operación 1: Apertura de Caja e Inicio de Turno
1. Al ingresar a `ventas.html`, si la caja de la sucursal se encuentra cerrada, el buscador y el botón de confirmar venta permanecerán deshabilitados para evitar transacciones sin control contable.
2. Haga clic en el botón verde superior **Abrir Caja** (o presione <kbd>Enter ↵</kbd> si el sistema muestra el aviso emergente).
3. Se abrirá el modal **Apertura de Caja**:
   - El cursor se ubicará de forma automática en el campo **Monto Inicial en Caja ($)**.
   - Escriba el importe de cambio base con el que arranca el turno (ej: `15000.00`).
4. Presione la tecla <kbd>Enter ↵</kbd> (o haga clic en el botón principal **Abrir Caja e Iniciar Turno <kbd>Enter ↵</kbd>**).
5. El sistema emitirá un sonido de confirmación, el indicador visual pasará a **Caja Abierta** y el cursor se colocará automáticamente en el buscador de productos listo para vender.

---

#### Operación 2: Cómo Registrar una Venta Completa en Mostrador
1. **Enfocar el Buscador:** Presione la tecla <kbd>F2</kbd> en cualquier momento para activar el buscador inteligente de productos.
2. **Cargar Productos:**
   - **Por Código de Barras:** Pase el lector óptico sobre el envase. El sistema detectará los dígitos de forma automática, buscará coincidencia exacta y sumará el producto al carrito de compras de inmediato.
   - **Por Nombre / Texto:** Escriba las primeras letras del artículo (ej: `coca`). Aparecerá una lista flotante de coincidencias:
     - Utilice las flechas <kbd>↓</kbd> y <kbd>↑</kbd> para navegar entre las opciones sugeridas.
     - Presione <kbd>Enter ↵</kbd> sobre el artículo deseado para agregarlo al carrito.
   - **Productos Pesables / Fraccionables (Balanza):**
     - Si el artículo fue configurado como fraccional (pesable), se abrirá automáticamente el modal emergente **Producto Pesable**.
     - El cursor se posicionará en el campo **Peso (Kg o Gramos)**. Ingrese la cantidad pesada (ej: `0.750` para 750 gramos).
     - Si el cliente solicita por importe de dinero (ej: "$500 de queso"), haga clic o presione <kbd>Tab</kbd> hacia el campo **Importe Deseado ($)** e ingrese el valor en pesos. El sistema calculará el peso proporcional de forma automática.
     - Presione <kbd>Enter ↵</kbd> para insertar el pesable al carrito.
3. **Modificar Cantidades o Quitar Artículos:**
   - En la tabla del carrito lateral, presione los botones `+` o `-` para modificar unidades.
   - Si desea anular un producto puntual del ticket, presione el ícono de tacho de basura en su fila.
4. **Vincular Cliente (Opcional):**
   - Si la venta es de mostrador general, se mantendrá como *"Consumidor Final"*.
   - Si la venta es para un cliente con cuenta corriente, presione sobre el campo **Asociar Cliente**, escriba el nombre o DNI del cliente y selecciónelo del listado desplegable.
5. **Aplicar Descuentos (Opcional):**
   - En el panel de liquidación, elija el tipo de descuento: `%` (porcentaje) o `$` (pesos).
   - Ingrese el valor numérico en el casillero correspondiente. El subtotal y total neto se recalcularán al instante.
6. **Seleccionar Método de Pago:**
   - Haga clic en el botón correspondiente según la forma de cobro: **Efectivo**, **Transferencia / QR** o **Cuenta Corriente (Fiado)**.
   - Si selecciona **Efectivo**, el foco se colocará automáticamente en el campo **Paga con ($)**.
7. **Cobro y Cálculo de Vuelto:**
   - Ingrese el monto en billetes entregado por el cliente (ej: si el total es `$3.200` y entrega `$5.000`, digite `5000`).
   - El sistema mostrará en números gigantes de color verde el vuelto exacto a entregar: `VUELTO: $1.800,00`.
8. **Finalizar Venta:**
   - Presione <kbd>Enter ↵</kbd> directamente en el campo *"Paga con"* **O BIEN** presione el atajo global <kbd>F4</kbd>.
   - La venta quedará asentada en la base de datos, el stock se descontará en tiempo real, se reproducirá el tono de éxito y se imprimirá el ticket de venta en la comandera térmica.
   - El carrito se limpiará y el foco retornará a <kbd>F2</kbd> listo para la siguiente transacción.

---

#### Operación 3: Cancelar o Limpiar una Venta en Curso
1. Si el cliente desiste de la compra antes de abonar, presione el atajo de teclado <kbd>F8</kbd>.
2. Se solicitará confirmación para vaciar el carrito:
   - Presione <kbd>Enter ↵</kbd> para confirmar el vaciado.
   - Todos los ítems cargados se descartarán sin alterar el stock del comercio ni los totales de caja.

---

#### Operación 4: Cierre de Turno y Arqueo Ciego
1. Al culminar el turno del cajero, presione el botón rojo **Cerrar Caja** en la barra superior.
2. Se desplegará el modal **Cierre y Arqueo de Caja**:
   > [!IMPORTANT]
   > Este sistema utiliza la metodología de **Arqueo Ciego**: el software deliberadamente NO le muestra al cajero cuánto dinero debería haber en el cajón. El cajero debe contar físicamente todos los billetes y monedas que tiene en la gaveta y declarar la cifra real.
3. En el campo **Efectivo Físico Contado ($)**, escriba el total exacto del conteo físico.
4. En el campo **Observaciones / Notas (Opcional)**, consigne cualquier eventualidad (ej: *"Se retiraron $20.000 para abonar flete"*).
5. Presione <kbd>Enter ↵</kbd> o haga clic en **Confirmar y Cerrar Caja**.
6. El sistema registrará el cierre del turno, calculará internamente si existió un sobrante o faltante de dinero respecto a las ventas del día, y bloqueará la terminal hasta que el siguiente cajero realice su apertura.

---

### Atajos de Teclado del Punto de Venta
| Atajo | Acción | Ámbito |
| :--- | :--- | :--- |
| <kbd>F2</kbd> | Enfoca instantáneamente el buscador de productos | Global en POS |
| <kbd>F4</kbd> | Confirma y finaliza la venta en curso | Global en POS |
| <kbd>F8</kbd> | Vacía el carrito y cancela la transacción | Global en POS |
| <kbd>Escape</kbd> | Cierra las listas flotantes de sugerencias y reenfoca el buscador | Global en POS |
| <kbd>Enter ↵</kbd> | Cierra la venta y emite el ticket | En el input "Paga con ($)" |
| <kbd>Enter ↵</kbd> | Confirma y da apertura al turno de caja | Modal "Apertura de Caja" |
| <kbd>Enter ↵</kbd> | Confirma los kilos/importe del artículo pesable | Modal "Producto Pesable" |
| <kbd>Enter ↵</kbd> | Agrega el producto seleccionado de la lista flotante | En buscador con sugerencias |
| <kbd>↓</kbd> / <kbd>↑</kbd> | Navega hacia abajo o hacia arriba entre productos sugeridos | En lista flotante de búsqueda |
| Dígitos <kbd>0-9</kbd> | Atrapa automáticamente el escaneo de código de barras | Global en POS (sin foco previo) |

---

## Módulo 3: Productos (Catálogo, Precios e Inventario)

### Descripción Funcional
Gestiona la totalidad del catálogo comercial del negocio. Permite controlar precios de costo, precios de venta al público, márgenes de ganancia, alertas de reposición de stock mínimo, generación de códigos de barras EAN internos, fraccionamiento de artículos por kilo y papelera de reciclaje con baja lógica.

---

### Operaciones Paso a Paso

#### Operación 1: Alta de un Nuevo Producto en Inventario
1. En la pantalla de Productos, presione el botón azul **+ Nuevo** (ubicado en el margen superior derecho).
2. Se abrirá el modal **Nuevo Producto** y el cursor se posicionará de inmediato en el campo **Nombre del Producto**:
   - Escriba el nombre claro y presentación comercial (ej: `Galletitas Chocolinas 250g`).
3. Complete los campos de identificación:
   - **Descripción / Notas (Opcional):** Aclare detalles de empaque o lote.
   - **Código de Barras:**
     - Si el producto tiene código comercial de fábrica, escanéelo con el lector óptico directamente en este casillero.
     - Si es un producto propio (panadería, carnicería, verduras) o carece de código, presione el botón de la **varita mágica** adyacente: el sistema autogenerará un código EAN interno único e irrepetible.
     - *Al presionar <kbd>Enter ↵</kbd> en este campo, el cursor avanzará automáticamente al campo de nombre sin cerrar el modal.*
4. Complete la información económica y categorización:
   - **Categoría:** Seleccione la familia correspondiente. Si la categoría no existe, presione el botón `+` para crearla sin abandonar el formulario.
   - **Costo ($):** Ingrese el precio neto de compra al proveedor (ej: `800.00`).
   - **Precio Venta ($):** Ingrese el precio final al público (ej: `1200.00`).
     > [!TIP]
     > El sistema calculará y mostrará en la tabla el porcentaje exacto de margen de ganancia que deja el producto (`((Venta - Costo) / Costo) * 100`).
5. Parámetros de Stock y Balanza:
   - **Stock Actual:** Existencias físicas iniciales en depósito o góndola.
   - **Stock Mínimo:** Cantidad crítica de reserva. Cuando las unidades bajen de este umbral, el producto se resaltará en rojo en la tabla advirtiendo la necesidad de reposición.
   - **Interruptor "Producto Pesable / Venta por Fracción (Kg/Granel)":**
     - Si el producto se vende por unidad (paquetes, botellas, latas), déjelo desactivado.
     - Si el producto se vende al peso (fiambres, panificados, carne, verduras fraccionadas), active este interruptor. Esto habilitará la venta fraccional con decimales en el Punto de Venta.
6. Presione la tecla <kbd>Enter ↵</kbd> o haga clic en **Guardar Producto <kbd>Enter ↵</kbd>**.
7. El producto se persistirá en la base de datos y aparecerá reflejado en el inventario.

---

#### Operación 2: Modificación Rápida de Precios o Corrección de Stock
1. Utilice el buscador general superior para tipear el nombre o código de barras del producto a modificar.
2. En la fila del artículo resultante, presione el botón de **Edición** (ícono de lápiz azul).
3. Se abrirá la ficha con todos los datos precargados:
   - Modifique el **Precio Venta ($)** o ajuste el **Stock Actual** de acuerdo con el recuento físico de góndola.
4. Presione <kbd>Enter ↵</kbd> para guardar las modificaciones.

---

#### Operación 3: Impresión de Etiquetas de Góndola con Código de Barras
1. Localice el producto en la tabla de inventario.
2. Haga clic en el botón **Imprimir Etiqueta** (ícono de etiqueta/código de barras en la columna de acciones).
3. El sistema preparará la vista de impresión optimizada (`@media print`):
   - Se imprimirá una etiqueta que incluye el nombre del comercio, nombre del artículo, código de barras legible para escáneres y precio de venta en tipografía destacada.
4. Confirme la impresión en su impresora de etiquetas térmica o comandera de 80mm.

---

#### Operación 4: Papelera de Reciclaje y Restauración de Productos
1. Para dar de baja un producto, haga clic en el botón de **Eliminar** (ícono de tacho rojo) en la fila correspondiente y confirme la acción.
   > [!NOTE]
   > El sistema realiza una **baja lógica** (`deleted = true`). El producto deja de aparecer en el catálogo y en el POS, pero las ventas pasadas registradas con ese producto conservan intacta su información histórica y fiscal.
2. Si eliminó un artículo por error, presione el botón **Papelera** en la barra superior.
3. En el modal emergente, busque el producto y haga clic en **Restaurar**: el producto regresará al catálogo activo con su stock y precio original sin haber perdido datos.

---

### Atajos de Teclado del Módulo Productos
| Atajo | Acción | Contexto |
| :--- | :--- | :--- |
| Dígitos <kbd>0-9</kbd> | Enfoca de inmediato el buscador de productos | Catálogo de productos |
| <kbd>Enter ↵</kbd> | Ejecuta la búsqueda o filtrado de la tabla | En el campo "Buscador" |
| <kbd>Enter ↵</kbd> | Salta del campo Código de Barras hacia Nombre | Modal "Nuevo Producto" |
| <kbd>Enter ↵</kbd> | Guarda y persiste el producto creado/editado | Modal "Nuevo Producto" |

---

## Módulo 4: Clientes (Cuentas Corrientes y Libreta)

### Descripción Funcional
Gestiona la cartera de clientes del establecimiento con foco en la administración segura de créditos en cuenta corriente (*"libreta de fiados"*). Permite establecer límites de crédito personalizados para mitigar riesgos de incobrabilidad, asentar pagos parciales o totales que impactan en caja y emitir resúmenes de deuda para enviar por WhatsApp.

---

### Operaciones Paso a Paso

#### Operación 1: Registrar un Cliente con Límite de Crédito
1. En la pantalla de Clientes, haga clic en el botón azul superior **Nuevo Cliente**.
2. Se abrirá el modal **Nuevo Cliente**:
   - **Nombre Completo (*):** Apellido y nombre o razón social del cliente.
   - **DNI / CUIT:** Documento de identidad fiscal.
   - **WhatsApp / Teléfono:** Teléfono con código de área (ej: `2641234567`). Se utilizará para despachar recordatorios de saldo.
   - **Límite de Crédito ($):** Tope de dinero que el comercio autoriza a este cliente a retirar bajo la modalidad de fiado (ej: `50000`). Si en el POS una venta a cuenta corriente supera este monto, el sistema impedirá la transacción protegiendo la liquidez del negocio.
3. Presione <kbd>Enter ↵</kbd> o haga clic en **Guardar Cliente <kbd>Enter ↵</kbd>**.

---

#### Operación 2: Cómo Registrar el Cobro de una Deuda (Abono de Libreta)
1. En la barra de búsqueda superior, ingrese el nombre o DNI del cliente.
   - *Consejo:* Active el interruptor **SOLO DEUDORES** para ocultar a los clientes con saldo en cero y visualizar únicamente a quienes mantienen pasivos con el local.
2. En la fila del cliente deudor, observe la columna **Saldo** (mostrada en color rojo indicando el monto pendiente).
3. Presione el botón verde **Cobrar** (ícono de billete con moneda).
4. Se abrirá el modal **Registrar Cobro de Deuda**:
   - En la parte superior observará la insignia destacada: `Deuda Pendiente Actual: $XX.XXX,XX`.
   - En el campo **Monto que entrega el cliente ($) (*)**, tipee la cantidad de dinero que el cliente está abonando (puede ser una cancelación total o un pago parcial a cuenta).
   - En **Método de Ingreso (*)**, seleccione:
     - **Efectivo:** El dinero se sumará de inmediato al arqueo físico de la caja del turno activo.
     - **Transferencia / QR:** El dinero se contabilizará como ingreso bancario/digital.
   - En **Referencia / Observación (Opcional)**, consigne el número de transferencia o comprobante de depósito.
5. Presione <kbd>Enter ↵</kbd> o haga clic en **Confirmar Pago <kbd>Enter ↵</kbd>**.
6. El sistema descontará la deuda del cliente, emitirá el recibo de cobro y reflejará la entrada de fondos en los balances del negocio.

---

#### Operación 3: Consultar la Libreta Digital y Enviar Resumen por WhatsApp
1. En la fila del cliente en cuestión, haga clic en el botón **Historial / Libreta** (ícono de reloj/historial).
2. Se desplegará la **Libreta de Cuenta Corriente**:
   - Podrá auditar cronológicamente cada compra a crédito (con fecha, número de ticket y detalle de artículos llevados) y cada entrega de dinero realizada por el cliente, junto al saldo remanente acumulado tras cada operación.
3. Para remitir el estado de cuenta al cliente, presione el botón verde **Compartir por WhatsApp**:
   - El sistema abrirá automáticamente WhatsApp Web o la app de escritorio con un mensaje pre-formateado que incluye el nombre del cliente, el saldo pendiente consolidado y el detalle de los últimos consumos.

---

### Atajos de Teclado del Módulo Clientes
| Atajo | Acción | Contexto |
| :--- | :--- | :--- |
| <kbd>Enter ↵</kbd> | Guarda y da de alta/modifica la ficha del cliente | Modal "Nuevo Cliente" |
| <kbd>Enter ↵</kbd> | Asienta el cobro del fiado y actualiza el saldo | Modal "Registrar Cobro" |

---

## Módulo 5: Proveedores (Abonos y Órdenes de Compra)

### Descripción Funcional
Centraliza las relaciones con proveedores y distribuidores comerciales. Facilita el seguimiento de deudas de compras mayoristas, la cancelación de facturas con impacto voluntario en el cajón de dinero y la generación ágil de órdenes de compra con catálogo interactivo y emisión directa a WhatsApp.

---

### Operaciones Paso a Paso

#### Operación 1: Registrar o Modificar un Proveedor
1. En la pantalla de Proveedores, haga clic en el botón superior **Nuevo Proveedor**.
2. Complete la ficha técnica:
   - **Razón Social / Nombre Comercial (*):** Identificación de la distribuidora.
   - **CUIT / DNI:** Clave fiscal del proveedor.
   - **Teléfono y Correo Electrónico:** Vías de contacto para el envío de pedidos.
   - **Saldo Adeudado Inicial ($ ARS):** Si al momento de dar de alta el proveedor en el software ya se le debía dinero por mercadería recibida previamente, digite aquí ese saldo histórico.
3. Presione <kbd>Enter ↵</kbd> o haga clic en **Guardar <kbd>Enter ↵</kbd>**.

---

#### Operación 2: Registrar Pago a Proveedor (Cancelación de Deuda Mayorista)
1. Localice al proveedor en la lista y presione el botón verde **Registrar Abono** (ícono de fajo de billetes).
2. En el modal emergente **Registrar Abono a Proveedor**:
   - Verifique en la cabecera el monto de la deuda actual.
   - Ingrese el importe a pagar en **Monto a Abonar ($ ARS) (*)**.
   - Elija el **Medio de Pago / Origen (*)**: `Efectivo de Caja` o `Transferencia Bancaria / QR`.
   - Ingrese el **N° de Recibo / Factura Cancelada** (ej: `FC-0001-00045123`).
   - Observe el interruptor **Descontar del Flujo / Arqueo**:
     - *Activado (recomendado si se paga en el mostrador):* Descuenta automáticamente los billetes de la caja del turno activo para que el arqueo de cierre cuadre perfecto.
     - *Desactivado:* Asienta la reducción de la deuda con el proveedor pero sin alterar el efectivo físico del cajón (útil si el dueño pagó con fondos personales externos).
3. Presione <kbd>Enter ↵</kbd> o haga clic en **Confirmar Abono <kbd>Enter ↵</kbd>**.

---

#### Operación 3: Generar y Despachar una Orden de Compra por WhatsApp
1. Presione el botón **Generar Orden de Compra** en la cabecera del módulo.
2. Se abrirá una terminal de pedidos interactiva dividida en dos columnas:
   - **Columna Izquierda (Selección):**
     - Seleccione el proveedor de destino en el menú desplegable.
     - En el buscador de catálogo, tipee el nombre de los productos que necesita reponer.
     - Haga clic sobre el producto sugerido para sumarlo al pedido.
   - **Columna Derecha (Proyección y Cantidades):**
     - En la tabla de la orden, modifique la columna **Cant.** (unidades a pedir) y verifique el **Costo Un.** acordado.
     - Observe la columna **STOCK RESULTANTE**: el sistema calcula automáticamente cuántas existencias quedarán en góndola una vez recibido el pedido (`Stock Actual + Cantidad Pedida`).
     - Al pie observará el total presupuestado de la orden de compra.
3. Presione la tecla <kbd>Enter ↵</kbd> o haga clic en **Generar y Enviar <kbd>Enter ↵</kbd>**.
4. El sistema registrará la orden y presentará una ventana con la opción de despacho:
   - Al presionar **WhatsApp**, se abrirá la conversación con el proveedor con el mensaje armado profesionalmente: listado detallado de ítems, cantidades requeridas, nombre de su comercio y total estimado de la compra.

---

### Atajos de Teclado del Módulo Proveedores
| Atajo | Acción | Contexto |
| :--- | :--- | :--- |
| <kbd>Enter ↵</kbd> | Guarda la ficha del nuevo proveedor | Modal "Nuevo Proveedor" |
| <kbd>Enter ↵</kbd> | Asienta el pago y descuenta la deuda mayorista | Modal "Registrar Abono" |
| <kbd>Enter ↵</kbd> | Confirma y emite la orden de compra | Modal "Generar Orden de Compra" |

---

## Módulo 6: Gastos (Egresos Operativos de Dinero)

### Descripción Funcional
Registra todas las erogaciones de dinero ajenas a la compra de mercadería a proveedores directos, tales como pago de sueldos o jornales, alquiler del local, servicios básicos (energía, agua, internet), compras de insumos (bolsas, rollos térmicos) o reparaciones edilicias.

---

### Operaciones Paso a Paso

#### Operación 1: Asentar un Nuevo Egreso de Caja o Banco
1. En la pantalla de Gastos, haga clic en el botón rojo superior **+ Registrar Gasto**.
2. En el modal **Registrar Nuevo Egreso de Dinero**, complete los campos del formulario:
   - **Monto ($ ARS) (*):** Valor neto del gasto (ej: `4500.00`).
   - **Fecha del Egreso (*):** Fecha del pago (por defecto, la fecha de hoy).
   - **Categoría / Tipo de Gasto (*):** Elija entre `Alquiler`, `Servicios Públicos`, `Sueldos / Retiros`, `Mercadería / Proveedor`, `Mantenimiento / Limpieza` o `Varios`.
   - **Origen / Medio de Pago (*):**
     - `Efectivo de Caja`: Salió de la caja registradora.
     - `Transferencia Bancaria`: Se pagó por homebanking.
     - `Caja Fuerte / Fondo de Reserva`: Fondos guardados fuera de la caja diaria.
     - `Cuenta Corriente Proveedor`: Incrementa la deuda con un proveedor.
   - **Concepto / Descripción Ampliada (*):** Escriba el motivo puntual (ej: *"Compra de 5 paquetes de rollos de papel térmico 80mm para comandera"*).
   - **N° Factura / Comprobante (Opcional):** Tique o factura fiscal del proveedor del servicio.
   - **Interruptor "Descontar del Flujo / Arqueo del Negocio":**
     - Manténgalo activado para que reste dinero de la caja física del cajero en servicio.
3. Presione la tecla <kbd>Enter ↵</kbd> o haga clic en **Guardar Gasto <kbd>Enter ↵</kbd>**.
4. El gasto se contabilizará de inmediato, impactará negativamente en la liquidez y se restará del total esperado en el arqueo de caja.

---

#### Operación 2: Filtrado y Auditoría de Gastos
1. Para analizar en qué rubros se está yendo el dinero del negocio, emplee los filtros de la barra superior:
   - Seleccione un intervalo en **Desde** y **Hasta**.
   - Filtre por una **Categoría** específica (ej: seleccionar solo *Servicios Públicos* para sumar los consumos de luz e internet del semestre).
   - Filtre por **Origen / Medio** para saber cuánto dinero se pagó en billetes y cuánto por vía electrónica.
2. Analice las tarjetas resumen que consolidan: **Total Gastos del Período**, **Egresos por Caja Física** y **Egresos por Banco/Digital**.

---

### Atajos de Teclado del Módulo Gastos
| Atajo | Acción | Contexto |
| :--- | :--- | :--- |
| <kbd>Enter ↵</kbd> | Guarda y procesa el asiento contable del gasto | Modal "Registrar Nuevo Gasto" |

---

## Módulo 7: Historial (Ventas, Comprobantes y Anulaciones)

### Descripción Funcional
Auditoría integral de la totalidad de las ventas finalizadas en la historia del establecimiento. Permite realizar consultas retrospectivas, reimprimir duplicados de tickets térmicos o facturas en tamaño A4, exportar datos hacia planillas de cálculo (Excel) y anular transacciones erróneas mediante un procedimiento seguro de reversión de inventario.

---

### Operaciones Paso a Paso

#### Operación 1: Búsqueda y Filtrado de Comprobantes Pasados
1. Ingrese a la pantalla de **Historial de Ventas**.
2. En la barra de filtros:
   - Especifique un rango en los campos **Desde** y **Hasta**.
   - En el selector **Pago**, filtre por `Todos`, `Efectivo`, `Transferencia` o `Libreta` según la naturaleza de la auditoría.
3. Haga clic en el botón azul **Buscar** (o presione <kbd>Enter ↵</kbd> en los campos de fecha).
4. La tabla presentará los comprobantes coincidentes detallando: Número de comprobante, fecha y hora exacta, nombre del cliente, cajero que efectuó la venta, medio de pago, descuentos aplicados y total final abonado.

---

#### Operación 2: Ver Detalle y Reimpresión de Comprobante
1. Localice la venta requerida en la tabla.
2. En la columna Acciones, haga clic en el botón **Ver Detalle** (ícono de ojo).
3. Se desplegará el modal del comprobante mostrando la composición detallada de la compra: unidades, artículos, subtotales y datos de liquidación.
4. Elija el formato de salida:
   - **Imprimir Ticket (80mm):** Remite la orden directa a la comandera de tickets térmicos de mostrador.
   - **Exportar A4 / PDF:** Renderiza una factura en formato hoja A4 profesional con membrete del comercio para imprimir en impresoras láser/chorro de tinta o guardar como archivo digital.
5. Para cerrar el modal, presione la tecla <kbd>Escape</kbd>.

---

#### Operación 3: Cómo Anular una Venta con Devolución de Stock
1. Si un cliente devolvió un producto o el cajero tipificó una venta errónea, localice el ticket en el Historial.
2. Presione el botón de **Anular** (ícono de tacho rojo o cruz en la fila del comprobante).
3. Se abrirá la confirmación de seguridad de SweetAlert2:
   > [!CAUTION]
   > La anulación de una venta es una operación irreversible. Al confirmarse:
   > 1. Todas las unidades de los productos involucrados en el ticket se reingresan automáticamente al inventario físico.
   > 2. Si la venta fue cobrada en efectivo, el importe se deduce del flujo de caja activo.
   > 3. Si la venta fue a cuenta corriente (fiado), se condona la deuda al cliente en su libreta.
4. Si su comercio tiene habilitadas las políticas de protección, el sistema solicitará el **PIN de Seguridad del Administrador**. Tipee el PIN y confirme.
5. El comprobante pasará a estado tachado/anulado y la tabla se actualizará de inmediato.

---

#### Operación 4: Exportación Masiva de Reportes a Excel o PDF
1. Aplique los filtros de fechas deseados para delimitar el período contable a exportar.
2. En la botonera superior:
   - Presione **Excel** (botón verde): Descargará un archivo `.xlsx` estructurado con columnas de fecha, cliente, cajero, ítems, métodos de pago y totales para procesar en Microsoft Excel o Google Sheets.
   - Presione **Reporte PDF** (botón rojo): Creará un informe formal con encabezado corporativo listo para entregar al contador de la empresa.

---

### Atajos de Teclado del Módulo Historial
| Atajo | Acción | Contexto |
| :--- | :--- | :--- |
| <kbd>Enter ↵</kbd> | Ejecuta la consulta de comprobantes | En la barra de filtros de fecha |
| <kbd>Escape</kbd> | Cierra el modal de detalle del comprobante | Modal "Detalle de Venta" |

---

## Módulo 8: Empleados (Seguridad, Roles y PIN)

### Descripción Funcional
Módulo de seguridad multi-usuario para gobernar las credenciales de acceso de los colaboradores de la empresa. Permite asignar niveles de privilegios operativos (`ADMIN` vs `VENDEDOR`) y configurar PINs numéricos de autorización requeridos en caja para operaciones sensibles.

---

### Operaciones Paso a Paso

#### Operación 1: Alta de un Empleado con PIN de Seguridad
1. En la pantalla de Empleados, presione el botón azul **+ Nuevo Empleado**.
2. En el modal **Datos del Empleado**, complete la información:
   - **Nombre Completo (*):** Nombre y apellido del trabajador (ej: `Carlos Gómez`).
   - **Correo (Usuario de Acceso) (*):** Email con el que iniciará sesión (ej: `carlos@minegocio.com`).
   - **Contraseña (*):** Clave de acceso personal al sistema.
   - **Rol Operativo (*):**
     - `VENDEDOR`: Acceso restringido exclusivamente a la pantalla de Ventas (Punto de Venta). No tiene visibilidad sobre los márgenes de ganancia, costos de compra, reportes contables ni configuración.
     - `ADMIN`: Acceso total e irrestricto a todos los módulos y reportes de la plataforma.
   - **Asignar PIN de Seguridad:**
     - Active el interruptor correspondiente.
     - En el campo **PIN de Seguridad**, ingrese un código numérico de 4 a 6 dígitos (ej: `1234`).
     > [!IMPORTANT]
     > Este PIN es el que solicitará el sistema en el mostrador cuando un vendedor requiera autorizar anulaciones de tickets, descuentos excepcionales o reaperturas forzadas de caja.
3. Presione la tecla <kbd>Enter ↵</kbd> o haga clic en **Guardar Empleado <kbd>Enter ↵</kbd>**.

---

#### Operación 2: Modificación de Contraseñas o Baja de Personal
1. Localice al empleado en la nómina de la tabla.
2. Haga clic en el botón de **Editar**:
   - Para cambiar la contraseña, escriba una nueva en el casillero correspondiente (o déjelo en blanco si solo desea modificar el rol o el PIN).
3. Presione <kbd>Enter ↵</kbd> para guardar.
4. Si el colaborador cesa en sus funciones, haga clic en el botón de **Baja Lógica** para revocar su ingreso al sistema de manera inmediata sin destruir el historial de ventas que realizó en el pasado.

---

### Atajos de Teclado del Módulo Empleados
| Atajo | Acción | Contexto |
| :--- | :--- | :--- |
| <kbd>Enter ↵</kbd> | Guarda y crea/modifica el usuario y su PIN | Modal "Datos del Empleado" |

---

## Módulo 9: Mi Negocio (Configuración y Facturación Fiscal)

### Descripción Funcional
Panel maestro donde el titular del comercio configura la identidad de su establecimiento, personaliza la plantilla del ticket térmico con vista previa en vivo, declara los parámetros fiscales para comprobantes legales (ARCA / AFIP), actualiza su contraseña personal y audita la vigencia de su suscripción al software.

---

### Operaciones Paso a Paso

#### Operación 1: Personalizar los Datos del Comercio y el Ticket Térmico
1. Ingrese a la pantalla **Configuración del Negocio** (`perfil.html`).
2. En la columna izquierda, en el bloque **Datos del Comercio**, complete:
   - **Nombre Comercial (*):** Razón de fantasía del local (ej: `Supermercado Central`).
   - **CUIT / CUIL (*):** Clave de identificación tributaria (ej: `20-33445566-9`).
   - **Teléfono / WhatsApp:** Teléfono que saldrá impreso en los tickets de los clientes.
   - **Dirección Comercial:** Domicilio físico del local.
   - **Mensaje al Pie del Ticket:** Escriba la política de devolución o saludo de cortesía (ej: *"¡Gracias por elegirnos! Conserve este ticket para cambios (hasta 15 días)"*).
3. **Comprobación en Vivo:**
   - Observe la columna derecha **Vista Previa del Ticket**: cada carácter que usted tipea en el formulario se actualiza en tiempo real sobre una simulación gráfica exacta de un ticket térmico de 80mm, permitiéndole calibrar los textos antes de imprimirlos.
4. Al finalizar, presione el botón inferior **Guardar Configuración** (o presione <kbd>Enter ↵</kbd>).

---

#### Operación 2: Configuración de Parámetros Fiscales (ARCA / AFIP)
1. Desplácese al bloque **Parámetros Fiscales (ARCA / AFIP)**.
2. Verifique que el interruptor superior esté activado si su comercio emite comprobantes oficiales.
3. Complete los atributos requeridos por la normativa:
   - **Nro. IIBB:** Número de inscripción en Ingresos Brutos o leyenda *"Exento"*.
   - **Inicio Actividades:** Fecha de alta censal ante el organismo tributario.
   - **Condición IVA:** Seleccione entre `Responsable Monotributo`, `Responsable Inscripto`, `Exento` o `Consumidor Final`.
4. En la vista previa del ticket lateral, notará que se insertará de forma automática el bloque fiscal con el marco para el código QR y código CAE reglamentario.
5. Guarde las modificaciones presionando el botón **Guardar Configuración**.

---

#### Operación 3: Cambio de Contraseña del Propietario / Administrador
1. Diríjase al bloque **Seguridad de Acceso** (delimitado por un borde rojo de alerta).
2. En el casillero **Nueva Contraseña**, escriba su nueva clave secreta.
3. En el casillero **Repetir Contraseña**, reitere exactamente la misma clave para evitar errores tipográficos.
4. Presione el botón **Actualizar**. El sistema validará la coincidencia y aplicará las credenciales en su sesión.

---

### Atajos de Teclado del Módulo Mi Negocio
| Atajo | Acción | Contexto |
| :--- | :--- | :--- |
| <kbd>Enter ↵</kbd> | Guarda y persiste los cambios de configuración del local | Formulario de Configuración |

---

## Cheat Sheet Global de Atajos de Teclado

Conserve esta tabla cerca de la caja registradora o utilícela en la inducción de nuevos cajeros para optimizar la velocidad de atención al cliente:

| Tecla / Combinación | Acción Realizada | Dónde Funciona |
| :---: | :--- | :--- |
| <kbd>F2</kbd> | Enfoca instantáneamente el buscador de productos para tipear o escanear | Punto de Venta (POS) |
| <kbd>F4</kbd> | Finaliza y confirma la venta en curso emitiendo el ticket | Punto de Venta (POS) |
| <kbd>F8</kbd> | Cancela y vacía la venta actual sin alterar el stock | Punto de Venta (POS) |
| <kbd>Escape</kbd> | Cierra sugerencias desplegables y modales de consulta | POS e Historial |
| <kbd>Enter ↵</kbd> | Cierra la venta al escribir el dinero en *"Paga Con"* | Campo "Paga Con" en POS |
| <kbd>Enter ↵</kbd> | Agrega al carrito el artículo sugerido seleccionado | Buscador de POS |
| <kbd>Enter ↵</kbd> | Guarda el producto pesable con su peso o importe | Modal de Balanza (POS) |
| <kbd>Enter ↵</kbd> | Guarda y confirma el formulario en todos los modales | Modales ABM de todo el sistema |
| <kbd>↓</kbd> / <kbd>↑</kbd> | Navega verticalmente en la lista de artículos encontrados | Buscador de POS |
| Dígitos <kbd>0-9</kbd> | Redirige el foco al buscador si se lee código sin foco previo | POS y Catálogo de Productos |
| <kbd>Tab</kbd> | Salta ordenadamente de un campo de formulario al siguiente | Todos los módulos |
