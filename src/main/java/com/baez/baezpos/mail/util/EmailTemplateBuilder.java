package com.baez.baezpos.mail.util;

import org.springframework.web.util.HtmlUtils;

/**
 * Generador de plantillas de correo HTML profesionales, responsive y modulares para BÃƒÂEZ POS.
 * DiseÃƒÂ±ado con compatibilidad universal para clientes de correo (Gmail, Outlook, Apple Mail, etc.).
 */
public final class EmailTemplateBuilder {

    private static final String APP_BASE_URL = "https://www.baezpos.com";
    private static final String LOGIN_URL = "https://www.baezpos.com/login.html";

    private EmailTemplateBuilder() {
        // Clase de utilidad estÃƒ¡tica
    }

    /**
     * Correo de bienvenida con credenciales temporales generadas.
     */
    public static String buildBienvenidaConPassword(String nombreUsuario, String nombreEmpresa, String destinatario, String passwordTemporal) {
        String safeUsuario = HtmlUtils.htmlEscape(nombreUsuario != null ? nombreUsuario : "Usuario");
        String safeEmpresa = HtmlUtils.htmlEscape(nombreEmpresa != null ? nombreEmpresa : "Comercio");
        String safeDestinatario = HtmlUtils.htmlEscape(destinatario != null ? destinatario : "");
        String safePassword = HtmlUtils.htmlEscape(passwordTemporal != null ? passwordTemporal : "");

        String bodyContent = """
            <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #334155;">
                Hola <strong style="color: #0f172a;">%s</strong>,
            </p>
            <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                Ã‚¡Te damos la bienvenida a <strong>BÃƒÂEZ POS</strong>! Tu usuario para la empresa <strong style="color: #1e40af;">%s</strong> ha sido dado de alta exitosamente en la plataforma.
            </p>

            <!-- CARD DE CREDENCIALES -->
            <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #2563eb; border-radius: 8px; overflow: hidden;">
                <tr>
                    <td style="padding: 20px;">
                        <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td style="padding-bottom: 12px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #1e40af;">
                                    Ã°Å¸â€â€˜ Tus Credenciales de Acceso
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0; font-size: 14px; color: #475569;">
                                    <strong style="color: #1e293b;">Usuario / Email:</strong>
                                    <span style="color: #0f172a; font-weight: 600; margin-left: 4px;">%s</span>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0; font-size: 14px; color: #475569;">
                                    <strong style="color: #1e293b;">ContraseÃƒÂ±a Temporal:</strong>
                                    <div style="margin-top: 6px;">
                                        <span style="display: inline-block; font-family: Consolas, Monaco, 'Courier New', monospace; font-size: 17px; font-weight: 700; color: #1e40af; background-color: #e0e7ff; padding: 6px 14px; border-radius: 6px; letter-spacing: 1px; border: 1px dashed #93c5fd;">
                                            %s
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>

            <!-- BOTON CTA PRINCIPAL -->
            <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="margin: 32px 0 28px 0;">
                <tr>
                    <td align="center">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td align="center" style="border-radius: 8px; background: linear-gradient(135deg, #2563eb 0%%, #1d4ed8 100%%); box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);">
                                    <a href="%s" target="_blank" style="display: inline-block; padding: 14px 36px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px; letter-spacing: 0.3px;">
                                        Ingresar al Sistema &rarr;
                                    </a>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>

            <!-- CONSEJO DE SEGURIDAD -->
            <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f1f5f9; border-radius: 6px; margin-top: 20px;">
                <tr>
                    <td style="padding: 14px 18px; font-size: 13px; color: #64748b; line-height: 1.5;">
                        Ã°Å¸â€º¡Ã¯Â¸Â <strong>RecomendaciÃƒÂ³n de Seguridad:</strong> Te sugerimos ingresar a la plataforma y actualizar tu contraseÃƒÂ±a de acceso desde el menÃƒÂº de perfil o configuraciÃƒÂ³n.
                    </td>
                </tr>
            </table>
            """.formatted(safeUsuario, safeEmpresa, safeDestinatario, safePassword, LOGIN_URL);

        return renderPlantillaBase(
                "Ã‚¡Bienvenido a BÃƒ¡ezPOS!",
                "Tu cuenta ha sido activada correctamente",
                "#2563eb",
                "#1e40af",
                bodyContent
        );
    }

