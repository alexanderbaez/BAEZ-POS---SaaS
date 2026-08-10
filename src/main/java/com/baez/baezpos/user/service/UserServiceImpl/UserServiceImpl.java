package com.baez.baezpos.user.service.UserServiceImpl;

import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.company.repository.CompanyRepository;
import com.baez.baezpos.user.dto.UserRequestDTO;
import com.baez.baezpos.user.dto.UserResponseDTO;
import com.baez.baezpos.user.entity.Role;
import com.baez.baezpos.user.entity.User;
import com.baez.baezpos.user.repository.UserRepository;
import com.baez.baezpos.user.service.UserService.UserService;
import com.baez.baezpos.security.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
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
        Optional<User> existingUserOpt = userRepository.findByEmail(dto.getEmail());

        if (existingUserOpt.isPresent()) {
            User existingUser = existingUserOpt.get();

            // Si el usuario ya está activo, no permitimos duplicados.
            if (Boolean.TRUE.equals(existingUser.getActive())) {
                throw new IllegalArgumentException("El email '" + dto.getEmail() + "' ya pertenece a un usuario activo.");
            }

            // OPCIÓN 1: Reactivar el usuario existente
            log.info("Reactivando usuario previamente inactivo: {} para la empresa ID: {}", dto.getEmail(), companyId);
            existingUser.setName(dto.getName());
            existingUser.setRole(dto.getRole() != null ? dto.getRole() : Role.VENDEDOR);

            if (dto.getPassword() != null && !dto.getPassword().trim().isEmpty()) {
                existingUser.setPassword(passwordEncoder.encode(dto.getPassword()));
            }

            if (companyId != null) {
                Company company = companyRepository.findById(companyId)
                        .orElseThrow(() -> new IllegalArgumentException("Empresa no encontrada"));
                existingUser.setCompany(company);
            }

            existingUser.setActive(true);
            return convertToDTO(userRepository.save(existingUser));
        }

        // Si no existe, crear un nuevo usuario desde cero
        User user = new User();
        user.setName(dto.getName());
        user.setEmail(dto.getEmail());
        user.setPassword(passwordEncoder.encode(dto.getPassword()));
        user.setRole(dto.getRole() != null ? dto.getRole() : Role.VENDEDOR);
        user.setActive(true);

        if (companyId != null) {
            Company company = companyRepository.findById(companyId)
                    .orElseThrow(() -> new IllegalArgumentException("Empresa no encontrada"));
            user.setCompany(company);
        }

        log.info("Registrando nuevo usuario: {} asociado a la empresa ID: {}", user.getEmail(), companyId);
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

        existing.setName(dto.getName());
        if (dto.getRole() != null) {
            existing.setRole(dto.getRole());
        }
        existing.setEmail(dto.getEmail());

        if (dto.getPassword() != null && !dto.getPassword().trim().isEmpty()) {
            existing.setPassword(passwordEncoder.encode(dto.getPassword()));
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
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));
        user.setPassword(passwordEncoder.encode(newPassword));
        user.setPasswordResetAt(null);
        userRepository.save(user);
    }

    private UserResponseDTO convertToDTO(User user) {
        return UserResponseDTO.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .role(user.getRole())
                .active(user.getActive())
                .build();
    }
}