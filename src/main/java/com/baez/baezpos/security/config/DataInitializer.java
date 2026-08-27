package com.baez.baezpos.security.config;

import com.baez.baezpos.user.entity.Role;
import com.baez.baezpos.user.entity.User;
import com.baez.baezpos.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
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
    private final JdbcTemplate jdbcTemplate;

    @Value("${app.superadmin.email:alexanderbaez146@gmail.com}")
    private String superAdminEmail;

    @Value("${app.superadmin.password:Alexander.38216639}")
    private String superAdminPassword;

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        // ==========================================
        // SANITIZACIÓN DIRECTA SQL (JPA Versioning Null Fix)
        // ==========================================
        sanearVersionesBaseDeDatos();

        Optional<User> superAdminOpt = userRepository.findByEmail(superAdminEmail);
        if (superAdminOpt.isPresent()) {
            User existing = superAdminOpt.get();
            if (existing.getSecurityPin() == null) {
                existing.setSecurityPin("1234");
                userRepository.save(existing);
            }
            log.info("SUPER_ADMIN verificado en el sistema: {}", superAdminEmail);
            return;
        }

        User superAdmin = User.builder()
                .name("Alexander Baez (Super Admin)")
                .email(superAdminEmail)
                .password(passwordEncoder.encode(superAdminPassword))
                .role(Role.SUPER_ADMIN)
                .active(true)
                .company(null)
                .securityPin("1234")
                .version(0L)
                .build();

        userRepository.save(superAdmin);
        log.info("SUPER_ADMIN inicializado con éxito: {}", superAdminEmail);
    }

    private void sanearVersionesBaseDeDatos() {
        String[] tables = {
            "users", "companies", "customers", "customer_movements",
            "products", "categories", "sales", "cash_register_sessions",
            "expenses", "providers", "inventory_movements", "system_logs"
        };

        for (String table : tables) {
            try {
                jdbcTemplate.execute("UPDATE " + table + " SET version = 0 WHERE version IS NULL");
            } catch (Exception e) {
                log.debug("No se pudo ejecutar sanitización sobre tabla {}: {}", table, e.getMessage());
            }
        }
        log.info("Sanitización preventiva de versiones JPA completada exitosamente.");
    }
}