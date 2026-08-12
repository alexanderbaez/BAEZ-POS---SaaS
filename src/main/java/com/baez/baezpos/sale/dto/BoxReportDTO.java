package com.baez.baezpos.sale.dto;

import java.math.BigDecimal;

public record BoxReportDTO(
        BigDecimal totalSalesToday,
        BigDecimal cashSalesToday,
        BigDecimal transferSalesToday,
        BigDecimal creditSalesToday,
        BigDecimal customerPaymentsToday,
        BigDecimal expensesToday,
        BigDecimal realBalance,
        BigDecimal totalPendingCredit,
        BigDecimal periodSales,
        Long periodOperations,
        BigDecimal periodProfit,
        BigDecimal periodReplacementCost
) {}