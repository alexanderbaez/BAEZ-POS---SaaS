package com.baez.baezpos.mail.service;

import com.baez.baezpos.log.service.AuditService;
import com.baez.baezpos.mail.util.EmailTemplateBuilder;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class SmtpEmailServiceImpl implements EmailService {

    private final JavaMailSender mailSender;
    private final AuditService auditService;

    @Value("${spring.mail.username}")
    private String senderEmail;

    private void enviarCorreoInterno(String destinatario, String asunto, String contenidoHtml) {
        if (destinatario == null || destinatario.isBlank()) {
            log.warn("[SMTP] Envío cancelado: Destinatario nulo o vacío.");
            return;
        }

        if (senderEmail == null || senderEmail.isBlank()) {
            log.error("[SMTP] Envío cancelado: La propiedad 'spring.mail.username' no está configurada.");
            return;
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(senderEmail.trim(), "BÁEZ POS");
            helper.setTo(destinatario.trim());
            helper.setSubject(asunto);
            helper.setText(contenidoHtml, true);

            mailSender.send(message);
            log.info("[SMTP] Correo enviado exitosamente a: {}", destinatario);

            safeAuditLog("EMAIL_ENVIADO", "Correo enviado a: " + destinatario + " | Asunto: " + asunto, "INFO");

        } catch (MessagingException e) {
            log.error("[SMTP] Error al construir o enviar mensaje a {}: {}", destinatario, e.getMessage(), e);
            safeAuditLog("EMAIL_ERROR", "Error SMTP al enviar a: " + destinatario + " | " + e.getMessage(), "ERROR");
        } catch (Exception e) {
            log.error("[SMTP] Excepción inesperada enviando correo a {}: {}", destinatario, e.getMessage(), e);
            safeAuditLog("EMAIL_ERROR", "Fallo inesperado al enviar a: " + destinatario + " | " + e.getMessage(), "ERROR");
        }
    }

    private void safeAuditLog(String action, String details, String level) {
        try {
            auditService.logAction(action, details, level);
        } catch (Exception ex) {
            log.warn("[SMTP] No se pudo persistir auditoría en hilo asíncrono: {}", ex.getMessage());
        }
    }

    @Override
    @Async("taskExecutor")
    public void enviarMailBienvenida(String destinatario, String nombreEmpresa, String nombreUsuario, String passwordTemporal) {
        log.info("[SMTP] Despachando correo de bienvenida con credenciales a: {}", destinatario);
        String asunto = "¡Bienvenido a BÁEZ POS! - Credenciales de acceso";
        String html = EmailTemplateBuilder.buildBienvenidaConPassword(nombreUsuario, nombreEmpresa, destinatario, passwordTemporal);
        enviarCorreoInterno(destinatario, asunto, html);
    }

    @Override
    @Async("taskExecutor")
    public void enviarMailBienvenida(String destinatario, String nombreUsuario, String nombreEmpresa) {
        log.info("[SMTP] Despachando confirmación de cuenta a: {}", destinatario);
        String asunto = "¡Bienvenido a BÁEZ POS! - Confirmación de cuenta";
        String html = EmailTemplateBuilder.buildBienvenidaSinPassword(nombreUsuario, nombreEmpresa, destinatario);
        enviarCorreoInterno(destinatario, asunto, html);
    }

    @Override
    @Async("taskExecutor")
    public void enviarMailResetPassword(String destinatario, String nombreUsuario, String nuevaPassword) {
        log.info("[SMTP] Despachando restablecimiento de contraseña a: {}", destinatario);
        String asunto = "BÁEZ POS - Restablecimiento de Contraseña";
        String html = EmailTemplateBuilder.buildResetPassword(nombreUsuario, nuevaPassword);
        enviarCorreoInterno(destinatario, asunto, html);
    }
}