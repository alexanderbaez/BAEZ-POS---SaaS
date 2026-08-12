package com.baez.baezpos.company.controller;

import com.baez.baezpos.company.dto.CompanyDTO;
import com.baez.baezpos.company.dto.MasterRegistrationRequest;
import com.baez.baezpos.company.service.CompanyService.MasterAdmin;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/super-admin/companies")
@PreAuthorize("hasRole('SUPER_ADMIN')")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AdminMasterController {

    private final MasterAdmin masterAdminService;

    @GetMapping
    public ResponseEntity<List<CompanyDTO>> listAll() {
        return ResponseEntity.ok(masterAdminService.getAllCompaniesMaster());
    }

    @PostMapping
    public ResponseEntity<String> registerCompany(@Valid @RequestBody MasterRegistrationRequest req) {
        masterAdminService.registerFullBusiness(req);
        return ResponseEntity.ok("Empresa registrada correctamente. Se ha generado la cuenta del administrador.");
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        masterAdminService.deleteCompanyMaster(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        return ResponseEntity.ok(masterAdminService.getMasterDashboardStats());
    }

    @PutMapping("/{id}")
    public ResponseEntity<String> update(@PathVariable Long id, @Valid @RequestBody CompanyDTO dto) { // <--- Agregado @Valid
        masterAdminService.updateCompanyMaster(id, dto);
        return ResponseEntity.ok("Empresa actualizada correctamente.");
    }

    @PatchMapping("/{id}/extend")
    public ResponseEntity<String> extendSubscription(@PathVariable Long id) {
        masterAdminService.extendSubscriptionMaster(id);
        return ResponseEntity.ok("Suscripción extendida 30 días.");
    }

    @PatchMapping("/{id}/reset-password")
    public ResponseEntity<String> resetPassword(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String newPass = body.get("password");
        if (newPass == null || newPass.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("La nueva contraseña no puede estar vacía.");
        }
        masterAdminService.resetOwnerPassword(id, newPass.trim());
        return ResponseEntity.ok("Contraseña restablecida correctamente.");
    }
}