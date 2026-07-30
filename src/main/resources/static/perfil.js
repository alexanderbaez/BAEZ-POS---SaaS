/**
 * BÁEZ POS - PERFIL DE LA EMPRESA & CONFIGURACIÓN
 * Alexander Baez - 2026
 */

//const BACKEND_URL = 'https://baez-pos-saas.onrender.com';
const API_URL = `${BACKEND_URL}/api/v1/admin/my-company/profile`;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Cargar datos de la empresa desde la BD
    cargarDatosEmpresa();

    // 2. Vincular escritura en vivo para la vista previa del ticket
    vincularInputsPreview();

    // 3. Vincular evento del switch para activar/desactivar datos fiscales
    vincularSwitchFiscal();
});

async function cargarDatosEmpresa() {
    try {
        const resp = await apiFetch(API_URL);

        if (!resp || !resp.ok) throw new Error("No se pudo obtener la información.");

        const emp = await resp.json();

        // Guardar en caché local usando AMBAS claves para sincronizar con Ventas/Cobros
        localStorage.setItem('config_comercio', JSON.stringify(emp));
        localStorage.setItem('DATOS_EMPRESA', JSON.stringify(emp));

        // Llenado de formulario principal
        document.getElementById('empNombre').value = emp.name || '';
        document.getElementById('empCuit').value = emp.taxId || '';
        document.getElementById('empTel').value = emp.phone || '';
        document.getElementById('empEmail').value = emp.email || '';
        document.getElementById('empDireccion').value = emp.address || '';
        document.getElementById('empTicketMsg').value = emp.ticketMessage || '';

        // Carga de campos fiscales para ARCA / AFIP
        document.getElementById('empIibb').value = emp.iibb || '';
        document.getElementById('empInicioAct').value = emp.inicioActividades || '';
        document.getElementById('empIva').value = emp.condicionIva || 'Responsable Monotributo';

        // Cargar estado del Switch (Respeta el booleano real guardado en la BD)
        const checkFiscal = document.getElementById('checkMostrarFiscal');
        checkFiscal.checked = emp.hasTaxData !== undefined ? Boolean(emp.hasTaxData) : true;

        // Actualizar el nombre en el sidebar con el dato real de la DB
        const elCompanyNav = document.getElementById('companyNameNav');
        if (elCompanyNav) elCompanyNav.innerText = (emp.name || 'MI NEGOCIO').toUpperCase();

        // Gestión de suscripción y vencimiento
        procesarVencimiento(emp.expirationDate);

        // Sincronizar estado del switch y vista previa inicial
        aplicarEstadoFiscal(checkFiscal.checked);
        actualizarPreview();

    } catch (err) {
        console.error("Error al cargar perfil:", err);
        Swal.fire({
            title: 'Error de Carga',
            text: 'No logramos conectar con el servidor para traer tus datos.',
            icon: 'error',
            confirmButtonColor: '#2563eb'
        });
    }
}

function procesarVencimiento(fechaStr) {
    if (!fechaStr) return;

    // Soportar cadenas 'YYYY-MM-DD' de manera segura
    const partes = fechaStr.split('-');
    const fechaVenc = partes.length === 3
        ? new Date(partes[0], partes[1] - 1, partes[2])
        : new Date(fechaStr);

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

    badge.className = "badge rounded-pill p-2 px-4 shadow-sm ";

    if (difDias <= 0) {
        badge.classList.add("bg-danger");
        badge.innerText = "SERVICIO VENCIDO";
        if (alerta) alerta.classList.remove('d-none');
        if (mensajeDias) mensajeDias.innerHTML = `<strong>Tu servicio ha vencido.</strong> Contactá al soporte para renovar tu acceso hoy mismo.`;
    } else if (difDias <= 7) {
        badge.classList.add("bg-warning", "text-dark");
        badge.innerText = "VENCE PRONTO";
        if (alerta) {
            alerta.classList.remove('d-none');
            alerta.classList.replace('alert-danger', 'alert-warning');
        }
        if (mensajeDias) mensajeDias.innerText = `Tu abono mensual vence en ${difDias} días. ¡No te quedes sin sistema!`;
    } else {
        badge.classList.add("bg-success");
        badge.innerText = "SERVICIO ACTIVO";
        if (alerta) alerta.classList.add('d-none');
    }
}

