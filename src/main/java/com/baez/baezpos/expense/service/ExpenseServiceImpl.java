package com.baez.baezpos.expense.service;

import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.company.repository.CompanyRepository;
import com.baez.baezpos.expense.dto.ExpenseRequestDTO;
import com.baez.baezpos.expense.dto.ExpenseResponseDTO;
import com.baez.baezpos.expense.entity.Expense;
import com.baez.baezpos.expense.repository.ExpenseRepository;
import com.baez.baezpos.log.service.AuditService;
import com.baez.baezpos.security.util.SecurityUtils;
import com.baez.baezpos.shared.exception.BadRequestException;
import com.baez.baezpos.shared.exception.ResourceNotFoundException;
import com.baez.baezpos.shared.exception.UnauthorizedException;
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
    private final AuditService auditService;

    @Override
    @Transactional
    public ExpenseResponseDTO createExpense(ExpenseRequestDTO dto) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        if (companyId == null) {
            throw new UnauthorizedException("No hay una sesión activa o el contexto de empresa es inválido.");
        }

        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Empresa no encontrada con ID: " + companyId));

        boolean deductFromBox = (dto.deductFromBox() != null) ? dto.deductFromBox() : true;

        Expense expense = Expense.builder()
                .description(dto.description().trim())
                .amount(dto.amount())
                .deductFromBox(deductFromBox)
                .category(dto.category())
                .paymentMethod(dto.paymentMethod())
                .reference(dto.reference() != null ? dto.reference().trim() : null)
                .expenseDate(LocalDateTime.now())
                .build();

        expense.setCompany(company);

        Expense saved = expenseRepository.save(expense);
        log.info("Empresa [{}]: Gasto registrado por $ {} - Cat: {} - Descuenta Caja: {}",
                companyId, saved.getAmount(), saved.getCategory(), saved.getDeductFromBox());

        auditService.logAction(
                "GASTO_CREADO",
                String.format("Gasto ID [%d] registrado por $ %.2f (%s) - Categoría: %s",
                        saved.getId(), saved.getAmount(), saved.getDescription(), saved.getCategory()),
                "INFO"
        );

        return mapToDTO(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ExpenseResponseDTO> getAllExpenses() {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        if (companyId == null) {
            throw new UnauthorizedException("Acceso denegado: Contexto de empresa no identificado.");
        }

        return expenseRepository.findByCompanyIdOrderByExpenseDateDesc(companyId)
                .stream()
                .map(this::mapToDTO)
                .toList();
    }

    @Override
    @Transactional
    public void deleteExpense(Long id) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        if (companyId == null) {
            throw new UnauthorizedException("Acceso denegado: Contexto de empresa no identificado.");
        }

        Expense expense = expenseRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Gasto no encontrado o no pertenece a su empresa. ID: " + id));

        expenseRepository.delete(expense);
        log.warn("Empresa [{}]: Gasto ID [{}] eliminado por $ {}", companyId, id, expense.getAmount());

        auditService.logAction(
                "GASTO_ELIMINADO",
                String.format("Gasto ID [%d] eliminado. Monto: $ %.2f | Concepto: %s",
                        id, expense.getAmount(), expense.getDescription()),
                "WARN"
        );
    }

    private ExpenseResponseDTO mapToDTO(Expense expense) {
        return new ExpenseResponseDTO(
                expense.getId(),
                expense.getDescription(),
                expense.getAmount(),
                expense.getExpenseDate(),
                expense.getDeductFromBox() != null ? expense.getDeductFromBox() : true,
                expense.getCategory(),
                expense.getPaymentMethod(),
                expense.getReference()
        );
    }
}