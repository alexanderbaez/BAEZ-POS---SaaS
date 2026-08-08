package com.baez.baezpos.inventory.service;

import com.baez.baezpos.inventory.dto.InventoryMovementResponseDTO;
import com.baez.baezpos.inventory.entity.MovementType;

import java.math.BigDecimal;
import java.util.List;

public interface InventoryService {
    /**
     * Registra un movimiento de stock.
     * @param productId ID del producto
     * @param quantity  Cantidad en BigDecimal (soporta fracciones: 0.250 kg, 1.500 kg, etc.)
     * @param type      Tipo de movimiento (SALE, PURCHASE, ADJUSTMENT_IN, etc.)
     * @param reason    Descripción del movimiento
     */
    InventoryMovementResponseDTO registerMovement(Long productId, BigDecimal quantity, MovementType type, String reason);

    List<InventoryMovementResponseDTO> getProductMovements(Long productId);
    List<InventoryMovementResponseDTO> getAllRecentMovements();
}