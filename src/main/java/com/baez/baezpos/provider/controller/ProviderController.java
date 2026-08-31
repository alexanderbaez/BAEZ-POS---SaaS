package com.baez.baezpos.provider.controller;

import com.baez.baezpos.provider.dto.ProviderPaymentRequestDTO;
import com.baez.baezpos.provider.dto.ProviderRequestDTO;
import com.baez.baezpos.provider.dto.ProviderResponseDTO;
import com.baez.baezpos.provider.service.ProviderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/providers")
@RequiredArgsConstructor
public class ProviderController {

    private final ProviderService providerService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'VENDEDOR', 'SUPER_ADMIN')")
    public ResponseEntity<Page<ProviderResponseDTO>> getAll(
            @PageableDefault(size = 20, sort = "businessName", direction = Sort.Direction.ASC) Pageable pageable) {
        return ResponseEntity.ok(providerService.getAll(pageable));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'VENDEDOR', 'SUPER_ADMIN')")
    public ResponseEntity<ProviderResponseDTO> getById(@PathVariable Long id) {
        return ResponseEntity.ok(providerService.getById(id));
    }

    @GetMapping("/search")
    @PreAuthorize("hasAnyRole('ADMIN', 'VENDEDOR', 'SUPER_ADMIN')")
    public ResponseEntity<Page<ProviderResponseDTO>> search(
            @RequestParam(required = false) String q,
            @PageableDefault(size = 20, sort = "businessName", direction = Sort.Direction.ASC) Pageable pageable) {
        return ResponseEntity.ok(providerService.search(q, pageable));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'VENDEDOR', 'SUPER_ADMIN')")
    public ResponseEntity<ProviderResponseDTO> create(@Valid @RequestBody ProviderRequestDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(providerService.create(dto));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<ProviderResponseDTO> update(@PathVariable Long id, @Valid @RequestBody ProviderRequestDTO dto) {
        return ResponseEntity.ok(providerService.update(id, dto));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<Map<String, String>> delete(@PathVariable Long id) {
        providerService.delete(id);
        return ResponseEntity.ok(Map.of("message", "Proveedor dado de baja correctamente"));
    }

    @PostMapping("/{id}/pay")
    @PreAuthorize("hasAnyRole('ADMIN', 'VENDEDOR', 'SUPER_ADMIN')")
    public ResponseEntity<ProviderResponseDTO> pay(
            @PathVariable Long id,
            @Valid @RequestBody ProviderPaymentRequestDTO dto) {
        return ResponseEntity.ok(providerService.pay(id, dto));
    }
}
