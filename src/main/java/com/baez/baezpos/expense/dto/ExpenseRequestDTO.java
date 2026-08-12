package com.baez.baezpos.expense.dto;

import com.baez.baezpos.expense.entity.ExpenseCategory;
import com.baez.baezpos.shared.entity.PaymentMethod;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record ExpenseRequestDTO(
        @NotBlank(message = "La descripción del gasto es obligatoria.")
        @Size(max = 255, message = "La descripción no puede superar los 255 caracteres.")
        String description,

        @NotNull(message = "El monto del gasto es obligatorio.")
        @Positive(message = "El monto del gasto debe ser mayor a cero.")
        BigDecimal amount,

        Boolean deductFromBox,

        @NotNull(message = "La categoría del gasto es obligatoria.")
        ExpenseCategory category,

        @NotNull(message = "El método de pago es obligatorio.")
        PaymentMethod paymentMethod,

        @Size(max = 100, message = "La referencia no puede superar los 100 caracteres.")
        String reference
) {}