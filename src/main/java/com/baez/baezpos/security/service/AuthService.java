package com.baez.baezpos.security.service;

import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.company.repository.CompanyRepository;
import com.baez.baezpos.security.JwtService;
import com.baez.baezpos.security.dto.AuthenticationRequest;
import com.baez.baezpos.security.dto.AuthenticationResponse;
import com.baez.baezpos.security.dto.SetupRequest;
import com.baez.baezpos.shared.exception.BadRequestException;
import com.baez.baezpos.user.entity.Role;
import com.baez.baezpos.user.entity.User;
import com.baez.baezpos.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.CredentialsExpiredException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final CompanyRepository companyRepository;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final PasswordEncoder passwordEncoder;

    public AuthenticationResponse authenticate(AuthenticationRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));

        // CHECK DE SEGURIDAD: Clave temporal "admin123"
        if ("admin123".equals(request.getPassword())) {
            if (user.getPasswordResetAt() == null ||
                    user.getPasswordResetAt().plusMinutes(10).isBefore(LocalDateTime.now())) {
                throw new CredentialsExpiredException("La clave temporal ha expirado. Solicite soporte nuevamente.");
            }
        }

        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
            );
        } catch (Exception e) {
            throw new RuntimeException("Credenciales incorrectas");
        }

        if (!user.getActive()) {
            throw new RuntimeException("La cuenta del usuario se encuentra desactivada");
        }

        // ==========================================
        // VALIDACIÓN DE LICENCIA SAAS (MULTI-TENANT)
        // ==========================================
        if (user.getRole() != Role.SUPER_ADMIN) {
            Company company = user.getCompany();
            if (company == null) {
                throw new RuntimeException("El usuario no tiene una empresa asociada.");
            }
            if (!Boolean.TRUE.equals(company.getActive())) {
                throw new RuntimeException("La suscripción de la empresa se encuentra suspendida.");
            }
            if (company.getExpirationDate() != null && company.getExpirationDate().isBefore(LocalDate.now())) {
                throw new RuntimeException("Su licencia/suscripción ha vencido el " + company.getExpirationDate() + ". Contacte a soporte para renovar.");
            }
        }

        String jwtToken = jwtService.generateToken(user);
        Long companyId = (user.getCompany() != null) ? user.getCompany().getId() : null;

        return AuthenticationResponse.builder()
                .token(jwtToken)
                .name(user.getName())
                .email(user.getEmail())
                .role(user.getRole().name())
                .companyId(companyId) // <-- Devolvemos el ID de la empresa
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

        // Damos 30 días de prueba inicial en el Setup
        Company company = Company.builder()
                .name(request.getCompanyName())
                .taxId(request.getTaxId())
                .phone(request.getPhone())
                .address(request.getAddress())
                .ticketMessage(request.getTicketMessage())
                .active(true)
                .expirationDate(LocalDate.now().plusDays(30)) // Trial de 30 días
                .build();
        Company savedCompany = companyRepository.save(company);

        User adminUser = User.builder()
                .name(request.getUserName())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .role(Role.ADMIN)
                .company(savedCompany) // <-- Relacionamos al usuario con su empresa
                .active(true)
                .build();
        userRepository.save(adminUser);

        String jwtToken = jwtService.generateToken(adminUser);

        return AuthenticationResponse.builder()
                .token(jwtToken)
                .name(adminUser.getName())
                .email(adminUser.getEmail())
                .role(adminUser.getRole().name())
                .companyId(savedCompany.getId())
                .build();
    }
}