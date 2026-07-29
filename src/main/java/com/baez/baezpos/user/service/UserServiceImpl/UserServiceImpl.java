package com.baez.baezpos.user.service.UserServiceImpl;

import com.baez.baezpos.company.repository.CompanyRepository; // <--- 1. Importar el repositorio de compañía
import com.baez.baezpos.company.entity.Company;             // <--- 1. Importar la entidad Company
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
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final CompanyRepository companyRepository; // <--- 2. Declarar la dependencia

    @Override
    @Transactional
    public UserResponseDTO createUser(UserRequestDTO dto) {
        if (userRepository.existsByEmail(dto.getEmail())) {
            throw new RuntimeException("El email '" + dto.getEmail() + "' ya existe.");
        }

        User user = new User();
        user.setName(dto.getName());
        user.setEmail(dto.getEmail());
        user.setPassword(passwordEncoder.encode(dto.getPassword()));
        user.setRole(dto.getRole() != null ? dto.getRole() : Role.VENDEDOR);
        user.setActive(true);

        // ==========================================
        // CORRECCIÓN MULTI-TENANT: Asignar compañía
        // ==========================================
        Long companyId = SecurityUtils.getCurrentCompanyId();
        if (companyId != null) {
            Company company = companyRepository.findById(companyId)
                    .orElseThrow(() -> new RuntimeException("Empresa no encontrada"));
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
            return userRepository.findByIdAndCompanyId(id, companyId)
                    .map(this::convertToDTO)
                    .orElseThrow(() -> new RuntimeException("Usuario no encontrado o no pertenece a su empresa."));
        }

        return userRepository.findById(id)
                .map(this::convertToDTO)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado con ID: " + id));
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserResponseDTO> getAllUsers() {
        Long companyId = SecurityUtils.getCurrentCompanyId();

        if (companyId != null) {
            return userRepository.findByCompanyId(companyId).stream()
                    .map(this::convertToDTO)
                    .collect(Collectors.toList());
        }

        return userRepository.findAll().stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public UserResponseDTO updateUser(Long id, UserRequestDTO dto) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        User existing = (companyId != null) ?
                userRepository.findByIdAndCompanyId(id, companyId).orElseThrow(() -> new RuntimeException("No autorizado")) :
                userRepository.findById(id).orElseThrow(() -> new RuntimeException("Usuario no encontrado"));

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
                userRepository.findByIdAndCompanyId(id, companyId).orElseThrow(() -> new RuntimeException("No autorizado")) :
                userRepository.findById(id).orElseThrow(() -> new RuntimeException("Usuario no encontrado"));

        existing.setActive(false);
        userRepository.save(existing);
        log.warn("Usuario desactivado ID: {}", id);
    }

    @Override
    @Transactional
    public void updatePasswordOnly(String email, String newPassword) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
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
                .build();
    }
}