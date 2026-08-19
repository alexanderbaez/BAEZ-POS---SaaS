package com.baez.baezpos.company.service.CompanyServiceImpl;

import com.baez.baezpos.company.dto.CompanyDTO;
import com.baez.baezpos.company.dto.MasterRegistrationRequest;
import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.company.repository.CompanyRepository;
import com.baez.baezpos.company.service.CompanyService.MasterAdmin;
import com.baez.baezpos.mail.service.EmailService;
import com.baez.baezpos.user.entity.Role;
import com.baez.baezpos.user.entity.User;
import com.baez.baezpos.user.entity.VerificationToken;
import com.baez.baezpos.user.repository.UserRepository;
import com.baez.baezpos.user.repository.VerificationTokenRepository;
import com.baez.baezpos.shared.exception.ResourceNotFoundException;
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
        String cleanEmail = req.getOwnerEmail().trim().toLowerCase();

        if (req.getTaxId() != null && !req.getTaxId().isBlank() && companyRepository.existsByTaxId(req.getTaxId().trim())) {
            throw new IllegalArgumentException("El CUIT/TaxID '" + req.getTaxId() + "' ya se encuentra registrado.");
        }
        if (userRepository.existsByEmail(cleanEmail)) {
            throw new IllegalArgumentException("El correo '" + cleanEmail + "' ya pertenece a un usuario en el sistema.");
        }

        // 1. Crear la empresa
        Company company = Company.builder()
                .name(req.getCompanyName().trim())
                .taxId(req.getTaxId() != null ? req.getTaxId().trim() : null)
                .address(req.getAddress())
                .phone(req.getPhone())
                .email(cleanEmail)
                .monthlyFee(req.getMonthlyFee())
                .expirationDate(req.getExpirationDate() != null ? req.getExpirationDate() : LocalDate.now().plusDays(15))
                .active(false) // Deshabilitada hasta verificación
                .ticketMessage(req.getTicketMessage())
                .build();

        Company savedCompany = companyRepository.save(company);

        // 2. Crear usuario Admin (Dueño)
        User owner = User.builder()
                .name(req.getOwnerName() != null && !req.getOwnerName().isBlank() ? req.getOwnerName().trim() : req.getCompanyName().trim())
                .email(cleanEmail)
                .password(passwordEncoder.encode(req.getOwnerPassword()))
                .role(Role.ADMIN)
                .company(savedCompany)
                .active(false) // Inactivo por seguridad
                .build();

        User savedOwner = userRepository.save(owner);

        // 3. Generar o actualizar token de verificación (Válido por 24 horas)
        String tokenStr = UUID.randomUUID().toString();

        VerificationToken verificationToken = tokenRepository.findByUser(savedOwner)
                .orElse(new VerificationToken());

        verificationToken.setToken(tokenStr);
        verificationToken.setUser(savedOwner);
        verificationToken.setExpiryDate(LocalDateTime.now().plusHours(24));

        tokenRepository.save(verificationToken);

        // 4. Envío asíncrono/seguro de correo (no revierte la DB si el servidor SMTP falla)
        try {
            String linkActivacion = "https://baezpos.com/api/v1/auth/verify?token=" + tokenStr;
            emailService.enviarMailBienvenida(
                    savedOwner.getEmail(),
                    savedCompany.getName(),
                    savedOwner.getName(),
                    "Enlace de activación: " + linkActivacion
            );
        } catch (Exception e) {
            log.error("ADVERTENCIA: La empresa ID {} se creó correctamente, pero falló el envío del correo a {}: {}",
                    savedCompany.getId(), savedOwner.getEmail(), e.getMessage());
        }
    }

    @Override
    @Transactional
    public void updateCompanyMaster(Long id, CompanyDTO dto) {
        Company company = companyRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Empresa no encontrada"));

        if (dto.getTaxId() != null && !dto.getTaxId().trim().equals(company.getTaxId())) {
            if (companyRepository.existsByTaxId(dto.getTaxId().trim())) {
                throw new IllegalArgumentException("El CUIT/TaxID ya está asignado a otra empresa.");
            }
            company.setTaxId(dto.getTaxId().trim());
        }

        company.setName(dto.getName());
        company.setAddress(dto.getAddress());
        company.setPhone(dto.getPhone());
        company.setEmail(dto.getEmail() != null ? dto.getEmail().trim().toLowerCase() : null);
        company.setMonthlyFee(dto.getMonthlyFee());
        company.setExpirationDate(dto.getExpirationDate());
        company.setActive(dto.getActive());
        company.setTicketMessage(dto.getTicketMessage());

        if (dto.getOwnerPassword() != null && !dto.getOwnerPassword().trim().isEmpty()) {
            resetOwnerPassword(id, dto.getOwnerPassword().trim());
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
        stats.put("activeCompanies", companyRepository.countByActiveTrue());
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
            log.error("Error al enviar email de restablecimiento de contraseña a {}: {}", owner.getEmail(), e.getMessage());
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