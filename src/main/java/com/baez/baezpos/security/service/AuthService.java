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
import org.springframework.security.authentication.BadCredentialsException;
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

    @Transactional(readOnly = true)
    public AuthenticationResponse authenticate(AuthenticationRequest request) {
        // 1. Buscar usuario por Email
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new BadCredentialsException("Credenciales incorrectas. Verifique email y contraseña."));

        // 2. CHECK DE SEGURIDAD: Clave temporal "admin123"
        if ("admin123".equals(request.getPassword())) {
            LocalDateTime resetAt = user.getPasswordResetAt();
            if (resetAt == null || resetAt.plusMinutes(10).isBefore(LocalDateTime.now())) {
                throw new BadCredentialsException("La clave temporal ha expirado o no es válida. Solicite soporte.");
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

        // 4. Validar estado de la cuenta del usuario (Si el usuario individual está desactivado, sí se bloquea)
        if (!Boolean.TRUE.equals(user.getActive())) {
            throw new BadRequestException("La cuenta de usuario se encuentra desactivada.");
        }

        // Nota: Se removió el bloqueo de la empresa en el login (Paso 5 anterior).
        // Ahora el cliente puede iniciar sesión libremente aun estando suspendido,
        // para poder navegar por el dashboard/productos y que el centinela actúe quirúrgicamente en el POS.

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