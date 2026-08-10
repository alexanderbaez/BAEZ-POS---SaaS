package com.baez.baezpos.company.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class MasterRegistrationRequest {
    private String companyName;
    private String taxId;
    private String address;
    private String phone;
    private String ticketMessage;
    private BigDecimal monthlyFee; // <--- Agregado para el alta inicial
    private LocalDate expirationDate;

    // --- DATOS DEL DUEÑO (ADMIN) ---
    private String ownerName;
    private String ownerEmail;
    private String ownerPassword;
}