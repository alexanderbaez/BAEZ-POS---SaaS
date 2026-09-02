package com.baez.baezpos.expense.dto;

import java.math.BigDecimal;

public record ExpenseCategorySummaryDTO(
        String category,
        Long count,
        BigDecimal total
) {}
