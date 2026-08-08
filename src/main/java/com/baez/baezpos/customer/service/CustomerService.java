package com.baez.baezpos.customer.service;

import com.baez.baezpos.customer.dto.CustomerMovementDTO;
import com.baez.baezpos.customer.dto.CustomerRequestDTO;
import com.baez.baezpos.customer.dto.CustomerResponseDTO;
import com.baez.baezpos.sale.entity.Sale;

import java.math.BigDecimal;
import java.util.List;

public interface CustomerService {
    List<CustomerResponseDTO> getAll();
    CustomerResponseDTO saveCustomer(CustomerRequestDTO dto); // Retorna DTO
    List<CustomerResponseDTO> searchCustomers(String query);
    List<CustomerMovementDTO> getHistory(Long customerId);
    CustomerResponseDTO updateCustomer(Long id, CustomerRequestDTO dto); // Retorna DTO
    void updateBalance(Long customerId, BigDecimal amount, String type, String description, Sale sale, String paymentMethod);
    void processCustomerPayment(Long id, BigDecimal amount, String method);
    void deleteCustomer(Long id);
}