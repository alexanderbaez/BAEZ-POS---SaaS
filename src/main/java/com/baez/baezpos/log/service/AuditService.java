package com.baez.baezpos.log.service;

import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.company.repository.CompanyRepository;
import com.baez.baezpos.log.dto.SystemLogResponseDTO;
import com.baez.baezpos.log.entity.SystemLog;
import com.baez.baezpos.log.repository.SystemLogRepository;
import com.baez.baezpos.security.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

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
    public List<SystemLogResponseDTO> getLogs() {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        List<SystemLog> logs;

        if (companyId == null) {
            logs = logRepository.findTop100ByOrderByTimestampDesc();
        } else {
            logs = logRepository.findTop100ByCompanyIdOrderByTimestampDesc(companyId);
        }

        return logs.stream().map(this::convertToDTO).collect(Collectors.toList());
    }

    private SystemLogResponseDTO convertToDTO(SystemLog log) {
        return SystemLogResponseDTO.builder()
                .id(log.getId())
                .action(log.getAction())
                .description(log.getDescription())
                .userEmail(log.getUserEmail())
                .companyId(log.getCompany() != null ? log.getCompany().getId() : null)
                .timestamp(log.getTimestamp())
                .build();
    }
}