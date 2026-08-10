package com.baez.baezpos.log.service;

import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.company.repository.CompanyRepository;
import com.baez.baezpos.log.dto.SystemLogResponseDTO;
import com.baez.baezpos.log.entity.SystemLog;
import com.baez.baezpos.log.repository.SystemLogRepository;
import com.baez.baezpos.security.util.SecurityUtils;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuditService {

    private final SystemLogRepository logRepository;
    private final CompanyRepository companyRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logAction(String action, String description, String level) {
        try {
            Long companyId = SecurityUtils.getCurrentCompanyId();
            String userEmail = SecurityUtils.getCurrentUserEmail();

            SystemLog.SystemLogBuilder<?, ?> logBuilder = SystemLog.builder()
                    .action(action)
                    .description(description)
                    .level(level != null ? level : "INFO")
                    .userEmail(userEmail != null ? userEmail : "SISTEMA");

            if (companyId != null) {
                Company company = companyRepository.findById(companyId).orElse(null);
                logBuilder.company(company);
            }

            logRepository.save(logBuilder.build());
        } catch (Exception e) {
            log.error("Error al registrar auditoría [{}]: {}", action, e.getMessage());
        }
    }

    public void logAction(String action, String description) {
        logAction(action, description, "INFO");
    }

    @Transactional(readOnly = true)
    public List<SystemLogResponseDTO> getLogs(Long filterCompanyId, int limit) {
        Long currentCompanyId = SecurityUtils.getCurrentCompanyId();
        Pageable pageable = PageRequest.of(0, Math.min(limit, 500));
        List<SystemLog> logs;

        if (currentCompanyId != null) {
            logs = logRepository.findByCompanyIdOrderByTimestampDesc(currentCompanyId, pageable);
        } else {
            logs = logRepository.findLogsForSuperAdmin(filterCompanyId, pageable);
        }

        return logs.stream().map(this::convertToDTO).collect(Collectors.toList());
    }

    private SystemLogResponseDTO convertToDTO(SystemLog log) {
        Long compId = null;
        String compName = "SISTEMA / GLOBAL";

        if (log.getCompany() != null) {
            try {
                compId = log.getCompany().getId();
                compName = log.getCompany().getName();
            } catch (EntityNotFoundException e) {
                // Si la empresa fue eliminada de la BD posteriormente, evitamos que rompa el flujo
                compName = "EMPRESA ELIMINADA (ID: " + compId + ")";
            }
        }

        return SystemLogResponseDTO.builder()
                .id(log.getId())
                .action(log.getAction())
                .description(log.getDescription())
                .level(log.getLevel())
                .userEmail(log.getUserEmail())
                .companyId(compId)
                .companyName(compName)
                .timestamp(log.getTimestamp())
                .build();
    }
}