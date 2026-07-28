package com.baez.baezpos.log.controller;

import com.baez.baezpos.log.entity.SystemLog;
import com.baez.baezpos.log.service.AuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/logs")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AdminLogController {

    private final AuditService auditService;

    @GetMapping
    public ResponseEntity<List<SystemLog>> getLogs() {
        return ResponseEntity.ok(auditService.getLogs());
    }
}