package com.baez.baezpos.superadmin.dto;

import java.time.LocalDateTime;

public record SystemLogResponseDTO(
        Long id,
        String level,
        String message,
        String action,
        String username,
        Long companyId,
        LocalDateTime timestamp
) {}