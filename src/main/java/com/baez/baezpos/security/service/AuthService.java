package com.baez.baezpos.security.service;

import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.company.repository.CompanyRepository;
import com.baez.baezpos.mail.EmailService;
import com.baez.baezpos.security.JwtService;
import com.baez.baezpos.security.dto.AuthenticationRequest;
import com.baez.baezpos.security.dto.AuthenticationResponse;
import com.baez.baezpos.security.dto.ForgotPasswordRequest;
import com.baez.baezpos.security.dto.SetupRequest;
import com.baez.baezpos.shared.exception.BadRequestException;
import com.baez.baezpos.shared.exception.ResourceNotFoundException;
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

    @Transactional(readOnly = true)
    public AuthenticationResponse authenticate(AuthenticationRequest request) {
        // 1. Buscar usuario por Email
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new BadCredentialsException("Credenciales incorrectas. Verifique email y contraseña."));

        // 2. CHECK DE SEGURIDAD: Validación de expiración de clave temporal de recupero (10 min)
        if (user.getPasswordResetAt() != null) {
            LocalDateTime resetAt = user.getPasswordResetAt();
            if (resetAt.plusMinutes(10).isBefore(LocalDateTime.now())) {
                throw new BadCredentialsException("La contraseña temporal ha expirado. Por favor solicite una nueva.");
            }
        }

        // 3. Autenticar en Spring Security
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
            );
        } catch (Exception e) {
            throw new BadCredentialsException("Credenciales incorrectas. Verifique email y contraseña.");
        }

        // 4. Validar estado de la cuenta del usuario
        if (!Boolean.TRUE.equals(user.getActive())) {
            throw new BadRequestException("La cuenta de usuario se encuentra desactivada.");
        }

        // 5. Generar JWT y responder
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

    public java.util.Map<String, Boolean> getSetupStatus() {
        return java.util.Map.of("isSetupRequired", userRepository.count() == 0);
    }

    @Transactional
    public AuthenticationResponse setup(SetupRequest request) {
        long userCount = userRepository.count();
        if (userCount > 0) {
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
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .role(Role.ADMIN)
                .company(savedCompany)
                .active(true)
                .build();
        userRepository.save(adminUser);

        // --- ENVÍO DEL EMAIL DE BIENVENIDA ---
        try {
            emailService.enviarMailBienvenida(
                    adminUser.getEmail(),
                    adminUser.getName(),
                    savedCompany.getName()
            );
            log.info("Correo de bienvenida enviado exitosamente a {}", adminUser.getEmail());
        } catch (Exception e) {
            log.error("Error al enviar correo de bienvenida a {}: {}", adminUser.getEmail(), e.getMessage());
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
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("No existe ninguna cuenta asociada a este correo electrónico."));

        // Bloqueo de seguridad: Vendedores no pueden usar este módulo
        if (user.getRole() == Role.VENDEDOR) {
            throw new BadRequestException("Los vendedores no tienen permitido reestablecer contraseña vía correo. Solicítela al Administrador de su empresa.");
        }

        // Generar contraseña temporal de 8 caracteres alfanuméricos
        String temporaryPassword = generateRandomPassword(8);

        user.setPassword(passwordEncoder.encode(temporaryPassword));
        user.setPasswordResetAt(LocalDateTime.now());
        userRepository.save(user);

        // Envío asíncrono de correo real
        try {
            emailService.enviarMailResetPassword(
                    user.getEmail(),
                    user.getName(),
                    temporaryPassword
            );
        } catch (Exception e) {
            log.error("No se pudo enviar el correo de recuperación a {}: {}", user.getEmail(), e.getMessage());
            throw new RuntimeException("Error al enviar el correo de recuperación. Intente nuevamente.");
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