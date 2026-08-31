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

    @Value("${app.mail.from:BÁEZ POS <onboarding@resend.dev>}")
    private String mailFrom;

    private static final String RESEND_API_URL = "https://api.resend.com/emails";

    private void enviarCorreoInterno(String destinatario, String asunto, String contenidoHtml) {
        if (destinatario == null || destinatario.isBlank()) {
            log.warn("[EmailService] Envío cancelado: Destinatario nulo o vacío.");
            return;
        }

        if (resendApiKey == null || resendApiKey.isBlank()) {
            log.error("[EmailService] RESEND_API_KEY no está configurada en las variables de entorno. Correo no enviado a: {}", destinatario);
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
                log.info("[EmailService] Correo enviado exitosamente vía Resend HTTP API a: {}", destinatario);
                safeAuditLog("EMAIL_ENVIADO", "Correo enviado vía Resend a: " + destinatario + " | Asunto: " + asunto, "INFO");
            } else {
                log.error("[EmailService] Respuesta no exitosa de Resend API para {}: Status={}, Body={}", destinatario, response.getStatusCode(), response.getBody());
                safeAuditLog("EMAIL_ERROR", "Error Resend API (HTTP " + response.getStatusCode() + ") para: " + destinatario, "ERROR");
            }

        } catch (Exception e) {
            log.error("[EmailService] Excepción al despachar correo vía Resend API para {}: {}", destinatario, e.getMessage(), e);
            safeAuditLog("EMAIL_ERROR", "Fallo HTTP Resend: " + e.getMessage() + " | Destinatario: " + destinatario, "ERROR");
        }
    }

    private void safeAuditLog(String action, String details, String level) {
        try {
            auditService.logAction(action, details, level);
        } catch (Exception ex) {
            log.warn("[EmailService] No se pudo persistir auditoría en hilo asíncrono: {}", ex.getMessage());
        }
    }

    @Override
    @Async("taskExecutor")
    public void enviarMailBienvenida(String destinatario, String nombreEmpresa, String nombreUsuario, String passwordTemporal) {
        log.info("[EmailService] Despachando correo de bienvenida con credenciales a: {}", destinatario);
        String asunto = "¡Bienvenido a BÁEZ POS! - Credenciales de acceso";
        String html = EmailTemplateBuilder.buildBienvenidaConPassword(nombreUsuario, nombreEmpresa, destinatario, passwordTemporal);
        enviarCorreoInterno(destinatario, asunto, html);
    }

    @Override
    @Async("taskExecutor")
    public void enviarMailBienvenida(String destinatario, String nombreUsuario, String nombreEmpresa) {
        log.info("[EmailService] Despachando confirmación de cuenta a: {}", destinatario);
        String asunto = "¡Bienvenido a BÁEZ POS! - Confirmación de cuenta";
        String html = EmailTemplateBuilder.buildBienvenidaSinPassword(nombreUsuario, nombreEmpresa, destinatario);
        enviarCorreoInterno(destinatario, asunto, html);
    }

    @Override
    @Async("taskExecutor")
    public void enviarMailResetPassword(String destinatario, String nombreUsuario, String nuevaPassword) {
        log.info("[EmailService] Despachando restablecimiento de contraseña a: {}", destinatario);
        String asunto = "BÁEZ POS - Restablecimiento de Contraseña";
        String html = EmailTemplateBuilder.buildResetPassword(nombreUsuario, nuevaPassword);
        enviarCorreoInterno(destinatario, asunto, html);
    }
}