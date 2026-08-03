package com.baez.baezpos.security.config;

import com.baez.baezpos.user.entity.Role;
import com.baez.baezpos.user.entity.User;
import com.baez.baezpos.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    // Inyectamos las credenciales desde variables de entorno con fallback seguro
    @Value("${app.superadmin.email:alexanderbaez146@gmail.com}")
    private String superAdminEmail;

    @Value("${app.superadmin.password:ChangeMe123!}")
    private String superAdminPassword;

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        // Buscar si ya existe algún SUPER_ADMIN en la base de datos
        Optional<User> existingSuperAdmin = userRepository.findByEmail(superAdminEmail);

        if (existingSuperAdmin.isEmpty()) {
            // Verificar si existía con el email viejo ("admin@baezpos.com") para migrarlo
            Optional<User> legacySuperAdmin = userRepository.findByEmail("admin@baezpos.com");

            if (legacySuperAdmin.isPresent()) {
                User userToUpdate = legacySuperAdmin.get();
                userToUpdate.setEmail(superAdminEmail);
                userToUpdate.setPassword(passwordEncoder.encode(superAdminPassword));
                userRepository.save(userToUpdate);
                log.info("SUPER_ADMIN migrado exitosamente al correo real: {}", superAdminEmail);
            } else {
                // Crear el Super Admin maestro inicial
                User superAdmin = User.builder()
                        .name("Alexander Baez (Super Admin)")
                        .email(superAdminEmail)
                        .password(passwordEncoder.encode(superAdminPassword))
                        .role(Role.SUPER_ADMIN)
                        .active(true)
                        .company(null) // El Super Admin SaaS no pertenece a ninguna empresa particular
                        .build();

                userRepository.save(superAdmin);
                log.info("SUPER_ADMIN maestro SaaS creado con éxito: {}", superAdminEmail);
            }
        } else {
            log.info("SUPER_ADMIN ya existe en el sistema: {}", superAdminEmail);
        }
    }
}