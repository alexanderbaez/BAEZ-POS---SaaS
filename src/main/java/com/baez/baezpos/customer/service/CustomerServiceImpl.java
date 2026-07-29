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
    public Customer saveCustomer(CustomerRequestDTO dto) {
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
        return customerRepository.save(customer);
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

            if (m.getSale() != null && m.getSale().getItems() != null) {
                List<CustomerMovementDTO.ItemDetailDTO> items = m.getSale().getItems().stream().map(item -> {
                    CustomerMovementDTO.ItemDetailDTO itemDto = new CustomerMovementDTO.ItemDetailDTO();
                    itemDto.setProductName(item.getProduct() != null ? item.getProduct().getName() : "Producto Removido");
                    itemDto.setQuantity(item.getQuantity());
                    itemDto.setPrice(item.getPrice());
                    return itemDto;
                }).toList();
                dto.setItemsDetail(items);
            }
            return dto;
        }).toList();
    }

    @Override
    @Transactional
    public Customer updateCustomer(Long id, CustomerRequestDTO dto) {
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

        return customerRepository.save(customer);
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