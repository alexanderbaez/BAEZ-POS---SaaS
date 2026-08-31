package com.baez.baezpos.security.config;

import com.baez.baezpos.security.interceptor.TenantSubscriptionInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Configuraci\u00F3n de Spring MVC para el registro del interceptor de suscripci\u00F3n multi-tenant.
 */
@Configuration
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {

    private final TenantSubscriptionInterceptor tenantSubscriptionInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(tenantSubscriptionInterceptor)
                // Aplicar a los m\u00F3dulos transaccionales y de mutaci\u00F3n de negocio del tenant
                .addPathPatterns(
                        "/api/v1/sales/**",
                        "/api/v1/cash-register/**",
                        "/api/v1/boxes/**",
                        "/api/v1/expenses/**",
                        "/api/v1/products/**",
                        "/api/v1/customers/**",
                        "/api/v1/providers/**",
                        "/api/v1/categories/**",
                        "/api/v1/inventory/**",
                        "/api/v1/users/**"
                )
                // Excluir autenticaci\u00F3n, super admin y endpoints de auditor\u00EDa de suscripci\u00F3n
                .excludePathPatterns(
                        "/api/v1/auth/**",
                        "/api/v1/super-admin/**",
                        "/api/v1/admin/my-company/status",
                        "/api/v1/admin/my-company/check-status",
                        "/api/v1/admin/my-company/profile",
                        "/error"
                );
    }
}
