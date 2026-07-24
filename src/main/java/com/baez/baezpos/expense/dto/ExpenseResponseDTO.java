package com.baez.baezpos.expense.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ExpenseResponseDTO(
        Long id,
        String description,
        BigDecimal amount,
        LocalDateTime expenseDate
) {}