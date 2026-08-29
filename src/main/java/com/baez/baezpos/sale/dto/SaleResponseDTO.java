package com.baez.baezpos.sale.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record SaleResponseDTO(
        Long id,
        LocalDateTime saleDate,
        BigDecimal total,
        BigDecimal discount,
        BigDecimal surcharge,
        BigDecimal surchargeRate,
        String paymentMethod,
        Boolean canceled,
        String userName,
        String companyName,
        String companyCuit,
        String companyAddress,
        List<SaleItemResponseDTO> items,
        String cae,
        String caeVto,
        String tipoComprobante,
        String nroComprobante,
        String invoiceType,
        String invoiceNumber,
        LocalDate caeExpiration
) {
    @JsonProperty("sellerName")
    public String sellerName() {
        return userName != null ? userName : "Desconocido";
    }

    @JsonProperty("cashierName")
    public String cashierName() {
        return userName != null ? userName : "Desconocido";
    }
}