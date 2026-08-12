package com.baez.baezpos.customer.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record CustomerMovementDTO(
        Long id,
        BigDecimal amount,
        String type,
        String description,
        String paymentMethod,
        LocalDateTime createdAt,
        BigDecimal subtotal,
        BigDecimal surchargeAmount,
        BigDecimal surchargePercentage,
        BigDecimal totalAmount,
        List<ItemDetailDTO> itemsDetail
) {
    public record ItemDetailDTO(
            String productName,
            BigDecimal quantity,
            Boolean isFractional,
            BigDecimal price,
            BigDecimal subtotal
    ) {}
}