package com.baez.baezpos.mail.service;

public interface EmailService {
    void enviarMailBienvenida(String destinatario, String nombreEmpresa, String nombreUsuario, String passwordTemporal);
    void enviarMailBienvenida(String destinatario, String nombreUsuario, String nombreEmpresa);
    void enviarMailResetPassword(String destinatario, String nombreUsuario, String nuevaPassword);
}