package com.baez.baezpos.company.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class MasterRegistrationRequest {

    @NotBlank(message = "El nombre de la empresa es obligatorio")
    @Size(max = 150, message = "El nombre no puede exceder los 150 caracteres")
    private String companyName;

    @NotBlank(message = "El CUIT/TaxID es obligatorio")
    @Size(max = 20, message = "El CUIT/TaxID no puede exceder los 20 caracteres")
    private String taxId;

    private String address;
    private String phone;
    private String ticketMessage;
    private BigDecimal monthlyFee;
    private Integer maxEmployees;
    private LocalDate expirationDate;

    // --- DATOS DEL DUEÃ‘O (ADMIN) ---
    private String adminName;
    private String ownerName;

    @NotBlank(message = "El correo del dueÃ±o es obligatorio")
    @Email(message = "El correo del dueÃ±o debe ser una direcciÃ³n de email vÃ¡lida")
    private String ownerEmail;

    @NotBlank(message = "La contraseÃ±a inicial es obligatoria")
    @Size(min = 6, message = "La contraseÃ±a debe tener al menos 6 caracteres")
    private String ownerPassword;

    public String getEffectiveAdminName() {
        if (adminName != null && !adminName.isBlank()) {
            return adminName.trim();
        }
        if (ownerName != null && !ownerName.isBlank()) {
            return ownerName.trim();
        }
        return companyName != null ? companyName.trim() : "Administrador";
    }
}