package com.baez.baezpos.security.service;

import com.baez.baezpos.security.entity.UserPrincipal;
import com.baez.baezpos.user.entity.User;
import com.baez.baezpos.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        // Normalizaci\u00F3n defensiva: garantiza b\u00FAsqueda insensible a may\u00FAsculas/espacios
        // independientemente del origen del token o del AuthenticationManager.
        String normalizedEmail = (email != null) ? email.trim().toLowerCase() : "";
        User user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new UsernameNotFoundException("Usuario no encontrado con email: " + normalizedEmail));

        return UserPrincipal.create(user);
    }
}