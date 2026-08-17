package com.baez.baezpos.sale.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;

public record OpenCashSessionRequestDTO(
        @NotNull(message = "El monto inicial es obligatorio.")
        @PositiveOrZero(message = "El monto inicial no puede ser negativo.")
        BigDecimal initialAmount
) {}