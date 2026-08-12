package com.baez.baezpos.company.service.CompanyServiceImpl;

import com.baez.baezpos.company.dto.CompanyDTO;
import com.baez.baezpos.company.dto.MasterRegistrationRequest;
import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.company.repository.CompanyRepository;
import com.baez.baezpos.company.service.CompanyService.MasterAdmin;
import com.baez.baezpos.mail.service.EmailService;
import com.baez.baezpos.user.entity.User;
import com.baez.baezpos.user.entity.Role;
import com.baez.baezpos.user.entity.VerificationToken;
import com.baez.baezpos.user.repository.UserRepository;
import com.baez.baezpos.shared.exception.ResourceNotFoundException;
import com.baez.baezpos.user.repository.VerificationTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class MasterAdminService implements MasterAdmin {

    private final CompanyRepository companyRepository;
    private final UserRepository userRepository;
    private final VerificationTokenRepository tokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;

    @Override
    @Transactional
    public void registerFullBusiness(MasterRegistrationRequest req) {
        if (req.getTaxId() != null && !req.getTaxId().isBlank() && companyRepository.existsByTaxId(req.getTaxId())) {
            throw new IllegalArgumentException("El CUIT/TaxID ya existe en el sistema.");
        }
        if (req.getOwnerEmail() != null && userRepository.existsByEmail(req.getOwnerEmail())) {
            throw new IllegalArgumentException("El correo del dueño ya está registrado.");
        }

        // 1. Crear empresa deshabilitada hasta confirmar email
        Company company = Company.builder()
                .name(req.getCompanyName())
                .taxId(req.getTaxId())
                .address(req.getAddress())
                .phone(req.getPhone())
                .email(req.getOwnerEmail())
                .monthlyFee(req.getMonthlyFee())
                .expirationDate(req.getExpirationDate() != null ? req.getExpirationDate() : LocalDate.now().plusDays(15))
                .active(false) // <--- INACTIVA POR DEFECTO
                .ticketMessage(req.getTicketMessage())
                .build();

        Company savedCompany = companyRepository.save(company);

        // 2. Crear usuario Admin inactivo
        User owner = User.builder()
                .name(req.getOwnerName() != null ? req.getOwnerName() : req.getCompanyName())
                .email(req.getOwnerEmail())
                .password(passwordEncoder.encode(req.getOwnerPassword()))
                .role(Role.ADMIN)
                .company(savedCompany)
                .active(false) // <--- INACTIVO POR DEFECTO
                .build();

        User savedOwner = userRepository.save(owner);

        // 3. Generar token de verificación (Válido por 24 Horas)
        String tokenStr = UUID.randomUUID().toString();
        VerificationToken verificationToken = VerificationToken.builder()
                .token(tokenStr)
                .user(savedOwner)
                .expiryDate(LocalDateTime.now().plusHours(24))
                .build();

        tokenRepository.save(verificationToken);

        // 4. Enviar email de verificación obligatoria
        try {
            String linkActivacion = "https://baezpos.com/api/v1/auth/verify?token=" + tokenStr;
            emailService.enviarMailBienvenida(
                    savedOwner.getEmail(),
                    savedCompany.getName(),
                    savedOwner.getName(),
                    "Por favor confirme su cuenta ingresando al siguiente enlace: " + linkActivacion
            );
        } catch (Exception e) {
            log.error("Fallo crítico al enviar correo de activación a {}: {}", savedOwner.getEmail(), e.getMessage());
            throw new RuntimeException("No se pudo enviar el correo de verificación. Verifique la dirección de email ingresada.");
        }
    }

    @Override
    @Transactional
    public void updateCompanyMaster(Long id, CompanyDTO dto) {
        Company company = companyRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Empresa no encontrada"));

        if (dto.getTaxId() != null && !dto.getTaxId().equals(company.getTaxId())) {
            if (companyRepository.existsByTaxId(dto.getTaxId())) {
                throw new IllegalArgumentException("El CUIT/TaxID ya está registrado en otra empresa.");
            }
            company.setTaxId(dto.getTaxId());
        }

        company.setName(dto.getName());
        company.setAddress(dto.getAddress());
        company.setPhone(dto.getPhone());
        company.setEmail(dto.getEmail());
        company.setMonthlyFee(dto.getMonthlyFee());
        company.setExpirationDate(dto.getExpirationDate());
        company.setActive(dto.getActive());
        company.setTicketMessage(dto.getTicketMessage());

        // Si se envió una nueva clave desde el modal de edición, actualizar el password del Admin
        if (dto.getOwnerPassword() != null && !dto.getOwnerPassword().trim().isEmpty()) {
            resetOwnerPassword(id, dto.getOwnerPassword());
        }

        companyRepository.save(company);
    }

    @Override
    @Transactional
    public void deleteCompanyMaster(Long id) {
        Company company = companyRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Empresa no encontrada"));
        company.setActive(false);
        companyRepository.save(company);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getMasterDashboardStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalCompanies", companyRepository.count());
        stats.put("activeCompanies", companyRepository.countByActiveTrue()); // Consulta directa optimizada
        return stats;
    }

    @Override
    @Transactional
    public void extendSubscriptionMaster(Long id) {
        Company company = companyRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Empresa no encontrada"));
        LocalDate hoy = LocalDate.now();
        LocalDate nuevaFecha = (company.getExpirationDate() == null || company.getExpirationDate().isBefore(hoy))
                ? hoy.plusDays(30) : company.getExpirationDate().plusDays(30);
        company.setExpirationDate(nuevaFecha);
        company.setActive(true);
        companyRepository.save(company);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CompanyDTO> getAllCompaniesMaster() {
        return companyRepository.findAll().stream().map(this::convertToDTOMaster).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void resetOwnerPassword(Long companyId, String newRawPassword) {
        User owner = userRepository.findByCompanyIdAndRole(companyId, Role.ADMIN).stream()
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("No se encontró un administrador para esta empresa"));

        owner.setPassword(passwordEncoder.encode(newRawPassword));
        userRepository.save(owner);

        try {
            emailService.enviarMailResetPassword(
                    owner.getEmail(),
                    owner.getName(),
                    newRawPassword
            );
        } catch (Exception e) {
            log.error("Error al enviar email de reset de password a {}: {}", owner.getEmail(), e.getMessage());
        }
    }

    private CompanyDTO convertToDTOMaster(Company c) {
        return CompanyDTO.builder()
                .id(c.getId())
                .name(c.getName())
                .taxId(c.getTaxId())
                .address(c.getAddress())
                .phone(c.getPhone())
                .email(c.getEmail())
                .monthlyFee(c.getMonthlyFee())
                .expirationDate(c.getExpirationDate())
                .active(c.getActive())
                .ticketMessage(c.getTicketMessage())
                .hasTaxData(c.getHasTaxData())
                .iibb(c.getIibb())
                .inicioActividades(c.getInicioActividades())
                .condicionIva(c.getCondicionIva())
                .build();
    }
}