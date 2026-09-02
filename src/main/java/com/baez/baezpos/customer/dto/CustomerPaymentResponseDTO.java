package com.baez.baezpos.customer.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record CustomerPaymentResponseDTO(
        Long id,
        Long customerId,
        String customerName,
        BigDecimal amount,
        String paymentMethod,
        String description,
        LocalDateTime date
) {}
