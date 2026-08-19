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

    @Value("${app.superadmin.email:alexanderbaez146@gmail.com}")
    private String superAdminEmail;

    @Value("${app.superadmin.password:Alexander.38216639}")
    private String superAdminPassword;

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        Optional<User> existingSuperAdmin = userRepository.findByEmail(superAdminEmail);

        if (existingSuperAdmin.isPresent()) {
            User admin = existingSuperAdmin.get();
            admin.setPassword(passwordEncoder.encode(superAdminPassword));
            admin.setActive(true);
            admin.setRole(Role.SUPER_ADMIN);
            userRepository.save(admin);
            log.info("SUPER_ADMIN actualizado con hash fresco de BCrypt: {}", superAdminEmail);
        } else {
            User superAdmin = User.builder()
                    .name("Alexander Baez (Super Admin)")
                    .email(superAdminEmail)
                    .password(passwordEncoder.encode(superAdminPassword))
                    .role(Role.SUPER_ADMIN)
                    .active(true)
                    .company(null)
                    .build();

            userRepository.save(superAdmin);
            log.info("SUPER_ADMIN creado con éxito: {}", superAdminEmail);
        }
    }
}