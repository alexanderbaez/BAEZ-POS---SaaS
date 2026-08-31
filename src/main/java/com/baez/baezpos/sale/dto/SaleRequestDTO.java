package com.baez.baezpos.sale.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.util.List;

public record SaleRequestDTO(
        @NotEmpty(message = "La venta debe incluir al menos un Ã­tem")
        @Valid
        List<SaleItemRequestDTO> items,

        @PositiveOrZero(message = "El descuento no puede ser negativo")
        BigDecimal discount,

        @PositiveOrZero(message = "El recargo no puede ser negativo")
        BigDecimal surcharge,

        @PositiveOrZero(message = "El porcentaje de recargo no puede ser negativo")
        BigDecimal surchargeRate,

        @NotBlank(message = "El mÃ©todo de pago es obligatorio")
        String paymentMethod,

        Long customerId,
        Boolean isFiscal,
        Boolean emitInvoice
) {
    public boolean shouldEmitInvoice() {
        return Boolean.TRUE.equals(emitInvoice) || Boolean.TRUE.equals(isFiscal);
    }
}