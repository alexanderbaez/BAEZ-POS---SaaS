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

    @Value("${spring.mail.username:no-reply@baezpos.com}")
    private String senderEmail;

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
            log.error("Error al enviar correo a {}. Detalle: {}", destinatario, e.getMessage());
        } catch (Exception e) {
            log.error("Error inesperado en el servicio de e-mail para {}: {}", destinatario, e.getMessage());
        }
    }
}