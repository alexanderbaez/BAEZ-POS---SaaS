package com.baez.baezpos.expense.dto;

import java.math.BigDecimal;

public record ExpenseRequestDTO(
        String description,
        BigDecimal amount,
        Boolean deductFromBox
) {}