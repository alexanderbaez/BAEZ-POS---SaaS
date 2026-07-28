package com.baez.baezpos.log.service;

import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.company.repository.CompanyRepository;
import com.baez.baezpos.log.entity.SystemLog;
import com.baez.baezpos.log.repository.SystemLogRepository;
import com.baez.baezpos.security.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuditService {

    private final SystemLogRepository logRepository;
    private final CompanyRepository companyRepository;

    public void logAction(String action, String description) {
        try {
            Long companyId = SecurityUtils.getCurrentCompanyId();
            String userEmail = SecurityUtils.getCurrentUserEmail();

            SystemLog.SystemLogBuilder<?, ?> logBuilder = SystemLog.builder()
                    .action(action)
                    .description(description)
                    .userEmail(userEmail != null ? userEmail : "SISTEMA");

            if (companyId != null) {
                Company company = companyRepository.findById(companyId).orElse(null);
                logBuilder.company(company);
            }

            logRepository.save(logBuilder.build());
        } catch (Exception e) {
            log.error("Error al registrar auditoría de acción [{}]: {}", action, e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public List<SystemLog> getLogs() {
        Long companyId = SecurityUtils.getCurrentCompanyId();

        // Si es SUPER_ADMIN (companyId == null), obtiene los últimos 100 de toda la plataforma
        if (companyId == null) {
            return logRepository.findTop100ByOrderByTimestampDesc();
        }

        // Si es ADMIN / VENDEDOR, obtiene los 100 logs exclusivos de su empresa
        return logRepository.findTop100ByCompanyIdOrderByTimestampDesc(companyId);
    }
}