package com.baez.baezpos.provider.controller;

import com.baez.baezpos.provider.dto.PurchaseOrderRequestDTO;
import com.baez.baezpos.provider.dto.PurchaseOrderResponseDTO;
import com.baez.baezpos.provider.service.PurchaseOrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/purchase-orders")
@RequiredArgsConstructor
public class PurchaseOrderController {

    private final PurchaseOrderService purchaseOrderService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'GERENTE')")
    public ResponseEntity<PurchaseOrderResponseDTO> create(@Valid @RequestBody PurchaseOrderRequestDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(purchaseOrderService.createOrder(dto));
    }

    @PutMapping("/{id}/receive")
    @PreAuthorize("hasAnyRole('ADMIN', 'GERENTE')")
    public ResponseEntity<PurchaseOrderResponseDTO> receive(@PathVariable Long id) {
        return ResponseEntity.ok(purchaseOrderService.receiveOrder(id));
    }

    @PutMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('ADMIN', 'GERENTE')")
    public ResponseEntity<PurchaseOrderResponseDTO> cancel(@PathVariable Long id) {
        return ResponseEntity.ok(purchaseOrderService.cancelOrder(id));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'GERENTE')")
    public ResponseEntity<Void> deleteOrder(@PathVariable Long id) {
        purchaseOrderService.deleteOrder(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/send-email")
    @PreAuthorize("hasAnyRole('ADMIN', 'GERENTE')")
    public ResponseEntity<Void> sendEmail(@PathVariable Long id) {
        purchaseOrderService.sendPurchaseOrderEmail(id);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'GERENTE')")
    public ResponseEntity<PurchaseOrderResponseDTO> getById(@PathVariable Long id) {
        return ResponseEntity.ok(purchaseOrderService.getOrderById(id));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'GERENTE')")
    public ResponseEntity<Page<PurchaseOrderResponseDTO>> listAll(
            @PageableDefault(size = 20, sort = "orderDate", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(purchaseOrderService.getAllOrders(pageable));
    }

    @GetMapping("/provider/{providerId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'GERENTE')")
    public ResponseEntity<Page<PurchaseOrderResponseDTO>> listByProvider(
            @PathVariable Long providerId,
            @PageableDefault(size = 20, sort = "orderDate", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(purchaseOrderService.getOrdersByProvider(providerId, pageable));
    }
}
