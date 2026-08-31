package com.baez.baezpos.provider.dto;

import java.math.BigDecimal;

public record PurchaseOrderItemResponseDTO(
        Long id,
        Long productId,
        String productName,
        String productBarcode,
        BigDecimal quantity,
        BigDecimal unitCost,
        BigDecimal subtotal
) {}
