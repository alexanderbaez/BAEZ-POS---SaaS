package com.baez.baezpos.security.controller;

import com.baez.baezpos.security.dto.AuthenticationRequest;
import com.baez.baezpos.security.dto.AuthenticationResponse;
import com.baez.baezpos.security.dto.ForgotPasswordRequest;
import com.baez.baezpos.security.dto.SetupRequest;
import com.baez.baezpos.security.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AuthController {

    private final AuthService authService;

    @PostMapping("/authenticate")
    public ResponseEntity<AuthenticationResponse> authenticate(
            @RequestBody AuthenticationRequest request
    ) {
        return ResponseEntity.ok(authService.authenticate(request));
    }

    @GetMapping("/setup-status")
    public ResponseEntity<Map<String, Boolean>> getSetupStatus() {
        return ResponseEntity.ok(authService.getSetupStatus());
    }

    @PostMapping("/setup")
    public ResponseEntity<AuthenticationResponse> setup(
            @RequestBody SetupRequest request
    ) {
        return ResponseEntity.ok(authService.setup(request));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, String>> forgotPassword(
            @RequestBody ForgotPasswordRequest request
    ) {
        authService.processForgotPassword(request);
        return ResponseEntity.ok(Map.of("message", "Se ha enviado una nueva contraseña temporal a su correo electrónico."));
    }
}