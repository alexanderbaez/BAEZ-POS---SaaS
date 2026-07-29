package com.baez.baezpos.log.controller;

import com.baez.baezpos.log.dto.SystemLogResponseDTO;
import com.baez.baezpos.log.service.AuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/logs")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AdminLogController {

    private final AuditService auditService;

    @GetMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    public ResponseEntity<List<SystemLogResponseDTO>> getLogs() {
        return ResponseEntity.ok(auditService.getLogs());
    }
}