package com.baez.baezpos.expense.service;

import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.company.repository.CompanyRepository;
import com.baez.baezpos.expense.dto.ExpenseRequestDTO;
import com.baez.baezpos.expense.dto.ExpenseResponseDTO;
import com.baez.baezpos.expense.entity.Expense;
import com.baez.baezpos.expense.repository.ExpenseRepository;
import com.baez.baezpos.security.util.SecurityUtils;
import com.baez.baezpos.shared.exception.BadRequestException;
import com.baez.baezpos.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
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
        if (companyId == null) {
            throw new BadRequestException("No se puede registrar un gasto sin contexto de empresa.");
        }

        if (dto.description() == null || dto.description().isBlank()) {
            throw new BadRequestException("La descripción del gasto es obligatoria.");
        }

        if (dto.amount() == null || dto.amount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BadRequestException("El monto del gasto debe ser mayor a cero.");
        }

        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Empresa no encontrada"));

        // Si no se especifica en el Request, por defecto se descuenta de caja
        Boolean deductFromBox = (dto.deductFromBox() != null) ? dto.deductFromBox() : true;

        Expense expense = Expense.builder()
                .description(dto.description().trim())
                .amount(dto.amount())
                .deductFromBox(deductFromBox)
                .expenseDate(LocalDateTime.now())
                .build();

        expense.setCompany(company);

        Expense saved = expenseRepository.save(expense);
        log.info("Empresa [{}]: Registrar nuevo gasto por ${} ({}) - Resta caja: {}",
                companyId, dto.amount(), dto.description(), deductFromBox);

        return mapToDTO(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ExpenseResponseDTO> getAllExpenses() {
        Long companyId = SecurityUtils.getCurrentCompanyId();

        List<Expense> expenses;
        if (companyId != null) {
            expenses = expenseRepository.findByCompanyIdOrderByExpenseDateDesc(companyId);
        } else {
            // SUPER_ADMIN trae la lista general de gastos de todas las empresas
            expenses = expenseRepository.findAll();
        }

        return expenses.stream()
                .map(this::mapToDTO)
                .toList();
    }

    @Override
    @Transactional
    public void deleteExpense(Long id) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        Expense expense;

        if (companyId != null) {
            expense = expenseRepository.findByIdAndCompanyId(id, companyId)
                    .orElseThrow(() -> new ResourceNotFoundException("Gasto no encontrado en su empresa"));
        } else {
            expense = expenseRepository.findById(id)
                    .orElseThrow(() -> new ResourceNotFoundException("Gasto no encontrado"));
        }

        expenseRepository.delete(expense);
        log.warn("Gasto ID [{}] eliminado de la empresa [{}]", id, companyId);
    }

    private ExpenseResponseDTO mapToDTO(Expense expense) {
        return new ExpenseResponseDTO(
                expense.getId(),
                expense.getDescription(),
                expense.getAmount(),
                expense.getExpenseDate(),
                expense.getDeductFromBox() != null ? expense.getDeductFromBox() : true
        );
    }
}