package com.baez.baezpos.company.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class CompanyDTO {
    private Long id;

    @NotBlank(message = "El nombre de la empresa es obligatorio")
    @Size(max = 150, message = "El nombre no puede superar 150 caracteres")
    private String name;

    @NotBlank(message = "El CUIT/TaxID es obligatorio")
    private String taxId;

    private String address;
    private String phone;

    @Email(message = "Debe proporcionar una direcci\u00F3n de correo v\u00E1lida")
    private String email;

    private LocalDate expirationDate;
    private Boolean active;
    private Integer maxEmployees;
    private BigDecimal monthlyFee;
    private String ticketMessage;
    private String adminName;
    private String ownerName;
    private String ownerPassword; // Se utiliza \u00FAnicamente si el SuperAdmin la env\u00EDa para resetear

    // CAMPOS FISCALES (ARCA / AFIP)
    private Boolean hasTaxData;
    private String afipEnvironment;
    private Integer posNumber;
    private String cuit;
    private String certPassword;
    private String iibb;
    private String inicioActividades;
    private String condicionIva;
}