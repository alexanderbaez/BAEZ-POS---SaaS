package com.baez.baezpos.log.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SystemLogResponseDTO {
    private Long id;
    private String action;
    private String description;
    private String userEmail;
    private String level;
    private Long companyId;
    private String companyName; // Fundamental para la UI del Super Admin
    private LocalDateTime timestamp;
}