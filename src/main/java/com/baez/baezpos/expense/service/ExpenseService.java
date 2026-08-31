package com.baez.baezpos.expense.service;

import com.baez.baezpos.expense.dto.ExpenseRequestDTO;
import com.baez.baezpos.expense.dto.ExpenseResponseDTO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface ExpenseService {
    ExpenseResponseDTO createExpense(ExpenseRequestDTO dto);
    List<ExpenseResponseDTO> getAllExpenses();
    org.springframework.data.domain.Page<ExpenseResponseDTO> getAllExpenses(java.time.LocalDate desde, java.time.LocalDate hasta, org.springframework.data.domain.Pageable pageable);
    void deleteExpense(Long id);
}