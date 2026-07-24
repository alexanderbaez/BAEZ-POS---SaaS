package com.baez.baezpos.customer.service;

import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.company.repository.CompanyRepository;
import com.baez.baezpos.customer.dto.CustomerMovementDTO;
import com.baez.baezpos.customer.entities.Customer;
import com.baez.baezpos.customer.entities.CustomerMovement;
import com.baez.baezpos.customer.repository.CustomerMovementRepository;
import com.baez.baezpos.customer.repository.CustomerRepository;
import com.baez.baezpos.sale.entity.Sale;
import com.baez.baezpos.security.util.SecurityUtils;
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

    @Override
    public List<Customer> getAll() {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        return customerRepository.findByCompanyId(companyId);
    }

    @Override
    @Transactional
    public Customer saveCustomer(Customer customer) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        Company company = companyRepository.getReferenceById(companyId);

        customer.setCompany(company); // <-- LIGAMOS EL CLIENTE A LA EMPRESA
        return customerRepository.save(customer);
    }

    @Override
    @Transactional
    public void updateBalance(Long customerId, BigDecimal amount, String type, String description, Sale sale, String paymentMethod) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        Customer customer = customerRepository.findByIdAndCompanyId(customerId, companyId)
                .orElseThrow(() -> new RuntimeException("Cliente no encontrado en su empresa"));

        if ("DEBITO".equals(type)) {
            customer.setCurrentBalance(customer.getCurrentBalance().add(amount));
        } else {
            customer.setCurrentBalance(customer.getCurrentBalance().subtract(amount));
        }
        customerRepository.save(customer);

        CustomerMovement movement = new CustomerMovement();
        movement.setCustomer(customer);
        movement.setAmount(amount);
        movement.setType(type);
        movement.setDescription(description);
        movement.setSale(sale);

        if (sale != null) {
            movement.setPaymentMethod(sale.getPaymentMethod());
        } else {
            movement.setPaymentMethod(paymentMethod != null ? paymentMethod : "EFECTIVO");
        }

        customerMovementRepository.save(movement);
    }

    @Override
    public List<Customer> searchCustomers(String query) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        return customerRepository.searchCustomersByCompanyId(query, companyId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CustomerMovementDTO> getHistory(Long customerId) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        List<CustomerMovement> movements = customerMovementRepository.findByCustomerIdAndCustomerCompanyIdOrderByIdDesc(customerId, companyId);

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
                    itemDto.setProductName(item.getProduct().getName());
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
    public Customer updateCustomer(Long id, Customer details) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        Customer customer = customerRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new RuntimeException("Cliente no encontrado"));

        customer.setName(details.getName());
        customer.setDniCuit(details.getDniCuit());
        customer.setPhone(details.getPhone());
        customer.setCreditLimit(details.getCreditLimit());

        return customerRepository.save(customer);
    }

    @Override
    @Transactional
    public void processCustomerPayment(Long id, BigDecimal amount, String method) {
        this.updateBalance(
                id,
                amount,
                "CREDITO",
                "Pago de cuenta corriente - " + method,
                null,
                method
        );
    }

    @Override
    @Transactional
    public void deleteCustomer(Long id) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        Customer customer = customerRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new RuntimeException("Cliente no encontrado"));

        List<CustomerMovement> movements = customerMovementRepository.findByCustomerIdAndCustomerCompanyIdOrderByIdDesc(id, companyId);
        if (!movements.isEmpty()) {
            customerMovementRepository.deleteAll(movements);
        }

        customerRepository.delete(customer);
    }
}