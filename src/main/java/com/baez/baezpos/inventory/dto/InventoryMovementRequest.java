package com.baez.baezpos.inventory.dto;

import com.baez.baezpos.inventory.entity.MovementType;
import lombok.Data;

@Data
public class InventoryMovementRequest {
    private Long productId;
    private Integer quantity;
    private MovementType type;
    private String reason;
}