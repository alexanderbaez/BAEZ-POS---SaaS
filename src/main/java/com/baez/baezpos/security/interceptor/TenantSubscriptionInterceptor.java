package com.baez.baezpos.security.interceptor;

import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.company.repository.CompanyRepository;
import com.baez.baezpos.security.entity.UserPrincipal;
import com.baez.baezpos.user.entity.Role;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpMethod;
import org.springframework.lang.NonNull;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;
import java.time.LocalDate;
import java.util.Optional;
import java.util.Set;

/**
 * Interceptor de seguridad en tiempo real para mutaciones de negocio (POST, PUT, DELETE, PATCH).
 * Resuelve la vulnerabilidad de "Stateless Claim Lag" validando el estado y vigencia
 * de la suscripción del tenant directamente contra la base de datos sin afectar el rendimiento de lectura.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TenantSubscriptionInterceptor implements HandlerInterceptor {

    private final CompanyRepository companyRepository;

    private static final Set<String> MUTATION_METHODS = Set.of(
            HttpMethod.POST.name(),
            HttpMethod.PUT.name(),
            HttpMethod.DELETE.name(),
            HttpMethod.PATCH.name()
    );

    @Override
    public boolean preHandle(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull Object handler
    ) throws Exception {

        // 1. Omitir peticiones que no modifican estado (GET, OPTIONS, HEAD, etc.)
        String method = request.getMethod();
        if (method == null || !MUTATION_METHODS.contains(method.toUpperCase())) {
            return true;
        }

        // 2. Extraer contexto de seguridad autenticado
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return true; // Seguridad global (Spring Security) se encargará del 401 si corresponde
        }

        Object principal = authentication.getPrincipal();
        if (!(principal instanceof UserPrincipal userPrincipal)) {
            return true;
        }

        // 3. SuperAdmin tiene pase irrestricto en toda la plataforma
        if (userPrincipal.getRole() == Role.SUPER_ADMIN || userPrincipal.getCompanyId() == null) {
            return true;
        }

        Long companyId = userPrincipal.getCompanyId();

        // 4. Consulta directa y ligera a Base de Datos (Fuente de Verdad en Tiempo Real)
        Optional<Company> companyOpt = companyRepository.findById(companyId);
        if (companyOpt.isEmpty()) {
            log.warn("Bloqueo de mutación: Empresa ID {} no encontrada en BD.", companyId);
            sendSubscriptionForbiddenResponse(response, "Empresa no encontrada o dada de baja.");
            return false;
        }

        Company company = companyOpt.get();
        LocalDate today = LocalDate.now();

        boolean isActive = Boolean.TRUE.equals(company.getActive());
        boolean isExpired = company.getExpirationDate() != null && today.isAfter(company.getExpirationDate());

        // 5. Guillotina de seguridad: Bloquear si la empresa está inhabilitada o expirada
        if (!isActive || isExpired) {
            log.warn("Bloqueo de mutación: Empresa ID '{}' intentó ejecutar '{} {}' con estado [Activa={}, Vencida={}].",
                    companyId, method, request.getRequestURI(), isActive, isExpired);

            sendSubscriptionForbiddenResponse(response, "Suscripción inactiva o vencida");
            return false;
        }

        return true;
    }

    private void sendSubscriptionForbiddenResponse(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write(String.format(
                "{\"error\": \"CUENTA_SUSPENDIDA\", \"message\": \"%s\"}",
                message
        ));
    }
}
