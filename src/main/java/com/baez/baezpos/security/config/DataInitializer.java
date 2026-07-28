package com.baez.baezpos.security.config;

import com.baez.baezpos.user.entity.Role;
import com.baez.baezpos.user.entity.User;
import com.baez.baezpos.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        String superAdminEmail = "admin@baezpos.com";
        if (!userRepository.existsByEmail(superAdminEmail)) {
            User superAdmin = User.builder()
                    .name("Alexander Báez (Super Admin)")
                    .email(superAdminEmail)
                    .password(passwordEncoder.encode("Alexander.38216639"))
                    .role(Role.SUPER_ADMIN)
                    .active(true)
                    .company(null)
                    .build();
            userRepository.save(superAdmin);
            log.info("SUPER_ADMIN maestro creado con exito: {} / Alexander.38216639", superAdminEmail);
        }
    }
}
