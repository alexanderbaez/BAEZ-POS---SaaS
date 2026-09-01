package com.baez.baezpos.security.filter;

import com.baez.baezpos.security.JwtService;
import com.baez.baezpos.security.entity.UserPrincipal;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // Garantizar que las solicitudes preflight CORS pasen sin filtrar
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String path = request.getServletPath();
        if (path == null || path.isEmpty()) {
            path = request.getRequestURI();
        }
        return path.startsWith("/api/v1/auth/") ||
                path.equals("/login") ||
                path.endsWith(".html") ||
                path.endsWith(".js") ||
                path.endsWith(".css");
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
            if (SecurityContextHolder.getContext().getAuthentication() == null) {
                UserPrincipal userPrincipal = jwtService.extractUserPrincipal(jwt);

                if (userPrincipal != null && userPrincipal.getUsername() != null && jwtService.isTokenValid(jwt, userPrincipal.getUsername())) {

                    if (!userPrincipal.isEnabled()) {
                        sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "CUENTA_DESACTIVADA", "La cuenta de usuario se encuentra desactivada.");
                        return;
                    }

                    String path = request.getServletPath();
                    if (path == null || path.isEmpty()) {
                        path = request.getRequestURI();
                    }

                    boolean isStatusOrAuthEndpoint = path.startsWith("/api/v1/auth") ||
                            path.equals("/api/v1/admin/my-company/status") ||
                            path.equals("/api/v1/admin/my-company/check-status") ||
                            path.equals("/api/v1/admin/my-company/profile");

                    if (!userPrincipal.isCompanyAccessValid() && !isStatusOrAuthEndpoint) {
                        sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "CUENTA_SUSPENDIDA", "Su suscripción se encuentra inhabilitada o vencida. Acceso no permitido.");
                        return;
                    }

                    UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                            userPrincipal, null, userPrincipal.getAuthorities());
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
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