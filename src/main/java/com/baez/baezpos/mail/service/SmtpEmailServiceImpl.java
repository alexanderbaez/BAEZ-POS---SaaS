package com.baez.baezpos.mail.service;

import com.baez.baezpos.log.service.AuditService;
import com.baez.baezpos.mail.util.EmailTemplateBuilder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class SmtpEmailServiceImpl implements EmailService {

    private final AuditService auditService;
    private final RestTemplate restTemplate;

    @Value("${resend.api.key:}")
    private String resendApiKey;

    @Value("${app.mail.from:BÃƒÂEZ POS <onboarding@resend.dev>}")
    private String mailFrom;

    private static final String RESEND_API_URL = "https://api.resend.com/emails";

    private void enviarCorreoInterno(String destinatario, String asunto, String contenidoHtml) {
        if (destinatario == null || destinatario.isBlank()) {
            log.warn("[EmailService] EnvÃƒÂ­o cancelado: Destinatario nulo o vacÃƒÂ­o.");
            return;
        }

        if (resendApiKey == null || resendApiKey.isBlank()) {
            log.error("[EmailService] RESEND_API_KEY no estÃƒ¡ configurada en las variables de entorno. Correo no enviado a: {}", destinatario);
            safeAuditLog("EMAIL_ERROR", "RESEND_API_KEY no configurada. Destinatario: " + destinatario, "ERROR");
            return;
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(resendApiKey.trim());

            Map<String, Object> payload = Map.of(
                    "from", mailFrom.trim(),
                    "to", List.of(destinatario.trim()),
                    "subject", asunto,
                    "html", contenidoHtml
            );

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(RESEND_API_URL, entity, String.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("[EmailService] Correo enviado exitosamente vÃƒÂ­a Resend HTTP API a: {}", destinatario);
                safeAuditLog("EMAIL_ENVIADO", "Correo enviado vÃƒÂ­a Resend a: " + destinatario + " | Asunto: " + asunto, "INFO");
            } else {
                log.error("[EmailService] Respuesta no exitosa de Resend API para {}: Status={}, Body={}", destinatario, response.getStatusCode(), response.getBody());
                safeAuditLog("EMAIL_ERROR", "Error Resend API (HTTP " + response.getStatusCode() + ") para: " + destinatario, "ERROR");
            }

        } catch (Exception e) {
            log.error("[EmailService] ExcepciÃƒÂ³n al despachar correo vÃƒÂ­a Resend API para {}: {}", destinatario, e.getMessage(), e);
            safeAuditLog("EMAIL_ERROR", "Fallo HTTP Resend: " + e.getMessage() + " | Destinatario: " + destinatario, "ERROR");
        }
    }

    private void safeAuditLog(String action, String details, String level) {
        try {
            auditService.logAction(action, details, level);
        } catch (Exception ex) {
            log.warn("[EmailService] No se pudo persistir auditorÃƒÂ­a en hilo asÃƒÂ­ncrono: {}", ex.getMessage());
        }
    }

    @Override
    @Async("taskExecutor")
    public void enviarMailBienvenida(String destinatario, String nombreEmpresa, String nombreUsuario, String passwordTemporal) {
        log.info("[EmailService] Despachando correo de bienvenida con credenciales a: {}", destinatario);
        String asunto = "Ã‚¡Bienvenido a BÃƒÂEZ POS! - Credenciales de acceso";
        String html = EmailTemplateBuilder.buildBienvenidaConPassword(nombreUsuario, nombreEmpresa, destinatario, passwordTemporal);
        enviarCorreoInterno(destinatario, asunto, html);
    }

    @Override
    @Async("taskExecutor")
    public void enviarMailBienvenida(String destinatario, String nombreUsuario, String nombreEmpresa) {
        log.info("[EmailService] Despachando confirmaciÃƒÂ³n de cuenta a: {}", destinatario);
        String asunto = "Ã‚¡Bienvenido a BÃƒÂEZ POS! - ConfirmaciÃƒÂ³n de cuenta";
        String html = EmailTemplateBuilder.buildBienvenidaSinPassword(nombreUsuario, nombreEmpresa, destinatario);
        enviarCorreoInterno(destinatario, asunto, html);
    }

    @Override
    @Async("taskExecutor")
    public void enviarMailResetPassword(String destinatario, String nombreUsuario, String nuevaPassword) {
        log.info("[EmailService] Despachando restablecimiento de contraseÃƒÂ±a a: {}", destinatario);
        String asunto = "BÃƒ EZ POS - Restablecimiento de ContraseÃƒÂ±a";
        String html = EmailTemplateBuilder.buildResetPassword(nombreUsuario, nuevaPassword);
        enviarCorreoInterno(destinatario, asunto, html);
    }

    @Override
    @Async("taskExecutor")
    public void enviarMailPurchaseOrder(String destinatario, String nombreProveedor, String detallePedido, String companyName) {
        log.info("[EmailService] Despachando Orden de Compra a: {}", destinatario);
        String asunto = "Nueva Orden de Compra - BAEZ POS";
        String html = EmailTemplateBuilder.buildPurchaseOrder(nombreProveedor, detallePedido, companyName);
        enviarCorreoInterno(destinatario, asunto, html);
    }
}