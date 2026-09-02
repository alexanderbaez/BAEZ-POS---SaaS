package com.baez.baezpos.provider.service;

import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.company.repository.CompanyRepository;
import com.baez.baezpos.expense.entity.Expense;
import com.baez.baezpos.expense.entity.ExpenseCategory;
import com.baez.baezpos.expense.repository.ExpenseRepository;
import com.baez.baezpos.log.service.AuditService;
import com.baez.baezpos.provider.dto.ProviderPaymentRequestDTO;
import com.baez.baezpos.provider.dto.ProviderRequestDTO;
import com.baez.baezpos.provider.dto.ProviderResponseDTO;
import com.baez.baezpos.provider.entity.Provider;
import com.baez.baezpos.provider.repository.ProviderRepository;
import com.baez.baezpos.security.util.SecurityUtils;
import com.baez.baezpos.shared.entity.PaymentMethod;
import com.baez.baezpos.shared.exception.BadRequestException;
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

import com.baez.baezpos.provider.repository.PurchaseOrderRepository;

@Service
@RequiredArgsConstructor
@Slf4j
public class ProviderServiceImpl implements ProviderService {

    private final ProviderRepository providerRepository;
    private final CompanyRepository companyRepository;
    private final ExpenseRepository expenseRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;
    private final CashRegisterService cashRegisterService;
    private final AuditService auditService;

    @Override
    @Transactional
    public Page<ProviderResponseDTO> getAll(Pageable pageable) {
        Long companyId = getRequiredCompanyId();
        Page<Provider> page = (companyId != null)
                ? providerRepository.findByCompanyIdAndActiveTrue(companyId, pageable)
                : providerRepository.findAll(pageable);
        page.forEach(this::recalcularSaldoProveedor);
        return page.map(this::mapToDTO);
    }

