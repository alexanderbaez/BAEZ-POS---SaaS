package com.baez.baezpos.sale.dto;

import com.baez.baezpos.sale.entity.CashSessionStatus;
import java.math.BigDecimal;
import java.time.LocalDateTime;

public record CashSessionResponseDTO(
        Long id,
        Integer sessionNumber, // NUEVO
        String userName,
        LocalDateTime openedAt,
        LocalDateTime closedAt,
        BigDecimal initialAmount,
        BigDecimal declaredAmount,
        BigDecimal systemAmount,
        BigDecimal difference,
        CashSessionStatus status,
        String notes,
        BigDecimal totalCashSales,
        BigDecimal totalTransferSales,
        BigDecimal totalCreditSales,
        BigDecimal totalCustomerPayments,
        BigDecimal totalExpenses
) {}