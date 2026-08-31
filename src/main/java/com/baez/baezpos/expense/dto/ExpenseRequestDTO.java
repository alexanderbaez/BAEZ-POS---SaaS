package com.baez.baezpos.expense.dto;

import com.baez.baezpos.expense.entity.ExpenseCategory;
import com.baez.baezpos.shared.entity.PaymentMethod;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ExpenseRequestDTO(
        @NotBlank(message = "La descripciÃ³n del gasto es obligatoria.")
        @Size(max = 255, message = "La descripciÃ³n no puede superar los 255 caracteres.")
        String description,

        @NotNull(message = "El monto del gasto es obligatorio.")
        @Positive(message = "El monto del gasto debe ser mayor a cero.")
        BigDecimal amount,

        Boolean deductFromBox,

        @NotNull(message = "La categorÃ­a del gasto es obligatoria.")
        ExpenseCategory category,

        @NotNull(message = "El mÃ©todo de pago es obligatorio.")
        PaymentMethod paymentMethod,

        @Size(max = 100, message = "La referencia no puede superar los 100 caracteres.")
        String reference,

        Long providerId,

        @Size(max = 50, message = "El nÃºmero de comprobante/factura no puede superar los 50 caracteres.")
        String invoiceNumber,

        LocalDateTime expenseDate
) {}