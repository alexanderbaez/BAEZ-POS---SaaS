/**
 * BÁEZ POS - REGISTRO / ONBOARDING SAAS
 * Alexander Baez - 2026
 */

document.addEventListener('DOMContentLoaded', () => {
    // Si ya tiene sesión activa en este navegador, va al Dashboard directo
    const token = localStorage.getItem('baezpos_token');
    if (token) {
        window.location.href = 'dashboard.html';
    }
});

document.getElementById('setupForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const btn = document.getElementById('btnProcesar');
    const btnText = document.getElementById('btnText');
    const loader = document.getElementById('loader');
    const messageContainer = document.getElementById('messageContainer');

    // Construir Payload: los datos vacíos se envían limpios o con valores por defecto útiles
    const payload = {
        userName: document.getElementById('userName').value.trim(),
        email: document.getElementById('email').value.trim(),
        password: document.getElementById('password').value,
        companyName: document.getElementById('companyName').value.trim(),
        taxId: document.getElementById('taxId').value.trim() || '',
        phone: document.getElementById('phone').value.trim() || '',
        address: document.getElementById('address').value.trim() || '',
        ticketMessage: document.getElementById('ticketMessage').value.trim() || '¡Gracias por su compra!',
        iibb: document.getElementById('iibb').value.trim() || '',
        inicioActividades: document.getElementById('inicioActividades').value || null,
        condicionIva: document.getElementById('condicionIva').value
    };

    messageContainer.innerHTML = '';
    btnText.classList.add('d-none');
    loader.classList.remove('d-none');
    btn.classList.add('disabled');

    try {
        // En SaaS se suele consumir /api/v1/auth/register o mantener /setup para crear tenant + admin
        const response = await fetch('/api/v1/auth/setup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const data = await response.json();

            const cleanRole = (data.role || "").replace('ROLE_', '');

            localStorage.clear();
            localStorage.setItem('baezpos_token', data.token);
            localStorage.setItem('baezpos_user_role', cleanRole);
            localStorage.setItem('baezpos_user_name', data.name || payload.userName);

            Swal.fire({
                title: '¡Bienvenido a BaezPOS!',
                text: 'Cuenta creada con éxito. Ingresando a tu panel...',
                icon: 'success',
                showConfirmButton: false,
                timer: 1800
            }).then(() => {
                window.location.href = 'dashboard.html';
            });

        } else {
            const errorData = await response.json().catch(() => ({}));
            let errorMsg = errorData.message || "Error al crear la cuenta. Verifica los datos ingresados.";

            if (errorData.validationErrors) {
                errorMsg = Object.values(errorData.validationErrors).join('<br>');
            }

            messageContainer.innerHTML = `<div class="alert alert-danger shadow-sm">${errorMsg}</div>`;
            resetButton();
        }
    } catch (error) {
        console.error("Error de red:", error);
        messageContainer.innerHTML = `<div class="alert alert-warning shadow-sm">No se pudo conectar con el servidor. Verifica tu conexión.</div>`;
        resetButton();
    }

    function resetButton() {
        btnText.classList.remove('d-none');
        loader.classList.add('d-none');
        btn.classList.remove('disabled');
    }
});