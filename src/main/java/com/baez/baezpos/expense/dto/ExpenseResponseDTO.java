package com.baez.baezpos.expense.dto;

import com.baez.baezpos.expense.entity.ExpenseCategory;
import com.baez.baezpos.shared.entity.PaymentMethod;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ExpenseResponseDTO(
        Long id,
        String description,
        BigDecimal amount,
        LocalDateTime date,          // Renombrado a 'date' para machear con tu gastos.js
        Boolean deductFromBox,
        ExpenseCategory category,
        PaymentMethod paymentMethod,
        String reference
) {}