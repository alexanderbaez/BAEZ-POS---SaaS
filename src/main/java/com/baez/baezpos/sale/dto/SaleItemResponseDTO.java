package com.baez.baezpos.sale.dto;

import java.math.BigDecimal;

public record SaleItemResponseDTO(
        String productName,
        BigDecimal quantity, // BigDecimal para mostrar fracciones correctamente en historial
        BigDecimal price,
        BigDecimal subtotal
) {}