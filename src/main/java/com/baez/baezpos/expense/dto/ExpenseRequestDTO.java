package com.baez.baezpos.expense.dto;

import com.baez.baezpos.expense.entity.ExpenseCategory;
import com.baez.baezpos.shared.entity.PaymentMethod;
import java.math.BigDecimal;

public record ExpenseRequestDTO(
        String description,
        BigDecimal amount,
        Boolean deductFromBox,
        ExpenseCategory category,
        PaymentMethod paymentMethod,
        String reference
) {}