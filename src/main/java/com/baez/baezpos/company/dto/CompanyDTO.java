package com.baez.baezpos.company.dto;

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
    private String name;
    private String taxId;
    private String address;
    private String phone;
    private String email;
    private LocalDate expirationDate;
    private Boolean active;
    private BigDecimal monthlyFee; // <--- Agregado
    private String ticketMessage;
    private String ownerPassword;

    // ==========================================
    // CAMPOS FISCALES AGREGADOS (ARCA / AFIP)
    // ==========================================
    private Boolean hasTaxData;
    private String iibb;
    private String inicioActividades;
    private String condicionIva;
}