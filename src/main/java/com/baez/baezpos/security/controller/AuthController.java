package com.baez.baezpos.security.controller;

import com.baez.baezpos.security.dto.AuthenticationRequest;
import com.baez.baezpos.security.dto.AuthenticationResponse;
import com.baez.baezpos.security.dto.ForgotPasswordRequest;
import com.baez.baezpos.security.dto.SetupRequest;
import com.baez.baezpos.security.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Slf4j
public class AuthController {

    private final AuthService authService;

    @PostMapping("/authenticate")
    public ResponseEntity<?> authenticate(
            @Valid @RequestBody AuthenticationRequest request
    ) {
        log.info("Intento de autenticaciÃ³n para el usuario: {}", request.getEmail());
        AuthenticationResponse response = authService.authenticate(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/setup-status")
    public ResponseEntity<Map<String, Boolean>> getSetupStatus() {
        return ResponseEntity.ok(authService.getSetupStatus());
    }

    @PostMapping("/setup")
    public ResponseEntity<AuthenticationResponse> setup(
            @Valid @RequestBody SetupRequest request
    ) {
        return ResponseEntity.ok(authService.setup(request));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, String>> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request
    ) {
        authService.processForgotPassword(request);
        return ResponseEntity.ok(Map.of("message", "Si la cuenta existe en nuestro sistema, recibirÃ¡ un correo con las instrucciones de restablecimiento."));
    }
}