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
        Long companyId = SecurityUtils.getCurrentCompanyId();
        String cleanEmail = dto.getEmail().trim().toLowerCase();
        Role targetRole = validateRoleAssignment(dto.getRole());

        Optional<User> existingUserOpt = userRepository.findByEmail(cleanEmail);

        if (existingUserOpt.isPresent()) {
            User existingUser = existingUserOpt.get();

            if (Boolean.TRUE.equals(existingUser.getActive())) {
                throw new IllegalArgumentException("El email '" + cleanEmail + "' ya pertenece a un usuario activo.");
            }

            // Bloquear reasignación de tenants: Queda prohibido cambiar el company_id de un usuario inactivo
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
                    throw new BadRequestException("Límite de empleados alcanzado en su plan actual. Comuníquese con soporte para actualizar su suscripción.");
                }
            }

            log.info("Reactivando usuario previamente inactivo: {} para empresa ID: {}", cleanEmail, companyId);
            existingUser.setName(dto.getName());
            existingUser.setRole(targetRole);

            if (dto.getPassword() != null && !dto.getPassword().trim().isEmpty()) {
                if (dto.getPassword().trim().length() < 6) {
                    throw new IllegalArgumentException("La contraseña debe tener al menos 6 caracteres.");
                }
                existingUser.setPassword(passwordEncoder.encode(dto.getPassword()));
            }

            if (dto.getSecurityPin() != null) {
                existingUser.setSecurityPin(dto.getSecurityPin().trim().isEmpty() ? null : dto.getSecurityPin().trim());
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
                throw new BadRequestException("Límite de empleados alcanzado en su plan actual. Comuníquese con soporte para actualizar su suscripción.");
            }
        }

        User user = new User();
        user.setName(dto.getName());
        user.setEmail(cleanEmail);

        if (dto.getPassword() == null || dto.getPassword().trim().length() < 6) {
            throw new IllegalArgumentException("Debe proporcionar una contraseña válida de al menos 6 caracteres.");
        }
        user.setPassword(passwordEncoder.encode(dto.getPassword()));
        user.setRole(targetRole);
        user.setActive(true);

        if (dto.getSecurityPin() != null && !dto.getSecurityPin().trim().isEmpty()) {
            user.setSecurityPin(dto.getSecurityPin().trim());
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
    @Transactional
    public UserResponseDTO updateUser(Long id, UserRequestDTO dto) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        User existing = (companyId != null) ?
                userRepository.findByIdAndCompanyIdAndActiveTrue(id, companyId)
                        .orElseThrow(() -> new IllegalArgumentException("No autorizado o usuario inactivo")) :
                userRepository.findById(id)
                        .filter(u -> Boolean.TRUE.equals(u.getActive()))
                        .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado o inactivo"));

        String cleanEmail = dto.getEmail().trim().toLowerCase();
        // Validar si intenta cambiar el email por uno que ya existe en el sistema
        if (!existing.getEmail().equalsIgnoreCase(cleanEmail)) {
            if (userRepository.existsByEmail(cleanEmail)) {
                throw new IllegalArgumentException("El email '" + cleanEmail + "' ya está registrado por otro usuario.");
            }
            existing.setEmail(cleanEmail);
        }

        existing.setName(dto.getName());
        if (dto.getRole() != null) {
            Role targetRole = validateRoleAssignment(dto.getRole());
            existing.setRole(targetRole);
        }

        if (dto.getPassword() != null && !dto.getPassword().trim().isEmpty()) {
            if (dto.getPassword().trim().length() < 6) {
                throw new IllegalArgumentException("La contraseña debe tener al menos 6 caracteres.");
            }
            existing.setPassword(passwordEncoder.encode(dto.getPassword()));
        }

        if (dto.getSecurityPin() != null) {
            existing.setSecurityPin(dto.getSecurityPin().trim().isEmpty() ? null : dto.getSecurityPin().trim());
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
            throw new IllegalArgumentException("La nueva contraseña debe tener al menos 6 caracteres.");
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
            System.out.println("AUDIT: PIN recibido vacío o nulo.");
            return "AUDIT_ERROR: PIN recibido vacío o nulo.";
        }

        // 1. Obtener la empresa del empleado logueado
        Long companyId = SecurityUtils.getCurrentCompanyId();
        if (companyId == null) {
            String currentEmail = SecurityUtils.getCurrentUserEmail();
            if (currentEmail != null) {
                User currentUser = userRepository.findByEmail(currentEmail).orElse(null);
                if (currentUser != null && currentUser.getCompany() != null) {
                    companyId = currentUser.getCompany().getId();
                }
            }
        }

        // 2. Traer TODOS los usuarios de esa empresa
        List<User> companyUsers = (companyId != null)
                ? userRepository.findByCompanyId(companyId)
                : userRepository.findAll();

        if (companyUsers == null || companyUsers.isEmpty()) {
            String errorMsg = "AUDIT_ERROR: No se encontraron usuarios para la empresa ID " + companyId;
            System.out.println(errorMsg);
            return errorMsg;
        }

        List<String> rolesFound = companyUsers.stream()
                .map(u -> u.getRole() != null ? u.getRole().name() : "NULL")
                .toList();

        // 3. Filtrar administradores en memoria y comparar
        List<User> adminUsers = new ArrayList<>();
        for (User user : companyUsers) {
            if (user.getRole() != null) {
                String roleName = user.getRole().name().toUpperCase();
                // Detecta cualquier variación de Admin o Supervisor
                if (roleName.contains("ADMIN") || roleName.contains("SUPER")) {
                    adminUsers.add(user);
                }
            }
        }

        if (adminUsers.isEmpty()) {
            String errorMsg = "AUDIT_ERROR: Ningún admin detectado. Roles encontrados: " + rolesFound;
            System.out.println(errorMsg);
            return errorMsg;
        }

        String lastAdminPinDebug = null;
        for (User admin : adminUsers) {
            String storedPin = admin.getSecurityPin();
            if (storedPin != null && !storedPin.trim().isEmpty()) {
                String rawPin = requestPin.trim();
                // Validar texto plano o hash BCrypt
                boolean matches = false;
                if (storedPin.trim().equals(rawPin)) {
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
            lastAdminPinDebug = "AUDIT_ERROR: PIN no coincide. BD tiene PIN nulo? " + (storedPin == null) + ". Longitud PIN bd: " + (storedPin != null ? storedPin.length() : 0);
        }

        String finalError = (lastAdminPinDebug != null)
                ? lastAdminPinDebug
                : "AUDIT_ERROR: Admins encontrados pero ninguno tiene un PIN configurado.";
        System.out.println("AUDIT: " + finalError);
        return finalError;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean validatePin(String pin) {
        return "OK".equals(validateSupervisorPin(pin));
    }

    private Role validateRoleAssignment(Role requestedRole) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean isSuperAdmin = auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_SUPER_ADMIN".equals(a.getAuthority()));

        if (requestedRole == Role.SUPER_ADMIN && !isSuperAdmin) {
            throw new IllegalArgumentException("Acceso denegado: No está autorizado para asignar el rol SUPER_ADMIN.");
        }

        if (!isSuperAdmin) {
            if (requestedRole != null && requestedRole != Role.VENDEDOR && requestedRole != Role.SUPERVISOR) {
                throw new IllegalArgumentException("Los administradores de empresa únicamente pueden crear o asignar usuarios con rol VENDEDOR o SUPERVISOR.");
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