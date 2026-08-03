package com.baez.baezpos.mail;

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
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username:alexanderbaez146@gmail.com}")
    private String senderEmail;

    // ==========================================
    // MOTOR BÁSICO DE ENVÍO HTML
    // ==========================================
    @Async
    public void enviarCorreoPro(String destinatario, String asunto, String contenidoHtml) {
        if (destinatario == null || destinatario.isBlank()) {
            log.warn("Intento de envío de correo frustrado: destinatario nulo o vacío.");
            return;
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(senderEmail);
            helper.setTo(destinatario);
            helper.setSubject(asunto);
            helper.setText(contenidoHtml, true);

            mailSender.send(message);
            log.info("Email enviado con éxito a: {}", destinatario);

        } catch (MessagingException e) {
            log.error("Error SMTP al enviar correo a {}. Detalle: {}", destinatario, e.getMessage());
        } catch (Exception e) {
            log.error("Error inesperado en el servicio de e-mail para {}: {}", destinatario, e.getMessage());
        }
    }

    // ==========================================
    // NOTIFICACIÓN DE BIENVENIDA CON CONTRASEÑA (Para SuperAdmin / MasterAdminService)
    // ==========================================
    @Async
    public void enviarMailBienvenida(String destinatario, String nombreEmpresa, String nombreUsuario, String passwordTemporal) {
        String asunto = "¡Bienvenido a BAEZ POS! - Accesos a tu cuenta";

        String contenidoHtml = """
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #2563eb; padding: 24px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">¡Bienvenido a BÁEZ POS!</h1>
                </div>
                <div style="padding: 32px; background-color: #ffffff;">
                    <p style="font-size: 16px; margin-top: 0;">Hola <strong>%s</strong>,</p>
                    <p style="font-size: 15px; color: #475569;">Tu cuenta para el comercio <strong>%s</strong> ha sido creada correctamente en nuestro sistema.</p>
                    
                    <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; border-radius: 4px; margin: 24px 0;">
                        <p style="margin: 0; font-weight: 600; color: #1e293b; font-size: 14px;">Tus credenciales de acceso:</p>
                        <p style="margin: 8px 0 0 0; font-size: 14px;"><strong>Usuario / Email:</strong> %s</p>
                        <p style="margin: 4px 0 0 0; font-size: 14px;"><strong>Contraseña temporal:</strong> <span style="font-family: monospace; background-color: #e2e8f0; padding: 2px 6px; border-radius: 4px;">%s</span></p>
                    </div>
                    
                    <p style="font-size: 14px; color: #64748b;">Te sugerimos ingresar al sistema y cambiar tu contraseña desde la configuración de tu cuenta.</p>
                </div>
                <div style="background-color: #f1f5f9; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="font-size: 12px; color: #94a3b8; margin: 0;">BÁEZ POS - Sistema de Gestión Comercial Multi-tenant</p>
                </div>
            </div>
            """.formatted(nombreUsuario, nombreEmpresa, destinatario, passwordTemporal);

        enviarCorreoPro(destinatario, asunto, contenidoHtml);
    }

    // ==========================================
    // NOTIFICACIÓN DE BIENVENIDA SIN CONTRASEÑA (Para Setup Inicial / AuthService)
    // ==========================================
    @Async
    public void enviarMailBienvenida(String destinatario, String nombreUsuario, String nombreEmpresa) {
        String asunto = "¡Bienvenido a BAEZ POS! - Configuración de Cuenta";

        String contenidoHtml = """
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #2563eb; padding: 24px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">¡Bienvenido a BÁEZ POS!</h1>
                </div>
                <div style="padding: 32px; background-color: #ffffff;">
                    <p style="font-size: 16px; margin-top: 0;">Hola <strong>%s</strong>,</p>
                    <p style="font-size: 15px; color: #475569;">Tu cuenta para el comercio <strong>%s</strong> ha sido configurada correctamente en nuestro sistema.</p>

                    <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; border-radius: 4px; margin: 24px 0;">
                        <p style="margin: 0; font-weight: 600; color: #1e293b; font-size: 14px;">Tu usuario de acceso:</p>
                        <p style="margin: 8px 0 0 0; font-size: 14px;"><strong>Email:</strong> %s</p>
                    </div>

                    <p style="font-size: 14px; color: #64748b;">Ya podés ingresar a la plataforma con las credenciales creadas durante la configuración.</p>
                </div>
                <div style="background-color: #f1f5f9; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="font-size: 12px; color: #94a3b8; margin: 0;">BÁEZ POS - Sistema de Gestión Comercial Multi-tenant</p>
                </div>
            </div>
            """.formatted(nombreUsuario, nombreEmpresa, destinatario);

        enviarCorreoPro(destinatario, asunto, contenidoHtml);
    }

    // ==========================================
    // NOTIFICACIÓN DE RESETEO DE CONTRASEÑA
    // ==========================================
    @Async
    public void enviarMailResetPassword(String destinatario, String nombreUsuario, String nuevaPassword) {
        String asunto = "BAEZ POS - Restablecimiento de Contraseña";

        String contenidoHtml = """
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #dc2626; padding: 24px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Restablecimiento de Contraseña</h1>
                </div>
                <div style="padding: 32px; background-color: #ffffff;">
                    <p style="font-size: 16px; margin-top: 0;">Hola <strong>%s</strong>,</p>
                    <p style="font-size: 15px; color: #475569;">Se ha generado una nueva contraseña para tu cuenta de acceso.</p>
                    
                    <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 4px; margin: 24px 0;">
                        <p style="margin: 0; font-weight: 600; color: #991b1b; font-size: 14px;">Tu nueva contraseña temporal:</p>
                        <p style="margin: 8px 0 0 0; font-size: 18px; font-weight: bold; color: #dc2626; font-family: monospace;">%s</p>
                    </div>
                    
                    <p style="font-size: 14px; color: #64748b;">Podés ingresar con esta contraseña y modificarla desde tu panel de usuario.</p>
                </div>
                <div style="background-color: #f1f5f9; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="font-size: 12px; color: #94a3b8; margin: 0;">Si no solicitaste este cambio, comunicate inmediatamente con el Administrador de tu empresa.</p>
                </div>
            </div>
            """.formatted(nombreUsuario, nuevaPassword);

        enviarCorreoPro(destinatario, asunto, contenidoHtml);
    }
}