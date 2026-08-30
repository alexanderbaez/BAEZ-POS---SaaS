/**
 * BÁEZ POS - PERFIL DE LA EMPRESA & CONFIGURACIÓN (SaaS)
 * Alexander Baez - 2026
 */

// Ruta relativa del endpoint de perfil
const ENDPOINT_PROFILE = '/admin/my-company/profile';

// ==========================================
// 1. INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Cargar datos de la empresa desde la BD
    cargarDatosEmpresa();

    // 2. Vincular escritura en vivo para la vista previa del ticket
    vincularInputsPreview();

    // 3. Vincular evento del switch para activar/desactivar datos fiscales
    vincularSwitchFiscal();
});

// ==========================================
// 2. CARGA DE DATOS Y VENCIMIENTO
// ==========================================
async function cargarDatosEmpresa() {
    try {
        const resp = await apiFetch(ENDPOINT_PROFILE);

        if (!resp || !resp.ok) throw new Error("No se pudo obtener la información de la empresa.");

        const emp = await resp.json();

        // Guardar en caché local usando AMBAS claves para sincronizar con Ventas/Cobros
        sessionStorage.setItem('config_comercio', JSON.stringify(emp));
        sessionStorage.setItem('DATOS_EMPRESA', JSON.stringify(emp));

        // Llenado de formulario principal
        if (document.getElementById('empNombre')) document.getElementById('empNombre').value = emp.name || '';
        if (document.getElementById('empCuit')) document.getElementById('empCuit').value = emp.taxId || '';
        if (document.getElementById('empTel')) document.getElementById('empTel').value = emp.phone || '';
        if (document.getElementById('empEmail')) document.getElementById('empEmail').value = emp.email || '';
        if (document.getElementById('empDireccion')) document.getElementById('empDireccion').value = emp.address || '';
        if (document.getElementById('empTicketMsg')) document.getElementById('empTicketMsg').value = emp.ticketMessage || '';

        // Carga de campos fiscales para ARCA / AFIP
        if (document.getElementById('empIibb')) document.getElementById('empIibb').value = emp.iibb || '';
        if (document.getElementById('empInicioAct')) document.getElementById('empInicioAct').value = emp.inicioActividades || '';
        if (document.getElementById('empIva')) document.getElementById('empIva').value = emp.condicionIva || 'Responsable Monotributo';

        // Cargar estado del Switch (Respeta el booleano real guardado en la BD)
        const checkFiscal = document.getElementById('checkMostrarFiscal');
        if (checkFiscal) {
            checkFiscal.checked = emp.hasTaxData !== undefined ? Boolean(emp.hasTaxData) : true;
            aplicarEstadoFiscal(checkFiscal.checked);
        }

        // Actualizar el nombre en el sidebar/navbar con el dato real de la DB
        const elCompanyNav = document.getElementById('companyNameNav');
        if (elCompanyNav) elCompanyNav.innerText = (emp.name || 'MI NEGOCIO').toUpperCase();

        // Gestión de suscripción y vencimiento
        procesarVencimiento(emp.expirationDate);

        // Actualizar la vista previa inicial
        actualizarPreview();

    } catch (err) {
        console.error("Error al cargar perfil:", err);
        Swal.fire({
            title: 'Error de Carga',
            text: 'No logramos conectar con el servidor para traer los datos del negocio.',
            icon: 'error',
            confirmButtonColor: '#2563eb'
        });
    }
}

function procesarVencimiento(fechaStr) {
    if (!fechaStr) return;

    // Parseo seguro evitando desfasajes de zona horaria UTC
    let fechaVenc;
    if (fechaStr.includes('-')) {
        const partes = fechaStr.split('T')[0].split('-');
        fechaVenc = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]));
    } else {
        fechaVenc = new Date(fechaStr);
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const difTiempo = fechaVenc - hoy;
    const difDias = Math.ceil(difTiempo / (1000 * 60 * 60 * 24));

    const vencInput = document.getElementById('vencimientoTexto');
    const alerta = document.getElementById('alertaVencimiento');
    const mensajeDias = document.getElementById('mensajeDias');
    const badge = document.getElementById('badgeEstado');

    if (vencInput) {
        vencInput.innerText = fechaVenc.toLocaleDateString('es-AR', {
            day: 'numeric', month: 'long', year: 'numeric'
        });
    }

    if (!badge) return;

    if (difDias <= 0) {
        badge.className = "badge rounded-pill px-3 py-2 bg-danger-subtle text-danger border border-danger-subtle fw-bold";
        badge.innerText = "SERVICIO VENCIDO";
        if (alerta) alerta.classList.remove('d-none');
        if (mensajeDias) mensajeDias.innerHTML = `<strong>Tu servicio ha vencido.</strong> Contactá al soporte para renovar tu acceso hoy mismo.`;
    } else if (difDias <= 7) {
        badge.className = "badge rounded-pill px-3 py-2 bg-warning-subtle text-warning-emphasis border border-warning-subtle fw-bold";
        badge.innerText = "VENCE PRONTO";
        if (alerta) {
            alerta.classList.remove('d-none');
            alerta.classList.replace('alert-danger', 'alert-warning');
        }
        if (mensajeDias) mensajeDias.innerText = `Tu abono mensual vence en ${difDias} días. ¡No te quedes sin sistema!`;
    } else {
        badge.className = "badge rounded-pill px-3 py-2 bg-success-subtle text-success border border-success-subtle fw-bold";
        badge.innerText = "SERVICIO ACTIVO";
        if (alerta) alerta.classList.add('d-none');
    }
}

