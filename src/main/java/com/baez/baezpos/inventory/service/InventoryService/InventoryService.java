package com.baez.baezpos.inventory.service.InventoryService;

import com.baez.baezpos.inventory.dto.InventoryMovementResponseDTO;
import com.baez.baezpos.inventory.entity.InventoryMovement;
import com.baez.baezpos.inventory.entity.MovementType;

import java.util.List;

public interface InventoryService {
    InventoryMovementResponseDTO registerMovement(Long productId, Integer quantity, MovementType type, String reason);
    List<InventoryMovementResponseDTO> getProductMovements(Long productId);
    List<InventoryMovementResponseDTO> getAllRecentMovements();
}