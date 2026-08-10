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
    private boolean companyActive;
    private LocalDate companyExpirationDate;
    private Role role; // Guardamos el Enum directamente para chequeos limpios
    private Collection<? extends GrantedAuthority> authorities;

    public static UserPrincipal create(User user) {
        Long companyId = (user.getCompany() != null) ? user.getCompany().getId() : null;

        boolean companyActive = true;
        LocalDate expirationDate = null;

        // Evaluar estado de empresa solo si NO es SuperAdmin y la empresa existe
        if (user.getRole() != Role.SUPER_ADMIN && user.getCompany() != null) {
            companyActive = Boolean.TRUE.equals(user.getCompany().getActive());
            expirationDate = user.getCompany().getExpirationDate();
        }

        return new UserPrincipal(
                user.getId(),
                user.getEmail(),
                user.getPassword(),
                Boolean.TRUE.equals(user.getActive()),
                companyId,
                companyActive,
                expirationDate,
                user.getRole(),
                Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()))
        );
    }

    /**
     * Comprobación de vigencia de la suscripción/licencia.
     * Retorna true si es SuperAdmin, o si la empresa está activa y no vencida.
     */
    public boolean isCompanyAccessValid() {
        // 1. SuperAdmin siempre tiene acceso válido
        if (this.role == Role.SUPER_ADMIN || this.companyId == null) {
            return true;
        }

        // 2. Si la empresa fue inhabilitada explícitamente
        if (!this.companyActive) {
            return false;
        }

        // 3. Si la fecha de vencimiento existe y ya transcurrió
        if (this.companyExpirationDate != null && LocalDate.now().isAfter(this.companyExpirationDate)) {
            return false;
        }

        return true;
    }

    @Override public String getUsername() { return email; }
    @Override public String getPassword() { return password; }
    @Override public boolean isAccountNonExpired() { return true; }
    @Override public boolean isAccountNonLocked() { return true; }
    @Override public boolean isCredentialsNonExpired() { return true; }
    @Override public boolean isEnabled() { return enabled; }
}