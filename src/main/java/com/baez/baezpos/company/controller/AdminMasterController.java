package com.baez.baezpos.company.controller;

import com.baez.baezpos.company.dto.CompanyDTO;
import com.baez.baezpos.company.dto.MasterRegistrationRequest;
import com.baez.baezpos.company.service.CompanyService.MasterAdmin;
import com.baez.baezpos.shared.dto.MessageResponseDTO;
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
    public ResponseEntity<MessageResponseDTO> registerCompany(@Valid @RequestBody MasterRegistrationRequest req) {
        masterAdminService.registerFullBusiness(req);
        return ResponseEntity.ok(MessageResponseDTO.of("Empresa registrada correctamente. Se ha generado la cuenta del administrador."));
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
    public ResponseEntity<MessageResponseDTO> update(@PathVariable Long id, @Valid @RequestBody CompanyDTO dto) {
        masterAdminService.updateCompanyMaster(id, dto);
        return ResponseEntity.ok(MessageResponseDTO.of("Empresa actualizada correctamente."));
    }

    @PatchMapping("/{id}/extend")
    public ResponseEntity<MessageResponseDTO> extendSubscription(@PathVariable Long id) {
        masterAdminService.extendSubscriptionMaster(id);
        return ResponseEntity.ok(MessageResponseDTO.of("Suscripción extendida 30 días."));
    }

    @PatchMapping("/{id}/reset-password")
    public ResponseEntity<MessageResponseDTO> resetPassword(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String newPass = body.get("password");
        if (newPass == null || newPass.trim().isEmpty()) {
            throw new IllegalArgumentException("La nueva contraseña no puede estar vacía.");
        }
        masterAdminService.resetOwnerPassword(id, newPass.trim());
        return ResponseEntity.ok(MessageResponseDTO.of("Contraseña restablecida correctamente."));
    }
}