// ==========================================
// 3. PERSISTENCIA DE CAMBIOS
// ==========================================
async function actualizarEmpresa(silencioso = false) {
    const nombre = document.getElementById('empNombre')?.value.trim();
    if (!nombre) {
        Swal.fire('Atención', 'El nombre del negocio es obligatorio.', 'warning');
        return;
    }

    const data = {
        name: nombre,
        taxId: document.getElementById('empCuit')?.value.trim() || '',
        phone: document.getElementById('empTel')?.value.trim() || '',
        email: document.getElementById('empEmail')?.value.trim() || '',
        address: document.getElementById('empDireccion')?.value.trim() || '',
        ticketMessage: document.getElementById('empTicketMsg')?.value.trim() || '',
        hasTaxData: Boolean(document.getElementById('checkMostrarFiscal')?.checked),
        iibb: document.getElementById('empIibb')?.value.trim() || '',
        inicioActividades: document.getElementById('empInicioAct')?.value || '',
        condicionIva: document.getElementById('empIva')?.value || 'Responsable Monotributo'
    };

    try {
        if (!silencioso) {
            Swal.fire({
                title: 'Guardando configuración...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });
        }

        const resp = await apiFetch(ENDPOINT_PROFILE, {
            method: 'PUT',
            body: JSON.stringify(data)
        });

        if (resp && resp.ok) {
            // Sincronizar SessionStorage para consumo dinámico
            sessionStorage.setItem('config_comercio', JSON.stringify(data));
            sessionStorage.setItem('DATOS_EMPRESA', JSON.stringify(data));

            // Actualizar nombre en Navbar si existe
            const elCompanyNav = document.getElementById('companyNameNav');
            if (elCompanyNav) elCompanyNav.innerText = nombre.toUpperCase();

            if (!silencioso) {
                Swal.fire({
                    title: '¡Actualizado!',
                    text: 'La identidad de tu negocio ha sido guardada.',
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                const Toast = Swal.mixin({
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 2000,
                    timerProgressBar: true
                });
                Toast.fire({
                    icon: 'success',
                    title: data.hasTaxData ? 'Datos fiscales activados' : 'Modo Ticket no fiscal activado'
                });
            }
        } else {
            throw new Error("Respuesta no satisfactoria del servidor");
        }
    } catch (err) {
        console.error("Error al guardar empresa:", err);
        Swal.fire('Error', 'No se pudieron guardar los cambios. Intenta nuevamente.', 'error');
    }
}

async function cambiarPassword() {
    const pass = document.getElementById('nuevaPass')?.value;
    const confirm = document.getElementById('confirmarPass')?.value;

    if (!pass || pass.length < 6) {
        Swal.fire('Atención', 'La contraseña debe tener al menos 6 caracteres.', 'warning');
        return;
    }

    if (pass !== confirm) {
        Swal.fire('Error', 'Las contraseñas no coinciden.', 'error');
        return;
    }

    try {
        Swal.fire({
            title: 'Actualizando seguridad...',
            didOpen: () => Swal.showLoading()
        });

        const resp = await apiFetch("/users/update-password", {
            method: 'PATCH',
            body: JSON.stringify({ newPassword: pass })
        });

        if (resp && resp.ok) {
            Swal.fire('¡Éxito!', 'Contraseña actualizada correctamente.', 'success');
            if (document.getElementById('nuevaPass')) document.getElementById('nuevaPass').value = '';
            if (document.getElementById('confirmarPass')) document.getElementById('confirmarPass').value = '';
        } else {
            throw new Error();
        }
    } catch (err) {
        console.error("Error al actualizar contraseña:", err);
        Swal.fire('Error', 'No se pudo cambiar la contraseña. Revisa el servidor.', 'error');
    }
}

// ==========================================
// 4. LÓGICA DE VISTA PREVIA DEL TICKET
// ==========================================
function vincularSwitchFiscal() {
    const switchFiscal = document.getElementById('checkMostrarFiscal');
    if (!switchFiscal) return;

    switchFiscal.addEventListener('change', (e) => {
        const estaActivo = e.target.checked;
        aplicarEstadoFiscal(estaActivo);
        actualizarEmpresa(true);
    });
}

function aplicarEstadoFiscal(activo) {
    const previewBloque = document.getElementById('previewBloqueFiscal');
    const previewPie = document.getElementById('previewPieFiscal');
    const previewTipo = document.getElementById('previewTipoComprobante');

    if (previewBloque) previewBloque.style.display = activo ? 'block' : 'none';
    if (previewPie) previewPie.style.display = activo ? 'block' : 'none';
    if (previewTipo) {
        previewTipo.innerText = activo ? 'FACTURA C N° 00001-00001234' : 'TICKET NO FISCAL';
    }

    const inputsFiscales = ['empIibb', 'empInicioAct', 'empIva'];
    inputsFiscales.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = !activo;
    });
}

function vincularInputsPreview() {
    const mapeo = {
        'empNombre': 'previewNombre',
        'empDireccion': 'previewDir',
        'empTel': 'previewTel',
        'empEmail': 'previewEmail',
        'empTicketMsg': 'previewMsg',
        'empCuit': 'previewCuit',
        'empIibb': 'previewIibb',
        'empInicioAct': 'previewInicio',
        'empIva': 'previewIva'
    };

    Object.keys(mapeo).forEach(idInput => {
        const inputEl = document.getElementById(idInput);
        if (!inputEl) return;

        inputEl.addEventListener('input', (e) => {
            const val = e.target.value;
            const targetId = mapeo[idInput];
            const targetEl = document.getElementById(targetId);

            if (!targetEl) return;

            if (idInput === 'empTel') {
                targetEl.innerText = val ? `Tel: ${val}` : 'Tel: 000-000';
            } else if (idInput === 'empEmail') {
                targetEl.innerText = val ? `Email: ${val}` : '';
            } else if (idInput === 'empNombre') {
                targetEl.innerText = val.toUpperCase() || 'TU NEGOCIO';
            } else if (idInput === 'empInicioAct') {
                if (val) {
                    const parts = val.split('-');
                    targetEl.innerText = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : val;
                } else {
                    targetEl.innerText = '-';
                }
            } else {
                targetEl.innerText = val || '-';
            }
        });
    });

    const selectIva = document.getElementById('empIva');
    if (selectIva) {
        selectIva.addEventListener('change', (e) => {
            const previewIva = document.getElementById('previewIva');
            if (previewIva) previewIva.innerText = e.target.value;
        });
    }
}

function actualizarPreview() {
    const elNombre = document.getElementById('previewNombre');
    if (elNombre) elNombre.innerText = (document.getElementById('empNombre')?.value || 'TU NEGOCIO').toUpperCase();

    const elDir = document.getElementById('previewDir');
    if (elDir) elDir.innerText = document.getElementById('empDireccion')?.value || 'Tu Dirección';

    const elTel = document.getElementById('previewTel');
    if (elTel) elTel.innerText = 'Tel: ' + (document.getElementById('empTel')?.value || '000-000');

    const emailVal = document.getElementById('empEmail')?.value;
    const elEmail = document.getElementById('previewEmail');
    if (elEmail) elEmail.innerText = emailVal ? `Email: ${emailVal}` : '';

    const elCuit = document.getElementById('previewCuit');
    if (elCuit) elCuit.innerText = document.getElementById('empCuit')?.value || '-';

    const elIibb = document.getElementById('previewIibb');
    if (elIibb) elIibb.innerText = document.getElementById('empIibb')?.value || '-';

    const elMsg = document.getElementById('previewMsg');
    if (elMsg) elMsg.innerText = document.getElementById('empTicketMsg')?.value || '¡Gracias por su compra!';

    const elIva = document.getElementById('previewIva');
    if (elIva) elIva.innerText = document.getElementById('empIva')?.value || 'Responsable Monotributo';

    const initAct = document.getElementById('empInicioAct')?.value;
    const elInicio = document.getElementById('previewInicio');
    if (elInicio) {
        if (initAct) {
            const parts = initAct.split('-');
            elInicio.innerText = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : initAct;
        } else {
            elInicio.innerText = '-';
        }
    }
}

// ==========================================
// 5. EXPOSICIÓN AL SCOPE GLOBAL
// ==========================================
window.actualizarEmpresa = actualizarEmpresa;
window.cambiarPassword = cambiarPassword;
window.actualizarPreview = actualizarPreview;