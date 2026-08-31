package com.baez.baezpos.company.service.CompanyServiceImpl;

import com.baez.baezpos.company.dto.CompanyDTO;
import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.company.repository.CompanyRepository;
import com.baez.baezpos.company.service.CompanyService.CompanyService;
import com.baez.baezpos.log.service.AuditService;
import com.baez.baezpos.mail.service.EmailService;
import com.baez.baezpos.user.dto.UserRequestDTO;
import com.baez.baezpos.user.dto.UserResponseDTO;
import com.baez.baezpos.user.entity.Role;
import com.baez.baezpos.user.entity.User;
import com.baez.baezpos.user.repository.UserRepository;
import com.baez.baezpos.shared.exception.ResourceNotFoundException;
import com.baez.baezpos.shared.exception.BadRequestException;
import com.baez.baezpos.security.util.SecurityUtils;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class CompanyServiceImpl implements CompanyService {

    private final CompanyRepository companyRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;
    private final EmailService emailService;

    private Company getAuthenticatedCompanyEntity() {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        if (companyId == null) {
            throw new ResourceNotFoundException("No se encontrÃ³ contexto de empresa para el usuario actual");
        }
        return companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Empresa no encontrada"));
    }

    @Override
    @Transactional(readOnly = true)
    public CompanyDTO getAuthenticatedCompany() {
        return convertToDTOClient(getAuthenticatedCompanyEntity());
    }

    @Override
    @Transactional
    public CompanyDTO updateAuthenticatedCompany(CompanyDTO dto) {
        Company company = getAuthenticatedCompanyEntity();
        String nombreAntiguo = company.getName();

        company.setName(dto.getName());
        company.setAddress(dto.getAddress());
        company.setPhone(dto.getPhone());
        company.setEmail(dto.getEmail());
        company.setTaxId(dto.getTaxId());
        company.setTicketMessage(dto.getTicketMessage());

        company.setHasTaxData(dto.getHasTaxData() != null ? dto.getHasTaxData() : true);
        company.setIibb(dto.getIibb());
        company.setInicioActividades(dto.getInicioActividades());
        company.setCondicionIva(dto.getCondicionIva());

        if (company.getVersion() == null) {
            company.setVersion(0L);
        }

        Company savedCompany = companyRepository.save(company);

        try {
            auditService.logAction(
                    "ACTUALIZACIÃ“N DE PERFIL",
                    "El comercio '" + nombreAntiguo + "' actualizÃ³ sus datos de configuraciÃ³n. Nuevo nombre: '" + savedCompany.getName() + "'."
            );
        } catch (Exception e) {
            log.warn("No se pudo registrar el log de auditorÃ­a: {}", e.getMessage());
        }

        return convertToDTOClient(savedCompany);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> verificarEstadoSuscripcionAutenticada() {
        Company company = getAuthenticatedCompanyEntity();
        LocalDate hoy = LocalDate.now();

        boolean isExpired = company.getExpirationDate() != null && hoy.isAfter(company.getExpirationDate());
        boolean isManualActive = Boolean.TRUE.equals(company.getActive());
        boolean isActive = isManualActive && !isExpired;

        long diasRestantes = 0;
        if (company.getExpirationDate() != null) {
            diasRestantes = java.time.temporal.ChronoUnit.DAYS.between(hoy, company.getExpirationDate());
        }

        Map<String, Object> res = new HashMap<>();
        res.put("companyName", company.getName());
        res.put("vencido", isExpired);
        res.put("active", isActive);
        res.put("diasRestantes", diasRestantes);
        res.put("expirationDate", company.getExpirationDate() != null ? company.getExpirationDate().toString() : "N/A");

        if (!isManualActive) {
            res.put("message", "Su cuenta ha sido inhabilitada por el administrador del sistema.");
        } else if (isExpired) {
            res.put("message", "Tu suscripciÃ³n/licencia se encuentra vencida.");
        } else {
            res.put("message", "SuscripciÃ³n activa.");
        }

        return res;
    }

    @Override
    @Transactional
    public UserResponseDTO createEmployee(UserRequestDTO dto) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Empresa no encontrada"));

        int maxEmployees = company.getMaxEmployees() != null ? company.getMaxEmployees() : 1;
        long activeEmployees = userRepository.countByCompanyIdAndActiveTrue(companyId);
        if (activeEmployees >= maxEmployees) {
            throw new BadRequestException("LÃ­mite de empleados alcanzado en su plan actual. ComunÃ­quese con soporte para actualizar su suscripciÃ³n.");
        }

        if (userRepository.existsByEmail(dto.getEmail())) {
            throw new IllegalArgumentException("El email '" + dto.getEmail() + "' ya se encuentra registrado.");
        }

        if (dto.getPassword() == null || dto.getPassword().trim().length() < 6) {
            throw new IllegalArgumentException("Debe proporcionar una contraseÃ±a vÃ¡lida de al menos 6 caracteres para el empleado.");
        }

        User employee = new User();
        employee.setName(dto.getName());
        employee.setEmail(dto.getEmail());
        employee.setPassword(passwordEncoder.encode(dto.getPassword()));
        employee.setRole(Role.VENDEDOR);
        employee.setCompany(company);
        employee.setActive(true);

        User savedEmployee = userRepository.save(employee);

        // EnvÃ­o de correo de bienvenida
        try {
            emailService.enviarMailBienvenida(
                    savedEmployee.getEmail(),
                    company.getName(),
                    savedEmployee.getName(),
                    dto.getPassword()
            );
        } catch (Exception e) {
            log.error("Error al enviar email al vendedor {}: {}", savedEmployee.getEmail(), e.getMessage());
        }

        return convertToUserResponseDTO(savedEmployee);
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserResponseDTO> getMyEmployees() {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        return userRepository.findByCompanyIdAndRole(companyId, Role.VENDEDOR).stream()
                .map(this::convertToUserResponseDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public UserResponseDTO updateEmployee(Long id, UserRequestDTO dto) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        User employee = userRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Empleado no encontrado o no pertenece a su empresa."));

        // Validar duplicado si intenta cambiar el email
        if (!employee.getEmail().equalsIgnoreCase(dto.getEmail())) {
            if (userRepository.existsByEmail(dto.getEmail())) {
                throw new IllegalArgumentException("El email '" + dto.getEmail() + "' ya estÃ¡ registrado por otro usuario.");
            }
            employee.setEmail(dto.getEmail());
        }

        employee.setName(dto.getName());

        // Si se especifica una nueva contraseÃ±a
        if (dto.getPassword() != null && !dto.getPassword().trim().isEmpty()) {
            if (dto.getPassword().trim().length() < 6) {
                throw new IllegalArgumentException("La contraseÃ±a debe tener al menos 6 caracteres.");
            }
            employee.setPassword(passwordEncoder.encode(dto.getPassword()));
            try {
                emailService.enviarMailResetPassword(
                        employee.getEmail(),
                        employee.getName(),
                        dto.getPassword()
                );
            } catch (Exception e) {
                log.error("Error al notificar nueva contraseÃ±a al vendedor {}: {}", employee.getEmail(), e.getMessage());
            }
        }

        return convertToUserResponseDTO(userRepository.save(employee));
    }

    @Override
    @Transactional
    public void deleteEmployee(Long id) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        User employee = userRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Empleado no encontrado"));
        employee.setActive(false);
        userRepository.save(employee);
    }

    @Override
    public void validarAcceso(Long id) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Empresa no encontrada"));
        if (!Boolean.TRUE.equals(company.getActive()) || (company.getExpirationDate() != null && LocalDate.now().isAfter(company.getExpirationDate()))) {
            throw new org.springframework.security.access.AccessDeniedException("CUENTA_SUSPENDIDA");
        }
    }

    private CompanyDTO convertToDTOClient(Company entity) {
        CompanyDTO dto = new CompanyDTO();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        dto.setAddress(entity.getAddress());
        dto.setPhone(entity.getPhone());
        dto.setEmail(entity.getEmail());
        dto.setTaxId(entity.getTaxId());
        dto.setTicketMessage(entity.getTicketMessage());
        dto.setExpirationDate(entity.getExpirationDate());
        dto.setActive(entity.getActive());
        dto.setMaxEmployees(entity.getMaxEmployees() != null ? entity.getMaxEmployees() : 1);

        dto.setHasTaxData(entity.getHasTaxData() != null ? entity.getHasTaxData() : true);
        dto.setIibb(entity.getIibb());
        dto.setInicioActividades(entity.getInicioActividades());
        dto.setCondicionIva(entity.getCondicionIva());

        return dto;
    }

    private UserResponseDTO convertToUserResponseDTO(User user) {
        return UserResponseDTO.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .role(user.getRole())
                .active(user.getActive())
                .build();
    }
}