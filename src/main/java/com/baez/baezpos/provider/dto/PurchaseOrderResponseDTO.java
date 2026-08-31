package com.baez.baezpos.provider.dto;

import com.baez.baezpos.provider.entity.OrderStatus;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record PurchaseOrderResponseDTO(
        Long id,
        Long providerId,
        String providerName,
        OrderStatus status,
        LocalDateTime orderDate,
        LocalDateTime receptionDate,
        BigDecimal totalAmount,
        List<PurchaseOrderItemResponseDTO> items
) {}
