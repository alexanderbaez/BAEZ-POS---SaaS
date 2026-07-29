package com.baez.baezpos.company.service.CompanyServiceImpl;

import com.baez.baezpos.company.dto.CompanyDTO;
import com.baez.baezpos.company.dto.MasterRegistrationRequest;
import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.company.repository.CompanyRepository;
import com.baez.baezpos.company.service.CompanyService.CompanyService;
import com.baez.baezpos.log.service.AuditService;
import com.baez.baezpos.user.dto.UserDTO;
import com.baez.baezpos.user.entity.User;
import com.baez.baezpos.user.entity.Role;
import com.baez.baezpos.user.repository.UserRepository;
import com.baez.baezpos.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import com.baez.baezpos.security.util.SecurityUtils;

@Service
@RequiredArgsConstructor
public class CompanyServiceImpl implements CompanyService {

    private final CompanyRepository companyRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;

    private Company getAuthenticatedCompanyEntity() {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        if (companyId == null) {
            throw new ResourceNotFoundException("No se encontró contexto de empresa para el usuario actual");
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

        // Guardamos el nombre viejo para detallarlo en la bitácora
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

        Company savedCompany = companyRepository.save(company);

        // ✅ 2. Registrar el evento en la bitácora del sistema
        try {
            auditService.logAction(
                    "ACTUALIZACIÓN DE PERFIL",
                    "El comercio '" + nombreAntiguo + "' actualizó sus datos de configuración. Nuevo nombre: '" + savedCompany.getName() + "'."
            );
        } catch (Exception e) {
            // Evitamos que falle la actualización principal si el log falla por algún motivo de contexto
            System.err.println("No se pudo registrar el log: " + e.getMessage());
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

        // La empresa está activa SOLO si el flag de la BD es true Y no está vencida
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
            res.put("message", "Tu suscripción/licencia se encuentra vencida.");
        } else {
            res.put("message", "Suscripción activa.");
        }

        return res;
    }

    @Override
    @Transactional
    public UserDTO createEmployee(UserDTO dto) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Empresa no encontrada"));

        User employee = new User();
        employee.setName(dto.getName());
        employee.setEmail(dto.getEmail());
        employee.setPassword(passwordEncoder.encode(dto.getPassword()));
        employee.setRole(Role.VENDEDOR);
        employee.setCompany(company);
        employee.setActive(true);
        return convertToUserDTO(userRepository.save(employee));
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserDTO> getMyEmployees() {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        return userRepository.findByCompanyIdAndRole(companyId, Role.VENDEDOR).stream()
                .map(this::convertToUserDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public UserDTO updateEmployee(Long id, UserDTO dto) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        User employee = userRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Empleado no encontrado"));

        employee.setName(dto.getName());
        employee.setEmail(dto.getEmail());
        if (dto.getPassword() != null && !dto.getPassword().trim().isEmpty()) {
            employee.setPassword(passwordEncoder.encode(dto.getPassword()));
        }
        if (dto.getActive() != null) {
            employee.setActive(dto.getActive());
        }
        return convertToUserDTO(userRepository.save(employee));
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

        dto.setHasTaxData(entity.getHasTaxData() != null ? entity.getHasTaxData() : true);
        dto.setIibb(entity.getIibb());
        dto.setInicioActividades(entity.getInicioActividades());
        dto.setCondicionIva(entity.getCondicionIva());

        return dto;
    }

    private UserDTO convertToUserDTO(User user) {
        UserDTO dto = new UserDTO();
        dto.setId(user.getId());
        dto.setName(user.getName());
        dto.setEmail(user.getEmail());
        dto.setRole(user.getRole().toString());
        dto.setActive(user.getActive());
        return dto;
    }
}