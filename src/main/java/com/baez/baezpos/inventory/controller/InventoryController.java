package com.baez.baezpos.inventory.controller;

import com.baez.baezpos.inventory.dto.InventoryMovementRequest;
import com.baez.baezpos.inventory.dto.InventoryMovementResponseDTO;
import com.baez.baezpos.inventory.service.InventoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/inventory")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class InventoryController {

    private final InventoryService inventoryService;

    @PostMapping("/movement")
    public ResponseEntity<InventoryMovementResponseDTO> register(@RequestBody InventoryMovementRequest request) {
        InventoryMovementResponseDTO movement = inventoryService.registerMovement(
                request.getProductId(),
                request.getQuantity(),
                request.getType(),
                request.getReason()
        );
        return new ResponseEntity<>(movement, HttpStatus.CREATED);
    }

    @GetMapping("/product/{productId}")
    public ResponseEntity<List<InventoryMovementResponseDTO>> getByProduct(@PathVariable Long productId) {
        return ResponseEntity.ok(inventoryService.getProductMovements(productId));
    }

    @GetMapping("/recent")
    public ResponseEntity<List<InventoryMovementResponseDTO>> getRecent() {
        return ResponseEntity.ok(inventoryService.getAllRecentMovements());
    }
}