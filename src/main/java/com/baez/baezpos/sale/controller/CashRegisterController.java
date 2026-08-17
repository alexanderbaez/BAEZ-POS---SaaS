package com.baez.baezpos.sale.controller;

import com.baez.baezpos.sale.dto.CashSessionResponseDTO;
import com.baez.baezpos.sale.dto.CloseCashSessionRequestDTO;
import com.baez.baezpos.sale.dto.OpenCashSessionRequestDTO;
import com.baez.baezpos.sale.service.SaleService.CashRegisterService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/cash-register")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class CashRegisterController {

    private final CashRegisterService cashRegisterService;

    @PostMapping("/open")
    @PreAuthorize("hasAnyRole('ADMIN', 'VENDEDOR', 'SUPER_ADMIN')")
    public ResponseEntity<CashSessionResponseDTO> openSession(@Valid @RequestBody OpenCashSessionRequestDTO requestDTO) {
        return ResponseEntity.ok(cashRegisterService.openSession(requestDTO));
    }

    @PostMapping("/close")
    @PreAuthorize("hasAnyRole('ADMIN', 'VENDEDOR', 'SUPER_ADMIN')")
    public ResponseEntity<CashSessionResponseDTO> closeSession(@Valid @RequestBody CloseCashSessionRequestDTO requestDTO) {
        return ResponseEntity.ok(cashRegisterService.closeSession(requestDTO));
    }

    @GetMapping("/active")
    @PreAuthorize("hasAnyRole('ADMIN', 'VENDEDOR', 'SUPER_ADMIN')")
    public ResponseEntity<CashSessionResponseDTO> getActiveSession() {
        return ResponseEntity.ok(cashRegisterService.getActiveSession());
    }
}