package com.baez.baezpos.security.controller;

import com.baez.baezpos.security.dto.AuthenticationRequest;
import com.baez.baezpos.security.dto.AuthenticationResponse;
import com.baez.baezpos.security.dto.ForgotPasswordRequest;
import com.baez.baezpos.security.dto.SetupRequest;
import com.baez.baezpos.security.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/authenticate")
    public ResponseEntity<AuthenticationResponse> authenticate(
            @Valid @RequestBody AuthenticationRequest request
    ) {
        return ResponseEntity.ok(authService.authenticate(request));
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
        return ResponseEntity.ok(Map.of("message", "Si la cuenta existe en nuestro sistema, recibirá un correo con las instrucciones de restablecimiento."));
    }
}