package com.baez.baezpos.log.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Builder
public class SystemLogResponseDTO {
    private Long id;
    private String action;
    private String description;
    private String userEmail;
    private Long companyId; // Opcional, útil para el SUPER_ADMIN
    private LocalDateTime timestamp;
}