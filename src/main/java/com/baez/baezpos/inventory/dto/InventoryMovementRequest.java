package com.baez.baezpos.inventory.dto;

import com.baez.baezpos.inventory.entity.MovementType;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class InventoryMovementRequest {
    private Long productId;
    private BigDecimal quantity; // BigDecimal para soportar movimientos fraccionados
    private MovementType type;
    private String reason;
}