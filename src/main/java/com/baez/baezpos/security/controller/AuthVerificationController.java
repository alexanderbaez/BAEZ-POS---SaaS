package com.baez.baezpos.security.controller;

import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.company.repository.CompanyRepository;
import com.baez.baezpos.shared.dto.MessageResponseDTO;
import com.baez.baezpos.user.entity.User;
import com.baez.baezpos.user.entity.VerificationToken;
import com.baez.baezpos.user.repository.UserRepository;
import com.baez.baezpos.user.repository.VerificationTokenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthVerificationController {

    private final VerificationTokenRepository tokenRepository;
    private final UserRepository userRepository;
    private final CompanyRepository companyRepository;

    @GetMapping("/verify")
    public ResponseEntity<MessageResponseDTO> confirmAccount(@RequestParam("token") String token) {
        VerificationToken verificationToken = tokenRepository.findByToken(token)
                .orElseThrow(() -> new IllegalArgumentException("Token de activación inválido o inexistente."));

        if (verificationToken.isExpired()) {
            throw new IllegalArgumentException("El enlace de activación ha expirado. Contacte con soporte.");
        }

        User user = verificationToken.getUser();
        user.setActive(true);
        userRepository.save(user);

        Company company = user.getCompany();
        if (company != null) {
            company.setActive(true);
            companyRepository.save(company);
        }

        tokenRepository.delete(verificationToken);

        return ResponseEntity.ok(MessageResponseDTO.of("¡Cuenta activada con éxito! Ya puede iniciar sesión en BaezPOS."));
    }
}