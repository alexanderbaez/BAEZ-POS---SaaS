package com.baez.baezpos.sale.dto;

import java.math.BigDecimal;

public record SaleItemRequestDTO(
        Long productId,
        BigDecimal quantity, // BigDecimal para soportar fracciones: 0.250 kg, 1.500 kg, etc.
        BigDecimal price
) {}