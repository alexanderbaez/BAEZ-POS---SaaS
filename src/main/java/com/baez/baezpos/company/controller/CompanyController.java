package com.baez.baezpos.company.controller;

import com.baez.baezpos.company.dto.CompanyDTO;
import com.baez.baezpos.user.dto.UserDTO;
import com.baez.baezpos.user.entity.Role;
import com.baez.baezpos.company.service.CompanyService.CompanyService;
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
    public ResponseEntity<CompanyDTO> updateMyBusiness(@RequestBody CompanyDTO dto) {
        return ResponseEntity.ok(companyService.updateAuthenticatedCompany(dto));
    }

    // Acepta tanto /status como /check-status para compatibilidad total
    @GetMapping({"/status", "/check-status"})
    public ResponseEntity<Map<String, Object>> getStatus() {
        return ResponseEntity.ok(companyService.verificarEstadoSuscripcionAutenticada());
    }

    // --- GESTIÓN DE CAJEROS (VENDEDORES) ---
    @GetMapping("/employees")
    public ResponseEntity<List<UserDTO>> getAllEmployees() {
        return ResponseEntity.ok(companyService.getMyEmployees());
    }

    @PostMapping("/employees")
    public ResponseEntity<UserDTO> createEmployee(@RequestBody UserDTO dto) {
        dto.setRole(Role.VENDEDOR.name());
        return ResponseEntity.ok(companyService.createEmployee(dto));
    }

    @PutMapping("/employees/{id}")
    public ResponseEntity<UserDTO> updateEmployee(@PathVariable Long id, @RequestBody UserDTO dto) {
        return ResponseEntity.ok(companyService.updateEmployee(id, dto));
    }

    @DeleteMapping("/employees/{id}")
    public ResponseEntity<Void> deleteEmployee(@PathVariable Long id) {
        companyService.deleteEmployee(id);
        return ResponseEntity.noContent().build();
    }
}