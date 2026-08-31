package com.baez.baezpos.user.controller;

import com.baez.baezpos.shared.dto.MessageResponseDTO;
import com.baez.baezpos.user.dto.UserRequestDTO;
import com.baez.baezpos.user.dto.UserResponseDTO;
import com.baez.baezpos.user.service.UserService.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class UserController {

    private final UserService userService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<UserResponseDTO> create(@Valid @RequestBody UserRequestDTO dto) {
        return new ResponseEntity<>(userService.createUser(dto), HttpStatus.CREATED);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<Page<UserResponseDTO>> getAll(
            @PageableDefault(size = 20, sort = "name", direction = Sort.Direction.ASC) Pageable pageable) {
        return ResponseEntity.ok(userService.getAllUsers(pageable));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<UserResponseDTO> getById(@PathVariable Long id) {
        return ResponseEntity.ok(userService.getUserById(id));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<UserResponseDTO> update(@PathVariable Long id, @Valid @RequestBody UserRequestDTO dto) {
        return ResponseEntity.ok(userService.updateUser(id, dto));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        userService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/update-password")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<MessageResponseDTO> updatePassword(@RequestBody Map<String, String> request) {
        String newPassword = request.get("newPassword");
        if (newPassword == null || newPassword.isBlank()) {
            throw new IllegalArgumentException("La nueva contraseÃ±a no puede estar vacÃ­a.");
        }
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        userService.updatePasswordOnly(email, newPassword);
        return ResponseEntity.ok(MessageResponseDTO.of("ContraseÃ±a actualizada correctamente"));
    }

    @PostMapping("/validate-pin")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> validatePin(@RequestBody Map<String, String> payload) {
        String pin = payload != null ? payload.get("pin") : null;
        if (pin == null || pin.trim().isEmpty()) {
            return ResponseEntity.ok(Map.of("valid", false, "debug_message", "AUDIT_ERROR: PIN recibido vacÃ­o o nulo."));
        }
        String auditResult = userService.validateSupervisorPin(pin.trim());
        boolean isValid = "OK".equals(auditResult);
        return ResponseEntity.ok(Map.of("valid", isValid, "debug_message", auditResult));
    }
}