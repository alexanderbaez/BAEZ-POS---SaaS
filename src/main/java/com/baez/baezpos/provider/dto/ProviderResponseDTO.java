package com.baez.baezpos.provider.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ProviderResponseDTO(
        Long id,
        String businessName,
        String taxId,
        String phone,
        String email,
        BigDecimal currentBalance,
        Boolean active,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
