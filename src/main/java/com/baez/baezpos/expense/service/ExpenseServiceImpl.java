package com.baez.baezpos.expense.service;

import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.company.repository.CompanyRepository;
import com.baez.baezpos.expense.dto.ExpenseRequestDTO;
import com.baez.baezpos.expense.dto.ExpenseResponseDTO;
import com.baez.baezpos.expense.entity.Expense;
import com.baez.baezpos.expense.repository.ExpenseRepository;
import com.baez.baezpos.security.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ExpenseServiceImpl implements ExpenseService {

    private final ExpenseRepository expenseRepository;
    private final CompanyRepository companyRepository;

    @Override
    @Transactional
    public ExpenseResponseDTO createExpense(ExpenseRequestDTO dto) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        Company company = companyRepository.getReferenceById(companyId);

        Expense expense = Expense.builder()
                .description(dto.description())
                .amount(dto.amount())
                .expenseDate(LocalDateTime.now())
                .build();

        expense.setCompany(company); // <-- ASIGNAMOS LA EMPRESA

        Expense saved = expenseRepository.save(expense);
        log.info("Empresa [{}]: Registrar nuevo gasto por ${} ({})", companyId, dto.amount(), dto.description());

        return mapToDTO(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ExpenseResponseDTO> getAllExpenses() {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        return expenseRepository.findByCompanyIdOrderByExpenseDateDesc(companyId)
                .stream()
                .map(this::mapToDTO)
                .toList();
    }

    private ExpenseResponseDTO mapToDTO(Expense expense) {
        return new ExpenseResponseDTO(
                expense.getId(),
                expense.getDescription(),
                expense.getAmount(),
                expense.getExpenseDate()
        );
    }
}