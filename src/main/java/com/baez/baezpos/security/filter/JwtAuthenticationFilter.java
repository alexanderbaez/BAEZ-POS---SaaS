package com.baez.baezpos.security.filter;

import com.baez.baezpos.security.JwtService;
import com.baez.baezpos.security.entity.UserPrincipal;
import com.baez.baezpos.security.service.CustomUserDetailsService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
@Slf4j
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final CustomUserDetailsService userDetailsService;

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

                        // 1. Validar que la cuenta del usuario no esté inhabilitada
                        if (!userPrincipal.isEnabled()) {
                            sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "CUENTA_DESACTIVADA", "La cuenta de usuario se encuentra desactivada.");
                            return;
                        }

                        // 2. Validar suscripción/estado del tenant para métodos de escritura/modificación en el sistema
                        String path = request.getRequestURI();
                        String method = request.getMethod();
                        boolean isMutationOperation = !method.equalsIgnoreCase("GET") && !method.equalsIgnoreCase("OPTIONS");

                        if (!userPrincipal.isCompanyAccessValid() && isMutationOperation && !path.startsWith("/api/v1/auth")) {
                            sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "CUENTA_SUSPENDIDA", "Su suscripción se encuentra inhabilitada o vencida. Operación no permitida.");
                            return;
                        }

                        UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                                userPrincipal, null, userPrincipal.getAuthorities());
                        authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                        SecurityContextHolder.getContext().setAuthentication(authToken);
                    }
                }
            }
        } catch (Exception e) {
            log.error("Error al procesar el token JWT en el filtro: {}", e.getMessage());
        }

        filterChain.doFilter(request, response);
    }

    private void sendJsonError(HttpServletResponse response, int status, String errorCode, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write(String.format("{\"error\": \"%s\", \"message\": \"%s\"}", errorCode, message));
    }
}