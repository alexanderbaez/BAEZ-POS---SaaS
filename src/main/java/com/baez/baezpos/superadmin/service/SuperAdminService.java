package com.baez.baezpos.superadmin.service;

import com.baez.baezpos.superadmin.dto.SystemLogResponseDTO;

import java.util.List;

public interface SuperAdminService {
    List<SystemLogResponseDTO> getRecentLogs();
}