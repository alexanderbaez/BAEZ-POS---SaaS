package com.baez.baezpos.sale.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;

public record CloseCashSessionRequestDTO(
        @NotNull(message = "El monto declarado es obligatorio.")
        @PositiveOrZero(message = "El monto declarado no puede ser negativo.")
        BigDecimal declaredAmount,

        String notes
) {}