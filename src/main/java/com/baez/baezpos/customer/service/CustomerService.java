package com.baez.baezpos.customer.service;

import com.baez.baezpos.customer.dto.CustomerMovementDTO;
import com.baez.baezpos.customer.dto.CustomerRequestDTO;
import com.baez.baezpos.customer.dto.CustomerResponseDTO;
import com.baez.baezpos.sale.entity.CashRegisterSession;
import com.baez.baezpos.sale.entity.Sale;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.util.List;

public interface CustomerService {
    List<CustomerResponseDTO> getAll();
    Page<CustomerResponseDTO> getAll(Pageable pageable);
    CustomerResponseDTO saveCustomer(CustomerRequestDTO dto); // Retorna DTO
    List<CustomerResponseDTO> searchCustomers(String query);
    Page<CustomerResponseDTO> searchCustomers(String query, Pageable pageable);
    List<CustomerMovementDTO> getHistory(Long customerId);
    CustomerResponseDTO updateCustomer(Long id, CustomerRequestDTO dto); // Retorna DTO
    void updateBalance(Long customerId, BigDecimal amount, String type, String description, Sale sale, String paymentMethod);
    void updateBalance(Long customerId, BigDecimal amount, String type, String description, Sale sale, String paymentMethod, CashRegisterSession cashRegisterSession);
    void processCustomerPayment(Long id, BigDecimal amount, String method);
    void deleteCustomer(Long id);
}