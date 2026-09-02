package com.baez.baezpos.expense.service;

import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.company.repository.CompanyRepository;
import com.baez.baezpos.expense.dto.ExpenseRequestDTO;
import com.baez.baezpos.expense.dto.ExpenseResponseDTO;
import com.baez.baezpos.expense.entity.Expense;
import com.baez.baezpos.expense.entity.ExpenseCategory;
import com.baez.baezpos.expense.repository.ExpenseRepository;
import com.baez.baezpos.log.service.AuditService;
import com.baez.baezpos.provider.entity.Provider;
import com.baez.baezpos.provider.repository.ProviderRepository;
import com.baez.baezpos.security.util.SecurityUtils;
import com.baez.baezpos.shared.entity.PaymentMethod;
import com.baez.baezpos.shared.exception.ResourceNotFoundException;
import com.baez.baezpos.shared.exception.UnauthorizedException;
import com.baez.baezpos.sale.service.SaleService.CashRegisterService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import com.baez.baezpos.provider.service.ProviderService;
import org.springframework.context.annotation.Lazy;

@Service
@RequiredArgsConstructor
@Slf4j
public class ExpenseServiceImpl implements ExpenseService {

    private final ExpenseRepository expenseRepository;
    private final CompanyRepository companyRepository;
    private final ProviderRepository providerRepository;
    @Lazy
    private final ProviderService providerService;
    private final CashRegisterService cashRegisterService;
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

        boolean isEfectivoCaja = (dto.paymentMethod() == PaymentMethod.EFECTIVO_CAJA);
        boolean isTransferencia = (dto.paymentMethod() == PaymentMethod.TRANSFERENCIA);
        boolean deductFromBox = (isEfectivoCaja || isTransferencia) && (dto.deductFromBox() == null || dto.deductFromBox());

        // Si descuenta de la caja física (efectivo), validamos saldo disponible antes de proceder
        if (deductFromBox && isEfectivoCaja) {
            cashRegisterService.validatePhysicalCashAvailability(companyId, dto.amount());
        }

        // Validar que el proveedor pertenezca a la empresa si viene informado
        if (dto.providerId() != null) {
            providerRepository.findByIdAndCompanyId(dto.providerId(), companyId)
                    .orElseThrow(() -> new ResourceNotFoundException("Proveedor no encontrado con ID: " + dto.providerId()));
        }

        ExpenseCategory category = dto.category() != null
                ? dto.category()
                : (dto.providerId() != null ? ExpenseCategory.PROVEEDOR : ExpenseCategory.CAJA_CHICA);

        LocalDateTime dateToSave = (dto.expenseDate() != null) ? dto.expenseDate() : LocalDateTime.now();

        Expense expense = Expense.builder()
                .description(dto.description().trim())
                .amount(dto.amount())
                .deductFromBox(deductFromBox)
                .category(category)
                .paymentMethod(dto.paymentMethod())
                .reference(dto.reference() != null ? dto.reference().trim() : null)
                .providerId(dto.providerId())
                .invoiceNumber(dto.invoiceNumber() != null ? dto.invoiceNumber().trim() : null)
                .expenseDate(dateToSave)
                .build();

        expense.setCompany(company);

        Expense saved = expenseRepository.save(expense);

        // Sincronización dinámica idéntica del balance del proveedor
        if (saved.getProviderId() != null) {
            providerService.recalcularSaldoProveedor(saved.getProviderId());
        }

        log.info("Empresa [{}]: Gasto registrado por $ {} - Cat: {} - Descuenta Caja: {} - Método: {}",
                companyId, saved.getAmount(), saved.getCategory(), saved.getDeductFromBox(), saved.getPaymentMethod());

        auditService.logAction(
                "GASTO_CREADO",
                String.format("Gasto ID [%d] registrado por $ %.2f (%s) - Categoría: %s - Método: %s",
                        saved.getId(), saved.getAmount(), saved.getDescription(), saved.getCategory(), saved.getPaymentMethod()),
                "INFO"
        );

        return mapToDTO(saved);
    }



    @Override
    @Transactional(readOnly = true)
    public Page<ExpenseResponseDTO> getAllExpenses(Long providerId, java.time.LocalDate desde, java.time.LocalDate hasta, Pageable pageable) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        if (companyId == null) {
            throw new UnauthorizedException("Acceso denegado: Contexto de empresa no identificado.");
        }

        Page<Expense> page;
        if (providerId != null) {
            if (desde != null && hasta != null) {
                LocalDateTime start = desde.atStartOfDay();
                LocalDateTime end = hasta.atTime(java.time.LocalTime.MAX);
                page = expenseRepository.findByCompanyIdAndProviderIdAndExpenseDateBetweenOrderByExpenseDateDesc(companyId, providerId, start, end, pageable);
            } else {
                page = expenseRepository.findByCompanyIdAndProviderIdOrderByExpenseDateDesc(companyId, providerId, pageable);
            }
        } else {
            if (desde != null && hasta != null) {
                LocalDateTime start = desde.atStartOfDay();
                LocalDateTime end = hasta.atTime(java.time.LocalTime.MAX);
                page = expenseRepository.findByCompanyIdAndExpenseDateBetweenOrderByExpenseDateDesc(companyId, start, end, pageable);
            } else {
                page = expenseRepository.findByCompanyIdOrderByExpenseDateDesc(companyId, pageable);
            }
        }
        
        return page.map(this::mapToDTO);
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

        Long provId = expense.getProviderId();
        expenseRepository.delete(expense);

        if (provId != null) {
            providerService.recalcularSaldoProveedor(provId);
            log.info("Empresa [{}]: Recalculado saldo del Proveedor [{}] por eliminación de Gasto [{}]",
                    companyId, provId, id);
        }

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
                expense.getReference(),
                expense.getProviderId(),
                expense.getInvoiceNumber()
        );
    }
}