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
public class ProviderServiceImpl implements ProviderService {

    private final ProviderRepository providerRepository;
    private final CompanyRepository companyRepository;
    private final ExpenseRepository expenseRepository;
    private final AuditService auditService;

    @Override
    @Transactional(readOnly = true)
    public List<ProviderResponseDTO> getAll() {
        Long companyId = getRequiredCompanyId();
        return providerRepository.findByCompanyIdAndActiveTrueOrderByIdDesc(companyId)
                .stream()
                .map(this::mapToDTO)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public ProviderResponseDTO getById(Long id) {
        Long companyId = getRequiredCompanyId();
        Provider provider = providerRepository.findByIdAndCompanyIdAndActiveTrue(id, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Proveedor no encontrado con ID: " + id));
        return mapToDTO(provider);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProviderResponseDTO> search(String query) {
        Long companyId = getRequiredCompanyId();
        if (query == null || query.trim().isEmpty()) {
            return getAll();
        }
        return providerRepository.searchProvidersByCompanyId(query.trim(), companyId)
                .stream()
                .map(this::mapToDTO)
                .toList();
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
            provider.setCurrentBalance(dto.currentBalance());
        }

        if (provider.getVersion() == null) {
            provider.setVersion(0L);
        }

        Provider saved = providerRepository.save(provider);
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

        // 1. Restar el monto del currentBalance del proveedor
        BigDecimal currentBal = provider.getCurrentBalance() != null ? provider.getCurrentBalance() : BigDecimal.ZERO;
        BigDecimal newBalance = currentBal.subtract(dto.amount());
        provider.setCurrentBalance(newBalance);

        if (provider.getVersion() == null) {
            provider.setVersion(0L);
        }
        Provider updatedProvider = providerRepository.save(provider);

        // 2. Generar automáticamente un registro en Expense por ese abono
        boolean isEfectivoCaja = (dto.paymentMethod() == PaymentMethod.EFECTIVO_CAJA);
        String desc = "Abono / Pago a Proveedor: " + provider.getBusinessName();
        if (dto.reference() != null && !dto.reference().isBlank()) {
            desc += " - " + dto.reference().trim();
        }

        Expense expense = Expense.builder()
                .description(desc)
                .amount(dto.amount())
                .deductFromBox(isEfectivoCaja)
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

        log.info("Empresa [{}]: Abono de $ {} al proveedor [{}] '{}' con {}. Nuevo saldo: $ {}. Gasto generado.",
                companyId, dto.amount(), provider.getId(), provider.getBusinessName(), dto.paymentMethod(), newBalance);

        auditService.logAction(
                "ABONO_PROVEEDOR",
                String.format("Abono de $ %.2f a Proveedor ID [%d] '%s' registrado por método %s. Nuevo saldo: $ %.2f",
                        dto.amount(), provider.getId(), provider.getBusinessName(), dto.paymentMethod(), newBalance),
                "INFO"
        );

        return mapToDTO(updatedProvider);
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