    /**
     * Correo de bienvenida para confirmaciÃƒÂ³n de cuenta sin contraseÃƒÂ±a provisoria.
     */
    public static String buildBienvenidaSinPassword(String nombreUsuario, String nombreEmpresa, String destinatario) {
        String safeUsuario = HtmlUtils.htmlEscape(nombreUsuario != null ? nombreUsuario : "Usuario");
        String safeEmpresa = HtmlUtils.htmlEscape(nombreEmpresa != null ? nombreEmpresa : "Comercio");
        String safeDestinatario = HtmlUtils.htmlEscape(destinatario != null ? destinatario : "");

        String bodyContent = """
            <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #334155;">
                Hola <strong style="color: #0f172a;">%s</strong>,
            </p>
            <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                Tu usuario para la empresa <strong style="color: #1e40af;">%s</strong> ha sido vinculado exitosamente a <strong>BÃƒÂEZ POS</strong>.
            </p>

            <!-- CARD DE INFORMACIÃƒâ€œN DE CUENTA -->
            <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #2563eb; border-radius: 8px; overflow: hidden;">
                <tr>
                    <td style="padding: 20px;">
                        <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td style="padding-bottom: 8px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #1e40af;">
                                    Ã°Å¸â€˜Â¤ Cuenta Vinculada
                                </td>
                            </tr>
                            <tr>
                                <td style="font-size: 14px; color: #475569;">
                                    <strong style="color: #1e293b;">Email de Acceso:</strong>
                                    <span style="color: #0f172a; font-weight: 600; margin-left: 4px;">%s</span>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>

            <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                Ya podÃƒÂ©s iniciar sesiÃƒÂ³n utilizando la contraseÃƒÂ±a configurada previamente en tu registro.
            </p>

            <!-- BOTON CTA PRINCIPAL -->
            <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="margin: 32px 0 28px 0;">
                <tr>
                    <td align="center">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td align="center" style="border-radius: 8px; background: linear-gradient(135deg, #2563eb 0%%, #1d4ed8 100%%); box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);">
                                    <a href="%s" target="_blank" style="display: inline-block; padding: 14px 36px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px; letter-spacing: 0.3px;">
                                        Ingresar al Sistema &rarr;
                                    </a>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
            """.formatted(safeUsuario, safeEmpresa, safeDestinatario, LOGIN_URL);

        return renderPlantillaBase(
                "Ã‚¡Bienvenido a BÃƒ¡ezPOS!",
                "ConfirmaciÃƒÂ³n y alta de cuenta comercial",
                "#2563eb",
                "#1e40af",
                bodyContent
        );
    }

