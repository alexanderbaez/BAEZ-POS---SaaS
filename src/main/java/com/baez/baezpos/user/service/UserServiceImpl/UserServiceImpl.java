package com.baez.baezpos.user.service.UserServiceImpl;

import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.company.repository.CompanyRepository;
import com.baez.baezpos.user.dto.UserRequestDTO;
import com.baez.baezpos.user.dto.UserResponseDTO;
import com.baez.baezpos.user.entity.Role;
import com.baez.baezpos.user.entity.User;
import com.baez.baezpos.user.repository.UserRepository;
import com.baez.baezpos.user.service.UserService.UserService;
import com.baez.baezpos.shared.exception.BadRequestException;
import com.baez.baezpos.shared.exception.ResourceNotFoundException;
import com.baez.baezpos.security.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final CompanyRepository companyRepository;

    @Override
    @Transactional
    public UserResponseDTO createUser(UserRequestDTO dto) {
        Role currentUserRole = SecurityUtils.getCurrentUserRole();
        if (currentUserRole == null) {
            String currentEmail = SecurityUtils.getCurrentUserEmail();
            if (currentEmail != null) {
                User current = userRepository.findByEmail(currentEmail).orElse(null);
                if (current != null) currentUserRole = current.getRole();
            }
        }

        // Un ADMIN no puede crear otro ADMIN ni un SUPER_ADMIN
        if (currentUserRole == Role.ADMIN && 
           (dto.getRole() == Role.ADMIN || dto.getRole() == Role.SUPER_ADMIN)) {
            throw new AccessDeniedException("Violaci\u00F3n de seguridad: No puedes crear usuarios con privilegios iguales o superiores.");
        }

        Long companyId = SecurityUtils.getCurrentCompanyId();
        String cleanEmail = dto.getEmail().trim().toLowerCase();
        Role targetRole = validateRoleAssignment(dto.getRole());

        Optional<User> existingUserOpt = userRepository.findByEmail(cleanEmail);

        if (existingUserOpt.isPresent()) {
            User existingUser = existingUserOpt.get();

            if (Boolean.TRUE.equals(existingUser.getActive())) {
                throw new IllegalArgumentException("El email '" + cleanEmail + "' ya pertenece a un usuario activo.");
            }

            // Bloquear reasignaci\u00F3n de tenants: Queda prohibido cambiar el company_id de un usuario inactivo
            Long existingCompanyId = (existingUser.getCompany() != null) ? existingUser.getCompany().getId() : null;

            if (!Objects.equals(companyId, existingCompanyId)) {
                throw new IllegalArgumentException("El email '" + cleanEmail + "' se encuentra registrado en otra empresa o no pertenece a su tenant.");
            }

            if (companyId != null) {
                Company company = companyRepository.findById(companyId)
                        .orElseThrow(() -> new ResourceNotFoundException("Empresa no encontrada"));
                int maxEmployees = company.getMaxEmployees() != null ? company.getMaxEmployees() : 1;
                long activeEmployees = userRepository.countByCompanyIdAndActiveTrue(companyId);
                if (activeEmployees >= maxEmployees) {
                    throw new BadRequestException("L\u00EDmite de empleados alcanzado en su plan actual. Comun\u00EDquese con soporte para actualizar su suscripci\u00F3n.");
                }
            }

            log.info("Reactivando usuario previamente inactivo: {} para empresa ID: {}", cleanEmail, companyId);
            existingUser.setName(dto.getName());
            existingUser.setRole(targetRole);

            if (dto.getPassword() != null && !dto.getPassword().trim().isEmpty()) {
                if (dto.getPassword().trim().length() < 6) {
                    throw new IllegalArgumentException("La contrase\u00F1a debe tener al menos 6 caracteres.");
                }
                existingUser.setPassword(passwordEncoder.encode(dto.getPassword()));
            }

            if (dto.getSecurityPin() != null) {
                if (dto.getSecurityPin().trim().isEmpty()) {
                    existingUser.setSecurityPin(null);
                } else {
                    existingUser.setSecurityPin(passwordEncoder.encode(dto.getSecurityPin().trim()));
                }
            }

            existingUser.setActive(true);
            return convertToDTO(userRepository.save(existingUser));
        }

        if (companyId != null) {
            Company company = companyRepository.findById(companyId)
                    .orElseThrow(() -> new ResourceNotFoundException("Empresa no encontrada"));
            int maxEmployees = company.getMaxEmployees() != null ? company.getMaxEmployees() : 1;
            long activeEmployees = userRepository.countByCompanyIdAndActiveTrue(companyId);
            if (activeEmployees >= maxEmployees) {
                throw new BadRequestException("L\u00EDmite de empleados alcanzado en su plan actual. Comun\u00EDquese con soporte para actualizar su suscripci\u00F3n.");
            }
        }

        User user = new User();
        user.setName(dto.getName());
        user.setEmail(cleanEmail);

        if (dto.getPassword() == null || dto.getPassword().trim().length() < 6) {
            throw new IllegalArgumentException("Debe proporcionar una contrase\u00F1a v\u00E1lida de al menos 6 caracteres.");
        }
        user.setPassword(passwordEncoder.encode(dto.getPassword()));
        user.setRole(targetRole);
        user.setActive(true);

        if (dto.getSecurityPin() != null && !dto.getSecurityPin().trim().isEmpty()) {
            user.setSecurityPin(passwordEncoder.encode(dto.getSecurityPin().trim()));
        }

        if (companyId != null) {
            Company company = companyRepository.findById(companyId)
                    .orElseThrow(() -> new ResourceNotFoundException("Empresa no encontrada"));
            user.setCompany(company);
        }

        log.info("Registrando nuevo usuario: {} con rol {} asociado a la empresa ID: {}", user.getEmail(), targetRole, companyId);
        return convertToDTO(userRepository.save(user));
    }

    @Override
    @Transactional(readOnly = true)
    public UserResponseDTO getUserById(Long id) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        if (companyId != null) {
            return userRepository.findByIdAndCompanyIdAndActiveTrue(id, companyId)
                    .map(this::convertToDTO)
                    .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado o no pertenece a su empresa."));
        }

        return userRepository.findById(id)
                .filter(u -> Boolean.TRUE.equals(u.getActive()))
                .map(this::convertToDTO)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado con ID: " + id));
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserResponseDTO> getAllUsers() {
        Long companyId = SecurityUtils.getCurrentCompanyId();

        if (companyId != null) {
            return userRepository.findByCompanyIdAndActiveTrue(companyId).stream()
                    .map(this::convertToDTO)
                    .collect(Collectors.toList());
        }

        return userRepository.findByActiveTrue().stream()
                    .map(this::convertToDTO)
                    .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public Page<UserResponseDTO> getAllUsers(Pageable pageable) {
        Long companyId = SecurityUtils.getCurrentCompanyId();

        Page<User> page = (companyId != null)
                ? userRepository.findByCompanyIdAndActiveTrue(companyId, pageable)
                : userRepository.findByActiveTrue(pageable);

        return page.map(this::convertToDTO);
    }

    @Override
    @Transactional
    public UserResponseDTO updateUser(Long id, UserRequestDTO dto) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        User existing = (companyId != null) ?
                userRepository.findByIdAndCompanyIdAndActiveTrue(id, companyId)
                        .orElseThrow(() -> new IllegalArgumentException("No autorizado o usuario inactivo")) :
                userRepository.findById(id)
                        .filter(u -> Boolean.TRUE.equals(u.getActive()))
                        .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado o inactivo"));

        Role currentUserRole = SecurityUtils.getCurrentUserRole();
        if (currentUserRole == null) {
            String currentEmail = SecurityUtils.getCurrentUserEmail();
            if (currentEmail != null) {
                User current = userRepository.findByEmail(currentEmail).orElse(null);
                if (current != null) currentUserRole = current.getRole();
            }
        }

        // Control de degradaci\u00F3n de Admin a Vendedor (Anti Self-Lockout)
        if (existing.getRole() == Role.ADMIN && dto.getRole() == Role.VENDEDOR) {
            throw new IllegalStateException("Protecci\u00F3n del sistema: No puedes degradar la cuenta del Administrador a Vendedor.");
        }

        // Control de escalada de privilegios de Vendedor a Admin por un Admin regular
        if (existing.getRole() == Role.VENDEDOR && 
           (dto.getRole() == Role.ADMIN || dto.getRole() == Role.SUPER_ADMIN) && 
           currentUserRole != Role.SUPER_ADMIN) {
            throw new AccessDeniedException("Violaci\u00F3n de seguridad: No puedes crear o actualizar usuarios con privilegios iguales o superiores.");
        }

        String cleanEmail = dto.getEmail().trim().toLowerCase();
        // Validar si intenta cambiar el email por uno que ya existe en el sistema
        if (!existing.getEmail().equalsIgnoreCase(cleanEmail)) {
            if (userRepository.existsByEmail(cleanEmail)) {
                throw new IllegalArgumentException("El email '" + cleanEmail + "' ya est\u00E1 registrado por otro usuario.");
            }
            existing.setEmail(cleanEmail);
        }

        existing.setName(dto.getName());
        if (dto.getRole() != null) {
            if (existing.getRole() == dto.getRole()) {
                existing.setRole(dto.getRole());
            } else {
                Role targetRole = validateRoleAssignment(dto.getRole());
                existing.setRole(targetRole);
            }
        }

        if (dto.getPassword() != null && !dto.getPassword().trim().isEmpty()) {
            if (dto.getPassword().trim().length() < 6) {
                throw new IllegalArgumentException("La contrase\u00F1a debe tener al menos 6 caracteres.");
            }
            existing.setPassword(passwordEncoder.encode(dto.getPassword()));
        }

        if (dto.getSecurityPin() != null) {
            if (dto.getSecurityPin().trim().isEmpty()) {
                existing.setSecurityPin(null);
            } else {
                existing.setSecurityPin(passwordEncoder.encode(dto.getSecurityPin().trim()));
            }
        }

        return convertToDTO(userRepository.save(existing));
    }

    @Override
    @Transactional
    public void deleteUser(Long id) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        User existing = (companyId != null) ?
                userRepository.findByIdAndCompanyId(id, companyId)
                        .orElseThrow(() -> new IllegalArgumentException("No autorizado")) :
                userRepository.findById(id)
                        .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));

        existing.setActive(false);
        userRepository.save(existing);
        log.warn("Usuario desactivado ID: {}", id);
    }

    @Override
    @Transactional
    public void updatePasswordOnly(String email, String newPassword) {
        if (newPassword == null || newPassword.trim().length() < 6) {
            throw new IllegalArgumentException("La nueva contrase\u00F1a debe tener al menos 6 caracteres.");
        }
        User user = userRepository.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));
        user.setPassword(passwordEncoder.encode(newPassword));
        user.setPasswordResetAt(null);
        userRepository.save(user);
    }

    @Override
    @Transactional(readOnly = true)
    public String validateSupervisorPin(String requestPin) {
        if (requestPin == null || requestPin.trim().isEmpty()) {
            System.out.println("AUDIT: PIN recibido vac\u00EDo o nulo.");
            return "AUDIT_ERROR: PIN recibido vac\u00EDo o nulo.";
        }

        String rawPin = requestPin.trim();
        String currentEmail = SecurityUtils.getCurrentUserEmail();
        User currentUser = null;
        if (currentEmail != null) {
            currentUser = userRepository.findByEmail(currentEmail).orElse(null);
        }

        // 1. \u00BFEl vendedor (o usuario actual) tiene su propio PIN asignado y coincide?
        if (currentUser != null && currentUser.getSecurityPin() != null && !currentUser.getSecurityPin().trim().isEmpty()) {
            String userStoredPin = currentUser.getSecurityPin().trim();
            boolean matches = false;
            if (userStoredPin.equals(rawPin)) {
                matches = true;
            } else {
                try {
                    matches = passwordEncoder.matches(rawPin, userStoredPin);
                } catch (Exception ignored) {
                    matches = false;
                }
            }
            if (matches) {
                return "OK";
            }
        }

        // 2. Si no es el del vendedor, buscar si es el PIN Maestro del ADMIN del local
        Long companyId = (currentUser != null && currentUser.getCompany() != null)
                ? currentUser.getCompany().getId()
                : SecurityUtils.getCurrentCompanyId();

        List<User> companyUsers = (companyId != null)
                ? userRepository.findByCompanyId(companyId)
                : userRepository.findAll();

        for (User user : companyUsers) {
            if (user.getRole() == Role.ADMIN && user.getSecurityPin() != null && !user.getSecurityPin().trim().isEmpty()) {
                String storedPin = user.getSecurityPin().trim();
                boolean matches = false;
                if (storedPin.equals(rawPin)) {
                    matches = true;
                } else {
                    try {
                        matches = passwordEncoder.matches(rawPin, storedPin);
                    } catch (Exception ignored) {
                        matches = false;
                    }
                }
                if (matches) {
                    return "OK";
                }
            }
        }

        String errorMsg = "AUDIT_ERROR: El PIN ingresado no coincide con el del Vendedor ni con el del Administrador.";
        System.out.println("AUDIT: " + errorMsg);
        return errorMsg;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean validatePin(String pin) {
        return "OK".equals(validateSupervisorPin(pin));
    }

    private Role validateRoleAssignment(Role requestedRole) {
        Role currentUserRole = SecurityUtils.getCurrentUserRole();
        if (currentUserRole == null) {
            String currentEmail = SecurityUtils.getCurrentUserEmail();
            if (currentEmail != null) {
                User current = userRepository.findByEmail(currentEmail).orElse(null);
                if (current != null) currentUserRole = current.getRole();
            }
        }

        boolean isSuperAdmin = currentUserRole == Role.SUPER_ADMIN;

        if (currentUserRole == Role.ADMIN && 
           (requestedRole == Role.ADMIN || requestedRole == Role.SUPER_ADMIN)) {
            throw new AccessDeniedException("Violaci\u00F3n de seguridad: No puedes crear usuarios con privilegios iguales o superiores.");
        }

        if (requestedRole == Role.SUPER_ADMIN && !isSuperAdmin) {
            throw new AccessDeniedException("Violaci\u00F3n de seguridad: No puedes crear usuarios con privilegios iguales o superiores.");
        }

        if (!isSuperAdmin) {
            if (requestedRole != null && requestedRole != Role.VENDEDOR) {
                throw new AccessDeniedException("Violaci\u00F3n de seguridad: No puedes crear usuarios con privilegios iguales o superiores.");
            }
            return requestedRole != null ? requestedRole : Role.VENDEDOR;
        }

        return requestedRole != null ? requestedRole : Role.VENDEDOR;
    }

    private UserResponseDTO convertToDTO(User user) {
        return UserResponseDTO.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .role(user.getRole())
                .active(user.getActive())
                .securityPin(user.getSecurityPin())
                .build();
    }
}