package com.baez.baezpos.provider.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record PurchaseOrderItemRequestDTO(
        @NotNull(message = "El producto es obligatorio") Long productId,
        @NotNull(message = "La cantidad es obligatoria") @DecimalMin(value = "0.01", message = "La cantidad debe ser mayor a 0") BigDecimal quantity,
        @NotNull(message = "El costo unitario es obligatorio") @DecimalMin(value = "0.00", message = "El costo no puede ser negativo") BigDecimal unitCost
) {}
