package com.baez.baezpos.inventory.dto;

import com.baez.baezpos.inventory.entity.MovementType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InventoryMovementResponseDTO {
    private Long id;
    private Long productId;
    private String productName;
    private MovementType movementType;
    private BigDecimal quantity; // BigDecimal para mostrar fracciones en historial de inventario
    private String reason;
    private LocalDateTime createdAt;
}