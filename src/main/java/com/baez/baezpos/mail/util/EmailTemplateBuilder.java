package com.baez.baezpos.mail.util;

import org.springframework.web.util.HtmlUtils;

public final class EmailTemplateBuilder {

    private EmailTemplateBuilder() {
        // Clase de utilidad estática
    }

    public static String buildBienvenidaConPassword(String nombreUsuario, String nombreEmpresa, String destinatario, String passwordTemporal) {
        String safeUsuario = HtmlUtils.htmlEscape(nombreUsuario);
        String safeEmpresa = HtmlUtils.htmlEscape(nombreEmpresa);
        String safeDestinatario = HtmlUtils.htmlEscape(destinatario);
        String safePassword = HtmlUtils.htmlEscape(passwordTemporal);

        return """
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                    <div style="background-color: #2563eb; padding: 24px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">¡Bienvenido a BÁEZ POS!</h1>
                    </div>
                    <div style="padding: 32px; color: #1e293b;">
                        <p style="font-size: 16px; margin-top: 0;">Hola <strong>%s</strong>,</p>
                        <p style="font-size: 15px; color: #475569; line-height: 1.5;">Tu cuenta para el comercio <strong>%s</strong> ha sido activada correctamente.</p>
                        
                        <div style="background-color: #f1f5f9; border-left: 4px solid #2563eb; padding: 16px; border-radius: 4px; margin: 24px 0;">
                            <p style="margin: 0; font-weight: 600; color: #0f172a; font-size: 14px;">Credenciales de acceso asignadas:</p>
                            <p style="margin: 8px 0 0 0; font-size: 14px;"><strong>Usuario / Email:</strong> %s</p>
                            <p style="margin: 6px 0 0 0; font-size: 14px;"><strong>Contraseña temporal:</strong> <span style="font-family: monospace; background-color: #e2e8f0; padding: 2px 8px; border-radius: 4px; font-weight: bold; color: #1e293b;">%s</span></p>
                        </div>
                        
                        <p style="font-size: 14px; color: #64748b; margin-bottom: 0;">Te recomendamos ingresar a la plataforma y renovar tu contraseña inmediatamente desde la sección de configuración.</p>
                    </div>
                    <div style="background-color: #f1f5f9; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0;">
                        <p style="font-size: 12px; color: #94a3b8; margin: 0;">BÁEZ POS &copy; Sistema de Gestión Comercial Multi-tenant</p>
                    </div>
                </div>
            </body>
            </html>
            """.formatted(safeUsuario, safeEmpresa, safeDestinatario, safePassword);
    }

    public static String buildBienvenidaSinPassword(String nombreUsuario, String nombreEmpresa, String destinatario) {
        String safeUsuario = HtmlUtils.htmlEscape(nombreUsuario);
        String safeEmpresa = HtmlUtils.htmlEscape(nombreEmpresa);
        String safeDestinatario = HtmlUtils.htmlEscape(destinatario);

        return """
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                    <div style="background-color: #2563eb; padding: 24px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">¡Bienvenido a BÁEZ POS!</h1>
                    </div>
                    <div style="padding: 32px; color: #1e293b;">
                        <p style="font-size: 16px; margin-top: 0;">Hola <strong>%s</strong>,</p>
                        <p style="font-size: 15px; color: #475569; line-height: 1.5;">Tu usuario para el comercio <strong>%s</strong> ha sido registrado con éxito.</p>

                        <div style="background-color: #f1f5f9; border-left: 4px solid #2563eb; padding: 16px; border-radius: 4px; margin: 24px 0;">
                            <p style="margin: 0; font-weight: 600; color: #0f172a; font-size: 14px;">Cuenta vinculada:</p>
                            <p style="margin: 8px 0 0 0; font-size: 14px;"><strong>Email:</strong> %s</p>
                        </div>

                        <p style="font-size: 14px; color: #64748b; margin-bottom: 0;">Podés iniciar sesión en el portal comercial utilizando la contraseña previamente configurada.</p>
                    </div>
                    <div style="background-color: #f1f5f9; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0;">
                        <p style="font-size: 12px; color: #94a3b8; margin: 0;">BÁEZ POS &copy; Sistema de Gestión Comercial Multi-tenant</p>
                    </div>
                </div>
            </body>
            </html>
            """.formatted(safeUsuario, safeEmpresa, safeDestinatario);
    }

    public static String buildResetPassword(String nombreUsuario, String nuevaPassword) {
        String safeUsuario = HtmlUtils.htmlEscape(nombreUsuario);
        String safePassword = HtmlUtils.htmlEscape(nuevaPassword);

        return """
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                    <div style="background-color: #dc2626; padding: 24px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Restablecimiento de Contraseña</h1>
                    </div>
                    <div style="padding: 32px; color: #1e293b;">
                        <p style="font-size: 16px; margin-top: 0;">Hola <strong>%s</strong>,</p>
                        <p style="font-size: 15px; color: #475569; line-height: 1.5;">Se ha generado una nueva contraseña temporal para recuperar el acceso a tu cuenta.</p>
                        
                        <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 4px; margin: 24px 0;">
                            <p style="margin: 0; font-weight: 600; color: #991b1b; font-size: 14px;">Nueva contraseña provisoria:</p>
                            <p style="margin: 8px 0 0 0; font-size: 18px; font-weight: bold; color: #dc2626; font-family: monospace;">%s</p>
                        </div>
                        
                        <p style="font-size: 14px; color: #64748b; margin-bottom: 0;">Iniciá sesión con esta clave y modifícala desde tu panel de usuario por razones de seguridad.</p>
                    </div>
                    <div style="background-color: #f1f5f9; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0;">
                        <p style="font-size: 12px; color: #94a3b8; margin: 0;">Si no solicitaste esta acción, comunicate de inmediato con el administrador de tu empresa.</p>
                    </div>
                </div>
            </body>
            </html>
            """.formatted(safeUsuario, safePassword);
    }
}