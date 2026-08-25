package com.baez.baezpos.security;

import com.baez.baezpos.security.entity.UserPrincipal;
import com.baez.baezpos.user.entity.Role;
import com.baez.baezpos.user.entity.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.security.Key;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

@Service
public class JwtService {

    @Value("${application.security.jwt.secret-key}")
    private String secretKey;

    @Value("${application.security.jwt.expiration:86400000}")
    private long jwtExpiration;

    @PostConstruct
    public void validateSecretKey() {
        if (secretKey == null || secretKey.trim().length() < 32) {
            throw new IllegalStateException("La clave secreta JWT (application.security.jwt.secret-key) no está configurada o tiene menos de 32 caracteres.");
        }
    }

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public Long extractCompanyId(String token) {
        return extractClaim(token, claims -> {
            Object companyIdObj = claims.get("companyId");
            if (companyIdObj instanceof Number number) {
                return number.longValue();
            }
            return null;
        });
    }

    public UserPrincipal extractUserPrincipal(String token) {
        Claims claims = extractAllClaims(token);
        String email = claims.getSubject();
        return UserPrincipal.fromClaims(claims, email);
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    public String generateToken(User user) {
        Map<String, Object> claims = new HashMap<>();

        claims.put("authorities", List.of("ROLE_" + user.getRole().name()));
        claims.put("role", user.getRole().name());
        claims.put("userId", user.getId());
        claims.put("enabled", Boolean.TRUE.equals(user.getActive()));

        if (user.getRole() != com.baez.baezpos.user.entity.Role.SUPER_ADMIN && user.getCompany() != null) {
            claims.put("companyId", user.getCompany().getId());
            claims.put("companyActive", Boolean.TRUE.equals(user.getCompany().getActive()));
            if (user.getCompany().getExpirationDate() != null) {
                claims.put("companyExpirationDate", user.getCompany().getExpirationDate().toString());
            }
        }

        return Jwts.builder()
                .setClaims(claims)
                .setSubject(user.getEmail())
                .setIssuedAt(new Date(System.currentTimeMillis()))
                .setExpiration(new Date(System.currentTimeMillis() + jwtExpiration))
                .signWith(getSignInKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    public boolean isTokenValid(String token, String userEmail) {
        final String username = extractUsername(token);
        return (username.equalsIgnoreCase(userEmail)) && !isTokenExpired(token);
    }

    private boolean isTokenExpired(String token) {
        return extractClaim(token, Claims::getExpiration).before(new Date());
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getSignInKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    private Key getSignInKey() {
        byte[] keyBytes = Decoders.BASE64.decode(secretKey);
        return Keys.hmacShaKeyFor(keyBytes);
    }
}