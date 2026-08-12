package com.baez.baezpos.inventory.controller;

import com.baez.baezpos.inventory.dto.InventoryMovementRequest;
import com.baez.baezpos.inventory.dto.InventoryMovementResponseDTO;
import com.baez.baezpos.inventory.service.InventoryService.InventoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;

    @PostMapping("/movement")
    @PreAuthorize("hasAnyRole('ADMIN', 'GERENTE')")
    public ResponseEntity<InventoryMovementResponseDTO> register(@Valid @RequestBody InventoryMovementRequest request) {
        InventoryMovementResponseDTO movement = inventoryService.registerMovement(
                request.getProductId(),
                request.getQuantity(),
                request.getType(),
                request.getReason()
        );
        return new ResponseEntity<>(movement, HttpStatus.CREATED);
    }

    @GetMapping("/product/{productId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'GERENTE', 'CAJERO')")
    public ResponseEntity<List<InventoryMovementResponseDTO>> getByProduct(@PathVariable Long productId) {
        return ResponseEntity.ok(inventoryService.getProductMovements(productId));
    }

    @GetMapping("/recent")
    @PreAuthorize("hasAnyRole('ADMIN', 'GERENTE')")
    public ResponseEntity<List<InventoryMovementResponseDTO>> getRecent() {
        return ResponseEntity.ok(inventoryService.getAllRecentMovements());
    }
}