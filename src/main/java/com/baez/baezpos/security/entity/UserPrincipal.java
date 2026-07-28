package com.baez.baezpos.security.entity;

import com.baez.baezpos.user.entity.User;
import com.baez.baezpos.user.entity.Role;
import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.LocalDate;
import java.util.Collection;
import java.util.Collections;

@Getter
@AllArgsConstructor
public class UserPrincipal implements UserDetails {
    private Long id;
    private String email;
    private String password;
    private boolean enabled;
    private Long companyId;
    private boolean companyActive; // <-- NUEVO: Para validar en cada petición
    private LocalDate companyExpirationDate; // <-- NUEVO
    private Collection<? extends GrantedAuthority> authorities;

    public static UserPrincipal create(User user) {
        Long companyId = (user.getCompany() != null) ? user.getCompany().getId() : null;

        boolean companyActive = true;
        LocalDate expirationDate = null;

        // Si no es SuperAdmin, evaluamos el estado de su empresa asociada
        if (user.getRole() != Role.SUPER_ADMIN && user.getCompany() != null) {
            companyActive = Boolean.TRUE.equals(user.getCompany().getActive());
            expirationDate = user.getCompany().getExpirationDate();
        }

        return new UserPrincipal(
                user.getId(),
                user.getEmail(),
                user.getPassword(),
                user.getActive(),
                companyId,
                companyActive,
                expirationDate,
                Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()))
        );
    }

    // Método de comprobación integral de acceso activo
    public boolean isCompanyAccessValid() {
        if (companyId == null) return true; // SuperAdmin pasa directo
        if (!companyActive) return false;
        if (companyExpirationDate != null && LocalDate.now().isAfter(companyExpirationDate)) return false;
        return true;
    }

    @Override public String getUsername() { return email; }
    @Override public String getPassword() { return password; }
    @Override public boolean isAccountNonExpired() { return true; }
    @Override public boolean isAccountNonLocked() { return true; }
    @Override public boolean isCredentialsNonExpired() { return true; }
    @Override public boolean isEnabled() { return enabled; }
}