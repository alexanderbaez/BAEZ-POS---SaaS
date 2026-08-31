package com.baez.baezpos.expense.service;

import com.baez.baezpos.expense.dto.ExpenseRequestDTO;
import com.baez.baezpos.expense.dto.ExpenseResponseDTO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface ExpenseService {
    ExpenseResponseDTO createExpense(ExpenseRequestDTO dto);
    List<ExpenseResponseDTO> getAllExpenses();
    Page<ExpenseResponseDTO> getAllExpenses(Pageable pageable);
    void deleteExpense(Long id);
}