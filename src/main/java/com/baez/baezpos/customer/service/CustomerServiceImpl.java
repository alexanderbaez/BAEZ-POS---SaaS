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
import com.baez.baezpos.sale.entity.Sale;
import com.baez.baezpos.sale.entity.SaleItem;
import com.baez.baezpos.security.util.SecurityUtils;
import com.baez.baezpos.shared.exception.BadRequestException;
import com.baez.baezpos.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CustomerServiceImpl implements CustomerService {

    private final CustomerRepository customerRepository;
    private final CustomerMovementRepository customerMovementRepository;
    private final CompanyRepository companyRepository;

    private CustomerResponseDTO mapToDTO(Customer c) {
        return CustomerResponseDTO.builder()
                .id(c.getId())
                .name(c.getName())
                .phone(c.getPhone())
                .dniCuit(c.getDniCuit())
                .currentBalance(c.getCurrentBalance())
                .creditLimit(c.getCreditLimit())
                .active(c.getActive())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<CustomerResponseDTO> getAll() {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        List<Customer> customers;
        if (companyId == null) {
            customers = customerRepository.findAll();
        } else {
            customers = customerRepository.findByCompanyIdAndActiveTrue(companyId);
        }
        return customers.stream().map(this::mapToDTO).toList();
    }

    @Override
    @Transactional
    public CustomerResponseDTO saveCustomer(CustomerRequestDTO dto) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        if (companyId == null) {
            throw new BadRequestException("No se puede crear un cliente sin una empresa asociada.");
        }
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Empresa no encontrada"));

        Customer customer = Customer.builder()
                .name(dto.getName())
                .phone(dto.getPhone())
                .dniCuit(dto.getDniCuit())
                .creditLimit(dto.getCreditLimit() != null ? dto.getCreditLimit() : BigDecimal.valueOf(10000))
                .currentBalance(BigDecimal.ZERO)
                .active(true)
                .build();

        customer.setCompany(company);
        Customer savedCustomer = customerRepository.save(customer);

        return mapToDTO(savedCustomer); // Retorna DTO
    }

    @Override
    @Transactional
    public void updateBalance(Long customerId, BigDecimal amount, String type, String description, Sale sale, String paymentMethod) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        Customer customer;

        if (companyId != null) {
            customer = customerRepository.findByIdAndCompanyId(customerId, companyId)
                    .orElseThrow(() -> new ResourceNotFoundException("Cliente no encontrado en su empresa"));
        } else {
            customer = customerRepository.findById(customerId)
                    .orElseThrow(() -> new ResourceNotFoundException("Cliente no encontrado"));
        }

        if ("DEBITO".equalsIgnoreCase(type)) {
            customer.setCurrentBalance(customer.getCurrentBalance().add(amount));
        } else {
            customer.setCurrentBalance(customer.getCurrentBalance().subtract(amount));
        }
        customerRepository.save(customer);

        CustomerMovement movement = CustomerMovement.builder()
                .customer(customer)
                .amount(amount)
                .type(type.toUpperCase())
                .description(description)
                .sale(sale)
                .paymentMethod((sale != null && sale.getPaymentMethod() != null) ? sale.getPaymentMethod() : (paymentMethod != null ? paymentMethod : "EFECTIVO"))
                .build();

        customerMovementRepository.save(movement);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CustomerResponseDTO> searchCustomers(String query) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        List<Customer> customers;
        if (companyId == null) {
            customers = customerRepository.findAll();
        } else {
            customers = customerRepository.searchCustomersByCompanyId(query, companyId);
        }
        return customers.stream().map(this::mapToDTO).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<CustomerMovementDTO> getHistory(Long customerId) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        List<CustomerMovement> movements;

        if (companyId != null) {
            movements = customerMovementRepository.findByCustomerIdAndCustomerCompanyIdOrderByIdDesc(customerId, companyId);
        } else {
            movements = customerMovementRepository.findAll();
        }

        return movements.stream().map(m -> {
            CustomerMovementDTO dto = new CustomerMovementDTO();
            dto.setId(m.getId());
            dto.setAmount(m.getAmount());
            dto.setType(m.getType());
            dto.setDescription(m.getDescription());
            dto.setCreatedAt(m.getCreatedAt());

            Sale sale = m.getSale();
            if (sale != null) {
                // Mapeo correcto utilizando los campos reales de Sale
                dto.setSurchargeAmount(sale.getSurcharge());
                dto.setSurchargePercentage(sale.getSurchargeRate());
                dto.setTotalAmount(sale.getTotal());

                if (sale.getItems() != null && !sale.getItems().isEmpty()) {
                    // Sumamos los subtotales de cada ítem para obtener el subtotal real de la venta
                    BigDecimal subtotalCalculado = sale.getItems().stream()
                            .map(SaleItem::getSubtotal)
                            .filter(java.util.Objects::nonNull)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);

                    dto.setSubtotal(subtotalCalculado);

                    List<CustomerMovementDTO.ItemDetailDTO> items = sale.getItems().stream().map(item -> {
                        CustomerMovementDTO.ItemDetailDTO itemDto = new CustomerMovementDTO.ItemDetailDTO();

                        if (item.getProduct() != null) {
                            itemDto.setProductName(item.getProduct().getName());
                            itemDto.setIsFractional(item.getProduct().getIsFractional());
                        } else {
                            itemDto.setProductName("Producto Removido");
                            itemDto.setIsFractional(false);
                        }

                        itemDto.setQuantity(item.getQuantity());
                        itemDto.setPrice(item.getPrice());
                        itemDto.setSubtotal(item.getSubtotal());
                        return itemDto;
                    }).toList();

                    dto.setItemsDetail(items);
                } else {
                    dto.setSubtotal(sale.getTotal());
                }
            }

            return dto;
        }).toList();
    }

    @Override
    @Transactional
    public CustomerResponseDTO updateCustomer(Long id, CustomerRequestDTO dto) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        Customer customer = (companyId != null) ?
                customerRepository.findByIdAndCompanyId(id, companyId)
                        .orElseThrow(() -> new ResourceNotFoundException("Cliente no encontrado en su empresa")) :
                customerRepository.findById(id)
                        .orElseThrow(() -> new ResourceNotFoundException("Cliente no encontrado"));

        customer.setName(dto.getName());
        customer.setDniCuit(dto.getDniCuit());
        customer.setPhone(dto.getPhone());
        if (dto.getCreditLimit() != null) {
            customer.setCreditLimit(dto.getCreditLimit());
        }

        Customer updatedCustomer = customerRepository.save(customer);

        return mapToDTO(updatedCustomer); // Retorna DTO
    }

    @Override
    @Transactional
    public void processCustomerPayment(Long id, BigDecimal amount, String method) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BadRequestException("El monto a pagar debe ser mayor a cero.");
        }
        this.updateBalance(
                id,
                amount,
                "CREDITO",
                "Pago de cuenta corriente - " + (method != null ? method : "EFECTIVO"),
                null,
                method
        );
    }

    @Override
    @Transactional
    public void deleteCustomer(Long id) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        Customer customer = (companyId != null) ?
                customerRepository.findByIdAndCompanyId(id, companyId)
                        .orElseThrow(() -> new ResourceNotFoundException("Cliente no encontrado")) :
                customerRepository.findById(id)
                        .orElseThrow(() -> new ResourceNotFoundException("Cliente no encontrado"));

        customer.setActive(false);
        customerRepository.save(customer);
    }
}