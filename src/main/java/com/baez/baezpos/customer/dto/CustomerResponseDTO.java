package com.baez.baezpos.customer.dto;

import java.math.BigDecimal;

public record CustomerResponseDTO(
        Long id,
        String name,
        String phone,
        String dniCuit,
        BigDecimal currentBalance,
        BigDecimal creditLimit,
        Boolean active
) {}