    @Override
    @Transactional
    public ProviderResponseDTO getById(Long id) {
        Long companyId = getRequiredCompanyId();
        Provider provider = providerRepository.findByIdAndCompanyIdAndActiveTrue(id, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Proveedor no encontrado con ID: " + id));
        provider = recalcularSaldoProveedor(provider);
        return mapToDTO(provider);
    }

    @Override
    @Transactional
    public Page<ProviderResponseDTO> search(String query, Pageable pageable) {
        Long companyId = getRequiredCompanyId();
        if (query == null || query.trim().isEmpty()) {
            return getAll(pageable);
        }
        Page<Provider> page = (companyId != null)
                ? providerRepository.searchProvidersByCompanyId(query.trim(), companyId, pageable)
                : providerRepository.findAll(pageable);
        page.forEach(this::recalcularSaldoProveedor);
        return page.map(this::mapToDTO);
    }

    @Override
    @Transactional
    public ProviderResponseDTO create(ProviderRequestDTO dto) {
        Long companyId = getRequiredCompanyId();
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Empresa no encontrada con ID: " + companyId));

        BigDecimal initialBalance = dto.currentBalance() != null ? dto.currentBalance() : BigDecimal.ZERO;

        Provider provider = Provider.builder()
                .businessName(dto.businessName().trim())
                .taxId(dto.taxId() != null && !dto.taxId().isBlank() ? dto.taxId().trim() : null)
                .phone(dto.phone() != null && !dto.phone().isBlank() ? dto.phone().trim() : null)
                .email(dto.email() != null && !dto.email().isBlank() ? dto.email().trim().toLowerCase() : null)
                .initialBalance(initialBalance)
                .currentBalance(initialBalance)
                .active(true)
                .version(0L)
                .build();

        provider.setCompany(company);

        Provider saved = providerRepository.save(provider);
        log.info("Empresa [{}]: Proveedor registrado [{}] '{}' con saldo inicial $ {}",
                companyId, saved.getId(), saved.getBusinessName(), saved.getCurrentBalance());

        auditService.logAction(
                "PROVEEDOR_CREADO",
                String.format("Proveedor ID [%d] '%s' registrado con saldo inicial $ %.2f",
                        saved.getId(), saved.getBusinessName(), saved.getCurrentBalance()),
                "INFO"
        );

        return mapToDTO(saved);
    }

    @Override
    @Transactional
    public ProviderResponseDTO update(Long id, ProviderRequestDTO dto) {
        Long companyId = getRequiredCompanyId();
        Provider provider = providerRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Proveedor no encontrado con ID: " + id));

        provider.setBusinessName(dto.businessName().trim());
        provider.setTaxId(dto.taxId() != null && !dto.taxId().isBlank() ? dto.taxId().trim() : null);
        provider.setPhone(dto.phone() != null && !dto.phone().isBlank() ? dto.phone().trim() : null);
        provider.setEmail(dto.email() != null && !dto.email().isBlank() ? dto.email().trim().toLowerCase() : null);

        if (dto.currentBalance() != null) {
            provider.setInitialBalance(dto.currentBalance());
            provider.setCurrentBalance(dto.currentBalance());
        }

        if (provider.getVersion() == null) {
            provider.setVersion(0L);
        }

        Provider saved = providerRepository.save(provider);
        saved = recalcularSaldoProveedor(saved);

        log.info("Empresa [{}]: Proveedor [{}] '{}' actualizado", companyId, saved.getId(), saved.getBusinessName());

        auditService.logAction(
                "PROVEEDOR_ACTUALIZADO",
                String.format("Proveedor ID [%d] '%s' actualizado.", saved.getId(), saved.getBusinessName()),
                "INFO"
        );

        return mapToDTO(saved);
    }

    @Override
    @Transactional
    public void delete(Long id) {
        Long companyId = getRequiredCompanyId();
        Provider provider = providerRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Proveedor no encontrado con ID: " + id));

        provider.setActive(false);
        if (provider.getVersion() == null) {
            provider.setVersion(0L);
        }
        providerRepository.save(provider);

        log.warn("Empresa [{}]: Proveedor [{}] '{}' dado de baja lógica", companyId, id, provider.getBusinessName());

        auditService.logAction(
                "PROVEEDOR_ELIMINADO",
                String.format("Proveedor ID [%d] '%s' dado de baja lógica.", id, provider.getBusinessName()),
                "WARN"
        );
    }

    @Override
    @Transactional
    public ProviderResponseDTO pay(Long id, ProviderPaymentRequestDTO dto) {
        Long companyId = getRequiredCompanyId();
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Empresa no encontrada con ID: " + companyId));

        Provider provider = providerRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Proveedor no encontrado con ID: " + id));

        if (dto.amount() == null || dto.amount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BadRequestException("El monto a abonar debe ser mayor a cero.");
        }

        // Si el pago es en efectivo de caja y deduce, validamos que haya liquidez física disponible
        boolean isEfectivoCaja = (dto.paymentMethod() == PaymentMethod.EFECTIVO_CAJA);
        boolean isTransferencia = (dto.paymentMethod() == PaymentMethod.TRANSFERENCIA);
        boolean deductFromBox = (isEfectivoCaja || isTransferencia) && (dto.deductFromBox() == null || dto.deductFromBox());

        if (isEfectivoCaja && deductFromBox) {
            cashRegisterService.validatePhysicalCashAvailability(companyId, dto.amount());
        }

        // 1. Generar automáticamente un registro en Expense por ese abono
        String desc = "Abono / Pago a Proveedor: " + provider.getBusinessName();
        if (dto.reference() != null && !dto.reference().isBlank()) {
            desc += " - " + dto.reference().trim();
        }

        Expense expense = Expense.builder()
                .description(desc)
                .amount(dto.amount())
                .deductFromBox(deductFromBox)
                .category(ExpenseCategory.PROVEEDOR)
                .paymentMethod(dto.paymentMethod())
                .reference(dto.reference() != null ? dto.reference().trim() : null)
                .providerId(provider.getId())
                .invoiceNumber(dto.invoiceNumber() != null ? dto.invoiceNumber().trim() : null)
                .expenseDate(LocalDateTime.now())
                .version(0L)
                .build();

        expense.setCompany(company);
        expenseRepository.save(expense);

        // 2. Recalcular el saldo oficial de forma idéntica e inmediata
        Provider providerActualizado = recalcularSaldoProveedor(provider);

        log.info("Empresa [{}]: Abono de $ {} al proveedor [{}] '{}' con {}. Nuevo saldo: $ {}. Gasto generado.",
                companyId, dto.amount(), provider.getId(), provider.getBusinessName(), dto.paymentMethod(), providerActualizado.getCurrentBalance());

        auditService.logAction(
                "ABONO_PROVEEDOR",
                String.format("Abono de $ %.2f a Proveedor ID [%d] '%s' registrado por método %s. Nuevo saldo: $ %.2f",
                        dto.amount(), provider.getId(), provider.getBusinessName(), dto.paymentMethod(), providerActualizado.getCurrentBalance()),
                "INFO"
        );

        return mapToDTO(providerActualizado);
    }

    @Override
    @Transactional
    public Provider recalcularSaldoProveedor(Long providerId) {
        if (providerId == null) return null;
        Provider provider = providerRepository.findById(providerId).orElse(null);
        return recalcularSaldoProveedor(provider);
    }

    @Override
    @Transactional
    public ProviderResponseDTO recalcularYDevolver(Long providerId) {
        Provider updated = recalcularSaldoProveedor(providerId);
        if (updated == null) {
            throw new ResourceNotFoundException("Proveedor no encontrado con ID: " + providerId);
        }
        return mapToDTO(updated);
    }

    @Override
    @Transactional
    public Provider recalcularSaldoProveedor(Provider provider) {
        if (provider == null) return null;

        BigDecimal ordenesRecibidas = purchaseOrderRepository.sumReceivedOrdersByProviderId(provider.getId());
        if (ordenesRecibidas == null) ordenesRecibidas = BigDecimal.ZERO;

        BigDecimal comprasCC = expenseRepository.sumCreditPurchasesByProviderId(provider.getId());
        if (comprasCC == null) comprasCC = BigDecimal.ZERO;

        BigDecimal pagos = expenseRepository.sumPaymentsByProviderId(provider.getId());
        if (pagos == null) pagos = BigDecimal.ZERO;

        if (provider.getInitialBalance() == null) {
            BigDecimal current = provider.getCurrentBalance() != null ? provider.getCurrentBalance() : BigDecimal.ZERO;
            BigDecimal base = current.subtract(ordenesRecibidas).subtract(comprasCC);
            if (base.compareTo(BigDecimal.ZERO) < 0) {
                base = BigDecimal.ZERO;
            }
            provider.setInitialBalance(base);
        }

        BigDecimal inicial = provider.getInitialBalance() != null ? provider.getInitialBalance() : BigDecimal.ZERO;
        BigDecimal nuevoSaldo = inicial.add(ordenesRecibidas).add(comprasCC).subtract(pagos);

        provider.setCurrentBalance(nuevoSaldo);
        if (provider.getVersion() == null) {
            provider.setVersion(0L);
        }
        return providerRepository.save(provider);
    }

    @Override
    @Transactional
    public void sincronizarTodosLosSaldos() {
        log.info("Iniciando sincronización masiva de saldos de proveedores...");
        List<Provider> providers = providerRepository.findAll();
        for (Provider p : providers) {
            try {
                recalcularSaldoProveedor(p);
            } catch (Exception ex) {
                log.error("Error recalculando saldo de proveedor ID [{}]: {}", p.getId(), ex.getMessage());
            }
        }
        log.info("Sincronización masiva de saldos de proveedores finalizada.");
    }

    @org.springframework.context.event.EventListener(org.springframework.boot.context.event.ApplicationReadyEvent.class)
    @Transactional
    public void sincronizarTodosLosSaldosAlInicio() {
        try {
            sincronizarTodosLosSaldos();
        } catch (Exception e) {
            log.warn("No se pudo completar la sincronización inicial de proveedores: {}", e.getMessage());
        }
    }

    private Long getRequiredCompanyId() {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        if (companyId == null) {
            throw new UnauthorizedException("Acceso denegado: Contexto de empresa no identificado.");
        }
        return companyId;
    }

    private ProviderResponseDTO mapToDTO(Provider provider) {
        return new ProviderResponseDTO(
                provider.getId(),
                provider.getBusinessName(),
                provider.getTaxId(),
                provider.getPhone(),
                provider.getEmail(),
                provider.getCurrentBalance() != null ? provider.getCurrentBalance() : BigDecimal.ZERO,
                provider.getActive() != null ? provider.getActive() : true,
                provider.getCreatedAt(),
                provider.getUpdatedAt()
        );
    }
}
