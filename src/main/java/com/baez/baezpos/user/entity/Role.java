package com.baez.baezpos.user.entity;

public enum Role {
    SUPER_ADMIN, // Dueño del SaaS (Alexander - Administrador Maestro de la plataforma)
    ADMIN,       // Dueño del Comercio / Kiosco (Cliente SaaS)
    VENDEDOR     // Empleado General (Cajero)
}