    /**
     * Correo de recuperaciÃƒÂ³n y restablecimiento de contraseÃƒÂ±a.
     */
    public static String buildResetPassword(String nombreUsuario, String nuevaPassword) {
        String safeUsuario = HtmlUtils.htmlEscape(nombreUsuario != null ? nombreUsuario : "Usuario");
        String safePassword = HtmlUtils.htmlEscape(nuevaPassword != null ? nuevaPassword : "");

        String bodyContent = """
            <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #334155;">
                Hola <strong style="color: #0f172a;">%s</strong>,
            </p>
            <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                Hemos recibido una solicitud para restablecer la contraseÃƒÂ±a de acceso a tu cuenta en <strong>BÃƒÂEZ POS</strong>.
            </p>
            <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                Por razones de seguridad, hemos generado una <strong>nueva clave provisoria</strong> para que puedas ingresar de inmediato:
            </p>

            <!-- CARD DE CONTRASEÃƒâ€˜A PROVISORIA -->
            <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0; background-color: #fef2f2; border: 1px solid #fee2e2; border-left: 4px solid #dc2626; border-radius: 8px; overflow: hidden;">
                <tr>
                    <td style="padding: 20px;">
                        <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td style="padding-bottom: 8px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #b91c1c;">
                                    Ã°Å¸â€â€™ Tu Clave Temporal de Acceso
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 4px 0;">
                                    <span style="display: inline-block; font-family: Consolas, Monaco, 'Courier New', monospace; font-size: 20px; font-weight: 800; color: #dc2626; background-color: #ffffff; padding: 8px 18px; border-radius: 6px; letter-spacing: 2px; border: 1px dashed #f87171;">
                                        %s
                                    </span>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>

            <!-- BOTON CTA PRINCIPAL -->
            <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="margin: 32px 0 28px 0;">
                <tr>
                    <td align="center">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td align="center" style="border-radius: 8px; background: linear-gradient(135deg, #dc2626 0%%, #b91c1c 100%%); box-shadow: 0 4px 12px rgba(220, 38, 38, 0.35);">
                                    <a href="%s" target="_blank" style="display: inline-block; padding: 14px 36px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px; letter-spacing: 0.3px;">
                                        Restablecer ContraseÃƒÂ±a &rarr;
                                    </a>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>

            <!-- ADVERTENCIA DE SEGURIDAD -->
            <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-top: 20px;">
                <tr>
                    <td style="padding: 14px 18px; font-size: 13px; color: #64748b; line-height: 1.5;">
                        Ã¢Å¡Â Ã¯Â¸Â <strong>Importante:</strong> Al ingresar con esta clave, modifÃƒÂ­cala desde tu panel personal. Si no solicitaste este cambio, comunicate inmediatamente con el administrador de tu negocio.
                    </td>
                </tr>
            </table>
            """.formatted(safeUsuario, safePassword, LOGIN_URL);

        return renderPlantillaBase(
                "Restablecimiento de ContraseÃƒÂ±a",
                "RecuperaciÃƒÂ³n y seguridad de tu cuenta",
                "#dc2626",
                "#991b1b",
                bodyContent
        );
    }

    /**
     * Correo de notificaciÃƒÂ³n de nueva Orden de Compra.
     */
    public static String buildPurchaseOrder(String nombreProveedor, String detallePedido, String companyName) {
        String safeProveedor = HtmlUtils.htmlEscape(nombreProveedor != null ? nombreProveedor : "Proveedor");
        String safeCompany = HtmlUtils.htmlEscape(companyName != null ? companyName : "Nuestra Empresa");
        
        String bodyContent = """
            <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #334155;">
                Hola <strong style="color: #0f172a;">%s</strong>,
            </p>
            <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                Te enviamos una nueva <strong>Orden de Compra</strong> desde <strong style="color: #1e40af;">%s</strong>.
            </p>
            
            <!-- DETALLE DEL PEDIDO -->
            <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #10b981; border-radius: 8px; overflow: hidden;">
                <tr>
                    <td style="padding: 20px;">
                        <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td style="padding-bottom: 12px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #047857;">
                                    Ã°Å¸â€œÂ¦ Detalle de la Orden
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0; font-size: 14px; color: #475569; font-family: Consolas, Monaco, 'Courier New', monospace; white-space: pre-wrap;">
%s
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>

            <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                Aguardamos confirmaciÃƒÂ³n. Ã‚¡Muchas gracias!<br>
                <strong>Atte. Equipo de %s</strong>
            </p>
            """.formatted(safeProveedor, safeCompany, detallePedido, safeCompany);

        return renderPlantillaBase(
                "Nueva Orden de Compra",
                "Detalle de pedido adjunto de " + safeCompany,
                "#10b981",
                "#047857",
                bodyContent
        );
    }

