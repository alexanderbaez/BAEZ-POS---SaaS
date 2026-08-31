package com.baez.baezpos.security.config;

import com.baez.baezpos.security.filter.JwtAuthenticationFilter;
import com.baez.baezpos.security.service.CustomUserDetailsService;
import lombok.RequiredArgsConstructor;
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
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final CustomUserDetailsService customUserDetailsService;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(
                                "/",
                                "/login",
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
                        .requestMatchers("/api/v1/auth/**").permitAll()
                        .requestMatchers("/api/v1/super-admin/**").hasRole("SUPER_ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/v1/users/validate-pin").hasAnyRole("ADMIN", "VENDEDOR", "SUPER_ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/users/update-password").authenticated()
                        .requestMatchers(HttpMethod.GET,
                                "/api/v1/admin/my-company/status",
                                "/api/v1/admin/my-company/check-status",
                                "/api/v1/admin/my-company/profile"
                        ).hasAnyRole("ADMIN", "VENDEDOR", "SUPER_ADMIN")
                        .requestMatchers("/api/v1/cash-register/**").hasAnyRole("ADMIN", "VENDEDOR", "SUPER_ADMIN")
                        .requestMatchers("/api/v1/categories/**").hasAnyRole("ADMIN", "VENDEDOR", "SUPER_ADMIN")
                        .requestMatchers("/api/v1/expenses/**").hasAnyRole("ADMIN", "VENDEDOR", "SUPER_ADMIN")
                        .requestMatchers("/api/v1/providers/**").hasAnyRole("ADMIN", "VENDEDOR", "SUPER_ADMIN")
                        .requestMatchers("/api/v1/sales/**").hasAnyRole("ADMIN", "VENDEDOR", "SUPER_ADMIN")
                        .requestMatchers("/api/v1/customers/**").hasAnyRole("ADMIN", "VENDEDOR", "SUPER_ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/v1/products/**").hasAnyRole("ADMIN", "VENDEDOR", "SUPER_ADMIN")
                        .requestMatchers("/api/v1/products/**").hasAnyRole("ADMIN", "SUPER_ADMIN")
                        .requestMatchers("/api/v1/inventory/**").hasAnyRole("ADMIN", "SUPER_ADMIN")
                        .requestMatchers("/api/v1/audit-logs/**").hasAnyRole("ADMIN", "SUPER_ADMIN")
                        .requestMatchers("/api/v1/users/**").hasAnyRole("ADMIN", "SUPER_ADMIN")
                        .requestMatchers("/api/v1/admin/**").hasAnyRole("ADMIN", "SUPER_ADMIN")
                        .anyRequest().authenticated()
                )
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authenticationProvider(authenticationProvider())
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
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

        // Or\u00EDgenes permitidos expl\u00EDcitos y patrones para producci\u00F3n y desarrollo
        config.setAllowedOriginPatterns(List.of(
                "https://baezpos.com",
                "https://www.baezpos.com",
                "https://*.baezpos.com",
                "https://*.amplifyapp.com",
                "https://*.onrender.com",
                "http://localhost:*",
                "http://127.0.0.1:*"
        ));

        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"));
        config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(List.of("Authorization", "Content-Disposition", "X-Total-Count"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}