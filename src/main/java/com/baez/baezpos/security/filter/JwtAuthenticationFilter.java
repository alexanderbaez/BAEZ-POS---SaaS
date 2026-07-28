package com.baez.baezpos.security.filter;

import com.baez.baezpos.security.JwtService;
import com.baez.baezpos.security.entity.UserPrincipal;
import com.baez.baezpos.security.service.CustomUserDetailsService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final CustomUserDetailsService userDetailsService;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();
        return path.equals("/") ||
                path.equals("/login.html") ||
                path.startsWith("/api/v1/auth/authenticate") ||
                path.startsWith("/api/v1/auth/setup-status") ||
                path.startsWith("/api/v1/auth/setup") ||
                path.startsWith("/css/") ||
                path.startsWith("/js/") ||
                path.startsWith("/images/") ||
                path.endsWith(".js") ||
                path.endsWith(".css") ||
                path.equals("/favicon.ico");
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        final String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        final String jwt = authHeader.substring(7);
        try {
            final String userEmail = jwtService.extractUsername(jwt);
            if (userEmail != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                UserDetails userDetails = this.userDetailsService.loadUserByUsername(userEmail);

                if (userDetails instanceof UserPrincipal userPrincipal) {
                    if (jwtService.isTokenValid(jwt, userPrincipal.getUsername())) {

                        // 1. Validar que la cuenta del usuario no esté desactivada
                        if (!userPrincipal.isEnabled()) {
                            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                            response.setContentType("application/json");
                            response.getWriter().write("{\"error\": \"CUENTA_DESACTIVADA\", \"message\": \"La cuenta de usuario se encuentra desactivada.\"}");
                            return;
                        }

                        // 2. Validar que la empresa/suscripción no haya sido suspendida o vencida en vivo
                        //    (Excluimos la consulta de estado para permitir que el JS arme la alerta)
                        if (!request.getServletPath().contains("/check-status") && !request.getServletPath().contains("/status")) {
                            if (!userPrincipal.isCompanyAccessValid()) {
                                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                                response.setContentType("application/json");
                                response.getWriter().write("{\"error\": \"CUENTA_SUSPENDIDA\", \"message\": \"La suscripción de la empresa está suspendida o vencida.\"}");
                                return;
                            }
                        }

                        UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                                userPrincipal, null, userPrincipal.getAuthorities());

                        authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                        SecurityContextHolder.getContext().setAuthentication(authToken);
                    }
                }
            }
        } catch (Exception e) {
            logger.error("Error en validación de JWT: " + e.getMessage());
        }
        filterChain.doFilter(request, response);
    }
}