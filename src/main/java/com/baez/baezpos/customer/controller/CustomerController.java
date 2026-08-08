package com.baez.baezpos.customer.controller;

import com.baez.baezpos.customer.dto.CustomerMovementDTO;
import com.baez.baezpos.customer.dto.CustomerRequestDTO;
import com.baez.baezpos.customer.dto.CustomerResponseDTO;
import com.baez.baezpos.customer.dto.PaymentRequestDTO;
import com.baez.baezpos.customer.entities.Customer;
import com.baez.baezpos.customer.service.CustomerService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/customers")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class CustomerController {

    private final CustomerService customerService;

    @GetMapping
    public ResponseEntity<List<CustomerResponseDTO>> listCustomers() {
        return ResponseEntity.ok(customerService.getAll());
    }

    @PostMapping
    public ResponseEntity<CustomerResponseDTO> create(@RequestBody CustomerRequestDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(customerService.saveCustomer(dto));
    }

    @GetMapping("/search")
    public ResponseEntity<List<CustomerResponseDTO>> search(@RequestParam String q) {
        return ResponseEntity.ok(customerService.searchCustomers(q));
    }

    @GetMapping("/{id}/movements")
    public ResponseEntity<List<CustomerMovementDTO>> getHistory(@PathVariable Long id) {
        return ResponseEntity.ok(customerService.getHistory(id));
    }

    @PostMapping("/{id}/payments")
    public ResponseEntity<Map<String, String>> receivePayment(@PathVariable Long id, @RequestBody PaymentRequestDTO paymentDTO) {
        if (paymentDTO.getAmount() == null || paymentDTO.getMethod() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Datos incompletos para el pago."));
        }

        customerService.processCustomerPayment(id, paymentDTO.getAmount(), paymentDTO.getMethod());
        return ResponseEntity.ok(Map.of("message", "Pago registrado con éxito"));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CustomerResponseDTO> update(@PathVariable Long id, @RequestBody CustomerRequestDTO dto) {
        return ResponseEntity.ok(customerService.updateCustomer(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> delete(@PathVariable Long id) {
        customerService.deleteCustomer(id);
        return ResponseEntity.ok(Map.of("message", "Cliente desactivado con éxito"));
    }
}