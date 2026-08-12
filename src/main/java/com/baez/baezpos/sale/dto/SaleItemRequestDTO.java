package com.baez.baezpos.sale.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

public record SaleItemRequestDTO(
        @NotNull(message = "El ID del producto es obligatorio")
        Long productId,

        @NotNull(message = "La cantidad es obligatoria")
        @Positive(message = "La cantidad debe ser mayor a 0")
        BigDecimal quantity,

        @Positive(message = "El precio personalizado debe ser mayor a 0")
        BigDecimal price
) {}