package com.baez.baezpos.log.service;

import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.company.repository.CompanyRepository;
import com.baez.baezpos.log.entity.SystemLog;
import com.baez.baezpos.log.repository.SystemLogRepository;
import com.baez.baezpos.security.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

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
                Company company = companyRepository.getReferenceById(companyId);
                logBuilder.company(company);
            }

            logRepository.save(logBuilder.build());
        } catch (Exception e) {
            log.error("Error al registrar auditoría de acción [{}]: {}", action, e.getMessage());
        }
    }
}