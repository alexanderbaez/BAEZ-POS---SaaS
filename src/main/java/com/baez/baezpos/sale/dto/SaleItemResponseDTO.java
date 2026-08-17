package com.baez.baezpos.sale.dto;

import java.math.BigDecimal;

public record SaleItemResponseDTO(
        Long productId,
        String productName,
        BigDecimal quantity,
        BigDecimal price,
        BigDecimal subtotal,
        String unitType
) {}