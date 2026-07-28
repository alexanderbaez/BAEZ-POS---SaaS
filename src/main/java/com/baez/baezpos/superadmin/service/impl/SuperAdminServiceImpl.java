package com.baez.baezpos.superadmin.service.impl;

import com.baez.baezpos.log.entity.SystemLog;
import com.baez.baezpos.log.repository.SystemLogRepository;
import com.baez.baezpos.superadmin.dto.SystemLogResponseDTO;
import com.baez.baezpos.superadmin.service.SuperAdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SuperAdminServiceImpl implements SuperAdminService {

    private final SystemLogRepository logRepository;

    @Override
    @Transactional(readOnly = true)
    public List<SystemLogResponseDTO> getRecentLogs() {
        List<SystemLog> logs = logRepository.findTop100ByOrderByTimestampDesc();
        return logs.stream()
                .map(this::mapToDTO)
                .toList();
    }

    private SystemLogResponseDTO mapToDTO(SystemLog log) {
        return new SystemLogResponseDTO(
                log.getId(),
                log.getLevel(),
                log.getMessage(),
                log.getAction(),
                log.getUsername(),
                log.getCompanyId(),
                log.getTimestamp()
        );
    }
}