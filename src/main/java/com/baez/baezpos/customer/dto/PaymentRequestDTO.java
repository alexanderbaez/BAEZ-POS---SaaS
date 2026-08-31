package com.baez.baezpos.customer.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

public record PaymentRequestDTO(
        @NotNull(message = "El monto del pago es obligatorio")
        @Positive(message = "El monto del pago debe ser mayor a cero")
        BigDecimal amount,

        @NotBlank(message = "El mÃ©todo de pago es obligatorio")
        String method
) {}