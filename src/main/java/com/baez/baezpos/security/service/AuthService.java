package com.baez.baezpos.security.service;

import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.company.repository.CompanyRepository;
import com.baez.baezpos.mail.service.EmailService;
import com.baez.baezpos.security.JwtService;
import com.baez.baezpos.security.dto.AuthenticationRequest;
import com.baez.baezpos.security.dto.AuthenticationResponse;
import com.baez.baezpos.security.dto.ForgotPasswordRequest;
import com.baez.baezpos.security.dto.SetupRequest;
import com.baez.baezpos.shared.exception.BadRequestException;
import com.baez.baezpos.user.entity.Role;
import com.baez.baezpos.user.entity.User;
import com.baez.baezpos.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final CompanyRepository companyRepository;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;

    @Transactional
    public AuthenticationResponse authenticate(AuthenticationRequest request) {
        String cleanEmail = request.getEmail().trim().toLowerCase();

        User user = userRepository.findByEmail(cleanEmail)
                .orElseThrow(() -> new BadCredentialsException("Credenciales incorrectas. Verifique email y contraseña."));

        if (!Boolean.TRUE.equals(user.getActive())) {
            throw new BadRequestException("La cuenta de usuario se encuentra desactivada.");
        }

        if (user.getPasswordResetAt() != null) {
            LocalDateTime resetAt = user.getPasswordResetAt();
            if (resetAt.plusMinutes(10).isBefore(LocalDateTime.now())) {
                throw new BadCredentialsException("La contraseña temporal ha expirado. Solicite una nueva recuperación.");
            }
        }

        // Dejamos que Spring Security maneje la autenticación de forma limpia
        // sin envolverlo en un catch genérico que oculte posibles errores de configuración.
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(cleanEmail, request.getPassword())
        );

        if (user.getPasswordResetAt() != null) {
            user.setPasswordResetAt(null);
            userRepository.save(user);
        }

        String jwtToken = jwtService.generateToken(user);
        Long companyId = (user.getCompany() != null) ? user.getCompany().getId() : null;

        return AuthenticationResponse.builder()
                .token(jwtToken)
                .name(user.getName())
                .email(user.getEmail())
                .role(user.getRole().name())
                .companyId(companyId)
                .build();
    }

    public Map<String, Boolean> getSetupStatus() {
        return Map.of("isSetupRequired", userRepository.count() == 0);
    }

    @Transactional
    public AuthenticationResponse setup(SetupRequest request) {
        if (userRepository.count() > 0) {
            throw new BadRequestException("El sistema ya ha sido configurado previamente.");
        }

        Company company = Company.builder()
                .name(request.getCompanyName())
                .taxId(request.getTaxId())
                .phone(request.getPhone())
                .address(request.getAddress())
                .ticketMessage(request.getTicketMessage())
                .active(true)
                .expirationDate(LocalDate.now().plusDays(30))
                .build();
        Company savedCompany = companyRepository.save(company);

        User adminUser = User.builder()
                .name(request.getUserName())
                .email(request.getEmail().trim().toLowerCase())
                .password(passwordEncoder.encode(request.getPassword()))
                .role(Role.ADMIN)
                .company(savedCompany)
                .active(true)
                .build();
        userRepository.save(adminUser);

        try {
            emailService.enviarMailBienvenida(
                    adminUser.getEmail(),
                    savedCompany.getName(),
                    adminUser.getName(),
                    request.getPassword()
            );
        } catch (Exception e) {
            log.error("Error al enviar correo de bienvenida en setup a {}: {}", adminUser.getEmail(), e.getMessage());
        }

        String jwtToken = jwtService.generateToken(adminUser);
        return AuthenticationResponse.builder()
                .token(jwtToken)
                .name(adminUser.getName())
                .email(adminUser.getEmail())
                .role(adminUser.getRole().name())
                .companyId(savedCompany.getId())
                .build();
    }

    @Transactional
    public void processForgotPassword(ForgotPasswordRequest request) {
        String cleanEmail = request.getEmail().trim().toLowerCase();
        Optional<User> userOpt = userRepository.findByEmail(cleanEmail);

        if (userOpt.isEmpty()) {
            log.warn("Solicitud de restablecimiento de contraseña para correo no registrado: {}", cleanEmail);
            return;
        }

        User user = userOpt.get();
        String temporaryPassword = generateRandomPassword(8);

        user.setPassword(passwordEncoder.encode(temporaryPassword));
        user.setPasswordResetAt(LocalDateTime.now());
        userRepository.save(user);

        try {
            emailService.enviarMailResetPassword(
                    user.getEmail(),
                    user.getName(),
                    temporaryPassword
            );
        } catch (Exception e) {
            log.error("Fallo en el envío SMTP de clave temporal a {}: {}", cleanEmail, e.getMessage());
        }
    }

    private String generateRandomPassword(int length) {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        SecureRandom random = new SecureRandom();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < length; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        return sb.toString();
    }
}