package com.baez.baezpos.company.service.CompanyServiceImpl;

import com.baez.baezpos.company.dto.CompanyDTO;
import com.baez.baezpos.company.dto.MasterRegistrationRequest;
import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.company.repository.CompanyRepository;
import com.baez.baezpos.company.service.CompanyService.MasterADmin;
import com.baez.baezpos.user.entity.User;
import com.baez.baezpos.user.entity.Role;
import com.baez.baezpos.user.repository.UserRepository;
import com.baez.baezpos.mail.EmailService;
import com.baez.baezpos.shared.exception.ResourceNotFoundException;
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
public class MasterAdminService implements MasterADmin {

    private final CompanyRepository companyRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    // Eliminamos SystemLogRepository para que compile

    private String generarPlantilla(String titulo, String contenido) {
        return """
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background: #1a202c; color: #ffffff; padding: 30px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">BÁEZ POS</h1>
            </div>
            <div style="padding: 40px; background: #ffffff; color: #2d3748;">
                <h3 style="border-bottom: 2px solid #edf2f7; padding-bottom: 15px;">%s</h3>
                <div style="line-height: 1.6;">%s</div>
            </div>
        </div>
        """.formatted(titulo, contenido);
    }

    @Override
    @Transactional
    public void registerFullBusiness(MasterRegistrationRequest req) {
        if (req.getTaxId() != null && !req.getTaxId().isBlank() && companyRepository.existsByTaxId(req.getTaxId())) {
            throw new RuntimeException("El CUIT/TaxID ya existe en el sistema.");
        }
        if (req.getOwnerEmail() != null && userRepository.existsByEmail(req.getOwnerEmail())) {
            throw new RuntimeException("El correo del dueño ya esta registrado.");
        }

        // 1. Guardar la configuración del negocio
        Company company = Company.builder()
                .name(req.getCompanyName()).taxId(req.getTaxId()).address(req.getAddress())
                .phone(req.getPhone()).email(req.getOwnerEmail())
                .expirationDate(req.getExpirationDate() != null ? req.getExpirationDate() : LocalDate.now().plusDays(15))
                .active(true).ticketMessage(req.getTicketMessage()).build();

        Company savedCompany = companyRepository.save(company);

        // 2. Guardar el Admin CON relación a la empresa
        User owner = User.builder()
                .name(req.getOwnerName())
                .email(req.getOwnerEmail())
                .password(passwordEncoder.encode(req.getOwnerPassword()))
                .role(Role.ADMIN)
                .company(savedCompany)
                .active(true)
                .build();

        userRepository.save(owner);
    }

    @Override
    @Transactional
    public void updateCompanyMaster(Long id, CompanyDTO dto) {
        Company company = companyRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("No existe"));
        company.setName(dto.getName());
        company.setTaxId(dto.getTaxId());
        company.setAddress(dto.getAddress());
        company.setPhone(dto.getPhone());
        company.setExpirationDate(dto.getExpirationDate());
        company.setActive(dto.getActive());
        company.setTicketMessage(dto.getTicketMessage());
        companyRepository.save(company);
    }

    @Override
    @Transactional
    public void deleteCompanyMaster(Long id) {
        Company company = companyRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("No existe"));
        companyRepository.delete(company);
    }

    @Override
    public Map<String, Object> getMasterDashboardStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalCompanies", companyRepository.count());
        stats.put("activeCompanies", companyRepository.findAll().stream().filter(Company::getActive).count());
        return stats;
    }

    @Override
    @Transactional
    public void extendSubscriptionMaster(Long id) {
        Company company = companyRepository.findById(id).orElseThrow();
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
    }

    private CompanyDTO convertToDTOMaster(Company c) {
        return CompanyDTO.builder()
                .id(c.getId())
                .name(c.getName())
                .taxId(c.getTaxId())
                .address(c.getAddress())
                .phone(c.getPhone())
                .email(c.getEmail())
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