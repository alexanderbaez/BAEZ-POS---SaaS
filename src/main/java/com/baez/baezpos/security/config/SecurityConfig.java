package com.baez.baezpos.security.config;

import com.baez.baezpos.security.filter.JwtAuthenticationFilter;
import com.baez.baezpos.security.service.CustomUserDetailsService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final CustomUserDetailsService customUserDetailsService;

    @Value("${app.cors.allowed-origins:http://localhost:3000,http://localhost:5173,http://localhost:8080}")
    private String allowedOrigins;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .formLogin(form -> form.disable())
                .httpBasic(basic -> basic.disable())
                .authorizeHttpRequests(auth -> auth
                        // 1. Archivos estáticos y Vistas HTML
                        .requestMatchers(
                                "/",
                                "/login.html",
                                "/index.html",
                                "/*.html",
                                "/css/**",
                                "/js/**",
                                "/images/**",
                                "/*.js",
                                "/*.css",
                                "/favicon.ico",
                                "/error"
                        ).permitAll()

                        // 2. Endpoints públicos del Módulo de Autenticación
                        .requestMatchers(
                                "/api/v1/auth/authenticate",
                                "/api/v1/auth/setup-status",
                                "/api/v1/auth/setup",
                                "/api/v1/auth/forgot-password",
                                "/api/v1/auth/verify" // <-- Agregado para activación por email
                        ).permitAll()

                        // 3. Módulo Global Super Admin
                        .requestMatchers("/api/v1/super-admin/**").hasRole("SUPER_ADMIN")

                        // 4. Perfil de Usuario (Cualquier usuario autenticado puede actualizar su clave)
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/users/update-password").authenticated()

                        // 5. Operaciones de Empresa y POS accesibles por ADMIN y VENDEDOR
                        .requestMatchers(HttpMethod.GET,
                                "/api/v1/admin/my-company/status",
                                "/api/v1/admin/my-company/check-status",
                                "/api/v1/admin/my-company/profile"
                        ).hasAnyRole("ADMIN", "VENDEDOR", "SUPER_ADMIN")

                        .requestMatchers(HttpMethod.GET, "/api/v1/products/**").hasAnyRole("ADMIN", "VENDEDOR", "SUPER_ADMIN")
                        .requestMatchers("/api/v1/sales/**").hasAnyRole("ADMIN", "VENDEDOR", "SUPER_ADMIN")
                        .requestMatchers("/api/v1/customers/**").hasAnyRole("ADMIN", "VENDEDOR", "SUPER_ADMIN")

                        // 6. Módulos de administración del tenant (ADMIN y SUPER_ADMIN)
                        .requestMatchers("/api/v1/users/**").hasAnyRole("ADMIN", "SUPER_ADMIN")
                        .requestMatchers("/api/v1/inventory/**").hasAnyRole("ADMIN", "SUPER_ADMIN")
                        .requestMatchers("/api/v1/admin/**").hasAnyRole("ADMIN", "SUPER_ADMIN")

                        .anyRequest().authenticated()
                )
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authenticationProvider(authenticationProvider())
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public UserDetailsService userDetailsService() {
        return customUserDetailsService;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider();
        authProvider.setUserDetailsService(customUserDetailsService);
        authProvider.setPasswordEncoder(passwordEncoder());
        return authProvider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        // Parsear los orígenes permitidos desde application.properties / variables de entorno
        List<String> origins = Arrays.asList(allowedOrigins.split(","));
        config.setAllowedOrigins(origins);

        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Requested-With", "Accept", "Origin"));
        config.setExposedHeaders(List.of("Authorization"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}