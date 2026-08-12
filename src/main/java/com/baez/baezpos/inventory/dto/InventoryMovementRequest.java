package com.baez.baezpos.inventory.dto;

import com.baez.baezpos.inventory.entity.MovementType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class InventoryMovementRequest {

    @NotNull(message = "El ID del producto es obligatorio")
    private Long productId;

    @NotNull(message = "La cantidad es obligatoria")
    @Positive(message = "La cantidad debe ser mayor a cero")
    private BigDecimal quantity;

    @NotNull(message = "El tipo de movimiento es obligatorio")
    private MovementType type;

    private String reason;
}