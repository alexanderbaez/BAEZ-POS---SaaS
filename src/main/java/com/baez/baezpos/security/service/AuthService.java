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
        String cleanEmail = request.getEmail() != null ? request.getEmail().trim().toLowerCase() : "";
        String rawPassword = request.getPassword() != null ? request.getPassword() : "";

        User user = userRepository.findByEmail(cleanEmail)
                .orElseThrow(() -> new BadCredentialsException("Credenciales incorrectas. Verifique email y contraseÃ±a."));

        if (!Boolean.TRUE.equals(user.getActive())) {
            throw new BadRequestException("La cuenta de usuario se encuentra desactivada.");
        }

        // AutenticaciÃ³n estÃ¡ndar y segura de Spring Security mediante BCryptPasswordEncoder
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(cleanEmail, rawPassword)
        );

        // Si el usuario ingresÃ³ exitosamente usando una clave temporal, limpiamos el flag de reseteo de forma atÃ³mica
        if (user.getPasswordResetAt() != null) {
            userRepository.clearPasswordResetAt(user.getId(), LocalDateTime.now());
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
                .version(0L)
                .build();
        Company savedCompany = companyRepository.save(company);

        User adminUser = User.builder()
                .name(request.getUserName())
                .email(request.getEmail().trim().toLowerCase())
                .password(passwordEncoder.encode(request.getPassword()))
                .role(Role.ADMIN)
                .company(savedCompany)
                .active(true)
                .version(0L)
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
        String cleanEmail = request.getEmail() != null ? request.getEmail().trim().toLowerCase() : "";
        Optional<User> userOpt = userRepository.findByEmail(cleanEmail);

        if (userOpt.isEmpty()) {
            log.warn("Solicitud de restablecimiento de contraseÃ±a para correo no registrado: {}", cleanEmail);
            return;
        }

        User user = userOpt.get();
        LocalDateTime now = LocalDateTime.now();

        // Anti-Spam: Cooldown de 2 minutos para evitar rÃ¡fagas de correos
        if (user.getPasswordResetAt() != null && user.getPasswordResetAt().isAfter(now.minusMinutes(2))) {
            log.warn("Bloqueo de seguridad: Intento de recuperaciÃ³n masivo detectado para {}", cleanEmail);
            throw new BadRequestException("Ya enviamos un correo recientemente. RevisÃ¡ tu bandeja de entrada o esperÃ¡ 2 minutos para volver a intentar.");
        }

        String temporaryPassword = generateRandomPassword(8);
        String encodedPassword = passwordEncoder.encode(temporaryPassword);

        // Se persiste de forma atÃ³mica la contraseÃ±a encriptada con BCrypt en la base de datos
        userRepository.updatePasswordAndResetAt(user.getId(), encodedPassword, now, now);

        try {
            emailService.enviarMailResetPassword(
                    user.getEmail(),
                    user.getName(),
                    temporaryPassword
            );
            log.info("Clave temporal despachada exitosamente por correo a: {}", cleanEmail);
        } catch (Exception e) {
            log.error("Fallo en el despacho de clave temporal a {}: {}", cleanEmail, e.getMessage());
        }
    }

    private String generateRandomPassword(int length) {
        // Caracteres legibles y sin ambigÃ¼edades visuales (sin 0/O, 1/l/I)
        String chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
        SecureRandom random = new SecureRandom();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < length; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        return sb.toString();
    }
}