async function actualizarEmpresa(silencioso = false) {
    const nombre = document.getElementById('empNombre').value.trim();
    if (!nombre) {
        Swal.fire('Atención', 'El nombre del negocio es obligatorio.', 'warning');
        return;
    }

    const data = {
        name: nombre,
        taxId: document.getElementById('empCuit').value.trim(),
        phone: document.getElementById('empTel').value.trim(),
        email: document.getElementById('empEmail').value.trim(),
        address: document.getElementById('empDireccion').value.trim(),
        ticketMessage: document.getElementById('empTicketMsg').value.trim(),
        hasTaxData: document.getElementById('checkMostrarFiscal').checked,
        iibb: document.getElementById('empIibb').value.trim(),
        inicioActividades: document.getElementById('empInicioAct').value,
        condicionIva: document.getElementById('empIva').value
    };

    try {
        if (!silencioso) {
            Swal.fire({
                title: 'Guardando configuración...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });
        }

        const resp = await apiFetch(API_URL, {
            method: 'PUT',
            body: JSON.stringify(data)
        });

        if (resp && resp.ok) {
            // Sincronizar LocalStorage
            localStorage.setItem('config_comercio', JSON.stringify(data));
            localStorage.setItem('DATOS_EMPRESA', JSON.stringify(data));

            // Actualizar nombre en Navbar
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
                    targetEl.innerText = `${parts[2]}/${parts[1]}/${parts[0]}`;
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

async function cambiarPassword() {
    const pass = document.getElementById('nuevaPass').value;
    const confirm = document.getElementById('confirmarPass').value;

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
            document.getElementById('nuevaPass').value = '';
            document.getElementById('confirmarPass').value = '';
        } else {
            throw new Error();
        }
    } catch (err) {
        Swal.fire('Error', 'No se pudo cambiar la contraseña. Revisa el servidor.', 'error');
    }
}

function actualizarPreview() {
    const elNombre = document.getElementById('previewNombre');
    if (elNombre) elNombre.innerText = (document.getElementById('empNombre').value || 'TU NEGOCIO').toUpperCase();

    const elDir = document.getElementById('previewDir');
    if (elDir) elDir.innerText = document.getElementById('empDireccion').value || 'Tu Dirección';

    const elTel = document.getElementById('previewTel');
    if (elTel) elTel.innerText = 'Tel: ' + (document.getElementById('empTel').value || '000-000');

    const emailVal = document.getElementById('empEmail').value;
    const elEmail = document.getElementById('previewEmail');
    if (elEmail) elEmail.innerText = emailVal ? `Email: ${emailVal}` : '';

    const elCuit = document.getElementById('previewCuit');
    if (elCuit) elCuit.innerText = document.getElementById('empCuit').value || '-';

    const elIibb = document.getElementById('previewIibb');
    if (elIibb) elIibb.innerText = document.getElementById('empIibb').value || '-';

    const elMsg = document.getElementById('previewMsg');
    if (elMsg) elMsg.innerText = document.getElementById('empTicketMsg').value || '¡Gracias por su compra!';

    const elIva = document.getElementById('previewIva');
    if (elIva) elIva.innerText = document.getElementById('empIva').value || 'Responsable Monotributo';

    const initAct = document.getElementById('empInicioAct').value;
    const elInicio = document.getElementById('previewInicio');
    if (elInicio) {
        if (initAct) {
            const parts = initAct.split('-');
            elInicio.innerText = `${parts[2]}/${parts[1]}/${parts[0]}`;
        } else {
            elInicio.innerText = '-';
        }
    }
}