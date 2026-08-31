package com.baez.baezpos.company.service.CompanyService;

import com.baez.baezpos.company.dto.CompanyDTO;
import com.baez.baezpos.user.dto.UserRequestDTO;
import com.baez.baezpos.user.dto.UserResponseDTO;

import java.util.List;
import java.util.Map;

public interface CompanyService {
    // GestiÃ³n de la Empresa
    CompanyDTO getAuthenticatedCompany();
    CompanyDTO updateAuthenticatedCompany(CompanyDTO dto);
    Map<String, Object> verificarEstadoSuscripcionAutenticada();
    void validarAcceso(Long companyId);

    // GestiÃ³n de sus Cajeros (Empleados)
    List<UserResponseDTO> getMyEmployees();
    UserResponseDTO createEmployee(UserRequestDTO dto);
    UserResponseDTO updateEmployee(Long id, UserRequestDTO dto);
    void deleteEmployee(Long id);
}