    /**
     * Estructura HTML base unificada: layout responsive en tablas (max-width 600px), fondo #f4f6f8,
     * contenedor blanco #ffffff, tipografÃƒÂ­a elegante, cabecera corporativa y pie de pÃƒ¡gina institucional.
     */
    private static String renderPlantillaBase(String tituloEncabezado, String subtituloEncabezado, String colorPrimario, String colorSecundario, String cuerpoHtml) {
        return """
            <!DOCTYPE html>
            <html lang="es" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="X-UA-Compatible" content="IE=edge">
                <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
                <title>%s</title>
                <style type="text/css">
                    body, table, td, a { -webkit-text-size-adjust: 100%%; -ms-text-size-adjust: 100%%; }
                    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
                    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%%; outline: none; text-decoration: none; }
                    table { border-collapse: collapse !important; }
                    body { height: 100%% !important; margin: 0 !important; padding: 0 !important; width: 100%% !important; background-color: #f4f6f8; }
                    @media screen and (max-width: 600px) {
                        .email-container { width: 100%% !important; margin: auto !important; }
                        .content-padding { padding: 24px 20px !important; }
                        .header-padding { padding: 28px 20px !important; }
                    }
                </style>
            </head>
            <body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                <!-- CONTENEDOR GLOBAL (WRAPPER) -->
                <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f6f8; margin: 0; padding: 30px 0;">
                    <tr>
                        <td align="center">
                            <!-- CONTENEDOR PRINCIPAL (MAX 600px) -->
                            <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 100%%; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.05);">
                                
                                <!-- ENCABEZADO CORPORATIVO -->
                                <tr>
                                    <td class="header-padding" align="center" style="background: linear-gradient(135deg, %s 0%%, %s 100%%); padding: 36px 30px; text-align: center;">
                                        <!-- BADGE LOGO -->
                                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 14px auto;">
                                            <tr>
                                                <td align="center" style="background-color: rgba(255, 255, 255, 0.18); padding: 6px 16px; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.25);">
                                                    <span style="font-size: 13px; font-weight: 700; color: #ffffff; letter-spacing: 1.5px; text-transform: uppercase;">
                                                        BÃƒÂEZ POS &bull; SaaS Cloud
                                                    </span>
                                                </td>
                                            </tr>
                                        </table>
                                        <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; line-height: 1.25;">
                                            %s
                                        </h1>
                                        <p style="margin: 8px 0 0 0; font-size: 14px; color: rgba(255, 255, 255, 0.9); font-weight: 400; line-height: 1.4;">
                                            %s
                                        </p>
                                    </td>
                                </tr>

                                <!-- CUERPO PRINCIPAL -->
                                <tr>
                                    <td class="content-padding" style="padding: 36px 32px; background-color: #ffffff; color: #1e293b;">
                                        %s
                                    </td>
                                </tr>

                                <!-- PIE DE PÃƒÂGINA (FOOTER) -->
                                <tr>
                                    <td align="center" style="background-color: #f8fafc; padding: 24px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
                                        <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #475569;">
                                            BÃƒÂEZ POS &mdash; Sistema de Punto de Venta y GestiÃƒÂ³n Comercial
                                        </p>
                                        <p style="margin: 0 0 12px 0; font-size: 12px; color: #64748b;">
                                            Portal Oficial: <a href="%s" target="_blank" style="color: #2563eb; text-decoration: none; font-weight: 600;">www.baezpos.com</a>
                                        </p>
                                        <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.4;">
                                            Este es un correo automÃƒ¡tico de seguridad y notificaciÃƒÂ³n. Por favor no respondas a este mensaje.<br>&copy; 2026 BÃƒÂEZ POS. Todos los derechos reservados.
                                        </p>
                                    </td>
                                </tr>

                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
            """.formatted(
                tituloEncabezado,
                colorPrimario,
                colorSecundario,
                tituloEncabezado,
                subtituloEncabezado,
                cuerpoHtml,
                APP_BASE_URL
        );
    }
}