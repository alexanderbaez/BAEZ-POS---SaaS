package com.baez.baezpos.provider.dto;

import com.baez.baezpos.shared.entity.PaymentMethod;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record ProviderPaymentRequestDTO(
        @NotNull(message = "El monto del pago es obligatorio.")
        @Positive(message = "El monto del pago debe ser mayor a cero.")
        BigDecimal amount,

        @NotNull(message = "El método de pago es obligatorio.")
        PaymentMethod paymentMethod,

        @Size(max = 255, message = "El comprobante o referencia no puede superar los 255 caracteres.")
        String reference,

        @Size(max = 50, message = "El número de comprobante o recibo no puede superar los 50 caracteres.")
        String invoiceNumber
) {}
