package com.baez.baezpos.company.controller;

import com.baez.baezpos.company.dto.CompanyDTO;
import com.baez.baezpos.company.service.CompanyService.CompanyService;
import com.baez.baezpos.user.dto.UserRequestDTO;
import com.baez.baezpos.user.dto.UserResponseDTO;
import com.baez.baezpos.user.entity.Role;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/my-company")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class CompanyController {

    private final CompanyService companyService;

    // --- PERFIL DE EMPRESA ---
    @GetMapping("/profile")
    public ResponseEntity<CompanyDTO> getMyData() {
        return ResponseEntity.ok(companyService.getAuthenticatedCompany());
    }

    @PutMapping("/profile")
    public ResponseEntity<CompanyDTO> updateMyBusiness(@Valid @RequestBody CompanyDTO dto) {
        return ResponseEntity.ok(companyService.updateAuthenticatedCompany(dto));
    }

    @GetMapping({"/status", "/check-status"})
    public ResponseEntity<Map<String, Object>> getStatus() {
        return ResponseEntity.ok(companyService.verificarEstadoSuscripcionAutenticada());
    }

    // --- GESTIÓN DE CAJEROS (VENDEDORES) ---
    @GetMapping("/employees")
    public ResponseEntity<List<UserResponseDTO>> getAllEmployees() {
        return ResponseEntity.ok(companyService.getMyEmployees());
    }

    @PostMapping("/employees")
    public ResponseEntity<UserResponseDTO> createEmployee(@Valid @RequestBody UserRequestDTO dto) {
        dto.setRole(Role.VENDEDOR);
        return ResponseEntity.ok(companyService.createEmployee(dto));
    }

    @PutMapping("/employees/{id}")
    public ResponseEntity<UserResponseDTO> updateEmployee(@PathVariable Long id, @Valid @RequestBody UserRequestDTO dto) {
        return ResponseEntity.ok(companyService.updateEmployee(id, dto));
    }

    @DeleteMapping("/employees/{id}")
    public ResponseEntity<Void> deleteEmployee(@PathVariable Long id) {
        companyService.deleteEmployee(id);
        return ResponseEntity.noContent().build();
    }
}