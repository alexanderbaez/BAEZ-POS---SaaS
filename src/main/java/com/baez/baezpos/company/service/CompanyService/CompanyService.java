package com.baez.baezpos.company.service.CompanyService;

import com.baez.baezpos.company.dto.CompanyDTO;
import com.baez.baezpos.user.dto.UserDTO;
import java.util.Map;
import java.util.List;

public interface CompanyService {
    // Gestión de la Empresa
    CompanyDTO getAuthenticatedCompany();
    CompanyDTO updateAuthenticatedCompany(CompanyDTO dto);
    Map<String, Object> verificarEstadoSuscripcionAutenticada();
    void validarAcceso(Long companyId);

    // Gestión de sus Cajeros (Empleados)
    List<UserDTO> getMyEmployees();
    UserDTO createEmployee(UserDTO dto);
    UserDTO updateEmployee(Long id, UserDTO dto);
    void deleteEmployee(Long id);
}