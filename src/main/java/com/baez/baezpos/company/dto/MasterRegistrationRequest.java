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

    // --- DATOS DEL DUEÑO (ADMIN) ---
    private String ownerName;

    @NotBlank(message = "El correo del dueño es obligatorio")
    @Email(message = "El correo del dueño debe ser una dirección de email válida")
    private String ownerEmail;

    @NotBlank(message = "La contraseña inicial es obligatoria")
    @Size(min = 6, message = "La contraseña debe tener al menos 6 caracteres")
    private String ownerPassword;
}