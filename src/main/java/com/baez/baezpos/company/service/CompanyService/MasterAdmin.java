package com.baez.baezpos.company.service.CompanyService;

import com.baez.baezpos.company.dto.CompanyDTO;
import com.baez.baezpos.company.dto.MasterRegistrationRequest;
import java.util.List;
import java.util.Map;

public interface MasterAdmin {
    List<CompanyDTO> getAllCompaniesMaster();
    void registerFullBusiness(MasterRegistrationRequest req);
    void updateCompanyMaster(Long id, CompanyDTO dto);
    void deleteCompanyMaster(Long id);
    void resetOwnerPassword(Long companyId, String newRawPassword);
    Map<String, Object> getMasterDashboardStats();
    void extendSubscriptionMaster(Long id);
}