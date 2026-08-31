package com.baez.baezpos.customer.service;

import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.company.repository.CompanyRepository;
import com.baez.baezpos.customer.dto.CustomerMovementDTO;
import com.baez.baezpos.customer.dto.CustomerRequestDTO;
import com.baez.baezpos.customer.dto.CustomerResponseDTO;
import com.baez.baezpos.customer.entities.Customer;
import com.baez.baezpos.customer.entities.CustomerMovement;
import com.baez.baezpos.customer.repository.CustomerMovementRepository;
import com.baez.baezpos.customer.repository.CustomerRepository;
import com.baez.baezpos.log.service.AuditService;
import com.baez.baezpos.sale.entity.CashRegisterSession;
import com.baez.baezpos.sale.entity.CashSessionStatus;
import com.baez.baezpos.sale.entity.Sale;
import com.baez.baezpos.sale.entity.SaleItem;
import com.baez.baezpos.sale.repository.CashRegisterSessionRepository;
import com.baez.baezpos.security.util.SecurityUtils;
import com.baez.baezpos.shared.exception.BadRequestException;
import com.baez.baezpos.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class CustomerServiceImpl implements CustomerService {

    private final CustomerRepository customerRepository;
    private final CustomerMovementRepository customerMovementRepository;
    private final CompanyRepository companyRepository;
    private final CashRegisterSessionRepository cashRegisterSessionRepository;
    private final AuditService auditService;

    @Override
    @Transactional(readOnly = true)
    public List<CustomerResponseDTO> getAll() {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        List<Customer> customers = (companyId != null)
                ? customerRepository.findByCompanyIdAndActiveTrue(companyId)
                : customerRepository.findAll();

        return customers.stream().map(this::mapToDTO).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<CustomerResponseDTO> getAll(Pageable pageable) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        Page<Customer> page = (companyId != null)
                ? customerRepository.findByCompanyIdAndActiveTrue(companyId, pageable)
                : customerRepository.findAll(pageable);

        return page.map(this::mapToDTO);
    }

    @Override
    @Transactional
    public CustomerResponseDTO saveCustomer(CustomerRequestDTO dto) {
        Long companyId = requireCompanyContext();
        Company companyRef = companyRepository.getReferenceById(companyId);

        Customer customer = Customer.builder()
                .name(dto.name().trim())
                .phone(dto.phone() != null ? dto.phone().trim() : null)
                .dniCuit(dto.dniCuit() != null ? dto.dniCuit().trim() : null)
                .creditLimit(dto.creditLimit() != null ? dto.creditLimit() : BigDecimal.valueOf(10000))
                .currentBalance(BigDecimal.ZERO)
                .active(true)
                .company(companyRef)
                .build();

        Customer savedCustomer = customerRepository.save(customer);
        auditService.logAction("CREACION_CLIENTE", "Cliente creado: " + savedCustomer.getName() + " (ID: " + savedCustomer.getId() + ")", "INFO");

        return mapToDTO(savedCustomer);
    }

    @Override
    @Transactional
    public void updateBalance(Long customerId, BigDecimal amount, String type, String description, Sale sale, String paymentMethod) {
        CashRegisterSession session = (sale != null) ? sale.getCashRegisterSession() : null;
        if (session == null) {
            Long companyId = SecurityUtils.getCurrentCompanyId();
            if (companyId != null) {
                session = cashRegisterSessionRepository
                        .findFirstByCompanyIdAndStatusOrderByIdDesc(companyId, CashSessionStatus.OPEN)
                        .orElse(null);
            }
        }
        updateBalance(customerId, amount, type, description, sale, paymentMethod, session);
    }

    @Override
    @Transactional
    public void updateBalance(Long customerId, BigDecimal amount, String type, String description, Sale sale, String paymentMethod, CashRegisterSession cashRegisterSession) {
        Long companyId = SecurityUtils.getCurrentCompanyId();

        Customer customer = (companyId != null)
                ? customerRepository.findByIdAndCompanyId(customerId, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Cliente no encontrado en su empresa"))
                : customerRepository.findById(customerId)
                .orElseThrow(() -> new ResourceNotFoundException("Cliente no encontrado"));

        if ("DEBITO".equalsIgnoreCase(type)) {
            customer.setCurrentBalance(customer.getCurrentBalance().add(amount));
        } else if ("CREDITO".equalsIgnoreCase(type)) {
            customer.setCurrentBalance(customer.getCurrentBalance().subtract(amount));
        } else {
            throw new BadRequestException("Tipo de movimiento invÃ¡lido: " + type);
        }

        customerRepository.save(customer);

        String methodToSave = (sale != null && sale.getPaymentMethod() != null)
                ? sale.getPaymentMethod()
                : (paymentMethod != null && !paymentMethod.trim().isBlank() ? paymentMethod.trim().toUpperCase() : "EFECTIVO");

        CustomerMovement movement = CustomerMovement.builder()
                .customer(customer)
                .amount(amount)
                .type(type.toUpperCase())
                .description(description)
                .sale(sale)
                .paymentMethod(methodToSave)
                .cashRegisterSession(cashRegisterSession)
                .build();

        customerMovementRepository.save(movement);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CustomerResponseDTO> searchCustomers(String query) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        if (query == null || query.isBlank()) {
            return getAll();
        }

        List<Customer> customers = (companyId != null)
                ? customerRepository.searchCustomersByCompanyId(query.trim(), companyId)
                : customerRepository.findAll();

        return customers.stream().map(this::mapToDTO).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<CustomerResponseDTO> searchCustomers(String query, Pageable pageable) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        if (query == null || query.isBlank()) {
            return getAll(pageable);
        }

        Page<Customer> customers = (companyId != null)
                ? customerRepository.searchCustomersByCompanyId(query.trim(), companyId, pageable)
                : customerRepository.findAll(pageable);

        return customers.map(this::mapToDTO);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CustomerMovementDTO> getHistory(Long customerId) {
        Long companyId = SecurityUtils.getCurrentCompanyId();

        List<CustomerMovement> movements = (companyId != null)
                ? customerMovementRepository.findByCustomerIdAndCustomerCompanyIdOrderByIdDesc(customerId, companyId)
                : customerMovementRepository.findByCustomerIdOrderByIdDesc(customerId);

        return movements.stream().map(m -> {
            Sale sale = m.getSale();
            BigDecimal subtotalCalculado = null;
            BigDecimal surcharge = null;
            BigDecimal surchargeRate = null;
            BigDecimal total = null;
            List<CustomerMovementDTO.ItemDetailDTO> itemsDetail = null;

            if (sale != null) {
                surcharge = sale.getSurcharge();
                surchargeRate = sale.getSurchargeRate();
                total = sale.getTotal();

                if (sale.getItems() != null && !sale.getItems().isEmpty()) {
                    subtotalCalculado = sale.getItems().stream()
                            .map(SaleItem::getSubtotal)
                            .filter(Objects::nonNull)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);

                    itemsDetail = sale.getItems().stream().map(item -> new CustomerMovementDTO.ItemDetailDTO(
                            item.getProduct() != null ? item.getProduct().getName() : "Producto Eliminado",
                            item.getQuantity(),
                            item.getProduct() != null && Boolean.TRUE.equals(item.getProduct().getIsFractional()),
                            item.getPrice(),
                            item.getSubtotal()
                    )).toList();
                } else {
                    subtotalCalculado = sale.getTotal();
                }
            }

            return new CustomerMovementDTO(
                    m.getId(),
                    m.getAmount(),
                    m.getType(),
                    m.getDescription(),
                    m.getPaymentMethod(),
                    m.getCreatedAt(),
                    subtotalCalculado,
                    surcharge,
                    surchargeRate,
                    total,
                    itemsDetail
            );
        }).toList();
    }

    @Override
    @Transactional
    public CustomerResponseDTO updateCustomer(Long id, CustomerRequestDTO dto) {
        Long companyId = requireCompanyContext();

        Customer customer = customerRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Cliente no encontrado en su empresa"));

        customer.setName(dto.name().trim());
        customer.setPhone(dto.phone() != null ? dto.phone().trim() : null);
        customer.setDniCuit(dto.dniCuit() != null ? dto.dniCuit().trim() : null);
        if (dto.creditLimit() != null) {
            customer.setCreditLimit(dto.creditLimit());
        }

        Customer updatedCustomer = customerRepository.save(customer);
        auditService.logAction("ACTUALIZACION_CLIENTE", "Cliente actualizado ID: " + id, "INFO");

        return mapToDTO(updatedCustomer);
    }

    @Override
    @Transactional
    public void processCustomerPayment(Long id, BigDecimal amount, String method) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BadRequestException("El monto a pagar debe ser mayor a cero.");
        }
        if (method == null || method.trim().isBlank()) {
            throw new BadRequestException("El mÃ©todo de pago (EFECTIVO, TRANSFERENCIA, etc.) es obligatorio.");
        }

        Long companyId = requireCompanyContext();
        String validMethod = method.trim().toUpperCase();

        // Si existe una SesiÃ³n de Caja abierta para la empresa / usuario logueado
        CashRegisterSession activeSession = cashRegisterSessionRepository
                .findFirstByCompanyIdAndStatusOrderByIdDesc(companyId, CashSessionStatus.OPEN)
                .orElse(null);

        this.updateBalance(
                id,
                amount,
                "CREDITO",
                "Pago de cuenta corriente - " + validMethod,
                null,
                validMethod,
                activeSession
        );

        String cajaLog = (activeSession != null) ? " (Caja Turno #" + activeSession.getSessionNumber() + ")" : " (Sin caja abierta)";
        auditService.logAction("PAGO_CLIENTE", "Pago de $" + amount + " recibido para el cliente ID: " + id + " via " + validMethod + cajaLog, "INFO");
    }

    @Override
    @Transactional
    public void deleteCustomer(Long id) {
        Long companyId = requireCompanyContext();

        Customer customer = customerRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Cliente no encontrado en su empresa"));

        customer.setActive(false);
        customerRepository.save(customer);

        auditService.logAction("ELIMINACION_CLIENTE", "Cliente desactivado: " + customer.getName() + " (ID: " + id + ")", "WARN");
    }

    private Long requireCompanyContext() {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        if (companyId == null) {
            throw new BadRequestException("Acceso denegado: Se requiere contexto de empresa vÃ¡lido.");
        }
        return companyId;
    }

    private CustomerResponseDTO mapToDTO(Customer c) {
        return new CustomerResponseDTO(
                c.getId(),
                c.getName(),
                c.getPhone(),
                c.getDniCuit(),
                c.getCurrentBalance(),
                c.getCreditLimit(),
                c.getActive()
        );
    }
}