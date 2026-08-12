package com.baez.baezpos.log.service;

import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.log.dto.SystemLogResponseDTO;
import com.baez.baezpos.log.entity.SystemLog;
import com.baez.baezpos.log.repository.SystemLogRepository;
import com.baez.baezpos.security.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuditService {

    private final SystemLogRepository logRepository;

    /**
     * Registra auditorías de manera asíncrona sin bloquear la transacción principal.
     */
    @Async
    @Transactional
    public void logActionAsync(Long companyId, String userEmail, String action, String description, String level) {
        try {
            SystemLog.SystemLogBuilder<?, ?> logBuilder = SystemLog.builder()
                    .action(action)
                    .description(description)
                    .level(level != null ? level : "INFO")
                    .userEmail(userEmail != null ? userEmail : "SISTEMA");

            if (companyId != null) {
                Company company = new Company();
                company.setId(companyId);
                logBuilder.company(company);
            }

            logRepository.save(logBuilder.build());
        } catch (Exception e) {
            log.error("Error al registrar auditoría en background [{}]: {}", action, e.getMessage());
        }
    }

    /**
     * Método wrapper sincrónico para resolver seguridad y enviar al worker asíncrono
     */
    public void logAction(String action, String description, String level) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        String userEmail = SecurityUtils.getCurrentUserEmail();

        // Se ejecuta en un hilo separado inmediatamente
        logActionAsync(companyId, userEmail, action, description, level);
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

        return logs.stream().map(this::convertToDTO).toList();
    }

    private SystemLogResponseDTO convertToDTO(SystemLog logEntity) {
        Long compId = null;
        String compName = "SISTEMA / GLOBAL";

        if (logEntity.getCompany() != null) {
            compId = logEntity.getCompany().getId();
            try {
                compName = logEntity.getCompany().getName();
            } catch (Exception e) {
                compName = "EMPRESA (ID: " + compId + ")";
            }
        }

        return SystemLogResponseDTO.builder()
                .id(logEntity.getId())
                .action(logEntity.getAction())
                .description(logEntity.getDescription())
                .level(logEntity.getLevel())
                .userEmail(logEntity.getUserEmail())
                .companyId(compId)
                .companyName(compName)
                .timestamp(logEntity.getTimestamp())
                .build();
    }
}